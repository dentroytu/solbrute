/* ══════════════════════════════════════════════════════════════════════════
   SolBrute · simulador de mascotas
   ══════════════════════════════════════════════════════════════════════════
   Herramienta, no parte del juego:   node prueba-mascotas.mjs [combates]

   El CLAUDE.md pedía medir ANTES de construirlas —«dos contra dos alarga las
   peleas, y ya se vio lo rápido que eso se descontrola»— y tenía razón: el
   primer diseño, con mordisco fuerte y mucha cobertura, daba 73-82% de
   victorias y +25% de duración. Comprar mascota era comprar el combate.

   ── Por qué este fichero ya no copia el combate ───────────────────────────
   Durante dos versiones esto reimplementaba el bucle de `simulate()` para
   poder meterle la mascota, con una validación al arrancar que comprobaba que
   sin mascota diera lo mismo que el original. Funcionaba, pero era una copia
   que había que mantener a mano — y se rompió en cuanto la mascota tuvo turno
   propio: la copia medía el juego viejo y no avisaba de nada, porque sin
   mascota los dos seguían dando idéntico.

   Ya no hace falta. `simulate()` lee la mascota del propio bruto y devuelve
   `cayoA` y `murioA`, así que aquí se le llama TAL CUAL y lo único que se toca
   es la tabla `MASCOTAS` en memoria. Cero copias que mantener, y lo que se
   mide es exactamente lo que le va a pasar al jugador.

   ── Lo que hay que mirar ──────────────────────────────────────────────────
   · gana        contra quien no lleva. ~57% es lo buscado: una ventaja real,
                 no una compra de victorias.
   · cae         cada cuántas peleas se queda sin vida. Tiene que ser FRECUENTE
                 —cada 5-6— para que el jugador la vea caer y entienda que es
                 frágil. Caer no cuesta nada.
   · muere       cada cuántas la pierde para siempre. Ese es el sumidero.
   · mon/combate lo que cuesta mantenerla. Las armas están en ~3.
   · actúa       veces por combate que muerde o falla. Si baja de ~5 la mascota
                 vuelve a ser invisible, y da igual lo bien medida que esté.
   · mediana     la duración NO puede crecer. Es lo primero que se descontrola.
   ══════════════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";
new Function(readFileSync(new URL("./brute-combate.js", import.meta.url), "utf8"))();
const C = globalThis.BruteCombate;

const N = Number(process.argv[2] || 25000);

/* N combates de un bruto CON la mascota `id` contra otro que lleva `rival`.
   Los dos salen de `botStats(nivel)`, que es la misma curva que un jugador. */
function medir(id, rival = "ninguna", n = N){
  let gana = 0, cae = 0, muere = 0, actua = 0;
  const turnos = [];
  for(let i = 0; i < n; i++){
    const lv = 1 + (i % 20);
    const a = { ...C.botStats(lv), name:"A", arma:"ninguna", mascota:id };
    const b = { ...C.botStats(lv), name:"B", arma:"ninguna", mascota:rival };
    const r = C.simulate(a, b, i * 7919);
    if(r.winner === "A") gana++;
    if(r.cayoA)  cae++;
    if(r.murioA) muere++;
    /* `side` es el del que RECIBE, asi que los pasos de la mascota de A son
       los que apuntan a B. */
    for(const e of r.log)
      if(e.side === "B" && (e.type === "muerde" || e.type === "mascota_falla")) actua++;
    turnos.push(r.turns);
  }
  turnos.sort((x, y) => x - y);
  return {
    gana:  gana / n * 100,
    cae:   cae   ? n / cae   : Infinity,
    muere: muere ? n / muere : Infinity,
    actua: actua / n,
    med:   turnos[n >> 1],
    p95:   turnos[Math.floor(n * 0.95)],
  };
}

const base = medir("ninguna");
console.log(`\n  ── sin mascota ──  gana ${base.gana.toFixed(1)}%  ·  mediana ${base.med}  p95 ${base.p95}\n`);

console.log("  ── contra quien NO lleva ──");
for(const id of C.MASCOTAS_REALES){
  const m = C.MASCOTAS[id], r = medir(id);
  const d = r.gana - base.gana;
  console.log(
    `  ${id.padEnd(6)} gana ${r.gana.toFixed(1)}% (${d >= 0 ? "+" : ""}${d.toFixed(1)})` +
    `  ·  cae cada ${r.cae.toFixed(1)}  ·  muere cada ${r.muere.toFixed(1)}` +
    `  ·  ${(m.precio / r.muere).toFixed(1)} mon/combate  ·  actua ${r.actua.toFixed(1)}x` +
    `  ·  med ${r.med} p95 ${r.p95}`);
}

console.log("\n  ── entre ellas ──");
const R = C.MASCOTAS_REALES;
for(const x of R){
  const fila = R.map(y => x === y ? "  —  " : medir(x, y, Math.min(N, 12000)).gana.toFixed(1).padStart(5));
  console.log(`  ${x.padEnd(6)} ${fila.join("  ")}`);
}
console.log(`         ${R.map(k => k.padStart(5)).join("  ")}`);

console.log("\n  ── duracion con las DOS partes llevando ──");
console.log("  (dos contra dos alarga las peleas: es lo primero que se rompe)");
for(const id of R){
  const r = medir(id, id, Math.min(N, 12000));
  const aviso = (r.med > base.med + 1 || r.p95 > base.p95 + 2) ? "   <<< SE ALARGA" : "";
  console.log(`  ambos ${id.padEnd(6)} mediana ${r.med} (base ${base.med})  ·  p95 ${r.p95} (base ${base.p95})${aviso}`);
}
console.log();
