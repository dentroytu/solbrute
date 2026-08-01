# SolBrute — diseño del token

Estado: **decidido el modelo, sin crear nada.** Este documento es la decisión
económica. No hay token en devnet ni en mainnet.

---

## El problema que resuelve

El juego emite **122 monedas por jugador y día** y solo absorbe 27 (armas que
se rompen). Neto: **+95 al día por jugador**.

Convertido a token 1:1 y sin límite, eso son **34,6 millones de tokens nuevos
al año con mil jugadores**. Un token con emisión ilimitada y sumideros que
cubren el 22% tiende a cero. No es una opinión: es aritmética.

Y no se arregla después de lanzarlo, porque para entonces hay gente con tokens
y cualquier cambio les quita valor.

---

## El modelo elegido: reserva fija y reparto diario

**Las monedas del juego no cambian.** Se ganan igual, se gastan igual, siguen
viviendo en Postgres. El token solo aparece al **retirar**.

Cada día se libera una cantidad **fija** de la reserva y se reparte entre los
jugadores en proporción a las monedas que ganaron ese día.

### Por qué así y no una tasa fija por moneda

Con una tasa fija (1 moneda = X tokens), la reserva se vacía en función de
cuánta gente juegue:

| Tasa | 100 jugadores | 1.000 | 10.000 |
|---|---|---|---|
| 1 moneda = 1 token | 17 años | **1,7 años** | 0,2 años |
| 1 moneda = 0,01 | +200 años | 173 años | 17 años |

Si el juego triunfa, se acaba en meses. Si fracasa, dura siglos. Justo al
revés de lo que interesa.

Con reparto diario fijo, la emisión total es **exacta** y no depende de cuánta
gente juegue. Y tiene una propiedad que sale gratis: **más jugadores = menos
por cabeza**, así que meter cuentas falsas te diluye a ti mismo. Los bots
dejan de ser rentables sin necesidad de detectarlos.

### La curva

Reserva de 40 millones, reducción a la mitad cada 2 años:

| Periodo | Tokens al día | Acumulado |
|---|---|---|
| años 0-2 | 27.397 | 20,0 M |
| años 2-4 | 13.699 | 30,0 M |
| años 4-6 | 6.849 | 35,0 M |
| años 6-8 | 3.425 | 37,5 M |
| años 8-10 | 1.712 | 38,8 M |

Converge a 40 millones y **nunca los supera**, jueguen cien personas o cien
mil. Los primeros ganan más, que es lo normal y lo que premia llegar pronto.

---

## Decisiones que faltan, y son del dueño

- **Suministro total.** Los cálculos usan 100 millones con un 40% a
  recompensas. Falta decidir el otro 60%: liquidez, equipo, reserva.
- **Duración del primer periodo.** Dos años es un punto de partida.
- **Precio de salida**, si se vende.

---

## Arquitectura: dónde vive el saldo

**Las monedas siguen en Postgres. El token aparece solo al retirar.**

Poner cada moneda on-chain sería lento, con comisión por pelea y una
experiencia horrible para un juego de tres peleas al día.

Pero esto concentra todo el riesgo en un punto: **la retirada**. Todo lo que
se ha asegurado hasta ahora protege un número en una base de datos. En cuanto
ese número se pueda convertir en dinero real, un fallo deja de ser un bruto
con trampas y pasa a ser dinero robado.

### La clave del tesoro

Alguien tiene que firmar los envíos, y esa clave privada controla el
suministro entero. Vivirá en un secreto de Supabase y aun así será el objetivo
más goloso del sistema.

Medidas mínimas antes de que exista:

- Límite de retirada por jugador y día, comprobado en servidor.
- Cada retirada anotada en `admin_log` con su firma de transacción.
- La firma de la transacción guardada con índice único: **sin eso, alguien
  reclama la misma retirada diez veces.** Ya está escrito en `BACKEND.md` para
  la compra de plazas y aplica igual aquí.
- Un tope global diario: si algo se rompe, que se rompa acotado.

---

## Antes de mainnet

**Devnet primero, sin excepción.** Es la fase 2 del roadmap. Tokens sin valor,
transacciones gratis, todo funciona igual. Estrenar los frenos en la autopista
no es una opción cuando hay dinero de otros.

**Y una que no es técnica:** un token que la gente compra y que reparte
recompensas puede considerarse un producto financiero regulado, y eso cambia
según el país. Conviene resolverlo antes de mainnet, no después, porque
después es mucho más caro.

---

## Qué hace falta instalar

Nada de esto está en la máquina todavía:

```
solana      no instalado
spl-token   no instalado
anchor      no instalado
cargo       no instalado
```

Para devnet basta con la CLI de Solana y `spl-token`. Anchor solo hace falta si
se escribe un programa propio, y para un token SPL estándar no hace falta.
