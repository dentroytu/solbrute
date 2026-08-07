# SolBrute · todo lo que hay, lo que falta y lo que se podría hacer

Este fichero es la lista larga. `CLAUDE.md` explica **por qué** está hecho cada
cosa; esto es **qué queda**, ordenado por lo que de verdad importa.

Fecha de corte: **7 de agosto de 2026**.

---

## 1 · Antes de que exista dinero de verdad

Todo esto va antes de mainnet. No es opcional y **ninguna es código**.

| | Qué | Estado |
|---|---|---|
| ✅ | ~~Lo legal~~ — cerrado y en orden, según el dueño | hecho |
| ⬜ | **Las claves frías las creas tú**, en papel, y no me las enseñas nunca | sin empezar |
| ⬜ | **Presupuesto de SOL** para la wallet operativa, y vigilarlo | sin empezar |
| ✅ | RPC de pago (`SOLANA_RPC`, Helius) | hecho, en devnet |
| ⬜ | Verificar el dato de «~400 ms» de Solana que dice la landing | sin comprobar |

**Lo legal es lo que puede tirar el proyecto entero**, no un trámite. Una
preventa es una venta de un activo a personas, y eso tiene forma jurídica en
cualquier país. No sé de leyes y no voy a improvisar: hace falta alguien que
sepa, y antes de aceptar el primer euro.

Lo del SOL de la operativa parece menor y no lo es: en devnet, quedarse sin SOL
**falló diciendo otra cosa** y costó horas buscar el fallo donde no estaba. Con
0,5 SOL alcanza para unas 245 retiradas a jugadores nuevos.

---

## 2 · El lanzamiento del token, en orden

Es el orden que ya está construido. No se puede reordenar sin romper algo.

```
1. crear el mint en mainnet     100M · 9 decimales · las dos autoridades a null
2. secretos                     SOLANA_MINT · SOLANA_PREVENTA · SOLANA_RPC → mainnet
3. configurar y abrir la venta  desde el panel, con el aviso de red en rojo
4. vender
5. crear el pool de liquidez    ← aquí pones tú el precio de referencia
6. fondear la wallet de entrega tokens vendidos + SOL de comisiones y rentas
7. abrir los reclamos           el panel te dice si hay con qué pagarlos
8. aplicar `supabase-29-valvula.sql` y poner `respaldo_tokens`
9. abrir las retiradas del juego
```

**Las dos autoridades a `null` antes de que nadie compre.** Si quedan puestas,
cualquiera que mire el token ve que puedes imprimir más cuando quieras, y con
razón se va.

**El paso 5 va entre vender y entregar a propósito.** Quien recibe tokens sin
mercado los vende contra un pool que no está, y entonces el precio de salida lo
pone él y no tú.

**El paso 8 no sirve de nada antes del 1.** La válvula (`tokens_por_moneda =
min(objetivo, respaldo / deuda)`) necesita un `respaldo_tokens` real, y hasta que
el token exista ese número es cero.

Y una cosa incómoda que conviene decir en voz alta: **entre que alguien paga y
recibe, su dinero está en tu wallet y él no tiene nada.** Eso es custodia y no
hay forma de que no lo sea. Lo único que se puede hacer —y está hecho— es que
sea verificable en cada paso.

**Los pasos 3 y 4 ya se ensayaron enteros en devnet.** La venta estuvo abierta
del 03/08 al 07/08/2026, cobró un pago de verdad —contra la cadena, verificado
por `postBalances`— y se cerró desde el panel. Así que lo que queda de esta
lista no es código sin probar: es el mismo camino con el mint de mainnet
puesto.

**Con una deuda del ensayo:** esa compra de prueba sigue en `preventa_compras`
como `pagada`. Antes del paso 3 hay que sacarla, o el paso 7 entrega tokens
reales por SOL de devnet. Ver el apartado 8.

---

## 3 · Los sumideros, que son la mitad de la economía

Del `TOKEN.md`: **que la gente gaste importa el doble que la comisión.** Del 30%
al 70% de gasto, la reserva pasa de 6 a 15 años; del 5% al 20% de comisión, solo
gana uno.

Hoy existen **siete**, y se pueden enumerar sin discutir: son los tipos que
acepta la lista blanca de `movimiento_apuntar`.

| sumidero | recurrente | qué lo hace volver |
|---|---|---|
| armas | **sí** | se rompen (el mandoble dura ~11 combates) |
| mascotas | **sí** | mueren cada 20-30 |
| la visita al barbero | **sí** | se paga cada vez, tengas ya el color o no |
| el rescate al 60% | **sí** | solo si perdiste algo y dentro de 24 h |
| skins de arma | no | 8 familias × 10 aspectos = 80 compras |
| colores y peinados de pago | no | se compran una vez |
| plazas de ludus | no | dos, y caras a propósito |

**Los buenos sumideros son RECURRENTES.** Comprar una vez saca monedas una vez.
De los siete, **cuatro lo son**, y el que más va a rendir es el más barato de
todos: la visita al barbero, a 60 monedas. Está barata a propósito — un sumidero
recurrente solo funciona si se usa, y a diez días de juego por visita nadie
cambiaría de aspecto nunca.

### Skins y aspectos — HECHO

Era «lo ya decidido sin construir» y se construyó: `supabase-34-skins.sql` para
las skins de arma y `supabase-40-aspecto.sql` para la barbería. Las dos
aplicadas y funcionando.

Lo que sigue siendo cierto y hay que respetar al añadir más: **no tocan el
equilibrio**, y por eso se les puede poner el precio que se quiera sin
convertir el juego en pay-to-win. Y los tatuajes faciales son los que mejor
funcionan comercialmente porque siempre se ven — con un matiz que costó
descubrir: **van en la mejilla, no en la frente**, porque el pelo se dibuja
encima y un tatuaje que desaparece según el peinado no lo compra nadie.

Sigue siendo el sitio más barato donde añadir contenido de pago: cada color
nuevo es una entrada en una lista.

### Ideas nuevas, ordenadas por lo que aportan menos esfuerzo

**Renombrar el bruto.** Hoy el nombre es permanente y eso genera fricción real:
alguien se equivoca al escribir y carga con ello para siempre. Cobrarlo resuelve
la fricción **y** es un sumidero. El índice único ya existe, así que la mecánica
está medio escrita: solo hay que dejar pasar el nombre por una ruta que cobre.

**Mantenimiento del arma.** Reparar **antes** de que se rompa, más barato que el
rescate. Convierte el mandoble en un gasto continuo en vez de una ruleta, y
captura al jugador cuidadoso que hoy no gasta nada. Cuidado con el precio: si
mantener sale más barato que la rotura esperada, el sumidero encoge en vez de
crecer — tiene que estar **por encima** del coste esperado, y se paga igual
porque quita la incertidumbre.

**El entrenador: volver a tirar UN atributo.** No los tres. Caro, y el resultado
puede salir peor. Es un sumidero que se alimenta del mismo motivo que hace
funcionar el género —querer un bruto mejor— sin regalar poder: el valor esperado
es cero, lo que se compra es la oportunidad.

**Consumibles de un combate.** Vendas, veneno, una piedra de afilar. Se gastan
al usarse, así que son recurrentes por construcción. **Ojo:** esto sí toca el
equilibrio, así que habría que medirlo como se midieron las armas y las
mascotas, con miles de combates. Es el que más trabajo da de los cuatro.

**Nombre y emblema del ludus.** Cosmético puro, se compra una vez, pero es la
puerta natural a clanes si algún día existen.

**Un memorial para las mascotas muertas.** Una lápida en el ludus con el nombre
del lobo que se te murió. Suena tonto y es exactamente el tipo de cosa por la
que la gente paga: no da nada, y por eso no rompe nada.

### Lo que NO se debe hacer

**Nada que se pueda recuperar jugando.** Si los números se ajustan para que una
compra se pague sola, el juego necesita crecer sin parar o revienta. Es lo que
hundió a Axie y a StepN.

**Más plazas de ludus sin cuidado.** Si más brutos = más peleas = más
recompensas, comprar plazas se vuelve pay-to-earn. La recompensa por plaza extra
tiene que ser **sublineal** o la plaza se paga a sí misma.

---

## 4 · Contenido y retención

### Torneos semanales — construidos y sin estrenar

**Ya no están «sin construir».** `supabase-21-torneos.sql` tiene el cuadro, la
inscripción y el reparto del bote; el paso 38 añade el rescate de un torneo que
se quede a medio resolver; la app tiene su pantalla y el panel su calculador.
Todo aplicado.

Lo que falta es **crear uno de verdad**, y con ello siguen sin decidirse las
cuatro cosas de siempre:

- **¿Te apuntas o entran todos?** Apuntarse da menos gente y más intención.
- **Cuadro de 8 o 16**, eliminatorias. El servidor las resuelve de golpe, y como
  guarda semilla y registro, cada combate se puede reproducir.
- **El premio es lo delicado.** Si reparte muchas monedas, las peleas diarias
  sobran y el torneo se come el juego. Si reparte pocas, nadie va. Instinto:
  **prestigio y un arma rara, no un montón de monedas.**
- **Las peleas del torneo no deberían gastar las 3 diarias**, o la gente tendría
  que elegir entre torneo y jugar.

Hay un calculador de precios en el panel que ya mide todo esto en **días de
juego**, que es la unidad que sigue significando lo mismo valga lo que valga el
token. Trae cuatro configuraciones que ya cumplen las reglas, así que la
decisión del premio se puede tomar mirando números en vez de a ojo.

**Y hay un motivo para no estrenarlos todavía:** un torneo necesita gente. Con
los cuatro jugadores que hay hoy, un cuadro de 8 se rellena con la mitad vacía
y se ve. Esto va después de que entre gente, no antes.

### El entrenamiento / modo inactivo — en pausa

Medido: 10 monedas por bruto y día, o sea **14% del pool diario**. No está
descartado, está esperando a que la economía tenga más de un sumidero. Meter una
fuente nueva antes que sumideros nuevos es ir hacia atrás.

### Ideas nuevas

**Rachas diarias.** Entrar N días seguidos. Barato de hacer y de los que más
mueven la retención. **Pero la recompensa no puede ser monedas** o es una fuente
nueva: que sea cosmética, o una pelea extra, o un descuento en el rescate.

**Revancha y rivalidades.** «Este te ganó tres veces» y un botón para volver a
retarle. Sale gratis: `fights` ya guarda quién peleó contra quién. Es lo que
convierte una lista de rivales anónimos en una historia.

**Misiones diarias.** «Gana con la daga», «gana sin perder vida». Dirigen al
jugador hacia contenido que no probaría solo — y son el sitio natural para
enseñar las armas a quien nunca compró una.

**Clanes o ludus compartidos.** Mucho trabajo y mucha retención. No antes de
tener jugadores; con 20 personas un clan está vacío y se ve.

---

## 5 · Crecimiento

### El enlace por combate — HECHO, y la promesa está cumplida

Era «la idea que más rinde por lo poco que cuesta» y ya existe: `pelea.html?id=`.
Sin cuenta, sin wallet y sin sesión, porque `fights` tiene lectura pública.

```
solbrute.io/pelea.html?id=154
```

**Y no solo la enseña: la RECALCULA** en el navegador de quien mira, con
`brute-combate.js` —el mismo fichero que carga el servidor— comparando evento
por evento. Comprobado el 07/08/2026 sobre peleas reales de producción:
«✓ Comprobado, los 9 turnos y los 34 eventos, uno por uno».

Así que el verificador público y el enlace por combate **no eran dos cosas**:
salieron siendo la misma página, que es mejor de lo que estaba planeado. Quien
llega a mirar quién ganó se encuentra la comprobación hecha sin pedirla.

Tres detalles que costaron y conviene no deshacer:

- **La página distingue «no cuadra» de «no lo puedo comprobar».** Una pelea de
  antes del paso 39 no guarda con qué reglas se jugó, y recalcularla con las de
  hoy daría otro combate. Decir «no cuadra» ahí sería mentir al revés, en la
  única página que existe para demostrar que no engañas.
- **Un verificador que aprueba todo es peor que ninguno**, y por eso existe
  `prueba-verificable.mjs`: fabrica peleas manipuladas y exige que salten,
  incluido un solo golpe retocado en 1 de daño.
- La animación vive en `brute-arena.js`, compartida con el juego. Ya está
  enlazado desde el tablón del ludus y desde el cartel del final.

Lo que **sí** queda de esta idea: la URL es fea. `solbrute.io/pelea/154` se
comparte mejor que `pelea.html?id=154`, y eso es configuración del alojamiento,
no código.

### Lo que ahora más rinde por lo poco que cuesta

**Un blog de noticias.** Una página con las novedades del juego: qué cambió, qué
se añadió, qué se arregló. Tres cosas a la vez, y ninguna cuesta casi nada:

- **Da algo que enlazar en Twitter** que no sea «mirad mi juego» otra vez.
- **Es lo que hace creíble el tono del proyecto.** El pie de la landing dice
  abiertamente que no hay token ni recompensa real; un registro de cambios con
  fechas es la prueba de que eso se mantiene por costumbre y no por casualidad.
- **Google indexa texto.** Una landing sola no posiciona; veinte entradas sí.

Lo barato es hacerlo como el resto: una carpeta de ficheros y una página que los
lista, sin base de datos ni panel. El historial de commits ya tiene el contenido
escrito — cada mensaje de este repositorio explica **qué se rompió y por qué**,
que es justo lo que la gente lee.

### Otras

**Torneo de lanzamiento** con premio de verdad, anunciado con fecha. Da un
motivo para entrar un día concreto, que es lo que no tiene un juego nuevo.

**Referidos: con cuidado.** El reparto diario tiene la propiedad de que más
jugadores es menos por cabeza, así que meter cuentas falsas te diluye a ti
mismo. Un referido que pague en monedas rompe eso. Si se hace, que pague en
cosméticos.

---

## 6 · Lo que se pidió y no está resuelto

**Una persona, una cuenta.** Se pidió explícitamente: «que una persona solo
pueda hacerlo con 1 bruto y 1 cuenta, no 20 pestañas».

Honestamente: **esto no se puede garantizar**, y conviene saberlo antes de
intentarlo. Nadie puede impedir que alguien tenga varias wallets. Lo que sí se
puede hacer es que **no le sirva de nada**, y eso ya está a medias:

- El reparto es fijo, así que más cuentas **no crean monedas**: reparten las
  mismas entre más. El tramposo se diluye a sí mismo.
- La primera plaza es gratis pero la segunda cuesta 50 y la tercera 150.

Lo que falta y sí se puede hacer:

- **Límite por IP para crear cuentas**, con la nariz tapada: comparten IP los
  compañeros de piso y los móviles. Sirve para frenar el bulto, no para ser
  justo.
- **Coste de entrada**: que la primera pelea del día cueste algo simbólico. Con
  una cuenta no se nota; con doscientas, sí.
- **Vigilar y actuar**, que es lo que de verdad funciona: el panel ya tiene los
  datos para ver 200 cuentas nacidas el mismo día desde el mismo sitio.

**Perseguirlo técnicamente hasta el final sale más caro que el daño**, y molesta
a jugadores legítimos. Diluir y vigilar es la respuesta realista.

---

## 6b · Que una caída no parezca un juego roto

**El 6 de agosto de 2026 GitHub tuvo una caída de Actions y Pages** (`major
outage`, cuatro horas) y `solbrute.io` se quedó en el 404 blanco de GitHub. Sin
token de por medio fue una molestia; con la preventa abierta habría sido gente
pagando SOL contra una web que no responde.

Son **tres averías distintas** y cada una necesita su respuesta:

| qué falla | qué lo cubre | estado |
|---|---|---|
| una ruta que no existe | `404.html` propio | hecho |
| la base de datos en obras | el modo mantenimiento (paso 36) | hecho |
| **el alojamiento caído** | una CDN delante, o cambiar de alojamiento | **pendiente** |

La tercera es la que no se arregla con un fichero: **si el alojamiento está
caído, no se sirve nada tuyo** — ni un cartel de mantenimiento, ni el `404.html`.
Lo único que funciona es que haya algo DELANTE con una copia en caché.

**Cloudflare lo hace en el plan gratuito** («Always Online»: sirve la última
copia buena cuando el origen no responde), y si además el sitio se aloja en
Cloudflare Pages, el origen deja de ser GitHub.

Y una lección que costó cara ese día: **no toques la configuración del
alojamiento en mitad de una caída.** Antes de pulsar «Unpublish», el sitio
servía la versión anterior y funcionaba; después ya no se pudo republicar hasta
que GitHub se recuperó. Cuando el proveedor está en obras, lo único que hay que
hacer es esperar.

## 7 · Lo técnico que queda pendiente

| | Qué | Por qué |
|---|---|---|
| ✅ | ~~Copia de seguridad de la base~~ | `respaldo.mjs`, con comprobación. Se creyó una copia vacía la primera vez: la clave `anon` da `[]` en todo lo que tiene RLS |
| ⬜ | **Página de estado pública** | reserva restante, emisión del día, tokens en circulación. Encaja con el tono del proyecto: se dice lo que hay |
| ⬜ | Límite de peticiones por IP en la Edge Function | hoy nada impide machacar las rutas |
| ⬜ | Borrar `supabase-funcion-prueba-solana.ts` | ya cumplió: demostró que la Edge Function puede firmar |
| ⬜ | Arte de personajes con ilustrador | el SVG a mano no llega a arte de producción. Capas en PNG sobre el sistema actual |
| ⬜ | Programa Anchor en devnet | fase 2 del roadmap: personajes y resultados on-chain |
| ⬜ | Mercado entre jugadores | fase 3 |

**La copia de seguridad la pondría yo antes que casi todo lo demás de esta
tabla.** Hoy un `delete` mal escrito en el SQL Editor se lleva los brutos de
todo el mundo y no hay vuelta atrás. Cuando cada saldo sea un derecho a cobrar
tokens reales, eso deja de ser una molestia y pasa a ser dinero de otros.

---

## 8 · Si tuviera que ordenar

Lo cerrado, para no volver sobre ello:

1. ~~**Lo legal.**~~ Cerrado.
2. ~~**Copia de seguridad.**~~ `respaldo.mjs`, y ya se ha usado de verdad.
3. ~~**El enlace por combate + el verificador.**~~ Hecho **entero**: `pelea.html`
   recalcula, está enlazado desde el juego y el combate se anima.
4. ~~**Skins y aspectos.**~~ Hechos: skins de arma (34) y barbería (40).
5. ~~**La preventa.**~~ Escrita, aplicada, atacada con 37 comprobaciones contra
   el servidor real, abierta el 03/08 y cerrada el 07/08.

Y lo que queda, en el orden en que lo haría:

1. **Sacar la compra de prueba de `preventa_compras`.** Los 1.000 tokens
   «vendidos» son de la wallet de `prueba-pago-devnet.mjs`, pagados con SOL de
   devnet. Si se abren los reclamos con esa fila dentro, se entregan 1.000
   tokens **de verdad** contra un pago que no vale nada. Va primero porque es
   corto y porque bloquea todo lo demás de la preventa.
2. **Que entre gente.** El blog y compartir peleas, del apartado 5. Es lo único
   de esta lista que cambia el juego de verdad: hoy hay **cuatro jugadores**, y
   con cuatro no hay emparejamiento que valga, ni torneo que se llene, ni
   economía que medir.
3. **Torneos**, cuando el punto 2 haya dado fruto. Están construidos y
   esperando; un cuadro de 8 con cuatro personas se ve vacío.
4. **Token en mainnet**, con la lista del apartado 2 — y las tres cosas del
   apartado 1 que no son código y siguen sin empezar.
5. El resto.

Lo pongo así porque **la economía no se rompe por falta de contenido, se rompe
por falta de sumideros** —y de esos ya hay siete, cuatro recurrentes— y porque
un juego con token que nadie ve no tiene economía que romper. Primero que exista
gente y que puedan comprobar que no les engañas; después el dinero.

**Lo que ha cambiado desde el 4 de agosto** es que la parte de «que puedan
comprobar que no les engañas» está terminada. Falta la otra mitad: la gente.
