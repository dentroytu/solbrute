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
| `supabase-09-armas.sql` | `brutes.arma` y `brutes.armas` | Aplicado |
| `admin.html` | Panel de administración | Funcionando |
| `brute-combate.js` | Reglas del combate y del equilibrio, compartidas | Estable |
| `supabase-01-tablas.sql` | Crea las tablas. Se pega en el SQL Editor | Aplicado |
| `supabase-02-rerolls.sql` | Añade `rerolls_left` y `pool` a `brutes` | Aplicado |
| `servidor-local.js` | Servidor de desarrollo, sin caché. No lo necesita el juego | Herramienta |
| `prueba-hostil.ts` | Ataca la función con un cliente reescrito. 18 ataques | Herramienta |
| `prueba-banco.ts` | Base de datos simulada para el banco de ataque | Herramienta |
| `supabase-10-permisos.sql` | Cierra funciones que quedaron ejecutables por `public` | Aplicado |
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
| 1 | 2,5 | 45 | 6 / 10 |
| 10 | 3,7 | 72 | 8 / 13 |
| 20 | 5,0 | 102 | 10 / 15 |
| 30 | 6,4 | 132 | 11 / 16 |

Ninguno llega al tope de 40 turnos.

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
| La armería | comprar y equipar armas | hecha |
| La arena | pelear | hecha |
| La clasificación | ver quién manda | hecha |
| **El vivarium** | comprar mascotas | pendiente |

`vivarium` era el recinto donde se guardaban las fieras de la arena. El nombre
está elegido; el contenido no existe.

---

## Armas

**Son alternativas, no mejoras, y está medido.** Enfrentando las cinco opciones
todas contra todas con brutos idénticos, ninguna se despega:

| | Puños | Daga | Mandoble | Lanza | Escudo |
|---|---|---|---|---|---|
| **media de victorias** | 49,9% | 51,3% | 48,0% | 50,2% | 49,9% |

Sale un piedra-papel-tijera: el escudo gana al mandoble, el mandoble a la daga,
la daga a los puños, los puños al mandoble.

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

**Y permanentes:** la ruta `guardar` quita el nombre del PATCH. Aceptarlo dejaba
renombrar el bruto a voluntad —incluido ponerse el de otro— y, si el nuevo
estaba pillado, el índice único hacía que la función respondiera un 500 mudo.
El síntoma era que nadie podía pelear, porque al fallar el guardado la lista de
rivales no llegaba a escribirse: un error que hablaba de rivales y cuya causa
era el nombre.

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
- [x] ~~Historial de combates por bruto~~ — las peleas se guardan en `fights`.
      Falta la pantalla que lo enseñe al jugador.
- [ ] **Mascotas (el vivarium)** — decidido el nombre y el enfoque, no el
      contenido. Idea de partida: la mascota tiene **vida propia y muere en
      combate**, y morir la pierde para siempre. Eso le da el mismo equilibrio
      que a las armas: ayuda de verdad mientras vive, y llevarla es una decisión
      que se repite. Candidatas: perro de guerra (muerde poco, frágil), lobo
      (pega y esquiva, poca vida), oso (mucha vida, lento, encaja golpes por ti).
      **Antes de construirlas hay que simular la duración del combate**: dos
      contra dos alarga las peleas, y ya se vio lo rápido que eso se descontrola.
- [ ] **Torneos semanales** — anotado, sin construir. Lo que hay que decidir:
      · ¿Te apuntas o entran todos? Apuntarse da menos gente y más intención.
      · Cuadro de 8 o 16, eliminatorias. El servidor puede resolverlas de golpe,
        y como guarda semilla y registro, cada combate se puede reproducir.
      · **El premio es lo delicado.** Si reparte muchas monedas, las peleas
        diarias sobran y el torneo se come el juego. Si reparte pocas, nadie va.
        Instinto: prestigio y un arma rara, no un montón de monedas.
      · Las peleas del torneo **no deberían gastar las 3 diarias**, o la gente
        tendría que elegir entre torneo y jugar.
- [ ] Arte de personajes con ilustrador (capas en PNG sobre el sistema actual)
- [x] ~~Portar el renderizador por capas a la landing~~ — hecho: las dos páginas
      dibujan desde `brute-render.js`. (La nota de "bustos con casco" en el hero
      ya era falsa cuando se escribió: el arte estaba portado, lo que quedaba era
      la copia duplicada del código.)

## Seguridad: qué se comprobó y cómo

**No se puede impedir que un jugador edite el JavaScript de su navegador.** Es
su ordenador. La defensa no es evitarlo: es que hacerlo no le sirva de nada.
Y editar el cliente es MENOS peligroso que llamar a la API directamente con
`curl`, que es como se ha probado todo aquí.

`prueba-hostil.ts` corre la Edge Function real contra una base simulada
(`prueba-banco.ts`) y la ataca con un cliente reescrito: subirse el nivel,
regalarse peleas, monedas y armas, inventarse la lista de rivales, elegir la
semilla, saltarse el precio de la plaza, tocar el bruto de otro y colarse en
las rutas de admin. **18 ataques, ninguno funciona.**

**Si añades una ruta a la función, añádele aquí su ataque antes de
desplegarla.** Esto aguanta porque se prueba, no porque el código sea bonito.

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
