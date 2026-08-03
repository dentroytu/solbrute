/* ══════════════════════════════════════════════════════════════════════════
   SolBrute · reglas del combate y del equilibrio
   ══════════════════════════════════════════════════════════════════════════
   Fuente de las fórmulas. Lo usan DOS entornos:

     · el navegador     <script src="brute-combate.js">
     · la Edge Function segundo fichero, con import "./brute-combate.js"

   Por eso el fichero no lleva `import` ni `export`: sin ellos vale a la vez
   como script clásico (que es lo que necesita abrirse con doble clic sobre
   file://) y como módulo ES (que es lo que exige Deno). Se expone en
   globalThis, que existe en los dos sitios.

   ── Hay que copiarlo a mano, y por eso existe VERSION ─────────────────────
   Lo suyo sería que la función lo importara de la web publicada y hubiera una
   sola copia. No se puede: el empaquetador de Supabase no descarga dominios
   externos al desplegar. Así que este fichero vive duplicado en la función, y
   la única defensa contra que las dos copias se separen es la comprobación de
   versión de abajo.

   ── Por qué esto no puede estar duplicado ─────────────────────────────────
   El servidor calcula el combate y el navegador lo reproduce. Si las dos
   copias divergen, el servidor dice que perdiste mientras tu pantalla dice
   que ganaste — y no hay forma de que el jugador sepa cuál miente.

   Con los retratos ya pasó (dos copias del renderizador que se
   desincronizaron) y solo se veía raro. Aquí sería sobre monedas.

   Por si acaso, VERSION viaja en cada petición de combate y el servidor la
   compara con la suya. Si no coinciden, rechaza la pelea en vez de arbitrar
   con otras reglas.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";

  /* Súbela cuando cambies CUALQUIER fórmula o constante de este fichero, y
     vuelve a pegar el fichero en la Edge Function. Si solo actualizas la web,
     el servidor se queda con las reglas viejas: entonces nadie podrá pelear y
     saldrá "el juego se ha actualizado, recarga" — molesto, pero infinitamente
     mejor que arbitrar partidas con dos reglamentos distintos. */
  const VERSION = 9;   // 8: turno propio, caer != morir · 9: golpe partido, mascotas mas duras

  /* ═══════════ equilibrio ═══════════
     Un bruto nuevo sale flojo a propósito: 1-4 sobre un tope de 10. Si
     naciera cerca del tope, subir de nivel no cambiaría nada y la progresión
     —que es el motor del género— dejaría de existir.
     El tope de 10 no se toca sin recalibrar daño y esquiva. */
  const STAT_INI = 1, STAT_VAR = 4;    // atributos de partida: 1..4
  const HP_INI = 40, HP_VAR = 11;      // vida de partida:      40..50
  const HP_NIVEL = 5;                  // vida del nivel que toca vida
  const STAT_MAX = 10;
  const TOPE_TURNOS = 40;              // sin él, dos brutos muy esquivos no acabarían

  /* Subir de nivel NO garantiza un atributo: sale 4 de cada 10 veces. Es lo
     que los hace escasos de verdad.

     Cada nivel da UNA sola cosa, nunca las dos. Nunca un nivel vacío.

     Los atributos son escasos a propósito: al nivel 20, 5,0 de media donde
     antes había 8,8. La vida no: sigue llegando a 102 al nivel 20, solo que a
     trompicones en vez de a goteo.

     Este hueco de "una cosa por nivel" es donde entrarán las armas y las
     mascotas: una tercera cosa que puede tocarte, sin rehacer la progresión.

     Cuidado si alguien intenta "compensar" el atributo que no toca con vida
     extra: se probó y los combates pasaron de 7 turnos a 19, porque la vida
     crecía y el daño no. Con el reparto actual van de 7 a 10 turnos al nivel
     20 y ninguno llega al tope de 40.

     Cuando existan armas y mascotas, este es el hueco donde entran: el 60%
     que hoy solo da vida será donde caiga el botín. */
  const PROB_ATRIBUTO = 0.35;
  /* La tercera cosa que puede tocarte al subir: un arma. Es la más rara de
     las tres a propósito — un arma que cae cada dos niveles no es un hallazgo,
     es un trámite. Con un 8%, la primera llega hacia el nivel 13.
     Esa escasez es también lo que le da sentido a la tienda: quien no quiera
     esperar, compra. */
  const PROB_ARMA = 0.08;

  /* Emparejamiento. Están aquí y no en app.html porque ahora la lista de
     rivales la arma el SERVIDOR: si viviera solo en el navegador, el servidor
     no podría construirla. */
  const OPP_COUNT = 5, LEVEL_SPREAD = 1, FIGHTS_DAY = 3, REROLLS_DAY = 1;

  /* Nombres de los brutos de la casa. */
  const NAMES = ["Vurkas","Torvald","Maximus","Drusa","Kaelo","Brennus","Sabina",
                 "Orlok","Crixus","Vardo","Nerva","Thrax","Galba","Rufa","Sceva",
                 "Murro","Balba","Priscus","Verus","Calpa"];

  /* Cuántas opciones tiene cada capa del aspecto. Los dibujos viven en
     brute-render.js, pero el SERVIDOR también necesita sortear aspectos para
     los brutos de la casa y no puede cargar el renderizador. Si añades una
     opción de arte, actualiza el número de aquí. */
  const LOOK_N = { sex:2, skin:6, hair:6, hairC:8, cloth:5, clothC:6, face:4, eyeC:8, tat:5, tatC:4 };

  const ri = n => Math.floor(Math.random() * n);

  /* Curva empinada: el primer nivel llega en dos peleas —engancha— y a partir
     de ahí cuesta cada vez más. Con 3 peleas al día, el nivel 5 son ~8 días y
     el nivel 10 unos ~54. Antes eran 6 y 27. */
  /* ── Cuanta XP cuesta el siguiente nivel ──────────────────────────────────
     Antes era `80 * nivel^1.5`, y ese exponente 1.5 hacia el juego inalcanzable
     sin que se notara: jugando las 3 peleas TODOS los dias, un ano entero te
     dejaba en el nivel 18, y llegar al tope habrian sido 68 anos. Todo lo que
     se pusiera por encima del nivel 20 era contenido que no iba a ver nadie.

     Con `52 * nivel^0.7`:

         nivel  5 -> 3 dias      nivel 20 ->  37 dias
         nivel 10 -> 11          nivel 30 ->  76
         nivel 15 -> 22          nivel 50 -> 182
                                 nivel 75 -> 365   <- un ano

     El 75 no es un numero redondo: es donde el bruto se ACABA. Ahi ya tiene
     los tres atributos a 10 y los 300 de vida, asi que del 76 al 100 no gana
     nada. Subir mas alla solo mueve un numero en la ficha.

     ── Lo que esto cuesta, y hay que vigilarlo ──────────────────────────────
     Los combates se alargan con el nivel: 6 turnos de mediana a nivel 1, 10 a
     nivel 25, 18 a nivel 75 (p95 22). Sigue por debajo del tope de 40, pero
     antes casi nadie pasaba de nivel 18 y las peleas duraban 8 turnos SIEMPRE.
     Ahora un veterano ve peleas que duran el triple.

     Y el emparejamiento es de +-1 nivel: con la poblacion repartida entre 75
     niveles en vez de 18, hace falta MAS gente para que te toquen rivales
     reales en vez de brutos de la casa. */
  const xpNeed = lv => Math.round(52 * Math.pow(lv, 0.7));

  function rollStats(){
    return { str: STAT_INI + ri(STAT_VAR), agi: STAT_INI + ri(STAT_VAR),
             spd: STAT_INI + ri(STAT_VAR), hpMax: HP_INI + ri(HP_VAR) };
  }

  /* Sube un atributo al azar respetando el tope. Elige entre los que aún no
     están al máximo: si sorteara a ciegas, un bruto con la fuerza a 10 podría
     subir de nivel y no ganar nada. */
  function subirAtributo(b){
    const libres = ["str","agi","spd"].filter(k => b[k] < STAT_MAX);
    if(!libres.length) return "";
    const k = libres[ri(libres.length)];
    b[k]++;
    return k;
  }

  /* Un bruto de la casa de nivel L sigue la MISMA curva que un jugador:
     L-1 puntos repartidos y HP_NIVEL de vida por nivel. Con otra fórmula, el
     emparejamiento por nivel sería mentira: mismo número, distinta fuerza. */
  function botStats(lv){
    const st = rollStats();
    for(let i = 0; i < lv - 1; i++) subirAtributo(st);
    st.hpMax += (lv - 1) * HP_NIVEL;
    return st;
  }

  function randomLook(){
    const sex = ri(LOOK_N.sex);
    return { sex, skin:ri(LOOK_N.skin), hair:ri(LOOK_N.hair), hairC:ri(LOOK_N.hairC),
             cloth:ri(LOOK_N.cloth), clothC:ri(LOOK_N.clothC), face:ri(LOOK_N.face),
             eyeC:ri(LOOK_N.eyeC), tat:ri(LOOK_N.tat), tatC:ri(LOOK_N.tatC) };
  }

  /* Fisher-Yates. El sort(() => Math.random() - .5) que había antes está
     sesgado y su comparador es inconsistente. */
  function barajar(a){
    for(let i = a.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* Un bruto de la casa de nivel `lv`, listo para pelear. */
  function nuevoBot(lv, nombresUsados){
    const st = botStats(lv);
    /* Dos "Galba" en la misma lista delatan que son inventados. */
    const libres = NAMES.filter(n => !nombresUsados.has(n));
    const nombre = (libres.length ? libres : NAMES)[ri(libres.length || NAMES.length)];
    nombresUsados.add(nombre);
    return { name: nombre, lv, hpMax: st.hpMax, str: st.str, agi: st.agi, spd: st.spd,
             w: ri(lv * 3), l: ri(lv * 2), look: randomLook(), bot: true };
  }

  /* ═══════════ armas ═══════════
     Son ALTERNATIVAS, no mejoras. Está medido: enfrentando todas contra todas
     con brutos idénticos, las cinco opciones quedan entre el 48% y el 51% de
     victorias — los puños incluidos. Si alguna se despega, deja de ser una
     alternativa y el juego se vuelve pagar-para-ganar.

     Lo que las equilibra son las dos formas de perderlas:

       perder  probabilidad POR TURNO de que se te caiga y pelees el resto del
               combate a puño limpio.
       fragil  probabilidad POR COMBATE de que se rompa para siempre.

     Y no es un adorno: sin ellas los puños ganaban el 44% y con ellas el 50%.
     Un arma que se te puede caer no es una ventaja fiable, y por eso comprarla
     no equivale a ganar. Además, la más fuerte es la que más se rompe, así que
     el poder cuesta mantenerlo.

     Las armas NO dan más monedas ni más XP. La recompensa es `12 + turnos`, o
     sea que ganar rápido paga menos: llevar arma sube tus victorias y baja tus
     ingresos por pelea. Lo que sí sube los ingresos es el nivel, y eso se juega.

     Si tocas estos números, vuelve a medir. La simulación está en el historial
     del proyecto y son cincuenta líneas. */
  /* ── Las armas son una ESCALERA, no cinco alternativas ────────────────────
     Hasta la v9 las cinco estaban empatadas al 50% a proposito, incluidos los
     punos: llevar arma no daba ninguna ventaja, solo cambiaba como peleabas.
     Medido, la lanza y el mandoble hasta PERDIAN contra los punos.

     Ahora quien reinvierte gana un poco mas. La ventaja sobre pelear a puno
     limpio esta medida y es DELIBERADAMENTE pequena:

         daga     +2.8     nivel 1  (dia 0)     130 mon   ~33 combates  3.9/comb
         escudo   +4.0     nivel 2  (dia 0.4)   100       ~20           5.0/comb
         lanza    +4.8     nivel 4  (dia 2)     110       ~17           6.6/comb
         mandoble +6.3     nivel 7  (dia 6)      90       ~11           8.1/comb

     Estas cuatro son el EQUIPO DE SALIDA: la primera semana las tienes todas.
     Los huecos de arriba estan vacios A PROPOSITO, y con la curva de XP nueva
     son sitios donde de verdad llega la gente:

         niveles 12-15    15-22 dias    primer escalon nuevo
         niveles 25-30    55-76 dias    el de los veteranos
         nivel  50        6 meses       el de muy pocos

     Poner algo por encima del 50 es escribirlo para nadie.

     ╔════════════════════════════════════════════════════════════════════╗
     ║  EL TECHO: NINGUN ARMA PUEDE PASAR DE +8 SOBRE LOS PUNOS.          ║
     ║                                                                     ║
     ║  Esto no es una preferencia, es lo que mantiene el juego vivo. Si   ║
     ║  cada arma nueva mejora a la anterior sin limite, en un ano un      ║
     ║  bruto sin equipo no gana NUNCA, el que no paga se va, y el juego   ║
     ║  se queda solo con quien paga — que es exactamente como murieron    ║
     ║  Axie y StepN. Ver TOKEN.md.                                        ║
     ║                                                                     ║
     ║  A +8, quien va a puno limpio gana ~42 de cada 100. Ese es el       ║
     ║  suelo, y no se baja.                                               ║
     ╚════════════════════════════════════════════════════════════════════╝

     Entonces, si no pueden ser mas fuertes, ¿que aporta un arma de nivel 20?
     COSAS QUE NO SON PODER:

     · Mecanicas nuevas — tres golpes, robar vida, ignorar el escudo del
       rival, contraatacar al esquivar. Cambian COMO peleas, no cuanto ganas.
     · Piedra-papel-tijera — algo que destroza al mandoble y sufre contra la
       daga. Eso da profundidad sin subir el techo.
     · Aspecto. El mejor sumidero que existe y el que no toca el equilibrio.

     Y el precio por combate sigue subiendo con el tier, asi que lo de arriba
     cuesta mantenerlo aunque no gane mas.

     COMO SE ANADE UNA ARMA NUEVA (no te lo saltes):
       1. entrada aqui con su `nivel` y su `fragil`
       2. dibujarla en brute-render.js (`spriteProfile` y `iconoArma`)
       3. anadirla a la lista blanca de los cuatro `.sql` de armas
       4. MEDIRLA contra las que ya hay y contra los punos. Si pasa de +8, no
          entra. Se ajusta hasta que quepa.
       5. subir VERSION y repegar este fichero en la Edge Function */
  const ARMAS = {
    ninguna:  { id:"ninguna",  nombre:"Puños",    nivel:1,  golpes:1, dmg:1.000, crit:0.00, esq:0.00, ini:0,  def:1.00, perder:0,     fragil:0    },
    daga:     { id:"daga",     nombre:"Daga",     nivel:1,  golpes:2, dmg:0.470, crit:0.05, esq:0.02, ini:2,  def:1.00, perder:0.015, fragil:0.03 },
    escudo:   { id:"escudo",   nombre:"Escudo",   nivel:2,  golpes:1, dmg:0.782, crit:0.00, esq:0.01, ini:-1, def:0.72, perder:0.025, fragil:0.05 },
    lanza:    { id:"lanza",    nombre:"Lanza",    nivel:4,  golpes:1, dmg:1.123, crit:0.02, esq:0.00, ini:1,  def:1.06, perder:0.035, fragil:0.06 },
    mandoble: { id:"mandoble", nombre:"Mandoble", nivel:7, golpes:1, dmg:1.422, crit:0.00, esq:-0.05,ini:-2, def:1.12, perder:0.055, fragil:0.09 },
  };
  const PUNOS = ARMAS.ninguna;

  /* ── Precios ──
     Ya NO son todos iguales por combate: cuanto mas ventaja da el arma, mas
     cara sale de mantener. Es lo que impide que la mejor sea ademas la mas
     rentable, que es como se rompe una economia de este tipo.

         daga     130 / 33 combates  =  4.0 monedas por pelea
         escudo   100 / 20           =  5.0
         lanza    110 / 17           =  6.5
         mandoble  90 / 11           =  8.0

     Sobre las ~40 que gana un bruto al dia. El mandoble se lleva una quinta
     parte de lo que ganas, y por eso su +5 no es gratis.

     Es un primer número, no una verdad. Cuando haya jugadores, el panel dirá
     si sobra o falta: si nadie compra, están caras; si todo el mundo lleva
     siempre la misma, están baratas. */
  ARMAS.daga.precio     = 130;   // ~33 combates
  ARMAS.escudo.precio   = 100;   // ~20
  ARMAS.lanza.precio    = 110;   // ~17
  ARMAS.mandoble.precio =  90;   // ~11
  ARMAS.ninguna.precio  =   0;

  /* Cuántos combates aguanta de media, para poder enseñarlo en la armería:
     comprar a ciegas algo que se rompe es una mala experiencia. */
  const duracion = id => { const w = ARMAS[id]; return w && w.fragil ? Math.round(1 / w.fragil) : 0; };
  /* Las que pueden tocar o comprarse. Los puños no son un arma, son no llevar. */
  const ARMAS_REALES = ["daga","mandoble","lanza","escudo"];

  /* ═══════════ mascotas ═══════════
     A diferencia de las armas, una mascota SÍ es una ventaja: quien lleva una
     gana ~57% contra quien no. Eso es deliberado y es la diferencia entre las
     dos cosas — pero tiene tres frenos que impiden que sea comprar victorias:

       · ESTORBA. `ini` te resta iniciativa, así que vas más lento. Llevarla es
         una elección, no una mejora gratis. Sin esto la ventaja sube al 63%.
       · MUERE, y no vuelve. Se pierde para siempre, como el arma que se rompe.
       · Y NO da más monedas ni más XP. Igual que las armas.

     Al 57%, quien no lleva mascota gana 43 de cada 100: molesto, no
     excluyente. Ese era el límite que se buscaba.

     ── Los números salen de medir, no de la intuición ────────────────────
     El primer diseño —mordisco fuerte y mucha cobertura— daba 73-82% de
     victorias y alargaba los combates un 25%. Está en `prueba-mascotas.mjs`,
     que copia el bucle de `simulate()` y comprueba que sin mascota da idéntico
     antes de medir nada. SI TOCAS ESTOS NÚMEROS, VUELVE A PASARLO.

       ataca   probabilidad por turno de que muerda
       dmg     daño de ese mordisco
       cubre   probabilidad de que se coma un golpe dirigido a ti
       hp      su vida; a cero muere y se pierde
       ini     lo que te resta de iniciativa por llevarla */
  const MASCOTAS = {
    ninguna: { nombre:"ninguna", nivel:1,  ataca:0,    dmg:0, cubre:0,    absorbe:0,    hp:0,  mortal:0,    ini:0, precio:0 },
    perro:   { nombre:"perro",   nivel:1,  ataca:0.45, dmg:1, cubre:0.38, absorbe:0.30, hp:30, mortal:0.10, ini:5, precio:115 },
    lobo:    { nombre:"lobo",    nivel:4,  ataca:0.32, dmg:2, cubre:0.38, absorbe:0.30, hp:26, mortal:0.09, ini:5, precio:105 },
    oso:     { nombre:"oso",     nivel:8,  ataca:0.30, dmg:1, cubre:0.38, absorbe:0.30, hp:38, mortal:0.09, ini:5, precio:175 },
  };
  const MASCOTAS_REALES = ["perro","lobo","oso"];
  const mascota = id => MASCOTAS[id] || MASCOTAS.ninguna;

  const arma = id => ARMAS[id] || PUNOS;

  /* ═══════════ azar reproducible ═══════════ */
  /* mulberry32: misma semilla, mismo combate, siempre. Es lo que permite que
     el servidor mande semilla + registro y cualquiera pueda recalcular la
     pelea para comprobar que cuadra. */
  function mulberry32(a){
    return function(){
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* ═══════════ el combate ═══════════ */
  /* Se calcula ENTERO antes de animar nada. El navegador solo reproduce el
     registro. No es un detalle de implementación: es lo que hace posible la
     promesa de combate verificable. */
  function simulate(a, b, seed){
    const rnd = mulberry32(seed);
    /* La mascota entra con su vida propia. `viva:false` desde el principio si
       no lleva ninguna, para que el resto del bucle no tenga que preguntar dos
       cosas en cada comprobación. */
    const bicho = (id) => {
      const m = mascota(id);
      return m.hp > 0 ? { ...m, hp:m.hp, viva:true } : null;
    };
    const F = {
      A:{ ...a, hp:a.hpMax, side:"A", w:arma(a.arma), sinArma:false, m:bicho(a.mascota) },
      B:{ ...b, hp:b.hpMax, side:"B", w:arma(b.arma), sinArma:false, m:bicho(b.mascota) },
    };
    /* La iniciativa la modifica el arma —el mandoble es lento, la daga rápida—
       y la mascota SIEMPRE la resta: llevarla te hace ir más lento, y es lo que
       impide que sea una mejora gratis. */
    const iniA = F.A.spd + F.A.w.ini - (F.A.m ? F.A.m.ini : 0);
    const iniB = F.B.spd + F.B.w.ini - (F.B.m ? F.B.m.ini : 0);
    const first = iniA > iniB ? "A" : iniB > iniA ? "B" : (rnd() < .5 ? "A" : "B");
    /* ── Quien actua en un turno ──────────────────────────────────────────
       Cuatro actores como mucho: los dos brutos y las dos mascotas, y cada uno
       con su paso. La mascota va JUSTO DESPUES de su bruto, no dentro de el.

       Antes mordia al final del turno de su dueno, sin paso propio, y el efecto
       era que el jugador no la veia hacer nada: pagaba 80 monedas por un numero
       que subia en algun sitio. Darle turno no es adorno — es lo unico que hace
       que se note que esta ahi. */
    const lados = first === "A" ? ["A","B"] : ["B","A"];
    const order = [];
    for(const k of lados){ order.push({ k, bicho:false }); order.push({ k, bicho:true }); }
    const log = []; let turn = 0;

    while(F.A.hp > 0 && F.B.hp > 0 && turn < TOPE_TURNOS){
      turn++;
      for(const paso of order){
        if(F.A.hp <= 0 || F.B.hp <= 0) break;
        const att = F[paso.k], def = F[paso.k === "A" ? "B" : "A"];

        /* ── el turno de la mascota ──
           Solo si sigue en pie. Una mascota caida no vuelve a actuar en este
           combate, aunque no haya muerto del todo. */
        if(paso.bicho){
          if(!att.m || !att.m.viva) continue;
          if(rnd() >= att.m.ataca){
            log.push({ turn, type:"mascota_falla", side:def.side,
                       def:def.name, mascota:att.m.nombre });
            continue;
          }
          const d = att.m.dmg;
          def.hp = Math.max(0, def.hp - d);
          log.push({ turn, type:"muerde", side:def.side, def:def.name, dmg:d,
                     hp:def.hp, hpMax:def.hpMax, mascota:att.m.nombre });
          if(def.hp <= 0) log.push({ turn, type:"ko", def:def.name, side:def.side });
          continue;
        }

        /* ¿se le va el arma de las manos? El resto del combate, a puño limpio.
           Es lo que impide que llevar arma sea una ventaja segura. */
        if(!att.sinArma && att.w !== PUNOS && rnd() < att.w.perder){
          log.push({ turn, type:"disarm", att:att.name, side:att.side, arma:att.w.nombre });
          att.sinArma = true; att.w = PUNOS;
          continue;
        }

        /* Cada golpe se esquiva por separado: por eso la daga, que pega dos
           veces, sufre más contra un rival ágil. */
        for(let g = 0; g < att.w.golpes; g++){
          if(def.hp <= 0) break;
          /* esquiva: 6% + agilidad × 1.9%, más lo que aporte su arma */
          if(rnd() < 0.06 + def.agi * 0.019 + def.w.esq){
            log.push({ turn, type:"dodge", att:att.name, def:def.name, side:def.side });
            continue;
          }
          /* daño: (3 + fuerza × 1.45) × (0.8 a 1.2) × arma */
          let dmg = Math.round((3 + att.str * 1.45) * (0.8 + rnd() * 0.4) * att.w.dmg), type = "hit";
          /* crítico: 5% + agilidad × 1.4%, multiplica por 1.9 */
          if(rnd() < 0.05 + att.agi * 0.014 + att.w.crit){ dmg = Math.round(dmg * 1.9); type = "crit"; }
          /* lo que encaja el defensor depende de SU arma: el escudo protege */
          dmg = Math.max(1, Math.round(dmg * def.w.def));

          /* ── la mascota se interpone ──
             Se lleva el golpe ENTERO, pero al bruto le llega rozado, no cero:
             lo que se le quita es `absorbe`.

             Esto es lo que hace posible que la mascota reciba daño a menudo.
             Con absorcion total, cada golpe parado era supervivencia
             TRANSFERIDA —ella encaja, tu no— y eso vale tantisimo que subir
             `cubre` para que la barra de vida se moviera disparaba la ventaja
             a +15 y la mascota pasaba a comprar el combate. Medido.

             Partiendo el golpe, `cubre` y ventaja dejan de estar atados: se
             puede interponer en casi todos los combates y seguir valiendo poco.
             Y narrativamente es lo que pasa: el perro se mete, el mandoble le
             alcanza a el, pero a ti te llega igual de refilon. */
          if(def.m && def.m.viva && rnd() < def.m.cubre){
            def.m.hp -= dmg;
            /* lo que NO absorbe le llega al bruto igualmente */
            const pasa = Math.max(0, Math.round(dmg * (1 - def.m.absorbe)));
            if(pasa > 0){
              def.hp = Math.max(0, def.hp - pasa);
              log.push({ turn, type:"cubre", att:att.name, def:def.name, side:def.side,
                         dmg, pasa, mascota:def.m.nombre, hp:def.hp, hpMax:def.hpMax });
            }else{
              log.push({ turn, type:"cubre", att:att.name, def:def.name, side:def.side,
                         dmg, pasa:0, mascota:def.m.nombre });
            }
            if(def.hp <= 0){ log.push({ turn, type:"ko", def:def.name, side:def.side }); }
            if(def.m.hp <= 0){
              def.m.viva = false;
              /* CAE: deja de ayudar el resto del combate, y se anota para que
                 se vea en la arena. Una mascota que desaparece en silencio es
                 una mascota que el jugador cree que no hace nada.

                 Si ademas muere del todo se decide AQUI, con la semilla, para
                 que sea reproducible como el resto del combate. */
              def.m.muerta = rnd() < def.m.mortal;
              log.push({ turn, type:"cae_mascota", side:def.side,
                         mascota:def.m.nombre, definitiva:def.m.muerta });
            }
            continue;
          }

          def.hp = Math.max(0, def.hp - dmg);
          log.push({ turn, type, att:att.name, def:def.name, side:def.side, dmg, hp:def.hp, hpMax:def.hpMax });
          if(def.hp <= 0){ log.push({ turn, type:"ko", def:def.name, side:def.side }); break; }
        }

      }
    }

    const timeout = F.A.hp > 0 && F.B.hp > 0;
    const winner = F.A.hp <= 0 ? "B" : F.B.hp <= 0 ? "A" : (F.A.hp >= F.B.hp ? "A" : "B");
    /* Se devuelve si el arma aguantó: el servidor decide con esto si se rompe. */
    /* `murioA` es lo que el servidor usa para quitarle la mascota al jugador.
       Igual que `perdioA` con el arma: la decisión la toma aquí y la ejecuta
       allí, para que el navegador no pueda decir que su bicho sobrevivió. */
    return { log, winner, timeout, turns: turn, seed,
             armaA: a.arma || "ninguna", perdioA: F.A.sinArma,
             mascotaA: a.mascota || "ninguna",
             /* `cayoA` es informativo; `murioA` es lo que hace que el servidor
                se la quite. Caer pasa a menudo, morir no. */
             cayoA: !!(F.A.m && !F.A.m.viva),
             murioA: !!(F.A.m && F.A.m.muerta) };
  }

  /* ¿Se rompe el arma tras este combate? Lo decide el servidor, nunca el
     navegador: si no, nadie rompería nunca nada. */
  function seRompe(idArma, rnd){
    const w = arma(idArma);
    if(w === PUNOS) return false;
    return (rnd === undefined ? Math.random() : rnd) < w.fragil;
  }

  /* ═══════════ recompensa ═══════════ */
  /* El perdedor se lleva un tercio de las monedas, no cero: castigar la
     derrota con nada hace que la gente deje de pelear cuando va perdiendo. */
  function recompensa(fight, gano){
    const base = 12 + fight.turns;
    return {
      coins: gano ? base : Math.round(base / 3),
      xp:    gano ? 40 + fight.turns * 3 : 12 + fight.turns
    };
  }

  /* Aplica el resultado al bruto. Lo usan el servidor (para escribirlo) y el
     navegador (para pintar el cartel). Que sea la misma función es lo que
     garantiza que el cartel diga lo que de verdad se guardó. */
  function aplicar(bruto, fight, gano){
    const { coins, xp } = recompensa(fight, gano);
    if(gano) bruto.w++; else bruto.l++;
    bruto.xp += xp;

    let subio = false, ganancia = "";
    const need = xpNeed(bruto.lv);
    if(bruto.xp >= need){
      bruto.xp -= need;
      bruto.lv++;
      subio = true;

      /* Una cosa y solo una. Se devuelve CUÁL para que la pantalla lo diga: un
         nivel que no explica qué dio parece un nivel que no dio nada. */
      const dado = Math.random();
      if(dado < PROB_ATRIBUTO){
        ganancia = subirAtributo(bruto);
        /* Con los tres atributos al tope no queda nada que subir: se cae a
           vida en vez de dejar el nivel vacío. */
        if(!ganancia){ bruto.hpMax += HP_NIVEL; ganancia = "hp"; }
      }else if(dado < PROB_ATRIBUTO + PROB_ARMA){
        /* Un arma que aún no tengas. Si las tienes todas, vida. */
        const tiene = bruto.armas || [];
        const faltan = ARMAS_REALES.filter(x => !tiene.includes(x));
        if(faltan.length){
          ganancia = "arma:" + faltan[ri(faltan.length)];
        }else{
          bruto.hpMax += HP_NIVEL; ganancia = "hp";
        }
      }else{
        bruto.hpMax += HP_NIVEL;
        ganancia = "hp";
      }
    }
    return { coins, xp, subio, ganancia };
  }

  globalThis.BruteCombate = {
    VERSION,
    STAT_INI, STAT_VAR, HP_INI, HP_VAR, HP_NIVEL, STAT_MAX, TOPE_TURNOS, PROB_ATRIBUTO, PROB_ARMA,
    OPP_COUNT, LEVEL_SPREAD, FIGHTS_DAY, REROLLS_DAY, NAMES, LOOK_N,
    ARMAS, ARMAS_REALES, arma, seRompe, duracion,
    MASCOTAS, MASCOTAS_REALES, mascota,
    randomLook, barajar, nuevoBot,
    ri, xpNeed, rollStats, subirAtributo, botStats,
    mulberry32, simulate, recompensa, aplicar
  };
})();
