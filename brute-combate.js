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
  const VERSION = 7;   // 7: mascotas

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
  const xpNeed = lv => Math.round(80 * Math.pow(lv, 1.5));

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
  const ARMAS = {
    ninguna:  { id:"ninguna",  nombre:"Puños",    golpes:1, dmg:1.00, crit:0.00, esq:0.00, ini:0,  def:1.00, perder:0,     fragil:0    },
    daga:     { id:"daga",     nombre:"Daga",     golpes:2, dmg:0.46, crit:0.05, esq:0.02, ini:2,  def:1.00, perder:0.015, fragil:0.03 },
    mandoble: { id:"mandoble", nombre:"Mandoble", golpes:1, dmg:1.29, crit:0.00, esq:-0.05,ini:-2, def:1.12, perder:0.055, fragil:0.09 },
    lanza:    { id:"lanza",    nombre:"Lanza",    golpes:1, dmg:1.03, crit:0.02, esq:0.00, ini:1,  def:1.06, perder:0.035, fragil:0.06 },
    escudo:   { id:"escudo",   nombre:"Escudo",   golpes:1, dmg:0.74, crit:0.00, esq:0.01, ini:-1, def:0.72, perder:0.025, fragil:0.05 },
  };
  const PUNOS = ARMAS.ninguna;

  /* ── Precios ──
     Puestos para que el coste POR COMBATE sea parecido en todas: como las
     cinco están equilibradas, lo único que cambia entre ellas es cuánto duran.
     Sale a unas 3 monedas por pelea, sobre las ~40 que se ganan al día.

     Es un primer número, no una verdad. Cuando haya jugadores, el panel dirá
     si sobra o falta: si nadie compra, están caras; si todo el mundo lleva
     siempre la misma, están baratas. */
  ARMAS.daga.precio     = 100;   // ~33 combates
  ARMAS.escudo.precio   =  60;   // ~20
  ARMAS.lanza.precio    =  50;   // ~17
  ARMAS.mandoble.precio =  35;   // ~11
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
    ninguna: { nombre:"ninguna", ataca:0,    dmg:0, cubre:0,    hp:0,  ini:0, precio:0 },
    perro:   { nombre:"perro",   ataca:0.15, dmg:3, cubre:0.06, hp:22, ini:2, precio:80  },
    lobo:    { nombre:"lobo",    ataca:0.25, dmg:4, cubre:0.03, hp:15, ini:2, precio:70  },
    oso:     { nombre:"oso",     ataca:0.08, dmg:2, cubre:0.09, hp:34, ini:2, precio:110 },
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
    const order = first === "A" ? ["A","B"] : ["B","A"];
    const log = []; let turn = 0;

    while(F.A.hp > 0 && F.B.hp > 0 && turn < TOPE_TURNOS){
      turn++;
      for(const k of order){
        if(F.A.hp <= 0 || F.B.hp <= 0) break;
        const att = F[k], def = F[k === "A" ? "B" : "A"];

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
             Se come el golpe entero. Si la mata, muere para siempre: no vuelve
             a la bolsa ni se cura entre combates. Es lo que hace que llevarla
             sea una decisión que se repite y no una compra única. */
          if(def.m && def.m.viva && rnd() < def.m.cubre){
            def.m.hp -= dmg;
            log.push({ turn, type:"cubre", att:att.name, def:def.name, side:def.side,
                       dmg, mascota:def.m.nombre });
            if(def.m.hp <= 0){
              def.m.viva = false;
              log.push({ turn, type:"muere_mascota", side:def.side, mascota:def.m.nombre });
            }
            continue;
          }

          def.hp = Math.max(0, def.hp - dmg);
          log.push({ turn, type, att:att.name, def:def.name, side:def.side, dmg, hp:def.hp, hpMax:def.hpMax });
          if(def.hp <= 0){ log.push({ turn, type:"ko", def:def.name, side:def.side }); break; }
        }

        /* ── el mordisco ──
           Después de los golpes del bruto y solo si el rival sigue en pie. No
           puede rematar por su cuenta antes de que el bruto haya atacado: la
           mascota acompaña, no sustituye. */
        if(att.m && att.m.viva && def.hp > 0 && rnd() < att.m.ataca){
          const d = att.m.dmg;
          def.hp = Math.max(0, def.hp - d);
          log.push({ turn, type:"muerde", side:def.side, def:def.name, dmg:d,
                     hp:def.hp, hpMax:def.hpMax, mascota:att.m.nombre });
          if(def.hp <= 0) log.push({ turn, type:"ko", def:def.name, side:def.side });
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
             murioA: !!(F.A.m && !F.A.m.viva) };
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
