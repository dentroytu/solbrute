/* ══════════════════════════════════════════════════════════════════════════
   SolBrute · las entradas del blog
   ══════════════════════════════════════════════════════════════════════════
   Un fichero, una lista, sin base de datos ni panel. Es lo que pedia
   `IDEAS.md`: «lo barato es hacerlo como el resto, una carpeta de ficheros y
   una pagina que los lista».

   ── Script clasico a proposito, como `brute-render.js` ────────────────────
   Se expone en `window.BlogEntradas` en vez de usar `export`. Con
   <script type="module"> el blog dejaria de abrirse con doble clic: sobre
   `file://` el origen es `null` y el navegador bloquea el modulo por CORS.

   ── Como se añade una entrada ─────────────────────────────────────────────
   Se copia un objeto de abajo y se cambia. Reglas, y son las mismas que rigen
   el resto del proyecto:

   1. Los tres idiomas SIEMPRE. Si falta uno, `blog.html` cae a `en`, pero
      entonces un frances lee ingles sin saber por que.
   2. `id` es la URL (`blog.html?post=ese-id`). No se cambia nunca una vez
      publicada: un enlace compartido que deja de funcionar es peor que no
      haberlo dado.
   3. `fecha` en ISO. La lista se ordena por ella, de nueva a vieja.
   4. La ilustracion NO es una foto: es un `look` de diez enteros que dibuja
      `brute-render.js`. Sin ficheros externos, que sobre `file://` no cargan
      y dejarian el hueco en blanco.

   ── El cuerpo va en bloques, no en HTML ───────────────────────────────────
   Cada bloque es `{ t: tipo, x: contenido }` y `blog.html` los pinta pasando
   TODO por `esc()`. Escribir HTML aqui parece mas comodo y abre la puerta a
   que un dia alguien pegue algo con una etiqueta dentro.

       p    parrafo            x: "texto"
       h    subtitulo          x: "texto"
       ul   lista              x: ["uno", "dos"]
       q    cita destacada     x: "texto"
       kv   tabla de dos       x: [["clave", "valor"], …]
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  window.BlogEntradas = [

    /* ═══════════════════════════════════════════════════════════════════ */
    {
      id: "limpieza-en-el-ludus",
      fecha: "2026-08-07",
      tag: "mantenimiento",
      look: { sex: 0, skin: 2, hair: 4, hairC: 0, cloth: 2, clothC: 3, face: 1, eyeC: 2, tat: 0, tatC: 0 },

      es: {
        titulo: "Limpieza en el ludus",
        resumen: "Cinco de los once brutos que habia en la base no los habia creado nadie: los dejaron scripts de prueba. Salian en la clasificacion y te tocaban como rival.",
        cuerpo: [
          { t: "p", x: "Al revisar la base nos encontramos once brutos, y cinco no eran de ningun jugador. Los habian dejado los scripts con los que probamos el juego, y se reconocian por el nombre: un prefijo y los seis ultimos digitos del reloj." },
          { t: "p", x: "No es suciedad que se pueda ignorar. Los brutos de la casa se generan en tu navegador y no se guardan nunca, asi que la tabla de brutos ES la clasificacion, y de ahi sale el emparejamiento. Un bruto de script ahi dentro sale como si fuera una persona. Y ya habia pasado: una de las peleas guardadas es un jugador de verdad contra uno de ellos." },
          { t: "h", x: "Lo que costo hacerlo bien" },
          { t: "p", x: "Borrar cuentas no es borrar filas. Cada una tenia monedas, y las monedas de este juego tienen una regla que se cumple siempre:" },
          { t: "q", x: "en circulacion + reserva restante = reserva total" },
          { t: "p", x: "Si se borra un jugador a secas, sus monedas desaparecen: la circulacion baja y la reserva no sube. No es imprimir dinero, es quemarlo, pero descuadra los libros para siempre. Asi que las 73 monedas de esas cuentas se devolvieron a la reserva, y la cuenta sigue dando exactamente cuarenta millones." },
          { t: "h", x: "Y las peleas no se perdieron" },
          { t: "p", x: "Las peleas contra esos brutos siguen ahi y se siguen comprobando. Cuando peleas, se guarda una copia congelada del rival, asi que el combate se puede recalcular aunque el rival ya no exista. Lo comprobamos despues de borrar: nueve turnos, treinta y cuatro eventos, todo cuadra." }
        ]
      },

      en: {
        titulo: "Cleaning out the ludus",
        resumen: "Five of the eleven brutes in the database were created by nobody: test scripts left them behind. They showed up in the rankings and you could be matched against them.",
        cuerpo: [
          { t: "p", x: "Reviewing the database we found eleven brutes, and five belonged to no player. Test scripts had left them there, and you could spot them by name: a prefix plus the last six digits of the clock." },
          { t: "p", x: "This is not dirt you can ignore. House brutes are generated in your browser and never saved, so the brutes table IS the leaderboard, and matchmaking draws from it. A script brute in there looks exactly like a person. And it had already happened: one of the saved fights is a real player against one of them." },
          { t: "h", x: "What made it harder than it looks" },
          { t: "p", x: "Deleting accounts is not deleting rows. Each one held coins, and coins in this game obey a rule that always holds:" },
          { t: "q", x: "in circulation + remaining reserve = total reserve" },
          { t: "p", x: "Delete a player outright and their coins vanish: circulation drops and the reserve does not rise. That is not printing money, it is burning it, but it throws the books off forever. So the 73 coins in those accounts went back to the reserve, and the sum still lands on exactly forty million." },
          { t: "h", x: "And no fights were lost" },
          { t: "p", x: "Fights against those brutes are still there and still verify. When you fight, a frozen copy of your opponent is stored, so the battle can be recomputed even if that opponent no longer exists. We checked after deleting: nine turns, thirty-four events, everything matches." }
        ]
      },

      fr: {
        titulo: "Grand menage dans le ludus",
        resumen: "Cinq des onze brutes de la base n'avaient ete crees par personne : des scripts de test les avaient laisses. Ils apparaissaient au classement et pouvaient vous etre opposes.",
        cuerpo: [
          { t: "p", x: "En passant la base en revue, nous avons trouve onze brutes, dont cinq n'appartenaient a aucun joueur. Des scripts de test les avaient laisses la, et leur nom les trahissait : un prefixe suivi des six derniers chiffres de l'horloge." },
          { t: "p", x: "Ce n'est pas une salete qu'on peut ignorer. Les brutes de la maison sont generees dans votre navigateur et jamais enregistrees : la table des brutes EST le classement, et l'appariement y puise. Une brute de script y ressemble trait pour trait a une personne. Et c'etait deja arrive : l'un des combats enregistres oppose un vrai joueur a l'une d'elles." },
          { t: "h", x: "Ce qui a rendu la chose delicate" },
          { t: "p", x: "Supprimer des comptes n'est pas supprimer des lignes. Chacun detenait des pieces, et les pieces de ce jeu obeissent a une regle qui tient toujours :" },
          { t: "q", x: "en circulation + reserve restante = reserve totale" },
          { t: "p", x: "Supprimer un joueur sans plus, et ses pieces disparaissent : la circulation baisse et la reserve ne monte pas. Ce n'est pas imprimer de la monnaie, c'est la bruler, mais les comptes sont fausses pour toujours. Les 73 pieces de ces comptes sont donc retournees a la reserve, et la somme donne toujours exactement quarante millions." },
          { t: "h", x: "Et aucun combat n'a ete perdu" },
          { t: "p", x: "Les combats contre ces brutes sont toujours la et se verifient toujours. Quand vous combattez, une copie figee de l'adversaire est enregistree : la bataille peut donc etre recalculee meme si cet adversaire n'existe plus. Nous l'avons verifie apres suppression : neuf tours, trente-quatre evenements, tout concorde." }
        ]
      }
    },

    /* ═══════════════════════════════════════════════════════════════════ */
    {
      id: "la-barberia",
      fecha: "2026-08-06",
      tag: "contenido",
      look: { sex: 1, skin: 1, hair: 2, hairC: 5, cloth: 3, clothC: 1, face: 2, eyeC: 4, tat: 3, tatC: 2 },

      es: {
        titulo: "La barberia abre sus puertas",
        resumen: "Hasta ahora el aspecto se fijaba al forjar y no se podia cambiar nunca. Ahora se puede, cuesta, y esa es exactamente la idea.",
        cuerpo: [
          { t: "p", x: "Elegias la cara de tu bruto una vez, en la forja, y cargabas con ella para siempre. Con eso, vender un peinado no tiene sentido: forjas tres veces en la vida de tu cuenta y ademas comprarias a ciegas, antes de ver como te queda." },
          { t: "p", x: "Asi que lo que se vende no son los cosmeticos: es poder cambiar. Un peinado se compra una vez; cambiar de aspecto se hace muchas. Cada visita se paga, tengas ya lo que te pongas o no." },
          { t: "h", x: "Dos peinados y dos tatuajes nuevos" },
          { t: "p", x: "Y los dos primeros intentos se tiraron a la basura, sin que nada fallara. El primer peinado era un moño alto con los laterales rapados, y se veia casi igual que uno gratis: un cosmetico que se confunde con uno que ya tienes no vale nada. Ahora es media cabeza rapada, asimetrico, y no hay ningun otro asi." },
          { t: "p", x: "El primer tatuaje era una espiral en la mejilla, y a ese tamaño salia un borron rojo que parecia una herida. Se cambio por tres zarpazos: lineas rectas, que se leen a cualquier tamaño." },
          { t: "h", x: "Un detalle que decide donde va un tatuaje" },
          { t: "p", x: "Los tatuajes de pago van en la mejilla, nunca en la frente. El pelo se dibuja por encima de la cara, asi que uno arriba lo tapa el peinado — y un cosmetico que desaparece segun lo que lleves puesto no lo compra nadie." },
          { t: "p", x: "La visita se queda barata a proposito, aunque todo lo demas suba. Es lo unico que se paga muchas veces, y algo asi solo funciona si se usa: a diez dias de juego por visita, nadie cambiaria de aspecto nunca." }
        ]
      },

      en: {
        titulo: "The barbershop opens",
        resumen: "Until now your look was fixed at the forge and could never change. Now it can, it costs, and that is exactly the point.",
        cuerpo: [
          { t: "p", x: "You picked your brute's face once, at the forge, and carried it forever. With that, selling a haircut makes no sense: you forge three times in the life of your account, and you would be buying blind, before seeing how it looks on you." },
          { t: "p", x: "So what is on sale is not the cosmetics: it is being able to change. A haircut is bought once; changing your look happens many times. Every visit is paid for, whether you already own what you put on or not." },
          { t: "h", x: "Two new haircuts and two new tattoos" },
          { t: "p", x: "And the first attempt at each went in the bin, without anything failing. The first haircut was a high bun with shaved sides, and it looked almost identical to a free one: a cosmetic you confuse with something you already have is worth nothing. It is now a half-shaved head, asymmetric, and there is no other like it." },
          { t: "p", x: "The first tattoo was a spiral on the cheek, and at that size it came out as a red smudge that looked like a wound. It became three claw marks instead: straight lines, readable at any size." },
          { t: "h", x: "One detail that decides where a tattoo goes" },
          { t: "p", x: "Paid tattoos go on the cheek, never the forehead. Hair is drawn on top of the face, so one up there gets covered by your haircut — and a cosmetic that disappears depending on what you are wearing is one nobody buys." },
          { t: "p", x: "The visit stays cheap on purpose, even as everything else gets pricier. It is the only thing paid over and over, and that only works if people use it: at ten days of play per visit, nobody would ever change their look." }
        ]
      },

      fr: {
        titulo: "Le barbier ouvre boutique",
        resumen: "Jusqu'ici, l'apparence etait fixee a la forge et ne changeait jamais. Elle peut changer, cela coute, et c'est precisement l'idee.",
        cuerpo: [
          { t: "p", x: "Vous choisissiez le visage de votre brute une fois, a la forge, et vous le gardiez pour toujours. Dans ces conditions, vendre une coiffure n'a aucun sens : on forge trois fois dans la vie d'un compte, et on acheterait a l'aveugle, avant de voir le rendu." },
          { t: "p", x: "Ce qui se vend n'est donc pas le cosmetique : c'est de pouvoir changer. Une coiffure s'achete une fois ; changer d'apparence se fait souvent. Chaque visite se paie, que vous possediez deja ce que vous mettez ou non." },
          { t: "h", x: "Deux coiffures et deux tatouages inedits" },
          { t: "p", x: "Et la premiere version de chacun est partie a la poubelle, sans que rien ne plante. La premiere coiffure etait un chignon haut aux cotes rases, presque identique a une coiffure gratuite : un cosmetique qu'on confond avec ce qu'on possede deja ne vaut rien. C'est desormais un crane a moitie rase, asymetrique, et il n'y en a aucun autre comme ca." },
          { t: "p", x: "Le premier tatouage etait une spirale sur la joue, et a cette taille cela donnait une tache rouge qui ressemblait a une blessure. Il est devenu trois coups de griffe : des lignes droites, lisibles a toute taille." },
          { t: "h", x: "Un detail qui decide de l'emplacement" },
          { t: "p", x: "Les tatouages payants vont sur la joue, jamais sur le front. Les cheveux se dessinent par-dessus le visage : un tatouage la-haut serait recouvert par la coiffure — et un cosmetique qui disparait selon ce qu'on porte, personne ne l'achete." },
          { t: "p", x: "La visite reste bon marche a dessein, meme quand tout le reste augmente. C'est la seule chose qu'on paie encore et encore, et cela ne fonctionne que si on l'utilise : a dix jours de jeu la visite, personne ne changerait jamais d'apparence." }
        ]
      }
    },

    /* ═══════════════════════════════════════════════════════════════════ */
    {
      id: "diecisiete-armas-medidas",
      fecha: "2026-08-05",
      tag: "equilibrio",
      look: { sex: 0, skin: 3, hair: 1, hairC: 2, cloth: 4, clothC: 0, face: 0, eyeC: 1, tat: 2, tatC: 4 },

      es: {
        titulo: "Diecisiete armas, y ninguna es la mejor",
        resumen: "Las enfrentamos todas contra todas con brutos identicos. Ninguna se despega: entre 47,6% y 51,7% de victorias.",
        cuerpo: [
          { t: "p", x: "Un arma que gana mas que las otras convierte comprar en ganar, y entonces el juego se vende solo — mal. Asi que las diecisiete se midieron enfrentandolas todas contra todas, con brutos identicos y miles de combates." },
          { t: "kv", x: [["Mejor arma", "51,7% de victorias"], ["Peor arma", "47,6%"], ["Desvio maximo", "2,4 puntos"]] },
          { t: "p", x: "Cada familia tiene dos armas, y la segunda se desbloquea mucho mas tarde. Pero no es mas fuerte: es otro trato. La daga son dos golpes flojos y rapidos; el estoque es uno solo, rapidisimo y critico. El baston se defiende solo; el herrado pega y pierde esa defensa." },
          { t: "q", x: "Si la de nivel 60 pegara mas, las otras dieciseis serian decoracion." },
          { t: "h", x: "Lo que de verdad las equilibra: que se pierden" },
          { t: "p", x: "Cada arma se te puede caer en mitad del combate, y se puede romper para siempre. Sin esas dos cosas, pelear a puño limpio ganaba el 44% de las veces; con ellas, el 50%. Un arma que se te puede caer no es una ventaja fiable, y eso es lo que permite venderlas." },
          { t: "p", x: "Y la mas fuerte es la que menos dura: el mandoble aguanta unos once combates y la daga treinta y tres. El poder cuesta mantenerlo." },
          { t: "h", x: "Piedra, papel o tijera de verdad" },
          { t: "p", x: "Cada arma tiene victimas y verdugos. El baston gana a la daga el 69% de las veces, la guadaña al escudo el 65%, el escudo al mandoble el 61%, y el mandoble al baston el 61%. El circulo se cierra." },
          { t: "p", x: "Un aviso para quien mire los numeros: añadir armas obliga a recalibrar las que ya estaban. Con solo cinco estaban cuadradas entre ellas, y al entrar cuatro mas la lanza se fue al 55,6% sin que nadie le tocara un numero." }
        ]
      },

      en: {
        titulo: "Seventeen weapons, and none of them is best",
        resumen: "We ran them all against each other with identical brutes. None pulls ahead: between 47.6% and 51.7% wins.",
        cuerpo: [
          { t: "p", x: "A weapon that wins more than the others turns buying into winning, and then the game sells itself — badly. So all seventeen were measured head to head, with identical brutes and thousands of fights." },
          { t: "kv", x: [["Best weapon", "51.7% wins"], ["Worst weapon", "47.6%"], ["Maximum spread", "2.4 points"]] },
          { t: "p", x: "Each family has two weapons, and the second unlocks much later. But it is not stronger: it is a different deal. The dagger is two weak fast strikes; the rapier is a single one, blistering and prone to crits. The staff defends itself; the ironshod one hits and gives that up." },
          { t: "q", x: "If the level 60 weapon hit harder, the other sixteen would be decoration." },
          { t: "h", x: "What really balances them: you lose them" },
          { t: "p", x: "Every weapon can be knocked out of your hands mid-fight, and can break for good. Without those two, bare fists won 44% of the time; with them, 50%. A weapon you might drop is not a reliable advantage, and that is what makes it sellable." },
          { t: "p", x: "And the strongest lasts the least: the greatsword survives about eleven fights, the dagger thirty-three. Power costs upkeep." },
          { t: "h", x: "Actual rock, paper, scissors" },
          { t: "p", x: "Every weapon has prey and predators. The staff beats the dagger 69% of the time, the scythe beats the shield 65%, the shield beats the greatsword 61%, and the greatsword beats the staff 61%. The circle closes." },
          { t: "p", x: "A warning for anyone reading the numbers: adding weapons forces you to recalibrate the ones already there. With only five they were balanced against each other, and when four more arrived the spear drifted to 55.6% without anyone touching a single value." }
        ]
      },

      fr: {
        titulo: "Dix-sept armes, et aucune n'est la meilleure",
        resumen: "Nous les avons toutes opposees entre elles avec des brutes identiques. Aucune ne se detache : entre 47,6 % et 51,7 % de victoires.",
        cuerpo: [
          { t: "p", x: "Une arme qui gagne plus que les autres transforme l'achat en victoire, et le jeu se vend alors tout seul — mal. Les dix-sept ont donc ete mesurees toutes contre toutes, avec des brutes identiques et des milliers de combats." },
          { t: "kv", x: [["Meilleure arme", "51,7 % de victoires"], ["Pire arme", "47,6 %"], ["Ecart maximal", "2,4 points"]] },
          { t: "p", x: "Chaque famille compte deux armes, la seconde se debloquant bien plus tard. Mais elle n'est pas plus forte : c'est un autre marche. La dague, ce sont deux coups faibles et rapides ; la rapiere, un seul, fulgurant et critique. Le baton se defend seul ; le baton ferre frappe et perd cette defense." },
          { t: "q", x: "Si l'arme de niveau 60 frappait plus fort, les seize autres ne seraient que decoration." },
          { t: "h", x: "Ce qui les equilibre vraiment : on les perd" },
          { t: "p", x: "Chaque arme peut vous tomber des mains en plein combat, et se briser definitivement. Sans ces deux regles, les poings nus gagnaient 44 % du temps ; avec elles, 50 %. Une arme qui peut vous echapper n'est pas un avantage fiable, et c'est ce qui permet de la vendre." },
          { t: "p", x: "Et la plus forte est celle qui dure le moins : l'espadon tient une onzaine de combats, la dague trente-trois. La puissance coute son entretien." },
          { t: "h", x: "Pierre, feuille, ciseaux pour de vrai" },
          { t: "p", x: "Chaque arme a ses proies et ses bourreaux. Le baton bat la dague 69 % du temps, la faux bat le bouclier 65 %, le bouclier bat l'espadon 61 %, et l'espadon bat le baton 61 %. La boucle est bouclee." },
          { t: "p", x: "Un avertissement pour qui lit les chiffres : ajouter des armes oblige a recalibrer celles qui existaient. A cinq elles etaient equilibrees entre elles, et l'arrivee de quatre autres a fait deriver la lance a 55,6 % sans que personne ne touche a une seule valeur." }
        ]
      }
    },

    /* ═══════════════════════════════════════════════════════════════════ */
    {
      id: "cada-pelea-tiene-su-enlace",
      fecha: "2026-08-04",
      tag: "transparencia",
      look: { sex: 1, skin: 0, hair: 5, hairC: 3, cloth: 0, clothC: 2, face: 3, eyeC: 0, tat: 0, tatC: 0 },

      es: {
        titulo: "Cada pelea tiene su enlace, y se comprueba sola",
        resumen: "No solo puedes enseñar un combate: quien lo abra lo recalcula en su propio navegador y compara evento por evento.",
        cuerpo: [
          { t: "p", x: "Decimos que el combate es verificable desde el primer dia. Durante un tiempo eso fue una promesa a medias: la arquitectura lo permitia, pero no habia ninguna herramienta con la que nadie pudiera comprobar nada." },
          { t: "p", x: "Ahora cada pelea tiene su direccion, y no hace falta cuenta ni cartera para verla." },
          { t: "p", x: "Lo importante no es que la enseñe: es que la RECALCULA. En el navegador de quien mira, con el mismo fichero de reglas que usa el servidor, y comparando el registro entero — no solo quien gano." },
          { t: "h", x: "Para recalcular una pelea hacen falta cuatro cosas" },
          { t: "p", x: "La semilla, los dos brutos tal y como entraron a la arena, y la version de las reglas con la que se jugo. Durante un tiempo se guardaban tres, y faltaba justo la que hacia falta: tu propio bruto se guardaba como una referencia, y como sube de nivel despues, un segundo mas tarde ya no era el mismo." },
          { t: "h", x: "«No cuadra» y «no lo puedo comprobar» no son lo mismo" },
          { t: "p", x: "Una pelea vieja, jugada antes de que se apuntara la version de las reglas, no se puede recalcular: hacerlo con las de hoy daria otro combate. La pagina lo dice tal cual en vez de fingir que la verifica. Confundir esas dos cosas, en la unica pagina que existe para demostrar que no te engañamos, seria el peor sitio para hacerlo." },
          { t: "h", x: "Un verificador que aprueba todo es peor que ninguno" },
          { t: "p", x: "Por eso hay una prueba que fabrica peleas manipuladas y exige que salten todas: el ganador cambiado, los turnos inflados, un evento borrado, uno inventado, y un solo golpe retocado en 1 de daño." }
        ]
      },

      en: {
        titulo: "Every fight has its own link, and it checks itself",
        resumen: "You can not only show a fight: whoever opens it recomputes it in their own browser and compares event by event.",
        cuerpo: [
          { t: "p", x: "We have said combat is verifiable since day one. For a while that was half a promise: the architecture allowed it, but there was no tool with which anyone could actually check anything." },
          { t: "p", x: "Now every fight has an address, and you need no account and no wallet to see it." },
          { t: "p", x: "The point is not that it shows the fight: it is that it RECOMPUTES it. In the browser of whoever is looking, with the same rules file the server uses, comparing the entire log — not just who won." },
          { t: "h", x: "Recomputing a fight takes four things" },
          { t: "p", x: "The seed, both brutes exactly as they entered the arena, and the version of the rules it was played under. For a while only three were stored, and the missing one was precisely the one that mattered: your own brute was saved as a reference, and since it levels up afterwards, a second later it was no longer the same." },
          { t: "h", x: "\"Does not match\" and \"cannot be checked\" are different" },
          { t: "p", x: "An old fight, played before the rules version was recorded, cannot be recomputed: doing it with today's rules would produce a different battle. The page says so plainly instead of pretending to verify it. Confusing those two, on the one page that exists to prove we are not cheating you, would be the worst possible place to do it." },
          { t: "h", x: "A verifier that approves everything is worse than none" },
          { t: "p", x: "That is why a test builds tampered fights and demands every one of them be caught: a switched winner, inflated turns, a deleted event, an invented one, and a single blow altered by 1 damage." }
        ]
      },

      fr: {
        titulo: "Chaque combat a son lien, et il se verifie tout seul",
        resumen: "Vous ne faites pas que montrer un combat : celui qui l'ouvre le recalcule dans son propre navigateur et compare evenement par evenement.",
        cuerpo: [
          { t: "p", x: "Nous disons que le combat est verifiable depuis le premier jour. Longtemps, ce fut une demi-promesse : l'architecture le permettait, mais aucun outil ne permettait a quiconque de verifier quoi que ce soit." },
          { t: "p", x: "Desormais chaque combat a son adresse, et il ne faut ni compte ni portefeuille pour le consulter." },
          { t: "p", x: "L'essentiel n'est pas qu'il l'affiche : c'est qu'il le RECALCULE. Dans le navigateur de celui qui regarde, avec le meme fichier de regles que le serveur, en comparant tout le journal — pas seulement le vainqueur." },
          { t: "h", x: "Recalculer un combat demande quatre choses" },
          { t: "p", x: "La graine, les deux brutes telles qu'elles sont entrees dans l'arene, et la version des regles utilisee. Pendant un temps, trois seulement etaient conservees, et celle qui manquait etait justement la bonne : votre propre brute etait enregistree comme une reference, et comme elle monte de niveau ensuite, une seconde plus tard ce n'etait deja plus la meme." },
          { t: "h", x: "« Ne concorde pas » et « je ne peux pas verifier » different" },
          { t: "p", x: "Un vieux combat, joue avant que la version des regles ne soit notee, ne peut pas etre recalcule : le refaire avec les regles d'aujourd'hui donnerait un autre combat. La page le dit franchement au lieu de faire semblant de le verifier. Confondre les deux, sur la seule page qui existe pour prouver qu'on ne vous trompe pas, serait le pire endroit pour le faire." },
          { t: "h", x: "Un verificateur qui approuve tout est pire que rien" },
          { t: "p", x: "C'est pourquoi un test fabrique des combats truques et exige qu'ils soient tous detectes : vainqueur inverse, tours gonfles, evenement supprime, evenement invente, et un seul coup modifie de 1 point de degat." }
        ]
      }
    }

  ];
})();
