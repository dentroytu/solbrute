/* ══════════════════════════════════════════════════════════════════════════
   SolBrute · cliente de base de datos (Supabase)
   ══════════════════════════════════════════════════════════════════════════
   Sustituye al STORE que guardaba en el navegador. A partir de aquí, un bruto
   forjado en un ordenador existe para todos los demás.

   Sin librería, solo fetch(): el proyecto sigue sin dependencias ni build, y
   sigue abriéndose con doble clic.

   ── Leer va directo, escribir no ──────────────────────────────────────────
   Las LECTURAS (rivales, clasificación, tu ludus) van a la API REST con la
   clave anon: son públicas y así no se paga un rodeo.

   Las ESCRITURAS pasan todas por la Edge Function "auth", que comprueba de
   quién es tu token de sesión y escribe con service_role. Las políticas RLS
   le deniegan al navegador cualquier escritura, así que abrir la consola no
   sirve de nada: Postgres rechaza la petición venga de donde venga.

   ── Las claves de aquí abajo son públicas a propósito ──────────────────────
   La clave "anon" está diseñada para ir en el navegador: cualquiera que abra
   la web puede leerla. Lo que impide que un desconocido te borre la base de
   datos son las políticas RLS de supabase-01-tablas.sql, no el secreto de esta
   clave.
   La clave "service_role" NUNCA va aquí. Esa se salta todas las políticas.

   ── Lo que sigue sin estar cerrado ────────────────────────────────────────
   El combate lo calcula el navegador. Nadie puede tocar tus brutos, pero tú
   sí puedes mentir sobre los tuyos: darte monedas o victorias. El servidor
   recorta lo imposible (nivel 9999, fuerza 500) pero no arbitra. Cerrarlo es
   mover simulate() al servidor. Ver BACKEND.md.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";

  const URL_BASE = "https://ihrcvartuuyvftxdxztt.supabase.co";
  const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlocmN2YXJ0dXV5dmZ0eGR4enR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MjYyMzcsImV4cCI6MjEwMTAwMjIzN30.rhX_iI5qZROciWSBP3m0RhkMQXTSz6ttQz2zpXj_uxk";

  const REST = URL_BASE + "/rest/v1";
  const FUNCIONES = URL_BASE + "/functions/v1";

  /* ═══════════ sesión ═══════════
     Token opaco que emite la Edge Function tras comprobar tu firma. No lleva
     nada dentro: o está en la tabla de sesiones del servidor o no vale, así
     que no hay nada que falsificar.

     Sirve para ESCRIBIR a través de la función. Las lecturas van con la clave
     anon, porque rivales y clasificación son públicos.

     Se guarda en localStorage con su caducidad para no pedirte la firma en
     cada recarga. Si el token se filtrara, vale 24 h y solo para tu cuenta;
     por eso la sesión es corta y no eterna. */
  const KEY_SESION = "solbrute:sesion:v1";
  let sesion = null;   // { token, address, exp }

  function cargarSesion(){
    try{
      const s = JSON.parse(localStorage.getItem(KEY_SESION) || "null");
      if(s && s.token && s.exp > Date.now() / 1000 + 60) sesion = s;
      else localStorage.removeItem(KEY_SESION);
    }catch(e){ sesion = null; }
    return sesion;
  }
  cargarSesion();

  /* Las lecturas van siempre con la clave anon. El token de sesión no se
     manda aquí: a PostgREST no le dice nada, solo lo entiende la función. */
  const CAB = () => ({
    "apikey": ANON,
    "Authorization": "Bearer " + ANON,
    "Content-Type": "application/json"
  });

  /* Error propio para poder distinguir "nombre pillado" de "no hay red". */
  function ErrorDB(clase, mensaje){
    const e = new Error(mensaje || clase);
    e.clase = clase;            // "duplicado" | "red" | "http"
    return e;
  }

  async function pedir(ruta, opciones){
    let r;
    try{
      r = await fetch(REST + ruta, { ...opciones, headers: { ...CAB(), ...(opciones && opciones.headers) } });
    }catch(e){
      throw ErrorDB("red", "No se pudo contactar con la base de datos");
    }
    if(!r.ok){
      const cuerpo = await r.text();
      /* 23505 = clave única duplicada en Postgres. Aquí solo puede ser el nombre. */
      if(r.status === 409 || cuerpo.includes("23505")) throw ErrorDB("duplicado", cuerpo);
      /* 401/403 con sesión puesta = el token caducó o dejó de valer. Se tira y
         se avisa, para que la app pida firmar otra vez en vez de fallar en
         bucle sin explicación. */
      if((r.status === 401 || r.status === 403) && sesion){
        window.SolBruteDB.cerrarSesion();
        throw ErrorDB("sesion", "la sesión ya no vale, hay que volver a firmar");
      }
      throw ErrorDB("http", "HTTP " + r.status + " · " + cuerpo);
    }
    const txt = await r.text();
    return txt ? JSON.parse(txt) : null;
  }

  /* ═══════════ traducción entre el objeto del juego y la fila ═══════════ */
  /* El juego usa lv/hpMax/w/l; la tabla usa level/hp_max/wins/losses.
     Se traduce en un solo sitio para que un cambio de esquema no se esparza. */
  const aFila = (b, owner, dia) => ({
    owner, name: b.name, level: b.lv, xp: b.xp,
    hp_max: b.hpMax, str: b.str, agi: b.agi, spd: b.spd,
    wins: b.w, losses: b.l, look: b.look,
    fights_left: b.fights, fights_day: dia,
    rerolls_left: b.rerolls, pool: b.pool || null,
    /* Y de vuelta, para que el modo local (sin base de datos) tampoco pierda
       el arma. La Edge Function ignora estos campos al escribir —el arma la
       decide ella en `comprar` y `equipar`— así que mandarlos no abre nada. */
    arma: b.arma || "ninguna", armas: b.armas || []
  });

  const aBruto = (f, idLocal) => ({
    id: idLocal, rid: f.id,
    name: f.name, lv: f.level, xp: f.xp, hpMax: f.hp_max,
    str: f.str, agi: f.agi, spd: f.spd, w: f.wins, l: f.losses,
    fights: f.fights_left, dia: f.fights_day, look: f.look,
    rerolls: f.rerolls_left, pool: f.pool || null,
    /* El arma tiene que viajar en la traducción o el bruto llega desarmado.
       Faltaba, y el síntoma era que en la arena NUNCA se veía el arma: la fila
       traía `arma` (se lee con select=*) pero aquí se quedaba fuera, así que
       `spriteProfile` recibía `b.arma === undefined` y dibujaba los puños.

       Engañaba porque la armería sí funcionaba: al comprar, la respuesta del
       servidor escribe `active.arma` a mano. O sea que el arma se veía hasta
       que recargabas la página, y entonces desaparecía sin motivo aparente. */
    arma: f.arma || "ninguna", armas: f.armas || []
  });

  const token = () => (sesion ? sesion.token : "");

  /* Llamada a la Edge Function "auth". Va siempre con la clave anon: es el
     único sitio que tiene que funcionar ANTES de tener sesión. */
  /* `funcion` existe porque la RETIRADA vive en su propia Edge Function, no en
     `auth`: las librerías de Solana pesan y su arranque en frío no lo tiene que
     pagar cada login y cada pelea. Todo lo demás sigue yendo a `auth`. */
  async function pedirAuth(cuerpo, funcion = "auth"){
    let r;
    try{
      r = await fetch(FUNCIONES + "/" + funcion, {
        method: "POST",
        headers: { "apikey": ANON, "Authorization": "Bearer " + ANON, "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo)
      });
    }catch(e){ throw ErrorDB("red", "no llego al servidor de login"); }

    const datos = await r.json().catch(() => ({}));
    if(!r.ok){
      /* El nombre repetido tiene su propia clase para que la forja pueda
         avisar en pantalla en vez de soltar un error genérico. */
      if(r.status === 409 || datos.clase === "duplicado") throw ErrorDB("duplicado", datos.error || "nombre ocupado");
      /* Sesión caducada o revocada: se tira y la app pedirá firmar otra vez. */
      if(r.status === 401 && sesion){ window.SolBruteDB.cerrarSesion(); throw ErrorDB("sesion", datos.error || "sesión no válida"); }
      throw ErrorDB("auth", datos.error || ("HTTP " + r.status));
    }
    return datos;
  }

  window.SolBruteDB = {

    /* ═══════════ login con firma ═══════════ */

    sesionActiva: () => !!sesion,
    direccionSesion: () => sesion && sesion.address,
    /* Solo para decidir si se enseña la barra de maqueta. No protege nada: las
       rutas de admin comprueban la lista en el servidor. */
    esAdmin: () => !!(sesion && sesion.admin),

    /* Paso 1: el servidor reserva un número de un solo uso.
       Que lo dé ÉL es lo que convierte la firma en una prueba: un nonce que se
       inventa el navegador no demuestra nada. */
    async pedirNonce(address){
      const d = await pedirAuth({ accion: "nonce", address });
      return d.nonce;
    },

    /* Paso 2: el servidor comprueba la firma con ed25519 y devuelve el token.
       Si algo no cuadra —firma falsa, nonce usado, dominio ajeno, mensaje
       viejo— responde 401 y aquí se lanza un error con el motivo. */
    async verificarFirma(address, message, signature){
      const d = await pedirAuth({ accion: "verify", address, message, signature });
      sesion = { token: d.token, address, admin: !!d.admin,
                 exp: Math.floor(Date.now()/1000) + (d.expires_in || 86400) };
      try{ localStorage.setItem(KEY_SESION, JSON.stringify(sesion)); }catch(e){}
      return sesion;
    },

    cerrarSesion(){
      sesion = null;
      try{ localStorage.removeItem(KEY_SESION); }catch(e){}
    },

    /* ¿Responde la base de datos? Se usa para decidir si caer al modo local. */
    async vive(){
      try{ await pedir("/brutes?select=id&limit=1", { method:"GET" }); return true; }
      catch(e){ return false; }
    },

    /* Carga el jugador y sus brutos. Si el jugador es nuevo, lo crea. */
    async cargar(addr){
      const filas = await pedir("/players?address=eq." + encodeURIComponent(addr) + "&select=*", { method:"GET" });
      let jugador = filas && filas[0];

      if(!jugador){
        const nuevo = await pedir("/players", {
          method: "POST",
          headers: { "Prefer": "return=representation" },
          body: JSON.stringify({ address: addr, coins: 120, slots: 1 })
        });
        jugador = nuevo[0];
      }

      const brutos = await pedir(
        "/brutes?owner=eq." + encodeURIComponent(addr) + "&select=*&order=created_at.asc",
        { method:"GET" });

      return {
        balance: Number(jugador.coins),
        /* La bolsa de armas es del JUGADOR, no del bruto (paso 14). Formato
           {"daga":2,"mandoble":1}: solo las copias LIBRES. Lo que un bruto
           lleva puesto no está aquí — está en su `arma`. */
        bolsa: (jugador.armas && typeof jugador.armas === "object") ? jugador.armas : {},
        brutos: (brutos || []).map((f, i) => aBruto(f, i + 1))
      };
    },

    /* ═══════════ escrituras ═══════════
       Ninguna toca la base de datos directamente: van a la Edge Function, que
       comprueba de quién es el token y escribe por ti con service_role.

       Las políticas RLS le deniegan al navegador toda escritura, así que
       intentar saltarse esto abriendo la consola no lleva a ninguna parte:
       Postgres rechaza la petición venga como venga.

       Las LECTURAS sí van directas (rivales, clasificación, tu ludus): son
       públicas y así no se paga el rodeo por la función. */

    /* Pide una tirada de atributos. La hace el servidor y la recuerda; forjar
       usará esa, no la que enseñe la pantalla. Volver a tirar la sustituye. */
    async tirar(){
      const d = await pedirAuth({ accion: "tirar", token: token() });
      return d.roll;
    },

    /* Forja un bruto. El servidor comprueba el tope de 3, el precio de la
       plaza, que el nombre esté libre y usa SU tirada de atributos. */
    async crear(addr, bruto, dia){
      /* Devuelve también el saldo: el precio de la plaza lo cobra el servidor,
         así que es él quien sabe cuánto te queda. */
      return await pedirAuth({ accion: "forjar", token: token(),
                               bruto: { ...bruto, dia: bruto.dia || dia } });
    },

    /* Guarda monedas y brutos de una vez. Antes era una petición por bruto;
       ahora va todo junto porque cada una cuesta un viaje a la función. */
    /* Sin saldo: las monedas solo las mueve el servidor, al pelear y al cobrar
       una plaza. Mandarlo desde aquí sería dejar que el jugador se lo fije. */
    async guardarTodo(brutos){
      await pedirAuth({ accion: "guardar", token: token(),
                        brutos: (brutos || []).filter(b => b.rid) });
    },

    /* Vacía tu ludus. Solo puede borrar los tuyos: el servidor filtra por el
       dueño de la sesión, no por lo que diga el navegador. */
    async borrarTodos(){
      await pedirAuth({ accion: "vaciar", token: token() });
    },

    /* ═══════════ panel de administración ═══════════
       Quién es administrador lo decide el SERVIDOR, comparando la dirección de
       la sesión con una lista suya. Aquí no hay ninguna comprobación porque
       cualquiera podría saltársela: si no eres admin, estas dos responden lo
       mismo que una sesión caducada. */
    /* ═══════════ torneos, desde el panel ═══════════
       Los borradores solo se ven por aquí: la política de lectura de
       `tournaments` los esconde del navegador a propósito, para que el admin
       pueda montar uno tranquilo antes de abrirlo. */
    async adminTorneos(){
      return await pedirAuth({ accion: "admin_torneos", token: token() });
    },
    async adminTorneoCrear(campos){
      return await pedirAuth({ accion: "admin_torneo_crear", token: token(), campos });
    },
    async adminTorneoEditar(id, campos){
      return await pedirAuth({ accion: "admin_torneo_editar", token: token(), id, campos });
    },
    /* Adelanta la fecha y resuelve. No se salta ninguna comprobación: si hay
       menos de dos inscritos, se cancela y se devuelven las entradas. */
    async adminTorneoResolver(id){
      return await pedirAuth({ accion: "admin_torneo_resolver", token: token(), id });
    },
    async adminTorneoBorrar(id){
      return await pedirAuth({ accion: "admin_torneo_borrar", token: token(), id });
    },

    async adminResumen(){
      return (await pedirAuth({ accion: "admin_resumen", token: token() })).resumen;
    },
    async adminJugadores(){
      return await pedirAuth({ accion: "admin_jugadores", token: token() });
    },
    async adminEditarBruto(id, campos){
      return await pedirAuth({ accion: "admin_editar_bruto", token: token(), id, campos });
    },
    async adminEditarJugador(address, campos){
      return await pedirAuth({ accion: "admin_editar_jugador", token: token(), address, campos });
    },
    async adminBorrarBruto(id){
      return await pedirAuth({ accion: "admin_borrar_bruto", token: token(), id });
    },
    async adminBorrarJugador(address){
      return await pedirAuth({ accion: "admin_borrar_jugador", token: token(), address });
    },

    /* ═══════════ la armería ═══════════ */
    /* Comprar ya no lleva bruto: el arma va a TU bolsa y desde ahí la equipas
       en el que quieras. Antes las armas eran del bruto, así que la daga que
       comprabas no era tuya sino suya, y un bruto nuevo empezaba sin nada
       aunque tuvieras cinco guardadas. */
    async comprarArma(arma){
      return await pedirAuth({ accion: "comprar", token: token(), arma });
    },
    async equiparArma(bruteRid, arma){
      return await pedirAuth({ accion: "equipar", token: token(), bruteId: bruteRid, arma });
    },

    /* Convierte saldo del juego en $BRUTE de verdad. Va a la función `retirar`,
       que es la única que tiene la clave del tesoro.

       La dirección de destino NO se manda: la saca el servidor del token de
       sesión. Si se aceptara del navegador, cualquiera se mandaría a sí mismo
       el saldo de otro. */
    async retirar(monedas){
      return await pedirAuth({ accion: "retirar", token: token(), monedas }, "retirar");
    },

    /* El listado sí se queda en `auth`: es una consulta sin riesgo y no
       necesita ninguna librería de Solana. */
    async misRetiradas(limite){
      return await pedirAuth({ accion: "retiradas", token: token(), limite: limite || 20 });
    },

    /* Las últimas peleas de TUS brutos, para el tablón del ludus.
       Va por lectura directa —`fights` tiene política de lectura pública desde
       el paso 7— y no por la Edge Function: no hay nada que decidir ni nada
       sensible dentro, así que hacerla pasar por allí sería gastar una llamada
       en un portero que siempre dice que sí.

       Ojo con la diferencia respecto a `historial()`, que sí pasa por la
       función: una pelea la ve el rival igual que tú; lo que gastas, no. */
    async eventos(addr, limite){
      const n = Math.min(Math.max(limite || 12, 1), 50);
      return await pedir(
        "/fights?a_owner=eq." + encodeURIComponent(addr) +
        "&select=id,a_brute,b_name,b_bot,winner,turns,coins,xp,subio,nivel,ganancia,arma_rota,arma,created_at" +
        "&order=created_at.desc&limit=" + n, { method:"GET" });
    },

    /* El historial va por la función, no por lectura directa como los rivales
       o la clasificación. No es por comodidad: la tabla `movimientos` tiene RLS
       y cero políticas, así que desde aquí no se puede leer ni queriendo.

       Tiene que ser así. El navegador lee con la clave anon, y para Postgres
       todos los jugadores son el mismo usuario `anon` — una política de lectura
       no podría distinguir tu historial del de otro y los enseñaría todos.
       La dirección la pone el servidor a partir del token; aquí no se manda. */
    async historial(limite){
      return await pedirAuth({ accion: "historial", token: token(), limite: limite || 50 });
    },

    /* Pide la lista de rivales. La arma el servidor y la recuerda; `reroll`
       gasta el cambio del día. Antes la construía el navegador y la mandaba,
       así que se podía pelear contra un rival inventado de 1 punto de vida. */
    async arena(bruteRid, reroll){
      return await pedirAuth({ accion: "arena", token: token(), bruteId: bruteRid,
                               reroll: !!reroll, version: window.BruteCombate.VERSION });
    },

    /* Pide una pelea. El servidor elige la semilla, calcula el combate y
       aplica monedas y experiencia; aquí solo llega el registro para animarlo.

       `opponentIdx` es la posición en la lista que el propio servidor guardó
       (brutes.pool), no un rival que mande el navegador: así no se puede pedir
       pelea contra un enemigo inventado de 1 punto de vida. */
    async pelear(bruteRid, opponentIdx){
      return await pedirAuth({ accion: "pelear", token: token(),
                               bruteId: bruteRid, opponentIdx,
                               version: window.BruteCombate.VERSION });
    },

    /* Rivales de otros jugadores, de nivel parecido.
       El filtro por nivel lo hace Postgres, no el navegador: por eso la tabla
       tiene el índice brutes_level_idx. */
    async rivales(addr, lv, margen, limite){
      const filas = await pedir(
        "/brutes?owner=neq." + encodeURIComponent(addr) +
        "&level=gte." + Math.max(1, lv - margen) +
        "&level=lte." + (lv + margen) +
        "&select=*&limit=" + (limite || 20),
        { method:"GET" });
      return (filas || []).map((f, i) => ({ ...aBruto(f, "p" + i), owner: f.owner }));
    },

    /* Clasificación general.
       Solo salen jugadores reales, y no porque se filtre: los brutos de la casa
       se inventan en el navegador al emparejar y nunca se guardan. En esta tabla
       únicamente hay brutos que alguien forjó.
       Orden: nivel, luego XP, luego victorias — así dos del mismo nivel se
       separan por lo cerca que están del siguiente. */
    async clasificacion(limite){
      const filas = await pedir(
        "/brutes?select=id,owner,name,level,xp,hp_max,str,agi,spd,wins,losses,look,fights_left,fights_day" +
        "&order=level.desc,xp.desc,wins.desc,created_at.asc" +
        "&limit=" + (limite || 25),
        { method:"GET" });
      return (filas || []).map((f, i) => ({ ...aBruto(f, "r" + i), owner: f.owner }));
    }
  };
})();
