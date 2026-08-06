# SolBrute

Juego de combate automático por turnos sobre Solana, en el género de "El Bruto" /
My Brute: creas un gladiador, pelea solo contra brutos de otros jugadores, gana
experiencia y sube de nivel.

## Ficheros

| Fichero | Qué es | Estado |
|---|---|---|
| `index.html` | Landing pública | Terminada |
| `app.html` | La app: puerta, ludus, creador, emparejamiento, arena | Prototipo funcional |
| `brute-render.js` | Renderizador de brutos por capas, compartido | Estable |
| `supabase-cliente.js` | Acceso a la base de datos (jugadores, brutos, rivales) | Funcionando |
| `wallet-solana.js` | Conectar y firmar con Phantom / Solflare | Funcionando |
| `supabase-funcion-auth.ts` | Edge Function: verifica firmas y hace las escrituras | Desplegada |
| `supabase-03-auth.sql` | Tabla `auth_nonces` | Aplicado |
| `supabase-05-sesiones.sql` | Tabla `sessions` | Aplicado |
| `supabase-04-cerrar.sql` | Cierra las políticas: leer sí, escribir no | Aplicado |
| `supabase-06-tirada.sql` | `sessions.roll`: la tirada de atributos la guarda el servidor | Aplicado |
| `supabase-07-peleas.sql` | Tabla `fights` y resumen para el panel | Aplicado |
| `supabase-08-admin.sql` | Tabla `admin_log` (auditoría) | Aplicado |
| `supabase-09-armas.sql` | `brutes.arma` y `brutes.armas` | Aplicado (`armas` **ya no se usa**, ver paso 14) |
| `404.html` | La página de ruta no encontrada, con el arte del juego | Funcionando |
| `pelea.html` | **Una pelea, con su enlace, y se verifica sola** | Funcionando |
| `prueba-verificable.mjs` | Comprueba que la verificación detecta una pelea manipulada | Herramienta |
| `supabase-32-verificable.sql` | `fights.a_snapshot`. **Antes de la Edge Function** | Aplicado |
| `supabase-33-armas-nuevas.sql` | Abre el `check` de `brutes.arma` a las nueve. **Antes de la función** | Aplicado |
| `supabase-34-skins.sql` | Skins de arma: `players.skins` y `brutes.arma_skin` | Aplicado |
| `supabase-35-armas-17.sql` | Abre el `check` a las diecisiete. **Antes de la función** | Escrito |
| `supabase-36-mantenimiento.sql` | Parar el juego desde el panel. **Antes de la función** | Aplicado |
| `supabase-37-botes.sql` | El bote de un torneo también está en circulación | Aplicado |
| `supabase-38-torneo-atascado.sql` | Rescatar un torneo a medio resolver. **Con la Edge Function** | Escrito |
| `admin.html` | Panel de administración | Funcionando |
| `brute-combate.js` | Reglas del combate y del equilibrio, compartidas | Estable |
| `supabase-01-tablas.sql` | Crea las tablas. Se pega en el SQL Editor | Aplicado |
| `supabase-02-rerolls.sql` | Añade `rerolls_left` y `pool` a `brutes` | Aplicado |
| `servidor-local.js` | Servidor de desarrollo, sin caché. No lo necesita el juego | Herramienta |
| `prueba-hostil.ts` | Ataca la función con un cliente reescrito. 18 ataques | Herramienta |
| `prueba-banco.ts` | Base de datos simulada para el banco de ataque | Herramienta |
| `supabase-10-permisos.sql` | Cierra funciones que quedaron ejecutables por `public` | Aplicado |
| `supabase-11-retiradas.sql` | Tablas `withdrawals` y `economia`. La puerta empieza cerrada | Aplicado |
| `supabase-12-emision.sql` | **Tope de emisión**, fondo de garantía y reciclaje | Aplicado |
| `supabase-13-movimientos.sql` | Tabla `movimientos`: el historial privado del jugador | Aplicado |
| `supabase-14-inventario.sql` | El inventario pasa del bruto al JUGADOR | Aplicado |
| `supabase-15-reinicio.sql` | Reinicio de la economía. **No repetible** | Aplicado una vez |
| `supabase-16-limpiar-pruebas.sql` | Borra las cuentas de los ataques, por dirección | Repetible |
| `supabase-17-eventos.sql` | Cinco columnas en `fights` para el tablón del ludus | Aplicado |
| `supabase-18-retirada-cuentas.sql` | La retirada: topes, comisión y estado. **Sin el envío** | Aplicado |
| `supabase-19-cerrar-simulacro.sql` | Cierra el simulacro y limpia lo que dejó | Aplicado una vez |
| `supabase-20-cerrar-devnet.sql` | Cierra las pruebas de devnet, por lista blanca | Aplicado una vez |
| `supabase-21-torneos.sql` | Torneos: cuadro, inscripción y reparto del bote | Aplicado |
| `supabase-23-mascotas.sql` | Mascotas: bolsa del jugador y muerte permanente | Aplicado |
| `supabase-24-limpiar-pruebas-mascotas.sql` | Borra las cuentas de las pruebas de la v0.2.0 | Repetible |
| `supabase-25-niveles.sql` | Armas y mascotas con nivel minimo. **Antes de la Edge Function** | Repetible |
| `supabase-27-perdidas.sql` | El historial apunta el arma rota y la mascota muerta | Repetible |
| `supabase-28-cuadrar.sql` | Cuadra los libros tras el descuadre del panel. **Tras la Edge Function** | Una vez |
| `supabase-29-valvula.sql` | La válvula: solo se paga lo que hay. **Con el token en mainnet** | Escrito |
| `supabase-30-rescatar.sql` | Rescatar el arma rota y revivir la mascota | Repetible |
| `supabase-31-preventa.sql` | La preventa. **Nace apagada** | Aplicado · **la venta está VIVA** |
| `supabase-26-cerrar-firmas-viejas.sql` | Borra las firmas de 3 parametros. **DESPUES de la Edge Function** | Una vez |
| `prueba-preventa.mjs` | Ataca la preventa **contra el servidor desplegado**. 33 ataques | Herramienta |
| `prueba-pago-devnet.mjs` | Compra de verdad contra devnet: paga, cobra y no cobra dos veces | Herramienta |
| `respaldo.mjs` | Copia de seguridad propia de la base, y la comprueba | Herramienta |
| `LEGAL.md` | Expediente de hechos para el abogado | Guía |
| `prueba-mascotas.mjs` | Mide las mascotas llamando al `simulate()` real | Herramienta |
| `prueba-mascotas-emparejada.mjs` | Las mide **emparejado**: mismo bruto y semilla, con y sin | Herramienta |
| `prueba-ascii.mjs` | Acentos donde el editor de Supabase los destroza | Herramienta |
| `og-image.html` | Genera `og-image.png` (tarjeta al compartir) con Chrome | Herramienta |
| `supabase-funcion-retirar.ts` | **Edge Function aparte: el envío on-chain y la preventa** | Desplegada |
| `supabase-funcion-prueba-solana.ts` | Función desechable: ¿puede la Edge Function firmar? | Cumplida, borrar |
| `DESPLIEGUE.md` | En qué orden se aplica todo lo de arriba | Guía |
| `BACKEND.md` | Esquema y contrato de API | Paso 1 hecho a medias |
| `TOKEN.md` | Diseño económico del token | Modelo decidido, nada creado |
| `IDEAS.md` | **La lista larga**: lo que falta, los sumideros y las ideas | Guía |
| `EMPEZAR.md` | Guía de arranque para novato | — |

**Los `.sql` van numerados y en orden.** Varios dependen del anterior —el 12
añade columnas a la tabla que crea el 11, el 17 a la que crea el 7— y aplicados
a destiempo fallan con `relation ... does not exist`. Está escrito en
`DESPLIEGUE.md` con el porqué de cada uno.

Hubo dos bancos de pruebas (`creator.html`, `fight.html`) que se eliminaron al
integrarse en `app.html`. No los recuperes: contenían arte antiguo con cascos.

Sin dependencias ni build. Fuentes por CDN. Los dos HTML llevan su CSS y su
lógica dentro; lo único que comparten es `brute-render.js`.

**`brute-render.js` es un script clásico a propósito, no un módulo ES.** Se
expone en `window.BruteRender` y cada HTML lo desestructura al entrar
(`const { OL, SKIN, bust, … } = window.BruteRender;`), lo que deja las llamadas
de dibujo escritas igual que cuando el código vivía dentro. Con
`<script type="module">` los ficheros dejarían de abrirse con doble clic: sobre
`file://` el origen es `null` y el navegador bloquea el módulo por CORS. Como no
hay servidor de desarrollo, abrir el HTML a pelo tiene que seguir funcionando.

---

## Identidad visual

Estética de gladiador romano, deliberadamente lejos del morado/negro cripto.
Decisiones tomadas; no reinventarlas sin motivo.

**Paleta** (variables CSS en `:root`, idénticas en los tres ficheros):
- Fondos: `--bg-deep #0c0a07`, `--surface #1c1710`, `--line #3a2e1c`
- Bronce: `--bronze #c98a3a`, `--bronze-light #e5ab5c`, `--torch #ff9d42`
- Sangre: `--blood #b3312c`, `--blood-bright #e0453f`
- Solana: `--sol-teal #14f195`

**El verde de Solana se usa con cuentagotas** y siempre significando algo:
estado positivo, progreso, saldo, "jugador real". Nunca decorativo.

**Tipografía:** `Cinzel` para títulos, nombres de bruto y cifras; `Space Grotesk`
para el resto. La tensión romano/técnico es intencionada.

**Colores por función:** rojo sangre = vida y daño. Verde teal = experiencia y
progreso. Bronce = atributos y equipo. Naranja antorcha = peleas disponibles.
No mezclar.

**Registro de arte:** anime estilizado en vector. Las palancas que lo sostienen
son ojos grandes y bajos en la cara con iris a dos tonos, cabeza grande respecto
al encuadre, contorno exterior grueso (`OUT`) frente a detalle fino (`IN`), y pelo
en pocos planos angulares con banda de brillo. Si algo se ve "de diagrama",
normalmente es que se igualaron los grosores de línea.

---

## Idiomas (ES / EN / FR)

- `data-i18n="clave"` → `textContent`
- `data-i18n-html="clave"` → `innerHTML` (solo el `<h1>` del hero, que lleva spans)
- En JS, `t("clave")` para cadenas y `O("grupo")` para las listas de opciones del
  creador.

**Reglas al añadir texto:**
1. Toda cadena visible existe en **las tres** tablas.
2. En las tablas JS se escribe `&` literal, nunca `&amp;`.
3. **Las listas de opciones del creador deben tener el mismo número de entradas
   en los tres idiomas.** Los índices se guardan como números; una lista más
   corta rompe la traducción o el aspecto.

**Los dos ficheros arrancan en inglés, en todos los navegadores.** Es una
decisión, no un pendiente: **no se detecta `navigator.language`**. El jugador
cambia de idioma con los botones ES / EN / FR si quiere.

Detectar el idioma del navegador está descartado a propósito: haría que dos
personas vieran cosas distintas por defecto, y para un proyecto que se comparte
por enlace conviene que todo el mundo vea lo mismo al abrirlo.

Que arranque en inglés significa cuatro cosas, y hay que mantener las cuatro
alineadas o el idioma se rompe a medias:

1. `<html lang="en">` y el `<title>` en inglés.
2. `let lang = "en"` y `applyLang("en")` al final del script.
3. El botón `EN` lleva la clase `active` en el marcado.
4. **El texto estático del HTML está escrito en inglés**, no en español. Si
   escribes marcado nuevo en español confiando en que `applyLang` lo traduzca,
   funcionará — pero quien lea el fichero, o cargue la página con el JS caído,
   verá español. El marcado y el idioma por defecto van juntos.

El respaldo cuando falta una clave también es inglés: `t()` y `O()` caen a
`T.en`, no a `T.es`.

---

## Flujo

**Landing** (`index.html`) → botón "Entrar a la arena" → **app** (`app.html`).
La landing solo pide wallet en **la preventa**, que es la única parte donde hace
falta —se paga desde la wallet del comprador— y solo cuando el jugador pulsa. En
el script de la landing:

```js
const PROTOTYPE_URL = "app.html";   // vacío = botón en estado "próxima apertura"
```

**App**: puerta (wallet) → ludus (3 plazas) → forja/creador → elegir rival →
arena → resultado → ludus.

---

## Reglas del juego

- **Máximo 3 brutos por wallet.** Primera plaza gratis, segunda 50 $BRUTE,
  tercera 150.
- **3 peleas al día por bruto**, no en total. Se recargan al cambiar el día UTC.
- **El aspecto lo elige el jugador; los atributos los reparte la forja.** Si
  pudiera elegir los stats, todos harían el mismo bruto óptimo.
- Volver a tirar atributos es gratis **antes** de forjar. Después solo suben
  ganando.
- Subir de nivel cuesta `round(80 × nivel^1.5)` XP y da **una sola cosa**: 4 de
  cada 10 veces un atributo (`PROB_ATRIBUTO`), y si no, `HP_NIVEL` de vida.
  Nunca un nivel vacío.
- El perdedor se lleva un tercio de las monedas, no cero: castigar la derrota
  con nada hace que la gente deje de pelear cuando va perdiendo.
- **Un cambio de lista de rivales al día por bruto** (`REROLLS_DAY`). Ver
  «Emparejamiento».

### Curva de atributos

Constantes en `app.html`, agrupadas bajo «equilibrio»: `STAT_INI`, `STAT_VAR`,
`HP_INI`, `HP_VAR`, `HP_NIVEL`, `STAT_MAX`. **Tocar el equilibrio es tocar esas
seis, no repartir números por el fichero.**

Un bruto nuevo sale con **1-4 en cada atributo** sobre un tope de 10, y 38-48 de
vida (media 43). Bajó un 5% desde los 40-50 originales: con los combates a
mediana 6-7 turnos, lo que se hacía largo era la cola —el p95— y ahí quita un
turno sin tocar el ritmo normal. Empieza flojo a propósito: si naciera cerca del tope, subir de nivel no
cambiaría nada y la progresión —que es el motor del género— dejaría de existir.

El tope de 10 no se toca sin rehacer las fórmulas de daño y esquiva, que están
calibradas para ese rango.

**Los brutos de la casa suben como un jugador: UNA cosa por nivel.** Si usaran
otra fórmula, el emparejamiento por nivel sería mentira — mismo número en la
ficha, distinta fuerza real.

### Y durante mucho tiempo lo fue

`botStats` daba **las dos**: un punto de atributo Y `HP_NIVEL` de vida en cada
nivel. Un jugador recibe una sola. Así que la casa se separaba más y más según
subías:

| nivel | jugador | bot | gana el jugador |
|---|---|---|---|
| 5 | 58 vida · 8,9 atr | 65 · 11,5 | **23,7%** |
| 10 | 74 vida · 10,6 atr | 90 · 16,5 | **7,0%** |
| 20 | 107 vida · 14,1 atr | 140 · 26,4 | **0,7%** |

A nivel 20 el jugador ganaba **7 de cada 1.000**. Y el texto de arriba describía
lo que hacía el código —«`nivel - 1` puntos y `HP_NIVEL` por nivel»— sin darse
cuenta de que eso ES la otra fórmula contra la que avisa la frase siguiente.

Se descubrió midiendo, a raíz de que el dueño dijera que los combates duraban
mucho a nivel bajo. **No era la vida propia: era la del rival.** Arreglado,
las duraciones vuelven solas a la tabla de abajo.

Ahora `botStats` reparte con las mismas probabilidades que `aplicar()` —
atributo, arma o vida— y **el bot se queda el arma**: antes peleaban todos a
puño limpio. Como las armas están equilibradas entre sí, eso no le da ventaja,
le da variedad.

**Los atributos son escasos a propósito.** Un bruto de nivel 20 tiene 5,0 de
media por atributo; con la regla anterior tenía 8,8.

**Lo escaso son los atributos, no la vida.** Al nivel 20 un bruto sigue teniendo
sus 102 de vida de siempre; lo que baja es el músculo, de 8,8 de media a 5,0.
La vida llega a trompicones (`HP_NIVEL` = 5 cuando toca) en vez de a goteo.

**Una cosa por nivel, no dos.** Es una decisión de forma, no de números: A y B
daban exactamente los mismos atributos, vida y duración. Se eligió esta porque
es el hueco donde entrarán armas y mascotas — una tercera cosa que puede
tocarte, sin rehacer la progresión.

Si los tres atributos están al tope, el nivel cae a vida en vez de quedarse
vacío.

Cuidado si alguien da vida **además** del atributo: se probó y los combates
pasaron de 7 turnos a 19, porque la vida crecía y el daño no.

Simulado con 8.000 combates por nivel:

| Nivel | Atributos | Vida | Turnos (mediana / p95) |
|---|---|---|---|
| 1 | 2,5 | 43 | 6 / 9 |
| 5 | 3,0 | 54 | 7 / 12 |
| 10 | 3,7 | 69 | 8 / 14 |
| 20 | 5,0 | 97 | 10 / 17 |
| 30 | 6,4 | 126 | 11 / 19 |

Vuelto a medir con `botStats` arreglado y la vida al 5% menos. Y el
emparejamiento cuadra: **jugador contra bot de su mismo nivel, 49,6-49,9% a
todos los niveles.**

Ninguno llega al tope de 40 turnos.

El 60% de niveles que hoy solo dan vida es el hueco donde entrarán las armas y
las mascotas cuando existan.

Comprobado con 5.000 combates por nivel simulados.

### Sobre la economía del token

Ver `TOKEN.md` para el modelo completo. En corto: **el token es la moneda del
juego**, con reserva fija y reparto diario. Lo que se gasta dentro y la
comisión de retirada vuelven a la reserva, así que la única salida real es lo
que se retira.

Dos datos que conviene no olvidar:

- **Que la gente gaste importa el doble que la comisión.** Del 30% al 70% de
  gasto, la reserva pasa de 6 a 15 años; del 5% al 20% de comisión, solo gana
  uno. Por eso **los sumideros no son contenido extra: son la mitad de la
  economía**, y hoy solo existe uno (las armas que se rompen).
- **Se vende contenido, no rentabilidad.** Si los números se ajustan para que
  una compra se recupere jugando, el juego necesita crecer sin parar o
  revienta. Es lo que hundió a Axie y a StepN.

El reparto diario tiene además una propiedad que sale gratis: más jugadores es
menos por cabeza, así que meter cuentas falsas te diluye a ti mismo.

Cuidado también con esto: si más brutos = más peleas = más recompensas, comprar
plazas se vuelve pay-to-earn y el juego se convierte en granja. **La recompensa
por plaza extra tiene que ser sublineal**, o la plaza no puede pagarse a sí
misma. Es lo que hunde a la mayoría de juegos con token.

Y el primer bruto es gratis por una razón comercial: nadie compra una cripto para
probar un juego que no ha jugado.

---

## El tope de emisión

**Esto es lo que impide que el juego prometa más $BRUTE de los que existen.**
Vive en `supabase-12-emision.sql` y está aplicado.

Antes, cada pelea IMPRIMÍA monedas: `12 + turnos`, sin techo. Un bruto saca
~40 al día y una wallet con las 3 plazas ~120. El presupuesto son 27.397/día
—los 40 millones de reserva repartidos en 4 años—, así que:

```
27.397 ÷ 120 = 228 wallets
```

A partir de 228 jugadores el juego emitía más de lo que la reserva puede pagar,
y crecía en línea recta: a 10.000 jugadores, los 40 millones se evaporaban en
**33 días**. El juego se rompía justo al tener éxito.

Se le da la vuelta a quién manda:

```
ANTES:  las peleas deciden cuántas monedas existen
AHORA:  la reserva decide cuántas existen, y las peleas cómo se reparten
```

Lo que gana una pelea son **puntos** (los mismos `12 + turnos`: el equilibrio no
se toca) y una **tasa** los convierte en monedas. La tasa se recalcula al
cambiar el día UTC:

```
tasa = pool_diario ÷ puntos_de_ayer     ...y nunca más de 1,0
```

### La tasa se topa en 1,0, y esa es la decisión importante

Con pocos jugadores, `pool ÷ puntos_ayer` sale enorme: si ayer hubo 10 puntos,
la fórmula pura pagaría 2.739 monedas por punto y reventaría los precios
internos, calibrados sobre «un arma cuesta ~3 monedas por combate sobre las ~40
que se ganan al día».

Con el tope en 1,0: con pocos jugadores todo el mundo cobra exactamente lo de
siempre y la reserva simplemente dura más; pasados los ~228 la tasa baja y el
presupuesto empieza a mandar. **El tope no se nota hasta que hace falta.**

### Lo que arregla de los bots, gratis

Con reparto fijo, meter cuentas falsas **no crea monedas**: reparte las mismas
entre más cuentas. El tramposo se diluye a sí mismo. La propiedad ya estaba
escrita en el diseño, pero **solo existe si el reparto es fijo** — y hasta el
paso 12 no lo era.

### El jugador ve el cambio, y no es por transparencia bonita

La pantalla de victoria enseña `1 pt = 0,94` **solo cuando la tasa baja de 1,0**.
Si el jugador ve que la misma pelea le paga menos que ayer y nadie se lo
explica, lo que piensa es que le están robando — y tiene razón en desconfiar.
Mientras la tasa sea 1,0 no se enseña: sería ruido para explicar algo que no
está pasando.

### El cortafuegos

Si un día la emisión se dispara —crecimiento repentino, o alguien creando
cuentas en masa— la tasa se reajusta **en caliente** sin esperar al cambio de
día. `tope_factor` = 2: se tolera el doble del presupuesto antes de frenar, y
nadie se queda a cero, cobra menos. Con el reparto bien calibrado no llega a
activarse nunca.

---

## El fondo de garantía y el reciclaje

**5% del suministro (5.000.000) apartado, que no se emite jugando nunca.**
`emision_cobrar` solo mira `reserva_restante` y no puede tocarlo ni por error.

**Sale de la tesorería, que baja del 15% al 10%. No de las recompensas.** Si
saliera del 40% de recompensas lo pagarían los jugadores con menos monedas por
pelea, y habría que rehacer toda la aritmética del `TOKEN.md`. Saliendo de
tesorería, la emisión no cambia ni un punto y quien pone la garantía es el
dueño del proyecto. Que es de quien tiene que salir.

Es para compensar a jugadores si un fallo se come su saldo, cubrir retiradas
legítimas durante un incidente, y hacer de colchón si la reserva se agota antes
de lo previsto. **No para gastos del proyecto** — para eso está la tesorería, y
un fondo que se usa para pagar cosas es tesorería con otro nombre.

Por eso tocarlo no es un `update`: es `seguridad_usar()`, que exige un motivo de
al menos diez caracteres y lo deja en `admin_log` con el antes y el después.
**Un fondo que el gestor puede mover sin dejar rastro no es una garantía, es una
cuenta suya.**

### El reciclaje: lo que se gasta vuelve

90% al pool de recompensas, 10% al fondo. Hasta el paso 12 las monedas de un
arma comprada simplemente desaparecían y no volvían a ningún sitio.

### La invariante, y el fallo que la rompió el primer día

```
en circulación  +  reserva restante  =  reserva total
```

Se rompió a las pocas horas de desplegar. Un jugador tenía 407 monedas de
**antes** del tope, impresas sin respaldo; al gastarlas, el reciclaje las
devolvió a la reserva y la dejó en **40.000.117**, por encima de su propio
techo. La aritmética era correcta: lo que estaba mal era la premisa —devolver
a la reserva algo que nunca salió de ella—.

El arreglo tiene dos partes y las dos importan:

- `emision_reciclar` **no puede desbordar la reserva**. Lo que no cabe se quema.
  En régimen normal no se activa jamás: toda moneda en circulación salió de la
  reserva, así que devolverla no puede desbordarla.
- El paso 15 **reinició la economía** y descontó de la reserva las monedas
  conservadas, para que pasaran a estar respaldadas.

**Reiniciar hoy no le cuesta nada a nadie; el día que exista el token, un saldo
es un derecho a cobrar tokens reales y reiniciar pasa a ser quitarle valor a
alguien.** Por eso el reinicio va antes del token, no después.

---

## El panel de admin imprimía dinero

`admin_editar_jugador` escribía `players.coins` directamente y **no tocaba
`economia` en ningún momento**. Así que:

```
dar monedas   →  la reserva NO baja      (nacen de la nada)
gastarlas     →  el reciclaje SÍ las devuelve
```

Salen sin permiso y entran con él. Medido en vivo: `122 + 39.999.940 + 38 =
40.000.100`. Cien de más.

Es el mismo fallo que dejó la reserva en 40.000.117 el primer día, con otra
puerta de entrada. Y no saltó el tope de `emision_reciclar` porque 40.000.100
sigue por debajo de `reserva_total`.

**Ahora dar monedas las SACA de la reserva y quitarlas las DEVUELVE**, igual que
una pelea o una compra. Si la reserva no llega, responde 409 en vez de
inventarse la diferencia.

**Y esto es lo que separa el juguete del dinero:** hoy son 100 monedas y se
arreglan con un `update`. Con el token en mainnet, cada moneda en
`players.coins` es un **derecho a cobrar tokens reales** de la wallet
operativa. Cien de más son cien tokens que alguien puede pedir y que no
existen — y el último en retirar se queda sin cobrar.

La invariante no es contabilidad bonita: es lo que separa un saldo de una
promesa incumplida.

---

## Wallet: conectar ≠ iniciar sesión

Conectar solo da la dirección pública, y eso es falsificable desde el frontend.
Autenticación de verdad = el usuario **firma** un mensaje (patrón Sign In With
Solana) y el servidor verifica la firma. El copy de la Fase 1 del roadmap dice
"conecta **y firma**" precisamente para comprometernos con esto.

### Cómo funciona el login, y por qué así

1. `wallet-solana.js` conecta con Phantom o Solflare y obtiene tu dirección.
2. El navegador pide un **nonce al servidor**. Que lo dé él es lo que convierte
   la firma en una prueba: uno inventado por el navegador no demuestra nada.
3. Firmas un mensaje con formato Sign In With Solana.
4. La Edge Function verifica la firma con **ed25519**, tacha el nonce y abre
   una sesión con un token opaco de 32 bytes.

**El navegador no escribe en la base de datos.** Las políticas RLS solo
permiten `select`; forjar, guardar y vaciar pasan por la función, que comprueba
de quién es el token y escribe con `service_role`.

### Por qué no se usa un JWT de Supabase

Fue el primer intento y **no se puede**: el proyecto usa claves de firma
asimétricas (ECC P-256) y esa clave privada la gestiona Supabase sin
entregarla, así que es imposible emitir un token que su API acepte. El secreto
legacy solo verifica y está marcado para revocación.

Síntoma, por si reaparece: `PGRST301 · No suitable key or wrong key type`.

El camino que quedó es mejor. Con el JWT el navegador escribía directamente y
solo se le impedía tocar filas ajenas: podía mentir cuanto quisiera sobre las
suyas. Ahora hay un servidor en medio que puede decir que no, y ya rechaza el
tope de 3 brutos y recorta nivel, atributos y vida a rango.

### Lo que la función ya arregla, y lo que no

Arbitra el combate: sortea la semilla, simula y decide las monedas. El
navegador no puede darse victorias ni saldo.

Lo que **no** existe todavía es la retirada, que es donde el número se
convierte en dinero. Hasta que esté escrita y atacada, esto no mueve valor
real — y ese es justamente el orden correcto.

### Comprobado: la Edge Function SÍ puede firmar en Solana

Era la suposición grande sin verificar de todo el `TOKEN.md`, y había motivo
para dudar: el empaquetador de Supabase ya había rechazado traer
`brute-combate.js` por URL (`Cannot import from dentroytu.github.io:443`).

Se desplegó una función desechable (`supabase-funcion-prueba-solana.ts`) que
reproduce una retirada entera. Las cuatro comprobaciones en verde: empaqueta
`npm:@solana/web3.js@1.98.4` y `spl-token@0.4.15`, construye la instrucción de
transferencia SPL, firma y `verifySignatures()` cuadra, y habla con un RPC de
devnet.

**Fija las versiones de las librerías.** Sin versión, `npm:` resuelve a la
última en cada redespliegue, y una función que cambia de comportamiento según
el día es imposible de depurar.

### Comprobado contra el servidor desplegado

13/13, con claves ed25519 reales: token inventado y sin token rechazados;
modificar el bruto de otra dirección mandando su id no lo toca; cuarto bruto
rechazado; nivel 9999 → 100, fuerza 500 → 10, vida 99999 → 300; vaciar borra
los tuyos y no los ajenos; y escribir directamente con `curl` da `42501`.

Ojo con una trampa al probar: un `DELETE` o `PATCH` directo devuelve **204**
aunque no toque nada. RLS no da error, hace las filas invisibles. Hay que
comprobar la fila después, no el código de estado.

### Historia: la firma existía y no la verificaba nadie

`wallet-solana.js` conecta de verdad con Phantom y Solflare, y pide la firma.
Ya no hay direcciones inventadas: `fakeAddr()` y `miDireccion()` se borraron y
`loadMe()` lanza si se le llama sin dirección.

Qué lleva el mensaje firmado y por qué:

- **Dominio** — sin él, una web fraudulenta podría reutilizar tu firma aquí.
- **Nonce** — lo hace de un solo uso; sin él, una firma capturada vale para
  siempre.
- **Fecha e URI** — contexto para que el usuario vea qué está firmando.

**Sin modo invitado, a propósito.** Quien no tenga wallet no entra, pero la
puerta explica qué es una wallet, para qué hace falta y enlaza a la instalación,
en vez de dejar un botón muerto. Los textos de "detectada / no detectada" ahora
detectan de verdad; antes estaban escritos a mano y mentían.

**Cuidado con el base58.** Está a mano en `wallet-solana.js` porque no hay
dependencias. El acumulador tiene que empezar VACÍO: con un cero dentro, toda
entrada que empiece por byte 0 sale con un "1" de más. Como una firma de cada
256 empieza por cero, eso son logins que fallan un 0,4 % de las veces sin patrón
aparente. Hay vectores de prueba conocidos; si tocas esa función, compruébalos.

---

## Roadmap

| Fase | Qué | Estado |
|---|---|---|
| 0 | Prototipo jugable, estado en navegador | Hecho |
| 1a | Backend: los brutos viven en Supabase y se comparten entre jugadores | Hecho |
| 1c | Mover `simulate()` al servidor para que arbitre el combate | Hecho |
| 1d | Economía: tope de emisión, fondo de garantía, reciclaje | Hecho |
| 1e | La retirada: convertir el saldo en $BRUTE de verdad | Hecho en devnet |
| 2 | Token en mainnet y abrir las retiradas de verdad | ACTUAL |
| 1b | Wallet como cuenta (Phantom / Solflare + firma SIWS) | Hecho |
| 2 | Programa Anchor en devnet: personajes y resultados on-chain | Próximamente |
| 3 | Mainnet, token y mercado entre jugadores | Próximamente |

La wallet va antes que devnet porque el login no depende del contrato.

---

## Combate

**El combate se calcula entero antes de animar nada.** `simulate(a, b, seed)`
devuelve el registro completo; el navegador solo lo reproduce. Esto no es un
detalle de implementación: es lo que hace posible la promesa de combate
verificable, porque on-chain se guarda semilla + resultado y cualquiera puede
recalcular la pelea.

PRNG: `mulberry32`. Misma semilla, mismo combate, siempre.

**Fórmulas** (ajustar aquí el equilibrio):
- Daño: `(3 + fuerza × 1.45) × (0.8 a 1.2)`
- Esquiva del defensor: `6% + agilidad × 1.9%`
- Crítico: `5% + agilidad × 1.4%`, multiplica por 1.9
- Iniciativa: mayor velocidad pega primero; empate lo rompe la semilla
- Tope de 40 turnos; si nadie cae, gana quien tenga más vida

Sin el tope, dos brutos muy esquivos podrían no acabar nunca.

---

## Arte: sistema de capas

Los brutos son un **muñeco recortable**: un aspecto es diez enteros pequeños,
nunca una imagen. Se guarda `{sex, skin, hair, hairC, cloth, clothC, face, eyeC,
tat, tatC}` y el navegador redibuja. Por eso cabe en un registro y, más
adelante, en una cuenta de Solana.

**Orden de dibujo, de dentro hacia fuera:**
`cuerpo → tatuajes → ropa → cara → pelo`

**No hay cascos.** Se quitaron a propósito: la cara y el pelo son el personaje, y
un casco que los tapa desperdicia lo que el jugador acaba de elegir. Si algún día
vuelve el equipo de cabeza, tendrá que dejar la cara a la vista.

**Restricción real de diseño:** los tatuajes van debajo de la ropa. Si vendes
tatuajes, no puedes vender armaduras que los tapen del todo. Los tatuajes
faciales son los que mejor funcionan comercialmente porque siempre se ven.

**El sexo (`sex`) es la primera capa** y cambia la silueta que todo lo demás
sigue: hombros, cuello, mandíbula, cejas, pestañas, y el contorno que la ropa
tiene que respetar. Hombre y mujer son dos cuerpos dibujados aparte, no el mismo
estirado.

**Peinados atados al sexo**, con `rapado` y `rizos` compartidos para que el ludus
no se vea monótono. Al cambiar de sexo el peinado vuelve al índice 0, porque los
índices dejan de significar lo mismo.

**Dos vistas del mismo bruto:**
- `bust(look)` — retrato de frente, para tarjetas y miniaturas
- `spriteProfile(b, facingRight)` — cuerpo entero de perfil, para la arena

Las dos leen el mismo `look`. En perfil, la melena, la coleta y la trenza se
dibujan **detrás de la cabeza**, para que el volumen del pelo se lea de lado.

**El lienzo del perfil empieza en `y = -56`, no en 0** (`viewBox="0 -56 110 186"`).
Las armas se dibujan por encima de la cabeza —el mandoble llega a `y = -14` y la
punta de la lanza a `y = -26`— y con el viewBox arrancando en 0 se recortaban
contra el borde. El síntoma era que **la lanza parecía una tabla**: se veía el
asta y la punta quedaba fuera.

Ampliar hacia arriba no encoge al bruto: `.fighter` fija el ancho en 116px y
deja la altura en `auto`, así que el personaje conserva su tamaño y solo aparece
lienzo nuevo donde antes se cortaba. Y como la figura se posiciona desde abajo
(`bottom:22px`), los pies no se mueven. **Si algún día entra un arma más larga,
esto es lo que hay que subir.**

**Cuidado con `⚔` sin selector de variación.** Se dibuja como un glifo de texto
—una «x» pequeña— y una victoria y una derrota se veían casi igual en el tablón,
además de dejar el botón de la armería como «x Armoury». Va con `U+FE0F`
(`⚔️`) para forzar presentación emoji. Los demás (🏆, 📜) ya la traen.

**Todo esto vive en `brute-render.js` y solo ahí.** Estuvo copiado a mano en los
dos HTML y las copias se desincronizaron. Si tocas una capa, tocas un fichero.
El módulo no es solo el dibujo: también exporta las paletas (`SKIN`, `HAIRC`,
`CLOTHS`, `TATS`…), porque `app.html` las necesita fuera del dibujo para sortear
aspectos en `randomLook()` y para pintar las muestras de color de la forja. La
landing carga también `spriteProfile` aunque no lo use: separarlo obligaría a
duplicar las paletas otra vez, que es justo lo que se estaba arreglando.

**Límite conocido:** el SVG escrito a mano no alcanza arte de juego pintado. Para
personajes de producción hace falta un ilustrador o un pack de sprites; entonces
se sustituye el `<svg>` dentro de `.portrait` por un `<img>` y el resto de la
tarjeta sigue igual.

**IP:** el estilo de My Brute vale como referencia; sus personajes y sprites son
de Motion Twin y **no se copian**. Todo el arte de SolBrute es original.

---

## Las armas, en pixel art

Iconos comprados (CraftPix, 100 iconos de 32×32), **encendidos**. Se apagan
vaciando `ICONO_BASE` en `brute-render.js`: es la salida de emergencia si el
bucket deja de responder.

**Están las 100 subidas con su nombre original** (`icon_01.png`…`icon_100.png`),
y eso no es desorden: el pack son **10 tipos × 10 aspectos**, así que la fila es
el arma y la columna la skin.

```
01-10 espadas   21-30 ballestas  41-50 lanzas  61-70 escudos   81-90 hachas
11-20 cortas    31-40 arcos      51-60 mazas   71-80 guadañas  91-100 bastones
```

Cambiar de skin será cambiar un número en `ICONOS` — **sin tocar el equilibrio**,
que es lo que permite venderlas sin convertir el juego en pay-to-win.

**Nació apagado a propósito.** Un `<image>` que no carga no deja hueco ni avisa:
deja al bruto **desarmado**. Poner la URL antes de subir los ficheros habría
dejado a todo el mundo a puño limpio sin que nadie entendiera por qué.

Los PNG **no van al repositorio** —CraftPix prohíbe redistribuir— sino a
Supabase Storage, igual que los fondos de arena.

### Cómo encaja un icono plano en un brazo articulado

El arma dibujada vive dentro de `j-codoA`, con la empuñadura hacia (84,28) y la
hoja hacia arriba. Los iconos traen **el mango abajo a la izquierda y la hoja en
diagonal**, así que:

```
esquina inferior izquierda de la imagen → la mano (84,28)
girar -45° sobre ese mismo punto        → la diagonal queda vertical
```

Y como va **dentro del mismo grupo**, gira con el antebrazo igual que el arma
vectorial: se arma el golpe, sale y vuelve.

`image-rendering:pixelated` no es opcional: sin él, un 32×32 ampliado a 4×
sale borroso y parece un fallo de compresión en vez de pixel art.

### El tamaño no es el que parece

Al girar −45° sobre la empuñadura, **la punta sube `1,414 × tamaño`**. Con el
lienzo empezando en −34, un mandoble de 52 acababa en `y = −46`: fuera. Es el
mismo fallo que hacía que la lanza vectorial pareciera una tabla, con otra
causa. El lienzo se subió a −56 y los tamaños son 32 / 48 / 56.

### `null` y `""` no son lo mismo

`iconoArma` devuelve `null` cuando no hay icono —y entonces se dibuja la
vectorial— y `""` cuando **hay icono y a propósito no va nada ahí**: el escudo,
que se lleva en el otro brazo. Con `||` se confundirían, porque la cadena vacía
también es falsa, y salían **dos escudos, uno en cada mano**.

---

## Emparejamiento

Lista de 5 rivales de nivel ±1. Prioridad: jugadores reales del registro
compartido → otros brutos propios → brutos de la casa como relleno.

**La lista cambia en cada visita y con el botón «Otra lista».** Se piden 60
candidatos a la base de datos, no 5, y se barajan en el navegador: Postgres sin
`order` devuelve siempre lo mismo, así que sin traer material de sobra la lista
saldría idéntica una y otra vez.

Se baraja con Fisher-Yates (`barajar`). El `sort(() => Math.random() - .5)` que
había antes está sesgado y su comparador es inconsistente; con pocos jugadores
se notaba.

Los brutos de la casa no repiten nombre dentro de una misma lista: dos «Galba»
seguidos delatan que son inventados.

### Un cambio de lista al día, y por qué la lista se congela

`REROLLS_DAY = 1` por bruto, recargado al cambiar el día UTC igual que las
peleas. Sin límite, el jugador pediría listas hasta encontrar al rival más débil
y el emparejamiento por nivel no significaría nada.

**El límite solo es real porque la lista ofrecida se guarda** (`brutes.pool`).
Antes se generaba al entrar en la pantalla, así que bastaba con volver al ludus y
entrar otra vez para tener rivales nuevos sin gastar nada: limitar el botón
habría sido decoración. Ahora entrar y salir devuelve la misma lista, y cambiarla
cuesta el cambio del día.

Guardar la lista es además lo que pide `BACKEND.md` para el emparejamiento
autoritativo: «el servidor recuerda la lista ofrecida para que el cliente no
pueda pedir pelear contra un rival inventado». Todavía **no se valida** contra
ella —el navegador sigue mandando— pero el dato ya está en su sitio para cuando
el combate se mueva al servidor.

El botón lleva la cuenta encima (`↻ New list (1)`) y al agotarse se deshabilita
con el motivo escrito debajo, en vez de quedarse mudo.

---

## Panel de administración

`admin.html`, fuera del juego y sin enlazar desde él. Se entra **firmando con
la wallet**, igual que un jugador; la diferencia es que el servidor comprueba
además si la dirección está en `ADMIN_WALLETS`.

**Esa lista va en un secreto de Supabase, no en el código.** El repositorio es
público y ahí dentro la wallet del dueño quedaría a la vista. Añadir un
administrador es editar el secreto, sin desplegar.

**La comprobación está en el servidor, no en la página.** Un panel que solo
esconde botones no protege nada: las rutas se pueden llamar con `curl`. A quien
no es admin se le responde lo mismo que a una sesión caducada, sin confirmarle
que el panel existe.

Puede editar y borrar jugadores y brutos. Los valores se recortan al mismo
rango legal que usa el juego: un administrador está para arreglar cosas, no
para crear sin querer un bruto con fuerza 500. Y no puede borrarse a sí mismo.

### El panel se abría y LUEGO preguntaba

`cargar()` escondía la puerta y enseñaba el panel **antes** de pedir los datos.
Y la firma de cualquier jugador es válida —es un usuario legítimo, solo que no
administrador—, así que entraba, veía el panel entero montado, y solo entonces
el servidor decía que no. Tablas vacías, pero el formulario de la preventa a la
vista.

**No filtraba ni un dato**: el servidor nunca respondió. Pero le confirmaba a un
desconocido que este panel existe y que llegar aquí es cuestión de estar en una
lista — que es justo lo que no se le quiere decir, y por lo que a quien no es
admin se le responde lo mismo que a una sesión caducada.

Ahora los datos van primero: `recargar()` lanza si el servidor no te reconoce, y
la puerta se queda donde estaba.

Con un sitio estático **el marcado del panel no se puede esconder** —cualquiera
puede leer `admin.html`— y no se pretende: lo que no puede pasar es que la
página se comporte como si hubieras entrado.

### Pestañas, porque nueve bloques en fila no se leen

El panel era una tira de nueve bloques y había que bajar media pantalla para
llegar a la preventa. Cinco pestañas: resumen, preventa, torneos, jugadores y
brutos, registro.

No esconden nada: separan lo que se mira a diario de lo que se toca una vez.
Las tarjetas del resumen se quedan **fuera de las pestañas**, siempre visibles,
porque son la cabecera del panel y no una sección más.

La pestaña viva va en el hash. Recargar mientras miras la preventa y volver al
resumen es molesto justo cuando más se recarga.

### Parar el juego

`supabase-36-mantenimiento.sql`. Un interruptor en el panel, **fuera de las
pestañas y arriba del todo**: se toca con prisa y normalmente con algo roto,
así que enterrarlo sería esconder el botón de emergencia en un cajón.

**Existe para el hueco de las migraciones.** Con un `alter table` a medio
aplicar o una Edge Function recién pegada, una pelea que entra puede escribir
contra un esquema que ya no es el que espera — y eso no da un error, da datos
torcidos. Hasta ahora ese hueco se cubría a base de ir rápido; con dinero de
por medio, ir rápido no es un plan.

**La comprobación está en la Edge Function**, antes de repartir a ninguna ruta.
Esconder botones en el navegador no para nada: las rutas se llaman con `curl`.

**El administrador pasa siempre.** Si se bloqueara, quedarías fuera de tu propio
panel justo cuando necesitas entrar a apagarlo.

### La caché de diez segundos

Sin ella, cada login y cada pelea pagarían una consulta más para preguntar algo
que casi siempre es «no». Con ella, encender el mantenimiento tarda hasta diez
segundos en surtir efecto — un precio que se paga a gusto, porque el caso en que
importa dura minutos. Al cambiarlo desde el panel la caché se tira, así que en
esa instancia es inmediato.

**Y si la consulta falla, se sigue como si no hubiera mantenimiento.** Un fallo
al leer esta bandera no puede tumbar el juego: sería un interruptor de apagado
que se activa solo cuando la base tiene un mal momento.

### El jugador ve «volvemos en 20 minutos», no «algo ha fallado»

Es la mitad del valor. Un error genérico se lee como que el juego está roto y
la gente no vuelve; un cartel con hora se lee como una molestia.

El cartel tapa la pantalla entera **a propósito**: si se pudiera seguir pulsando
detrás, cada botón daría un error distinto y volvería a parecer roto. Y no
protege nada — quitarlo desde la consola no desbloquea nada, porque las rutas
siguen respondiendo 503.

### Todo cambio queda en `admin_log`

Con el **antes y el después** — sin el antes, un registro solo dice que algo
cambió, no de qué a qué. La tabla tiene RLS activo y cero políticas: un
registro de auditoría que el auditado puede editar no vale nada.

No está para vigilar a nadie: está para poder demostrar qué pasó el día que
alguien pregunte por su saldo. Con un token de por medio, el primer sospechoso
de un saldo raro es siempre quien tiene el panel.

### Trampa de Postgres: `revoke` a `public`

`admin_resumen()` es `security definer`, así que se salta RLS. Revocar su
ejecución **solo a `anon` y `authenticated` no sirve**: en Postgres una función
nace ejecutable por `PUBLIC`, y ese permiso queda. Se comprobó — con el revoke
incompleto, un `POST /rest/v1/rpc/admin_resumen` con la clave pública devolvía
las estadísticas completas del juego.

Y hay que repetir el `revoke` **cada vez** que se haga `create or replace` de
la función, porque recrearla vuelve a conceder el permiso por defecto. Fue lo
que pasó: el paso 8 deshizo en silencio lo que había puesto el 7.

---

## La pelea tiene su propio enlace, y se verifica sola

`pelea.html?id=1284`. Sin cuenta, sin wallet, sin sesión: `fights` tiene lectura
pública desde el paso 7 y una pelea la ve el rival igual que tú.

**Lo importante no es que la enseñe: es que la RECALCULA.** En el navegador de
quien mira, con `brute-combate.js` —el mismo fichero que carga el servidor— y
compara evento por evento con lo guardado.

### La promesa estaba sin cumplir, y el agujero era de datos

La landing dice «combate verificable» desde el primer día. La arquitectura lo
permitía —`simulate()` es puro, se guardan semilla y registro— pero **nadie
podía comprobar nada**, porque para recalcular hacen falta tres cosas y `fights`
solo guardaba dos:

```
seed         ✓
b_snapshot   ✓   copia congelada del rival
a_brute      ✗   una REFERENCIA a tu bruto
```

El comentario que justifica `b_snapshot` dice «el rival sube de nivel después, y
sin congelarlo la pelea dejaría de poder reproducirse». Es igual de cierto para
tu propio bruto, y ahí no se hizo. Peor: `mio` se **muta** con `aplicar()` justo
después de simular, así que al escribir la fila ya no queda ni en memoria como
entró.

O sea que la promesa era cierta **en el momento** —el navegador tenía el bruto
que acababa de mandar— y falsa un segundo después.

`supabase-32-verificable.sql` añade `a_snapshot`. **Las peleas viejas no se
pueden arreglar**: ese dato no existe en ningún sitio. La página lo dice en vez
de fingir que las verifica.

### Un verificador que aprueba todo es peor que ninguno

Por eso existe `prueba-verificable.mjs`: fabrica peleas honestas y peleas
manipuladas, y exige que las primeras pasen y las segundas no. Detecta el
ganador cambiado, los turnos inflados —que son los que deciden las monedas—, un
evento borrado, uno inventado, **un solo golpe retocado en 1 de daño**, y los
atributos hinchados en cualquiera de los dos snapshots.

Y comprueba que la propia página sigue comparando el registro entero: si
`verificar()` se relajara a mirar solo el ganador, todo lo demás seguiría en
verde midiendo otra cosa.

### `side` no significa lo mismo en todos los eventos

Es el tercer fallo de esta familia en el proyecto, y salió a la primera al
mirar la página renderizada: decía **«el animal de Rufus falla»** cuando el lobo
era de Galba.

```
hit · crit · dodge · cubre · ko · muerde    side = el que RECIBE
disarm · cae_mascota                        side = el que ACTÚA
```

La solución no es acordarse: es **no usar `side`**. Los eventos ya traen `att`,
`def` y `mascota` dentro, y con eso no hay nada que deducir.

De paso apareció otro: el mordisco se llama `muerde`, no `mascota`, así que ese
`case` no encajaba nunca y **los mordiscos se tiraban en silencio**. Lo cazó la
comprobación barata de siempre — enumerar los tipos que produce `simulate()` y
exigir que la página nombre cada uno—, que ahora está dentro de la prueba.

---

## Registro de peleas

Tabla `fights`: semilla, registro completo, ganador, turnos, monedas y XP, más
una **copia congelada del rival** (`b_snapshot`). Ese snapshot es
imprescindible: el rival sube de nivel después, y sin él la pelea dejaría de
poder reproducirse.

Guardar la pelea sale casi gratis porque el servidor ya tiene el resultado en
la mano cuando escribe el bruto. Sirve para el historial por bruto, para el
panel, y sobre todo para saber **cuántas monedas se emiten al día** — el número
que avisa de que la economía se ha roto antes de que se note en el precio.

---

## Las salas del ludus

El vocabulario es romano y las pantallas son **sitios**, no menús. Un ludus de
verdad tenía sus dependencias, y eso le da al juego sensación de lugar.

| Sala | Qué se hace | Estado |
|---|---|---|
| La forja | crear brutos | hecha |
| La armería | comprar armas y repartirlas entre tus brutos | hecha |
| La arena | pelear | hecha |
| La clasificación | ver quién manda | hecha |
| El historial | tus compras y retiradas, solo tuyas | hecha |
| El vivarium | comprar mascotas | hecha |
| Los torneos | apuntarse y ver el cuadro | hecha |

`vivarium` era el recinto donde se guardaban las fieras de la arena. El nombre
está elegido; el contenido no existe.

El historial se llama «Historial» y no `tabularium` —que era el archivo público
de Roma y encajaría con el resto— porque lo pidió así el dueño. La clave i18n
es `hist_h1`, así que cambiarlo es una línea por idioma.

### El tablón del ludus

Debajo de los brutos, no encima: **lo primero que tiene que ver el jugador al
entrar es su ludus, no un registro.** Enseña las últimas novedades —quién ganó,
quién cayó, quién subió de nivel y qué le tocó, y qué arma se rompió—.

Sale de `fights`, que desde `supabase-17-eventos.sql` guarda cinco columnas más:
`subio`, `nivel`, `ganancia`, `arma_rota` y `arma`. Todo eso ya lo calculaba la
Edge Function en cada pelea y **se tiraba al acabar la petición**, así que el
tablón solo habría podido decir «ganaste» y «perdiste» — que es la mitad de lo
interesante. Lo que la gente quiere ver al entrar es que subió de nivel y que se
le rompió el mandoble.

**Van en `fights` y no en una tabla `eventos` aparte** porque son propiedades DE
la pelea: subiste de nivel *en* esa pelea, el arma se rompió *en* esa pelea. Una
tabla separada tendría que apuntar a la pelea igual, y abriría la puerta a que
las dos versiones se contradigan.

**Se lee directo de la base**, sin pasar por la Edge Function: `fights` tiene
lectura pública desde el paso 7 y no hay nada que decidir. Es lo contrario que
el historial de compras. La diferencia no es caprichosa: **una pelea la ve el
rival igual que tú; lo que gastas, no.**

Sin peleas no se enseña un recuadro vacío: ocupa lo mismo que uno lleno y no
dice nada.

---

## La preventa

`supabase-31-preventa.sql`. **Nace apagada** y no se enciende desde el código:
se enciende desde el panel, a mano.

### Tres estados, y la previa no es decoración

```
previa    no hay precio todavía  →  se anuncia y NO hay nada que pulsar
viva      se puede comprar
cerrada   se acabó, pero quien compró sigue viendo lo suyo
```

La previa existe porque **hay que poder hablar del proyecto antes de tener el
precio puesto** — si no, no se puede empezar en Twitter sin una landing que
mienta o que no diga nada.

Lo que la hace segura no es que ponga «próximamente»: es que **no lleva ni
botón, ni casilla, ni ninguna dirección**. La wallet que cobra sale del servidor
al reservar y no está escrita en el marcado en ningún estado, así que en previa
no existe ningún camino que acabe en alguien mandando SOL. Y el texto lo dice
sin rodeos: si hoy alguien te pide SOL por $BRUTE, no somos nosotros — que es
la estafa que aparece sola en cuanto un proyecto anuncia preventa.

Se pasa a «viva» solo cuando hay cupo, precio **y** el interruptor puesto: los
tres, no uno.

### Se paga ahora y se reclama después

El comprador manda SOL, la compra queda apuntada, y los tokens se entregan
cuando el dueño abre los reclamos — normalmente al crear el pool, **para que el
precio de referencia lo ponga el proyecto y no el primero que reciba tokens**.

**Lo que eso exige a cambio, dicho claro:** entre que alguien paga y recibe, su
dinero está en tu wallet y él no tiene nada. Eso es custodia y no hay forma de
que no lo sea. Lo único que se puede hacer es que sea verificable a cada paso:

- la firma del pago se guarda → comprobable en la cadena
- lo que se te debe está a la vista en tu pantalla, siempre
- abrir los reclamos deja rastro en `admin_log`: quién y cuándo
- la firma de la entrega también se guarda, **antes** de enviar

La alternativa —entregar en el acto— no necesita nada de esto, pero deja que el
primero que reciba tokens monte el mercado a su precio. **Es un intercambio
consciente, no un descuido.**

### El reclamo usa el orden de la retirada

```
1. abrir    toma las compras pagadas y las deja en vuelo   (atómico)
2. firmar   GUARDA la firma                                 ANTES de enviar
3. enviar   a la red
4. cerrar   marca entregada
```

El fallo clásico es mandar los tokens, caerse antes de apuntarlo, y al
reintentar mandarlos otra vez. En Solana la firma se calcula antes de enviar,
así que se apunta en el paso 2: si algo se rompe después, se va a mirar a la
cadena si llegó. No hay que adivinar.

**Y la firma de la entrega no vive en la compra, sino en su propia tabla.** Si
alguien compró tres veces y reclama de golpe, eso es UNA transacción con UNA
firma, y no cabría en tres filas con la firma marcada como única.

**Un reclamo fallido no devuelve el SOL solo.** «Falló el envío» y «llegó pero
no vi la confirmación» se parecen demasiado desde el servidor; las compras
vuelven a quedar pendientes y se mira la cadena.

### Hay que RESERVAR antes de firmar

Entre construir la transacción y firmarla pasan segundos, y en esos segundos
otro puede llevarse el cupo. Sin reserva, dos personas firman transacciones
válidas por los mismos tokens y la segunda falla **en la cadena, habiendo
pagado ya la comisión de red**.

Se reserva con `for update`, se firma después, y la reserva caduca sola a los
**quince** minutos —tres eran pocos: firmar en el minuto 2:50 y que la red
asiente la transacción en el 3:05 es normal, y no puede costarle el dinero a
nadie. Las caducadas se sueltan al reservar la siguiente, no en una
tarea aparte: si nadie ejecuta la limpieza, el cupo se quedaría bloqueado por
reservas muertas.

### El precio va en lamports, no en dólares

Lo que se firma es una transferencia de SOL, así que el precio se fija en
lamports por token. **El dólar es una consecuencia del precio del SOL**, no
algo que se pueda fijar:

```
$0,025/token con SOL a $73,62  →  339.582 lamports por token
```

Y si el SOL se mueve durante la preventa, el precio en dólares se mueve con él
— con SOL a $120 estarías vendiendo a $0,041. Se corrige cambiando el precio
desde el panel.

### El navegador no decide nada de lo que cuesta dinero

**La transaccion de pago la construye el SERVIDOR.** `pv_reservar` la devuelve
ya montada —con la wallet de destino y el importe dentro— y el comprador solo
la firma. Si el destino saliera del navegador, bastaría con editar el
JavaScript para pagarse a uno mismo y pedir los tokens igual.

Y aun así **el pago se comprueba EN LA CADENA** antes de reservar nada, midiendo
por `postBalances - preBalances` de la cuenta destino en vez de leer las
instrucciones: un pago puede llegar de muchas formas —transferencia suelta,
dentro de otra cosa— y todas dejan el mismo rastro. Se exige además que el
pagador sea el firmante, o alguien podría reclamar el pago de otro.

### No hay sesión, hay firma — salvo en una ruta

La preventa vive en la landing, donde nadie ha iniciado sesión. Así que se firma
un mensaje corto con la dirección dentro y una fecha de menos de cinco minutos.
No abre sesión ni guarda nada: solo demuestra la propiedad de la wallet. Sin
eso, cualquiera bloquearía el cupo entero reservando con direcciones ajenas cada
pocos minutos.

**`pv_mias` es la excepción, y no es un descuido.** Lo que devuelve —cuántos
tokens compró una dirección y cuánto SOL pagó— ya está en la cadena: el pago es
una transferencia pública. Pedir firma ahí no escondería nada; solo sacaría la
ventanita de la wallet a alguien que acaba de entrar a mirar.

### Una reserva CADUCADA también se confirma

Es lo que evita quedarse con el dinero de alguien por quince segundos de red. El
comprador firma dentro de la ventana y la red asienta la transacción después; si
`preventa_confirmar` lo rechazara, ese SOL ya salió de su wallet y llegó a la
nuestra. No es una puerta abierta: quien la llama es la Edge Function **después**
de comprobar el pago en la cadena.

Lo que sí cambia es la contabilidad — una caducada ya salió de `reservado` al
caducar, y restarla otra vez vendería cupo que no queda. La ventana se subió de
3 a 15 minutos por lo mismo.

### El fallo que casi duplica tokens

Al escribir el reclamo, la reconciliación se llamaba con
`ultimoBloqueValido = 0`. Como cualquier altura de bloque es mayor que cero,
`resolver()` devolvía **«muerta» siempre**: una entrega que SÍ había llegado se
habría marcado fallida, las compras habrían vuelto a quedar pendientes, y el
siguiente reclamo habría mandado los tokens otra vez.

No da error, no sale en ninguna prueba, y solo pasa cuando algo falla — o sea,
el día peor. Se vio leyendo la función que se estaba llamando, no ejecutándola.

### El registro de auditoría casi se lleva por delante el guardado

`admin_log.admin` es `not null` y `preventa_config` nació sin ese parámetro. El
insert de auditoría reventaba y arrastraba consigo el cambio entero: pulsabas
Guardar y salía **«algo ha fallado en el servidor»**, sin más.

Dos cosas que dejó claras:

- **Arreglarlo poniendo `'?'` habría sido peor que el fallo.** Un registro que
  no dice QUIÉN no es auditoría. Con un token de por medio, el primer
  sospechoso de un precio raro es siempre quien tiene el panel. Así que
  `p_admin` sale de la sesión, nunca del cuerpo.
- **Un 500 mudo en la pantalla que enciende una preventa es inaceptable**: deja
  al dueño sin saber si guardó o no. Ahora la ruta traduce lo que lanza
  Postgres y, si la función no existe, dice que falta aplicar el SQL.

Y la trampa de siempre: **añadir un parámetro no reemplaza la función, crea
otra**. Hay que tirar la firma vieja a mano o quedan las dos y PostgREST puede
llamar a la que no es. `supabase-29-valvula.sql` tenía el mismo fallo en
`respaldo_fijar` y se arregló antes de aplicarlo.

### El panel dice en qué RED se van a cobrar los pagos

`admin_red` pregunta el **genesis hash** al RPC configurado y lo traduce. Es
distinto en cada red de Solana y no se puede falsificar desde la URL.

Hace falta porque la red del RPC **no se puede adivinar**: la URL la escribe una
persona a mano en un secreto. Y si apunta a devnet mientras alguien paga con SOL
real —Phantom está en mainnet por defecto—, la función busca ese pago en devnet,
no lo encuentra nunca, y esa persona se queda sin tokens y sin su dinero.

Se pinta **en rojo cuando es mainnet**, delante del formulario. No es alarmismo:
mainnet significa que lo que se cobra es dinero de verdad, y esa frase tiene que
estar delante de los ojos de quien va a pulsar «Preventa abierta».

**Nunca devuelve la URL**, solo el host: la URL lleva la clave de API dentro.

### Una fecha se podía poner y no quitar

`coalesce` está bien para los números —mandar `null` significa «no lo toques»—
pero con las fechas eso hace que **poner una sea irreversible**. Vaciar la
casilla no mandaba el campo, y `coalesce` conservaba la vieja.

Suena menor y no lo es: una preventa con una fecha de fin que no se puede
borrar **se cierra sola** el día que toque, y no hay forma de evitarlo desde el
panel.

Se arregla con `p_campos ? 'desde'`, que mira si la clave **viene** en el
objeto — distinto de que venga vacía. Presente y nula = bórrala. Y el panel las
manda siempre, con `null` cuando están vacías.

### Antes de abrir los reclamos, se mira si hay con qué pagarlos

`pv_fondos` compara lo que se debe con lo que hay **en la wallet que entrega**:
tokens, SOL para comisiones, y ~0,002 SOL de renta por cada comprador que
todavía no tiene cuenta de ese token.

Sin esto, abrir los reclamos con la wallet vacía no da un error bonito: cada
reclamo falla, queda en «revisión», y hay que desatascarlos a mano mientras la
gente pregunta dónde están sus tokens. Es el mismo gasto que en devnet falló
diciendo otra cosa — quedarse sin SOL en la operativa.

Vive en `retirar` y no en `auth` porque es la función que tiene la clave del
cofre. Se identifica con la **sesión** del panel, no firmando: pedir la firma
para mirar un saldo sería sacarle la ventanita de la wallet al administrador.

### El panel pide motivo y confirma dos veces

Encender la venta y abrir los reclamos son los dos únicos botones del panel que
empiezan a mover dinero de otras personas. Todo pasa por `preventa_config`, que
exige un motivo de diez letras y deja el antes y el después en `admin_log`.

Se valida **contra lo que quedaría**, no contra lo que había: el mismo guardado
puede poner la wallet y encender la venta a la vez, y una preventa encendida sin
wallet donde cobrar es aceptar pagos que no llegan a ningún sitio.

### Lo que NO se escribe en la web

Ninguna cifra de ganancias, ninguna cantidad, ni «cubre X días», ni cómo se
reparte. Lo único que dice la landing es que **se ganan tokens $BRUTE jugando**.
Es una decisión del dueño y se mantiene: un juego que promete un número y no lo
puede pagar acaba incumpliendo, o pagando a los primeros con el dinero de los
últimos.

### El tope por wallet no es contra ballenas

Es contra que **una sola persona se lleve el cupo entero** y luego decida ella
sola el precio del token vendiéndolo. Con 5.000.000 en preventa y un tope de
250.000 hacen falta 20 compradores como mínimo. No impide usar varias wallets,
pero obliga a molestarse.

---

## Rescatar lo perdido, y por qué el sumidero CRECE

Cuando un arma se rompe o una mascota muere se apunta la pérdida con 24 horas
de plazo. Hasta que caduque se puede recuperar por el **60%** del precio.

La intuición dice que esto encoge el sumidero: si rescatar sale más barato que
comprar, el jugador gasta menos. Y es cierto **para el que iba a recomprar**.

Pero no todos recompran. Perder un oso de 175 duele, y volver a soltar 175
frena a mucha gente: se quedan sin mascota y siguen jugando. Con supuestos
razonables, de cada 100 que lo pierden recompran ~40; con rescate al 60% lo
recuperan ~85:

```
hoy          40 × 175 = 7.000
con rescate  85 × 105 = 8.925      (+27%)
```

**Captura a quien no habría vuelto a comprar.** Ese es todo el truco.

Si se baja mucho el porcentaje, el rescate es una segunda tienda barata y nadie
compra a precio completo. Si se sube a 100%, no lo usa nadie.

### Por qué una tabla y no deducirlo de `fights`

El rescate tiene que ser de un solo uso y tiene que poder **bloquearse**. Con
`for update` sobre una fila, dos peticiones simultáneas no pueden rescatar lo
mismo dos veces pagando una. Deduciéndolo de `fights` no hay nada que bloquear,
y ese es el hueco por el que se duplica un objeto.

### El plazo no es para meter prisa

Es para que la oferta signifique algo. Un rescate que dura siempre es una
segunda tienda con los precios rebajados. 24 horas deja volver al día siguiente
y no más.

---

## La pantalla de retirada

El servidor de retiradas estaba entero desde hacía tiempo —`retirar`, los
topes, la comisión, el registro— pero **no había pantalla**. Nunca se
construyó.

**Todo lo que puede sorprender se enseña ANTES de pulsar:** la conversión de
hoy, la comisión, el mínimo y lo que queda de tope. Un número que cambia
después de darle al botón se lee como un engaño aunque sea un despiste.

Los parámetros salen de la ruta `economia`, no de constantes en el cliente: la
tasa la mueve la válvula y el navegador no tiene forma de saberla. Y lo
retirado hoy sale de `withdrawals`, que el navegador no puede leer —RLS con
cero políticas—, así que tiene que venir por el servidor.

**El botón «Máx» pone el menor de tres cosas:** tu saldo, lo que queda de tu
tope diario y lo que queda del global. Poner solo el saldo sería ofrecerte algo
que el servidor va a rechazar.

**Y con las retiradas cerradas no hay botón muerto:** se explica que el token
no existe todavía y que las monedas no se pierden. Un botón gris sin
explicación se lee como que la web está rota.

### La válvula: solo se paga lo que hay

`supabase-29-valvula.sql`, escrito y **sin aplicar** — no sirve de nada hasta
que exista el token en mainnet y `respaldo_tokens` tenga un valor real.

```
tokens_por_moneda = min(objetivo, respaldo_disponible / deuda_total)
```

Si hay respaldo de sobra se paga el objetivo; si no, se paga menos, solo.
**Lo que garantiza es que el sistema no pueda quedar a deber**, y que si falta,
falte para todos por igual y a la vez en vez de cobrar el primero que llegue.

Lo que **no** garantiza, y está escrito dentro del fichero: no impide que las
ganancias bajen si deja de entrar dinero. Eso no lo arregla ningún mecanismo.
Hace que bajen de forma ordenada en vez de acabar en un impago.

---

## El historial es privado, y no se puede resolver con RLS

Tabla `movimientos` (`supabase-13-movimientos.sql`), con RLS activo y **cero
políticas**: desde el navegador esa tabla no existe.

La reacción natural es «política de lectura donde `address` = el usuario». **No
funciona aquí**, y conviene entender por qué antes de que alguien lo intente: el
navegador lee con la clave `anon`, así que para Postgres todos los jugadores son
el mismo usuario. La sesión de SolBrute es un token opaco en `sessions`, no un
JWT — no hay `auth.uid()` que consultar. Una política de lectura no podría
distinguir a un jugador de otro y acabaría **enseñando el historial de todos a
cualquiera**.

Va por la ruta `historial` de la Edge Function, que sí sabe de quién es el
token. Y esa ruta **no lee `cuerpo.address` en ninguna parte** — ni siquiera
para comprobarlo, porque lo que no se lee no se puede colar por descuido. Las
direcciones de wallet son públicas: salen en la clasificación. Si aceptara una
del navegador, bastaría con copiarla para leer las compras de cualquiera.

---

## Armas

**Son alternativas, no mejoras, y está medido.** Enfrentando las **diecisiete**
opciones todas contra todas con brutos idénticos, ninguna se despega: todas
entre **47,6% y 51,7%**, desvío máximo 2,4 puntos.

**Dos por familia**, la segunda desbloqueada mucho más tarde — pero *no* más
fuerte:

| familia | nivel 1-9 | nivel 18-60 |
|---|---|---|
| dagas | Daga | Estoque (18) |
| escudos | Escudo | Pavés (22) |
| espadas | Mandoble | Espada de caballero (25) |
| lanzas | Lanza | Tridente (30) |
| hachas | Hacha | Hacha doble (35) |
| mazas | Maza | Martillo de guerra (40) |
| guadañas | Guadaña | Guadaña de guerra (50) |
| bastones | Bastón | Bastón herrado (60) |

**Y la segunda no es la primera con más números: es otro trato.** Medido contra
su hermana de familia, entre 44% y 65% — no son reskins. La daga son dos golpes
flojos y el estoque es uno solo, rapidísimo y crítico. El bastón se defiende
solo; el herrado pega y pierde esa defensa.

Que la de nivel 60 no pegue más no es escrúpulo: **si pegara más, las otras
dieciséis pasarían a ser decoración** y comprar sería ganar.

Y sigue siendo piedra-papel-tijera de verdad: **cada arma tiene víctimas y
verdugos**. El bastón gana a la daga 69%, la guadaña al escudo 65%, el escudo al
mandoble 61%, el mandoble al bastón 61%, el hacha al mandoble 60%, la maza a la
lanza 60%.

### Añadir armas obliga a recalibrar las que ya estaban

Las cinco originales estaban cuadradas **entre ellas**, y eso deja de valer en
cuanto entran cuatro más: con nueve, la lanza se iba al **55,6%** y los puños al
**42%** sin haberles tocado un número. Medir solo las nuevas contra un grupo
desequilibrado es medir contra nada.

Los `dmg` de las cinco viejas cambiaron por eso. **`ninguna` es la vara de medir
y su daño se queda en 1,000**: moverlo cambia el daño absoluto de todo el juego
y obliga a rehacer la curva de vida entera.

### Cada una se apoya en un mando distinto

Si solo cambiara el daño serían reskins con otro nombre:

| | qué la hace ella |
|---|---|
| daga | dos golpes flojos, rápida, crítica |
| escudo | encaja mucho menos a cambio de pegar poco |
| lanza | alcance: pega más y se cubre algo peor |
| mandoble | el golpe más fuerte, lento y torpe de esquivar |
| **hacha** | brutal y crítica, pero se te cae mucho y se rompe pronto |
| **maza** | lenta de verdad (`ini -3`) y sólida: aguanta y no se rompe |
| **guadaña** | dos tajos amplios, la más frágil de todas |
| **bastón** | defensivo y velocísimo, pega poquísimo, dura 50 combates |

**El identificador va sin eñe: `guadana`.** El editor de Supabase mangla el
UTF-8 al pegar, y un identificador con eñe ya tumbó un despliegue entero
(`dueñoDe` → `UnexpectedChar { c: '√' }`).

### Cómo se llegó ahí, porque no fue directo

El primer intento tenía al mandoble ganando el **85%** y a la daga el **12%**.
El multiplicador de daño domina todo y el crítico no compensa: subir el crítico
un 10% vale un +8% de daño, y bajar el daño un 28% no se arregla con eso.

Hizo falta un lever de verdad: **golpes por turno**, y que cada golpe se
esquive por separado. Así "rápida y floja" significa algo — la daga sufre
contra rivales ágiles y luce contra los lentos.

### Lo que de verdad las equilibra: que se pierden

- `perder` — probabilidad **por turno** de que se te caiga y pelees el resto del
  combate a puño limpio.
- `fragil` — probabilidad **por combate** de que se rompa para siempre.

Sin estas dos, los puños ganaban el 44%; con ellas, el 50%. **Un arma que se te
puede caer no es una ventaja fiable**, y eso es lo que permite venderlas sin que
comprar equivalga a ganar.

Y la más fuerte es la que más se rompe: el mandoble dura ~11 combates y la daga
~33. El poder cuesta mantenerlo, que es un sumidero de token sin inflar a nadie.

### Las armas no dan más monedas, y no hubo que tocar nada

La recompensa es `12 + turnos`, así que **ganar rápido paga menos**. Medido: un
bruto con mandoble gana más peleas y cobra **menos** al día que el mismo bruto a
puño limpio (38,8 frente a 41,2). Lo que sí sube los ingresos es el nivel, y eso
se juega.

### Precios

Puestos para que el **coste por combate** sea parecido en todas (~3 monedas,
sobre las ~40 que se ganan al día): como están equilibradas, lo único que cambia
entre ellas es cuánto duran. Son un primer número — el panel dirá si sobran o
faltan. Si nadie compra, están caras; si todos llevan la misma, baratas.

**Si tocas estos números, vuelve a medir.** La simulación son cincuenta líneas y
está en el historial del repositorio.

### Familias, y por qué la armería tiene menús

Una **familia** es una fila del pack de iconos: espadas, hachas, escudos. Dentro
puede haber **varias armas**, y esa es la puerta para que sigan entrando a
niveles altos sin que la armería se vuelva una tira ilegible — con nueve ya se
lee mal; con veinte, es inservible.

Lo que comparten es el **arte, no las reglas**. Dos espadas de la misma familia
se dibujan con los mismos iconos y se distinguen por el tamaño —una corta y un
mandoble— pero cada una tiene sus constantes y su propia medición.

**Y las skins se compran por familia.** Comprar la espada en llamas y que solo
valga para una de tus tres espadas sería cobrar dos veces por el mismo dibujo.

`armasDe(familia)` se **deriva** de `FAMILIA_DE`; una lista paralela se
desincroniza el día que entre un arma nueva.

**El nivel 70 existe de verdad**, y por eso la escalera puede llegar tan lejos:

| nivel | peleas | tiempo a 3/día |
|---|---|---|
| 20 | 113 | 1,2 meses |
| 40 | 374 | 4 meses |
| 70 | 978 | **11 meses** |
| 100 | 1.800 | 1,6 años |

### Las skins: ochenta compras y ninguna que medir

Una skin cambia el dibujo y **nada más**: mismo daño, mismo crítico, misma
rotura. Eso le da dos propiedades que ningún otro sumidero tiene:

- **El precio lo pone el dueño sin desequilibrar nada.** Con las armas hay que
  medir; aquí no hay nada que se pueda romper.
- **Es recurrente.** Ocho armas × diez aspectos son ochenta compras posibles, y
  comprar una no quita las ganas de comprar otra.

```
players.skins     lo que POSEES          {"daga": [3, 7]}
brutes.arma_skin  lo que LLEVA ese bruto   3
```

Mismo reparto que las armas desde el paso 14, con **una diferencia a propósito:
una skin comprada no se gasta al ponerla.** Puedes vestir a tus tres brutos con
la misma daga dorada sin comprarla tres veces.

**Y vive en el BRUTO, no en el jugador.** Guardarlo en el jugador sería menos
código, pero entonces el rival no la vería: la lista de rivales sale de
`brutes`, y un cosmético que los demás no ven no lo compra nadie.

**Las filas 1-10 y 11-20 son el mismo diseño.** El pack llama «cortas» a la
segunda, pero son las mismas espadas con la hoja un poco más corta, y a 32
píxeles eso no se distingue: la daga parecía un mandoble pequeño. Se le puso la
**13**, que tiene la hoja curva y el gavilán en gancho — la única silueta de su
fila que no se confunde con una espada.

**Y el tamaño es lo que separa una daga de un mandoble.** Los ficheros son todos
de 32×32, así que sin encogerlos se pintan iguales: `TAM_ICONO` en la arena y
`ESCALA_FICHA` en la armería. No es cosmética, es legibilidad.

**La skin gratis no siempre es la primera de la fila.** La lanza y el bastón de
la primera columna son un palo sin punta y sin pomo, que se lee como un fallo de
dibujo antes que como un arma humilde. Por eso `SKINS` lleva `gratis` aparte de
`base`.

**Se validan por rango, no por lista.** Con las armas hubo que abrir un `check`
de Postgres cada vez que entraba una nueva (paso 33); con `0..9` eso no vuelve a
pasar. Y un número fuera de rango no rompe nada: `iconoDe` cae a la gratis, que
es lo que impide que un `<image>` roto deje al bruto desarmado.

### El inventario es del JUGADOR, no del bruto

Cambiado en `supabase-14-inventario.sql`. Antes vivía en `brutes.armas`, o sea
que las armas eran del bruto, y se notaba jugando: no se podían pasar de un
bruto a otro, un bruto nuevo empezaba sin nada aunque tuvieras cinco guardadas,
y comprar la misma arma dos veces daba «ya la tienes» aunque la quisieras para
otro.

```
players.armas   {"daga": 2, "mandoble": 1}    copias LIBRES, en tu bolsa
brutes.arma     "daga"                         la que ese bruto lleva
```

**En la bolsa solo están las copias sin asignar.** Al equipar, el arma sale de
la bolsa; al soltarla o cambiarla, vuelve. Se hace así para que no haya dos
sitios diciendo lo mismo: si la bolsa guardara todo lo que posees *y además* el
bruto dijera qué lleva, habría que restar para saber qué está libre — y el día
que las dos cuentas no cuadren (una petición a medias, una carrera) aparecen
armas duplicadas o perdidas sin que nadie sepa cuál número era el bueno.

Total poseído = bolsa + lo que llevan puesto tus brutos. **Se cuenta, no se
guarda.**

**Con cantidades a propósito:** tres brutos pueden llevar tres dagas, y para eso
hay que comprar tres. Es más natural como inventario y es un sumidero más.

**Comprar y equipar son funciones de Postgres con `for update`, no dos
escrituras sueltas desde la Edge Function.** Son operaciones de dos pasos que
tienen que cuadrar —cobrar y dar el arma; quitar de la bolsa y poner en el
bruto—, y hechas por separado un fallo entre medias deja el arma en los dos
sitios a la vez, o en ninguno. Sobre un token con valor real, eso es duplicar
dinero. Está probado: dos compras simultáneas con saldo para una dan 200/403 y
una sola copia.

**Romperla no la devuelve a la bolsa.** Es lo que hace que el mandoble cueste
mantenerlo (~11 combates) y que las armas sigan siendo un sumidero en vez de
una compra única.

`brutes.armas` sigue existiendo pero **está vacía y no significa nada**. Se dejó
por no romper la función desplegada en el hueco entre aplicar el SQL y
redesplegar.

---

## Mascotas (el vivarium)

**Una mascota SÍ es una ventaja, a diferencia de las armas.** Quien lleva una
gana **+7 puntos** sobre quien no. Eso es deliberado, y lo que impide que sea
comprar victorias son tres frenos:

- **Estorba:** resta 2 de iniciativa. Sin eso la ventaja sube al 63%.
- **Muere y no vuelve**, como el arma que se rompe.
- **No da más monedas ni más XP.**

A +7, quien no lleva gana 43 de cada 100: molesto, no excluyente. Ese era el
límite buscado.

| | ventaja | cae cada | muere cada | coste/combate | precio |
|---|---|---|---|---|---|
| perro | +6,9 | 6,1 | 22 | 3,72 | 80 |
| lobo | +7,3 | 4,5 | 20 | 3,55 | 70 |
| oso | +7,1 | 8,4 | 30 | 3,63 | 110 |

Dentro de **0,4 puntos**, equilibradas entre ellas (49,5-50,7%) y con el **mismo
coste por combate** — que es el número que de verdad las compara, igual que con
las armas. La duración no se mueve: mediana 8, p95 13.

**Medido con las diecisiete armas puestas, que es el juego de verdad.**
`prueba-mascotas.mjs` mide a puño limpio (`arma:"ninguna"` en los dos), y ahí
salen dos puntos menos. Ninguna de las dos está mal: miden entornos distintos, y
el que importa es el que juega la gente. Ojo además con esa herramienta: sus
muestras son pequeñas y la ventaja le baila ~2 puntos entre pasadas, así que
sirve para ver que nada se ha roto, no para afinar a 0,3.

### Y se habían descuadrado solas, sin que nadie las tocara

Estaban cuadradas contra un juego de **cinco** armas. Al entrar las diecisiete
—y al recalibrarse los `dmg` de todas— el entorno cambió, y a las mascotas no
las volvió a medir nadie:

| | diseño | a lo que había llegado |
|---|---|---|
| ventaja | +7,0 las tres | +9,2 · +10,1 · **+11,2** |
| separación entre ellas | 0,3 puntos | **2,0 puntos** |
| muere cada | 20-30 combates | 31 · 27 · **59** |

**Daban más ventaja y costaban menos**, que es exactamente la dirección
equivocada: a +11,2 quien no lleva mascota gana 39 de cada 100, y la raya del
diseño estaba en 43. Es lo mismo que ya avisa la nota de las armas —«añadir
armas obliga a recalibrar las que ya estaban»— y con las mascotas no se hizo.

**Hay que medir EMPAREJADO**, y es lo que hizo posible arreglarlo: los mismos
brutos y la misma semilla, una vez con mascota y otra sin ella. Sin emparejar,
casi toda la varianza viene de la tirada de atributos —un bruto con 8 de fuerza
gana lleve perro o no— y el margen de error sale de ±1,6 puntos. Con un objetivo
de 0,3, el primer calibrador estaba **persiguiendo ruido**: daba +6,1 y +7,9
para el mismo valor y se creía las dos.

**Y la identidad se fija A MANO antes de calibrar.** Dejando que el calibrador
moviera todas las palancas, llegaba a la ventaja pedida con las tres idénticas
—misma vida, mismo `cubre`, mismo precio, `ataca` casi igual—: tres nombres para
la misma mascota. Es el mismo criterio que ya tienen las armas. Ahora `cubre` es
compartido a propósito —lo que distingue a una mascota es cómo muerde y cuánto
aguanta, no cuánto se interpone— y el oso sigue siendo el que encaja.

Los precios cayeron solos en **80 / 70 / 110**, que es la tabla que ya estaba
escrita aquí. No fue un rediseño: fue volver a lo que había.

### Caer y morir son dos cosas distintas

Es el par que ya tenían las armas y que allí funcionaba:

```
arma      perder   la sueltas el resto del combate
          fragil   se rompe para siempre

mascota   hp a 0   CAE: deja de ayudarte y sale de la arena     cada ~6 peleas
          mortal   de esas caídas, la que no se levanta          cada ~20-30
```

Antes quedarse sin vida **era** morir. El sumidero funcionaba, pero el jugador
veía desaparecer a su lobo cada veinte y pico peleas sin haberlo visto caer
nunca: una sorpresa desagradable y, sobre todo, invisible. Ahora cae a menudo y
a la vista, y solo a veces no se levanta.

**El servidor solo mira `murioA`.** `cayoA` es informativo y no toca la base de
datos. Llamar a `mascota_morir` con la caída borraría la mascota cada seis
peleas y el vivarium sería un agujero, no un sumidero.

Las dos las decide `simulate()` **con la semilla**, así que la muerte es
reproducible como el resto del combate.

### La mascota tiene turno propio

Es un actor más en el orden del turno —hasta cuatro: los dos brutos y las dos
mascotas— y va justo después de su dueño. Antes mordía al final del turno del
bruto, sin paso propio, y el efecto era que **el jugador pagaba 80 monedas por
un número que subía en algún sitio**. Actúa **6,4-6,9 veces por combate** entre
mordiscos y fallos, y todo queda en el registro.

Darle turno propio cambió el equilibrio entero: hubo que rehacer las seis
constantes de las tres. Un mordisco dentro del turno ajeno y un mordisco propio
no son la misma mecánica aunque la probabilidad sea la misma.

### Se midió ANTES de escribirlas, y menos mal

El diseño de partida —mordisco fuerte y mucha cobertura— daba **73-82% de
victorias y +25% de duración**. Comprar mascota era comprar el combate. Se
descartó por medirlo, no por opinar.

**`prueba-mascotas.mjs` ya no copia el combate: llama a `simulate()` tal cual**
y lo único que toca es la tabla `MASCOTAS` en memoria. Antes sí lo copiaba, con
una validación que comprobaba que sin mascota diera idéntico al original — y
esa validación **no sirvió de nada** el día que la mascota tuvo turno propio,
porque sin mascota los dos seguían dando idéntico y la copia medía el juego
viejo sin avisar. Una copia validada solo por el caso que no la ejercita es una
copia sin validar. **Si tocas estos números, vuelve a pasarlo.**

### El modelo es el de las armas

`players.mascotas` es la bolsa (copias libres), `brutes.mascota` la que lleva
puesta. Comprar y equipar son funciones de Postgres con `for update`.

---

## Los brutos caminan, y las articulaciones ya estaban ahí

Hasta la v0.2 el combate era el sprite entero deslizándose 56px con
`translateX`. Ahora **el atacante camina hasta el rival, le pega y vuelve**,
moviendo las piernas y los brazos.

No hizo falta comprar sprites, y esa es la parte importante. El SVG ya se
ensamblaba por piezas con sus articulaciones dentro —`legs` sale de la cadera
(`g.hipY`), `shieldArm` del hombro en (46,54), `weaponArm` de (62,52)—, así que
animarlo fue **envolver cinco piezas en un `<g>` con su pivote**.

Se miró comprar personajes animados. No sirven: los packs son «tres personajes,
cada uno con su estilo», fijos. Comprarlos sería cambiar la forja y los diez
enteros que caben en una cuenta de Solana por tres aspectos para todo el mundo.

### Nueve articulaciones, y las dos que más se notan no son las obvias

```
melena · pieI · pieD · torso · brazoB · codoB · cabeza · brazoA · codoA
```

Las que cambian el movimiento no son los brazos. Son:

- **El torso**, porque inclina TODO el cuerpo de golpe. Va sobre la cadera y
  dentro llevan los dos brazos y la cabeza, así que sus giros se componen —
  que es como funciona un cuerpo.
- **El codo**, porque es lo que hace que un golpe *se arme* antes de salir en
  vez de aparecer ya estirado. El codo ya existía como vértice del trazo
  (`M62 52 L78 40 L84 24`): solo hubo que partirlo en dos.

El arma va DENTRO del antebrazo, así que gira con él sin tocar nada más.

### Dos poses que estaban al revés, y solo se vieron mirándolas

**La carga tapaba la cara.** En reposo el arma ya apunta arriba, así que girar
el brazo hacia atrás la lleva sobre la cabeza. Es correcto como gesto y falso
como dibujo: se lee como un fallo de renderizado. Se arma menos y se compensa
con el torso y la pierna de atrás.

**Encajar inclinaba hacia delante.** Tenía el torso a +14, igual que golpear —
o sea que el que recibía el golpe se echaba *encima* del que pegaba. Encajar es
salir despedido hacia atrás.

Ninguna de las dos da error, ni sale en ninguna prueba. Solo se ven poniendo
las siete poses en fila y mirándolas.

### El sprite NO se redibuja en cada cuadro

`pose()` cambia el `transform` de los cinco grupos que ya están en el DOM.
Redibujar serían 3,8 KB de SVG por fotograma y a 60 fps eso no va en un móvil.

Y llevan `transform-box: view-box`, que hace que el pivote se lea en unidades
del SVG. **Sin eso cada articulación gira sobre su propio centro y el bruto se
desmonta.**

### La distancia se MIDE, no se supone

`medirAlcance()` lee el hueco real entre los dos y guarda el 82% en
`--alcance`. Los 56px fijos de antes se quedaban a medio camino en pantalla
grande y se pasaban de largo en móvil. Se vuelve a medir al redimensionar.

**Y se mide al arrancar `play()`, no al montar la pantalla.** Al montar todavía
está oculta, `getBoundingClientRect()` devuelve ceros y el alcance salía 0px —
el bruto se quedaba clavado. Un elemento con `display:none` no tiene medidas,
solo lo parece.

### Lo que cuesta

Medido: de 14,4 s a 15,0 s por combate a 1×. Casi nada, porque el flujo viejo
tenía esperas muertas que se han ido. La mascota **no se acerca**: muerde desde
su sitio, que para eso está al lado.

---

## La arena pinta los eventos, o no existen

`addLog` terminaba en un `else` que convertía **cualquier evento desconocido en
un KO**. Y `disarm` ya lo era desde que existen las armas: aparecía como
«*undefined* queda fuera de combate» —porque un desarme no tiene `def`— y
además `setHp` recibía `undefined` y mandaba la barra de vida a `NaN%`.

No era raro: **1.201 de cada 3.000 combates** con arma tienen un desarme.

Dos cosas que conviene no repetir:

- **Lo desconocido no se pinta.** Ahora cada tipo se nombra y el resto se
  descarta. Un evento sin dibujar es un hueco; un evento dibujado como otra
  cosa es una mentira.
- **`side` no siempre es el que recibe.** En `disarm` es el del ATACANTE, así
  que el código que deducía «el otro es quien pega» animaba al bruto
  equivocado. En `cubre`, el que pega es `att` y `def` es el cubierto — se
  escribió al revés la primera vez y el registro decía «el oso encaja el golpe
  de Galba», que era su propio dueño.

**Comprobación barata que encontró todo esto:** enumerar los tipos que produce
`simulate()` en unos miles de combates y comprobar que `addLog` y `play()`
nombran cada uno. Nueve tipos hoy. Si añades un evento al combate, pásala.

La vida de la mascota se lleva **en el navegador** mientras se reproduce: el
registro solo dice cuánto encajó. Es un contador de reproducción, no una fuente
de verdad — quien decide sigue siendo `simulate()`.

Y al caer **se redibuja el sprite sin ella**. Si solo cambiara una barra, el
jugador seguiría viendo a su lobo peleando después de haberlo perdido.

---

## Clasificación

Pantalla `scRank`, ordenada por nivel → XP → victorias.

**Solo salen jugadores reales, y no porque se filtre**: los brutos de la casa se
generan en el navegador al emparejar y no se guardan nunca, así que la tabla
`brutes` solo contiene brutos que alguien forjó. Es la misma decisión que hace
honesto el emparejamiento — si algún día los bots se persistieran, habría que
excluirlos aquí a mano.

Tu propio bruto se resalta en verde Solana y con la etiqueta `rank_me`.

**Los bots van etiquetados como `BOT`.** La landing promete "no solo contra bots", frase que
solo se sostiene si el jugador puede distinguirlos. Ocultarlos sería más cómodo y
es lo que hace el género, pero en un proyecto que vende combate verificable,
mentir en el emparejamiento es la grieta por donde se pierde la confianza.

---

## Persistencia

**El estado vive en Supabase** (proyecto `ihrcvartuuyvftxdxztt`, Postgres en
París). `supabase-cliente.js` habla con su API REST usando `fetch`, sin librería,
para no romper el "sin dependencias ni build". Las tablas se crean con
`supabase-01-tablas.sql`.

Un bruto es una **fila**, no un JSON dentro de otro JSON. Por eso el
emparejamiento puede filtrar por nivel en Postgres —índice `brutes_level_idx`— en
vez de traerse todo al navegador.

El objeto `STORE` sigue ahí como **red de seguridad**: si la base de datos no
responde, `loadMe()` cae a modo local y el juego funciona en esa pestaña en vez
de quedarse en blanco. La variable `nube` dice en cuál de los dos modos estás, y
la pastilla de la cabecera lo muestra ("en la nube" / "solo esta sesión").

La identidad del jugador se guarda en `localStorage` (`solbrute:addr:v1`), que sí
sobrevive al doble clic sobre `file://`. Hoy la dirección es inventada por
`fakeAddr()`; en la Fase 1 la pondrá la wallet. La casilla es la misma, así que
no habrá migración.

### El arma que se perdía al traducir

`aBruto()` en `supabase-cliente.js` convierte la fila de la base en objeto de
juego, y no copiaba `arma` ni `armas`. La fila sí las traía (`select=*`), pero
`spriteProfile` recibía `undefined` y dibujaba los puños.

Lo que lo hacía difícil de ver: **la armería SÍ funcionaba**, porque al comprar
la respuesta del servidor escribe `active.arma` a mano. O sea que el arma se
veía hasta que recargabas la página, y entonces desaparecía sin motivo. El
jugador lo reportó como «se me ha perdido la daga y no me deja comprar» — lo
segundo era el servidor respondiendo `409 ya la tienes`, porque sí la tenía.

**Cada campo nuevo en una tabla hay que añadirlo también al traductor.** El
comentario de `aBruto` dice «se traduce en un solo sitio para que un cambio de
esquema no se esparza», y precisamente por eso ese sitio no se puede olvidar.

**Nombres de bruto únicos en todo el juego**, no solo dentro de tu ludus: lo
impone `brutes_name_key`. La forja lo comprueba **antes** de cobrar la plaza y
avisa con `name_taken`.

**Y permanentes:** la ruta `guardar` quita el nombre del PATCH. Aceptarlo dejaba
renombrar el bruto a voluntad —incluido ponerse el de otro— y, si el nuevo
estaba pillado, el índice único hacía que la función respondiera un 500 mudo.
El síntoma era que nadie podía pelear, porque al fallar el guardado la lista de
rivales no llegaba a escribirse: un error que hablaba de rivales y cuya causa
era el nombre.

### La sesión caducada solo avisaba bien UNA vez

`pedirAuth` tenía `if(r.status === 401 && sesion)`. La primera llamada tras
caducar entraba ahí, borraba la sesión y avisaba correctamente. **La segunda ya
encontraba `sesion` a `null`**, se saltaba el `if`, y salía por el error
genérico.

Resultado: la pantalla decía «no he podido resolver el combate, inténtalo otra
vez» cuando lo que pasaba era que había que volver a firmar. El jugador se queda
dándole al botón, y el mensaje le está diciendo justamente que insista.

Un 401 de la Edge Function significa siempre lo mismo —el servidor no te
reconoce— haya sesión guardada o no. Ya no lleva la condición.

### Lo que todavía no es seguro

**El navegador ya no escribe ni calcula el combate.** La ruta `pelear` sortea la
semilla, llama a `simulate()` en el servidor y devuelve el registro; el
navegador solo lo reproduce. El cliente ya no dice «he ganado, dame 20
monedas»: dice «quiero pelear contra el rival 3 de mi lista» y el resto lo
decide la función.

Lo que queda abierto es la **retirada**: no existe todavía, y es donde el número
en Postgres se convierte en dinero. Ver `TOKEN.md` y `BACKEND.md`.

**Un detalle de diseño, no un fallo:** al pelear, el historial del rival no
cambia. Peleas contra una copia de su bruto, como en el género. Cuando el combate
se calcule en servidor, será el servidor quien decida si eso se registra en los
dos lados.

---

## Pendientes

- [x] ~~Login con firma (SIWS)~~ — hecho. Ver «Wallet».
- [x] ~~Mover `simulate()` al servidor~~ — hecho. Vive en `brute-combate.js`,
      que cargan el navegador y la Edge Function, y la ruta `pelear` sortea la
      semilla y simula allí.
- [x] ~~Tope de emisión~~ — hecho y verificado en vivo. Ver «El tope de emisión».
- [x] ~~Historial de combates por bruto~~ — las peleas se guardan en `fights` y
      el tablón del ludus las enseña.
- [x] ~~La retirada: la contabilidad~~ — hecha y atacada (35 comprobaciones)
      con el modo `simulacro`. Ver «La retirada».
- [x] ~~Crear el token en devnet~~ — hecho. Mint
      `CQrsHLKWmgBjd1UUi115KzQ3GRfGfM8xafoUeP3ajWqX`, 100M, 9 decimales, las dos
      autoridades en `null`, repartido en 7 wallets.
- [x] ~~El envío on-chain~~ — hecho y **probado contra devnet**: el saldo sale de
      la operativa y llega a la wallet del jugador. Ver «La retirada».
- [ ] **Antes de mainnet**, y ninguna es código:
      · las claves las crea el dueño, las frías en papel
      · un **RPC de pago** en `SOLANA_RPC` — el público da `429` a la segunda
        retirada seguida
      · **presupuesto de SOL** para la operativa, y vigilarlo: si llega a cero
        las retiradas paran
      · lo **legal**, que sigue pendiente desde el principio
- [ ] Verificar el dato de `~400ms` de Solana en la landing antes de publicar
- [x] ~~Dominio propio~~ — `solbrute.io`. Los meta tags apuntan ahí y hay
      `CNAME` en la raíz. **El dominio va tambien en `DOMINIOS_OK` de la Edge
      Function, y eso se despliega ANTES de tocar el DNS** — el navegador manda
      `location.host` dentro de lo firmado, así que sin esa línea el login
      responde «dominio no autorizado» a todo el mundo.
- [x] ~~`og-image.png`~~ — hecha con el arte del propio juego. La genera
      `og-image.html` con Chrome headless; se guarda el generador porque un
      PNG suelto no se puede rehacer cuando cambie la paleta.
- [x] ~~Mascotas (el vivarium)~~ — hechas. Ver «Mascotas». La duda que las
      frenaba —«dos contra dos alarga las peleas»— se midió: no se alarga.
- [ ] **La preventa** — escrita entera y sin aplicar. Falta: aplicar
      `supabase-31-preventa.sql`, redesplegar las dos Edge Functions, poner
      los secretos y configurarla desde el panel. Ver `DESPLIEGUE.md`.
      Los ataques de `prueba-hostil.ts` (12b y 12c) hay que pasarlos antes.
- [x] ~~Copia de seguridad de la base~~ — hecha. `respaldo.mjs`, con su
      comprobación. Ver «La copia de seguridad».
- [ ] **Torneos semanales** — anotado, sin construir. Lo que hay que decidir:
      · ¿Te apuntas o entran todos? Apuntarse da menos gente y más intención.
      · Cuadro de 8 o 16, eliminatorias. El servidor puede resolverlas de golpe,
        y como guarda semilla y registro, cada combate se puede reproducir.
      · **El premio es lo delicado.** Si reparte muchas monedas, las peleas
        diarias sobran y el torneo se come el juego. Si reparte pocas, nadie va.
        Instinto: prestigio y un arma rara, no un montón de monedas.
      · Las peleas del torneo **no deberían gastar las 3 diarias**, o la gente
        tendría que elegir entre torneo y jugar.
- [ ] **Ver `IDEAS.md`** para la lista completa, ordenada y razonada.
- [ ] **Skins y aspectos** — el mejor sumidero que existe, y el más barato de
      hacer aquí: el aspecto ya son diez enteros pequeños, así que añadir un
      peinado o un tatuaje es añadir una entrada a una lista.
      **No tocan el equilibrio**, y por eso se les puede poner el precio que se
      quiera sin convertir el juego en pay-to-win. Los buenos sumideros son
      RECURRENTES: comprar una vez saca monedas una vez.
- [ ] Arte de personajes con ilustrador (capas en PNG sobre el sistema actual)
- [x] ~~Portar el renderizador por capas a la landing~~ — hecho: las dos páginas
      dibujan desde `brute-render.js`. (La nota de "bustos con casco" en el hero
      ya era falsa cuando se escribió: el arte estaba portado, lo que quedaba era
      la copia duplicada del código.)

## La retirada

Funciona de punta a punta y está **probada contra devnet**: el saldo de Postgres
sale de la wallet operativa y llega a la del jugador. `retiradas_abiertas` sigue
en `false` porque no existe el token de mainnet, no porque falte código.

**El envío vive en su propia Edge Function** (`supabase-funcion-retirar.ts`), no
en `auth`. Dos motivos, y el segundo es el que manda: las librerías de Solana
pesan y metidas en `auth` cada login y cada pelea pagarían su arranque en frío
(~2 s medidos); y la clave del tesoro compartiría contexto con todo el juego.
Lo que sí se queda en `auth` es LEER las retiradas — una consulta sin riesgo.

### El orden, que es lo único que impide cobrar dos veces

```
1. retirada_abrir     reserva el saldo y crea la fila   (atómico, en SQL)
2. construir y firmar la transacción                    → ya existe la firma
3. retirada_firmar    la GUARDA                          ANTES de mandar
4. mandarla a la red
5. retirada_cerrar    marca enviada
```

El fallo clásico es mandar los tokens, caerse antes de apuntarlo, y al
reintentar mandarlos otra vez. En Solana **la firma se puede calcular antes de
mandar la transacción**, así que se apunta en el paso 3: si algo se rompe
después, la firma está guardada y se puede ir a la cadena a mirar si llegó. No
hay que adivinar. Y `withdrawals.firma` es único, así que un reintento no puede
reclamar el mismo envío.

### Un fallo NO devuelve el saldo solo

«Falló el envío» y «llegó pero no vi la confirmación» se parecen demasiado
desde el servidor. Devolver a ciegas es exactamente cómo alguien cobra dos
veces: una en tokens y otra en saldo. Queda en `fallida` con su firma, se mira
la cadena, y si de verdad no llegó se devuelve con `retirada_devolver`, que
exige motivo y deja el antes y el después en `admin_log`.

### El mínimo de retirada no es un capricho

Cada envío cuesta comisión de red y **la paga el tesoro**, no el jugador. Sin
mínimo, mil retiradas de 1 moneda vacían el SOL del tesoro sin que nadie haya
retirado nada apreciable. Es un ataque barato y silencioso.

### Los topes cuentan lo PENDIENTE, no solo lo enviado

Si contaran solo lo enviado, se abren cien retiradas a la vez y el tope no
existe mientras ninguna ha terminado.

### El modo `simulacro`

`red = 'simulacro'` hace toda la contabilidad y marca la retirada como enviada
con una firma `SIMULACRO-…`, sin tocar ninguna cadena. Existe para poder atacar
la parte que puede perder dinero **antes de que haya dinero**: 35
comprobaciones, ninguna falla, incluidas las dos carreras.

Encontró un fallo real: la firma de simulacro medía 30 caracteres y
`retirada_firmar` exige 32, así que reventaba justo después de descontar el
saldo. Y ahí se vio que el diseño aguanta — la fila quedó en `pendiente` con su
rastro, recuperable, en vez de dejar monedas desaparecidas.

**Para probar los topes hay que bajarlos.** Una cuenta nueva gana ~20 monedas
al día (3 peleas, bruto gratis) y con el mínimo en 100 no llega a retirar nada.
Y para que salte el tope del JUGADOR hay que pedir el saldo entero de una vez:
si se pide a plazos, salta antes `sin_saldo`, porque la comprobación de fondos
va antes que la del tope.

### Cuando algo falla al mandar, se le PREGUNTA a la cadena

La primera versión daba por perdida cualquier retirada que fallara después de
emitir, y el jugador se quedaba sin saldo y sin tokens. Probándola contra devnet
salió que ese caso es común y tonto: el RPC público limita peticiones,
`sendRawTransaction` lanza, y la transacción **nunca llegó a la red**.

No hace falta adivinar, porque Solana lo deja demostrar:

| En la cadena | Veredicto | Qué se hace |
|---|---|---|
| la firma aparece sin error | llegó | se cobra |
| aparece con error | no movió tokens | se devuelve |
| no aparece y el blockhash **caducó** | no puede llegar nunca | se devuelve |
| no aparece y el blockhash sigue vivo | todavía puede llegar | revisión |

Los tres primeros se resuelven solos y son demostrables. **Solo el cuarto
necesita a una persona**, y para eso exactamente se apunta la firma antes de
mandar nada.

### La wallet caliente necesita SOL, y quedarse sin él fallaba en silencio

El hallazgo que justifica el ensayo entero en devnet.

La primera retirada funcionó; todas las siguientes fallaron con errores de red
genéricos. El motivo no estaba en el código sino en el saldo de la operativa:

```
SOL de la operativa               0,000956
crear una cuenta de token cuesta  0,002039
```

**Los $BRUTE no se mandan solos.** Cada transacción cuesta comisión de red y, si
el jugador retira por primera vez, hay que CREARLE su cuenta de token — unos
0,002 SOL de renta. Todo eso lo paga la operativa **en SOL**, no en $BRUTE, y
nadie lo había presupuestado.

Lo grave no era quedarse sin SOL —se rellena en un minuto— sino que **fallaba
diciendo otra cosa**. En mainnet habrían sido retiradas cayendo en cascada y
horas buscando el fallo donde no estaba. Ahora se comprueba antes de tocar el
saldo de nadie, y el log dice qué wallet recargar.

Con 0,5 SOL alcanza para unas 245 retiradas a jugadores nuevos.

### Atacada contra devnet, con tokens de verdad

| Ataque | Resultado |
|---|---|
| Mandar los tokens a otra wallet (`address`, `destino`, `p_owner`, `wallet`) | van a la MÍA; la otra recibe 0 |
| **Dos retiradas simultáneas** | 200/403 · una fila · el saldo baja UNA vez |
| Cuadre de la operativa | salieron 25, llegaron 25 |
| Sin sesión / sesión inventada | 401 |
| Las cinco funciones con la clave anon | `42501` |

El destino **sale siempre de la sesión**. La ruta no lee ninguna dirección del
cuerpo, así que mandar la de otro no hace nada.


---

## Seguridad: qué se comprobó y cómo

**No se puede impedir que un jugador edite el JavaScript de su navegador.** Es
su ordenador. La defensa no es evitarlo: es que hacerlo no le sirva de nada.
Y editar el cliente es MENOS peligroso que llamar a la API directamente con
`curl`, que es como se ha probado todo aquí.

`prueba-hostil.ts` corre la Edge Function real contra una base simulada
(`prueba-banco.ts`) y la ataca con un cliente reescrito: subirse el nivel,
regalarse peleas, monedas y armas, inventarse la lista de rivales, elegir la
semilla, saltarse el precio de la plaza, tocar el bruto de otro y colarse en
las rutas de admin. **35 ataques, ninguno funciona.**

**Si añades una ruta a la función, añádele aquí su ataque antes de
desplegarla.** Esto aguanta porque se prueba, no porque el código sea bonito.

### La preventa, atacada contra el servidor desplegado

`prueba-preventa.mjs`, con **claves ed25519 recién generadas** y sin base
simulada: habla con la Edge Function de verdad y con Postgres de verdad. 31
ataques, ninguno funciona.

| Ataque | Resultado |
|---|---|
| Reservar y reclamar sin firma | 401 |
| Firma inventada | 401 |
| **Firma válida, hecha con OTRA clave** | 401 |
| **Firma propia, pero el mensaje nombra otra dirección** | 401 |
| Reusar una firma de hace una hora, o del futuro | 401 |
| Firmar un mensaje sin fecha | 401 |
| Decir «ya he pagado» sin haber pagado | 403 |
| Reclamar tokens que no se han comprado | 403 |
| Las 8 funciones de Postgres con la clave anon | `42501` |
| Leer las tres tablas con anon | invisibles, y `preventa` tiene fila |
| `PATCH`/`POST` directo para encenderla y regalarse tokens | la fila no se movió |

Las dos en negrita son las que importan: la firma cuadra criptográficamente y
aun así se rechaza, porque el mensaje tiene que nombrar **esa** dirección y la
clave que firma tiene que ser **la suya**. Sin lo primero, una firma dada en
cualquier otra web valdría aquí. Sin lo segundo, cualquiera bloquearía el cupo
entero con direcciones ajenas.

**Y encontró un fallo real:** `tokens: 1e21` es finito y positivo, así que
pasaba la validación, y `JSON.stringify` lo escribía como `1e+21`. Postgres no
puede meter eso en un `bigint`, así que la llamada reventaba con un **500
mudo** — el servidor cayéndose por un número que el navegador puede mandar
cuando quiera, sin decir por qué. Ahora se exige `isSafeInteger` y un tope.

Por eso el banco **cuenta los 500 aparte y también falla con ellos**. Un 500 no
es un agujero, pero tampoco es aguantar bien, y sin contarlo el siguiente pasa
desapercibido.

### La economía y el inventario, atacados contra el servidor real

No con la base simulada: con `curl` y con logins SIWS de verdad, generando
claves ed25519 desechables. Ninguno funciona.

| Ataque | Resultado |
|---|---|
| `emision_cobrar`, `emision_reciclar`, `seguridad_usar` con la clave anon | `42501` |
| `arma_comprar`, `arma_equipar`, `arma_dar`, `arma_romper` con la clave anon | `42501` |
| `PATCH economia` para vaciar el fondo | 204 **y la fila no cambia** |
| `POST emision` con tasa 1000 | `401` |
| Crearse un jugador con `POST /players` y monedas | `401`, RLS lo bloquea |
| Subirse el saldo con `PATCH /players` | 204 **y sigue igual** |
| Comprar sin saldo / mandando tu propio precio / un arma inventada | 403 · 403 · 400 |
| Equipar un arma que no tienes / el bruto de otro | 403 · 403 |
| Pedir el historial de otra dirección | devuelve el tuyo |
| **Dos compras simultáneas con saldo para una** | 200/403, **una copia** |
| **Dos equipados simultáneos de la misma copia** | la bolsa acaba vacía, no duplicada |

Las dos últimas son las que importan de verdad: son las únicas que podían
**duplicar dinero**. Pasan porque `arma_comprar` y `arma_equipar` son funciones
de Postgres con `for update`, no dos escrituras sueltas desde la función.

**Ese `204` que no cambia nada es la trampa de siempre**, y por eso está aquí
otra vez: RLS no da error, hace las filas invisibles. Hay que comprobar la fila
después, nunca el código de estado.

**Y tiene una segunda cara que también engaña: LEER.** Una tabla con RLS y cero
políticas —`withdrawals`, `movimientos`, `admin_log`— devuelve `200 []` con la
clave anon, siempre, tenga las filas que tenga. Al atacar la retirada eso me
hizo dar por bueno «no se creó ninguna fila» cuando en realidad no podía verlas,
y descuadró la comprobación de los libros porque no veía lo retirado.

Para mirar esas tablas hay que ir por la ruta con sesión de la Edge Function,
que es la única que las ve. **Un `[]` no es una prueba de que esté vacío.**

### Perder algo también se apunta

`movimientos` guardaba solo compras y retiradas: lo que sale del saldo. Pero lo
que de verdad hace desaparecer tus monedas no es el momento de pagar, es el
momento en que aquello se rompe.

```
compras un oso por 175        →  quedaba apuntado
el oso muere a las 30 peleas  →  no quedaba en ningún sitio
```

Y esa segunda línea es la que el jugador busca cuando se pregunta dónde está su
oso. En la arena se ve caer, pero **quien le da a «saltar al resultado» —o sea,
todo el mundo a partir de la décima pelea— no veía nada.** Ahora la pérdida sale
en tres sitios: el cartel del final, el tablón del ludus y el historial.

**Van con `monedas = 0` a propósito.** No te cobran al morir; se apuntan para
que exista el rastro. El historial suma esa columna para enseñar el total
gastado, y sumar aquí contaría la compra dos veces.

### El vocabulario vive en tres sitios, y nadie avisa si se rompe

Un tipo de movimiento tiene que existir en los tres: la Edge Function lo
escribe, `movimiento_apuntar` lo permite en su lista blanca, y `app.html` le
pone etiqueta en tres idiomas.

Si uno se desincroniza **no falla nada visible**: `apuntar` traga los errores a
propósito —el jugador ya pagó, quedarse sin apunte es molesto pero perder la
compra sería peor— así que el resultado es un historial con huecos y ninguna
alarma. El ataque 15 lee los tres ficheros y lo compara.

### El servidor y Postgres no se hablan en español

Las funciones del paso 25 lanzan **marcas**, no frases: `sin_copias:daga`,
`no_es_tuyo`, `nivel_insuficiente:7`, `sin_saldo`, `desconocido:x`.

Costó un 500 aprenderlo. El paso 14 lanzaba «no tienes **ninguna** % libre»
—arma es femenino— y al reescribir la función en el paso 25 se copió la
redacción de las mascotas, «no tienes **ningun** %». La Edge Function seguía
buscando «ninguna», no encajaba, y equipar algo que no tienes devolvía «algo ha
fallado en el servidor» en vez de «no tienes esa arma».

**Una letra, y ninguna de las dos partes estaba mal por sí sola.** Dos programas
no pueden entenderse en un idioma que tiene géneros, tildes y sinónimos.

El ataque 14 del banco lo comprueba solo: lee las marcas **del propio `.sql`**,
función por función, hace fallar cada una contra la ruta que puede lanzarla, y
exige que ninguna acabe en un 500. Ya encontró dos más — `desconocido` y
`precio_invalido` no estaban traducidas en las rutas de compra. No se podían
alcanzar hoy, pero *«no se puede alcanzar»* es una suposición que caduca.

**Si añades un `raise exception` al SQL, esta prueba te obliga a traducirlo.**

### Una prueba puede pasar por el motivo equivocado

Al añadir el candado de nivel hubo que enseñarle al banco simulado a responder
a las funciones de Postgres (`/rpc/…`). Antes devolvía **404**, así que la
llamada moría, la ruta daba 500, y tres ataques de la armería salían «aguanta»
sin haber llegado a comprobar nada.

Con la respuesta puesta se destaparon solos. Uno de ellos marcaba como agujero
**poder comprar dos veces la misma arma** — que desde el inventario del paso 14
es justo lo correcto: tres brutos, tres dagas. Y otro esperaba que el mandoble
costara 35 monedas, el precio de hacía tres cambios.

**Una prueba con un número copiado a mano envejece sola** y acaba fallando por
estar desactualizada, no por haber encontrado algo. Ahora leen el precio y el
nivel de `C.ARMAS` y `C.MASCOTAS`, que es la misma fuente que usa el juego.

**Y el banco NO reimplementa lo que hacen las funciones de Postgres.** Solo
apunta con qué se las llamó. Copiar `arma_comprar` allí sería una tercera
versión que se desincroniza el primer día, y una prueba que pasa contra una
copia equivocada es peor que no tener prueba. Lo que sí comprueba —y no puede
comprobar nadie más— es que la Edge Function le pasa a Postgres lo que debe:

> Si alguien quita `p_nivel_min` de una llamada, el SQL usa su valor por
> defecto (1) y **el candado se apaga sin fallar**. Ningún error que lo delate.
> Ese es el agujero que este banco existe para encontrar.

### Un torneo se podía quedar atascado con el bote dentro

Resolver un torneo son dos llamadas, y entre medias pasa todo el trabajo:

```
torneo_tomar    exige 'inscripcion'   →  deja 'en_curso'
   ...barajar, simular los 15 combates de un cuadro de 16,
      y mandar el cuadro entero con el registro de cada pelea...
torneo_cerrar   exige 'en_curso'      →  deja 'terminado'
```

Si algo falla en medio —un fallo de red al mandar el cuadro, que con 16
inscritos son varios cientos de KB— el torneo se queda en `en_curso` **para
siempre**: el bote retenido, nadie cobra. Y `admin_torneo_resolver` exigía
`inscripcion`, así que desde el panel tampoco había forma de sacarlo. Hacía
falta SQL a mano.

**Lo que hace seguro el rescate es que `torneo_cerrar` es atómico.** Es una
función de plpgsql, o sea una transacción: si falla a mitad no deja escrito ni
un combate ni un premio. Así que un torneo en `en_curso` es, con certeza, uno
del que no se guardó nada, y rehacerlo no puede duplicar nada. Si en cambio
llegó a guardar y lo que se perdió fue la respuesta, el estado ya es
`terminado` y el mismo `if` lo rechaza. Los dos casos, el mismo estado.

Hoy no hay ningún torneo creado, así que era latente. Se arregla ahora porque
el día que pase habrá dinero de gente dentro.

### El reparto se podía cambiar con gente ya apuntada

`admin_torneo_editar` bloquea la entrada y las plazas cuando hay inscritos —«el
bote ya se cobró a ese precio»— y no los porcentajes del premio.

Y el comentario de arriba **ya decía lo correcto**: «cambiar la entrada *o el
reparto* con gente ya apuntada sería cambiarles las reglas a mitad de partida».
Pero esa guarda solo salta con el torneo ya empezado, o sea con las
inscripciones cerradas. Justo en el hueco donde hay gente dentro y todavía se
admiten más, se podía.

Es la tercera vez en un día que aparece lo mismo: **el comentario describe la
defensa completa y el código implementa la mitad.**

Los cuatro porcentajes se bloquean juntos, porque `saneaTorneo` los valida como
un bloque que debe sumar 100 y quitar tres dejaría un reparto que no suma.

### Borrar un jugador quemaba sus monedas

Los pasos de limpieza por SQL (16 y 24) cuadran la reserva después de borrar
cuentas, con una fórmula razonada que tiene en cuenta el fondo de garantía. El
botón del panel no lo hacía: borraba la fila y ya.

```
en circulación  +  reserva restante  +  (fondo − 5.000.000)  =  reserva total
        ↓ baja                ↑ no sube
```

No es imprimir dinero, es **quemarlo** — pero `respaldo.mjs` diría «no cuadra»
a partir de ese día y para siempre, y esas monedas quedan sin poder volver a
emitirse nunca.

Ahora se devuelven con `emision_reciclar`, que mantiene la invariante exacta:
el 90% a la reserva y el 10% al fondo, que es justo el término
`(fondo − 5.000.000)`.

**Y va DESPUÉS del borrado, no antes.** Al revés, si el borrado fallara tras
haber reciclado, las monedas estarían en los dos sitios a la vez: eso sí sería
imprimir. Entre quemar e imprimir se elige quemar, y se avisa fuerte al log.

### Comprar una skin salía como si te hubieran pagado

`apuntar` recibe las monedas con signo, y el historial pinta por él: `neg =
monedas < 0`, y si no lo es le pone un `+` delante y lo colorea de ganancia.
Los seis apuntes de compra van en negativo… menos el de las skins, que era el
más nuevo. Comprar una de 45 salía como **«+45»**.

Cuesta cero verlo cuando lo miras y no lo ve nadie mientras no lo mire, porque
no falla nada. La comprobación lee los apuntes del propio fichero y exige que
las cinco clases de compra lleven el menos delante — probada devolviendo el
fallo a mano, que es la única forma de saber que una prueba detecta algo.

### La defensa estaba en el SQL y la puerta de arriba no se había enterado

`preventa_confirmar` acepta una reserva **caducada** a propósito, con ocho
líneas explicando por qué: el comprador firma dentro de la ventana y la red
asienta la transacción después. Firmar en el 14:50 y que se confirme en el
15:05 es normal, y rechazarlo sería quedarse con su SOL.

Y la Edge Function respondía **410 antes de llamarla**, así que esa defensa no
llegaba a ejecutarse nunca.

Lo que lo hace peor es cómo caduca una reserva: **de forma perezosa, y la
dispara otra persona**. La barre `preventa_reservar`, o sea la reserva del
siguiente comprador. No dependía ni de ir lento:

```
12:14     Alicia firma y paga        ← el SOL sale de su wallet
12:15:02  Bruno reserva → esa llamada marca la fila de Alicia como caducada
12:15:05  la red asienta el pago de Alicia
12:15:10  Alicia dice «he pagado»  →  410
```

Su SOL en nuestra wallet y ninguna compra apuntada.

No abre nada dejarla pasar: quien llega ahí ya pasó `pagoValido`, que lo
comprueba en la cadena. `cancelada` se sigue rechazando — esa se anuló a mano,
no por el reloj.

**Es el mismo patrón que la firma sin dominio, y ya van dos en un día:** una
capa defiende, la de encima no lo sabe, y el comentario de la de abajo se lee
como si el problema estuviera resuelto. Por eso la comprobación que lo blinda
no es una petición —haría falta una reserva caducando a mitad— sino **leer las
dos listas de estados y exigir que coincidan**. Es la misma comprobación barata
que ya usan las marcas de Postgres y los tipos de evento.

### El bote de un torneo también está en circulación

Al inscribirse, las monedas **salen de `players.coins` y entran en
`tournaments.bote`**. Siguen existiendo; están en depósito. Y la invariante
sumaba solo `players.coins`:

```
en circulación  +  reserva restante  =  reserva total     ← se queda corta
```

Así que `respaldo.mjs` habría dicho **«no cuadra»** por la cantidad exacta del
bote cada vez que hubiera un torneo abierto. Y eso es peor que no comprobar:
una alarma que salta sola todas las semanas enseña a ignorarla, y entonces no
se mira el día que el descuadre es de verdad.

El panel tenía el mismo hueco en `monedas_en_juego` — enseñaba monedas
«desaparecidas» justo cuando hay un torneo vivo, que con un token de por medio
es el susto que no conviene darse sin motivo. `supabase-37-botes.sql` añade
`monedas_deposito` **al lado**, sin cambiarle el sentido al número que ya
estaba: comparar dos capturas de pantalla y que no cuadren, sin saber cuál medía
qué, es peor que tener un número de más.

Un torneo `terminado` o `cancelado` no retiene nada: los premios volvieron a
los jugadores y el resto pasó por `emision_reciclar`.

### Los decimales del token se suponían, y eso vacía el tesoro

El fallo **más caro** que puede tener este proyecto, y todavía no ha pasado
porque el mint de mainnet no existe.

`supabase-funcion-retirar.ts` mandaba con `const DECIMALES = 9n`, y encima
llevaba este comentario:

> *«Si algún día se crea el de mainnet con otros, esto hay que cambiarlo aquí —
> mandar con los decimales equivocados es enviar mil veces de más o de menos.»*

O sea que el riesgo estaba identificado, escrito, y **confiado a que alguien se
acuerde**. Si el mint de mainnet sale con 6 decimales —lo que usa USDC, y de lo
más común— la primera retirada de 100 monedas manda 100.000 tokens. El tesoro se
vacía con las primeras y en la cadena no hay vuelta atrás.

Ahora se le **preguntan al mint**, que los lleva dentro y son inmutables: se
leen una vez por arranque en frío y se cachean. Si no cuadran con los esperados,
no se envía nada — 503, y el log dice qué mint tiene qué. **Parar es
recuperable; mandar mil veces de más, no.**

Y el orden importa: la comprobación lanza **antes** de firmar y de mandar, así
que se cae por el camino de `emitido = false` y el saldo del jugador vuelve
intacto.

Es la misma lección que el agujero de las skins, con tres ceros más: **un
comentario no es una comprobación.**

### La firma de la preventa no ataba el dominio

El login lo ata desde el primer día, y la nota que lo explica dice por qué:
«sin él, una web fraudulenta podría reutilizar tu firma aquí». La preventa vive
en la landing, usa otra función, y ahí no se hizo.

`firmaValida` exigía solo dos cosas: que el mensaje contuviera tu dirección y
una fecha ISO reciente. Eso es un formato **comunísimo** — media cripto pide
firmar exactamente eso. Así que una firma que el comprador hubiera dado en
cualquier otra web servía aquí.

No hay robo posible por ese camino: los tokens de `pv_reclamar` van siempre a la
dirección del firmante. Lo que sí se podía era **reservar cupo en nombre de
otro**, que es literalmente lo único que esa firma existe para impedir.

Lo llamativo es dónde estaba el fallo: **la landing ya mandaba el dominio y el
propósito dentro del mensaje.** Lo que faltaba era que el servidor los exigiera.
Mandar un dato y no comprobarlo es decoración — y peor, decoración que se lee
como una defensa cuando alguien audita el cliente.

`DOMINIOS_OK` va ahora también en `supabase-funcion-retirar.ts`, repetida a
propósito: son dos funciones desplegadas por separado. **Si se añade un dominio,
va en las dos.**

### Una skin de dagas puesta en un mandoble

El agujero **económico** de la revisión, y lo tapaba un comentario que decía lo
contrario de lo que hacía el código. `poner_skin`:

> *«La familia se saca del arma que lleve el bruto»* — y leía `cuerpo.arma`.

Postgres comprueba que **tengas** la skin en la familia que le mandan, y luego
se la pone al arma que el bruto lleva **de verdad**. Dos cosas distintas, y el
navegador decidía la primera:

```
compras la skin 3 de dagas          45 monedas
tu bruto lleva un mandoble
mandas arma:"daga", skin:3          → Postgres mira dagas, y tienes la 3 ✓
                                    → el bruto queda con arma_skin = 3
                                    → y se dibuja icon_04: la 3 de ESPADAS
```

**Ocho skins al precio de una**, y el mejor sumidero del proyecto convertido en
un descuento del 87%.

No se puede arreglar en el SQL: la tabla de familias vive en `brute-combate.js`
y Postgres no la conoce — que es justo por qué el dato venía de fuera. Se
arregla leyendo el arma del bruto (filtrando por dueño, para no confirmarle a
nadie que existe el bruto de otro) y derivando la familia de ahí.

**Un comentario no es una comprobación.** Este decía exactamente lo correcto y
llevaba desde el primer día encima de un código que hacía otra cosa; se leía
como si ya estuviera resuelto. Lo cazó el banco de ataque preguntando lo único
que sabe preguntar: *¿con qué llamaste a Postgres?*

### `ARMAS["constructor"]` no es undefined

El fallo más serio de la revisión, y lo alcanzaba **cualquier jugador con
sesión** — o sea todos.

Media docena de rutas comprueban lo mismo, y parece bastante:

```js
const w = C.ARMAS[id];
if (!w || id === "ninguna") return 400;
```

Pero un objeto normal hereda de `Object.prototype`, así que `ARMAS["constructor"]`
devuelve una función. Es verdadero. Pasa el `if`. Y entonces `w.precio` es
`undefined`, `JSON.stringify` **borra la clave entera** al mandarla, PostgREST no
encuentra ninguna función con esa firma y responde `PGRST202`, que no encaja con
ninguna marca traducida: **500 mudo**.

Vale igual con `__proto__`, `toString`, `valueOf`. Y alcanzaba a `comprar`,
`equipar`, `comprar_mascota`, `equipar_mascota`, `comprar_skin` y `poner_skin`.

Es la misma familia que el `tokens: 1e21` de la preventa: **el servidor
cayéndose por un valor que el navegador puede mandar cuando quiera.** Un 500 no
es un agujero por sí solo, pero tampoco es aguantar bien.

**Se arregla en la raíz, no ruta por ruta:**

```js
for (const tabla of [ARMAS, MASCOTAS, SKINS, FAMILIAS, FAMILIA_DE])
  Object.setPrototypeOf(tabla, null);
```

Sin prototipo, `ARMAS["constructor"]` vuelve a ser `undefined` y las decenas de
comprobaciones que ya existían pasan a ser correctas **de golpe**. Ir ruta por
ruta habría funcionado hoy y habría fallado en la ruta que se escriba mañana:
una defensa que hay que acordarse de repetir es una defensa que se olvida.

Y sale gratis en los tres sitios a la vez, porque la Edge Function carga el
mismo fichero (`import "./brute-combate.js"`) que el navegador y que las pruebas.

### El renderizador lanzaba con un aspecto torcido, y no es tu pantalla la que se rompe

`bust()` y `spriteProfile()` reventaban con un `look` fuera de rango
(`SKIN[L.skin]` es `undefined` y desestructurarlo lanza). Y esto no dibuja solo
tu bruto: dibuja **el de los demás** — la lista de rivales, la clasificación, el
tablón. Un solo aspecto torcido en la base deja la pantalla en blanco a todo el
mundo, no a su dueño.

Hoy el servidor ya lo sanea al escribir, así que en la base no hay ninguno malo.
Pero eso es **una** puerta, y el día que se añada otra vía de escritura el fallo
no sale en ninguna prueba: sale en la pantalla de un tercero.

**La prueba de que el sitio era el renderizador:** `pelea.html` había tenido que
escribirse su propio `lookSano` para poder dibujar peleas ajenas. Cuando dos
páginas copian la misma defensa, la defensa estaba en el sitio equivocado. Ahora
`sano()` vive dentro de `brute-render.js`, la copia de `pelea.html` se borró, y
las siete entradas envenenadas —`undefined`, `null`, `{}`, índices enormes,
negativos, texto, prototipo— dibujan en vez de lanzar. Un `look` bueno pasa
intacto.

### Lo que se coló en el repositorio público, y no era código

`.claude/settings.local.json` iba **subido a GitHub**. No lleva claves: lleva los
permisos que se van concediendo sesión a sesión. Y dentro había esto:

```
"WebFetch(domain:bartostore.es)"
"Read(//Users/alvaroreyesgiraldez/Proyectos/bartostore/**)"
"Bash(mv Desktop/cartera Proyectos/cartera)"
```

O sea el nombre de **otro proyecto**, su dominio y cómo está montado el disco de
casa. Más `.DS_Store`, que es basura de macOS y también estaba subida.

Los dos salen del seguimiento y entran en `.gitignore`. `launch.json` **se
queda**: ese sí describe cómo se arranca este proyecto y le sirve a cualquiera
que lo clone. La diferencia no es la carpeta en la que viven, es de quién son:
uno es del proyecto y el otro es de tu máquina.

**Siguen en el historial de commits.** No son credenciales, así que no hay nada
que rotar, pero quien clone el repositorio puede leerlos en los commits
anteriores. Reescribir el historial de un repositorio público ya publicado es
una decisión aparte y no se hizo sin pedirlo.

### Dos cosas que se aprendieron atacando

**Cloudflare corta antes de llegar.** Un `arma` con `'; drop table players; --`
devuelve **HTML y 403**, no JSON: es el WAF que hay delante de Supabase, no el
código. Defensa de sobra, pero cuidado al interpretar resultados — ese ataque
no estaba midiendo lo que parecía. El que sí mide es un nombre inofensivo que
no existe (`excalibur` → 400), que prueba la lista blanca de verdad.

**Un banco de pruebas también se equivoca.** Varias "vulnerabilidades" de las
primeras pasadas eran fallos míos: la forja espera `bruto:{name,look}` y no los
campos sueltos, `arena` exige `version`, y `PGRST202` significa "no encuentro
esa firma" —porque mandé `{}` sin parámetros— y no "la función no existe".
Antes de dar por bueno un fallo, comprueba que el ataque está bien escrito.

### Lo que se encontró en la revisión y por qué apareció

| Agujero | Causa |
|---|---|
| Ponerse nivel 100 y 10/10/10 por `guardar` | a esa ruta se le fueron quitando campos uno a uno según daban problemas; nunca se preguntó qué debía quedar. La respuesta era: nada |
| Aspecto sin validar → pantalla en blanco ajena | el renderizador lanza con un `look` fuera de rango, y el aspecto se dibuja en la lista de rivales de otros |
| Nombre sin filtrar → XSS almacenado | el nombre se pinta en pantallas ajenas y el token de sesión vive en `localStorage` |
| `limpiar_nonces` y `limpiar_sesiones` abiertas | la trampa del `revoke` a `public`, por segunda vez |
| Errores 500 mudos | `accion` no validada como texto y los ids sin comprobar |

**El patrón que se repite:** cada vez que un dato viaja del navegador al
servidor hay que preguntarse *qué pasa si viene envenenado*, y cada vez que un
dato viaja del servidor a la pantalla de OTRO jugador hay que preguntarse *qué
pasa si lo escribió un atacante*.

---

## La copia de seguridad

`respaldo.mjs`. Hasta ahora **no había ninguna**: un `delete` mal escrito en el
SQL Editor se llevaba los brutos de todo el mundo sin vuelta atrás.

```bash
export SUPABASE_SERVICE_KEY='…'
node respaldo.mjs                      # guarda
node respaldo.mjs --ver respaldos/…    # comprueba
```

**No sustituye a las copias de Supabase, y esa es la gracia.** Vive en tu disco
y no depende de que tu cuenta siga existiendo ni de que no borren el proyecto
por error. Una copia que vive dentro del mismo sitio que protege no es una
copia.

### Se creyó una copia vacía la primera vez que se probó

Con la clave `anon` copió sin un solo error y sacó ✓ en las quince tablas.
`movimientos`, `withdrawals`, `preventa_compras` y `admin_log` salieron con
**cero filas** — porque RLS las hace invisibles, no porque estuvieran vacías. Es
la trampa de siempre (`200 []` no prueba nada) con la peor cara posible: **una
copia inútil que parece perfecta**, y de la que te enteras el día que vas a
restaurar.

Ahora mira el `role` que va dentro del JWT y se niega a correr con otra clave.
Y de segundo cinturón, `economia` y `preventa` tienen una fila fija cada una: si
vienen a cero, no se guarda nada.

### Una copia que nadie ha restaurado no es una copia

Por eso existe `--ver`, y por eso el fichero guarda el número de filas de cada
tabla: **un JSON truncado a la mitad se abre igual de bien que uno entero.** Sin
una cuenta que cuadre no hay forma de saber que está completo. Y de paso
comprueba la invariante de la economía sobre los datos copiados.

Las copias van a `respaldos/`, fuera del repositorio: llevan direcciones y
saldos de gente.

---

## Verificación rápida antes de dar algo por bueno

```bash
# claves de traducción usadas pero no definidas, y listas descuadradas
grep -o 'data-i18n="[^"]*"' app.html | sort -u | wc -l
```
Comprobar a mano que `sex`, `hairM`, `hairF`, `cloth`, `face` y `tat` tienen el
mismo número de entradas en `es`, `en` y `fr`.

Si tocas `brute-render.js`, **abre los dos ficheros con doble clic**, no por un
servidor: es la única forma de detectar que has roto la carga sobre `file://`.
Con un servidor delante, un `type="module"` mal puesto pasa desapercibido.

### Las pestañas del SQL Editor también engañan

Es la misma trampa con otra cara, y costó dos rondas. **Supabase guarda el texto
de cada pestaña**, así que volver a darle a Run ejecuta lo que había escrito, no
la versión nueva del fichero. Se corrigió un fallo en `supabase-12`, se volvió a
pasar «el 12», y corrió el viejo: la reserva siguió desbordada y `arma_dar` no
llegó a crearse.

**Pestaña nueva y `cat fichero.sql | pbcopy` cada vez.** Y comprueba el
resultado en la base, no el mensaje de éxito.

Lo mismo vale para el editor de la Edge Function: después de desplegar, busca
dentro del código algo que solo esté en la versión nueva.

### La versión a la vista, para no adivinar

`VERSION_JUEGO` en `app.html` se pinta en la cabecera (`beta · v0.1.0`). No es
decoración: cuando alguien dice que un fallo corregido le sigue pasando, lo
primero es preguntar qué versión ve. Si es la anterior, es caché, y se acabó la
discusión.

Es distinta de la `VERSION` de `brute-combate.js`, que numera las REGLAS y la
comprueba el servidor para rechazar clientes viejos. Esta es para humanos;
aquella es para máquinas.

### El editor de Supabase mangla el UTF-8 al pegar

Los mensajes de la Edge Function que ve el jugador van **en ASCII a propósito**.
No es descuido: se comprobó mirando los BYTES que devolvía la función
desplegada y donde debía haber `c3 b3` (ó) había `e2 88 9a e2 89 a5` (√≥). El
jugador llevaba horas viendo «sesi√≥n no v√°lida» y nadie lo había notado,
porque en pantalla parece un fallo cualquiera de fuente.

**Los comentarios sí llevan acentos**: su mojibake dentro del editor es fea pero
no la ve nadie, y el fichero del repositorio es la fuente de verdad.

**Y ya no se comprueba a ojo:** `prueba-ascii.mjs` distingue las tres cosas
—cadena, identificador y comentario— siguiendo el estado del texto. Hace falta
un analizador y no un `grep` porque hay que entender también las expresiones
regulares: la primera versión marcaba `/[^\p{L}\p{N} .'\-]/gu` como cadena,
porque veía el apóstrofo de dentro. **Un comprobador con un falso positivo
conocido es uno que se aprende a ignorar**, y entonces no sirve el día que
encuentra algo — la misma razón por la que la invariante tuvo que aprender a
contar los botes.

Encontró tres que llevaban tiempo ahí, y una de ellas **la ve el jugador**:
`"carácter no válido en base58: "` sale por `no pude verificar la firma: …`, así
que quien mandara una dirección mal formada leía `car√°cter no v√°lido`.

**Los IDENTIFICADORES también en ASCII, y esto es lo importante.** Una función
se llamaba `dueñoDe` y el despliegue fallaba entero con
`UnexpectedChar { c: '√' }`. En un comentario la mojibake es fea; en un nombre
tumba el despliegue.

Y una advertencia sobre cómo se arregló mal la primera vez: un script que
de-acentuaba «solo dentro de las cadenas» recorriendo el fichero entero trató
los apóstrofos de los comentarios como comillas de apertura, se tragó todo hasta
el siguiente y destrozó el formato — 272 líneas borradas. Para tocar cadenas hay
que apuntar a un patrón concreto (`error: "..."`), no recorrer el fichero.

### La caché de `file://` engaña

Al abrir con doble clic, **el navegador se queda con la versión antigua de los
`.js` y del HTML** aunque los hayas guardado. Se ha perdido tiempo dos veces
depurando fallos ya corregidos, y una vez viendo la app en español después de
haberla pasado a inglés.

Para desarrollar:

```bash
node servidor-local.js     # http://localhost:8777, sirve con no-store
```

Y para la comprobación final, doble clic — que es como lo va a abrir la gente.
`⌘ + Shift + R` ayuda pero no siempre basta.

```bash
node --check brute-render.js
```

---

## Tono del copy

Honesto, sin inflar. El footer de la landing dice abiertamente que no hay token,
ni contrato en mainnet, ni recompensa con valor real. **Eso se mantiene hasta que
deje de ser cierto.** En un sector donde todo el mundo exagera, decirlo claro es
lo que da credibilidad.

En la app, la pantalla de la puerta explica en tres pasos qué pasa al conectar
—leemos tu dirección, firmas gratis, no se mueven fondos—. No es relleno legal:
la mayor fricción en cripto es el miedo a firmar, y explicarlo antes convierte
mejor que ocultarlo.
