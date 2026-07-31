/* ══════════════════════════════════════════════════════════════════════════
   SolBrute · Edge Function "auth" — login con firma (Sign In With Solana)
   ══════════════════════════════════════════════════════════════════════════
   Se despliega desde el panel de Supabase: Edge Functions → Deploy a new
   function → nombre EXACTO "auth" → pegar este fichero entero.

   Necesita un secreto llamado JWT_SECRET con el JWT Secret del proyecto
   (Project Settings → API → JWT Settings). SUPABASE_URL y
   SUPABASE_SERVICE_ROLE_KEY los pone Supabase solo.

   ── Qué hace y por qué es el único sitio donde puede hacerse ──────────────
   El navegador NO puede demostrar quién eres: cualquier cosa que calcule, la
   puede falsificar quien abra la consola. La única prueba que vale es
   criptográfica y hay que comprobarla aquí, en un sitio donde el usuario no
   manda.

   Dos rutas:

     POST { accion: "nonce",  address }
        → reserva un número de un solo uso para esa dirección.

     POST { accion: "verify", address, message, signature }
        → comprueba la firma con ed25519, tacha el nonce, y emite un JWT de
          sesión que Supabase acepta. A partir de ahí las políticas RLS
          dejan a ese jugador tocar sus filas y solo las suyas.

   ── Lo que este fichero NO arregla ────────────────────────────────────────
   El combate lo sigue calculando el navegador. Con esto un tramposo ya no
   puede tocar los brutos de OTROS, pero sí puede mentir sobre los suyos —
   darse monedas o victorias. Eso es el siguiente paso: mover simulate() aquí.
   Ver BACKEND.md.
   ══════════════════════════════════════════════════════════════════════════ */

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

const URL_SB     = Deno.env.get("SUPABASE_URL")!;
const SERVICE    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const JWT_SECRET = Deno.env.get("JWT_SECRET")!;

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

/* ═══════════ JWT firmado con HS256 ═══════════ */
const b64url = (datos: Uint8Array) =>
  btoa(String.fromCharCode(...datos)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const b64urlTexto = (texto: string) => b64url(new TextEncoder().encode(texto));

/* ── El secreto puede venir en varios formatos ────────────────────────────
   Supabase no siempre entrega el JWT Secret como texto plano: según la
   antigüedad del proyecto puede ser una cadena de 40 caracteres usada tal
   cual, o bytes codificados en base64 / base64url / hexadecimal.

   Usar el formato equivocado produce una firma que parece correcta pero que
   la base de datos rechaza con "no suitable key" — sin ninguna pista de por
   qué. Así que en vez de suponer, se prueban todas y se elige la que sabe
   reproducir la firma de la clave anon del propio proyecto, que está firmada
   con ese mismo secreto. Es una comprobación exacta, no una heurística. */
function interpretaciones(secreto: string): { nombre: string; bytes: Uint8Array }[] {
  const salida: { nombre: string; bytes: Uint8Array }[] = [];
  salida.push({ nombre: "utf8", bytes: new TextEncoder().encode(secreto) });

  const deB64 = (txt: string) => {
    const normal = txt.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(normal + "=".repeat((4 - normal.length % 4) % 4));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  };
  try { salida.push({ nombre: "base64", bytes: deB64(secreto) }); } catch { /* no era base64 */ }

  if (/^[0-9a-fA-F]+$/.test(secreto) && secreto.length % 2 === 0) {
    const bytes = new Uint8Array(secreto.length / 2);
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(secreto.substr(i * 2, 2), 16);
    salida.push({ nombre: "hex", bytes });
  }
  return salida;
}

let claveCache: CryptoKey | null = null;
let formatoUsado = "ninguno";

/* Devuelve la clave HMAC en el formato que de verdad usa el proyecto. */
async function claveFirma(): Promise<CryptoKey> {
  if (claveCache) return claveCache;

  const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const trozos = anon.split(".");

  for (const cand of interpretaciones(JWT_SECRET)) {
    const clave = await crypto.subtle.importKey(
      "raw", cand.bytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
    );
    if (trozos.length === 3) {
      const f = await crypto.subtle.sign("HMAC", clave, new TextEncoder().encode(trozos[0] + "." + trozos[1]));
      if (b64url(new Uint8Array(f)) === trozos[2]) {
        claveCache = clave; formatoUsado = cand.nombre;
        return clave;
      }
    }
  }
  /* Ninguna cuadra: el secreto es otro, o el proyecto usa claves asimétricas
     y este enfoque no sirve. Se lanza en vez de emitir un token que la base
     de datos va a rechazar luego sin explicar por qué. */
  throw new Error("JWT_SECRET no reproduce la firma de la clave anon");
}

async function firmarJWT(carga: Record<string, unknown>): Promise<string> {
  const cabecera = { alg: "HS256", typ: "JWT" };
  const cuerpo = b64urlTexto(JSON.stringify(cabecera)) + "." + b64urlTexto(JSON.stringify(carga));
  const firma = await crypto.subtle.sign("HMAC", await claveFirma(), new TextEncoder().encode(cuerpo));
  return cuerpo + "." + b64url(new Uint8Array(firma));
}

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

/* ═══════════ servidor ═══════════ */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return responder({ error: "solo POST" }, 405);

  let cuerpo: Record<string, string>;
  try { cuerpo = await req.json(); }
  catch { return responder({ error: "cuerpo no es JSON" }, 400); }

  const { accion, address } = cuerpo;

  /* ── ruta 0: autodiagnóstico ──────────────────────────────────────────────
     Comprueba si JWT_SECRET es el bueno, SIN revelarlo.
     El truco: la clave anon del propio proyecto está firmada con ese mismo
     secreto. Si al recalcular su firma con nuestro JWT_SECRET sale la misma,
     el secreto es correcto. Si no, está mal copiado.
     Devuelve solo un sí/no y longitudes: nada que sirva para reconstruirlo. */
  if (accion === "diagnostico") {
    let correcto = false;
    let motivo = "";
    try { await claveFirma(); correcto = true; }
    catch (e) { motivo = (e as Error).message; }

    return responder({
      secreto_presente: !!JWT_SECRET,
      secreto_longitud: JWT_SECRET ? JWT_SECRET.length : 0,
      espacios_sobrantes: JWT_SECRET ? JWT_SECRET !== JWT_SECRET.trim() : false,
      formatos_probados: interpretaciones(JWT_SECRET).map((x) => x.nombre),
      secreto_correcto: correcto,
      formato_que_funciona: correcto ? formatoUsado : null,
      motivo,
    });
  }

  /* La dirección de Solana son 32 bytes, 43-44 caracteres en base58.
     Se valida antes de tocar nada para no guardar basura. */
  if (!address || address.length < 32 || address.length > 44) {
    return responder({ error: "dirección no válida" }, 400);
  }

  /* ── ruta 1: repartir un nonce ── */
  if (accion === "nonce") {
    /* Barrido oportunista: sin esto la tabla crece para siempre.
       Se hace aquí para no depender de ninguna tarea programada. */
    await db("/auth_nonces?expires_at=lt." + new Date(Date.now() - 3600e3).toISOString(),
             { method: "DELETE" }).catch(() => {});

    const nonce = b64url(crypto.getRandomValues(new Uint8Array(24)));
    const expira = new Date(Date.now() + VIDA_NONCE_MIN * 60e3).toISOString();

    await db("/auth_nonces", {
      method: "POST",
      body: JSON.stringify({ nonce, address, expires_at: expira }),
    });

    return responder({ nonce, expires_at: expira });
  }

  /* ── ruta 2: verificar la firma ── */
  if (accion === "verify") {
    const { message, signature } = cuerpo;
    if (!message || !signature) return responder({ error: "faltan message o signature" }, 400);

    const partes = leerMensaje(message);

    /* El dominio va dentro de lo firmado: sin esta comprobación, una firma
       obtenida en otra web valdría aquí. */
    if (!DOMINIOS_OK.includes(partes.dominio)) {
      return responder({ error: "dominio no autorizado: " + partes.dominio }, 401);
    }
    /* La dirección del mensaje tiene que ser la misma que dice enviar. */
    if (partes.direccion !== address) {
      return responder({ error: "la dirección del mensaje no coincide" }, 401);
    }
    /* Una firma vieja no debe servir aunque el nonce siguiera vivo. */
    const edad = Date.now() - Date.parse(partes.fecha || "");
    if (!(edad >= -60e3 && edad < VIDA_NONCE_MIN * 60e3)) {
      return responder({ error: "mensaje caducado o con fecha rara" }, 401);
    }

    /* El nonce tiene que existir, ser de esta dirección, estar sin usar y sin
       caducar. Cualquier fallo aquí es un intento de repetición. */
    const filas = await db("/auth_nonces?nonce=eq." + encodeURIComponent(partes.nonce) + "&select=*");
    const guardado = filas && filas[0];
    if (!guardado)               return responder({ error: "nonce desconocido" }, 401);
    if (guardado.used)           return responder({ error: "nonce ya usado" }, 401);
    if (guardado.address !== address) return responder({ error: "nonce de otra dirección" }, 401);
    if (Date.parse(guardado.expires_at) < Date.now()) return responder({ error: "nonce caducado" }, 401);

    /* La comprobación criptográfica: ¿la firma sale de la clave privada de
       esta dirección? La dirección ES la clave pública. */
    let valida = false;
    try {
      const clave = await crypto.subtle.importKey(
        "raw", desdeBase58(address), { name: "Ed25519" }, false, ["verify"],
      );
      valida = await crypto.subtle.verify(
        { name: "Ed25519" }, clave,
        desdeBase58(signature), new TextEncoder().encode(message),
      );
    } catch (e) {
      return responder({ error: "no pude verificar la firma: " + (e as Error).message }, 400);
    }
    if (!valida) return responder({ error: "firma no válida" }, 401);

    /* Tachar el nonce ANTES de emitir nada: si algo falla después, ese número
       ya no vale para nadie. */
    await db("/auth_nonces?nonce=eq." + encodeURIComponent(partes.nonce), {
      method: "PATCH",
      body: JSON.stringify({ used: true }),
    });

    /* Alta del jugador si es su primera vez. */
    await db("/players", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ address, last_seen: new Date().toISOString() }),
    }).catch(() => {});

    /* El JWT que entiende Supabase. El claim "role" es el que hace que
       PostgREST te trate como usuario autenticado; "wallet" es el que leen
       las políticas para dejarte tocar solo tus filas. */
    const ahora = Math.floor(Date.now() / 1000);
    const token = await firmarJWT({
      role: "authenticated",
      aud: "authenticated",
      sub: address,
      wallet: address,
      iat: ahora,
      exp: ahora + VIDA_SESION_H * 3600,
    });

    return responder({ token, address, expires_in: VIDA_SESION_H * 3600 });
  }

  return responder({ error: "acción desconocida" }, 400);
});
