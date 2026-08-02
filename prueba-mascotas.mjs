/* ══════════════════════════════════════════════════════════════════════════
   SolBrute · simulador de mascotas
   ══════════════════════════════════════════════════════════════════════════
   Herramienta, no parte del juego:   node prueba-mascotas.mjs

   El CLAUDE.md pedía medir ANTES de construirlas —«dos contra dos alarga las
   peleas, y ya se vio lo rápido que eso se descontrola»— y tenía razón: el
   primer diseño, el de la idea original con mordisco fuerte y mucha cobertura,
   daba 73-82% de victorias y +25% de duración. Comprar mascota era comprar el
   combate.

   ── Lo que hace que estos números valgan algo ─────────────────────────────
   Este fichero NO reimplementa el combate a ojo: copia el bucle de
   `simulate()` y le añade la mascota. Y antes de medir nada comprueba que, sin
   mascota, da EXACTAMENTE lo mismo que el original en 5.000 peleas.

   El primer intento sí lo reimplementó por libre y daba mediana 25 turnos
   cuando el juego tiene 8. Si esa validación falla, el programa se para: unos
   números bonitos derivados mal son peores que no tener números.
   ══════════════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";
new Function(readFileSync(new URL("./brute-combate.js", import.meta.url), "utf8"))();
const C = globalThis.BruteCombate;
const PUNOS = C.ARMAS.ninguna, TOPE = C.TOPE_TURNOS, arma = C.arma;
const M = C.MASCOTAS;

function sim(a, b, seed, pA, pB){
  const rnd = C.mulberry32(seed);
  const mk = k => (M[k] && M[k].hp > 0) ? { ...M[k], viva:true } : null;
  const F = {
    A:{ ...a, hp:a.hpMax, w:arma(a.arma), sinArma:false, m:mk(pA) },
    B:{ ...b, hp:b.hpMax, w:arma(b.arma), sinArma:false, m:mk(pB) },
  };
  const iA = F.A.spd + F.A.w.ini - (F.A.m?.ini || 0);
  const iB = F.B.spd + F.B.w.ini - (F.B.m?.ini || 0);
  const order = (iA > iB ? "A" : iB > iA ? "B" : (rnd() < .5 ? "A" : "B")) === "A" ? ["A","B"] : ["B","A"];
  let turn = 0;
  while(F.A.hp > 0 && F.B.hp > 0 && turn < TOPE){
    turn++;
    for(const k of order){
      if(F.A.hp <= 0 || F.B.hp <= 0) break;
      const att = F[k], def = F[k === "A" ? "B" : "A"];
      if(!att.sinArma && att.w !== PUNOS && rnd() < att.w.perder){ att.sinArma = true; att.w = PUNOS; continue; }
      for(let g = 0; g < att.w.golpes; g++){
        if(def.hp <= 0) break;
        if(rnd() < 0.06 + def.agi*0.019 + def.w.esq) continue;
        let d = Math.round((3 + att.str*1.45) * (0.8 + rnd()*0.4) * att.w.dmg);
        if(rnd() < 0.05 + att.agi*0.014 + att.w.crit) d = Math.round(d * 1.9);
        d = Math.max(1, Math.round(d * def.w.def));
        if(def.m && def.m.viva && rnd() < def.m.cubre){
          def.m.hp -= d; if(def.m.hp <= 0) def.m.viva = false;
        }else def.hp = Math.max(0, def.hp - d);
        if(def.hp <= 0) break;
      }
      if(att.m && att.m.viva && def.hp > 0 && rnd() < att.m.ataca) def.hp = Math.max(0, def.hp - att.m.dmg);
    }
  }
  return { winner: F.A.hp <= 0 ? "B" : F.B.hp <= 0 ? "A" : (F.A.hp >= F.B.hp ? "A" : "B"),
           turns: turn, murio: !!(F.A.m && !F.A.m.viva) };
}

/* ── la validación que hace creíble todo lo demás ── */
let distintas = 0;
for(let i = 0; i < 5000; i++){
  const lv = 1 + i % 20;
  const a = { ...C.botStats(lv), arma:"ninguna" }, b = { ...C.botStats(lv), arma:"ninguna" };
  const real = C.simulate(a, b, i), mio = sim(a, b, i, "ninguna", "ninguna");
  if(real.winner !== mio.winner || real.turns !== mio.turns) distintas++;
}
if(distintas){ console.log(`  LA COPIA NO ES FIEL (${distintas} de 5000). No mido nada.`); process.exit(1); }
console.log("  copia validada contra simulate(): 5000/5000 idénticas\n");

function medir(pA, pB, n = 25000){
  const t = []; let g = 0, mu = 0;
  for(let i = 0; i < n; i++){
    const lv = 1 + i % 20;
    const r = sim({ ...C.botStats(lv), arma:"ninguna" }, { ...C.botStats(lv), arma:"ninguna" }, i*7919, pA, pB);
    t.push(r.turns); if(r.winner === "A") g++; if(r.murio) mu++;
  }
  t.sort((x,y) => x-y);
  return { med:t[n>>1], p95:t[Math.floor(n*.95)], gana:g/n*100, muere:mu/n*100 };
}

const REALES = Object.keys(M).filter(k => M[k].hp > 0);
const base = medir("ninguna", "ninguna");
console.log(`  ── sin mascota ──  mediana ${base.med} · p95 ${base.p95}\n`);

console.log("  ── contra quien NO lleva ──");
for(const k of REALES){
  const r = medir(k, "ninguna");
  const dura = 100 / r.muere;
  console.log(`  ${k.padEnd(6)} gana ${r.gana.toFixed(1)}%  ·  dura ~${dura.toFixed(1)} combates  ·  ${M[k].precio} monedas = ${(M[k].precio/dura).toFixed(1)}/combate`);
}

console.log("\n  ── duración con las dos partes llevando ──");
for(const k of REALES){
  const r = medir(k, k);
  console.log(`  ambos ${k.padEnd(6)} mediana ${r.med} (base ${base.med})  p95 ${r.p95} (base ${base.p95})`);
}

console.log("\n  ── entre ellas ──");
for(const a of REALES)
  console.log(`  ${a.padEnd(6)} ` + REALES.map(b => a===b ? "  —  " : medir(a,b,14000).gana.toFixed(1).padStart(5)).join("  "));
console.log(`  ${" ".repeat(6)} ` + REALES.map(x => x.padStart(5)).join("  "));
