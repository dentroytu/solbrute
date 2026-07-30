/* ══════════════════════════════════════════════════════════════════════════
   SolBrute · cliente de base de datos (Supabase)
   ══════════════════════════════════════════════════════════════════════════
   Sustituye al STORE que guardaba en el navegador. A partir de aquí, un bruto
   forjado en un ordenador existe para todos los demás.

   Habla directamente con la API REST de Supabase con fetch(), sin librería.
   Son cuatro peticiones HTTP y así el proyecto sigue sin dependencias ni build,
   y sigue abriéndose con doble clic.

   ── Las claves de aquí abajo son públicas a propósito ──────────────────────
   La clave "anon" está diseñada para ir en el navegador: cualquiera que abra
   la web puede leerla. Lo que impide que un desconocido te borre la base de
   datos son las políticas RLS de supabase-01-tablas.sql, no el secreto de esta
   clave.
   La clave "service_role" NUNCA va aquí. Esa se salta todas las políticas.

   ── Estado de seguridad, hoy ───────────────────────────────────────────────
   Las políticas actuales dejan escribir a cualquiera, porque todavía no hay
   login con firma. Es aceptable mientras no haya nada con valor. El paso 2
   (Sign In With Solana) lo cierra. Ver BACKEND.md.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";

  const URL_BASE = "https://ihrcvartuuyvftxdxztt.supabase.co";
  const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlocmN2YXJ0dXV5dmZ0eGR4enR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MjYyMzcsImV4cCI6MjEwMTAwMjIzN30.rhX_iI5qZROciWSBP3m0RhkMQXTSz6ttQz2zpXj_uxk";

  const REST = URL_BASE + "/rest/v1";
  const CAB = {
    "apikey": ANON,
    "Authorization": "Bearer " + ANON,
    "Content-Type": "application/json"
  };

  /* Error propio para poder distinguir "nombre pillado" de "no hay red". */
  function ErrorDB(clase, mensaje){
    const e = new Error(mensaje || clase);
    e.clase = clase;            // "duplicado" | "red" | "http"
    return e;
  }

  async function pedir(ruta, opciones){
    let r;
    try{
      r = await fetch(REST + ruta, { ...opciones, headers: { ...CAB, ...(opciones && opciones.headers) } });
    }catch(e){
      throw ErrorDB("red", "No se pudo contactar con la base de datos");
    }
    if(!r.ok){
      const cuerpo = await r.text();
      /* 23505 = clave única duplicada en Postgres. Aquí solo puede ser el nombre. */
      if(r.status === 409 || cuerpo.includes("23505")) throw ErrorDB("duplicado", cuerpo);
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
    rerolls_left: b.rerolls, pool: b.pool || null
  });

  const aBruto = (f, idLocal) => ({
    id: idLocal, rid: f.id,
    name: f.name, lv: f.level, xp: f.xp, hpMax: f.hp_max,
    str: f.str, agi: f.agi, spd: f.spd, w: f.wins, l: f.losses,
    fights: f.fights_left, dia: f.fights_day, look: f.look,
    rerolls: f.rerolls_left, pool: f.pool || null
  });

  window.SolBruteDB = {

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
        brutos: (brutos || []).map((f, i) => aBruto(f, i + 1))
      };
    },

    /* Monedas del jugador. */
    async guardarJugador(addr, balance){
      await pedir("/players?address=eq." + encodeURIComponent(addr), {
        method: "PATCH",
        body: JSON.stringify({ coins: balance, last_seen: new Date().toISOString() })
      });
    },

    /* Inserta un bruto nuevo y devuelve su id de base de datos.
       Puede lanzar ErrorDB("duplicado") si el nombre ya existe: los nombres son
       únicos en todo el juego, no solo dentro de tu ludus. */
    async crear(addr, bruto, dia){
      const filas = await pedir("/brutes", {
        method: "POST",
        headers: { "Prefer": "return=representation" },
        body: JSON.stringify(aFila(bruto, addr, dia))
      });
      return filas[0].id;
    },

    /* Actualiza un bruto que ya existe (tras pelear, subir de nivel…). */
    async actualizar(bruto, dia){
      if(!bruto.rid) return;
      await pedir("/brutes?id=eq." + bruto.rid, {
        method: "PATCH",
        body: JSON.stringify({
          level: bruto.lv, xp: bruto.xp, hp_max: bruto.hpMax,
          str: bruto.str, agi: bruto.agi, spd: bruto.spd,
          wins: bruto.w, losses: bruto.l,
          fights_left: bruto.fights, fights_day: dia,
          rerolls_left: bruto.rerolls, pool: bruto.pool || null
        })
      });
    },

    async borrar(bruto){
      if(!bruto.rid) return;
      await pedir("/brutes?id=eq." + bruto.rid, { method:"DELETE" });
    },

    /* Vacía el ludus. Lo usan los botones de la barra de maqueta; sin esto,
       "Ludus vacío" los borraría de la pantalla pero no de la base de datos, y
       reaparecerían al recargar. */
    async borrarTodos(addr){
      await pedir("/brutes?owner=eq." + encodeURIComponent(addr), { method:"DELETE" });
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
