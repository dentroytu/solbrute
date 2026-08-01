/* ══════════════════════════════════════════════════════════════════════════
   SolBrute · Edge Function "auth" — login con firma (Sign In With Solana)
   ══════════════════════════════════════════════════════════════════════════
   Se despliega desde el panel de Supabase: Edge Functions → Deploy a new
   function → nombre EXACTO "auth" → pegar este fichero entero.

   No necesita ningún secreto tuyo: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
   los pone Supabase sola.

   ── Qué hace y por qué es el único sitio donde puede hacerse ──────────────
   El navegador NO puede demostrar quién eres: cualquier cosa que calcule, la
   puede falsificar quien abra la consola. La única prueba que vale es
   criptográfica y hay que comprobarla aquí, en un sitio donde el usuario no
   manda.

   Dos rutas:

     POST { accion: "nonce",  address }
        → reserva un número de un solo uso para esa dirección.

     POST { accion: "verify", address, message, signature }
        → comprueba la firma con ed25519, tacha el nonce y abre una sesión.
          Devuelve un token opaco propio.

     POST { accion: "forjar" | "guardar" | "vaciar", token, ... }
        → escribe en la base de datos EN TU NOMBRE, tras comprobar de quién es
          ese token.

   ── Por qué el navegador ya no escribe ────────────────────────────────────
   Este proyecto usa claves de firma asimétricas (ECC P-256). Esa clave
   privada la gestiona Supabase y no la entrega, así que es imposible emitir
   un token que su API acepte, y el secreto legacy solo verifica y está
   marcado para revocación.

   La solución no es pelearse con eso: es que el navegador deje de escribir.
   Las políticas RLS le deniegan toda escritura y todo pasa por aquí, con
   service_role. Sale más fuerte de lo que iba a ser con el JWT.

   ── Lo que este fichero NO arregla ────────────────────────────────────────
   El combate lo sigue calculando el navegador. Con esto un tramposo ya no
   puede tocar los brutos de OTROS, pero sí puede mentir sobre los suyos —
   darse monedas o victorias. Eso es el siguiente paso: mover simulate() aquí.
   Ver BACKEND.md.
   ══════════════════════════════════════════════════════════════════════════ */

/* ── Las reglas del combate ────────────────────────────────────────────────
   brute-combate.js va COMO SEGUNDO FICHERO de esta función: en el editor de
   Supabase, "Add File" → nombre exacto brute-combate.js → pegar el mismo
   fichero que hay en el repositorio, sin tocar una coma.

   El primer intento fue importarlo por URL desde la web publicada, para que
   hubiera una sola copia de verdad. No se puede: el empaquetador de Supabase
   no descarga dominios externos al desplegar ("Cannot import from
   dentroytu.github.io:443").

   Así que hay dos copias del fichero y no hay forma de evitarlo. Lo que sí hay
   es una red: cada petición de combate trae la VERSION del navegador y aquí se
   compara con la de esta copia. Si no coinciden, la pelea se rechaza en vez de
   arbitrarse con reglas distintas — que sería el servidor diciendo que perdiste
   mientras la pantalla dice que ganaste.

   AL TOCAR EL EQUILIBRIO: sube VERSION en brute-combate.js, publica la web, y
   vuelve a pegar el fichero aquí. Si se te olvida lo segundo, nadie podrá
   pelear y el aviso lo dirá — que es justo lo que se busca. */
import "./brute-combate.js";
const C = (globalThis as any).BruteCombate;

/* Dominios desde los que se acepta un login. El mensaje firmado lleva dentro
   el dominio; si no se comprobara, una web fraudulenta podría hacerte firmar
   "malaweb.com quiere que inicies sesión" y reutilizar esa firma aquí.
   Añade aquí tu dominio propio cuando lo tengas. */
const DOMINIOS_OK = [
  "dentroytu.github.io",
  "localhost:8777",
  "127.0.0.1:8777",
];

const VIDA_NONCE_MIN = 5;      // minutos que vale un nonce
const VIDA_SESION_H  = 24;     // horas que dura la sesión

const URL_SB  = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/* Reglas del juego. Están aquí además de en app.html a propósito: lo que
   valida el servidor no puede depender de lo que diga el navegador. */
/* Direcciones con acceso al panel. Van en un secreto de Supabase
   (ADMIN_WALLETS, separadas por comas) y no en el código: este repositorio es
   público, y ahí dentro la wallet del dueño quedaría a la vista de cualquiera.
   Añadir un administrador es editar el secreto, sin desplegar nada. */
const ADMINS = (Deno.env.get("ADMIN_WALLETS") || "")
  .split(",").map((x) => x.trim()).filter(Boolean);

const MAX_BRUTOS = 3;
const PRECIO_PLAZA = [0, 50, 150];   // la primera gratis; las otras cuestan
/* Se empieza a cero: las monedas van a ser un token de Solana con valor real,
   y regalar saldo al darse de alta sería regalar dinero a cada wallet nueva —
   que es la forma más rápida de que alguien cree mil cuentas.
   El primer bruto es gratis, así que se puede jugar desde el minuto uno; la
   segunda plaza hay que ganársela peleando. */
const MONEDAS_INICIO = 0;
const STAT_MAX = 10, HP_MAX = 300, NIVEL_MAX = 100;

/* El navegador llama desde otro origen, así que sin esto el navegador ni
   siquiera deja salir la petición. */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const responder = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

/* ═══════════ base58 → bytes ═══════════ */
/* Direcciones y firmas de Solana viajan en base58. Hay que volverlos bytes
   para poder verificar. Los ceros por delante se escriben como "1". */
const ALFABETO = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function desdeBase58(texto: string): Uint8Array {
  const bytes: number[] = [];
  for (const caracter of texto) {
    const valor = ALFABETO.indexOf(caracter);
    if (valor < 0) throw new Error("carácter no válido en base58: " + caracter);
    let acarreo = valor;
    for (let i = 0; i < bytes.length; i++) {
      acarreo += bytes[i] * 58;
      bytes[i] = acarreo & 0xff;
      acarreo >>= 8;
    }
    while (acarreo > 0) { bytes.push(acarreo & 0xff); acarreo >>= 8; }
  }
  for (const caracter of texto) { if (caracter === "1") bytes.push(0); else break; }
  return new Uint8Array(bytes.reverse());
}

/* ═══════════ base64url ═══════════ */
/* Para los tokens de sesión y los nonces. */
const b64url = (datos: Uint8Array) =>
  btoa(String.fromCharCode(...datos)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/* ═══════════ acceso a la base de datos ═══════════ */
/* Con service_role, que se salta RLS. Por eso esta clave vive solo aquí. */
async function db(ruta: string, opciones: RequestInit = {}) {
  const r = await fetch(URL_SB + "/rest/v1" + ruta, {
    ...opciones,
    headers: {
      apikey: SERVICE,
      Authorization: "Bearer " + SERVICE,
      "Content-Type": "application/json",
      ...(opciones.headers || {}),
    },
  });
  if (!r.ok) throw new Error("db " + r.status + ": " + (await r.text()));
  const texto = await r.text();
  return texto ? JSON.parse(texto) : null;
}

/* ═══════════ lectura del mensaje firmado ═══════════ */
/* Se leen los campos del mensaje en vez de reconstruirlo: reconstruirlo
   exigiría reproducir la fecha al milisegundo y cualquier cambio de formato
   rompería el login sin avisar. */
function leerMensaje(mensaje: string) {
  const lineas = mensaje.split("\n");
  const dominio = (lineas[0] || "").replace(/ wants you to sign in.*$/, "").trim();
  const campo = (nombre: string) => {
    const l = lineas.find((x) => x.startsWith(nombre + ": "));
    return l ? l.slice(nombre.length + 2).trim() : "";
  };
  return {
    dominio,
    direccion: (lineas[1] || "").trim(),
    nonce: campo("Nonce"),
    fecha: campo("Issued At"),
    uri: campo("URI"),
  };
}

/* ═══════════ sesiones ═══════════ */

/* Token opaco: 32 bytes de azar. No lleva información dentro, así que no hay
   nada que falsificar — o está en la tabla o no vale. */
function nuevoToken(): string {
  return b64url(crypto.getRandomValues(new Uint8Array(32)));
}

/* Devuelve la dirección dueña de esa sesión, o null.
   TODA escritura pasa por aquí: es el único punto donde se decide quién eres. */
async function duenoDe(token: string): Promise<string | null> {
  if (!token || token.length < 20) return null;
  const filas = await db("/sessions?token=eq." + encodeURIComponent(token) + "&select=address,expires_at");
  const s = filas && filas[0];
  if (!s) return null;
  if (Date.parse(s.expires_at) < Date.now()) return null;
  return s.address as string;
}

/* ═══════════ saneado de datos del juego ═══════════ */
/* El navegador manda los números; aquí se recortan a lo posible. Esto NO
   convierte al servidor en árbitro —el combate lo sigue calculando el
   cliente, así que puede mentir sobre sus propias peleas— pero corta el
   fraude perezoso: nivel 9999, fuerza 500 o vida infinita. */
const entre = (v: unknown, min: number, max: number, pordefecto: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : pordefecto;
};

function sanearBruto(b: Record<string, unknown>) {
  return {
    name: String(b.name ?? "").trim().slice(0, 16),
    level: entre(b.lv, 1, NIVEL_MAX, 1),
    xp: entre(b.xp, 0, 1e6, 0),
    hp_max: entre(b.hpMax, 1, HP_MAX, 40),
    str: entre(b.str, 1, STAT_MAX, 1),
    agi: entre(b.agi, 1, STAT_MAX, 1),
    spd: entre(b.spd, 1, STAT_MAX, 1),
    wins: entre(b.w, 0, 1e6, 0),
    losses: entre(b.l, 0, 1e6, 0),
    fights_left: entre(b.fights, 0, 3, 3),
    rerolls_left: entre(b.rerolls, 0, 1, 1),
    fights_day: String(b.dia ?? "").slice(0, 10) || new Date().toISOString().slice(0, 10),
    look: b.look ?? {},
    pool: b.pool ?? null,
  };
}

/* ═══════════ servidor ═══════════ */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return responder({ error: "solo POST" }, 405);

  let cuerpo: Record<string, any>;
  try { cuerpo = await req.json(); }
  catch { return responder({ error: "cuerpo no es JSON" }, 400); }

  const accion = cuerpo.accion;

  /* ══════════ rutas de login ══════════ */

  if (accion === "nonce" || accion === "verify") {
    const address = cuerpo.address;
    /* Una dirección de Solana son 32 bytes: 43-44 caracteres en base58. */
    if (!address || address.length < 32 || address.length > 44) {
      return responder({ error: "dirección no válida" }, 400);
    }

    if (accion === "nonce") {
      /* Barrido oportunista, para no depender de ninguna tarea programada. */
      await db("/auth_nonces?expires_at=lt." + new Date(Date.now() - 3600e3).toISOString(),
               { method: "DELETE" }).catch(() => {});

      const nonce = b64url(crypto.getRandomValues(new Uint8Array(24)));
      const expira = new Date(Date.now() + VIDA_NONCE_MIN * 60e3).toISOString();
      await db("/auth_nonces", { method: "POST", body: JSON.stringify({ nonce, address, expires_at: expira }) });
      return responder({ nonce, expires_at: expira });
    }

    /* ── verify ── */
    const { message, signature } = cuerpo;
    if (!message || !signature) return responder({ error: "faltan message o signature" }, 400);

    const partes = leerMensaje(message);

    /* El dominio va dentro de lo firmado: sin esto, una firma obtenida en otra
       web valdría aquí. */
    if (!DOMINIOS_OK.includes(partes.dominio)) {
      return responder({ error: "dominio no autorizado: " + partes.dominio }, 401);
    }
    if (partes.direccion !== address) {
      return responder({ error: "la dirección del mensaje no coincide" }, 401);
    }
    const edad = Date.now() - Date.parse(partes.fecha || "");
    if (!(edad >= -60e3 && edad < VIDA_NONCE_MIN * 60e3)) {
      return responder({ error: "mensaje caducado o con fecha rara" }, 401);
    }

    const filas = await db("/auth_nonces?nonce=eq." + encodeURIComponent(partes.nonce) + "&select=*");
    const guardado = filas && filas[0];
    if (!guardado)                     return responder({ error: "nonce desconocido" }, 401);
    if (guardado.used)                 return responder({ error: "nonce ya usado" }, 401);
    if (guardado.address !== address)  return responder({ error: "nonce de otra dirección" }, 401);
    if (Date.parse(guardado.expires_at) < Date.now()) return responder({ error: "nonce caducado" }, 401);

    /* La comprobación que lo sostiene todo: ¿sale esta firma de la clave
       privada de esta dirección? La dirección ES la clave pública. */
    let valida = false;
    try {
      const clave = await crypto.subtle.importKey("raw", desdeBase58(address), { name: "Ed25519" }, false, ["verify"]);
      valida = await crypto.subtle.verify({ name: "Ed25519" }, clave, desdeBase58(signature), new TextEncoder().encode(message));
    } catch (e) {
      return responder({ error: "no pude verificar la firma: " + (e as Error).message }, 400);
    }
    if (!valida) return responder({ error: "firma no válida" }, 401);

    /* Tachar el nonce antes de emitir nada: si algo falla después, ese número
       ya no vale para nadie. */
    await db("/auth_nonces?nonce=eq." + encodeURIComponent(partes.nonce),
             { method: "PATCH", body: JSON.stringify({ used: true }) });

    await db("/sessions?expires_at=lt." + new Date().toISOString(), { method: "DELETE" }).catch(() => {});

    /* Alta del jugador. Ojo con el upsert: si mandara coins siempre, cada
       login te devolvería al saldo inicial. Solo se crean los que no existen. */
    const yaEsta = await db("/players?address=eq." + encodeURIComponent(address) + "&select=address");
    if (!yaEsta || !yaEsta.length) {
      await db("/players", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ address, coins: MONEDAS_INICIO, last_seen: new Date().toISOString() }),
      }).catch(() => {});
    } else {
      await db("/players?address=eq." + encodeURIComponent(address), {
        method: "PATCH", body: JSON.stringify({ last_seen: new Date().toISOString() }),
      }).catch(() => {});
    }

    const token = nuevoToken();
    const caduca = new Date(Date.now() + VIDA_SESION_H * 3600e3).toISOString();
    await db("/sessions", { method: "POST", body: JSON.stringify({ token, address, expires_at: caduca }) });

    return responder({ token, address, expires_in: VIDA_SESION_H * 3600 });
  }

  /* ══════════ rutas de escritura ══════════ */
  /* Todas empiezan igual: el token dice quién eres, y el resto del cuerpo NO
     puede cambiar esa respuesta. Da igual qué "owner" mande el navegador. */

  const dueno = await duenoDe(cuerpo.token);
  if (!dueno) return responder({ error: "sesión no válida o caducada" }, 401);

  /* ══════════ la tirada de atributos ══════════
     La hace el servidor y la guarda pegada a la sesión. Volver a tirar la
     sustituye; forjar usa ESTA y la borra. Si la eligiera el navegador,
     elegiría 10/10/10 — que es exactamente lo que se podía hacer antes. */
  if (accion === "tirar") {
    const roll = C.rollStats();
    await db("/sessions?token=eq." + encodeURIComponent(cuerpo.token), {
      method: "PATCH", body: JSON.stringify({ roll }),
    });
    return responder({ roll });
  }

  if (accion === "forjar") {
    const bruto = sanearBruto(cuerpo.bruto || {});
    if (bruto.name.length < 2) return responder({ error: "nombre demasiado corto" }, 400);

    /* Los atributos NO salen de lo que mandó el navegador: salen de la última
       tirada que hizo el servidor para esta sesión. */
    const ses = await db("/sessions?token=eq." + encodeURIComponent(cuerpo.token) + "&select=roll");
    const roll = ses && ses[0] && ses[0].roll;
    if (!roll) return responder({ error: "no hay tirada; abre la forja primero", clase: "sin_tirada" }, 409);
    bruto.str = roll.str; bruto.agi = roll.agi; bruto.spd = roll.spd; bruto.hp_max = roll.hpMax;
    /* Un bruto recién forjado es siempre de nivel 1 y sin historial, diga lo
       que diga el cliente. */
    bruto.level = 1; bruto.xp = 0; bruto.wins = 0; bruto.losses = 0;

    /* El tope de brutos se comprueba AQUÍ. Si solo lo mirara el navegador,
       bastaría con abrir la consola para tener veinte. */
    const mios = await db("/brutes?owner=eq." + encodeURIComponent(dueno) + "&select=id");
    const cuantos = (mios || []).length;
    if (cuantos >= MAX_BRUTOS) return responder({ error: "ya tienes el máximo de brutos" }, 403);

    /* El precio de la plaza también lo cobra el servidor. Si lo descontara el
       navegador, la plaza sería gratis para quien abriera la consola. */
    const precio = PRECIO_PLAZA[cuantos] || 0;
    const jugador = await db("/players?address=eq." + encodeURIComponent(dueno) + "&select=coins");
    const saldo = Number((jugador && jugador[0] && jugador[0].coins) || 0);
    if (saldo < precio) return responder({ error: "no te llegan las monedas", clase: "sin_saldo" }, 403);

    try {
      const fila = await db("/brutes", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ ...bruto, owner: dueno }),
      });
      /* Se cobra DESPUÉS de que el bruto exista: si el nombre estuviera pillado
         y se cobrara antes, pagarías por una plaza que no llegó a crearse. */
      /* Se gasta la tirada: sin esto, el mismo sorteo valdría para los tres
         brutos y bastaría con tirar hasta sacar uno bueno y forjar tres. */
      await db("/sessions?token=eq." + encodeURIComponent(cuerpo.token), {
        method: "PATCH", body: JSON.stringify({ roll: null }),
      }).catch(() => {});

      const restante = saldo - precio;
      if (precio > 0) {
        await db("/players?address=eq." + encodeURIComponent(dueno), {
          method: "PATCH", body: JSON.stringify({ coins: restante }),
        });
      }
      return responder({ id: fila[0].id, balance: restante, precio });
    } catch (e) {
      const texto = (e as Error).message;
      if (texto.includes("23505")) return responder({ error: "nombre ocupado", clase: "duplicado" }, 409);
      throw e;
    }
  }

  if (accion === "guardar") {
    /* El saldo YA NO se acepta del navegador. Las monedas solo cambian por dos
       vías, y las dos las decide el servidor: la recompensa de una pelea y el
       precio de una plaza. Antes se aceptaba recortado a mil millones, que es
       como decir "puedes robar, pero no demasiado". */
    await db("/players?address=eq." + encodeURIComponent(dueno), {
      method: "PATCH", body: JSON.stringify({ last_seen: new Date().toISOString() }),
    }).catch(() => {});

    for (const b of (cuerpo.brutos || [])) {
      if (!b || !b.rid) continue;

      /* El NOMBRE no se toca. Es "público y permanente" según el propio juego,
         y aceptarlo aquí dejaría renombrar el bruto a voluntad — incluso para
         hacerse pasar por otro. Además, si el nombre nuevo estuviera pillado,
         Postgres lanzaría y esta función respondería un 500 sin explicar nada.
         Se pone una vez al forjar y ahí se queda. */
      const campos = sanearBruto(b) as Record<string, unknown>;
      delete campos.name;

      /* El filtro lleva owner además de id: aunque el navegador mande el id de
         un bruto ajeno, la fila no casa y no se toca nada. */
      try {
        await db("/brutes?id=eq." + encodeURIComponent(String(b.rid)) + "&owner=eq." + encodeURIComponent(dueno), {
          method: "PATCH",
          body: JSON.stringify(campos),
        });
      } catch (e) {
        /* Un bruto que no se pueda guardar no debe tumbar el resto del guardado
           ni devolver un 500 mudo. */
        console.warn("guardar: bruto " + b.rid + " → " + (e as Error).message);
        return responder({ error: "no pude guardar un bruto", clase: "guardado" }, 409);
      }
    }
    return responder({ ok: true });
  }

  if (accion === "vaciar") {
    await db("/brutes?owner=eq." + encodeURIComponent(dueno), { method: "DELETE" });
    return responder({ ok: true });
  }

  /* ══════════ el combate ══════════
     Aquí es donde el servidor deja de creerse al navegador. Antes el cliente
     calculaba la pelea y luego decía "he ganado, dame 20 monedas"; ahora dice
     "quiero pelear contra el rival 3 de mi lista" y el resto lo decide esto.

     El navegador solo reproduce el registro que se le devuelve. */
  if (accion === "pelear") {
    if (cuerpo.version !== C.VERSION) {
      return responder({ error: "reglas desactualizadas", clase: "version",
                         servidor: C.VERSION, cliente: cuerpo.version }, 409);
    }

    /* El bruto se lee de la BASE DE DATOS, no de lo que mande el navegador.
       Si se usaran sus números, bastaría con decir que tienes fuerza 10. */
    const filas = await db("/brutes?id=eq." + encodeURIComponent(String(cuerpo.bruteId)) +
                           "&owner=eq." + encodeURIComponent(dueno) + "&select=*");
    const fila = filas && filas[0];
    if (!fila) return responder({ error: "ese bruto no es tuyo" }, 403);

    /* Recarga diaria: si es un día nuevo, se reponen peleas y cambio de lista
       y se tira la lista de ayer. Se comprueba aquí porque el navegador puede
       mentir sobre qué día es. */
    const hoy = new Date().toISOString().slice(0, 10);
    let pool = fila.pool;
    let peleas = fila.fights_left;
    if (fila.fights_day !== hoy) { peleas = 3; pool = null; }

    if (peleas <= 0) return responder({ error: "sin peleas hoy" }, 403);

    /* El rival tiene que salir de la lista que ofreció el servidor. Sin esto,
       el navegador podría pedir pelear contra un rival inventado de nivel 1
       con 1 de vida. Por eso se guarda `pool`. */
    if (!Array.isArray(pool) || !pool.length) {
      return responder({ error: "no tienes lista de rivales; entra a la arena primero" }, 409);
    }
    const idx = Number(cuerpo.opponentIdx);
    if (!Number.isInteger(idx) || idx < 0 || idx >= pool.length) {
      return responder({ error: "ese rival no está en tu lista" }, 403);
    }
    const foe = pool[idx];

    const mio = {
      name: fila.name, lv: fila.level, xp: fila.xp, hpMax: fila.hp_max,
      str: fila.str, agi: fila.agi, spd: fila.spd, w: fila.wins, l: fila.losses,
    };

    /* La semilla la genera el SERVIDOR. Si la eligiera el cliente, elegiría su
       victoria: probaría semillas hasta encontrar una que gane. */
    const seed = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000000;
    const fight = C.simulate(mio, foe, seed);
    const gano = fight.winner === "A";
    const premio = C.aplicar(mio, fight, gano);

    /* Monedas: se leen de la base y se suman aquí. El navegador no interviene. */
    const jug = await db("/players?address=eq." + encodeURIComponent(dueno) + "&select=coins");
    const monedas = Number((jug && jug[0] && jug[0].coins) || 0) + premio.coins;

    await db("/brutes?id=eq." + fila.id + "&owner=eq." + encodeURIComponent(dueno), {
      method: "PATCH",
      body: JSON.stringify({
        level: mio.lv, xp: mio.xp, hp_max: mio.hpMax,
        str: mio.str, agi: mio.agi, spd: mio.spd,
        wins: mio.w, losses: mio.l,
        fights_left: peleas - 1, fights_day: hoy, pool,
      }),
    });
    await db("/players?address=eq." + encodeURIComponent(dueno), {
      method: "PATCH", body: JSON.stringify({ coins: monedas, last_seen: new Date().toISOString() }),
    });

    /* Se guarda la pelea. Sale casi gratis —el resultado ya está calculado— y
       es lo que permite el historial, el panel, y sobre todo saber cuántas
       monedas se emiten al día.
       El snapshot del rival es imprescindible: sube de nivel después, y sin
       congelarlo la pelea dejaría de poder reproducirse. */
    await db("/fights", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        seed, a_brute: fila.id, a_owner: dueno,
        b_brute: foe.rid || null, b_name: String(foe.name || "?").slice(0, 32),
        b_bot: !!foe.bot, b_snapshot: foe,
        winner: fight.winner, turns: fight.turns, log: fight.log,
        coins: premio.coins, xp: premio.xp,
      }),
    }).catch((e) => console.warn("no pude guardar la pelea: " + e.message));

    /* Se devuelve semilla + registro: el navegador puede recalcular la pelea
       con las mismas reglas y comprobar que cuadra. Eso es la promesa de
       "combate verificable" de la landing, y el ensayo de lo que hará la
       cadena en la fase 2. */
    return responder({
      seed, log: fight.log, winner: fight.winner, timeout: fight.timeout, turns: fight.turns,
      coins: premio.coins, xp: premio.xp, subio: premio.subio,
      /* QUÉ tocó al subir: "str" | "agi" | "spd" | "hp". Sin esto el cartel
         del juego no puede decirlo y acaba enseñando siempre vida. */
      ganancia: premio.ganancia,
      bruto: mio, fights_left: peleas - 1, balance: monedas,
    });
  }

  /* ══════════ panel de administración ══════════
     El control va AQUÍ, no en la página. Un panel que solo esconde botones a
     quien no es admin no protege nada: cualquiera puede llamar a estas rutas
     directamente con curl, como se hizo durante todas las pruebas de hoy. */
  if (accion === "admin_resumen" || accion === "admin_jugadores") {
    if (!ADMINS.includes(dueno)) {
      /* Mismo mensaje que una sesión inválida, y sin decir que la ruta existe:
         a quien no es admin no hay por qué confirmarle que hay un panel. */
      return responder({ error: "sesión no válida o caducada" }, 401);
    }

    if (accion === "admin_resumen") {
      const r = await db("/rpc/admin_resumen", { method: "POST", body: "{}" });
      return responder({ resumen: r });
    }

    /* Jugadores con sus brutos, para la pestaña de gestión. */
    const jugadores = await db("/players?select=address,coins,slots,created_at,last_seen&order=last_seen.desc&limit=200");
    const brutos = await db("/brutes?select=id,owner,name,level,xp,wins,losses,fights_left,created_at&order=level.desc&limit=500");
    return responder({ jugadores, brutos });
  }

  return responder({ error: "acción desconocida" }, 400);
});
