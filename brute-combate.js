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
  const VERSION = 2;

  /* ═══════════ equilibrio ═══════════
     Un bruto nuevo sale flojo a propósito: 1-4 sobre un tope de 10. Si
     naciera cerca del tope, subir de nivel no cambiaría nada y la progresión
     —que es el motor del género— dejaría de existir.
     El tope de 10 no se toca sin recalibrar daño y esquiva. */
  const STAT_INI = 1, STAT_VAR = 4;    // atributos de partida: 1..4
  const HP_INI = 40, HP_VAR = 11;      // vida de partida:      40..50
  const HP_NIVEL = 2;                  // vida que suma cada nivel
  const STAT_MAX = 10;
  const TOPE_TURNOS = 40;              // sin él, dos brutos muy esquivos no acabarían

  /* Subir de nivel NO garantiza un atributo: sale 4 de cada 10 veces. Es lo
     que los hace escasos de verdad.

     El resto de veces solo das vida, y es a propósito que sea poca: probamos
     compensar con vida extra y los combates pasaban de 7 turnos a 19, porque
     la vida crecía y el daño no. Un bruto de nivel 20 pasa de 8,8 de media por
     atributo a 5,0, y las peleas solo se alargan de 7 a 8 turnos.

     Cuando existan armas y mascotas, este es el hueco donde entran: el 60%
     que hoy solo da vida será donde caiga el botín. */
  const PROB_ATRIBUTO = 0.40;

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
    const F = { A:{ ...a, hp:a.hpMax, side:"A" }, B:{ ...b, hp:b.hpMax, side:"B" } };
    const first = F.A.spd > F.B.spd ? "A" : F.B.spd > F.A.spd ? "B" : (rnd() < .5 ? "A" : "B");
    const order = first === "A" ? ["A","B"] : ["B","A"];
    const log = []; let turn = 0;

    while(F.A.hp > 0 && F.B.hp > 0 && turn < TOPE_TURNOS){
      turn++;
      for(const k of order){
        if(F.A.hp <= 0 || F.B.hp <= 0) break;
        const att = F[k], def = F[k === "A" ? "B" : "A"];
        /* esquiva: 6% + agilidad × 1.9% */
        if(rnd() < 0.06 + def.agi * 0.019){
          log.push({ turn, type:"dodge", att:att.name, def:def.name, side:def.side });
          continue;
        }
        /* daño: (3 + fuerza × 1.45) × (0.8 a 1.2) */
        let dmg = Math.round((3 + att.str * 1.45) * (0.8 + rnd() * 0.4)), type = "hit";
        /* crítico: 5% + agilidad × 1.4%, multiplica por 1.9 */
        if(rnd() < 0.05 + att.agi * 0.014){ dmg = Math.round(dmg * 1.9); type = "crit"; }
        def.hp = Math.max(0, def.hp - dmg);
        log.push({ turn, type, att:att.name, def:def.name, side:def.side, dmg, hp:def.hp, hpMax:def.hpMax });
        if(def.hp <= 0){ log.push({ turn, type:"ko", def:def.name, side:def.side }); break; }
      }
    }

    const timeout = F.A.hp > 0 && F.B.hp > 0;
    const winner = F.A.hp <= 0 ? "B" : F.B.hp <= 0 ? "A" : (F.A.hp >= F.B.hp ? "A" : "B");
    return { log, winner, timeout, turns: turn, seed };
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
      bruto.hpMax += HP_NIVEL;
      subio = true;
      /* El atributo no está garantizado. Se devuelve QUÉ tocó para que la
         pantalla lo diga: un nivel que solo da vida y no lo explica parece un
         nivel que no dio nada. */
      ganancia = (Math.random() < PROB_ATRIBUTO) ? (subirAtributo(bruto) || "hp") : "hp";
    }
    return { coins, xp, subio, ganancia };
  }

  globalThis.BruteCombate = {
    VERSION,
    STAT_INI, STAT_VAR, HP_INI, HP_VAR, HP_NIVEL, STAT_MAX, TOPE_TURNOS, PROB_ATRIBUTO,
    ri, xpNeed, rollStats, subirAtributo, botStats,
    mulberry32, simulate, recompensa, aplicar
  };
})();
