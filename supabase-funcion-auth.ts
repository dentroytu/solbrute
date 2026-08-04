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

   ── AL CAMBIAR DE DOMINIO, ESTO VA PRIMERO ────────────────────────────────
   El navegador manda `location.host`, así que en cuanto el DNS apunte al
   dominio nuevo la firma llegará con `solbrute.io` dentro. Si no está en esta
   lista, la respuesta es "dominio no autorizado" y NADIE puede entrar — ni
   siquiera quien ya tenía cuenta.

   Por eso el orden correcto es: añadir el dominio aquí, desplegar, y DESPUÉS
   tocar el DNS. Al revés son horas de web caída con un error que habla de
   dominios y parece un problema de red.

   Se deja `dentroytu.github.io` puesto: mientras el DNS propaga conviven las
   dos direcciones, y quitarlo ahora rompería a quien llegue por la vieja. */
const DOMINIOS_OK = [
  "solbrute.io",
  "www.solbrute.io",
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

/* ══════════════════════════════════════════════════════════════════════════
   Economía: emitir y reciclar
   ══════════════════════════════════════════════════════════════════════════
   Lo que gana una pelea ya no son monedas, son PUNTOS. Las monedas las decide
   la base de datos con la tasa del día (ver supabase-12-emision.sql), porque
   la reserva es finita y sin esto el juego imprimía sin techo: a 10.000
   jugadores, los 40 millones se evaporaban en 33 días.

   El equilibrio no cambia — los puntos siguen siendo `12 + turnos` y la tasa
   arranca en 1,0. Con pocos jugadores nadie nota nada; el tope solo aprieta
   cuando empieza a hacer falta. */
async function emitir(puntos: number): Promise<{ monedas: number; tasa: number }> {
  const r = await db("/rpc/emision_cobrar", {
    method: "POST",
    body: JSON.stringify({ p_puntos: Math.max(0, Math.round(puntos)) }),
  });
  return { monedas: Number(r?.monedas || 0), tasa: Number(r?.tasa || 0) };
}

/* Lo que se gasta dentro VUELVE a la reserva (90%) y al fondo de garantía
   (10%). Es la mitad del modelo del TOKEN.md y hasta ahora no existía: las
   monedas de un arma comprada simplemente desaparecían.

   Va con `catch` a propósito: el jugador YA ha pagado y ya tiene su arma. Si
   el reciclaje falla, lo que pasa es que la reserva no se rellena — un error
   conservador. Tumbar la compra por esto sería cobrarle y no darle nada. */
function reciclar(monedas: number): void {
  if (!(monedas > 0)) return;
  db("/rpc/emision_reciclar", {
    method: "POST",
    body: JSON.stringify({ p_monedas: Math.round(monedas) }),
  }).catch((e) => console.warn("no pude reciclar " + monedas + ": " + e.message));
}

/* ══════════════════════════════════════════════════════════════════════════
   Resolver el cuadro de un torneo
   ══════════════════════════════════════════════════════════════════════════
   Vive aquí y no en SQL porque hace falta `simulate()`. Postgres se queda con
   lo que tiene que ser atómico —cobrar la entrada, tomar el torneo, pagar los
   premios— y esto pone los combates.

   `torneo_tomar` es la llave: pasa el torneo a `en_curso` dentro de una
   transacción con `for update`. Si dos personas abren el torneo a la vez, la
   segunda se lo encuentra ya tomado y esta función no hace nada. Sin eso, el
   premio se repartiría dos veces.

   ── El cuadro ──
   Se baraja con una semilla del SERVIDOR y se rellena hasta la siguiente
   potencia de dos con descansos. Un descanso no es un combate: se guarda la
   fila para que el cuadro se vea completo, pero sin semilla ni registro.

   ── Los puestos ──
   Quien cae en la ronda `r` de `R` totales queda en el puesto `2^(R-r) + 1`:
   el que pierde la final es 2º, los dos que pierden las semifinales son 3º,
   los cuatro de cuartos son 5º. Eso hace que `torneo_cerrar` pueda pagar por
   puesto sin saber nada del cuadro. */
async function resolverTorneo(tid: number): Promise<unknown> {
  let tomado;
  try {
    tomado = await db("/rpc/torneo_tomar", {
      method: "POST", body: JSON.stringify({ p_torneo: tid }),
    });
  } catch (e) {
    /* `todavia_no` y `no_resoluble` son lo normal: se abre un torneo que aún
       no toca, o que ya está resuelto. No es un error. */
    const m = (e as Error).message;
    if (m.includes("todavia_no") || m.includes("no_resoluble")) return null;
    throw e;
  }
  if (tomado?.cancelado) return tomado;

  const entradas = tomado.entradas as Array<{ id: number; snapshot: Record<string, unknown> }>;
  const semilla = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000000;

  /* Fisher-Yates con el PRNG del juego. El `sort(() => Math.random()-.5)` está
     sesgado y su comparador es inconsistente; en un cuadro de ocho eso se nota
     y aquí hay dinero de por medio. */
  const rnd = C.mulberry32(semilla);
  const orden: (typeof entradas[0] | null)[] = entradas.slice();
  for (let i = orden.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [orden[i], orden[j]] = [orden[j], orden[i]];
  }
  let tam = 1;
  while (tam < orden.length) tam *= 2;
  while (orden.length < tam) orden.push(null);          // descansos

  const rondas = Math.log2(tam);
  const cuadro: unknown[] = [];
  const puestos: { entrada_id: number; posicion: number }[] = [];

  let vivos = orden;
  for (let ronda = 1; ronda <= rondas; ronda++) {
    const siguiente: (typeof entradas[0] | null)[] = [];
    for (let i = 0; i < vivos.length; i += 2) {
      const a = vivos[i], b = vivos[i + 1], puesto = i / 2;

      if (!a && !b) { siguiente.push(null); continue; }
      if (!a || !b) {
        /* Descanso: pasa sin pelear. Se guarda la fila igualmente para que el
           cuadro se pueda dibujar entero. */
        cuadro.push({ ronda, puesto, a_entry: a?.id ?? null, b_entry: b?.id ?? null,
                      seed: 0, winner: null, turns: null, log: null });
        siguiente.push(a || b);
        continue;
      }

      /* Semilla derivada de la del torneo: distinta por combate y reproducible.
         Con semilla y registro guardados, cualquiera puede recalcular cada
         pelea del cuadro — un torneo cuyo resultado hay que creerse no vale
         nada. */
      const seed = (semilla + ronda * 7919 + puesto * 31) % 1000000000;
      const fight = C.simulate(a.snapshot, b.snapshot, seed);
      const gana = fight.winner === "A" ? a : b;
      const cae  = fight.winner === "A" ? b : a;

      cuadro.push({ ronda, puesto, a_entry: a.id, b_entry: b.id, seed,
                    winner: fight.winner, turns: fight.turns, log: fight.log });
      puestos.push({ entrada_id: cae.id, posicion: Math.pow(2, rondas - ronda) + 1 });
      siguiente.push(gana);
    }
    vivos = siguiente;
  }

  const campeon = vivos.find(Boolean);
  if (campeon) puestos.push({ entrada_id: campeon.id, posicion: 1 });

  return await db("/rpc/torneo_cerrar", {
    method: "POST",
    body: JSON.stringify({ p_torneo: tid, p_cuadro: cuadro, p_puestos: puestos }),
  });
}

/* El libro de cuentas del jugador (supabase-13-movimientos.sql). `monedas` va
   CON SIGNO: negativo lo que sale del saldo, positivo lo que entra.

   Como `reciclar`, no tumba la operación si falla: el jugador ya ha pagado y
   ya tiene su arma. Quedarse sin apunte es molesto; perder la compra por no
   poder escribir el apunte sería peor. */
function apuntar(
  address: string, tipo: string, concepto: string,
  monedas: number, meta?: unknown, ref?: number,
): void {
  db("/rpc/movimiento_apuntar", {
    method: "POST",
    body: JSON.stringify({
      p_address: address, p_tipo: tipo, p_concepto: concepto,
      p_monedas: Math.round(monedas),
      p_meta: meta ?? null, p_ref: ref ?? null,
    }),
  }).catch((e) => console.warn("no pude apuntar " + tipo + ": " + e.message));
}

/* Abre la ventana para recuperar algo que se acaba de perder. Como `apuntar`,
   se traga los errores: el jugador ya ha perdido el arma, y quedarse ademas sin
   la opcion de rescatarla por un fallo de escritura seria castigarle dos veces
   por lo mismo. */
function perdida(address: string, bruto: number, tipo: string,
                 objeto: string, precio: number, fight?: number): void {
  if (!objeto || objeto === "ninguna" || !(precio > 0)) return;
  db("/rpc/perdida_apuntar", {
    method: "POST",
    body: JSON.stringify({
      p_owner: address, p_bruto: bruto, p_tipo: tipo, p_objeto: objeto,
      p_precio: Math.round(precio), p_fight: fight ?? null, p_horas: 24,
    }),
  }).catch((e) => console.warn("no pude apuntar la perdida: " + e.message));
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
/* ── Nombres ──
   Se filtran con lista blanca: letras, números, espacio y cuatro signos. Todo
   lo demás fuera.

   Motivo: el nombre lo escribe el jugador y se pinta en la lista de rivales y
   en la clasificación de TODOS los demás. Un "<img src=x onerror=…>" ahí es
   XSS almacenado, y con el token de sesión en localStorage eso es robar
   cuentas. El navegador también escapa, pero una sola capa no basta cuando el
   dato viaja a pantallas ajenas. */
function sanearNombre(v: unknown): string {
  /* Solo texto. Sin esto, un objeto mandado como nombre acababa llamándose
     "object Object" y colándose por el mínimo de 2 caracteres. */
  if (typeof v !== "string") return "";
  return v
    .replace(/[^\p{L}\p{N} .'\-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 16);
}

/* ── Aspecto ──
   Los diez enteros del creador, cada uno dentro de su rango. Se comprobó que
   guardando {skin:"<script>", hair:999} el renderizador LANZA, y como el
   aspecto se dibuja en la lista de rivales de otros, un solo bruto envenenado
   dejaba la pantalla en blanco a todos los de su nivel. Griefing barato. */
function sanearLook(v: unknown): Record<string, number> {
  const l = (v && typeof v === "object") ? v as Record<string, unknown> : {};
  const N = C.LOOK_N;
  const limpio: Record<string, number> = {};
  for (const k of Object.keys(N)) {
    const n = Math.floor(Number(l[k]));
    limpio[k] = (Number.isFinite(n) && n >= 0 && n < N[k]) ? n : 0;
  }
  return limpio;
}

const entre = (v: unknown, min: number, max: number, pordefecto: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : pordefecto;
};

function sanearBruto(b: Record<string, unknown>) {
  return {
    name: sanearNombre(b.name),
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
    look: sanearLook(b.look),
    pool: b.pool ?? null,
  };
}

/* ═══════════ servidor ═══════════ */
Deno.serve(async (req) => {
  try { return await manejar(req); }
  catch (e) {
    /* Cualquier fallo no previsto sale como un error limpio y con el motivo en
       los logs, no como un 500 con el cuerpo vacío. Un 500 mudo no le dice
       nada al jugador y tampoco a quien tenga que arreglarlo. */
    console.error("fallo no previsto: " + ((e as Error)?.stack || e));
    return responder({ error: "algo ha fallado en el servidor" }, 500);
  }
});

async function manejar(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return responder({ error: "solo POST" }, 405);

  let cuerpo: Record<string, any>;
  try { cuerpo = await req.json(); }
  catch { return responder({ error: "cuerpo no es JSON" }, 400); }

  /* accion tiene que ser texto: con un número o un objeto, el .startsWith de
     más abajo lanzaba y la función respondía un 500 mudo. */
  const accion = typeof cuerpo.accion === "string" ? cuerpo.accion : "";
  if (!accion) return responder({ error: "falta la accion" }, 400);

  /* Los identificadores son enteros. No hay inyección posible —PostgREST
     parametriza— pero "1 or 1=1" hacía fallar el cast en Postgres y salía otro
     500 sin explicación. Mejor rechazarlo aquí y decir qué pasa. */
  const idEntero = (v: unknown) => {
    const n = Math.floor(Number(v));
    return (Number.isFinite(n) && n > 0 && n < 1e15) ? String(n) : null;
  };

  /* ══════════ rutas de login ══════════ */

  if (accion === "nonce" || accion === "verify") {
    const address = cuerpo.address;
    /* Una dirección de Solana son 32 bytes: 43-44 caracteres en base58. */
    if (!address || address.length < 32 || address.length > 44) {
      return responder({ error: "direccion no valida" }, 400);
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
      return responder({ error: "la direccion del mensaje no coincide" }, 401);
    }
    const edad = Date.now() - Date.parse(partes.fecha || "");
    if (!(edad >= -60e3 && edad < VIDA_NONCE_MIN * 60e3)) {
      return responder({ error: "mensaje caducado o con fecha rara" }, 401);
    }

    const filas = await db("/auth_nonces?nonce=eq." + encodeURIComponent(partes.nonce) + "&select=*");
    const guardado = filas && filas[0];
    if (!guardado)                     return responder({ error: "nonce desconocido" }, 401);
    if (guardado.used)                 return responder({ error: "nonce ya usado" }, 401);
    if (guardado.address !== address)  return responder({ error: "nonce de otra direccion" }, 401);
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
    if (!valida) return responder({ error: "firma no valida" }, 401);

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

    /* El juego usa esto para enseñar la barra de maqueta solo a un admin. Es
       un adorno: las rutas de administración comprueban la lista otra vez, y
       ninguna acción con valor depende de este campo. */
    return responder({ token, address, expires_in: VIDA_SESION_H * 3600,
                       admin: ADMINS.includes(address) });
  }

  /* ══════════ rutas de escritura ══════════ */
  /* Todas empiezan igual: el token dice quién eres, y el resto del cuerpo NO
     puede cambiar esa respuesta. Da igual qué "owner" mande el navegador. */

  const dueno = await duenoDe(cuerpo.token);
  if (!dueno) return responder({ error: "sesion no valida o caducada" }, 401);

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
    if (cuantos >= MAX_BRUTOS) return responder({ error: "ya tienes el maximo de brutos" }, 403);

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
        reciclar(precio);   // la plaza pagada vuelve a la reserva
        apuntar(dueno, "compra_plaza", String(cuantos + 1), -precio,
                { bruto: fila[0].id, nombre: bruto.name });
      }
      return responder({ id: fila[0].id, balance: restante, precio });
    } catch (e) {
      const texto = (e as Error).message;
      if (texto.includes("23505")) return responder({ error: "nombre ocupado", clase: "duplicado" }, 409);
      throw e;
    }
  }

  if (accion === "guardar") {
    /* ── Esta ruta ya no toca los brutos. ──
       Se comprobó contra el servidor desplegado: aceptaba nivel, XP,
       atributos, vida y victorias, así que un jugador se ponía nivel 100 con
       10/10/10, 300 de vida y 99.999 victorias sin pelear una sola vez. Eso
       anulaba de un plumazo todo el arbitraje del combate.

       Desde que el servidor arbitra, NADA del bruto viene del navegador: el
       combate lo escribe "pelear", el arma "comprar" y "equipar", la lista de
       rivales "arena", y el aspecto y el nombre se fijan al forjar y no
       cambian. Aquí no queda nada legítimo que guardar.

       Se conserva la ruta —el cliente la llama— pero solo marca la visita. */
    await db("/players?address=eq." + encodeURIComponent(dueno), {
      method: "PATCH", body: JSON.stringify({ last_seen: new Date().toISOString() }),
    }).catch(() => {});
    return responder({ ok: true });
  }

  if (accion === "vaciar") {
    await db("/brutes?owner=eq." + encodeURIComponent(dueno), { method: "DELETE" });
    return responder({ ok: true });
  }

  /* ══════════ comprar en la armería ══════════
     El precio lo pone el servidor desde brute-combate.js, y el cobro va
     después de añadir el arma: si algo falla en medio, no se paga por nada. */
  /* ══════════ comprar un arma ══════════
     Ya NO se compra "para un bruto": se compra a tu BOLSA, y desde ahí la
     equipas en el que quieras (ver supabase-14-inventario.sql). Por eso esta
     ruta no pide `bruteId` — y por eso desapareció el "ya la tienes": si
     quieres tres dagas para tres brutos, compras tres.

     El precio sale de `brute-combate.js`, aquí en el servidor. Nunca del
     navegador: mandarlo sería dejar que el cliente ponga el suyo. */
  /* ── El candado de nivel ──
     La funcion de Postgres lanza `nivel_insuficiente:N`. Se traduce aqui a un
     403 con el numero, para que la pantalla pueda decir "te falta el nivel 7"
     y no un "no puedes" mudo.

     El nivel minimo lo pone el SERVIDOR desde su copia de `brute-combate.js`,
     igual que el precio. Si viniera del navegador, mandar `p_nivel_min: 1`
     abriria el mandoble a un bruto de nivel 1 — que es exactamente el ataque
     que esto tiene que parar. */
  const faltaNivel = (m: string) => {
    const g = /nivel_insuficiente:(\d+)/.exec(m);
    return g ? Number(g[1]) : 0;
  };

  /* ── Los errores de Postgres se reconocen por MARCA, no por frase ──
     Las cuatro funciones del paso 25 lanzan `sin_copias:daga`, `no_es_tuyo`,
     `sin_jugador`, `desconocido:x`… en vez de espanol corriente.

     Costo un 500 aprenderlo. El paso 14 lanzaba «no tienes NINGUNA % libre»
     —arma es femenino— y al reescribir la funcion en el paso 25 se copio la
     redaccion de las mascotas, «no tienes NINGUN %». Aqui se seguia buscando
     «ninguna», no encajaba, y equipar algo que no tienes devolvia «algo ha
     fallado en el servidor» en vez de «no tienes esa arma».

     Una letra, y ninguna de las dos partes estaba mal por si sola. Dos
     programas no pueden entenderse en un idioma con generos y sinonimos. */
  const marca = (m: string, id: string) => m.includes(id);

  if (accion === "comprar") {
    const id = String(cuerpo.arma || "");
    const w = C.ARMAS[id];
    if (!w || id === "ninguna") return responder({ error: "esa arma no existe" }, 400);

    /* Cobrar y dar el arma es UNA operación de base de datos, no dos escrituras
       desde aquí. Si se hicieran sueltas, un fallo entre medias te cobraría sin
       darte nada — o peor, al revés. */
    let r;
    try {
      r = await db("/rpc/arma_comprar", {
        method: "POST",
        body: JSON.stringify({ p_owner: dueno, p_arma: id, p_precio: w.precio,
                               p_nivel_min: w.nivel || 1 }),
      });
    } catch (e) {
      const m = (e as Error).message;
      const nv = faltaNivel(m);
      if (nv) return responder({ error: "te falta nivel", clase: "nivel", nivel: nv }, 403);
      if (marca(m, "sin_saldo")) {
        return responder({ error: "no te llegan las monedas", clase: "sin_saldo" }, 403);
      }
      /* Los dos de abajo no deberian poder pasar —la ruta ya filtra el arma y
         el precio lo pone el servidor— pero "no se puede alcanzar" es una
         suposicion que caduca, y un 500 no le dice nada a nadie. */
      if (marca(m, "desconocido"))     return responder({ error: "esa arma no existe" }, 400);
      if (marca(m, "precio_invalido")) return responder({ error: "precio no valido" }, 400);
      if (marca(m, "sin_jugador")) return responder({ error: "sesion no valida" }, 401);
      throw e;
    }

    /* Lo gastado vuelve a la reserva (90%) y al fondo (10%). Es el único
       sumidero que existe hoy, así que es todo el reciclaje del juego. */
    reciclar(w.precio);
    apuntar(dueno, "compra_arma", id, -w.precio, { precio: w.precio });
    return responder({ arma: id, bolsa: r.bolsa, balance: r.balance });
  }

  /* ══════════ equipar un arma ══════════
     Solo se puede llevar lo que se tiene, y eso lo comprueba el servidor
     contra su propia lista: mandar "mandoble" sin tenerlo no hace nada. */
  /* ══════════ equipar ══════════
     Mueve una copia de tu bolsa a un bruto, y devuelve a la bolsa lo que ese
     bruto llevaba. Es lo que permite pasarse las armas entre brutos.

     "ninguna" desarma: devuelve lo puesto a la bolsa y lo deja a puño limpio.

     Las dos escrituras —quitar de la bolsa, poner en el bruto— van dentro de
     una sola función con `for update`. Hechas por separado, un fallo entre
     ellas dejaría el arma en los dos sitios a la vez. Sobre un token con valor
     real, eso es duplicar dinero. */
  if (accion === "equipar") {
    const bid = idEntero(cuerpo.bruteId);
    if (!bid) return responder({ error: "identificador no valido" }, 400);
    const quiere = String(cuerpo.arma || "ninguna");

    let r;
    try {
      r = await db("/rpc/arma_equipar", {
        method: "POST",
        body: JSON.stringify({ p_owner: dueno, p_bruto: Number(bid), p_arma: quiere,
                               p_nivel_min: (C.ARMAS[quiere] || {}).nivel || 1 }),
      });
    } catch (e) {
      const m = (e as Error).message;
      /* La comprobación de propiedad vive DENTRO de la función (busca por id y
         por dueño a la vez), así que aquí solo se traduce el error. Mandar el
         id de un bruto ajeno no lo toca. */
      const nv = faltaNivel(m);
      if (nv) return responder({ error: "te falta nivel", clase: "nivel", nivel: nv }, 403);
      if (marca(m, "no_es_tuyo")) return responder({ error: "ese bruto no es tuyo" }, 403);
      if (marca(m, "sin_copias")) {
        return responder({ error: "no tienes esa arma", clase: "sin_arma" }, 403);
      }
      if (marca(m, "desconocido")) return responder({ error: "esa arma no existe" }, 400);
      if (marca(m, "sin_jugador")) return responder({ error: "sesion no valida" }, 401);
      throw e;
    }
    return responder({ arma: r.arma, bolsa: r.bolsa });
  }

  /* ══════════ la lista de rivales ══════════
     La arma el SERVIDOR. Antes la construía el navegador y la mandaba en
     "guardar", así que bastaba con enviar un rival de 1 punto de vida para
     ganar siempre — probado, funcionaba.

     Con `reroll` se gasta el cambio del día. Sin él, si ya hay lista guardada
     se devuelve la misma: entrar y salir de la arena no puede regalar rivales
     nuevos, que es lo que haría del límite una decoración. */
  if (accion === "arena") {
    if (cuerpo.version !== C.VERSION) {
      return responder({ error: "reglas desactualizadas", clase: "version" }, 409);
    }
    const bid = idEntero(cuerpo.bruteId);
    if (!bid) return responder({ error: "identificador no valido" }, 400);
    const filas = await db("/brutes?id=eq." + bid +
                           "&owner=eq." + encodeURIComponent(dueno) + "&select=*");
    const fila = filas && filas[0];
    if (!fila) return responder({ error: "ese bruto no es tuyo" }, 403);

    /* Recarga diaria, aquí y no en el navegador: puede mentir sobre qué día es. */
    const hoy = new Date().toISOString().slice(0, 10);
    let peleas = fila.fights_left, cambios = fila.rerolls_left, pool = fila.pool;
    if (fila.fights_day !== hoy) { peleas = C.FIGHTS_DAY; cambios = C.REROLLS_DAY; pool = null; }

    const quiereOtra = !!cuerpo.reroll;
    if (quiereOtra && cambios <= 0) {
      return responder({ error: "ya has cambiado la lista hoy", clase: "sin_cambios" }, 403);
    }

    if (!Array.isArray(pool) || !pool.length || quiereOtra) {
      /* 1 · jugadores reales de nivel parecido. Se piden 60 y se barajan: sin
         traer material de sobra, Postgres devolvería siempre los mismos. */
      const reales = await db("/brutes?owner=neq." + encodeURIComponent(dueno) +
        "&level=gte." + Math.max(1, fila.level - C.LEVEL_SPREAD) +
        "&level=lte." + (fila.level + C.LEVEL_SPREAD) +
        "&select=id,owner,name,level,hp_max,str,agi,spd,wins,losses,look,arma&limit=60");

      const lista = C.barajar((reales || []).map((f: Record<string, unknown>) => ({
        rid: f.id, name: f.name, lv: f.level, hpMax: f.hp_max,
        str: f.str, agi: f.agi, spd: f.spd, w: f.wins, l: f.losses,
        look: f.look, arma: f.arma || "ninguna", bot: false,
      }))).slice(0, C.OPP_COUNT);

      /* 2 · relleno de la casa, con la misma curva que un jugador. */
      const usados = new Set(lista.map((x: Record<string, unknown>) => x.name));
      while (lista.length < C.OPP_COUNT) {
        const lv = Math.max(1, fila.level + (Math.floor(Math.random() * (C.LEVEL_SPREAD * 2 + 1)) - C.LEVEL_SPREAD));
        lista.push(C.nuevoBot(lv, usados));
      }
      pool = C.barajar(lista);
      if (quiereOtra) cambios--;
    }

    await db("/brutes?id=eq." + fila.id + "&owner=eq." + encodeURIComponent(dueno), {
      method: "PATCH",
      body: JSON.stringify({ pool, fights_left: peleas, rerolls_left: cambios, fights_day: hoy }),
    });

    return responder({ pool, fights_left: peleas, rerolls_left: cambios });
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

    const bid = idEntero(cuerpo.bruteId);
    if (!bid) return responder({ error: "identificador no valido" }, 400);
    /* El bruto se lee de la BASE DE DATOS, no de lo que mande el navegador.
       Si se usaran sus números, bastaría con decir que tienes fuerza 10. */
    const filas = await db("/brutes?id=eq." + bid +
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
      return responder({ error: "ese rival no esta en tu lista" }, 403);
    }
    const foe = pool[idx];

    /* El jugador se lee AQUÍ, antes de simular, porque `aplicar()` lo necesita:
       cuando el nivel toca arma, elige una que no tengas ya, y ese "tengas" es
       ahora lo del JUGADOR —la bolsa más lo que lleva puesto este bruto— y no
       lo del bruto, que desde el paso 14 no guarda inventario.

       Si se le pasara una lista vacía, el sorteo podría darte una quinta daga
       teniendo ya cuatro, que es un premio que no se siente como premio. */
    const jug = await db("/players?address=eq." + encodeURIComponent(dueno) +
                         "&select=coins,armas");
    const yo = (jug && jug[0]) || { coins: 0, armas: {} };
    const bolsaMia = (yo.armas && typeof yo.armas === "object") ? yo.armas : {};
    const poseidas = Object.keys(bolsaMia).filter((k) => Number(bolsaMia[k]) > 0);
    if (fila.arma && fila.arma !== "ninguna" && !poseidas.includes(fila.arma)) {
      poseidas.push(fila.arma);
    }

    const mio = {
      name: fila.name, lv: fila.level, xp: fila.xp, hpMax: fila.hp_max,
      str: fila.str, agi: fila.agi, spd: fila.spd, w: fila.wins, l: fila.losses,
      arma: fila.arma || "ninguna", armas: poseidas,
      mascota: fila.mascota || "ninguna",
    };

    /* La semilla la genera el SERVIDOR. Si la eligiera el cliente, elegiría su
       victoria: probaría semillas hasta encontrar una que gane. */
    const seed = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000000;
    const fight = C.simulate(mio, foe, seed);
    const gano = fight.winner === "A";
    const premio = C.aplicar(mio, fight, gano);

    /* ── el arma ──
       Romperla lo decide el SERVIDOR. Si lo decidiera el navegador, nadie
       rompería nunca nada. Se comprueba después del combate: la que se te cayó
       a media pelea la recuperas, la que se rompe no vuelve. */
    let armaAhora = mio.arma;
    let rota = "";
    if (armaAhora !== "ninguna" && C.seRompe(armaAhora)) {
      rota = armaAhora;
      /* Se destruye: NO vuelve a la bolsa. Es lo que hace que el mandoble
         cueste mantenerlo (~11 combates) y que las armas sigan siendo un
         sumidero en vez de una compra única. */
      armaAhora = "ninguna";
      /* Y queda en el historial. Con 0 monedas: no te cobran al romperse, se
         apunta para que exista el rastro. Sumarlo contaria la compra dos veces
         — una al pagarla y otra al perderla. */
      apuntar(dueno, "arma_rota", rota, 0, { bruto: Number(fila.id), nombre: fila.name });
      /* Y se abre la ventana para recuperarla. Se apunta AQUI, en el momento
         exacto de perderla, porque el precio sale de la tabla de armas que
         solo vive en `brute-combate.js`. */
      perdida(dueno, Number(fila.id), "arma", rota,
              C.precioRescate(C.ARMAS[rota]?.precio || 0), Number(fight.id) || undefined);
    }

    /* ── la mascota ──
       CAER y MORIR son dos cosas distintas, y aqui solo importa la segunda.

         · cayoA  se quedo sin vida en ESTE combate y dejo de ayudar. Pasa cada
                  ~6 peleas, se ve en el registro y no cuesta nada. No se toca
                  la base de datos: la mascota vuelve entera a la siguiente.
         · murioA de esa caida no se levanto. Pasa cada ~19-32 peleas y se va
                  PARA SIEMPRE: no vuelve a la bolsa ni se cura.

       Las dos las decide `simulate()` con la semilla, por lo mismo que romper
       un arma — si lo decidiera el navegador, no se moriria ninguna. */
    let mascotaMuerta = "";
    if (fight.murioA) {
      mascotaMuerta = mio.mascota;
      await db("/rpc/mascota_morir", {
        method: "POST",
        body: JSON.stringify({ p_owner: dueno, p_bruto: Number(fila.id) }),
      }).catch((e) => console.warn("no pude matar la mascota: " + e.message));
      /* Igual que el arma rota: 0 monedas, solo el rastro. Es la linea que el
         jugador va a buscar cuando se pregunte donde esta su oso. */
      apuntar(dueno, "mascota_muerta", mascotaMuerta, 0,
              { bruto: Number(fila.id), nombre: fila.name });
      perdida(dueno, Number(fila.id), "mascota", mascotaMuerta,
              C.precioRescate(C.MASCOTAS[mascotaMuerta]?.precio || 0), Number(fight.id) || undefined);
    }

    /* Un arma nueva puede ser lo que toque al subir de nivel. */
    let armaNueva = "";
    let bolsa: unknown = undefined;
    if (typeof premio.ganancia === "string" && premio.ganancia.startsWith("arma:")) {
      armaNueva = premio.ganancia.slice(5);
      if (armaAhora === "ninguna") {
        /* Si peleabas a puño limpio se equipa sola, sin pasar por la bolsa: si
           no, el jugador gana algo que no ve por ningún lado. */
        armaAhora = armaNueva;
      } else {
        /* Ya llevas algo, así que la nueva va a la bolsa del JUGADOR — desde
           ahí se la puedes poner a cualquiera de tus brutos. */
        bolsa = await db("/rpc/arma_dar", {
          method: "POST",
          body: JSON.stringify({ p_owner: dueno, p_arma: armaNueva }),
        }).catch((e) => { console.warn("no pude dar el arma: " + e.message); return undefined; });
      }
    }

    /* ── de puntos a monedas ──
       `premio.coins` ya no son monedas: son PUNTOS. Lo que se cobra sale de la
       reserva a la tasa del día, y lo decide la base de datos.

       Se hace AQUÍ, antes de escribir nada. Si la emisión fallara después de
       guardar el bruto, la pelea habría gastado el intento y no habría pagado;
       fallando antes no se ha tocado nada y el jugador reintenta sin perder
       nada. La semilla se sortea otra vez, que no le debe nada a nadie. */
    let ganadas: number, tasaHoy: number;
    try {
      const em = await emitir(premio.coins);
      ganadas = em.monedas;
      tasaHoy = em.tasa;
    } catch (e) {
      console.error("emisión caída: " + (e as Error).message);
      return responder({ error: "la economia no responde, intentalo otra vez",
                         clase: "emision" }, 503);
    }

    /* Monedas: el saldo se leyó arriba junto con la bolsa. El navegador no
       interviene en ninguna de las dos cosas. */
    const monedas = Number(yo.coins || 0) + ganadas;

    await db("/brutes?id=eq." + fila.id + "&owner=eq." + encodeURIComponent(dueno), {
      method: "PATCH",
      body: JSON.stringify({
        level: mio.lv, xp: mio.xp, hp_max: mio.hpMax,
        str: mio.str, agi: mio.agi, spd: mio.spd,
        wins: mio.w, losses: mio.l,
        fights_left: peleas - 1, fights_day: hoy, pool,
        /* Solo la equipada. El inventario ya no vive en el bruto: es del
           jugador (supabase-14-inventario.sql). */
        arma: armaAhora,
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
        /* Las monedas REALMENTE emitidas, no los puntos. Es el número que
           avisa de que la economía se ha roto antes de que se note en el
           precio, y con la tasa de por medio los puntos ya no lo dicen. */
        coins: ganadas, xp: premio.xp,
        /* Lo que hace posible el tablón del ludus (supabase-17-eventos.sql).
           Ya estaba todo calculado; antes se tiraba al acabar la petición, así
           que el tablón solo habría podido decir "ganaste" y "perdiste". */
        subio: !!premio.subio, nivel: mio.lv, ganancia: premio.ganancia || null,
        arma_rota: rota || null, arma: mio.arma,
        mascota_muerta: mascotaMuerta || null, mascota: mio.mascota,
      }),
    }).catch((e) => console.warn("no pude guardar la pelea: " + e.message));

    /* Se devuelve semilla + registro: el navegador puede recalcular la pelea
       con las mismas reglas y comprobar que cuadra. Eso es la promesa de
       "combate verificable" de la landing, y el ensayo de lo que hará la
       cadena en la fase 2. */
    return responder({
      seed, log: fight.log, winner: fight.winner, timeout: fight.timeout, turns: fight.turns,
      coins: ganadas, xp: premio.xp, subio: premio.subio,
      /* Los puntos y la tasa van al navegador para poder enseñar el cambio del
         día ("1 punto = 0,94 monedas"). Sin eso, el jugador ve que un día cobra
         menos que otro por la misma pelea y parece que se le está robando. */
      puntos: premio.coins, tasa: tasaHoy,
      arma: armaAhora, bolsa, arma_rota: rota, arma_nueva: armaNueva,
      mascota: mascotaMuerta ? "ninguna" : mio.mascota, mascota_muerta: mascotaMuerta,
      /* QUÉ tocó al subir: "str" | "agi" | "spd" | "hp". Sin esto el cartel
         del juego no puede decirlo y acaba enseñando siempre vida. */
      ganancia: premio.ganancia,
      bruto: mio, fights_left: peleas - 1, balance: monedas,
    });
  }

  /* ══════════ retirar ══════════
     NO está aquí: vive en su propia Edge Function (`supabase-funcion-retirar.ts`).

     Dos motivos, y el segundo es el que manda:

       · Las librerías de Solana pesan, y metidas aquí cada login y cada pelea
         pagarían su arranque en frío (~2 s medidos) por un código que solo usa
         la retirada.
       · La clave del tesoro compartiría contexto con todo el resto del juego.
         Cuanto menos código conviva con esa clave, mejor.

     Lo que sí se queda aquí es LEER las retiradas: es una consulta sin riesgo y
     no necesita ninguna librería. */

  /* Las retiradas del jugador. Misma regla que el historial: la dirección sale
     del token, nunca del cuerpo. */
  /* ══════════ los parametros de la retirada ══════════
     Todo lo que la pantalla necesita para decir la verdad ANTES de que el
     jugador pulse nada: a cuanto esta la conversion hoy, cuanto es lo minimo,
     que topes le quedan y si la puerta esta abierta.

     Sin esto la pantalla tendria que suponer, y suponer aqui significa
     enseñarle a alguien una cifra que luego el servidor le corrige. Un numero
     que cambia al pulsar se lee como un engano, aunque sea un despiste.

     Lo retirado HOY sale de `withdrawals`, que el navegador no puede leer
     (RLS con cero politicas), asi que tiene que venir por aqui. */
  if (accion === "economia") {
    const e = (await db("/economia?id=eq.1&select=*"))?.[0];
    if (!e) return responder({ error: "economia sin configurar" }, 500);

    const hoy = new Date().toISOString().slice(0, 10);
    const mias = await db("/withdrawals?address=eq." + encodeURIComponent(dueno) +
                          "&created_at=gte." + hoy + "&estado=neq.devuelta&select=monedas");
    const todas = await db("/withdrawals?created_at=gte." + hoy +
                           "&estado=neq.devuelta&select=monedas");
    const suma = (f: unknown) => (Array.isArray(f) ? f : [])
      .reduce((a: number, x: { monedas?: number }) => a + Number(x.monedas || 0), 0);

    return responder({
      abiertas:   !!e.retiradas_abiertas,
      tasa:       Number(e.tokens_por_moneda),
      comision:   Number(e.comision_pct),
      minimo:     Number(e.minimo_retirada),
      tope_dia:   Number(e.tope_jugador_dia),
      tope_total: Number(e.tope_global_dia),
      hoy_tu:     suma(mias),
      hoy_todos:  suma(todas),
      red:        String(e.red || ""),
    });
  }

  /* ══════════ lo que se puede recuperar ══════════ */
  if (accion === "perdidas") {
    const filas = await db("/rpc/perdidas_de", {
      method: "POST", body: JSON.stringify({ p_address: dueno }),
    });
    return responder({ perdidas: filas || [] });
  }

  /* ══════════ recuperarlo ══════════
     El precio y el objeto salen de LA FILA, no del cuerpo. El navegador solo
     manda el id; aceptar el precio del cliente es el ataque de siempre. */
  if (accion === "rescatar") {
    const pid = idEntero(cuerpo.id);
    if (!pid) return responder({ error: "identificador no valido" }, 400);
    let r;
    try {
      r = await db("/rpc/perdida_rescatar", {
        method: "POST",
        body: JSON.stringify({ p_owner: dueno, p_id: Number(pid) }),
      });
    } catch (e) {
      const m = (e as Error).message;
      if (marca(m, "no_es_tuyo"))   return responder({ error: "eso no es tuyo" }, 403);
      if (marca(m, "ya_rescatado")) return responder({ error: "ya lo recuperaste", clase: "ya" }, 409);
      if (marca(m, "caducado"))     return responder({ error: "se paso el plazo", clase: "caducado" }, 410);
      if (marca(m, "sin_saldo"))    return responder({ error: "no te llegan las monedas", clase: "sin_saldo" }, 403);
      if (marca(m, "no_existe"))    return responder({ error: "eso no existe" }, 404);
      if (marca(m, "sin_jugador"))  return responder({ error: "sesion no valida" }, 401);
      throw e;
    }
    /* Lo gastado vuelve a la reserva, igual que una compra: es un sumidero. */
    reciclar(Number(r.precio) || 0);
    apuntar(dueno, r.tipo === "arma" ? "compra_arma" : "mascota",
            String(r.objeto), -Number(r.precio), { rescate: true });
    return responder(r);
  }

  if (accion === "retiradas") {
    const limite = Math.min(Math.max(Math.floor(Number(cuerpo.limite)) || 20, 1), 100);
    const filas = await db("/rpc/retiradas_de", {
      method: "POST",
      body: JSON.stringify({ p_address: dueno, p_limite: limite }),
    });
    return responder({ retiradas: filas || [] });
  }

  /* ══════════ el vivarium ══════════
     Mismo patron que la armeria: se compra a TU bolsa y desde ahi la equipas
     en el bruto que quieras. El precio sale de `brute-combate.js`, aqui en el
     servidor, nunca del navegador. */
  if (accion === "comprar_mascota") {
    const id = String(cuerpo.mascota || "");
    const m = C.MASCOTAS[id];
    if (!m || id === "ninguna") return responder({ error: "esa mascota no existe" }, 400);
    let r;
    try {
      r = await db("/rpc/mascota_comprar", {
        method: "POST",
        body: JSON.stringify({ p_owner: dueno, p_id: id, p_precio: m.precio,
                               p_nivel_min: m.nivel || 1 }),
      });
    } catch (e) {
      const t = (e as Error).message;
      const nv = faltaNivel(t);
      if (nv) return responder({ error: "te falta nivel", clase: "nivel", nivel: nv }, 403);
      if (marca(t, "sin_saldo")) return responder({ error: "no te llegan las monedas", clase: "sin_saldo" }, 403);
      if (marca(t, "sin_jugador")) return responder({ error: "sesion no valida" }, 401);
      if (marca(t, "desconocido"))     return responder({ error: "esa mascota no existe" }, 400);
      if (marca(t, "precio_invalido")) return responder({ error: "precio no valido" }, 400);
      throw e;
    }
    reciclar(m.precio);
    apuntar(dueno, "mascota", id, -m.precio, { precio: m.precio });
    return responder({ mascota: id, bolsa: r.bolsa, balance: r.balance });
  }

  if (accion === "equipar_mascota") {
    const bid = idEntero(cuerpo.bruteId);
    if (!bid) return responder({ error: "identificador no valido" }, 400);
    const quiere = String(cuerpo.mascota || "ninguna");
    let r;
    try {
      r = await db("/rpc/mascota_equipar", {
        method: "POST",
        body: JSON.stringify({ p_owner: dueno, p_bruto: Number(bid), p_id: quiere,
                               p_nivel_min: (C.MASCOTAS[quiere] || {}).nivel || 1 }),
      });
    } catch (e) {
      const t = (e as Error).message;
      const nv = faltaNivel(t);
      if (nv) return responder({ error: "te falta nivel", clase: "nivel", nivel: nv }, 403);
      if (marca(t, "no_es_tuyo"))   return responder({ error: "ese bruto no es tuyo" }, 403);
      if (marca(t, "sin_copias")) return responder({ error: "no tienes esa mascota", clase: "sin_mascota" }, 403);
      if (marca(t, "desconocido"))  return responder({ error: "esa mascota no existe" }, 400);
      if (marca(t, "sin_jugador")) return responder({ error: "sesion no valida" }, 401);
      throw e;
    }
    return responder({ mascota: r.mascota, bolsa: r.bolsa });
  }

  /* ══════════ historial del jugador ══════════
     Compras y retiradas, solo las suyas.

     ── La línea que no se puede cruzar ──
     La dirección sale del TOKEN DE SESIÓN (`dueno`), nunca del cuerpo de la
     petición. Si se aceptara un `address` del navegador, cualquiera leería el
     historial de cualquiera: las direcciones de wallet son públicas, salen en
     la clasificación. Bastaría con copiar una.

     Por eso aquí no se lee `cuerpo.address` en ninguna parte, ni siquiera para
     comprobarlo — lo que no se lee no se puede colar por descuido. */
  if (accion === "historial") {
    const limite = Math.min(Math.max(Math.floor(Number(cuerpo.limite)) || 50, 1), 200);
    const filas = await db("/rpc/historial_de", {
      method: "POST",
      body: JSON.stringify({ p_address: dueno, p_limite: limite }),
    });
    return responder({ movimientos: filas || [] });
  }

  /* ══════════ torneos ══════════
     El cuadro se resuelve AQUÍ y no en SQL porque hace falta `simulate()`, que
     vive en brute-combate.js. Postgres solo entrega los datos, cobra y paga —
     lo que tiene que ser atómico— y esto pone las peleas.

     Se dispara al ABRIR el torneo, no con una tarea programada. Un cron es una
     cosa más que mantener y que se cae en silencio; esto no puede caerse
     porque no existe. Si nadie abre el torneo, se resuelve cuando alguien lo
     abra, y el resultado es el mismo.

     `torneo_tomar` lo pasa a `en_curso` de forma atómica: si dos personas lo
     abren a la vez, la segunda se encuentra el estado ya cambiado y no hace
     nada. Sin eso, el premio se repartiría dos veces. */
  if (accion === "torneo_ver" || accion === "torneo_apuntarse") {
    const tid = idEntero(cuerpo.torneoId);
    if (!tid) return responder({ error: "identificador no valido" }, 400);

    if (accion === "torneo_apuntarse") {
      const bid = idEntero(cuerpo.bruteId);
      if (!bid) return responder({ error: "identificador no valido" }, 400);
      try {
        const r = await db("/rpc/torneo_inscribir", {
          method: "POST",
          body: JSON.stringify({ p_owner: dueno, p_torneo: Number(tid), p_bruto: Number(bid) }),
        });
        /* La entrada NO se recicla aquí: pasa a ser BOTE, y el bote se
           reparte al cerrar. Lo que vuelve a la reserva es solo la parte de la
           casa, y eso lo hace `torneo_cerrar`. */
        apuntar(dueno, "torneo", String(tid), -Number(r.pagado), { entrada_id: r.entrada_id });
        return responder(r);
      } catch (e) {
        const m = (e as Error).message;
        if (m.includes("torneo_desconocido"))   return responder({ error: "ese torneo no existe" }, 404);
        if (m.includes("inscripcion_cerrada"))  return responder({ error: "las inscripciones estan cerradas", clase: "cerrado" }, 403);
        if (m.includes("torneo_lleno"))         return responder({ error: "no quedan plazas", clase: "lleno" }, 409);
        if (m.includes("no es tuyo"))           return responder({ error: "ese bruto no es tuyo" }, 403);
        if (m.includes("nivel_fuera:"))         return responder({ error: "tu bruto esta fuera del rango de niveles",
                                                                   clase: "nivel", rango: (m.match(/nivel_fuera:([\d-]+)/) || [])[1] }, 403);
        if (m.includes("sin_saldo"))            return responder({ error: "no te llegan las monedas", clase: "sin_saldo" }, 403);
        if (m.includes("entrada_jugador_unico")) return responder({ error: "ya estas apuntado con otro bruto", clase: "repetido" }, 409);
        if (m.includes("entrada_bruto_unico"))   return responder({ error: "ese bruto ya esta apuntado", clase: "repetido" }, 409);
        throw e;
      }
    }

    /* ── ver: y de paso resolverlo si toca ── */
    await resolverTorneo(Number(tid)).catch((e) =>
      console.warn("torneo " + tid + " no se pudo resolver: " + e.message));

    const t = await db("/tournaments?id=eq." + tid + "&select=*");
    if (!t || !t[0]) return responder({ error: "ese torneo no existe" }, 404);
    const entradas = await db("/tournament_entries?torneo_id=eq." + tid +
                              "&select=id,bruto_id,address,snapshot,posicion,premio" +
                              "&order=posicion.asc.nullslast,created_at.asc");
    const cuadro = await db("/tournament_fights?torneo_id=eq." + tid +
                            "&select=ronda,puesto,a_entry,b_entry,seed,winner,turns" +
                            "&order=ronda.asc,puesto.asc");
    return responder({ torneo: t[0], entradas: entradas || [], cuadro: cuadro || [] });
  }

  /* ══════════ panel de administración ══════════
     El control va AQUÍ, no en la página. Un panel que solo esconde botones a
     quien no es admin no protege nada: cualquiera puede llamar a estas rutas
     directamente con curl, como se hizo durante todas las pruebas de hoy. */
  if (accion.startsWith("admin_")) {
    if (!ADMINS.includes(dueno)) {
      /* Mismo mensaje que una sesión inválida, y sin decir que la ruta existe:
         a quien no es admin no hay por qué confirmarle que hay un panel. */
      return responder({ error: "sesion no valida o caducada" }, 401);
    }

    /* ── Registro de auditoría ──
       Toda modificación deja rastro con el antes y el después. Sin el antes,
       el registro solo dice que algo cambió, no de qué a qué. */
    const anotar = (acc: string, objetivo: string, antes: unknown, despues: unknown) =>
      db("/admin_log", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ admin: dueno, accion: acc, objetivo: String(objetivo),
                               antes: antes ?? null, despues: despues ?? null }),
      }).catch((e) => console.warn("admin_log: " + e.message));


    if (accion === "admin_resumen") {
      const r = await db("/rpc/admin_resumen", { method: "POST", body: "{}" });
      return responder({ resumen: r });
    }

    /* ══════════ ¿en que red estamos? ══════════
       La red del RPC decide donde se comprueban los pagos, y NO se puede
       adivinar mirando el secreto: la URL la escribe una persona a mano.

       Si apunta a devnet y alguien paga con SOL real —Phantom esta en mainnet
       por defecto—, la funcion busca ese pago en devnet, no lo encuentra
       nunca, y esa persona se queda sin tokens y sin su dinero.

       El genesis hash lo dice sin ambiguedad: es distinto en cada red y no se
       puede falsificar desde la URL.

       NUNCA se devuelve la URL: lleva la clave de API dentro. Solo el host. */
    if (accion === "admin_red") {
      const url = Deno.env.get("SOLANA_RPC") || "";
      if (!url) return responder({ red: null, motivo: "SOLANA_RPC sin poner" });

      let host = "?";
      try { host = new URL(url).host; } catch { return responder({ red: null, motivo: "SOLANA_RPC no es una URL" }); }

      const GENESIS: Record<string, string> = {
        "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d": "mainnet",
        "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG": "devnet",
        "4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY": "testnet",
      };
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getGenesisHash" }),
        });
        const j = await r.json();
        const g = String(j?.result || "");
        return responder({ red: GENESIS[g] || "desconocida", host, genesis: g, responde: r.ok });
      } catch (e) {
        return responder({ red: null, host, motivo: "el RPC no responde: " + (e as Error).message });
      }
    }

    /* ══════════ la preventa, desde el panel ══════════
       Encender una preventa es empezar a aceptar dinero de gente, asi que
       todo pasa por `preventa_config`, que exige motivo y deja el antes y el
       despues en `admin_log`.

       Las tres tablas tienen RLS y CERO politicas, o sea que ni el panel ni
       nadie puede mirarlas desde el navegador: se leen aqui, con
       `service_role`. */
    if (accion === "admin_preventa") {
      const pv = (await db("/preventa?id=eq.1&select=*"))?.[0] || null;
      const compras = await db(
        "/preventa_compras?select=*&order=creado.desc&limit=100");
      const reclamos = await db(
        "/preventa_reclamos?select=*&order=creado.desc&limit=50");
      return responder({ preventa: pv, compras: compras || [], reclamos: reclamos || [] });
    }

    if (accion === "admin_preventa_config") {
      const c = (cuerpo.campos || {}) as Record<string, unknown>;
      const motivo = String(cuerpo.motivo || "");
      if (motivo.trim().length < 10) {
        return responder({ error: "hace falta un motivo de al menos 10 letras", clase: "motivo" }, 400);
      }

      /* Se sanea TODO, aunque el panel ya valide: el panel es una pagina del
         navegador y cualquiera puede saltarsela. Lo que decide es esto.

         Un precio negativo o un cupo absurdo aqui no es un numero feo: es el
         precio al que se le cobra a gente real. */
      const campos: Record<string, unknown> = {};
      const entero = (v: unknown, max: number) => {
        const n = Math.floor(Number(v));
        if (!Number.isFinite(n) || n < 0 || n > max) throw new Error("rango");
        return n;
      };
      try {
        if (c.activa            !== undefined) campos.activa = !!c.activa;
        if (c.reclamos_abiertos !== undefined) campos.reclamos_abiertos = !!c.reclamos_abiertos;
        if (c.precio_lamports   !== undefined) campos.precio_lamports = entero(c.precio_lamports, 1e15);
        if (c.cupo_total        !== undefined) campos.cupo_total  = entero(c.cupo_total, 1e12);
        if (c.tope_wallet       !== undefined) campos.tope_wallet = entero(c.tope_wallet, 1e12);
        if (c.minimo            !== undefined) campos.minimo      = entero(c.minimo, 1e12);
        /* Una fecha presente y nula significa «quitala». Saltarsela cuando
           viene vacia dejaria una fecha imposible de borrar, y una preventa
           con una fecha de fin que no se puede quitar se cierra sola. */
        for (const k of ["desde", "hasta"]) {
          if (c[k] === undefined) continue;
          const txt = String(c[k] ?? "").trim();
          if (!txt) { campos[k] = null; continue; }
          if (Number.isNaN(Date.parse(txt))) throw new Error("fecha");
          campos[k] = new Date(txt).toISOString();
        }
        /* La wallet que cobra y el mint que se entrega son los dos campos que
           de verdad mueven valor. Se comprueba que sean claves validas: una
           direccion mal escrita es SOL enviado a un sitio del que no sale. */
        for (const k of ["wallet", "mint"]) {
          if (c[k] === undefined) continue;
          const txt = String(c[k] || "").trim();
          if (!txt) continue;
          if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(txt)) throw new Error("direccion");
          campos[k] = txt;
        }
      } catch (e) {
        const m = (e as Error).message;
        return responder({
          error: m === "fecha" ? "fecha no valida"
               : m === "direccion" ? "esa direccion de Solana no es valida"
               : "algun numero esta fuera de rango",
          clase: m,
        }, 400);
      }

      /* Encenderla sin wallet donde cobrar es aceptar pagos que no llegan a
         ningun sitio. Se comprueba contra lo que quedaria, no contra lo que
         habia: el mismo guardado puede poner la wallet y encenderla a la vez. */
      const antes = (await db("/preventa?id=eq.1&select=*"))?.[0] || {};
      const queda = { ...antes, ...campos };
      if (queda.activa) {
        if (!queda.wallet) return responder({ error: "falta la wallet que cobra", clase: "sin_wallet" }, 400);
        if (!Number(queda.precio_lamports)) return responder({ error: "falta el precio", clase: "sin_precio" }, 400);
        if (!Number(queda.cupo_total)) return responder({ error: "falta el cupo", clase: "sin_cupo" }, 400);
      }
      if (queda.reclamos_abiertos && !queda.mint) {
        return responder({ error: "falta el mint del token", clase: "sin_mint" }, 400);
      }

      /* `p_admin` NO es decorativo: `admin_log.admin` es NOT NULL, asi que sin
         el, el insert de auditoria revienta y se lleva por delante el guardado
         entero. Fue el primer fallo de este panel, y el sintoma era «algo ha
         fallado en el servidor» sin decir por que.

         Sale de la SESION, nunca del cuerpo. Si el navegador pudiera mandarlo,
         el registro diria lo que quisiera el que lo edita — y un registro de
         auditoria que el auditado escribe no vale nada. */
      try {
        const r = await db("/rpc/preventa_config", {
          method: "POST",
          body: JSON.stringify({ p_admin: dueno, p_campos: campos, p_motivo: motivo }),
        });
        return responder({ preventa: r });
      } catch (e) {
        /* Y aqui NO se deja caer al 500 generico. Un error mudo en la unica
           pantalla que enciende una preventa deja al dueño sin saber si guardo
           o no, que es la peor manera de perder dinero de otros. */
        const m = (e as Error).message;
        console.error("preventa_config: " + m);
        if (marca(m, "motivo_corto")) return responder({ error: "el motivo es demasiado corto", clase: "motivo" }, 400);
        if (marca(m, "sin_admin"))    return responder({ error: "sesion sin administrador", clase: "sesion" }, 401);
        if (marca(m, "PGRST202"))     return responder({
          error: "falta aplicar la ultima version de supabase-31-preventa.sql",
          clase: "sin_funcion",
        }, 503);
        return responder({ error: "Postgres rechazo el cambio: " + m.slice(0, 300), clase: "sql" }, 500);
      }
    }

    /* ══════════ torneos, desde el panel ══════════
       Crear, listar y editar. Los borradores solo se ven por aquí: la política
       de lectura de `tournaments` los esconde del navegador a propósito, para
       que el admin pueda montar uno tranquilo antes de abrirlo. */
    if (accion === "admin_torneos") {
      const torneos = await db("/tournaments?select=*&order=created_at.desc&limit=100");
      const inscritos = await db("/tournament_entries?select=torneo_id,posicion,premio,snapshot,address");
      return responder({ torneos: torneos || [], inscritos: inscritos || [] });
    }

    /* Valida y recorta TODO lo que llega del formulario. El panel ya avisa de
       un reparto que no suma 100, pero el panel es una página del navegador y
       cualquiera puede saltárselo: lo que decide es esto. */
    const saneaTorneo = (c: Record<string, unknown>, antes?: Record<string, unknown>) => {
      const campos: Record<string, unknown> = {};
      const num = (v: unknown, min: number, max: number, def: number) => {
        const n = Math.floor(Number(v));
        return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : def;
      };
      if (c.nombre !== undefined) {
        const n = sanearNombre(c.nombre);
        if (n.length < 2) throw new Error("nombre_corto");
        campos.nombre = n;
      }
      if (c.plazas !== undefined) {
        const p = Math.floor(Number(c.plazas));
        if (![4, 8, 16, 32].includes(p)) throw new Error("plazas_invalidas");
        campos.plazas = p;
      }
      if (c.entrada !== undefined)   campos.entrada   = num(c.entrada, 0, 1e9, Number(antes?.entrada) || 0);
      if (c.nivel_min !== undefined) campos.nivel_min = num(c.nivel_min, 1, NIVEL_MAX, 1);
      if (c.nivel_max !== undefined) campos.nivel_max = num(c.nivel_max, 1, NIVEL_MAX, NIVEL_MAX);
      if (campos.nivel_min !== undefined && campos.nivel_max !== undefined &&
          Number(campos.nivel_min) > Number(campos.nivel_max)) throw new Error("niveles_al_reves");

      if (c.empieza_at !== undefined) {
        const t = Date.parse(String(c.empieza_at));
        if (!Number.isFinite(t)) throw new Error("fecha_invalida");
        campos.empieza_at = new Date(t).toISOString();
      }
      /* El reparto se comprueba ENTERO o no se toca: cuatro porcentajes que
         deben sumar 100, y la restriccion de la tabla lo repetiria de todas
         formas — pero con un error de Postgres en vez de uno explicable. */
      const p = ["pct_1", "pct_2", "pct_semis", "pct_casa"];
      if (p.some((k) => c[k] !== undefined)) {
        const v = p.map((k) => num(c[k] ?? antes?.[k], 0, 100, 0));
        if (v.reduce((a, b) => a + b, 0) !== 100) throw new Error("reparto_no_suma");
        p.forEach((k, i) => campos[k] = v[i]);
      }
      if (c.estado !== undefined) {
        if (!["borrador", "inscripcion", "cancelado"].includes(String(c.estado))) {
          throw new Error("estado_invalido");
        }
        campos.estado = c.estado;
      }
      return campos;
    };

    const errorTorneo = (m: string) => {
      const mapa: Record<string, string> = {
        nombre_corto: "el nombre es demasiado corto",
        plazas_invalidas: "las plazas tienen que ser 4, 8, 16 o 32",
        niveles_al_reves: "el nivel minimo es mayor que el maximo",
        fecha_invalida: "esa fecha no vale",
        reparto_no_suma: "el reparto del bote no suma 100",
        estado_invalido: "ese estado no se puede poner a mano",
      };
      for (const k in mapa) if (m.includes(k)) return responder({ error: mapa[k], clase: k }, 400);
      return null;
    };

    if (accion === "admin_torneo_crear") {
      let campos;
      try { campos = saneaTorneo(cuerpo.campos || {}); }
      catch (e) { return errorTorneo((e as Error).message) || responder({ error: "datos no validos" }, 400); }
      if (!campos.nombre || !campos.empieza_at) {
        return responder({ error: "hacen falta nombre y fecha", clase: "faltan" }, 400);
      }
      const fila = await db("/tournaments", {
        method: "POST", headers: { Prefer: "return=representation" },
        body: JSON.stringify({ ...campos, creado_por: dueno }),
      });
      await anotar("torneo_crear", String(fila[0].id), null, fila[0]);
      return responder({ torneo: fila[0] });
    }

    if (accion === "admin_torneo_editar") {
      const id = idEntero(cuerpo.id);
      if (!id) return responder({ error: "identificador no valido" }, 400);
      const antes = (await db("/tournaments?id=eq." + id + "&select=*"))?.[0];
      if (!antes) return responder({ error: "ese torneo no existe" }, 404);

      /* Un torneo empezado no se toca: cambiar la entrada o el reparto con
         gente ya apuntada y el bote cobrado seria cambiarles las reglas a
         mitad de partida. */
      if (antes.estado === "en_curso" || antes.estado === "terminado") {
        return responder({ error: "ese torneo ya no se puede editar", clase: "cerrado" }, 409);
      }
      let campos;
      try { campos = saneaTorneo(cuerpo.campos || {}, antes); }
      catch (e) { return errorTorneo((e as Error).message) || responder({ error: "datos no validos" }, 400); }

      /* Con gente dentro, la ENTRADA y las PLAZAS quedan bloqueadas: el bote ya
         se cobro a ese precio, y bajar las plazas dejaria inscritos fuera. */
      const dentro = (await db("/tournament_entries?torneo_id=eq." + id + "&select=id"))?.length || 0;
      if (dentro > 0) { delete campos.entrada; delete campos.plazas; }

      if (!Object.keys(campos).length) return responder({ torneo: antes, sin_cambios: true });
      const fila = await db("/tournaments?id=eq." + id, {
        method: "PATCH", headers: { Prefer: "return=representation" },
        body: JSON.stringify(campos),
      });
      await anotar("torneo_editar", String(id), antes, fila[0]);
      return responder({ torneo: fila[0], inscritos: dentro });
    }

    /* ── Resolver ya, sin esperar a la fecha ──
       Util de verdad, no solo para probar: si un torneo se llena en dos horas,
       esperar tres dias no tiene sentido.

       Adelanta la fecha y llama al mismo resolvedor de siempre. NO se salta
       ninguna comprobacion: `torneo_tomar` sigue exigiendo estado
       `inscripcion` y sigue cancelando con devolucion si hay menos de dos
       inscritos. Lo unico que cambia es el reloj. */
    if (accion === "admin_torneo_resolver") {
      const id = idEntero(cuerpo.id);
      if (!id) return responder({ error: "identificador no valido" }, 400);
      const antes = (await db("/tournaments?id=eq." + id + "&select=*"))?.[0];
      if (!antes) return responder({ error: "ese torneo no existe" }, 404);
      if (antes.estado !== "inscripcion") {
        return responder({ error: "solo se puede resolver uno con las inscripciones abiertas",
                           clase: "no_resoluble" }, 409);
      }
      await db("/tournaments?id=eq." + id, {
        method: "PATCH", body: JSON.stringify({ empieza_at: new Date().toISOString() }),
      });
      const r = await resolverTorneo(Number(id));
      await anotar("torneo_resolver", String(id), antes, r);
      return responder({ resuelto: r });
    }

    if (accion === "admin_torneo_borrar") {
      const id = idEntero(cuerpo.id);
      if (!id) return responder({ error: "identificador no valido" }, 400);
      const antes = (await db("/tournaments?id=eq." + id + "&select=*"))?.[0];
      if (!antes) return responder({ error: "ese torneo no existe" }, 404);
      const dentro = (await db("/tournament_entries?torneo_id=eq." + id + "&select=id"))?.length || 0;
      /* Con gente apuntada no se borra: habria que devolverles la entrada, y
         eso es `cancelar`, no `borrar`. Borrar seria quedarse su dinero. */
      if (dentro > 0) {
        return responder({ error: "tiene gente apuntada; cancelalo en vez de borrarlo",
                           clase: "con_inscritos", inscritos: dentro }, 409);
      }
      await db("/tournaments?id=eq." + id, { method: "DELETE" });
      await anotar("torneo_borrar", String(id), antes, null);
      return responder({ borrado: true });
    }

    if (accion === "admin_jugadores") {
      const jugadores = await db("/players?select=address,coins,slots,created_at,last_seen&order=last_seen.desc&limit=200");
      const brutos = await db("/brutes?select=id,owner,name,level,xp,hp_max,str,agi,spd,wins,losses,fights_left,created_at&order=level.desc&limit=500");
      return responder({ jugadores, brutos });
    }

    /* ── editar un bruto ──
       Los valores se recortan al mismo rango legal que usa el juego. Un
       administrador está para arreglar cosas, no para crear un bruto con
       fuerza 500 que rompa el equilibrio de todos los demás. */
    if (accion === "admin_editar_bruto") {
      const id = idEntero(cuerpo.id);
      if (!id) return responder({ error: "identificador no valido" }, 400);
      const antes = (await db("/brutes?id=eq." + encodeURIComponent(id) + "&select=*"))?.[0];
      if (!antes) return responder({ error: "ese bruto no existe" }, 404);

      const c = cuerpo.campos || {};
      const campos: Record<string, unknown> = {};
      if (c.name !== undefined)   campos.name = sanearNombre(c.name);
      if (c.level !== undefined)  campos.level = entre(c.level, 1, NIVEL_MAX, antes.level);
      if (c.xp !== undefined)     campos.xp = entre(c.xp, 0, 1e6, antes.xp);
      if (c.hp_max !== undefined) campos.hp_max = entre(c.hp_max, 1, HP_MAX, antes.hp_max);
      if (c.str !== undefined)    campos.str = entre(c.str, 1, STAT_MAX, antes.str);
      if (c.agi !== undefined)    campos.agi = entre(c.agi, 1, STAT_MAX, antes.agi);
      if (c.spd !== undefined)    campos.spd = entre(c.spd, 1, STAT_MAX, antes.spd);
      if (c.wins !== undefined)   campos.wins = entre(c.wins, 0, 1e6, antes.wins);
      if (c.losses !== undefined) campos.losses = entre(c.losses, 0, 1e6, antes.losses);
      if (c.fights_left !== undefined) campos.fights_left = entre(c.fights_left, 0, 9, antes.fights_left);
      if (!Object.keys(campos).length) return responder({ error: "nada que cambiar" }, 400);

      try {
        await db("/brutes?id=eq." + encodeURIComponent(id), { method: "PATCH", body: JSON.stringify(campos) });
      } catch (e) {
        if (String((e as Error).message).includes("23505"))
          return responder({ error: "ese nombre ya lo lleva otro bruto", clase: "duplicado" }, 409);
        throw e;
      }
      await anotar("editar_bruto", id, antes, campos);
      return responder({ ok: true });
    }

    /* ── editar un jugador ── */
    if (accion === "admin_editar_jugador") {
      const dir = String(cuerpo.address || "");
      const antes = (await db("/players?address=eq." + encodeURIComponent(dir) + "&select=*"))?.[0];
      if (!antes) return responder({ error: "ese jugador no existe" }, 404);

      const c = cuerpo.campos || {};
      const campos: Record<string, unknown> = {};
      if (c.coins !== undefined) campos.coins = entre(c.coins, 0, 1e9, antes.coins);
      if (c.slots !== undefined) campos.slots = entre(c.slots, 1, MAX_BRUTOS, antes.slots);
      if (!Object.keys(campos).length) return responder({ error: "nada que cambiar" }, 400);

      /* ── El saldo NO se escribe a pelo ────────────────────────────────────
         Escribirlo directo es imprimir dinero. La reserva no baja al dar
         monedas, pero el reciclaje SI las devuelve cuando el jugador las
         gasta: salen sin permiso y entran con el, y la reserva acaba por
         encima de su propio techo.

         Paso dos veces. 407 monedas dejaron la reserva en 40.000.117, y
         despues 100 anadidas desde este mismo panel la dejaron en
         40.000.100.

         Hoy se arregla con un UPDATE. Con el token en mainnet cada moneda de
         mas es un derecho a cobrar tokens que NO existen en la wallet
         operativa, y el ultimo en retirar se queda sin cobrar.

         Asi que dar monedas las SACA de la reserva y quitarlas las DEVUELVE,
         igual que una pelea o una compra. */
      if (campos.coins !== undefined && Number(campos.coins) !== Number(antes.coins)) {
        const delta = Number(campos.coins) - Number(antes.coins);
        if (delta > 0) {
          const r = await emitir(delta);
          if (r.monedas < delta) {
            /* La reserva manda. Si no llega, no se inventa la diferencia. */
            return responder({ error: "la reserva no da para tanto", clase: "sin_reserva",
                               disponible: r.monedas }, 409);
          }
        } else {
          reciclar(-delta);
        }
      }

      await db("/players?address=eq." + encodeURIComponent(dir), { method: "PATCH", body: JSON.stringify(campos) });
      await anotar("editar_jugador", dir, antes, campos);
      return responder({ ok: true });
    }

    /* ── borrar un bruto ── */
    if (accion === "admin_borrar_bruto") {
      const id = idEntero(cuerpo.id);
      if (!id) return responder({ error: "identificador no valido" }, 400);
      const antes = (await db("/brutes?id=eq." + encodeURIComponent(id) + "&select=*"))?.[0];
      if (!antes) return responder({ error: "ese bruto no existe" }, 404);
      await db("/brutes?id=eq." + encodeURIComponent(id), { method: "DELETE" });
      await anotar("borrar_bruto", id, antes, null);
      return responder({ ok: true });
    }

    /* ── borrar un jugador ──
       Se lleva por delante sus brutos (la clave foránea es on delete cascade) y
       sus peleas. Por eso se anota cuántas cosas caen: el registro tiene que
       poder explicar después por qué desapareció todo eso. */
    if (accion === "admin_borrar_jugador") {
      const dir = String(cuerpo.address || "");
      if (ADMINS.includes(dir)) {
        return responder({ error: "no se puede borrar a un administrador desde aqui" }, 403);
      }
      const antes = (await db("/players?address=eq." + encodeURIComponent(dir) + "&select=*"))?.[0];
      if (!antes) return responder({ error: "ese jugador no existe" }, 404);
      const suyos = await db("/brutes?owner=eq." + encodeURIComponent(dir) + "&select=id,name");

      await db("/sessions?address=eq." + encodeURIComponent(dir), { method: "DELETE" }).catch(() => {});
      await db("/players?address=eq." + encodeURIComponent(dir), { method: "DELETE" });
      await anotar("borrar_jugador", dir, { ...antes, brutos: suyos }, null);
      return responder({ ok: true, brutos_borrados: (suyos || []).length });
    }

    return responder({ error: "accion de admin desconocida" }, 400);
  }

  return responder({ error: "accion desconocida" }, 400);
}
