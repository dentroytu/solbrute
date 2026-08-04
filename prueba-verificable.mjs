// ══════════════════════════════════════════════════════════════════════════
// SolBrute · que la verificacion de una pelea sirva para algo
// ══════════════════════════════════════════════════════════════════════════
//
//   node prueba-verificable.mjs
//
// `pelea.html` recalcula el combate en el navegador de quien mira y dice si
// cuadra. Eso solo vale si la comprobacion DETECTA una mentira — un
// verificador que aprueba todo es peor que ninguno, porque da confianza
// falsa.
//
// Asi que aqui se fabrican peleas honestas y peleas manipuladas, y se exige
// que las primeras pasen y las segundas no.
//
// ── Y ademas: que la pagina nombre todos los eventos ─────────────────────
// La comprobacion barata que ya destapo dos fallos en este proyecto: enumerar
// los tipos que produce `simulate()` y exigir que `pelea.html` los nombre
// todos. Un evento sin dibujar es un hueco; uno dibujado como otra cosa es una
// mentira. La primera version de la pagina buscaba `mascota` cuando el tipo se
// llama `muerde`, asi que los mordiscos se tiraban en silencio.
//
// Si añades un evento al combate, esta prueba te obliga a nombrarlo.
// ══════════════════════════════════════════════════════════════════════════

import { readFileSync } from "node:fs";
import "./brute-combate.js";

const C = globalThis.BruteCombate;
const PAGINA = readFileSync(new URL("./pelea.html", import.meta.url), "utf8");

/* La MISMA logica que `verificar()` en pelea.html. Se repite aqui a proposito:
   si algun dia se separan, esta prueba deja de medir lo que cree medir — y por
   eso el ultimo bloque comprueba que el codigo de la pagina sigue diciendo lo
   mismo que esto. */
/* Postgres guarda el registro como `jsonb` y jsonb NO conserva el orden de las
   claves. Sin ordenarlas antes de comparar, toda pelea honesta sale «no
   cuadra» — y esta prueba no lo veia porque fabricaba las peleas en memoria,
   sin pasar por la base. Se veia en la pantalla, con una pelea de verdad. */
function canonico(v) {
  if (Array.isArray(v)) return v.map(canonico);
  if (v && typeof v === "object") {
    const o = {};
    for (const k of Object.keys(v).sort()) o[k] = canonico(v[k]);
    return o;
  }
  return v;
}
const mismoLog = (a, b) => JSON.stringify(canonico(a)) === JSON.stringify(canonico(b));

function verificar(f) {
  if (!f.a_snapshot) return "antigua";
  const mio = JSON.parse(JSON.stringify(f.a_snapshot));
  const foe = JSON.parse(JSON.stringify(f.b_snapshot));
  const calc = C.simulate(mio, foe, Number(f.seed));
  const mismo = mismoLog(calc.log, f.log);
  return (mismo && calc.winner === f.winner && calc.turns === f.turns) ? "cuadra" : "no_cuadra";
}

/* Lo que le hace `jsonb` a un objeto: te lo devuelve con las claves en otro
   orden. Se imita barajandolas. */
const barajarClaves = (v) => {
  if (Array.isArray(v)) return v.map(barajarClaves);
  if (v && typeof v === "object") {
    const ks = Object.keys(v).sort((a, b) => (a.length - b.length) || a.localeCompare(b));
    const o = {};
    for (const k of ks) o[k] = barajarClaves(v[k]);
    return o;
  }
  return v;
};

const A = { name:"Galba", lv:7, xp:0, hpMax:66, str:5, agi:3, spd:4, w:3, l:1,
            arma:"daga", mascota:"lobo", look:{ sex:0, skin:2, hair:2, hairC:3,
            cloth:3, clothC:3, face:0, eyeC:2, tat:1, tatC:0 } };
const B = { name:"Rufus", lv:7, xp:0, hpMax:70, str:4, agi:5, spd:3, w:2, l:2,
            arma:"lanza", mascota:"oso", look:{ sex:1, skin:1, hair:1, hairC:5,
            cloth:2, clothC:2, face:3, eyeC:0, tat:0, tatC:0 } };

/* `simulate()` MUTA lo que recibe, asi que cada pelea parte de copias. */
const hacer = (seed) => {
  const f = C.simulate({ ...A }, { ...B }, seed);
  return { seed, a_snapshot:{ ...A }, b_snapshot:{ ...B },
           log:f.log, winner:f.winner, turns:f.turns };
};

let bien = 0, mal = 0;
const P = (n, v, esp) => {
  const ok = v === esp;
  console.log(`  ${ok ? "✓" : "✗"} ${n.padEnd(46)} ${v}${ok ? "" : "   ← esperaba " + esp}`);
  ok ? bien++ : mal++;
};

console.log("\n¿Sirve de algo la verificacion?\n");

// ── 1 · lo honesto pasa, y no por casualidad ──────────────────────────────
{
  let todas = true;
  for (let s = 1; s <= 200; s++) if (verificar(hacer(s * 7919)) !== "cuadra") todas = false;
  P("200 peleas honestas, todas cuadran", todas ? "cuadra" : "alguna falla", "cuadra");
}

// ── 2 · verificar dos veces da lo mismo ───────────────────────────────────
/* Si `simulate()` mutara los snapshots guardados, la segunda pasada daria otra
   cosa. Es el motivo de la copia profunda. */
{
  const f = hacer(4242);
  const a = verificar(f), b = verificar(f), c = verificar(f);
  P("verificar tres veces da lo mismo", `${a}/${b}/${c}`, "cuadra/cuadra/cuadra");
}

// ── 2b · pasar por `jsonb` no puede romper la verificacion ────────────────
/* El fallo que esto existe para no repetir: la pagina daba «no cuadra» en una
   pelea perfectamente honesta, solo porque Postgres devuelve las claves en otro
   orden. Un verificador que hace que la verdad parezca mentira es peor que uno
   que no existe: cuando de verdad falle algo, nadie se lo creera. */
{
  const f = hacer(777);
  const comoPostgres = { ...f, log: barajarClaves(f.log),
                         a_snapshot: barajarClaves(f.a_snapshot),
                         b_snapshot: barajarClaves(f.b_snapshot) };
  P("el registro con las claves reordenadas por jsonb", verificar(comoPostgres), "cuadra");
  /* Y que el orden de los EVENTOS siga importando: ahi no se ordena nada. */
  const alReves = { ...f, log: f.log.slice().reverse() };
  P("pero los eventos en otro orden si cuentan", verificar(alReves), "no_cuadra");
}

// ── 3 · las mentiras que un servidor podria contar ────────────────────────
{ const f = hacer(12345); f.winner = f.winner === "A" ? "B" : "A";
  P("el ganador, cambiado", verificar(f), "no_cuadra"); }

{ const f = hacer(12345); f.turns += 3;
  P("los turnos inflados (deciden las monedas)", verificar(f), "no_cuadra"); }

{ const f = hacer(12345); f.log.splice(2, 1);
  P("un evento borrado del registro", verificar(f), "no_cuadra"); }

{ const f = hacer(12345); const i = f.log.findIndex(e => e.dmg != null); f.log[i].dmg += 1;
  P("un solo golpe retocado en 1 de daño", verificar(f), "no_cuadra"); }

{ const f = hacer(12345); f.log.push({ turn:99, type:"hit", att:"Galba", def:"Rufus", dmg:9 });
  P("un evento inventado al final", verificar(f), "no_cuadra"); }

{ const f = hacer(12345); f.seed = 999;
  P("la semilla, cambiada", verificar(f), "no_cuadra"); }

// ── 4 · las mentiras que un JUGADOR podria contar ─────────────────────────
{ const f = hacer(12345); f.a_snapshot.str = 10;
  P("atributos inflados en el snapshot propio", verificar(f), "no_cuadra"); }

{ const f = hacer(12345); f.b_snapshot.hpMax = 1;
  P("el rival debilitado en su snapshot", verificar(f), "no_cuadra"); }

// ── 5 · lo que no se puede comprobar, y se dice ───────────────────────────
{ const f = hacer(12345); delete f.a_snapshot;
  P("pelea antigua, sin snapshot propio", verificar(f), "antigua"); }

// ── 6 · la pagina nombra todos los eventos ────────────────────────────────
/* Con los dos llevando arma y mascota salen los nueve tipos. */
{
  const tipos = new Set();
  for (let i = 0; i < 3000; i++)
    for (const e of C.simulate({ ...A }, { ...B }, i * 104729).log) tipos.add(e.type);

  const nombrados = new Set([...PAGINA.matchAll(/case "(\w+)":/g)].map((m) => m[1]));
  const faltan = [...tipos].filter((t) => !nombrados.has(t));
  const sobran = [...nombrados].filter((t) => !tipos.has(t));

  P(`pelea.html nombra los ${tipos.size} tipos de evento`,
    faltan.length ? "faltan: " + faltan.join(",") : "todos", "todos");
  /* Los que sobran no rompen nada, pero casi siempre son un nombre viejo que
     se quedo ahi — como `mascota` cuando el tipo pasó a llamarse `muerde`. */
  P("y ninguno que ya no exista",
    sobran.length ? "sobran: " + sobran.join(",") : "ninguno", "ninguno");
}

// ── 7 · la pagina no se ha separado de esta prueba ────────────────────────
/* Si `verificar()` de la pagina dejara de comparar el registro entero y solo
   mirara el ganador, todo lo de arriba seguiria en verde midiendo otra cosa. */
{
  const trozo = /function verificar\(f\)\{?[\s\S]*?\n  \}/.exec(PAGINA.replace(/\s+/g, " ")) ||
                /function verificar\(f\)[\s\S]*?^  \}/m.exec(PAGINA);
  const src = trozo ? trozo[0] : "";
  const compara = /mismoLog\(calc\.log,\s*f\.log\)/.test(src);
  const turnos  = /calc\.turns\s*===\s*f\.turns/.test(src);
  const gana    = /calc\.winner\s*===\s*f\.winner/.test(src);
  const copia   = /JSON\.parse\(JSON\.stringify\(f\.a_snapshot\)\)/.test(src);
  P("pelea.html compara el registro entero", compara ? "si" : "NO", "si");
  P("pelea.html compara turnos y ganador", (turnos && gana) ? "si" : "NO", "si");
  P("pelea.html copia antes de simular", copia ? "si" : "NO", "si");
}

console.log(`\n  ${bien} bien, ${mal} mal`);
console.log(mal ? "\n  La verificacion NO es de fiar.\n"
                : "\n  Una pelea manipulada no pasa la verificacion.\n");
process.exit(mal ? 1 : 0);
