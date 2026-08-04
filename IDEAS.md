# SolBrute · todo lo que hay, lo que falta y lo que se podría hacer

Este fichero es la lista larga. `CLAUDE.md` explica **por qué** está hecho cada
cosa; esto es **qué queda**, ordenado por lo que de verdad importa.

Fecha de corte: **4 de agosto de 2026**.

---

## 1 · Antes de que exista dinero de verdad

Todo esto va antes de mainnet. No es opcional y **ninguna es código**.

| | Qué | Estado |
|---|---|---|
| ⬜ | **Lo legal.** Sigue pendiente desde el primer día | sin empezar |
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

---

## 3 · Los sumideros, que son la mitad de la economía

Del `TOKEN.md`: **que la gente gaste importa el doble que la comisión.** Del 30%
al 70% de gasto, la reserva pasa de 6 a 15 años; del 5% al 20% de comisión, solo
gana uno.

Hoy existen tres y medio: armas que se rompen, mascotas que mueren, el rescate
al 60%, y las plazas de ludus (que se compran una vez).

**Los buenos sumideros son RECURRENTES.** Comprar una vez saca monedas una vez.

### Ya decidido, sin construir

**Skins y aspectos.** El mejor que hay y el más barato de hacer aquí: el aspecto
ya son diez enteros pequeños, así que añadir un peinado o un tatuaje es añadir
una entrada a una lista. **No tocan el equilibrio**, y por eso se les puede
poner el precio que se quiera sin convertir el juego en pay-to-win.

Los tatuajes faciales son los que mejor funcionan comercialmente, porque siempre
se ven — los del cuerpo van debajo de la ropa.

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

### Torneos semanales — decidido a medias

Está anotado y sin construir. Lo que hay que decidir sigue igual:

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
token.

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

### La idea que creo que más rinde por lo poco que cuesta

**Que cada combate tenga su enlace.** `fights` ya guarda semilla, registro
completo, ganador y una copia congelada del rival. **La pelea ya se puede
reproducir entera; lo único que falta es una URL.**

```
solbrute.io/pelea/1284
```

Quien la abra ve el combate reproducirse, con su tarjeta al compartir generada
con el arte del propio juego —el generador ya existe, `og-image.html`—. Y no
hace falta cuenta para verlo.

Tres cosas a la vez, y ninguna cuesta apenas:

- **Marketing que se hace solo.** La gente comparte las victorias raras. Un
  enlace que se ve bien en Twitter vale más que cualquier anuncio.
- **Cumple la promesa de la landing.** Dice «combate verificable» y hoy nadie
  puede verificar nada, porque no hay dónde. Un enlace público es la prueba.
- **Es la puerta de entrada más barata que existe:** se llega mirando una pelea,
  no leyendo qué es el juego.

**Y su hermano: un verificador público.** Una página donde pegas semilla y
brutos y recalcula el combate con `brute-combate.js` —el mismo fichero que usa
el servidor— y te dice si cuadra. Es media tarde de trabajo y convierte
«confía en nosotros» en «compruébalo».

Lo digo claro: **hoy la promesa de combate verificable no está cumplida.** La
arquitectura la permite desde el principio, pero no existe la herramienta.

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

## 7 · Lo técnico que queda pendiente

| | Qué | Por qué |
|---|---|---|
| ⬜ | **Copia de seguridad de la base** | hoy no hay ninguna. Un borrado accidental se lleva todo |
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

Mi orden, y el porqué:

1. **Lo legal.** Bloquea todo lo demás y no depende de ti que sea rápido.
2. **Copia de seguridad.** Barato, y hoy no existe.
3. **El enlace por combate + el verificador.** Poco trabajo, cumple una promesa
   que hoy está sin cumplir, y es lo único de la lista que trae gente sola.
4. **Skins.** El sumidero más barato y el único que no toca el equilibrio.
5. **Token en mainnet y preventa de verdad**, con la lista del apartado 2.
6. **Torneos**, ya con jugadores dentro.
7. El resto.

Lo pongo así porque **la economía no se rompe por falta de contenido, se rompe
por falta de sumideros**, y porque un juego con token que nadie ve no tiene
economía que romper. Primero que exista gente y que puedan comprobar que no les
engañas; después el dinero.
