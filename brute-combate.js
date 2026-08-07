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
  const VERSION = 14;  // 11: -5% de vida · 12: nueve armas · 13: diecisiete · 14: mascotas recalibradas

  /* ═══════════ equilibrio ═══════════
     Un bruto nuevo sale flojo a propósito: 1-4 sobre un tope de 10. Si
     naciera cerca del tope, subir de nivel no cambiaría nada y la progresión
     —que es el motor del género— dejaría de existir.
     El tope de 10 no se toca sin recalibrar daño y esquiva. */
  const STAT_INI = 1, STAT_VAR = 4;    // atributos de partida: 1..4
  const HP_INI = 38, HP_VAR = 11;      // vida de partida:      38..48
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
  /* ══════════ el aspecto ══════════
     `LOOK_N` son las opciones QUE VIENEN DE CASA, no las que existen. Las
     tablas de `brute-render.js` pueden ser mas largas, y todo lo que pase de
     aqui se compra. Premium = indice >= LOOK_N[campo].

     Se deriva en vez de llevar una lista de «cuales son de pago», que es lo
     que se desincroniza el dia que se añade un color y a alguien se le olvida
     apuntarlo — y eso no falla, solo regala. */
  const LOOK_N = { sex:2, skin:6, hair:6, hairC:8, cloth:5, clothC:6, face:4, eyeC:8, tat:5, tatC:4 };

  /* Y cuantas hay EN TOTAL. Vive aqui y no en el renderizador porque el
     servidor tiene que poder validar un aspecto sin cargar el arte: la Edge
     Function solo trae este fichero. El arte es el que tiene que cuadrar con
     esto, y hay una prueba que lo comprueba — una tabla paralela sin
     comprobacion es una tabla que miente en cuanto alguien toque la otra. */
  const LOOK_TOTAL = { sex:2, skin:6, hair:8, hairC:12, cloth:5, clothC:9, face:4, eyeC:12, tat:7, tatC:7 };

  /* Lo que se puede comprar, y a cuanto. Los campos que NO estan aqui no
     tienen nada premium: `skin` a proposito —vender el color de piel de tu
     personaje es un sitio al que no hay que ir— y `sex`, `hair`, `cloth`,
     `face` y `tat` porque una opcion nueva ahi es dibujar SVG, no añadir una
     entrada a una lista. Eso vendra, pero es otro trabajo. */
  /* ── Los precios, y por que estos ──────────────────────────────────────
     Con el token a ~0,04 $, un bruto gana 42 monedas al dia = 1,67 $. Y las
     armas y las mascotas ya se llevan el 69% de eso — el optimo que pide el
     TOKEN.md, asi que subirlas mas haria que jugar con equipo costara mas de
     lo que se gana y lo racional pasara a ser pelear a puño limpio.

     Lo que queda libre es el 31%: unas 39 monedas al dia. Ahi entran estos.

     Se multiplicaron por ~4,7 el 07/08. Antes un peinado costaba 90 = 3,60 $,
     o sea dos dias de juego, y esto no participaba en la economia: era calderilla
     al lado de lo que un jugador acumula. Ahora un peinado son diez dias.

     Y se pueden mover sin medir nada, que es lo que los hace el mejor sumidero
     del proyecto: no tocan el daño, ni la esquiva, ni la rotura. */
  const ASPECTO = {
    /* Un peinado o un tatuaje es SVG dibujado a mano; un color es una entrada
       en una lista. Por eso valen el doble: hay diez veces menos y no salen
       solos. */
    hair:   { precio: 400 },
    tat:    { precio: 350 },
    hairC:  { precio: 200 },
    eyeC:   { precio: 200 },
    tatC:   { precio: 180 },
    clothC: { precio: 220 },
  };

  /* La visita al barbero. Se paga CADA cambio, y ese es el sumidero de verdad:
     un cosmetico se compra una vez, pero cambiar de aspecto se hace muchas.

     Y sin barbero los cosmeticos no valen nada: el aspecto se fija al forjar,
     asi que un peinado comprado despues no tendria donde ponerse. */
  /* La visita se queda BARATA a proposito, aunque todo lo demas suba: es lo
     unico que se paga muchas veces, y un sumidero recurrente solo funciona si
     se usa. A diez dias de juego por visita nadie cambiaria de aspecto nunca, y
     entonces tampoco compraria los colores. */
  const PRECIO_BARBERO = 60;

  /* Que opciones de pago usa un aspecto. Devuelve {} si es todo de casa.
     El formato es el mismo que la bolsa del jugador —{campo:[indices]}— para
     que comprobar si las tiene sea comparar dos cosas de la misma forma. */
  function premiumDe(look){
    const usa = {};
    if(!look || typeof look !== "object") return usa;
    for(const campo of Object.keys(ASPECTO)){
      const i = Math.floor(Number(look[campo]));
      if(Number.isInteger(i) && i >= LOOK_N[campo] && i < LOOK_TOTAL[campo]){
        usa[campo] = [i];
      }
    }
    return usa;
  }

  /* Lo que cuesta un aspecto entero: la visita mas lo que no tenga todavia.
     `tiene` es la bolsa del jugador; lo ya comprado no se vuelve a cobrar. */
  function precioAspecto(look, tiene){
    let total = PRECIO_BARBERO;
    const usa = premiumDe(look);
    for(const campo of Object.keys(usa)){
      const mios = (tiene && tiene[campo]) || [];
      for(const i of usa[campo]) if(!mios.includes(i)) total += ASPECTO[campo].precio;
    }
    return total;
  }

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
  /* ── Un bruto de la casa sube como un jugador, UNA cosa por nivel ────────
     Esto daba las DOS: un punto de atributo Y `HP_NIVEL` de vida en cada
     nivel. Un jugador recibe una sola —es la regla «una cosa por nivel, no
     dos»— asi que la casa se separaba mas y mas segun subias:

         nivel  jugador          bot              gana el jugador
           5    58 vida / 8,9    65 vida / 11,5        23,7%
          10    74 vida / 10,6   90 vida / 16,5         7,0%
          20   107 vida / 14,1  140 vida / 26,4         0,7%

     Y no era un descuido pequeño: `CLAUDE.md` decia ya que si los bots usaran
     otra formula «el emparejamiento por nivel seria mentira — mismo numero en
     la ficha, distinta fuerza real». Era exactamente lo que pasaba.

     Ahora se reparte con las mismas probabilidades que `aplicar()`: atributo,
     arma, o vida. El arma se la queda el bot de verdad —antes peleaban todos a
     puño limpio— y como las armas estan equilibradas entre si, eso no le da
     ventaja: le da variedad. */
  function botStats(lv){
    const st = rollStats();
    const tiene = [];
    for(let i = 0; i < lv - 1; i++){
      const dado = Math.random();
      if(dado < PROB_ATRIBUTO){
        if(!subirAtributo(st)) st.hpMax += HP_NIVEL;   // todo al tope: vida
      }else if(dado < PROB_ATRIBUTO + PROB_ARMA){
        const faltan = ARMAS_REALES.filter(x => !tiene.includes(x));
        if(faltan.length) tiene.push(faltan[ri(faltan.length)]);
        else st.hpMax += HP_NIVEL;
      }else{
        st.hpMax += HP_NIVEL;
      }
    }
    /* La que lleva puesta: la ultima que le tocó. Un bruto solo empuña una. */
    st.arma = tiene.length ? tiene[tiene.length - 1] : "ninguna";
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
             w: ri(lv * 3), l: ri(lv * 2), look: randomLook(), bot: true,
             arma: st.arma || "ninguna" };
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
  /* ── NUEVE armas, y las nueve entre 48,5% y 50,9% ─────────────────────────
     Enfrentandolas todas contra todas con brutos identicos. Los daños salen de
     una calibracion, no de la intuicion: la primera tanda dejaba a la guadaña
     en 61% y a los puños en 37%.

     Y hubo que recalibrar TAMBIEN las cinco viejas. Estaban cuadradas entre
     ellas, pero eso deja de valer cuando entran cuatro mas: con nueve, la
     lanza se iba al 55,6% y los puños al 42% sin haberles tocado un numero.
     Medir solo las nuevas contra un grupo desequilibrado es medir contra nada.

     `ninguna` es la VARA DE MEDIR y su daño se queda en 1,000. Moverlo
     cambiaria el daño absoluto de todo el juego y habria que rehacer la curva
     de vida entera.

     ── Cada una se apoya en un mando distinto ──────────────────────────────
     Si solo cambiara el daño serian reskins con otro nombre:

       daga      dos golpes flojos, rapida, critica
       escudo    encaja mucho menos (def 0,75) a cambio de pegar poco
       lanza     alcance: pega mas y se defiende algo peor
       mandoble  el golpe mas fuerte, lento y torpe de esquivar
       hacha     brutal y CRITICA, pero se te cae mucho y se rompe pronto
       maza      lenta de verdad (ini -3) y solida: aguanta y no se rompe
       guadaña   dos tajos amplios, la mas fragil de todas
       baston    defensivo y velocisimo, pega poquisimo, dura 50 combates */
  const ARMAS = {
    /* El `nombre` viaja DENTRO del registro del combate —el evento de desarme
       lo enseña tal cual— y este fichero pasa por el editor de Supabase, que
       mangla el UTF-8. Asi que en ASCII, como los mensajes de la funcion.
       Decia "Puños". Hoy no se puede llegar ahi (sin arma no te desarman) pero
       una mina sin explotar en un fichero que se pega a mano acaba explotando. */
    ninguna:  { id:"ninguna",  nombre:"Sin arma",    nivel:1, golpes:1, dmg:1.000, crit:0.00, esq: 0.00, ini: 0, def:1.00, perder:0,     fragil:0    },
    daga:     { id:"daga",     nombre:"Daga",     nivel:1, golpes:2, dmg:0.468, crit:0.05, esq: 0.02, ini: 2, def:1.00, perder:0.015, fragil:0.03 },
    escudo:   { id:"escudo",   nombre:"Escudo",   nivel:2, golpes:1, dmg:0.759, crit:0.00, esq: 0.01, ini:-1, def:0.72, perder:0.025, fragil:0.05 },
    maza:     { id:"maza",     nombre:"Maza",     nivel:3, golpes:1, dmg:1.021, crit:0.00, esq:-0.02, ini:-3, def:0.92, perder:0.020, fragil:0.04 },
    lanza:    { id:"lanza",    nombre:"Lanza",    nivel:4, golpes:1, dmg:1.057, crit:0.02, esq: 0.00, ini: 1, def:1.06, perder:0.035, fragil:0.06 },
    baston:   { id:"baston",   nombre:"Baston",   nivel:5, golpes:2, dmg:0.397, crit:0.00, esq: 0.04, ini: 3, def:0.85, perder:0.010, fragil:0.02 },
    hacha:    { id:"hacha",    nombre:"Hacha",    nivel:6, golpes:1, dmg:1.192, crit:0.08, esq:-0.04, ini:-1, def:1.10, perder:0.060, fragil:0.10 },
    mandoble: { id:"mandoble", nombre:"Mandoble", nivel:7, golpes:1, dmg:1.319, crit:0.00, esq:-0.05, ini:-2, def:1.12, perder:0.055, fragil:0.09 },
    guadana:  { id:"guadana",  nombre:"Guadana",  nivel:9, golpes:2, dmg:0.529, crit:0.04, esq: 0.00, ini: 0, def:1.05, perder:0.030, fragil:0.11 },

    /* ── La segunda de cada familia ──────────────────────────────────────
       No son mejores: son OTRO TRATO. Si la de nivel 50 pegara mas que la de
       nivel 9, las ocho primeras pasarian a ser decoracion y comprar seria
       ganar — que es lo que hunde a los juegos con token.

       Cada una se diferencia de SU hermana de familia, no solo del resto:

         estoque     la daga son dos golpes flojos; esto es UNO y muy critico
         paves       el escudo protege; este protege muchisimo mas y no pega
         caballero   el mandoble es bruto; esta es fiable y se defiende sola
         tridente    la lanza es alcance; este son TRES golpes muy flojos
         hachadoble  el hacha es critica; esta son dos golpes y se cae mas
         martillo    la maza es lenta; este es LENTISIMO (ini -5) y demoledor
         guerra      la guadaña son dos tajos; esta es uno enorme y de cristal
         herrado     el baston es defensivo; este pega y pierde la defensa

       Medido: contra su hermana, entre 44% y 65%. No son reskins. */
    estoque:    { id:"estoque",    nombre:"Estoque",    nivel:18, golpes:1, dmg:0.866, crit:0.14, esq: 0.03, ini: 4, def:1.04, perder:0.020, fragil:0.05 },
    paves:      { id:"paves",      nombre:"Paves",      nivel:22, golpes:1, dmg:0.614, crit:0.00, esq: 0.00, ini:-4, def:0.55, perder:0.030, fragil:0.05 },
    caballero:  { id:"caballero",  nombre:"Caballero",  nivel:25, golpes:1, dmg:0.886, crit:0.03, esq: 0.01, ini: 0, def:0.88, perder:0.025, fragil:0.05 },
    tridente:   { id:"tridente",   nombre:"Tridente",   nivel:30, golpes:3, dmg:0.369, crit:0.02, esq: 0.00, ini: 1, def:1.08, perder:0.040, fragil:0.07 },
    hachadoble: { id:"hachadoble", nombre:"Hacha doble",nivel:35, golpes:2, dmg:0.682, crit:0.05, esq:-0.05, ini:-2, def:1.14, perder:0.080, fragil:0.11 },
    martillo:   { id:"martillo",   nombre:"Martillo",   nivel:40, golpes:1, dmg:1.204, crit:0.00, esq:-0.06, ini:-5, def:1.00, perder:0.035, fragil:0.05 },
    guerra:     { id:"guerra",     nombre:"Guadana de guerra", nivel:50, golpes:1, dmg:1.175, crit:0.13, esq:-0.06, ini: 2, def:1.22, perder:0.030, fragil:0.08 },
    herrado:    { id:"herrado",    nombre:"Baston herrado",    nivel:60, golpes:2, dmg:0.493, crit:0.02, esq: 0.00, ini: 2, def:1.02, perder:0.020, fragil:0.04 },
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

  /* ── Lo que cuesta recuperar algo perdido ─────────────────────────────────
     El 60% del precio. Y sube el sumidero en vez de bajarlo, aunque parezca lo
     contrario: no todos los que pierden un objeto vuelven a comprarlo. Perder
     un oso de 175 duele y volver a soltar 175 frena a mucha gente. Con
     supuestos razonables, de 100 que lo pierden recompran ~40; con rescate al
     60% lo recuperan ~85, y 85x105 es mas que 40x175.

     Captura a quien NO habria vuelto a comprar. Ese es todo el truco.

     Si se baja mucho, el rescate se convierte en una segunda tienda barata y
     nadie compra a precio completo. Si se sube a 100%, no lo usa nadie. */
  const RESCATE_PCT = 0.60;
  const precioRescate = precio => Math.max(1, Math.round(precio * RESCATE_PCT));

  /* Cuántos combates aguanta de media, para poder enseñarlo en la armería:
     comprar a ciegas algo que se rompe es una mala experiencia. */
  const duracion = id => { const w = ARMAS[id]; return w && w.fragil ? Math.round(1 / w.fragil) : 0; };
  /* Las que pueden tocar o comprarse. Los puños no son un arma, son no llevar. */
  /* Se DERIVA de la tabla. Escrita a mano se desincroniza el primer dia que
     se añada un arma: el premio por subir de nivel seguiria sorteando entre
     las de antes y las nuevas no saldrian nunca sin que nada fallara. */
  const ARMAS_REALES = Object.keys(ARMAS).filter(x => x !== "ninguna");

  /* ── El precio se DERIVA de la duracion, no se escribe ────────────────
     Estaban los diecisiete a mano, cada uno con su coste por combate apuntado
     en un comentario al lado. Y los comentarios mentian: el de la guadaña de
     guerra decia 7,1 y era 9,2, porque al recalibrar las armas cambiaron las
     duraciones y los precios no se tocaron.

     Con el coste yendo de 3,0 a 9,2, las armas dejaban de ser alternativas:
     la barata por combate era estrictamente mejor, que es justo lo contrario
     de lo que dice el diseño. Y no fallaba nada — solo se descuadraba.

     Ahora sale de una multiplicacion, asi que un arma nueva nace con su precio
     puesto y ninguna puede volver a irse. Es lo mismo que ya se hizo con
     `ARMAS_REALES`, que se derivaba en vez de escribirse. */
  const COSTE_COMBATE = 6;
  ARMAS.ninguna.precio = 0;
  for (const id of ARMAS_REALES) {
    /* A multiplos de cinco: un precio de 137 se lee como calculado por una
       maquina, y 135 como puesto por alguien. */
    ARMAS[id].precio = Math.round(COSTE_COMBATE * duracion(id) / 5) * 5;
  }

  /* ═══════════ skins de arma ═══════════
     ── Lo unico que hay que tener claro: NO tocan el equilibrio ──────────────
     Una skin cambia el dibujo y nada mas. Mismo daño, mismo critico, misma
     rotura. Por eso se les puede poner el precio que se quiera sin convertir
     el juego en pagar-para-ganar, y por eso son el mejor sumidero que tiene
     este proyecto: se compran muchas veces y no hay que medir ninguna.

     El pack son 10 tipos x 10 aspectos, asi que cada arma tiene su fila de
     diez. La 0 es la que viene puesta y es gratis.

     ── Y viajan con el BRUTO, no con el jugador ─────────────────────────────
     Podria guardarse «mi daga se ve asi» en el jugador y seria menos codigo.
     Pero entonces el rival no veria tu skin: la lista de rivales sale de
     `brutes`, y un cosmetico que los demas no ven no lo compra nadie. */
  /* `base` es donde empieza la fila de diez. `gratis` es la que viene puesta y
     no se cobra — y NO siempre es la primera: la lanza y el baston de la
     primera columna son un palo sin punta y sin pomo, que se lee como un fallo
     de dibujo antes que como un arma humilde. */
  /* ══════════ FAMILIAS ══════════
     Una familia es una fila del pack de iconos: espadas, hachas, escudos…
     Dentro puede haber VARIAS armas, y esa es la puerta para que sigan
     entrando a niveles altos sin que la armeria se vuelva una tira ilegible.

     Lo que comparten es el ARTE, no las reglas. Dos espadas de la misma
     familia se dibujan con los mismos iconos y se distinguen por el tamaño —
     una corta y un mandoble — pero cada una tiene sus propias constantes y su
     propia medicion.

     Y las skins se compran por FAMILIA. Comprar la espada en llamas y que solo
     valga para una de tus tres espadas seria cobrar tres veces por el mismo
     dibujo. */
  /* La skin de un arma vale lo mismo en todas las familias: el dibujo cuesta
     lo mismo y cobrar distinto por el mismo trabajo no tiene defensa. Antes
     iban de 45 a 60 copiando los precios de las armas, que si son distintas
     porque duran distinto — pero una skin no se rompe. */
  const FAMILIAS = {
    espadas:  { base:  1, precio: 250 },
    dagas:    { base: 11, precio: 250 },
    lanzas:   { base: 41, precio: 250 },
    mazas:    { base: 51, precio: 250 },
    escudos:  { base: 61, precio: 250 },
    guadanas: { base: 71, precio: 250 },
    hachas:   { base: 81, precio: 250 },
    bastones: { base: 91, precio: 250 },
  };
  /* A que familia pertenece cada arma, y cual es su aspecto de casa. */
  const FAMILIA_DE = {
    mandoble:"espadas",  caballero:"espadas",
    daga:"dagas",        estoque:"dagas",
    lanza:"lanzas",      tridente:"lanzas",
    maza:"mazas",        martillo:"mazas",
    escudo:"escudos",    paves:"escudos",
    guadana:"guadanas",  guerra:"guadanas",
    hacha:"hachas",      hachadoble:"hachas",
    baston:"bastones",   herrado:"bastones",
  };

  /* De cada arma solo hace falta cual es su aspecto de casa: la fila y el
     precio salen de su familia. `gratis` NO siempre es el primero de la fila —
     la lanza y el baston de la primera columna son un palo sin punta ni pomo,
     que se lee como un fallo de dibujo antes que como un arma humilde. */
  /* La segunda de cada familia estrena un aspecto mas ornamentado. No da nada
     —sigue siendo la misma fila de diez— pero un arma que se desbloquea a
     nivel 50 y se ve como la de nivel 9 no se siente como una recompensa. */
  const SKINS = {
    mandoble: { gratis: 2 },  caballero:  { gratis: 5 },
    daga:     { gratis: 2 },  estoque:    { gratis: 5 },
    lanza:    { gratis: 2 },  tridente:   { gratis: 5 },
    maza:     { gratis: 1 },  martillo:   { gratis: 4 },
    escudo:   { gratis: 1 },  paves:      { gratis: 4 },
    guadana:  { gratis: 1 },  guerra:     { gratis: 4 },
    hacha:    { gratis: 1 },  hachadoble: { gratis: 4 },
    baston:   { gratis: 1 },  herrado:    { gratis: 4 },
  };
  const SKIN_N = 10;

  /* El fichero que le toca a un arma con la skin `n`. Un numero inventado cae
     a la gratis: no puede dejar a nadie desarmado, que es lo que pasa cuando
     un `<image>` apunta a algo que no existe. */
  function iconoDe(armaId, n){
    const f = SKINS[armaId], fam = FAMILIAS[FAMILIA_DE[armaId]];
    if(!f || !fam) return null;
    const i = Number.isInteger(n) && n >= 0 && n < SKIN_N ? n : f.gratis;
    return "icon_" + String(fam.base + i).padStart(2, "0") + ".png";
  }

  /* Las armas de una familia, en orden de nivel. Es lo que pinta cada menu de
     la armeria — y se DERIVA de `FAMILIA_DE`, no se escribe a mano: una lista
     paralela se desincroniza el dia que entre un arma nueva. */
  function armasDe(familia){
    return Object.keys(ARMAS)
      .filter((id) => FAMILIA_DE[id] === familia)
      .sort((a, b) => (ARMAS[a].nivel || 1) - (ARMAS[b].nivel || 1));
  }

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
    /* ── Recalibradas contra las DIECISIETE armas ────────────────────────
       Estaban cuadradas contra un juego de cinco. Al entrar las demas —y al
       recalibrarse los `dmg` de todas— el entorno cambio y a las mascotas no
       las volvio a medir nadie: la ventaja se habia ido de +7,0 a +9,2 / +10,1
       / +11,2, separadas 2 puntos entre ellas en vez de 0,3, y el sumidero se
       habia encogido solo (morian cada 27-59 combates en vez de cada 20-30).

       Dan MAS ventaja y cuestan MENOS. Es justo la direccion equivocada, y es
       lo mismo que ya avisa la nota de las armas: añadir armas obliga a
       recalibrar lo que ya estaba. Con las mascotas no se hizo.

       Medido emparejado —los mismos brutos y la misma semilla, con mascota y
       sin ella— porque sin emparejar el margen de error es +-1,6 puntos y el
       objetivo esta en 0,3: la primera calibracion estaba persiguiendo ruido.

       `cubre` es COMPARTIDO a proposito: lo que distingue a una mascota de
       otra es como muerde y cuanto aguanta, no cuanto se interpone. Y la
       identidad se fijo A MANO antes de calibrar, porque dejando que el
       calibrador moviera todo salian las tres identicas —misma vida, mismo
       precio— o sea reskins con tres nombres. */
    perro:   { nombre:"perro",   nivel:1,  ataca:0.475, dmg:1, cubre:0.213, absorbe:0.30, hp:24, mortal:0.280, ini:5, precio:80  },
    lobo:    { nombre:"lobo",    nivel:4,  ataca:0.257, dmg:2, cubre:0.213, absorbe:0.30, hp:21, mortal:0.229, ini:5, precio:70  },
    oso:     { nombre:"oso",     nivel:8,  ataca:0.460, dmg:1, cubre:0.213, absorbe:0.30, hp:27, mortal:0.278, ini:5, precio:110 },
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

  /* ── Sin prototipo, y esto no es manía ────────────────────────────────
     Un objeto normal hereda de `Object.prototype`, asi que `ARMAS["constructor"]`
     NO es undefined: es una funcion. Y toda comprobacion escrita como

         const w = ARMAS[id];  if (!w) return "esa arma no existe";

     la da por buena. Con `arma: "constructor"` la ruta seguia adelante con
     `w.precio === undefined`, se lo mandaba a Postgres, y salia un 500 mudo —
     el mismo patron que el `tokens: 1e21` de la preventa: el servidor
     cayendose por algo que el navegador manda cuando quiere.

     Vale para `constructor`, `__proto__`, `toString`, `valueOf` y todo lo que
     cuelgue del prototipo.

     Se arregla en la RAIZ y no ruta por ruta: quitandole el prototipo a las
     tablas, `ARMAS["constructor"]` vuelve a ser undefined y las decenas de
     comprobaciones que ya existen pasan a ser correctas de golpe. Una defensa
     que hay que acordarse de repetir en cada sitio es una defensa que se
     olvida en el sitio nuevo. */
  for (const tabla of [ARMAS, MASCOTAS, SKINS, FAMILIAS, FAMILIA_DE]) {
    Object.setPrototypeOf(tabla, null);
  }

  globalThis.BruteCombate = {
    VERSION,
    STAT_INI, STAT_VAR, HP_INI, HP_VAR, HP_NIVEL, STAT_MAX, TOPE_TURNOS, PROB_ATRIBUTO, PROB_ARMA,
    OPP_COUNT, LEVEL_SPREAD, FIGHTS_DAY, REROLLS_DAY, NAMES, LOOK_N,
    ARMAS, ARMAS_REALES, arma, seRompe, duracion,
    SKINS, SKIN_N, iconoDe, FAMILIAS, FAMILIA_DE, armasDe, RESCATE_PCT, precioRescate,
    MASCOTAS, MASCOTAS_REALES, mascota,
    randomLook, barajar, nuevoBot,
    LOOK_N, LOOK_TOTAL, ASPECTO, PRECIO_BARBERO, premiumDe, precioAspecto,
    ri, xpNeed, rollStats, subirAtributo, botStats,
    mulberry32, simulate, recompensa, aplicar
  };
})();
