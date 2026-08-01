/* ══════════════════════════════════════════════════════════════════════════
   SolBrute · renderizador de brutos por capas
   ══════════════════════════════════════════════════════════════════════════
   Fuente única de verdad del aspecto. Lo usan index.html (landing) y
   app.html (juego); antes estaba copiado en los dos y se desincronizaba.

   Un aspecto son diez enteros —{sex,skin,hair,hairC,cloth,clothC,face,eyeC,
   tat,tatC}— y aquí se convierten en SVG. Nada de esto toca el DOM ni guarda
   estado: entra un `look`, sale una cadena.

   Dos vistas del mismo bruto:
     bust(look)                    retrato de frente, para tarjetas
     spriteProfile(b, facingRight) cuerpo entero de perfil, para la arena

   Orden de dibujo, de dentro hacia fuera:
     cuerpo → tatuajes → ropa → cara → pelo

   No hay cascos, y es a propósito: la cara y el pelo son el personaje.

   ── Script clásico, NO módulo ES ──────────────────────────────────────────
   Se expone en window.BruteRender en vez de usar `export`. Con
   <script type="module"> los dos HTML dejarían de funcionar al abrirlos con
   doble clic: sobre file:// el origen es null y el navegador bloquea la
   carga del módulo por CORS. El proyecto no tiene build ni servidor, así que
   abrir el fichero a pelo tiene que seguir funcionando.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";

  const OL = "#241505";            // color de contorno, común a todas las capas
  const SKIN = [["#f0cfa8","#d4a97c"],["#e0ad7e","#c08a55"],["#c69267","#a3743f"],
                ["#a3714a","#82552f"],["#7d5334","#5e3c22"],["#5a3a22","#412714"]];
  const HAIRC  = ["#201509","#4a3614","#8f3d0c","#c25a16","#6b4f1e","#e8dcc4","#3f3470","#8a2f2a"];
  const CLOTHC = ["#8a6535","#7d5a30","#6b4c27","#b3312c","#3f3470","#ddd0b6"];
  const INK    = ["#b3312c","#c98a3a","#241505","#3f3470"];
  const EYEC   = ["#1f9c86","#2f6fb8","#b8791f","#7a4bb0","#a8322c","#4a8a3a","#5c6670","#b03a6e"];
  const HAIRS  = { 0:["calvo","rapado","cresta","melena","mono","rizos"],
                   1:["coleta","trenza","suelta","recogido","rapado","rizos"] };
  const CLOTHS = ["desnudo","tunica","malla","coraza","capa"];
  const FACES  = ["fiero","sereno","burlon","marcado"];
  const TATS   = ["ninguno","franjas","cicatriz","brazal","sol"];
  /* cabeza grande, ojos bajos y amplios: proporción de registro anime */
  /* hombre: ojo más estrecho y alto, ceja gruesa y pegada, cuello grueso, mandíbula larga
     mujer:  ojo grande y redondo, ceja fina y alta, cuello fino, mentón corto           */
  const HD = { 0:{ hw:25, neckX:40, neckW:19, ear:26, eyeX:12, eyeY:47, eyeRx:7.2, eyeRy:7.0, brow:3.3, browGap:3.4, lash:0, jaw:1, chin:78, shY:80 },
               1:{ hw:22, neckX:45, neckW:10, ear:23, eyeX:11, eyeY:49, eyeRx:6.8, eyeRy:9.8, brow:1.5, browGap:7.0, lash:1, jaw:0, chin:75, shY:82 } };
  const OUT = 3.2, IN = 1.7;   /* contorno grueso, detalle fino */

  function shade(hex, amt){
    const n = parseInt(hex.slice(1),16);
    const f = v => Math.max(0, Math.min(255, Math.round(v + (amt>0 ? (255-v)*amt : v*amt))));
    return "#" + [f(n>>16), f(n>>8&255), f(n&255)].map(v => v.toString(16).padStart(2,"0")).join("");
  }

  /* ═══════════ capas del retrato ═══════════ */
  function torsoPath(sex, i){
    i = i || 0;
    return sex === 0
      ? `M${2+i} 100 L${4+i} ${90+i} Q${16+i} ${82+i} 50 ${80+i} Q${84-i} ${82+i} ${96-i} ${90+i} L${98-i} 100 Z`
      : `M${12+i} 100 Q${22+i} ${86+i} 50 ${82+i} Q${78-i} ${86+i} ${88-i} 100 Z`;
  }
  const HEADP = {
    0:"M25 42 Q25 6 50 6 Q75 6 75 42 Q75 62 69 71 Q61 78 50 78 Q39 78 31 71 Q25 62 25 42 Z",
    1:"M28 42 Q28 6 50 6 Q72 6 72 42 Q72 58 63 68 Q57 75 50 75 Q43 75 37 68 Q28 58 28 42 Z" };

  /* ── 1 · cuerpo ── */
  function drawBody(c){
    const [s,sh] = SKIN[c.skin], d = HD[c.sex];
    const rim = shade(s, .3);
    return `
      <path d="${torsoPath(c.sex)}" fill="${s}" stroke="${OL}" stroke-width="${OUT}" stroke-linejoin="round"/>
      <path d="M50 ${d.shY} Q${c.sex===0?84:78} ${d.shY+2} ${c.sex===0?96:88} 100 L50 100 Z" fill="${sh}"/>
      ${c.sex===1
        ? `<path d="M38 93 Q44 99 50 93 Q56 99 62 93" stroke="${sh}" stroke-width="1.9" fill="none" opacity=".75"/>`
        : `<path d="M34 87 Q42 83 50 83 Q58 83 66 87" stroke="${sh}" stroke-width="2" fill="none" opacity=".7"/>`}
      <rect x="${d.neckX}" y="${d.chin-10}" width="${d.neckW}" height="${d.shY-d.chin+13}" fill="${sh}" stroke="${OL}" stroke-width="${IN+.4}"/>
      <path d="${HEADP[c.sex]}" fill="${s}" stroke="${OL}" stroke-width="${OUT}" stroke-linejoin="round"/>
      <path d="M50 6 Q${50+d.hw} 6 ${50+d.hw} 42 Q${50+d.hw} ${c.sex===0?60:58} ${50+d.hw-8} ${c.sex===0?69:68} Q50 ${d.chin} 50 ${d.chin} Q${50+d.hw-15} ${c.sex===0?61:59} ${50+d.hw-15} 42 Q${50+d.hw-15} 16 50 6 Z" fill="${sh}"/>
      <path d="M${50-d.hw+1} 26 Q${50-d.hw+3} 12 50 8" stroke="${rim}" stroke-width="2.4" fill="none" opacity=".55"/>
      ${d.jaw ? `<path d="M${50-d.ear+2} 56 Q${50-d.ear+7} 72 50 ${d.chin-1}" stroke="${sh}" stroke-width="2" fill="none" opacity=".7"/>
                 <path d="M${50+d.ear-2} 56 Q${50+d.ear-7} 72 50 ${d.chin-1}" stroke="${shade(sh,-.18)}" stroke-width="2" fill="none" opacity=".55"/>
                 <path d="M${d.neckX} ${d.chin-8} Q50 ${d.chin+3} ${d.neckX+d.neckW} ${d.chin-8}" fill="${shade(sh,-.22)}" opacity=".8"/>` : ""}
      <path d="M${50-d.ear-2} 44 L${50-d.ear-9} 37 L${50-d.ear+3} 54 Z" fill="${s}" stroke="${OL}" stroke-width="${IN+.4}" stroke-linejoin="round"/>
      <path d="M${50+d.ear+2} 44 L${50+d.ear+9} 37 L${50+d.ear-3} 54 Z" fill="${sh}" stroke="${OL}" stroke-width="${IN+.4}" stroke-linejoin="round"/>`;
  }

  /* ── 2 · tatuaje ── */
  function drawTat(c){
    const k = TATS[c.tat], ink = INK[c.tatC], d = HD[c.sex];
    if(k === "ninguno") return "";
    if(k === "franjas") return `
      <path d="M${50-d.hw+4} 45 L${50-d.eyeX-2} 49 L${50-d.eyeX-2} 54 L${50-d.hw+4} 50 Z" fill="${ink}" opacity=".85"/>
      <path d="M${50+d.hw-4} 45 L${50+d.eyeX+2} 49 L${50+d.eyeX+2} 54 L${50+d.hw-4} 50 Z" fill="${ink}" opacity=".85"/>
      <path d="M40 65 L60 65 L60 68 L40 68 Z" fill="${ink}" opacity=".45"/>`;
    if(k === "cicatriz") return `
      <path d="M${50+d.eyeX+2} 34 L${50+d.eyeX+6} 60" stroke="${ink}" stroke-width="2.6" stroke-linecap="round" opacity=".9"/>
      <path d="M${50+d.eyeX-1} 42 L${50+d.eyeX+8} 44" stroke="${ink}" stroke-width="1.9" stroke-linecap="round" opacity=".8"/>`;
    if(k === "brazal"){
      const x = c.sex === 0 ? 8 : 18;
      return `<path d="M${x} 95 Q${x+10} 87 ${x+20} 90 L${x+18} 96 Q${x+10} 93 ${x+3} 100 Z" fill="${ink}" opacity=".85"/>`;
    }
    return `<circle cx="50" cy="92" r="5.5" fill="none" stroke="${ink}" stroke-width="2.1" opacity=".9"/>
      <g stroke="${ink}" stroke-width="1.7" stroke-linecap="round" opacity=".8">
        <path d="M50 83 L50 85"/><path d="M41 92 L43 92"/><path d="M57 92 L59 92"/>
        <path d="M43.5 86 L45 87.5"/><path d="M55 97 L56.5 98.5"/></g>`;
  }

  /* ── 3 · ropa ── */
  function drawCloth(c){
    const k = CLOTHS[c.cloth], col = CLOTHC[c.clothC], fem = c.sex === 1, d = HD[c.sex];
    const li = shade(col,.24), dk = shade(col,-.26);
    const bust = fem ? `<path d="M39 93 Q44.5 99 50 93 Q55.5 99 61 93" stroke="${OL}" stroke-width="${IN}" fill="none" opacity=".45"/>` : "";
    const sd = `<path d="M50 ${d.shY+2} Q${fem?78:84} ${d.shY+5} ${fem?88:96} 100 L50 100 Z" fill="#000" opacity=".2"/>`;
    if(k === "desnudo") return fem
      ? `<path d="M36 93 Q43 88 50 91 Q57 88 64 93 L63 99 Q50 95 37 99 Z" fill="${col}" stroke="${OL}" stroke-width="${IN+.6}" stroke-linejoin="round"/>`
      : `<path d="M36 100 L45 84 L50 86 L43 100 Z" fill="${col}" stroke="${OL}" stroke-width="${IN+.6}" stroke-linejoin="round"/>`;
    if(k === "tunica") return `
      <path d="${torsoPath(c.sex,4)}" fill="${col}" stroke="${OL}" stroke-width="${OUT-.4}" stroke-linejoin="round"/>${sd}${bust}
      <path d="M44 ${d.shY+4} L56 ${d.shY+4} L55 100 L45 100 Z" fill="${dk}" opacity=".5"/>`;
    if(k === "malla"){
      let dots = "", top = d.shY + 7, hm = fem ? 34 : 46;
      for(let y = top; y < 100; y += 4.5){
        const half = hm * ((y - top + 4) / (104 - top));
        for(let x = 50 - half + ((Math.round(y/4.5))%2 ? 2.6 : 0); x < 50 + half; x += 5.2)
          dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.5" fill="${OL}" opacity=".5"/>`;
      }
      return `<path d="${torsoPath(c.sex,4)}" fill="${col}" stroke="${OL}" stroke-width="${OUT-.4}" stroke-linejoin="round"/>${dots}${bust}`;
    }
    if(k === "coraza") return `
      <path d="${torsoPath(c.sex,5)}" fill="${col}" stroke="${OL}" stroke-width="${OUT}" stroke-linejoin="round"/>${sd}${bust}
      <path d="M50 ${d.shY+5} L50 100" stroke="${OL}" stroke-width="${IN}" opacity=".55"/>
      <path d="M${fem?34:24} 95 Q50 99 ${fem?66:76} 95" stroke="${OL}" stroke-width="${IN}" fill="none" opacity=".5"/>
      <circle cx="${fem?34:22}" cy="${d.shY+7}" r="1.9" fill="${li}"/>
      <circle cx="${fem?66:78}" cy="${d.shY+7}" r="1.9" fill="${li}"/>`;
    const x = fem ? 38 : 48;
    return `
      <path d="M${50-x-2} 100 Q${50-x} ${d.shY} ${50-x+15} ${d.shY-5} L${50-x+19} 100 Z" fill="${col}" stroke="${OL}" stroke-width="${OUT-.4}" stroke-linejoin="round"/>
      <path d="M${50+x+2} 100 Q${50+x} ${d.shY} ${50+x-15} ${d.shY-5} L${50+x-19} 100 Z" fill="${dk}" stroke="${OL}" stroke-width="${OUT-.4}" stroke-linejoin="round"/>
      <path d="M${50-x+15} ${d.shY-5} Q50 ${d.shY-9} ${50+x-15} ${d.shY-5} L${50+x-17} ${d.shY+3} Q50 ${d.shY-1} ${50-x+17} ${d.shY+3} Z" fill="${col}" stroke="${OL}" stroke-width="${IN+.6}" stroke-linejoin="round"/>`;
  }

  /* ── 4 · cara: el ojo es la firma ── */
  function drawFace(c){
    const k = FACES[c.face], d = HD[c.sex];
    const base = EYEC[c.eyeC === undefined ? 0 : c.eyeC];
    const iTop = shade(base,-.42), iBot = shade(base,.3);
    const squash = k === "marcado" ? .62 : k === "fiero" ? .84 : 1;
    const rx = d.eyeRx, ry = d.eyeRy * squash, cy = d.eyeY;
    const L = 50 - d.eyeX, R = 50 + d.eyeX;

    function eye(cx, side){
      const o = side;                       /* -1 izquierda, +1 derecha */
      const lash = d.lash ? `
        <path d="M${cx+o*(rx-.4)} ${cy-ry*.55} L${cx+o*(rx+4.4)} ${cy-ry*1.05}" stroke="${OL}" stroke-width="2.1" stroke-linecap="round"/>
        <path d="M${cx+o*(rx-1.6)} ${cy-ry*.85} L${cx+o*(rx+1.6)} ${cy-ry*1.35}" stroke="${OL}" stroke-width="1.8" stroke-linecap="round"/>` : "";
      return `
        <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fbf6ec"/>
        <path d="M${cx-rx} ${cy} A${rx} ${ry} 0 0 1 ${cx+rx} ${cy} Z" fill="#e8dcc6" opacity=".55"/>
        <ellipse cx="${cx+o*.4}" cy="${cy+.6}" rx="${rx*.7}" ry="${ry*.86}" fill="${iBot}"/>
        <path d="M${cx+o*.4-rx*.7} ${cy+.6} A${rx*.7} ${ry*.86} 0 0 1 ${cx+o*.4+rx*.7} ${cy+.6} Z" fill="${iTop}"/>
        <ellipse cx="${cx+o*.4}" cy="${cy+1}" rx="${rx*.34}" ry="${ry*.5}" fill="#120c05"/>
        <circle cx="${cx-o*.2-rx*.34}" cy="${cy-ry*.42}" r="${rx*.26}" fill="#fff"/>
        <circle cx="${cx+o*rx*.36}" cy="${cy+ry*.42}" r="${rx*.15}" fill="#fff" opacity=".8"/>
        <path d="M${cx-rx-o*.6} ${cy-ry*.42} Q${cx} ${cy-ry-2.6} ${cx+rx+o*.6} ${cy-ry*.42}
                 L${cx+rx*.9} ${cy-ry*.1} Q${cx} ${cy-ry+1.2} ${cx-rx*.9} ${cy-ry*.1} Z" fill="${OL}"/>
        <path d="M${cx-rx*.8} ${cy+ry*.88} Q${cx} ${cy+ry+.6} ${cx+rx*.8} ${cy+ry*.88}" stroke="${OL}" stroke-width="1.3" fill="none" opacity=".55"/>
        ${lash}`;
    }

    const bw = d.brow, by = cy - ry - d.browGap;
    const brows = {
      fiero:   `<path d="M${L-6} ${by-1} L${L+6} ${by+4} L${L+6} ${by+4+bw} L${L-6} ${by-1+bw} Z" fill="${OL}"/><path d="M${R+6} ${by-1} L${R-6} ${by+4} L${R-6} ${by+4+bw} L${R+6} ${by-1+bw} Z" fill="${OL}"/>`,
      sereno:  `<path d="M${L-6} ${by+2} Q${L} ${by-1} ${L+6} ${by+2} L${L+6} ${by+2+bw} Q${L} ${by-1+bw} ${L-6} ${by+2+bw} Z" fill="${OL}"/><path d="M${R+6} ${by+2} Q${R} ${by-1} ${R-6} ${by+2} L${R-6} ${by+2+bw} Q${R} ${by-1+bw} ${R+6} ${by+2+bw} Z" fill="${OL}"/>`,
      burlon:  `<path d="M${L-6} ${by+4} L${L+6} ${by-3} L${L+6} ${by-3+bw} L${L-6} ${by+4+bw} Z" fill="${OL}"/><path d="M${R+6} ${by+1} L${R-6} ${by+4} L${R-6} ${by+4+bw} L${R+6} ${by+1+bw} Z" fill="${OL}"/>`,
      marcado: `<path d="M${L-6} ${by-2} L${L+7} ${by+4} L${L+6} ${by+4+bw} L${L-6} ${by-2+bw} Z" fill="${OL}"/><path d="M${R+6} ${by-2} L${R-7} ${by+4} L${R-6} ${by+4+bw} L${R+6} ${by-2+bw} Z" fill="${OL}"/>`
    }[k];

    const my = d.chin - 9;
    const mouth = {
      fiero:   `<path d="M45 ${my} Q50 ${my+5} 55 ${my} Q50 ${my+2.4} 45 ${my} Z" fill="#6b241b"/>`,
      sereno:  `<path d="M46.5 ${my} Q50 ${my+2.2} 53.5 ${my}" stroke="${OL}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
      burlon:  `<path d="M45.5 ${my+1} Q50 ${my+3.4} 54.5 ${my-1.6}" stroke="${OL}" stroke-width="1.7" fill="none" stroke-linecap="round"/>`,
      marcado: `<path d="M46 ${my} L54 ${my}" stroke="${OL}" stroke-width="1.8" stroke-linecap="round"/>`
    }[k];

    return `${eye(L,-1)}${eye(R,1)}${brows}
      <path d="M${50+1.4} ${cy+ry+3} L${50+3} ${cy+ry+5.4}" stroke="${OL}" stroke-width="1.4" stroke-linecap="round" opacity=".6"/>
      ${mouth}`;
  }

  /* ── 5 · pelo: pocos planos angulares grandes + banda de brillo ── */
  function drawHair(c){
    const k = HAIRS[c.sex][c.hair], h = HAIRC[c.hairC], d = HD[c.sex];
    const dk = shade(h,-.34), li = shade(h,.34), hw = d.hw;
    if(k === "calvo") return "";
    const gloss = `<path d="M${50-hw+7} 18 Q50 8 ${50+hw-7} 18 Q50 13 ${50-hw+7} 18 Z" fill="${li}" opacity=".9"/>`;
    const cap = `<path d="M${50-hw} 34 Q${50-hw+1} 4 50 4 Q${50+hw-1} 4 ${50+hw} 34 Q${50+hw-6} 18 50 16 Q${50-hw+6} 18 ${50-hw} 34 Z" fill="${h}" stroke="${OL}" stroke-width="${OUT-.6}" stroke-linejoin="round"/>`;

    if(k === "rapado") return cap + gloss;
    if(k === "cresta") return `
      ${cap}
      <path d="M42 16 Q46 -10 51 -12 Q57 -10 60 16 Q51 8 42 16 Z" fill="${li}" stroke="${OL}" stroke-width="${OUT-.6}" stroke-linejoin="round"/>
      <path d="M47 8 Q51 -6 55 8 Q51 3 47 8 Z" fill="${shade(h,.55)}"/>`;
    if(k === "melena") return `
      <path d="M${50-hw-3} 52 Q${50-hw-9} 8 50 -2 Q${50+hw+9} 8 ${50+hw+3} 52 Q${50+hw-3} 18 50 14 Q${50-hw+3} 18 ${50-hw-3} 52 Z" fill="${dk}" stroke="${OL}" stroke-width="${OUT-.4}" stroke-linejoin="round"/>
      <path d="M${50-hw} 38 Q${50-hw-2} 6 50 0 Q${50+hw+2} 6 ${50+hw} 38
               L${50+hw-7} 18 L${50+hw-16} 34 L54 12 L46 33 L${50-hw+11} 11 L${50-hw+5} 33 L${50-hw+1} 15 Z"
            fill="${h}" stroke="${OL}" stroke-width="${OUT-.6}" stroke-linejoin="round"/>
      <path d="M${50-hw-4} 46 Q${50-hw-9} 62 ${50-hw-2} 74 L${50-hw+6} 50 Z" fill="${dk}" stroke="${OL}" stroke-width="${IN+.4}" stroke-linejoin="round"/>
      <path d="M${50+hw+4} 46 Q${50+hw+9} 62 ${50+hw+2} 74 L${50+hw-6} 50 Z" fill="${dk}" stroke="${OL}" stroke-width="${IN+.4}" stroke-linejoin="round"/>
      ${gloss}`;
    if(k === "mono") return `
      ${cap}
      <circle cx="50" cy="-2" r="9" fill="${h}" stroke="${OL}" stroke-width="${OUT-.6}"/>
      <path d="M44 -4 Q50 -9 56 -4 Q50 -6 44 -4 Z" fill="${li}"/>
      <path d="M46 5 L54 5 L53 9 L47 9 Z" fill="${dk}" stroke="${OL}" stroke-width="${IN}"/>
      ${gloss}`;
    if(k === "coleta") return `
      ${cap}
      <path d="M${50+hw-1} 30 Q${50+hw+18} 42 ${50+hw+13} 64 Q${50+hw+8} 78 ${50+hw} 82 Q${50+hw+11} 58 ${50+hw+2} 40 Z" fill="${dk}" stroke="${OL}" stroke-width="${OUT-.6}" stroke-linejoin="round"/>
      ${gloss}`;
    if(k === "trenza") return `
      ${cap}
      <circle cx="${50-hw-2}" cy="52" r="5.2" fill="${dk}" stroke="${OL}" stroke-width="${IN+.3}"/>
      <circle cx="${50-hw-3}" cy="61" r="5" fill="${h}" stroke="${OL}" stroke-width="${IN+.3}"/>
      <circle cx="${50-hw-4}" cy="70" r="4.3" fill="${dk}" stroke="${OL}" stroke-width="${IN+.3}"/>
      <circle cx="${50-hw-5}" cy="78" r="3.5" fill="${h}" stroke="${OL}" stroke-width="${IN+.3}"/>
      ${gloss}`;
    if(k === "suelta") return `
      <path d="M${50-hw-5} 54 Q${50-hw-11} 8 50 -2 Q${50+hw+11} 8 ${50+hw+5} 54 Q${50+hw-2} 18 50 14 Q${50-hw+2} 18 ${50-hw-5} 54 Z" fill="${dk}" stroke="${OL}" stroke-width="${OUT-.4}" stroke-linejoin="round"/>
      <path d="M${50-hw-6} 46 Q${50-hw-13} 70 ${50-hw-3} 94 L${50-hw+5} 52 Z" fill="${h}" stroke="${OL}" stroke-width="${IN+.5}" stroke-linejoin="round"/>
      <path d="M${50+hw+6} 46 Q${50+hw+13} 70 ${50+hw+3} 94 L${50+hw-5} 52 Z" fill="${h}" stroke="${OL}" stroke-width="${IN+.5}" stroke-linejoin="round"/>
      <path d="M${50-hw} 36 Q${50-hw-2} 6 50 0 Q${50+hw+2} 6 ${50+hw} 36 L${50+hw-8} 16 L54 30 L46 12 L${50-hw+8} 30 L${50-hw+1} 14 Z" fill="${h}" stroke="${OL}" stroke-width="${OUT-.6}" stroke-linejoin="round"/>
      ${gloss}`;
    if(k === "recogido") return `
      ${cap}
      <ellipse cx="50" cy="-1" rx="11" ry="8" fill="${h}" stroke="${OL}" stroke-width="${OUT-.6}"/>
      <path d="M43 -3 Q50 -9 57 -3 Q50 -5 43 -3 Z" fill="${li}"/>
      <path d="M${50-hw+2} 36 Q${50-hw-3} 48 ${50-hw+2} 56 L${50-hw+7} 38 Z" fill="${dk}" stroke="${OL}" stroke-width="${IN+.3}" stroke-linejoin="round"/>
      <path d="M${50+hw-2} 36 Q${50+hw+3} 48 ${50+hw-2} 56 L${50+hw-7} 38 Z" fill="${dk}" stroke="${OL}" stroke-width="${IN+.3}" stroke-linejoin="round"/>
      ${gloss}`;
    /* rizos: planos redondeados, no bolitas sueltas */
    return `
      <path d="M${50-hw-1} 40 Q${50-hw-4} 10 50 2 Q${50+hw+4} 10 ${50+hw+1} 40
               Q${50+hw-4} 20 50 17 Q${50-hw+4} 20 ${50-hw-1} 40 Z" fill="${h}" stroke="${OL}" stroke-width="${OUT-.6}" stroke-linejoin="round"/>
      <g fill="${h}" stroke="${OL}" stroke-width="${IN+.4}">
        <circle cx="${50-hw+3}" cy="20" r="8"/><circle cx="${50-hw+15}" cy="9" r="9"/>
        <circle cx="50" cy="4" r="9.5"/><circle cx="${50+hw-15}" cy="9" r="9"/>
        <circle cx="${50+hw-3}" cy="20" r="8"/>
      </g>
      <g fill="${li}" opacity=".85">
        <circle cx="${50-hw+14}" cy="7" r="3.4"/><circle cx="50" cy="2" r="3.8"/><circle cx="${50+hw-15}" cy="7" r="3.2"/>
      </g>`;
  }

  /* retrato completo desde un look */
  function bust(look){
    return `<svg viewBox="0 0 100 100" aria-hidden="true">
      ${drawBody(look)}${drawTat(look)}${drawCloth(look)}${drawFace(look)}${drawHair(look)}
    </svg>`;
  }

  /* ═══════════ iconos de las armas ═══════════
     Para la armería: el arma sola, sin bruto que la sujete. Mismo registro que
     el resto —contorno grueso, detalle fino, bronce— para que no parezcan de
     otro juego. viewBox de 64×64 y sin colores fuera de la paleta.

     Están aquí y no en app.html porque el arte vive en un solo fichero: es la
     regla que se puso el día que los retratos estaban duplicados. */
  function iconoArma(id){
    const M = "#c98a3a", MD = "#a3762f", ML = "#e5ab5c", MAD = "#6b4f2a";
    const cuerpos = {
      /* Puños: nudillos de frente. Un puño de perfil se leía como un borrón a
         44 píxeles; de frente los cuatro dedos dan una silueta reconocible. */
      ninguna: `
        <path d="M16 26 Q16 20 22 20 L42 20 Q48 20 48 26 L48 44 Q48 50 42 50 L22 50 Q16 50 16 44 Z"
              fill="#d4a97c" stroke="${OL}" stroke-width="3.4" stroke-linejoin="round"/>
        <path d="M23 21 L23 34 M31 21 L31 34 M39 21 L39 34"
              stroke="${OL}" stroke-width="2.6" opacity=".8" stroke-linecap="round"/>
        <path d="M16 36 L48 36" stroke="${OL}" stroke-width="2.6" opacity=".7"/>
        <path d="M48 30 Q56 30 56 37 Q56 44 48 43" fill="#c69267" stroke="${OL}" stroke-width="3.2" stroke-linejoin="round"/>`,
      /* Daga: en diagonal. La diferencia con el mandoble no puede ser el
         tamaño —el SVG escala al marco— así que tiene que ser el eje. */
      daga: `
        <path d="M20 48 L44 22" stroke="${OL}" stroke-width="10" stroke-linecap="round"/>
        <path d="M21 47 L43 24" stroke="${ML}" stroke-width="5.5" stroke-linecap="round"/>
        <path d="M22 46 L42 25" stroke="#fff" stroke-width="1.6" opacity=".4" stroke-linecap="round"/>
        <path d="M12 46 L26 58" stroke="${OL}" stroke-width="7" stroke-linecap="round"/>
        <path d="M13 46 L25 57" stroke="${MD}" stroke-width="4" stroke-linecap="round"/>
        <path d="M16 52 L11 57" stroke="${OL}" stroke-width="6" stroke-linecap="round"/>
        <circle cx="10" cy="58" r="4" fill="${M}" stroke="${OL}" stroke-width="2.4"/>`,
      /* Mandoble: vertical y ancho, llenando el marco. Guarda larguísima y
         pomo gordo — la silueta de "espadón a dos manos". */
      mandoble: `
        <path d="M32 44 L32 4 L38 12 L38 44 Z" fill="${ML}" stroke="${OL}" stroke-width="3.4" stroke-linejoin="round"/>
        <path d="M32 44 L32 4 L26 12 L26 44 Z" fill="${M}" stroke="${OL}" stroke-width="3.4" stroke-linejoin="round"/>
        <path d="M32 40 L32 10" stroke="#fff" stroke-width="2" opacity=".35" stroke-linecap="round"/>
        <path d="M12 46 L52 46" stroke="${OL}" stroke-width="9" stroke-linecap="round"/>
        <path d="M13 46 L51 46" stroke="${MD}" stroke-width="5" stroke-linecap="round"/>
        <path d="M32 48 L32 56" stroke="${OL}" stroke-width="8" stroke-linecap="round"/>
        <circle cx="32" cy="58" r="5" fill="${M}" stroke="${OL}" stroke-width="2.8"/>`,
      lanza: `
        <path d="M32 60 L32 26" stroke="${OL}" stroke-width="8" stroke-linecap="round"/>
        <path d="M32 59 L32 27" stroke="${MAD}" stroke-width="4.5" stroke-linecap="round"/>
        <path d="M32 30 L23 20 L32 4 L41 20 Z" fill="${ML}" stroke="${OL}" stroke-width="3.4" stroke-linejoin="round"/>
        <path d="M32 26 L32 8" stroke="#fff" stroke-width="1.8" opacity=".45" stroke-linecap="round"/>
        <path d="M25 31 L39 31" stroke="${OL}" stroke-width="4.5" stroke-linecap="round"/>`,
      escudo: `
        <circle cx="32" cy="32" r="23" fill="#4a3a22" stroke="${OL}" stroke-width="3.6"/>
        <circle cx="32" cy="32" r="23" fill="none" stroke="${M}" stroke-width="2.6"/>
        <circle cx="32" cy="32" r="15" fill="none" stroke="${M}" stroke-width="1.8" opacity=".65"/>
        <circle cx="32" cy="32" r="6.5" fill="${M}" stroke="${OL}" stroke-width="2.6"/>
        <path d="M32 9 L32 18 M32 46 L32 55 M9 32 L18 32 M46 32 L55 32"
              stroke="${M}" stroke-width="2.4" opacity=".55" stroke-linecap="round"/>`,
    };
    const cuerpo = cuerpos[id] !== undefined ? cuerpos[id] : cuerpos.ninguna;
    return `<svg viewBox="0 0 64 64" aria-hidden="true">${cuerpo}</svg>`;
  }

  /* ═══════════ sprite de perfil: mismas capas, vista lateral ═══════════ */
  /* mira a la derecha; se espeja con scale(-1,1) para el rival */
  const PB = {   /* geometría de perfil por sexo */
    0:{ legW:13, armW:11, shW:6.5,  torso:"M40 44 L68 47 L64 86 L44 84 Z",  hipY:82, chest:0,  headR:16, jaw:"" },
    1:{ legW:11, armW:9.5, shW:5.5, torso:"M43 46 Q49 44 65 48 L62 85 L46 83 Z", hipY:82, chest:1, headR:15, jaw:"" }
  };

  function spriteProfile(b, facingRight){
    const L = b.look, [s, sh] = SKIN[L.skin];
    const g = PB[L.sex];
    const cloth = CLOTHC[L.clothC], hair = HAIRC[L.hairC];
    const hDk = shade(hair,-.3), hLi = shade(hair,.26);
    const ink = INK[L.tatC];
    const m = "#c98a3a", dkm = "#a3762f", lim = "#e5ab5c";
    const clothKind = CLOTHS[L.cloth], hairKind = HAIRS[L.sex][L.hair];
    const tatKind = TATS[L.tat];

    /* ── capa 0: capa (por detrás de todo) ── */
    const cloakBack = clothKind === "capa" ? `
      <path d="M42 46 Q22 62 20 100 Q18 118 26 124 Q34 100 38 76 Q40 58 46 50 Z"
            fill="${cloth}" stroke="${OL}" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M42 46 Q28 60 26 92 Q34 74 40 58 Z" fill="#000" opacity=".2"/>` : "";

    /* ── pelo por detrás de la cabeza ── */
    let hairBack = "";
    if(hairKind === "melena") hairBack = `
      <path d="M44 14 Q30 20 32 44 Q34 58 42 62 Q38 44 42 30 Q44 20 50 14 Z" fill="${hDk}" stroke="${OL}" stroke-width="2.4" stroke-linejoin="round"/>`;
    if(hairKind === "suelta") hairBack = `
      <path d="M46 12 Q28 20 30 50 Q31 72 40 84 Q36 58 40 34 Q43 20 52 13 Z" fill="${hDk}" stroke="${OL}" stroke-width="2.4" stroke-linejoin="round"/>`;
    if(hairKind === "coleta") hairBack = `
      <path d="M44 16 Q30 22 28 40 Q26 58 34 70 Q32 52 36 38 Q39 24 46 18 Z" fill="${hDk}" stroke="${OL}" stroke-width="2.4" stroke-linejoin="round"/>`;
    if(hairKind === "trenza") hairBack = `
      <circle cx="38" cy="40" r="5" fill="${hDk}" stroke="${OL}" stroke-width="2"/>
      <circle cx="36" cy="49" r="5" fill="${hair}" stroke="${OL}" stroke-width="2"/>
      <circle cx="34" cy="58" r="4.4" fill="${hDk}" stroke="${OL}" stroke-width="2"/>
      <circle cx="33" cy="66" r="3.6" fill="${hair}" stroke="${OL}" stroke-width="2"/>`;
    if(hairKind === "mono") hairBack = `
      <circle cx="41" cy="14" r="7.5" fill="${hair}" stroke="${OL}" stroke-width="2.4"/>
      <path d="M36 12 Q41 8 46 12 Q41 10 36 12 Z" fill="${hLi}"/>`;
    if(hairKind === "recogido") hairBack = `
      <ellipse cx="40" cy="16" rx="9" ry="7" fill="${hair}" stroke="${OL}" stroke-width="2.4"/>
      <path d="M34 14 Q40 9 46 14 Q40 12 34 14 Z" fill="${hLi}"/>`;

    /* ── piernas ── */
    const legs = `
      <path d="M50 ${g.hipY} L34 100 L24 118" fill="none" stroke="${OL}" stroke-width="${g.legW}" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M50 ${g.hipY} L34 100 L24 118" fill="none" stroke="${sh}" stroke-width="${g.legW-4.5}" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M24 118 L15 120" stroke="${OL}" stroke-width="12" stroke-linecap="round"/>
      <path d="M56 ${g.hipY} L72 98 L68 118" fill="none" stroke="${OL}" stroke-width="${g.legW+.5}" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M56 ${g.hipY} L72 98 L68 118" fill="none" stroke="${s}" stroke-width="${g.legW-4}" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M68 118 L78 120" stroke="${OL}" stroke-width="12" stroke-linecap="round"/>`;

    /* ── brazo de atrás ──
       El escudo solo aparece si el bruto lo lleva equipado. Antes lo llevaba
       todo el mundo, lo cual era bonito y mentía: ahora el equipo que ves es
       el que de verdad afecta al combate. */
    const llevaEscudo = (b.arma === "escudo");
    const shieldArm = `
      <path d="M46 54 L34 62 L36 74" fill="none" stroke="${OL}" stroke-width="${g.armW}" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M46 54 L34 62 L36 74" fill="none" stroke="${sh}" stroke-width="${g.armW-4}" stroke-linecap="round" stroke-linejoin="round"/>
      ${llevaEscudo ? `
        <circle cx="32" cy="64" r="15" fill="#4a3a22" stroke="${OL}" stroke-width="3"/>
        <circle cx="32" cy="64" r="15" fill="none" stroke="${m}" stroke-width="2.6"/>
        <circle cx="32" cy="64" r="9" fill="none" stroke="${m}" stroke-width="1.6" opacity=".7"/>
        <circle cx="32" cy="64" r="4" fill="${m}" stroke="${OL}" stroke-width="1.6"/>` : ""}`;

    /* ── torso desnudo (piel) ── */
    const bust = g.chest ? `<path d="M65 56 Q71 60 65 64" fill="${s}" stroke="${OL}" stroke-width="2.2" stroke-linejoin="round"/>` : "";
    const bareTorso = `
      <path d="${g.torso}" fill="${s}" stroke="${OL}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M54 45.5 L68 47 L64 86 L54 85 Z" fill="${sh}" opacity=".5"/>${bust}`;

    /* ── ropa sobre el torso ── */
    let clothFront = "";
    if(clothKind === "desnudo")
      clothFront = `<path d="M44 80 L64 83 L62 96 L46 94 Z" fill="${cloth}" stroke="${OL}" stroke-width="2.4" stroke-linejoin="round"/>`;
    else if(clothKind === "tunica")
      clothFront = `<path d="${g.torso}" fill="${cloth}" stroke="${OL}" stroke-width="3" stroke-linejoin="round"/>
        <path d="M54 45.5 L68 47 L64 86 L54 85 Z" fill="#000" opacity=".18"/>
        <path d="M44 84 L64 86 L62 98 L46 96 Z" fill="${cloth}" stroke="${OL}" stroke-width="2.4" stroke-linejoin="round"/>`;
    else if(clothKind === "malla"){
      let dots = "";
      for(let y = 52; y < 84; y += 5)
        for(let x = 44 + ((y/5)%2 ? 3 : 0); x < 66; x += 5.5)
          dots += `<circle cx="${x.toFixed(1)}" cy="${y}" r="1.5" fill="${OL}" opacity=".5"/>`;
      clothFront = `<path d="${g.torso}" fill="${cloth}" stroke="${OL}" stroke-width="3" stroke-linejoin="round"/>${dots}`;
    }
    else if(clothKind === "coraza")
      clothFront = `<path d="${g.torso}" fill="${cloth}" stroke="${OL}" stroke-width="3.2" stroke-linejoin="round"/>
        <path d="M54 45.5 L68 47 L64 86 L54 85 Z" fill="#000" opacity=".2"/>
        <path d="M44 64 Q54 68 64 65" stroke="${OL}" stroke-width="2.1" fill="none" opacity=".55"/>
        <path d="M45 74 Q54 78 63 75" stroke="${OL}" stroke-width="2.1" fill="none" opacity=".45"/>
        <circle cx="62" cy="53" r="2" fill="${lim}"/>`;
    else /* capa: hombrera y broche por delante */
      clothFront = `<path d="M42 44 Q54 41 68 47 L66 54 Q54 49 43 52 Z" fill="${cloth}" stroke="${OL}" stroke-width="2.6" stroke-linejoin="round"/>
        <circle cx="64" cy="50" r="3" fill="${m}" stroke="${OL}" stroke-width="1.8"/>`;

    /* ── tatuajes visibles de perfil ── */
    let tatBody = "", tatFace = "";
    if(tatKind === "brazal")
      tatBody = `<path d="M76 38 Q82 34 86 38 L84 42 Q80 39 77 43 Z" fill="${ink}" opacity=".85"/>`;
    if(tatKind === "sol" && (clothKind === "desnudo"))
      tatBody = `<circle cx="60" cy="62" r="5.5" fill="none" stroke="${ink}" stroke-width="2.2" opacity=".9"/>
        <g stroke="${ink}" stroke-width="1.7" stroke-linecap="round" opacity=".8">
          <path d="M60 53 L60 55"/><path d="M60 69 L60 71"/><path d="M51 62 L53 62"/><path d="M67 62 L69 62"/></g>`;
    if(tatKind === "franjas")
      tatFace = `<path d="M58 20 L66 22 L66 25 L58 23 Z" fill="${ink}" opacity=".85"/>`;
    if(tatKind === "cicatriz")
      tatFace = `<path d="M62 15 L64 30" stroke="${ink}" stroke-width="2.2" stroke-linecap="round" opacity=".9"/>`;

    /* ── brazo del arma (delante) ──
       Lo que empuña sale de b.arma, así que en la arena se ve con qué peleas.
       Cada una tiene silueta propia: la daga corta, el mandoble ancho y largo,
       la lanza una asta con punta. El escudo va en el otro brazo y por eso se
       dibuja más abajo, no aquí. */
    const armaId = b.arma || "ninguna";
    const filos = {
      /* hoja larga y estrecha, la de siempre */
      ninguna: "",
      daga: `
        <path d="M84 26 L84 10" stroke="${OL}" stroke-width="6" stroke-linecap="round"/>
        <path d="M84 24 L84 12" stroke="${lim}" stroke-width="3" stroke-linecap="round"/>
        <path d="M79 26 L89 26" stroke="${OL}" stroke-width="5" stroke-linecap="round"/>
        <path d="M80 26 L88 26" stroke="${dkm}" stroke-width="2.6" stroke-linecap="round"/>`,
      mandoble: `
        <path d="M84 28 L84 -14" stroke="${OL}" stroke-width="11" stroke-linecap="round"/>
        <path d="M84 25 L84 -11" stroke="${lim}" stroke-width="7" stroke-linecap="round"/>
        <path d="M84 25 L84 -11" stroke="#fff" stroke-width="2" opacity=".35" stroke-linecap="round"/>
        <path d="M74 28 L94 28" stroke="${OL}" stroke-width="8" stroke-linecap="round"/>
        <path d="M75 28 L93 28" stroke="${dkm}" stroke-width="4.5" stroke-linecap="round"/>`,
      lanza: `
        <path d="M84 34 L84 -18" stroke="${OL}" stroke-width="6.5" stroke-linecap="round"/>
        <path d="M84 33 L84 -16" stroke="#6b4f2a" stroke-width="4" stroke-linecap="round"/>
        <path d="M84 -8 L79 -16 L84 -26 L89 -16 Z" fill="${lim}" stroke="${OL}" stroke-width="2.6" stroke-linejoin="round"/>`,
      /* con escudo, la mano del arma va vacía: el escudo es lo que se lleva */
      escudo: "",
    };
    const weaponArm = `
      <path d="M62 52 L78 40 L84 24" fill="none" stroke="${OL}" stroke-width="${g.armW}" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M62 52 L78 40 L84 24" fill="none" stroke="${s}" stroke-width="${g.armW-4}" stroke-linecap="round" stroke-linejoin="round"/>
      ${tatBody}
      ${filos[armaId] !== undefined ? filos[armaId] : filos.ninguna}`;

    /* ── hombrera ── */
    const pauldron = `
      <circle cx="52" cy="47" r="${8.5-(g.chest?1:0)}" fill="${dkm}" stroke="${OL}" stroke-width="2.8"/>
      <path d="M52 ${47-(8.5-(g.chest?1:0))} A${8.5-(g.chest?1:0)} ${8.5-(g.chest?1:0)} 0 0 0 ${52-(8.5-(g.chest?1:0))} 47 L52 47 Z" fill="${m}"/>`;

    /* ── cabeza de perfil ── */
    const R = g.headR;
    const headSkin = `
      <circle cx="54" cy="24" r="${R}" fill="${s}" stroke="${OL}" stroke-width="2.8"/>
      <path d="M54 ${24-R} A${R} ${R} 0 0 1 54 ${24+R} Z" fill="${sh}" opacity=".45"/>
      <path d="M${54+R-1} 22 L${54+R+3} 25 L${54+R-1} 27" fill="${s}" stroke="${OL}" stroke-width="2.2" stroke-linejoin="round"/>`;
    const faceProfile = `
      <ellipse cx="${54+R-6}" cy="25" rx="3.6" ry="${g.chest?5:4.4}" fill="#fbf6ec"/>
      <ellipse cx="${54+R-5.4}" cy="25.6" rx="2.5" ry="${g.chest?4.2:3.7}" fill="${shade(EYEC[L.eyeC===undefined?0:L.eyeC],-.2)}"/>
      <ellipse cx="${54+R-5.4}" cy="26" rx="1.2" ry="2.2" fill="#120c05"/>
      <circle cx="${54+R-7}" cy="22.6" r="1.2" fill="#fff"/>
      <path d="M${54+R-10} 20.4 Q${54+R-5} 18.6 ${54+R-2} 21.4 L${54+R-3} 22.8 Q${54+R-6} 20.6 ${54+R-9.6} 21.8 Z" fill="${OL}"/>
      <path d="M${54+R-10} 16 L${54+R-2.5} 17.6" stroke="${OL}" stroke-width="${g.chest?1.9:2.4}" stroke-linecap="round"/>
      <path d="M${54+R-5} 34 L${54+R-.5} 33.4" stroke="#6b241b" stroke-width="1.7" stroke-linecap="round"/>`;

    /* ── pelo superior/delantero ── */
    let hairTop = "";
    if(hairKind === "rapado" || hairKind === "coleta" || hairKind === "trenza" || hairKind === "mono" || hairKind === "recogido")
      hairTop = `<path d="M42 22 Q42 9 55 9.5 Q65 10 67 19 Q60 13 50 15 Q44 17 42 22 Z" fill="${hair}" stroke="${OL}" stroke-width="2.3" stroke-linejoin="round"/>`;
    if(hairKind === "cresta")
      hairTop = `<path d="M44 20 Q44 12 52 11 Q60 11 64 18 Q56 14 48 17 Z" fill="${hDk}" stroke="${OL}" stroke-width="2.1" stroke-linejoin="round"/>
        <path d="M46 12 Q50 -4 56 -5 Q60 2 62 14 Q54 8 46 12 Z" fill="${hair}" stroke="${OL}" stroke-width="2.3" stroke-linejoin="round"/>`;
    if(hairKind === "melena" || hairKind === "suelta")
      hairTop = `<path d="M41 24 Q40 8 55 8 Q67 9 68 20 L62 13 L56 19 L50 12 L45 18 Z" fill="${hair}" stroke="${OL}" stroke-width="2.3" stroke-linejoin="round"/>
        <path d="M46 12 Q55 6 63 13 Q55 10 46 12 Z" fill="${hLi}" opacity=".85"/>`;
    if(hairKind === "rizos"){
      hairTop = "";
      [[42,22],[47,13],[55,10],[63,14],[67,22],[40,32]].forEach(([x,y],i) => {
        hairTop += `<circle cx="${x}" cy="${y}" r="${7-(i%3)}" fill="${i%3===0?hLi:hair}" stroke="${OL}" stroke-width="2"/>`;
      });
    }

    const headBlock = headSkin + faceProfile + tatFace + hairTop;

    /* El lienzo empieza en y = -34, no en 0, y por eso mide 164 de alto.
       Las armas se dibujan por encima de la cabeza —el mandoble llega a y=-14
       y la punta de la lanza a y=-26— y con el viewBox arrancando en 0 se
       recortaban contra el borde. El síntoma era que la lanza parecía una
       tabla: se veía el asta y la punta quedaba fuera.

       Ampliar hacia ARRIBA no encoge al bruto. `.fighter` fija el ancho en
       116px y deja la altura en `auto`, así que el personaje conserva su
       tamaño y solo aparece lienzo nuevo donde antes se cortaba. Y como la
       figura se posiciona desde abajo (`bottom:22px`), los pies no se mueven.

       Si algún día entra un arma más larga, esto es lo que hay que subir. */
    return `<svg viewBox="0 -34 110 164" aria-hidden="true">
      <g transform="${facingRight ? "" : "translate(110,0) scale(-1,1)"}">
        <ellipse cx="52" cy="126" rx="30" ry="4.5" fill="#000" opacity=".45"/>
        ${cloakBack}${hairBack}
        ${legs}
        ${shieldArm}
        ${bareTorso}${clothFront}
        ${pauldron}
        ${headBlock}
        ${weaponArm}
      </g></svg>`;
  }

  /* ═══════════ lo que ven index.html y app.html ═══════════ */
  window.BruteRender = {
    OL, SKIN, HAIRC, CLOTHC, INK, EYEC, HAIRS, CLOTHS, FACES, TATS, HD, OUT, IN, PB,
    shade, torsoPath, HEADP,
    drawBody, drawTat, drawCloth, drawFace, drawHair,
    bust, spriteProfile, iconoArma
  };
})();
