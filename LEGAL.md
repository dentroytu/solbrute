# SolBrute · expediente para el abogado

**Esto no es asesoramiento legal y no puede usarse como tal.** No soy abogado.
Lo que hay aquí es el **expediente de hechos**: qué hace el sistema exactamente,
qué dinero se mueve, hacia dónde, y qué se guarda. Sirve para que quien sí sepa
no te cobre horas por averiguar lo que ya sabemos nosotros.

Todo lo que hay en «Preguntas» está sin responder a propósito. **Si alguna vez
lees aquí una respuesta que no ha escrito un abogado, bórrala.**

Fecha: **4 de agosto de 2026**.

---

## 0 · La situación, en tres líneas

| | |
|---|---|
| **Dónde operas** | España (UE) |
| **Forma jurídica** | ninguna, a título personal |
| **A quién vendes** | a cualquiera, sin filtro de país ni de edad |
| **Custodia** | sí: entre que alguien paga y reclama, su dinero está en tu wallet |
| **Importe previsto** | ~2.032 SOL si se vende el cupo entero (~150.000 USD al cambio de hoy) |

Las tres primeras filas juntas son la configuración de más exposición posible.
No lo digo para asustar: lo digo porque es lo primero que va a mirar cualquiera
que sepa, y conviene que no te pille de sorpresa.

---

## 1 · Qué es SolBrute, en términos que le sirvan a un abogado

Un **videojuego de navegador**. El jugador crea un personaje que pelea solo
contra personajes de otros jugadores, gana experiencia y sube de nivel. No hay
apuestas, no hay azar comprado, y no se juega dinero en las partidas.

Dentro del juego hay una **moneda** que se gana jugando y se gasta en objetos
del propio juego (armas, mascotas, reparaciones). Esa moneda es hoy **un número
en una base de datos**, sin valor fuera del juego.

El proyecto quiere que esa moneda pase a ser un **token en Solana ($BRUTE)**,
que el jugador pueda retirar a su propia wallet.

### Qué es exactamente el token

Esto es lo que el abogado necesita para clasificarlo, y conviene ser preciso:

- **Suministro fijo**: 100.000.000, sin posibilidad de crear más. Las dos
  autoridades del token (crear y congelar) se ponen a `null` antes de vender.
- **No da derechos**: ni voto, ni beneficios, ni participación en nada. No
  representa deuda ni capital.
- **Sirve para jugar**: se gasta dentro del juego, y lo que se gasta vuelve a
  la reserva de recompensas.
- **No se promete rentabilidad.** En la web no hay ninguna cifra de ganancias,
  ninguna cantidad, ni cuánto se reparte. Lo único que dice es que se ganan
  tokens $BRUTE jugando. **Esto es una decisión del dueño, escrita y mantenida**,
  y es probablemente lo más importante que hay en esta lista.
- **Es transferible** entre wallets, como cualquier token de Solana, y por tanto
  puede acabar teniendo un precio de mercado que el proyecto no controla.

### Qué es la preventa

Se venden **5.000.000 de tokens** (5% del suministro) por SOL, antes de que el
token cotice en ningún sitio.

**Se paga ahora y se entrega después.** El comprador manda SOL, la compra queda
registrada, y los tokens se entregan cuando el dueño abre los reclamos —
normalmente al crear el pool de liquidez.

Entre esos dos momentos, **el dinero del comprador está en la wallet del dueño y
el comprador no tiene nada**. Eso es custodia, y no hay forma de que no lo sea.
Es una decisión consciente, no un descuido: la alternativa —entregar en el acto—
deja que el primero que reciba tokens fije el precio del mercado.

---

## 2 · Qué se mueve, exactamente

### Al comprar en la preventa

1. El comprador firma un mensaje que demuestra que la wallet es suya. **No mueve
   fondos y no abre sesión.**
2. **El servidor construye la transacción de pago**, con la wallet de destino y
   el importe dentro. El navegador no elige ni una cosa ni la otra.
3. El comprador firma esa transacción con su wallet (Phantom o Solflare) y la
   manda él mismo a la red. **El proyecto nunca toca su clave privada.**
4. El servidor **comprueba el pago en la cadena** antes de apuntar nada.

### Al reclamar

Solo cuando el dueño abre esa puerta. El servidor manda los tokens desde una
wallet operativa a la del comprador, y guarda la firma de la transacción
**antes** de enviarla.

### Al jugar

Las monedas del juego se ganan peleando y se gastan en objetos. Nada de esto
toca la cadena.

### Al retirar (todavía cerrado)

Un jugador puede convertir su saldo del juego en $BRUTE reales, con comisión,
mínimo y topes diarios. **Esto está construido y probado pero cerrado**, porque
no existe el token en mainnet.

---

## 3 · Qué datos se guardan

Importa para protección de datos.

| Dato | Dónde | Nota |
|---|---|---|
| **Dirección de wallet** | `players`, `brutes`, `preventa_compras`, `withdrawals` | Es un seudónimo, pero identifica de forma persistente y es pública en la cadena |
| Nombre del bruto | `brutes` | Lo elige el jugador, es público, aparece en la clasificación |
| Historial de compras y retiradas | `movimientos` | Privado: solo lo ve su dueño |
| Compras de la preventa | `preventa_compras` | Dirección, cantidad, importe, firma del pago, fechas |
| Registro de administración | `admin_log` | Cada cambio del panel, con quién y cuándo |
| Sesiones | `sessions` | Token opaco, caduca en 24 h |

**No se guarda**: nombre real, email, teléfono, dirección postal, documento de
identidad, ni datos de pago. **No hay cuentas con contraseña.**

**No hay analítica ni cookies de terceros.** La web carga fuentes de Google
Fonts por CDN y, cuando la preventa está viva, consulta el precio del SOL a
CoinGecko. Las dos son peticiones a terceros desde el navegador del visitante.

El hosting es **GitHub Pages**; la base de datos y el servidor son **Supabase**,
con el Postgres en **París**. Las claves de las wallets están en secretos de
Supabase.

---

## 4 · Lo que ya está a favor

No todo es exposición. Estas decisiones ya están tomadas y escritas, y son las
que un abogado agradece encontrar hechas:

- **Ninguna promesa de rentabilidad en ningún sitio.** Ni cifras, ni «cubre X
  días», ni cómo se reparte.
- **El pie de la web dice abiertamente** que no hay token, ni contrato en
  mainnet, ni recompensa con valor real — y se mantiene hasta que deje de ser
  cierto.
- **Aviso de estafa en la propia preventa**: «si hoy alguien te pide SOL por
  $BRUTE, no somos nosotros».
- **No hay apuestas ni azar comprado.** Ningún jugador arriesga dinero en una
  partida.
- **Registro completo y con rastro**: quién compró, cuánto, cuándo, con la firma
  del pago comprobable en la cadena. Y todo cambio del panel queda en
  `admin_log` con el antes y el después, en una tabla que ni el administrador
  puede editar.
- **El token no se puede inflar**: suministro fijo y autoridades anuladas, y eso
  es comprobable por cualquiera en la cadena.
- **La contabilidad cuadra por construcción**: lo que hay en circulación más lo
  que queda en reserva es siempre igual al total.

---

## 5 · Preguntas para el abogado

Agrupadas para que se puedan repasar en orden. **Ninguna tiene respuesta aquí.**

### A · Cómo se clasifica el token

1. ¿$BRUTE es un «criptoactivo distinto» a efectos de MiCA, o cae en alguna de
   las categorías con régimen propio?
2. ¿Vender tokens antes de que exista el juego terminado cambia esa
   clasificación?
3. ¿El hecho de que se pueda **retirar** una moneda ganada jugando cambia algo?

### B · La oferta al público

4. ¿Hace falta un **libro blanco** notificado al regulador, y con qué contenido?
5. **La pregunta económica más importante de esta lista:** ¿aplica alguna
   exención por importe o por número de compradores? La preventa prevista está
   en el entorno de los 150.000 €, no de los millones. Si hay un umbral por
   debajo del cual el régimen es mucho más ligero, eso cambia el proyecto
   entero — y puede que la decisión correcta sea **ajustar el cupo para quedarse
   por debajo**.
6. ¿Qué se puede y qué no se puede decir en la web y en redes al anunciarla?
7. ¿Hay que registrar algo antes de aceptar el primer euro?

### C · La forma jurídica

8. ¿Se puede hacer esto a título personal, o hace falta sociedad?
9. Si hace falta, ¿de qué tipo, y **antes o después** de vender?
10. ¿Qué responsabilidad personal asumo si algo sale mal — un fallo técnico, un
    robo de claves, o que el token no llegue a valer nada?

### D · Custodia y blanqueo

11. Tener el SOL de los compradores entre el pago y la entrega, ¿es «custodia de
    fondos de terceros» a efectos regulatorios?
12. ¿Hace falta registro en el Banco de España como proveedor de servicios de
    criptoactivos?
13. ¿Hay obligación de identificar a los compradores (KYC), a partir de qué
    importe, y qué hay que conservar?
14. ¿Hay que comprobar listas de sanciones? ¿Cómo, con direcciones de wallet?

### E · A quién se puede vender

15. ¿Desde qué países **no** se puede vender, y hay obligación de bloquearlos?
16. ¿Qué pasa con los menores de edad? Hoy no hay ninguna barrera.
17. ¿Un comprador de la UE tiene derecho de desistimiento sobre esto?

### F · Impuestos

18. ¿Cómo tributa el dinero recaudado en la preventa, y **cuándo** — al cobrar el
    SOL o al entregar los tokens?
19. ¿Lleva IVA?
20. ¿Y lo que se queda el proyecto en comisiones de retirada?
21. ¿Qué obligaciones de información hay sobre las wallets del proyecto?

### G · Los documentos de la web

22. ¿Qué hace falta publicar antes de vender: términos, privacidad, aviso de
    riesgo, política de cookies?
23. ¿Basta con la ley española o hay que cubrir a compradores de otros países?
24. ¿Qué pasa si el proyecto se para? ¿Hay obligación de devolver algo?

### H · Lo incómodo

25. Si el token acaba valiendo mucho menos de lo que pagó alguien en la
    preventa, ¿tengo responsabilidad?
26. ¿Y si un fallo técnico se come el saldo de alguien? Existe un fondo de
    garantía del 5% del suministro apartado para eso, **pero no es un
    compromiso escrito con nadie**. ¿Debería serlo?
27. ¿Puedo cambiar las reglas del juego —precios, recompensas— después de que la
    gente haya comprado?

---

## 6 · Lo que conviene tener listo antes de la primera reunión

Para no gastar la hora en lo obvio:

- **Este fichero.**
- `TOKEN.md` — el diseño económico completo.
- La dirección de la web y la del panel.
- El mint de devnet, para que vea que el suministro es fijo y las autoridades
  están anuladas: `CQrsHLKWmgBjd1UUi115KzQ3GRfGfM8xafoUeP3ajWqX`
- **Cuánto piensas recaudar de verdad.** Es el número del que cuelga media
  lista, especialmente la pregunta 5.
- **Si estás dispuesto a montar una sociedad**, porque cambia la respuesta a
  varias.

### A quién buscar

Un abogado de **derecho digital / fintech con experiencia en criptoactivos**, no
un abogado generalista. Es un campo pequeño y especializado; alguien que no lo
haya hecho antes te va a cobrar por aprender.

Sitios razonables por donde empezar: el **Colegio de Abogados** de tu provincia
tiene listados por especialidad; y hay despachos españoles centrados en esto que
salen buscando «abogado criptoactivos MiCA España». Pide **presupuesto cerrado
para una consulta inicial** en vez de abrir la puerta a horas abiertas.

---

## 7 · Lo que puedo construir yo mientras tanto

Nada de esto sustituye al abogado, pero casi seguro te lo va a pedir, y es
barato hacerlo ahora:

| Qué | Esfuerzo | Nota |
|---|---|---|
| **Bloqueo por país** en la preventa | bajo | La lista la tiene que dar él; el mecanismo lo monto yo |
| **Confirmación de edad y de riesgo** antes de comprar | bajo | Una casilla que se guarda con la compra, no un cartel |
| **Guardar la aceptación de los términos** con cada compra | bajo | Fecha y versión del texto aceptado |
| **Páginas de términos, privacidad y riesgo** | medio | Yo pongo los **hechos**; el texto legal lo escribe o lo revisa él. **No se publica sin revisar** |
| **Copia de seguridad de la base** | bajo | Hoy no existe, y con dinero de otros dentro eso deja de ser una molestia |
| **Comprobar listas de sanciones** al reservar | medio | Solo si hace falta, y con qué fuente lo dice él |

**Lo que no voy a hacer:** escribir los términos y publicarlos sin que los mire
un abogado. Unos términos copiados de otra web son peores que no tener ninguno:
dan sensación de estar cubierto sin estarlo.

---

## 8 · Mientras no haya respuestas

La preventa **está apagada en mainnet y no existe el token**, así que ahora mismo
no se está aceptando dinero de nadie. Eso es lo correcto y conviene que siga así.

Lo que sí se puede hacer sin riesgo:

- Seguir en **devnet**, donde el SOL no vale nada.
- Construir juego: skins, torneos, el enlace por combate, el verificador.
- Hablar del proyecto **sin anunciar precio ni fechas de venta**. La landing
  tiene un estado de «previa» hecho justo para eso: se puede contar que habrá
  preventa sin que exista ningún camino que acabe en alguien mandando SOL.

**Lo que no se debe hacer hasta tener respuestas:** poner `SOLANA_RPC` en
mainnet y encender la venta.
