/* ══════════════════════════════════════════════════════════════════════════
   SolBrute · ¿hay acentos donde el editor de Supabase los destroza?
   ══════════════════════════════════════════════════════════════════════════
       node prueba-ascii.mjs supabase-funcion-auth.ts supabase-funcion-retirar.ts

   El editor de Supabase mangla el UTF-8 al pegar. Se comprobo mirando los
   BYTES que devolvia la funcion desplegada: donde debia haber `c3 b3` (o) habia
   `e2 88 9a e2 89 a5` (√≥). El jugador llevaba horas viendo «sesi√≥n no
   v√°lida» y nadie lo habia notado, porque en pantalla parece un fallo
   cualquiera de fuente.

   Hay dos sitios donde importa, y con distinta gravedad:

     CADENAS         el jugador ve la mojibake. Feo y parece roto.
     IDENTIFICADORES tumban el despliegue entero. Una funcion se llamaba
                     `duenoDe` y fallaba con `UnexpectedChar { c: '√' }`.

   Los COMENTARIOS si pueden llevar acentos: su mojibake dentro del editor es
   fea pero no la ve nadie, y el fichero del repositorio es la fuente de verdad.

   ── Por que un analizador y no un grep ────────────────────────────────────
   Porque hay que distinguir las tres cosas, y eso pide seguir el estado del
   texto: comentario de linea, de bloque, cadena, plantilla y EXPRESION
   REGULAR. La primera version no entendia las regex y marcaba
   `/[^\p{L}\p{N} .'\-]/gu` como cadena, porque veia el apostrofo de dentro.

   Un comprobador con un falso positivo conocido es uno que se aprende a
   ignorar — y entonces no sirve el dia que encuentra algo de verdad. Es la
   misma razon por la que la invariante tuvo que aprender a contar los botes.

   Y ojo con «arreglarlo» a lo bruto: un script que de-acentuaba «solo dentro
   de las cadenas» recorriendo el fichero entero trato los apostrofos de los
   comentarios como comillas de apertura, se trago todo hasta el siguiente y
   borro 272 lineas. Para TOCAR cadenas hay que apuntar a una concreta. Esto
   solo MIRA.
   ══════════════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";

/* Un `/` empieza una expresion regular o es una division, y solo se sabe por lo
   que va ANTES. Detras de un valor —un nombre, un numero, un `)` o un `]`— es
   division; detras de un operador o una palabra clave, es regex. */
const ANTES_VALOR = /[\w$\])]$/;
const PALABRAS = /\b(return|typeof|case|in|of|new|delete|void|instanceof)$/;

function revisar(ruta) {
  const s = readFileSync(ruta, "utf8");
  const malos = [];
  let i = 0, linea = 1, previo = "";

  const apunta = (l, clase, texto) => malos.push({ l, clase, texto });
  const acentos = (t) => [...t].some((c) => c.charCodeAt(0) > 127);

  while (i < s.length) {
    const c = s[i];

    if (c === "\n") { linea++; i++; continue; }

    if (c === "/" && s[i + 1] === "/") {          // comentario de linea
      while (i < s.length && s[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && s[i + 1] === "*") {          // comentario de bloque
      i += 2;
      while (i < s.length && !(s[i] === "*" && s[i + 1] === "/")) {
        if (s[i] === "\n") linea++;
        i++;
      }
      i += 2; continue;
    }
    if (c === "/") {                              // ¿expresion regular?
      const p = previo.trimEnd();
      const esRegex = !ANTES_VALOR.test(p) || PALABRAS.test(p);
      if (esRegex) {
        i++;
        let clase = false;
        while (i < s.length) {
          if (s[i] === "\\") { i += 2; continue; }
          if (s[i] === "[") clase = true;
          else if (s[i] === "]") clase = false;
          else if (s[i] === "/" && !clase) { i++; break; }
          else if (s[i] === "\n") { linea++; break; }
          i++;
        }
        while (i < s.length && /[a-z]/.test(s[i])) i++;   // las banderas
        previo = "/re/"; continue;
      }
      previo += c; i++; continue;
    }

    if (c === '"' || c === "'" || c === "`") {    // una cadena: AQUI SI importa
      const q = c, arranca = linea;
      let txt = ""; i++;
      while (i < s.length && s[i] !== q) {
        if (s[i] === "\\") { txt += s[i + 1] ?? ""; i += 2; continue; }
        if (s[i] === "\n") linea++;
        txt += s[i]; i++;
      }
      i++;
      if (acentos(txt)) apunta(arranca, "CADENA · la ve el jugador", txt.slice(0, 70));
      previo = '"x"'; continue;
    }

    if (c.charCodeAt(0) > 127) {
      apunta(linea, "IDENTIFICADOR · tumba el despliegue", c);
    }
    previo = (previo + c).slice(-24);
    i++;
  }
  return malos;
}

const ficheros = process.argv.slice(2);
if (!ficheros.length) {
  console.log("  uso: node prueba-ascii.mjs <fichero.ts> [...]");
  process.exit(2);
}
let mal = 0;
for (const f of ficheros) {
  const m = revisar(f);
  console.log(`  ${f}`);
  if (m.length) {
    mal += m.length;
    for (const x of m) console.log(`      x linea ${x.l} · ${x.clase}: ${x.texto}`);
  } else {
    console.log("      ok · codigo y cadenas en ASCII (los comentarios pueden llevar acentos)");
  }
}
console.log(mal ? `\n  ${mal} sitios que el editor de Supabase va a destrozar`
                : "\n  Nada que el editor pueda romper.");
process.exit(mal ? 1 : 0);
