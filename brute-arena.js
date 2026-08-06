/* ══════════════════════════════════════════════════════════════════════════
   SolBrute · la arena, compartida
   ══════════════════════════════════════════════════════════════════════════
   Reproduce el registro de un combate: los brutos caminan hasta el rival, se
   arman, pegan, encajan y las mascotas muerden. Lo usan DOS paginas:

       app.html     la arena del juego, al pelear
       pelea.html   el enlace publico de una pelea guardada

   ── Por que un fichero y no una copia ─────────────────────────────────────
   Porque esto ya paso aqui. `brute-render.js` estuvo copiado a mano en los dos
   HTML y las copias se desincronizaron: se arreglaba una capa y en la otra
   pagina seguia rota. La regla del proyecto es que si dos paginas dibujan lo
   mismo, dibujan desde el mismo sitio.

   Y aqui gana ademas otra cosa: hoy, para probar un cambio en la animacion,
   hay que jugar una pelea. Con el enlace publico animado se puede reproducir
   CUALQUIER pelea guardada, al instante y con la misma semilla — que es el
   mejor banco de pruebas que puede tener una animacion.

   ── Script clasico, no modulo ES ──────────────────────────────────────────
   Igual que `brute-render.js` y por el mismo motivo: sobre `file://` el origen
   es `null` y el navegador bloquea los modulos por CORS. Abrir el HTML con
   doble clic tiene que seguir funcionando.

   ── El CSS viaja DENTRO ───────────────────────────────────────────────────
   Se inyecta una vez al crear la primera arena. Dejarlo en cada pagina seria
   volver al problema de las copias, con el agravante de que una diferencia de
   CSS no da error: da una animacion que se ve mal en una pagina y bien en la
   otra, y nadie mira las dos a la vez.

   Depende de las variables de color del `:root` de la pagina (`--bronze`,
   `--line`, `--blood-bright`…). Las dos las tienen, y son las mismas: estan
   escritas en la nota de identidad visual.

   ── Lo que NO decide este fichero ─────────────────────────────────────────
   El resultado. Llega decidido en `fight.log` y aqui solo se reproduce. Es lo
   que hace posible la promesa de combate verificable: `pelea.html` recalcula
   el combate con `brute-combate.js` y lo compara con lo guardado ANTES de
   pedirle a este fichero que lo anime.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  const R = window.BruteRender, C = window.BruteCombate;

  const CSS = `
  .huds{ display:flex; align-items:flex-start; gap:12px; margin-bottom:13px; }
  .hud{ flex:1; min-width:0; } .hud.right{ text-align:right; }
  .hud-name{ font-family:'Cinzel',serif; font-weight:800; font-size:15px; color:var(--bronze-light); letter-spacing:.05em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .hud-sub{ font-size:10px; color:var(--muted); letter-spacing:.06em; text-transform:uppercase; }
  .bar{ height:14px; margin-top:5px; border-radius:3px; overflow:hidden; background:#150f06; border:1.5px solid var(--bronze); }
  .bar .fill{ height:100%; width:100%; background:linear-gradient(180deg,var(--blood-bright),#7d1f1c); transition:width .32s cubic-bezier(.2,.8,.3,1); }
  .hud-hp{ font-size:11px; color:var(--muted); margin-top:3px; font-variant-numeric:tabular-nums; }
  /* La mascota lleva su propia vida, mas fina que la del bruto y debajo: es un
     acompanante, no un segundo luchador con el mismo peso visual. Roja porque
     aqui rojo significa vida, como en todo el juego. */
  .pet-row{ display:flex; align-items:center; gap:6px; margin-top:5px; opacity:.95; }
  /* \`display:flex\` GANA a la regla \`[hidden]{display:none}\` del navegador, asi
     que sin esta linea la barra se marcaba como oculta y se seguia viendo — un
     bruto sin mascota mostraba una barra vacia a cero. Sin error y sin aviso.
     Cada vez que se le pone \`display\` a algo que a veces va con \`hidden\`, hay
     que escribir esta pareja. */
  .pet-row[hidden]{ display:none; }
  .hud.right .pet-row{ flex-direction:row-reverse; }
  .pet-row svg{ width:20px; height:20px; display:block; }
  .pet-bar{ flex:1; height:7px; border-radius:3px; overflow:hidden;
            background:#150f06; border:1px solid var(--bronze); }
  .pet-bar .fill{ height:100%; width:100%;
                  background:linear-gradient(180deg,#d1554f,#6d1a17);
                  transition:width .32s cubic-bezier(.2,.8,.3,1); }
  .pet-hp{ font-size:10px; color:var(--muted); font-variant-numeric:tabular-nums; min-width:14px; }
  /* El dano que hace LA MASCOTA, aparte del del bruto. Sin esto el jugador no
     tiene forma de saber si su lobo aporta algo o es un adorno caro: los dos
     numeros iban sumados en la barra del bruto y no se distinguian. */
  .pet-dmg{ font-size:10px; color:var(--bronze-light); font-variant-numeric:tabular-nums;
            min-width:22px; opacity:.9; }
  .pet-dmg::before{ content:"\\2694\\FE0F "; font-size:9px; opacity:.8; }
  /* Caida: se queda a la vista, apagada. Quitarla del HUD haria pensar que
     nunca estuvo. */
  .pet-row.down{ opacity:.34; filter:grayscale(1); }
  .pet-row.down .pet-bar .fill{ width:0 !important; }
  /* El rotulo y el numero, uno encima del otro. Sin el display:block del
     numero salen pegados —«TURNO0»— y no da ningun error: solo se ve mal. Estas
     dos reglas se quedaron fuera al extraer el CSS y app.html seguia
     teniendolas, asi que se veia bien alli y mal en pelea.html. Es exactamente
     la trampa que avisa la cabecera de este fichero, cumplida el primer dia.
     (Sin acentos graves aqui dentro: esto vive en una plantilla y un backtick
     la cierra. Ya paso al montar el fichero.) */
  .turn-badge{ flex-shrink:0; align-self:center; text-align:center; font-family:'Cinzel',serif; font-size:10px; font-weight:700; color:var(--muted); letter-spacing:.08em; min-width:52px; }
  .turn-badge b{ display:block; font-size:18px; color:var(--blood-bright); }
  .arena-fondo{ position:absolute; inset:0; z-index:0; pointer-events:none;
                background-image:var(--fondo, none);
                background-size:cover; background-repeat:no-repeat;
                background-position:center var(--foco, 66%); }
  .arena-nom{ color:var(--bronze); margin-right:6px; }
  .arena-velo{ position:absolute; inset:0; z-index:1; pointer-events:none;
               background:linear-gradient(180deg,
                 rgba(12,10,7,calc(var(--velo,.34) + .18)) 0%,
                 rgba(12,10,7,calc(var(--velo,.34) - .08)) 34%,
                 rgba(12,10,7,var(--velo,.34)) 74%,
                 rgba(12,10,7,calc(var(--velo,.34) + .30)) 100%); }
  .arena > .fighter, .arena > .banner, .arena > .dmg{ z-index:2; }
  .arena{ position:relative; height:250px; border-radius:16px; overflow:hidden; border:1px solid var(--line); margin-bottom:15px; background:radial-gradient(ellipse 60% 42% at 50% 96%, rgba(255,157,66,.2), transparent 70%), linear-gradient(180deg,#1a1409,#241b0d 62%,#2e2412); }
  .arena::after{ content:""; position:absolute; left:50%; bottom:26px; transform:translateX(-50%); width:74%; height:60px; border-radius:50%; border:2px solid rgba(239,231,216,.08); }
  /* ── EL MOVIMIENTO ──
     Antes el bruto entero se deslizaba 56px con \`translateX\` y ya. Ahora
     CAMINA hasta el rival y le pega: el cuerpo se desplaza y las piernas y los
     brazos giran sobre sus articulaciones.

     Las articulaciones viven en el SVG (\`j-pieI\`, \`j-brazoA\`…) con su pivote
     puesto en \`transform-origin\`. Aqui solo se les cambia el angulo: NO se
     vuelve a dibujar el sprite en cada fotograma. Redibujarlo serian 3,8 KB de
     SVG por cuadro y a 60 fps eso no va en un movil.

     \`transform-box: view-box\` hace que el pivote se lea en unidades del SVG y
     no en la caja del elemento; sin eso, cada articulacion gira sobre su
     propio centro y el bruto se desmonta. */
  .fighter{ position:absolute; bottom:22px; width:116px;
            transition:transform var(--paso, .30s) cubic-bezier(.33,.9,.35,1); }
  .fighter [class^="j-"]{ transform-box:view-box;
                          transition:transform var(--art, .14s) cubic-bezier(.3,1.1,.4,1); }
  /* \`overflow:visible\` y no un lienzo mas ancho, que es la trampa aqui.
     ────────────────────────────────────────────────────────────────────────
     Al golpear, el brazo gira ~76 grados y el arma sale por la derecha: la
     punta del mandoble cae en x=150 y el lienzo acaba en 110. Un SVG recorta
     a su viewBox por defecto, asi que el arma DESAPARECIA a media animacion.

     Ensanchar el viewBox seria lo obvio y esta mal: \`.fighter\` fija el ancho
     en 116px, asi que mas unidades en el mismo ancho es el bruto mas pequeño.
     Con \`overflow:visible\` el lienzo sigue igual —el bruto conserva su tamaño—
     y solo el arma puede asomar.

     Ya pasaba con las armas vectoriales: el mandoble llegaba a x=125 y se
     cortaba igual. Los iconos, que son mas largos, solo lo hicieron evidente. */
  .fighter svg{ width:100%; height:auto; display:block; overflow:visible; }
  .fighter.left{ left:11%; } .fighter.right{ right:11%; }
  /* La distancia ya no es fija: se mide entre los dos en \`medirAlcance()\`,
     porque la arena cambia de ancho con la ventana y 56px se quedaba a medio
     camino en pantalla grande y se pasaba en movil. */
  .fighter.lunge-r{ transform:translateX(var(--alcance,56px)); }
  .fighter.lunge-l{ transform:translateX(calc(var(--alcance,56px) * -1)); }
  .fighter.knock-r{ transform:translateX(15px); } .fighter.knock-l{ transform:translateX(-15px); }
  .fighter.hop-r{ transform:translateX(25px) translateY(-13px); } .fighter.hop-l{ transform:translateX(-25px) translateY(-13px); }
  .fighter.down{ transform:rotate(-74deg) translateY(25px); opacity:.55; transition:transform .7s ease, opacity .7s ease; }
  .fighter.right.down{ transform:rotate(74deg) translateY(25px); }
  .fighter.flash svg{ filter:brightness(2.4) saturate(.4); }
  .dmg{ position:absolute; font-family:'Cinzel',serif; font-weight:800; font-size:21px; color:var(--blood-bright); text-shadow:0 2px 6px #000; pointer-events:none; animation:floatUp 1s ease forwards; }
  .dmg.crit{ font-size:29px; color:var(--torch); }
  .dmg.miss{ font-size:14px; color:var(--muted); font-family:inherit; letter-spacing:.06em; }
  @keyframes floatUp{ 0%{opacity:0;transform:translateY(6px) scale(.7)} 22%{opacity:1;transform:translateY(-6px) scale(1.12)} 100%{opacity:0;transform:translateY(-50px) scale(1)} }
  .banner{ position:absolute; inset:0; display:none; flex-direction:column; align-items:center; justify-content:center; gap:5px; background:rgba(12,10,7,.84); backdrop-filter:blur(3px); z-index:5; padding:16px; text-align:center; }
  .banner.show{ display:flex; animation:fadeIn .4s ease; }
  @keyframes fadeIn{ from{opacity:0} to{opacity:1} }
  .banner .what{ font-size:11px; letter-spacing:.16em; text-transform:uppercase; color:var(--blood-bright); }
  .banner .who{ font-family:'Cinzel',serif; font-size:clamp(21px,5vw,32px); font-weight:900; color:var(--bronze-light); }
  .banner .rew{ font-size:12px; color:var(--muted); margin-top:6px; }
  .banner .rew b{ color:var(--sol-teal); }
  .banner .rew .perdida{ color:var(--blood-bright); }
  /* El cambio del día va en su propia línea y apagado: es información, no
     premio. Si compitiera en color con las monedas, el jugador leería primero
     la letra pequeña que lo que acaba de ganar. */
  .banner .rate{ display:block; margin-top:4px; font-size:11px; opacity:.6; }
  .banner .btn{ margin-top:14px; }
  /* El enlace a la pelea. \`[hidden]\` no gana a \`display:inline-flex\` de \`.btn\`,
     asi que hace falta la regla — es el mismo caso que la barra de vida de la
     mascota y que el boton de reclamar de la preventa. */
  .banner-btns{ display:flex; gap:9px; align-items:center; justify-content:center; flex-wrap:wrap; }

  .arena-controls{ display:flex; gap:9px; flex-wrap:wrap; align-items:center; margin-bottom:14px; }
  .spd{ display:flex; gap:3px; background:var(--surface); border:1px solid var(--line); border-radius:9px; padding:3px; margin-left:auto; }
  .spd button{ background:none; border:none; color:var(--muted); font-family:inherit; font-size:11.5px; font-weight:700; padding:6px 9px; border-radius:6px; cursor:pointer; }
  .spd button.on{ background:var(--bronze); color:#241a06; }
  .seedline{ font-size:11px; color:var(--muted); margin-bottom:14px; font-variant-numeric:tabular-nums; }
  .seedline b{ color:var(--sol-teal); }
  .log{ background:var(--surface); border:1px solid var(--line); border-radius:14px; padding:13px 15px; max-height:180px; overflow-y:auto; font-size:12.5px; font-variant-numeric:tabular-nums; }
  .log-line{ padding:3px 0; color:var(--muted); border-bottom:1px solid rgba(58,46,28,.4); }
  .log-line:last-child{ border-bottom:none; }
  .log-line .tn{ color:var(--bronze); font-weight:700; margin-right:6px; }
  .log-line b{ color:var(--text); font-weight:600; }
  .log-line.crit{ color:var(--torch); } .log-line.dodge{ color:var(--sol-teal); }
  .log-line.ko{ color:var(--blood-bright); font-weight:700; }
  .dmg.pet{ color:var(--bronze-light); text-shadow:0 0 8px rgba(201,138,58,.55); }
  .log-line.pet{ color:var(--bronze-light); }
`;

  /* ═══════════ las poses ═══════════
     Un angulo por articulacion, en grados. El sprite NO se redibuja: se le
     cambia el `transform` a los grupos que ya trae dentro. Redibujar serian
     3,8 KB de SVG por fotograma y a 60 fps eso no va en un movil.

     Son pocas a proposito. Un juego de lucha tendria veinte; aqui el combate
     ya esta decidido antes de animarse y lo unico que hace falta es que se
     ENTIENDA quien pega, quien esquiva y quien encaja. */
  const POSES = {
    /* Nueve articulaciones. Las que mas se notan no son los brazos: son el
       TORSO —inclina todo el cuerpo de golpe— y el CODO, que es lo que hace
       que un golpe se arme antes de salir en vez de aparecer estirado. */
    guardia: { pieI:  0, pieD:  0, torso:  0, brazoB:   0, codoB:   0, cabeza:  0, brazoA:   0, codoA:   0, melena:  0 },
    paso1:   { pieI: 18, pieD:-14, torso: -3, brazoB:  17, codoB: -10, cabeza: -2, brazoA:  -7, codoA:   6, melena: -8 },
    paso2:   { pieI:-16, pieD: 18, torso:  3, brazoB: -13, codoB:   8, cabeza:  2, brazoA:   6, codoA:  -5, melena:  9 },
    /* Cargar es echarse ATRAS: el peso va a la pierna de atras, el torso se
       abre y el codo se cierra. Es el gesto que anuncia el golpe. */
    carga:   { pieI:-18, pieD: 13, torso: -9, brazoB: -26, codoB:  16, cabeza: -4, brazoA: -17, codoA: -13, melena:-16 },
    /* Y golpear es lo contrario, entero y de una vez. */
    golpe:   { pieI: 16, pieD:-18, torso: 15, brazoB:  30, codoB: -16, cabeza:  8, brazoA:  50, codoA:  26, melena: 22 },
    esquiva: { pieI:-11, pieD: -7, torso:-17, brazoB: -22, codoB:  20, cabeza:-14, brazoA:  -9, codoA:  16, melena:-20 },
    /* Encajar es salir despedido hacia ATRAS. Estuvo con el torso a +14, o sea
       inclinandose hacia el que le pega — leyendo igual que un golpe. */
    encaja:  { pieI:  9, pieD:-11, torso:-15, brazoB: -28, codoB:  24, cabeza:-19, brazoA: -14, codoA:  18, melena:-24 },
  };

  /* Las imagenes de fondo viven en Supabase Storage, NO en el repositorio:
     este es publico y la licencia de CraftPix prohibe redistribuir. Si se
     vacia, la arena vuelve al degradado de siempre en vez de quedarse negra. */
  const ARENA_BASE = "https://ihrcvartuuyvftxdxztt.supabase.co/storage/v1/object/public/arenas/";

  /* Los textos por defecto, en el idioma en que se escribio el juego. `app.html`
     los sustituye por los suyos traducidos; `pelea.html` se queda con estos.
     Van aqui y no repartidos para que una pagina que olvide pasar uno no
     acabe pintando `undefined` en mitad del registro. */
  const TXT = {
    dodge: "esquiva el golpe de", crit: "acierta un critico de", hit: "golpea a",
    dmg: "de daño", disarm: "pierde su", bite: "muerde a", petmiss: "falla contra",
    cover: "se interpone al golpe de", through: "le pasan", all: "lo absorbe todo",
    petdown: "cae", petdead: "cae y no se levanta", ko: "queda fuera de combate",
    esquivado: "esquiva",
  };

  let cssPuesto = false;
  function inyectarCSS() {
    if (cssPuesto) return;
    cssPuesto = true;
    const s = document.createElement("style");
    s.setAttribute("data-brute-arena", "");
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ══════════════════════════════════════════════════════════════════════
     crear(opciones) → una arena montada y lista
     ══════════════════════════════════════════════════════════════════════
       caja        elemento donde se monta (se le sobrescribe el contenido)
       txt         textos del registro; lo que falte cae a TXT
       bicho(id)   nombre de una mascota en el idioma de la pagina
       arena(id)   nombre del escenario
       controles   pintar el boton de saltar y las velocidades
       registro    pintar el registro de texto debajo
       alAcabar()  se llama cuando termina la reproduccion

     Los elementos NO se buscan por `id` global: se guardan en el cierre. Con
     ids, dos arenas en la misma pagina se pisarian, y sobre todo obligaba a
     que la pagina supiera como se llaman las piezas de dentro. */
  function crear(op) {
    inyectarCSS();
    /* `let` y no `const`: los textos se pueden cambiar en marcha. La app
       arranca en ingles y el jugador cambia de idioma cuando quiere, y la
       arena se crea UNA vez — sin esto se quedaria en el idioma de arranque
       para siempre. */
    let t = Object.assign({}, TXT, op.txt || {});
    const nombreBicho = op.bicho || ((id) => id);
    const nombreArena = op.arena || (() => "");
    const caja = op.caja;

    caja.innerHTML =
      '<div class="huds">' +
        '<div class="hud"><div class="hud-name"></div><div class="hud-sub"></div>' +
          '<div class="bar"><div class="fill"></div></div>' +
          '<div class="hud-hp"><span class="v">0</span> / <span class="m">0</span></div>' +
          '<div class="pet-row" hidden><span class="ico"></span><div class="pet-bar"><div class="fill"></div></div>' +
            '<span class="pet-hp">0</span><span class="pet-dmg">0</span></div></div>' +
        '<div class="turn-badge"><span class="rotulo"></span><b class="turno">0</b></div>' +
        '<div class="hud right"><div class="hud-name"></div><div class="hud-sub"></div>' +
          '<div class="bar"><div class="fill"></div></div>' +
          '<div class="hud-hp"><span class="v">0</span> / <span class="m">0</span></div>' +
          '<div class="pet-row" hidden><span class="ico"></span><div class="pet-bar"><div class="fill"></div></div>' +
            '<span class="pet-hp">0</span><span class="pet-dmg">0</span></div></div>' +
      '</div>' +
      '<div class="arena">' +
        '<div class="arena-fondo"></div><div class="arena-velo"></div>' +
        '<div class="fighter left"></div><div class="fighter right"></div>' +
      '</div>' +
      (op.controles
        ? '<div class="arena-controls"><button class="btn btn-ghost btn-sm js-skip"></button>' +
          '<div class="spd"><button data-s="1" class="on">1×</button>' +
          '<button data-s="2">2×</button><button data-s="4">4×</button></div></div>'
        : "") +
      '<div class="seedline"></div>' +
      (op.registro === false ? "" : '<div class="log"></div>');

    const q = (sel) => caja.querySelector(sel);
    const huds = caja.querySelectorAll(".hud");
    const P = {
      A: {
        hud: huds[0], fig: q(".fighter.left"),
        nom: huds[0].querySelector(".hud-name"), sub: huds[0].querySelector(".hud-sub"),
        fill: huds[0].querySelector(".bar .fill"),
        hp: huds[0].querySelector(".hud-hp .v"), hpMax: huds[0].querySelector(".hud-hp .m"),
        pet: huds[0].querySelector(".pet-row"),
      },
      B: {
        hud: huds[1], fig: q(".fighter.right"),
        nom: huds[1].querySelector(".hud-name"), sub: huds[1].querySelector(".hud-sub"),
        fill: huds[1].querySelector(".bar .fill"),
        hp: huds[1].querySelector(".hud-hp .v"), hpMax: huds[1].querySelector(".hud-hp .m"),
        pet: huds[1].querySelector(".pet-row"),
      },
    };
    q(".turn-badge .rotulo").textContent = op.textoTurno || "TURNO";
    const elArena = q(".arena"), elTurno = q(".turno"),
          elSeed = q(".seedline"), elLog = q(".log");

    let velocidad = 1, cortar = false, brutos = { A: null, B: null };
    const wait = (ms) => new Promise((r) => setTimeout(r, ms / velocidad));

    /* La vida de la mascota se lleva AQUI mientras se reproduce, no viene en
       cada evento: el registro solo dice cuanto encajo. Es un contador de
       reproduccion, no una fuente de verdad — quien decide es `simulate()`. */
    const petHp = { A: 0, B: 0 }, petMax = { A: 0, B: 0 }, petDmg = { A: 0, B: 0 };

    function pose(side, nombre) {
      const p = POSES[nombre] || POSES.guardia;
      for (const j in p) {
        const g = P[side].fig.querySelector(".j-" + j);
        if (g) g.style.transform = "rotate(" + p[j] + "deg)";
      }
    }

    /* Las dos piernas alternan mientras el bruto se desplaza. Es lo unico que
       convierte un deslizamiento en un paso: sin esto parece que patina. */
    function caminar(side, veces, paso) {
      let i = 0;
      /* `reloj`, no `t`: ese nombre son los textos y llamarlo igual los tapa
         dentro de la funcion. Aqui hoy no se traduce nada, pero la proxima vez
         que alguien anada uno se encuentra un error sin motivo aparente. */
      const reloj = setInterval(() => { pose(side, i++ % 2 ? "paso2" : "paso1"); }, paso);
      setTimeout(() => clearInterval(reloj), veces * paso);
    }

    /* La distancia hasta el rival se MIDE, no se supone: la arena cambia de
       ancho con la ventana, y una distancia fija se queda a medio camino en
       pantalla grande y se pasa de largo en movil.

       Y se mide al ARRANCAR, no al montar: si la pantalla esta oculta,
       `getBoundingClientRect()` devuelve ceros y el alcance sale 0px — el
       bruto se queda clavado. Un elemento con `display:none` no tiene medidas,
       solo lo parece. */
    function medirAlcance() {
      const a = P.A.fig.getBoundingClientRect(), b = P.B.fig.getBoundingClientRect();
      const hueco = Math.max(0, b.left - a.right);
      /* Se deja un resto de ~9%: el arma sobresale del cuerpo y lo cubre. A
         100% se solapan los dos cuerpos, que se lee peor que quedarse corto. */
      elArena.style.setProperty("--alcance", Math.round(hueco * 0.91) + "px");
    }

    function floatDmg(side, texto, tipo) {
      const s = document.createElement("div");
      s.className = "dmg" + (tipo ? " " + tipo : "");
      s.textContent = texto;
      /* La mascota se dibuja a los pies del bruto, asi que su numero sale
         abajo. No es estetica: a 4x se solapan varios numeros en el mismo
         punto y no se leia ninguno. A cada altura, el suyo. */
      s.style.left = (side === "A" ? 18 : 66) + "%";
      s.style.bottom = (tipo === "pet" ? 74 : 150) + "px";
      elArena.appendChild(s);
      setTimeout(() => s.remove(), 1100);
    }

    function setHp(side, hp, hpMax) {
      P[side].fill.style.width = Math.round(hp / hpMax * 100) + "%";
      P[side].hp.textContent = hp;
    }

    function montarMascota(side, id) {
      const fila = P[side].pet;
      fila.classList.remove("down");
      const m = C.MASCOTAS[id];
      if (!m || !m.hp) { fila.hidden = true; petMax[side] = 0; return; }
      fila.hidden = false;
      petMax[side] = petHp[side] = m.hp;
      petDmg[side] = 0;
      fila.querySelector(".ico").innerHTML = R.iconoMascota(id);
      fila.querySelector(".fill").style.width = "100%";
      fila.querySelector(".pet-hp").textContent = m.hp;
      fila.querySelector(".pet-dmg").textContent = "0";
    }

    /* `side` es el que RECIBE el mordisco, asi que quien lo da es la mascota
       del otro lado. Apuntarlo al reves haria que tu contador subiera cuando
       te muerden a ti, que es justo lo contrario de lo que dice. */
    function apuntarMordisco(sideRecibe, dmg) {
      const s = sideRecibe === "A" ? "B" : "A";
      if (!petMax[s]) return;
      petDmg[s] += dmg;
      P[s].pet.querySelector(".pet-dmg").textContent = petDmg[s];
    }

    function danarMascota(side, dmg) {
      if (!petMax[side]) return;
      petHp[side] = Math.max(0, petHp[side] - dmg);
      P[side].pet.querySelector(".fill").style.width =
        Math.round(petHp[side] / petMax[side] * 100) + "%";
      P[side].pet.querySelector(".pet-hp").textContent = petHp[side];
    }

    /* Cae: se apaga en el HUD y DESAPARECE de la arena. Redibujar el sprite
       sin ella es lo que hace que la caida se vea; si solo cambiara una barra,
       el jugador seguiria viendo a su lobo peleando despues de haberlo
       perdido. */
    function caerMascota(side) {
      P[side].pet.classList.add("down");
      const b = brutos[side];
      if (b) {
        P[side].fig.innerHTML = R.spriteProfile({ ...b, mascota: "ninguna" }, side === "A");
        pose(side, "guardia");
      }
    }

    /* ── El registro escrito ──
       `addLog` terminaba en un `else` que convertia CUALQUIER evento
       desconocido en un KO. Y `disarm` ya lo era desde que existen las armas:
       salia como «undefined queda fuera de combate» en uno de cada tres
       combates con arma. Ahora cada tipo se nombra y lo desconocido se
       descarta: un evento sin dibujar es un hueco; uno dibujado como otra
       cosa es una mentira. */
    function linea(e) {
      if (!elLog) return;
      const b = e.mascota ? nombreBicho(e.mascota) : "";
      let cls = "log-line", txt = "";
      if (e.type === "dodge") { cls += " dodge"; txt = `<b>${esc(e.def)}</b> ${t.dodge} <b>${esc(e.att)}</b>`; }
      else if (e.type === "crit") { cls += " crit"; txt = `<b>${esc(e.att)}</b> ${t.crit} <b>${esc(e.def)}</b> — ${e.dmg} ${t.dmg}`; }
      else if (e.type === "hit") { txt = `<b>${esc(e.att)}</b> ${t.hit} <b>${esc(e.def)}</b> — ${e.dmg} ${t.dmg}`; }
      else if (e.type === "disarm") { cls += " dodge"; txt = `<b>${esc(e.att)}</b> ${t.disarm} <b>${esc(e.arma)}</b>`; }
      else if (e.type === "muerde") { cls += " pet"; txt = `<b>${esc(b)}</b> ${t.bite} <b>${esc(e.def)}</b> — ${e.dmg} ${t.dmg}`; }
      else if (e.type === "mascota_falla") { cls += " dodge"; txt = `<b>${esc(b)}</b> ${t.petmiss} <b>${esc(e.def)}</b>`; }
      else if (e.type === "cubre") { cls += " pet"; txt = `<b>${esc(b)}</b> ${t.cover} <b>${esc(e.att)}</b> — ${e.dmg}` + (e.pasa > 0 ? `, ${t.through} ${e.pasa}` : ` (${t.all})`); }
      else if (e.type === "cae_mascota") { cls += " ko"; txt = `<b>${esc(b)}</b> ${e.definitiva ? t.petdead : t.petdown}`; }
      else if (e.type === "ko") { cls += " ko"; txt = `<b>${esc(e.def)}</b> ${t.ko}`; }
      else return;
      const d = document.createElement("div");
      d.className = cls;
      d.innerHTML = `<span class="tn">T${esc(e.turn)}</span>${txt}`;
      elLog.appendChild(d);
      elLog.scrollTop = elLog.scrollHeight;
    }

    /* ── El escenario ──
       Sale de la SEMILLA, asi que el rival ve el mismo sitio que tu y una
       pelea guardada se reproduce entera, escenario incluido. */
    function montarEscenario(seed) {
      const a = R.arenaDe(seed);
      elArena.style.setProperty("--velo", a.velo);
      elArena.style.setProperty("--foco", a.foco);
      elArena.style.setProperty("--fondo",
        ARENA_BASE ? `url("${ARENA_BASE}${a.id}.jpg")` : "none");
      q(".arena-fondo").style.filter = a.filtro || "";
      return nombreArena(a.id);
    }

    /* ══════════════════════════════════════════════════════════════════
       montar(a, b, seed) — deja la arena lista, sin animar nada
       ══════════════════════════════════════════════════════════════════ */
    function montar(a, b, seed) {
      brutos = { A: a, B: b };
      cortar = false;
      for (const [s, x] of [["A", a], ["B", b]]) {
        P[s].nom.textContent = x.name || "?";
        P[s].sub.textContent = `Nv. ${x.lv || 1} · ${x.w || 0}V ${x.l || 0}D`;
        P[s].hpMax.textContent = x.hpMax;
        P[s].hp.textContent = x.hpMax;
        P[s].fill.style.width = "100%";
        P[s].fig.innerHTML = R.spriteProfile(x, s === "A");
        P[s].fig.className = "fighter " + (s === "A" ? "left" : "right");
        montarMascota(s, x.mascota);
        pose(s, "guardia");
      }
      elTurno.textContent = "0";
      if (elLog) elLog.innerHTML = "";
      const nom = montarEscenario(seed);
      elSeed.innerHTML = (op.textoSemilla || "semilla") + " <b>" + esc(seed) + "</b>" +
        (nom ? ' · <b class="arena-nom">' + esc(nom) + "</b>" : "");
    }

    /* ══════════════════════════════════════════════════════════════════
       reproducir(log) — la animacion
       ══════════════════════════════════════════════════════════════════ */
    async function reproducir(log) {
      cortar = false;
      medirAlcance();
      await wait(400);
      for (const e of log || []) {
        if (cortar) return;
        elTurno.textContent = e.turn;
        /* En la mayoria de eventos `side` es el que RECIBE, asi que el que
           pega es el otro. En `disarm` y `cae_mascota` es al reves — por eso
           esos dos salen del bucle general antes de llegar aqui. */
        const attSide = e.side === "A" ? "B" : "A";
        const attFig = P[attSide].fig, defFig = P[e.side] ? P[e.side].fig : null;
        const attLeft = attSide === "A";

        if (e.type === "ko") {
          pose(e.side, "encaja");
          if (defFig) defFig.classList.add("down");
          linea(e); await wait(700); continue;
        }
        if (e.type === "disarm") {
          const fig = P[e.side].fig;
          fig.classList.add(e.side === "A" ? "hop-r" : "hop-l");
          linea(e); await wait(300);
          fig.classList.remove("hop-r", "hop-l");
          continue;
        }
        if (e.type === "cae_mascota") {
          caerMascota(e.side); linea(e);
          await wait(e.definitiva ? 620 : 380);
          continue;
        }

        /* ── EL ACERCAMIENTO ──
           El atacante CAMINA hasta el rival: el cuerpo se desplaza la
           distancia medida y las piernas alternan mientras dura. Solo se
           acerca quien golpea de verdad; la mascota muerde desde su sitio, que
           para eso tiene cuatro patas y esta al lado.

           El paso dura mas que el golpe a proposito: acercarse es lo que se
           ve, y si va tan rapido como el impacto no se lee como un paso. */
        const seAcerca = e.type !== "muerde" && e.type !== "mascota_falla";
        if (seAcerca) {
          pose(attSide, "paso1");
          caminar(attSide, 4, 78);
          attFig.classList.add(attLeft ? "lunge-r" : "lunge-l");
          await wait(300);
          pose(attSide, "carga");
          await wait(90);
          pose(attSide, "golpe");
        }
        await wait(170);

        if (e.type === "dodge" || e.type === "mascota_falla") {
          if (defFig) defFig.classList.add(attLeft ? "hop-r" : "hop-l");
          pose(e.side, "esquiva");
          floatDmg(e.side, t.esquivado, "miss"); linea(e);
          await wait(230);
          if (defFig) defFig.classList.remove("hop-r", "hop-l");
          pose(e.side, "guardia");
        } else if (e.type === "cubre") {
          /* La mascota encaja el golpe ENTERO y al bruto le llega lo que no
             absorbe. Son dos numeros distintos y salen a alturas distintas. Si
             saliera uno solo, el jugador creeria que se ha librado del golpe
             — y no. */
          floatDmg(e.side, "−" + e.dmg, "pet");
          danarMascota(e.side, e.dmg);
          if (e.pasa > 0) {
            if (defFig) defFig.classList.add("flash", attLeft ? "knock-r" : "knock-l");
            floatDmg(e.side, "−" + e.pasa, "");
            if (typeof e.hp === "number") setHp(e.side, e.hp, e.hpMax);
          }
          linea(e);
          await wait(260);
          if (defFig) defFig.classList.remove("flash", "knock-r", "knock-l");
        } else {
          if (defFig) defFig.classList.add("flash", attLeft ? "knock-r" : "knock-l");
          pose(e.side, "encaja");
          floatDmg(e.side, "−" + e.dmg,
            e.type === "crit" ? "crit" : e.type === "muerde" ? "pet" : "");
          if (e.type === "muerde") apuntarMordisco(e.side, e.dmg);
          setHp(e.side, e.hp, e.hpMax); linea(e);
          await wait(e.type === "crit" ? 330 : 230);
          if (defFig) defFig.classList.remove("flash", "knock-r", "knock-l");
          pose(e.side, "guardia");
        }

        /* ── LA VUELTA ──
           Vuelve andando a su sitio. Sin esto el bruto reaparece de golpe
           donde estaba, y el siguiente turno empieza con un salto que no ha
           hecho nadie. */
        if (seAcerca) {
          caminar(attSide, 3, 78);
          attFig.classList.remove("lunge-r", "lunge-l");
          await wait(240);
          pose(attSide, "guardia");
        }
        await wait(120);
      }
      if (op.alAcabar) op.alAcabar();
    }

    /* ── Saltar al resultado ──
       Pinta el registro entero de golpe y deja a los dos COMO QUEDARON. No
       recalcula nada: el registro ya lo dice todo.

       Lo que no puede hacer es solo pintar texto. Si se salta sin aplicar las
       vidas, el cartel del final aparece sobre dos brutos a tope de vida y
       ninguno caido — o sea contando una pelea que no ha pasado. Y sin
       devolverlos a `guardia` se quedan congelados a media zancada, con una
       pierna en el aire, mientras se lee el resultado. */
    function saltar(log) {
      cortar = true;
      if (elLog) elLog.innerHTML = "";
      pose("A", "guardia"); pose("B", "guardia");
      P.A.fig.classList.remove("lunge-r", "lunge-l", "flash", "knock-r", "knock-l", "hop-r", "hop-l");
      P.B.fig.classList.remove("lunge-r", "lunge-l", "flash", "knock-r", "knock-l", "hop-r", "hop-l");
      for (const e of log || []) {
        linea(e);
        if (e.type === "hit" || e.type === "crit" || e.type === "muerde") setHp(e.side, e.hp, e.hpMax);
        if (e.type === "muerde") apuntarMordisco(e.side, e.dmg);
        if (e.type === "cubre") {
          danarMascota(e.side, e.dmg);
          if (e.pasa > 0 && typeof e.hp === "number") setHp(e.side, e.hp, e.hpMax);
        }
        if (e.type === "cae_mascota") caerMascota(e.side);
        if (e.type === "ko") P[e.side].fig.classList.add("down");
      }
      const ult = (log || [])[(log || []).length - 1];
      if (ult && ult.turn != null) elTurno.textContent = ult.turn;
      if (op.alAcabar) op.alAcabar();
    }

    if (op.controles) {
      caja.querySelector(".js-skip").textContent = op.textoSaltar || "Saltar al resultado";
      caja.querySelector(".spd").addEventListener("click", (ev) => {
        const b = ev.target.closest("button[data-s]");
        if (!b) return;
        velocidad = Number(b.dataset.s) || 1;
        caja.querySelectorAll(".spd button").forEach((x) => x.classList.toggle("on", x === b));
      });
    }

    /* Se vuelve a medir al redimensionar: la arena cambia de ancho y el
       alcance con ella. */
    window.addEventListener("resize", medirAlcance);

    /* Cambiar los textos en marcha. Repinta los rotulos fijos; el registro ya
       escrito se queda como estaba —traducir hacia atras una pelea a medio
       reproducir marearia mas que ayudar— y las lineas nuevas salen ya en el
       idioma nuevo. */
    function textos(nuevos) {
      t = Object.assign({}, t, nuevos.txt || {});
      if (nuevos.textoTurno) q(".turn-badge .rotulo").textContent = nuevos.textoTurno;
      if (nuevos.textoSaltar && op.controles) caja.querySelector(".js-skip").textContent = nuevos.textoSaltar;
      if (nuevos.textoSemilla) op.textoSemilla = nuevos.textoSemilla;
    }

    return {
      caja, arena: elArena, montar, reproducir, saltar, medir: medirAlcance, textos,
      botonSaltar: op.controles ? caja.querySelector(".js-skip") : null,
      velocidad: (n) => { velocidad = Number(n) || 1; },
      cortar: () => { cortar = true; },
      lado: (s) => P[s],
    };
  }

  window.BruteArena = { crear, POSES, ARENA_BASE };
})();
