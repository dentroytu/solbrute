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
| `supabase-01-tablas.sql` | Crea las tablas. Se pega en el SQL Editor | Aplicado |
| `supabase-02-rerolls.sql` | Añade `rerolls_left` y `pool` a `brutes` | Aplicado |
| `servidor-local.js` | Servidor de desarrollo, sin caché. No lo necesita el juego | Herramienta |
| `BACKEND.md` | Esquema y contrato de API | Paso 1 hecho a medias |
| `EMPEZAR.md` | Guía de arranque para novato | — |

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
La landing nunca pide wallet. En el script de la landing:

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
- Subir de nivel cuesta `round(80 × nivel^1.5)` XP y da +2 de vida y, **solo 4
  de cada 10 veces**, +1 a un atributo (`PROB_ATRIBUTO`).
- El perdedor se lleva un tercio de las monedas, no cero: castigar la derrota
  con nada hace que la gente deje de pelear cuando va perdiendo.
- **Un cambio de lista de rivales al día por bruto** (`REROLLS_DAY`). Ver
  «Emparejamiento».

### Curva de atributos

Constantes en `app.html`, agrupadas bajo «equilibrio»: `STAT_INI`, `STAT_VAR`,
`HP_INI`, `HP_VAR`, `HP_NIVEL`, `STAT_MAX`. **Tocar el equilibrio es tocar esas
seis, no repartir números por el fichero.**

Un bruto nuevo sale con **1-4 en cada atributo** sobre un tope de 10, y 40-50 de
vida. Empieza flojo a propósito: si naciera cerca del tope, subir de nivel no
cambiaría nada y la progresión —que es el motor del género— dejaría de existir.

El tope de 10 no se toca sin rehacer las fórmulas de daño y esquiva, que están
calibradas para ese rango.

**Los brutos de la casa siguen la misma curva que un jugador** (`botStats`):
reciben `nivel - 1` puntos repartidos al azar y `HP_NIVEL` de vida por nivel. Si
usaran otra fórmula, el emparejamiento por nivel sería mentira — mismo número en
la ficha, distinta fuerza real.

**Los atributos son escasos a propósito.** Un bruto de nivel 20 tiene 5,0 de
media por atributo; con la regla anterior tenía 8,8.

Cuidado al tocar esto: se probó compensar el atributo que no toca con vida
extra y **los combates pasaron de 7 turnos a 19**, porque la vida crecía y el
daño no. Por eso `HP_NIVEL` es 2 y no más. Con la regla actual las peleas van
de 7 a 8 turnos de mediana y ninguna llega al tope de 40.

El 60% de niveles que hoy solo dan vida es el hueco donde entrarán las armas y
las mascotas cuando existan.

Comprobado con 5.000 combates por nivel simulados.

### Sobre la economía del token

Cuidado con esto: si más brutos = más peleas = más recompensas, comprar plazas se
vuelve pay-to-earn y el juego se convierte en granja. **La recompensa por plaza
extra tiene que ser sublineal**, o la plaza no puede pagarse a sí misma. Es lo
que hunde a la mayoría de juegos con token.

Y el primer bruto es gratis por una razón comercial: nadie compra una cripto para
probar un juego que no ha jugado.

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

### Lo que la función NO arregla todavía

El combate lo calcula el navegador y el servidor se lo cree. Recorta lo
imposible pero no arbitra: puedes darte monedas o victorias en tus propios
brutos. Cerrarlo es mover `simulate()` a la función.

**Hasta entonces esto no es seguro para dinero real.**

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
| 1c | Mover `simulate()` al servidor para que arbitre el combate | ACTUAL |
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

**Nombres de bruto únicos en todo el juego**, no solo dentro de tu ludus: lo
impone `brutes_name_key`. La forja lo comprueba **antes** de cobrar la plaza y
avisa con `name_taken`.

### Lo que todavía no es seguro

**El navegador ya no escribe**, pero sigue calculando el combate. La función
recorta lo imposible y ata cada fila a su dueño; lo que no puede es saber si
de verdad ganaste esa pelea. Mover `simulate()` al servidor es lo que falta.
Ver «Wallet» y `BACKEND.md`.

**Un detalle de diseño, no un fallo:** al pelear, el historial del rival no
cambia. Peleas contra una copia de su bruto, como en el género. Cuando el combate
se calcule en servidor, será el servidor quien decida si eso se registra en los
dos lados.

---

## Pendientes

- [x] ~~Login con firma (SIWS)~~ — hecho. Ver «Wallet».
- [ ] Mover `simulate()` al servidor para que el navegador deje de decidir quién
      gana. Antes conviene sacarlo a un fichero compartido, como se hizo con
      `brute-render.js`, para no acabar con dos copias divergentes de las
      fórmulas — esta vez sobre dinero.
- [ ] Verificar el dato de `~400ms` de Solana en la landing antes de publicar
- [ ] Sustituir `REPLACE_WITH_YOUR_DOMAIN` en los meta tags de `index.html`
- [ ] Subir `og-image.png` (1200×630) a la raíz
- [ ] Quitar la barra de maqueta de `app.html` antes de publicar
- [ ] Historial de combates por bruto (el registro ya se genera, falta guardarlo)
- [ ] Arte de personajes con ilustrador (capas en PNG sobre el sistema actual)
- [x] ~~Portar el renderizador por capas a la landing~~ — hecho: las dos páginas
      dibujan desde `brute-render.js`. (La nota de "bustos con casco" en el hero
      ya era falsa cuando se escribió: el arte estaba portado, lo que quedaba era
      la copia duplicada del código.)

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
