// ══════════════════════════════════════════════════════════════════════════
// SolBrute · ataque al blog, contra el SERVIDOR DESPLEGADO
// ══════════════════════════════════════════════════════════════════════════
//
//   node prueba-blog.mjs
//
// No usa base simulada: habla con la Edge Function de verdad y con Postgres de
// verdad, con claves ed25519 recien generadas. Igual que `prueba-preventa.mjs`
// y por el mismo motivo.
//
// ── Que cubre esto que NO cubre el banco simulado ─────────────────────────
// `prueba-hostil.ts` ya comprueba lo que se le PASA a Postgres: que un bloque
// inventado no llega, que el slug se sanea, que el tag cae a uno conocido. Eso
// es la forma de los datos.
//
// Lo que solo se puede comprobar aqui es la PUERTA: que una sesion legitima de
// un jugador cualquiera —no inventada, no caducada, valida de verdad— no puede
// publicar, editar ni borrar. El banco no lo prueba porque alli la lista de
// administradores es de mentira.
//
// ── Es seguro pasarlo ─────────────────────────────────────────────────────
// Ningun ataque llega a escribir: o le falta el token, o lo lleva mal, o la
// direccion no esta en ADMIN_WALLETS. Las entradas se cuentan antes y despues
// y tienen que salir las mismas.
// ══════════════════════════════════════════════════════════════════════════

import { generateKeyPairSync, sign as firmarCon } from "node:crypto";
import { readFileSync } from "node:fs";

const FUENTE = readFileSync(new URL("./supabase-cliente.js", import.meta.url), "utf8");
const BASE = /const URL_BASE = "([^"]+)"/.exec(FUENTE)[1];
const ANON = /const ANON = "([^"]+)"/.exec(FUENTE)[1];
const FN   = BASE + "/functions/v1/auth";
const REST = BASE + "/rest/v1";

const ALFA = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58(buf) {
  const d = [];
  for (const b of buf) {
    let c = b;
    for (let i = 0; i < d.length; i++) { c += d[i] << 8; d[i] = c % 58; c = (c / 58) | 0; }
    while (c) { d.push(c % 58); c = (c / 58) | 0; }
  }
  let out = "";
  for (const b of buf) { if (b === 0) out += "1"; else break; }
  return out + d.reverse().map((x) => ALFA[x]).join("");
}

function walletNueva() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return { dir: b58(publicKey.export({ type: "spki", format: "der" }).subarray(-32)),
           priv: privateKey };
}

async function pedir(cuerpo) {
  const r = await fetch(FN, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON, Authorization: "Bearer " + ANON },
    body: JSON.stringify(cuerpo),
  });
  let j = {}; try { j = await r.json(); } catch {}
  return { s: r.status, j };
}

async function rest(ruta, opciones = {}) {
  const r = await fetch(REST + ruta, {
    headers: { "Content-Type": "application/json", apikey: ANON, Authorization: "Bearer " + ANON },
    ...opciones,
  });
  let j = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
}

const fallos = [], quinientos = [];
function probar(nombre, funciona, detalle) {
  console.log(`${funciona ? "  x AGUANTA MAL" : "  ok"}  ${nombre}${detalle ? "  ·  " + detalle : ""}`);
  if (funciona) fallos.push(nombre + (detalle ? " — " + detalle : ""));
}

/* Una sesion de verdad: nonce, firma ed25519 y verify. Es exactamente lo que
   hace un jugador con Phantom, sin Phantom. */
async function sesionReal() {
  const w = walletNueva();
  const n = await pedir({ accion: "nonce", address: w.dir });
  if (!n.j.nonce) return { ...w, token: null, motivo: `nonce respondio ${n.s}` };
  const msg = [
    "solbrute.io wants you to sign in with your Solana account:", w.dir, "",
    "Sign in to SolBrute. This is free and moves no funds.", "",
    "URI: https://solbrute.io", "Version: 1", "Chain ID: mainnet",
    "Nonce: " + n.j.nonce, "Issued At: " + new Date().toISOString(),
  ].join("\n");
  const firma = b58(firmarCon(null, Buffer.from(msg, "utf8"), w.priv));
  const v = await pedir({ accion: "verify", address: w.dir, message: msg, signature: firma });
  return { ...w, token: v.j.token || null, admin: !!v.j.admin, motivo: `verify ${v.s}` };
}

console.log("\nAtacando el blog en " + BASE + "\n");

/* Las entradas ANTES. Al final tienen que ser las mismas: un ataque que
   "responde 401" pero deja una fila escrita no ha aguantado nada. */
const antes = (await rest("/blog_posts?select=id")).j || [];
console.log(`  hay ${antes.length} entradas publicadas\n`);

const VICTIMA = antes[0]?.id;

// ── 1 · sin sesion ────────────────────────────────────────────────────────
for (const accion of ["admin_blog_listar", "admin_blog_guardar", "admin_blog_borrar"]) {
  const r = await pedir({ accion, campos: { id: "pirata", fecha: "2026-01-01", tag: "contenido",
                                            es: { titulo: "Colada" } }, id: VICTIMA });
  if (r.s >= 500) quinientos.push(accion + " sin token");
  probar(`${accion} sin token`, r.s === 200, `respondio ${r.s}`);
}

// ── 2 · token inventado ───────────────────────────────────────────────────
{
  const r = await pedir({ accion: "admin_blog_listar", token: "x".repeat(43) });
  probar("token inventado", r.s === 200, `respondio ${r.s}`);
}

// ── 3 · LA IMPORTANTE: una sesion legitima que no es de admin ─────────────
/* Un jugador cualquiera. La firma cuadra criptograficamente y el servidor le
   ha abierto sesion: es un usuario de verdad. Lo unico que le separa del panel
   es no estar en ADMIN_WALLETS, y eso se comprueba en el SERVIDOR — esconder
   la pestaña en el navegador no protegeria nada. */
const jug = await sesionReal();
if (!jug.token) {
  console.log(`  !! no he podido abrir sesion (${jug.motivo}); los ataques 3 no prueban nada`);
  fallos.push("no se pudo crear la sesion de prueba: el ataque 3 no se ejecuto");
} else {
  console.log(`  (sesion legitima abierta, admin=${jug.admin})`);
  for (const [accion, extra] of [
    ["admin_blog_listar", {}],
    ["admin_blog_guardar", { campos: { id: "colada-por-jugador", fecha: "2026-01-01",
                                       tag: "contenido", es: { titulo: "No deberia existir" } } }],
    ["admin_blog_borrar", { id: VICTIMA }],
  ]) {
    const r = await pedir({ accion, token: jug.token, ...extra });
    if (r.s >= 500) quinientos.push(accion + " con sesion de jugador");
    probar(`${accion} con una sesion legitima que NO es admin`, r.s === 200, `respondio ${r.s}`);
  }
}

// ── 4 · las funciones de Postgres con la clave publica ────────────────────
for (const [fn, args] of [
  ["blog_guardar", { p_admin: "yo", p_id: "pirata", p_fecha: "2026-01-01", p_tag: "contenido",
                     p_look: {}, p_es: { titulo: "h" }, p_en: null, p_fr: null }],
  ["blog_borrar", { p_admin: "yo", p_id: VICTIMA }],
]) {
  const r = await rest("/rpc/" + fn, { method: "POST", body: JSON.stringify(args) });
  probar(`${fn} con la clave anon`, r.j?.code !== "42501", `code ${r.j?.code ?? r.s}`);
}

// ── 5 · escribir en la tabla a pelo ───────────────────────────────────────
/* Aqui esta la trampa que este proyecto documenta dos veces: RLS no da error,
   hace las filas invisibles. Un DELETE devuelve 204 aunque no borre nada. Por
   eso el veredicto se da CONTANDO LAS FILAS despues, no por el codigo. */
await rest("/blog_posts", { method: "POST",
  body: JSON.stringify({ id: "pirata-directo", fecha: "2026-01-01", tag: "contenido",
                         es: { titulo: "Colada" } }) });
await rest("/blog_posts?id=eq." + encodeURIComponent(VICTIMA || "x"), { method: "DELETE" });
await rest("/blog_posts?id=eq." + encodeURIComponent(VICTIMA || "x"), { method: "PATCH",
  body: JSON.stringify({ es: { titulo: "Pisado" } }) });

const despues = (await rest("/blog_posts?select=id,es")).j || [];
probar("POST/DELETE/PATCH directos a la tabla",
       despues.length !== antes.length || despues.some((e) => e.id === "pirata-directo"),
       `${antes.length} entradas antes, ${despues.length} despues`);

const victima = despues.find((e) => e.id === VICTIMA);
probar("pisar el titulo de una entrada con un PATCH",
       !!victima && victima.es?.titulo === "Pisado",
       victima ? `sigue siendo "${String(victima.es?.titulo).slice(0, 34)}"` : "no existe");

// ── 6 · leer SI se puede, y es correcto ───────────────────────────────────
probar("leer las entradas sin sesion (tiene que PODERSE)",
       despues.length === 0, `${despues.length} entradas visibles, como debe ser`);

console.log("\n══════ RESULTADO ══════");
if (quinientos.length) {
  console.log(`${quinientos.length} respuestas 500 (el servidor cayendose):`);
  quinientos.forEach((q) => console.log("  · " + q));
}
if (!fallos.length && !quinientos.length) console.log("Ningun ataque al blog funciona.");
else { fallos.forEach((f, i) => console.log(`${i + 1}. ${f}`)); process.exit(1); }
