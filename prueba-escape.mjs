/* ══════════════════════════════════════════════════════════════════════════
   SolBrute · ¿algo llega al innerHTML sin escapar?
   ══════════════════════════════════════════════════════════════════════════
       node prueba-escape.mjs app.html pelea.html index.html admin.html

   La regla del proyecto: cada vez que un dato viaja del servidor a la pantalla
   de OTRO jugador, hay que preguntarse que pasa si lo escribio un atacante. El
   nombre de un bruto se pinta en la lista de rivales, en la clasificacion y en
   el tablon — y el token de sesion vive en localStorage.

   ── Por que no avisa de TODO lo que no lleva esc() ────────────────────────
   Porque la primera version lo hacia y sacaba 292 avisos solo en `app.html`.
   Casi todos eran `t("clave")` —textos propios— o `Number(...)`. Un
   comprobador con 292 avisos no lo mira nadie, y entonces no sirve el dia que
   encuentra algo: es el mismo motivo por el que la invariante tuvo que
   aprender a contar los botes y por el que el detector de acentos tuvo que
   entender las expresiones regulares.

   La segunda version filtraba a «accesos a propiedad» y seguian saliendo 84,
   casi todos numeros de columnas enteras (`b.lv`, `w.precio`). Tampoco.

   Lo que de verdad importa es MUY corto, y sale del esquema: las unicas
   columnas de TEXTO que un jugador escribe y otro ve en su pantalla.

       brutes.name          la lista de rivales, la clasificacion, el tablon
       fights.b_name        el tablon y el enlace de la pelea
       players.address      la clasificacion
       snapshot.name        el cuadro del torneo y pelea.html

   Todo lo demas o es numerico, o es una clave validada contra una lista blanca
   en el servidor (`arma`, `mascota`), o son textos propios (`t()`, `O()`).

   Con eso el comprobador saca cero avisos cuando esta bien, que es la unica
   forma de que alguien lo mire el dia que saque uno.
   ══════════════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";

/* Las columnas de texto que escribe un jugador y ve OTRO. Cortas a proposito:
   si se añade una, va aqui — y eso es una linea, no una lista que se olvida. */
const RIESGO = /\b(\.name\b|\.b_name\b|\.owner\b|\.address\b|nombreBruto\(|shortAddr\()/;
/* Lo que hace imposible que salga HTML. */
const SEGURO = /^(esc\(|escapar\(|Number\(|parseInt\(|t\(|O\()/;

function revisar(ruta) {
  const s = readFileSync(ruta, "utf8");
  const avisos = [];
  const re = /`(?:[^`\\]|\\.)*`/gs;
  let m;
  while ((m = re.exec(s)) !== null) {
    const tpl = m[0];
    if (!/<[a-z/]/i.test(tpl)) continue;               // no parece HTML
    const base = s.slice(0, m.index).split("\n").length;
    let i = 0;
    while ((i = tpl.indexOf("${", i)) !== -1) {
      let d = 1, j = i + 2;
      while (j < tpl.length && d > 0) { if (tpl[j] === "{") d++; if (tpl[j] === "}") d--; j++; }
      const expr = tpl.slice(i + 2, j - 1).trim().replace(/\s+/g, " ");
      const linea = base + tpl.slice(0, i).split("\n").length - 1;
      i = j;
      if (!RIESGO.test(expr)) continue;                // no lleva texto ajeno
      if (SEGURO.test(expr)) continue;
      avisos.push([linea, expr.slice(0, 76)]);
    }
  }
  return avisos;
}

let total = 0;
for (const f of process.argv.slice(2)) {
  const a = revisar(f);
  total += a.length;
  console.log(`  ${f} — ${a.length ? a.length + " SIN ESCAPAR" : "ok"}`);
  for (const [l, e] of a) console.log(`      linea ${l}: ${e}`);
}
console.log(total
  ? `\n  ${total} sitios donde el texto de un jugador llega a la pantalla de otro sin esc().`
  : "\n  El texto que escribe un jugador siempre pasa por esc() antes de la pantalla de otro.");
process.exit(total ? 1 : 0);
