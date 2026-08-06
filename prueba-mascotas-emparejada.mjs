/* ══════════════════════════════════════════════════════════════════════════
   SolBrute · las mascotas, medidas EMPAREJADO
   ══════════════════════════════════════════════════════════════════════════
   Los mismos dos brutos y la misma semilla, una vez con mascota y otra sin
   ella. Casi toda la varianza viene de la tirada de atributos —un bruto con 8
   de fuerza gana lleve perro o no— y emparejando se cancela: el margen pasa de
   +-1,6 puntos a +-0,34 con el mismo numero de combates.

   Sin esto no se puede afinar. Al recalibrar contra las diecisiete armas, el
   primer calibrador daba +6,1 y +7,9 para EL MISMO valor y se creia los dos:
   estaba persiguiendo ruido con un objetivo de 0,3.

   Es el complemento de `prueba-mascotas.mjs`, no su sustituto: aquella mide a
   puño limpio y enseña el cuadro completo (duracion, unas contra otras); esta
   mide el entorno de verdad, con armas, y da un numero en el que se puede
   confiar.

       node prueba-mascotas-emparejada.mjs

   Si tocas la tabla MASCOTAS, pasa las dos.
   ══════════════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";
globalThis.window = globalThis;
new Function(readFileSync("brute-combate.js", "utf8"))();
const C = globalThis.BruteCombate;

/* `armado` decide el ENTORNO. prueba-mascotas.mjs mide a puño limpio; el juego
   de verdad tiene diecisiete armas, y ese es el entorno que importa. */
function ventaja(id, n, armado) {
  let d = 0, d2 = 0, cae = 0, muere = 0;
  const w = () => armado ? C.ARMAS_REALES[(Math.random() * C.ARMAS_REALES.length) | 0] : "ninguna";
  for (let i = 0; i < n; i++) {
    const lv = 1 + (i % 20);
    const a = { ...C.botStats(lv), name: "A", arma: w(), mascota: id };
    const b = { ...C.botStats(lv), name: "B", arma: w(), mascota: "ninguna" };
    const seed = (Math.random() * 4294967296) >>> 0;
    const con = C.simulate({ ...a }, { ...b }, seed);
    const sin = C.simulate({ ...a, mascota: "ninguna" }, { ...b }, seed);
    const x = (con.winner === "A" ? 1 : 0) - (sin.winner === "A" ? 1 : 0);
    d += x; d2 += x * x;
    if (con.cayoA) cae++;
    if (con.murioA) muere++;
  }
  const m = d / n, sd = Math.sqrt(Math.max(0, d2 / n - m * m));
  return { v: m * 100, err: 1.96 * sd / Math.sqrt(n) * 100,
           cae: n / Math.max(1, cae), muere: n / Math.max(1, muere) };
}

for (const [nom, armado] of [["a puño limpio (como prueba-mascotas.mjs)", false],
                             ["con las 17 armas (el juego de verdad)", true]]) {
  console.log(`\n  ── ${nom} ──`);
  for (const id of ["perro", "lobo", "oso"]) {
    const r = ventaja(id, 80000, armado);
    const p = C.MASCOTAS[id];
    console.log(`  ${id.padEnd(6)} ventaja ${r.v >= 0 ? "+" : ""}${r.v.toFixed(2)} ±${r.err.toFixed(2)}` +
      `  ·  cae cada ${r.cae.toFixed(1)}  ·  muere cada ${r.muere.toFixed(0)}` +
      `  ·  coste ${(p.precio / r.muere).toFixed(2)}/combate`);
  }
}
