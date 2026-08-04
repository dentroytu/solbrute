// ══════════════════════════════════════════════════════════════════════════
// SolBrute · copia de seguridad de la base
// ══════════════════════════════════════════════════════════════════════════
//
//   export SUPABASE_SERVICE_KEY='...'      (Supabase → Settings → API)
//   node respaldo.mjs                       guarda una copia
//   node respaldo.mjs --ver respaldos/…     comprueba una copia guardada
//
// ── Por que existe ────────────────────────────────────────────────────────
// Hasta hoy no habia ninguna. Un `delete` mal escrito en el SQL Editor se
// llevaba los brutos de todo el mundo y no habia vuelta atras.
//
// Mientras un saldo es un numero de juguete, eso es una molestia. El dia que
// cada moneda sea un derecho a cobrar tokens reales, pasa a ser dinero de otra
// gente — y entonces «se me borro» no es una explicacion aceptable.
//
// ── Lo que esto NO es ─────────────────────────────────────────────────────
// No sustituye a las copias de Supabase. Es una copia PROPIA, que vive en tu
// disco y no depende de que tu cuenta de Supabase siga existiendo, ni de que
// sigas pagando, ni de que no borren el proyecto por error. Una copia que vive
// dentro del mismo sitio que protege no es una copia.
//
// ── Una copia que nadie ha restaurado no es una copia ─────────────────────
// Por eso `--ver` existe y por eso el fichero guarda el numero de filas de cada
// tabla. Un JSON truncado a la mitad se abre igual de bien que uno entero: sin
// una cuenta que cuadre, no hay forma de saber que esta completo.
//
// ── La clave ──────────────────────────────────────────────────────────────
// `service_role` se salta RLS, que es justo lo que hace falta para leer
// `withdrawals`, `movimientos` y `admin_log`. Con la clave `anon` esas tablas
// devuelven `200 []` SIEMPRE, y una copia vacia que parece correcta es peor que
// no tener copia.
//
// La clave se lee del entorno y NO se escribe en ningun sitio. El fichero de
// respaldo tampoco va al repositorio: lleva direcciones y saldos de gente.
// ══════════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const FUENTE = readFileSync(new URL("./supabase-cliente.js", import.meta.url), "utf8");
const BASE = /const URL_BASE = "([^"]+)"/.exec(FUENTE)[1];
const REST = BASE + "/rest/v1";

/* Todo lo que es DATOS. Se quedan fuera `sessions` y `auth_nonces`: caducan
   solos y restaurarlos seria devolver a la vida sesiones ya cerradas. */
const TABLAS = [
  "players", "brutes", "fights",
  "economia", "emision", "movimientos", "withdrawals", "perdidas",
  "preventa", "preventa_compras", "preventa_reclamos",
  "tournaments", "tournament_entries", "tournament_fights",
  "admin_log",
];

const CLAVE = process.env.SUPABASE_SERVICE_KEY || "";
const DIR = new URL("./respaldos/", import.meta.url);

// ══════════════════════════════════════════════════════════════════════════
// COMPROBAR una copia ya guardada
// ══════════════════════════════════════════════════════════════════════════
if (process.argv[2] === "--ver") {
  const ruta = process.argv[3];
  if (!ruta) { console.log("  falta el fichero: node respaldo.mjs --ver respaldos/…"); process.exit(1); }

  let c;
  try { c = JSON.parse(readFileSync(ruta, "utf8")); }
  catch (e) { console.log("  ✗ no se puede leer: " + e.message); process.exit(1); }

  console.log(`\nCopia del ${c.fecha}  ·  ${c.origen}\n`);
  let mal = 0;
  for (const t of TABLAS) {
    const filas = c.tablas[t];
    const dichas = c.cuentas[t];
    if (filas === undefined) { console.log(`  ✗ ${t}: no esta en la copia`); mal++; continue; }
    const ok = filas.length === dichas;
    if (!ok) mal++;
    console.log(`  ${ok ? "✓" : "✗"} ${t.padEnd(20)} ${String(filas.length).padStart(7)} filas` +
                (ok ? "" : `  ← decia ${dichas}`));
  }

  /* La invariante de la economia. Si no cuadra en la copia es que la copia se
     hizo a medias, o que ya no cuadraba en la base — y las dos cosas hay que
     saberlas antes de necesitar restaurar. */
  for (const t of ["economia", "preventa"]) {
    if (c.cuentas[t] === 0) { console.log(`  ✗ ${t} trae 0 filas y deberia traer 1`); mal++; }
  }

  const e = c.tablas.economia?.[0];
  if (e) {
    const circ = (c.tablas.players || []).reduce((a, p) => a + Number(p.coins || 0), 0);
    const suma = circ + Number(e.reserva_restante) + (Number(e.reserva_seguridad) - 5_000_000);
    const cuadra = suma === Number(e.reserva_total);
    if (!cuadra) mal++;
    console.log(`\n  ${cuadra ? "✓" : "✗"} circulacion ${circ} + reserva ${e.reserva_restante} ` +
                `+ fondo extra ${Number(e.reserva_seguridad) - 5_000_000} = ${suma}` +
                (cuadra ? "" : `  ← deberia dar ${e.reserva_total}`));
  }

  console.log(mal ? `\n  ${mal} problema(s). Esta copia NO sirve para restaurar.\n`
                  : "\n  La copia esta completa y cuadra.\n");
  process.exit(mal ? 1 : 0);
}

// ══════════════════════════════════════════════════════════════════════════
// GUARDAR
// ══════════════════════════════════════════════════════════════════════════
if (!CLAVE) {
  console.log(`
  Falta la clave. Supabase → Project Settings → API → "service_role".

    export SUPABASE_SERVICE_KEY='eyJ…'
    node respaldo.mjs

  Tiene que ser la de service_role, no la anon: con anon, las tablas con RLS y
  cero politicas —withdrawals, movimientos, admin_log— devuelven [] siempre, y
  la copia saldria vacia PARECIENDO correcta.
`);
  process.exit(1);
}

/* ── Que la clave sea la que tiene que ser ────────────────────────────────
   Esto lo encontro el propio script al probarlo: con la clave `anon` copiaba
   sin un solo error y sacaba ✓ en las quince tablas. `movimientos`,
   `withdrawals`, `preventa_compras` y `admin_log` salian con cero filas —
   porque RLS las hace invisibles, no porque estuvieran vacias.

   Una copia inutil que parece perfecta es peor que ninguna: te enteras el dia
   que vas a restaurar. Asi que se mira el `role` de dentro del token, que va en
   claro y no hace falta verificarlo para leerlo. */
/* Supabase tiene dos formatos de clave y hay que aceptar los dos:

     antiguo   un JWT con `role` dentro, en claro     eyJ…
     nuevo     una cadena opaca con el tipo delante   sb_secret_… / sb_publishable_…

   La opaca no lleva nada que leer, asi que ahi lo unico que se puede mirar es
   el prefijo. Basta: lo que se quiere evitar es usar la publica por descuido. */
function rolDe(clave) {
  if (clave.startsWith("sb_secret_")) return "service_role";
  if (clave.startsWith("sb_publishable_")) return "anon";
  try {
    const p = clave.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(Buffer.from(p, "base64").toString("utf8")).role || "?";
  } catch { return "?"; }
}
const ROL = rolDe(CLAVE);
if (ROL !== "service_role") {
  console.log(`
  Esa clave es "${ROL}", no "service_role". Busca la que pone service_role
  (o "Secret key", si tu panel usa el formato sb_secret_…).

  Con ella, las tablas con RLS y cero politicas —movimientos, withdrawals,
  preventa_compras, admin_log— devuelven [] y la copia saldria vacia
  PARECIENDO correcta. No es un aviso teorico: paso al probar esto.

  Supabase → Project Settings → API → service_role.
`);
  process.exit(1);
}

/* PostgREST devuelve 1000 filas por defecto. `fights` pasa de eso enseguida, y
   una copia truncada en silencio es exactamente el fallo que este script
   existe para no tener. */
async function traer(tabla) {
  const filas = [];
  const PASO = 1000;
  for (let desde = 0; ; desde += PASO) {
    const r = await fetch(`${REST}/${tabla}?select=*&order=id.asc&limit=${PASO}&offset=${desde}`, {
      headers: { apikey: CLAVE, Authorization: "Bearer " + CLAVE },
    });
    if (!r.ok) {
      /* `economia` y `preventa` tienen `id` de una sola fila; alguna tabla
         podria no tener `id`. Se reintenta sin ordenar antes de rendirse. */
      if (desde === 0) {
        const r2 = await fetch(`${REST}/${tabla}?select=*`, {
          headers: { apikey: CLAVE, Authorization: "Bearer " + CLAVE },
        });
        if (r2.ok) return await r2.json();
      }
      throw new Error(`${tabla}: ${r.status} ${(await r.text()).slice(0, 120)}`);
    }
    const lote = await r.json();
    filas.push(...lote);
    if (lote.length < PASO) return filas;
  }
}

const copia = { fecha: new Date().toISOString(), origen: BASE, tablas: {}, cuentas: {} };
let fallos = 0;

console.log("\nCopiando " + BASE + "\n");
for (const t of TABLAS) {
  try {
    const filas = await traer(t);
    copia.tablas[t] = filas;
    copia.cuentas[t] = filas.length;
    console.log(`  ✓ ${t.padEnd(20)} ${String(filas.length).padStart(7)} filas`);
  } catch (e) {
    /* Una tabla que no existe todavia no es un fallo: los pasos del SQL se
       aplican en orden y puede que este por aplicar. Se apunta y se sigue. */
    console.log(`  · ${t.padEnd(20)} ${e.message.slice(0, 70)}`);
    copia.cuentas[t] = null;
    fallos++;
  }
}

/* Segundo cinturon, por si algun dia hay otra forma de leer de menos:
   `economia` y `preventa` las crea el SQL con una fila fija cada una. Si vienen
   vacias, no es que no haya datos — es que no se estan viendo. */
for (const t of ["economia", "preventa"]) {
  if (copia.cuentas[t] === 0) {
    console.log(`\n  ✗ ${t} deberia tener 1 fila y trae 0. No se estan leyendo los datos.`);
    console.log("    La copia NO se guarda.\n");
    process.exit(1);
  }
}

if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
const nombre = "solbrute-" + copia.fecha.replace(/[:.]/g, "-") + ".json";
const ruta = new URL(nombre, DIR);
writeFileSync(ruta, JSON.stringify(copia, null, 1));

const kb = (readFileSync(ruta).length / 1024).toFixed(0);
console.log(`\n  respaldos/${nombre}  (${kb} KB)`);
console.log(`\n  Compruebala:  node respaldo.mjs --ver respaldos/${nombre}`);
console.log(fallos ? `\n  ${fallos} tabla(s) no se pudieron leer.\n` : "\n");
