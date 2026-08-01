# SolBrute — diseño del token

Estado: **modelo decidido, sin crear nada.** Ni en devnet ni en mainnet.

---

## El modelo: el token ES la moneda del juego

No hay dos monedas. Lo que ganas peleando es $BRUTE, lo que gastas en la
armería es $BRUTE, y lo que retiras a tu wallet es $BRUTE.

Eso simplifica una cosa que con dos monedas era un lío: **los precios internos
ya calibrados siguen valiendo**. Un arma cuesta unas 3 monedas por combate
sobre las ~40 que se ganan al día, y esa relación se mantiene valga lo que
valga el token en euros.

### Los cuatro flujos

```
  reserva  →  jugadores     emisión diaria fija
  jugadores → reserva       lo que gastan dentro (armas, skins, torneos)
  jugadores → reserva       la comisión de retirada
  jugadores → fuera         lo retirado, menos comisión   ← ÚNICA salida real
```

Solo lo retirado vacía la reserva. Todo lo demás vuelve y se reparte otra vez.

---

## Lo que gana el reciclaje

Reserva de 40 millones, emisión de 27.397/día en el año 1:

| Gastan dentro | Retiran | Comisión | La reserva dura |
|---|---|---|---|
| 30% | 70% | 10% | 6,3 años |
| 50% | 50% | 10% | 8,9 años |
| **70%** | **30%** | **10%** | **14,8 años** |
| 30% | 70% | 20% | 7,1 años |

Sin reciclaje —todo se retira, sin comisión— la reserva duraba **4 años**.

### El dato que decide dónde poner el esfuerzo

**Que la gente gaste importa el doble que la comisión.**

Subir la comisión del 5% al 20% añade un año. Conseguir que gasten el 70% en
vez del 30% añade nueve.

Así que la prioridad no es afinar el porcentaje: es **tener cosas que merezca
la pena comprar**. Cada sumidero nuevo —skins, entradas de torneo, mascotas,
reparar armas— alarga la vida del token más que cualquier ajuste de comisión.

**Comisión recomendada: 10%.** Suficiente para notarse, no tanto como para que
retirar parezca un castigo. Y va entera a la reserva, no a la tesorería: si se
la queda el equipo, es una tarifa; si vuelve al reparto, es un mecanismo.

---

## Lo que todavía no existe y hace falta construir

Los sumideros son la mitad del modelo y ahora mismo solo hay uno:

| Sumidero | Estado |
|---|---|
| Armas que se rompen | **hecho** — ~3 tokens por combate |
| Plazas de bruto 2ª y 3ª | hecho — 50 y 150, una vez |
| Skins y aspectos | no existe |
| Entradas de torneo | no existe |
| Mascotas | no existe |
| Reparar un arma antes de que se rompa | no existe |

Con un solo sumidero, el gasto real estará cerca del 30% y la reserva durará
seis años, no quince. **Los sumideros no son contenido extra: son la mitad de
la economía.**

---

## La aritmética que no se puede saltar

Esto vale para cualquier modelo, incluido este.

**El dinero que se retira sale de lo que otros metieron.** El reciclaje pauta
la emisión, pero no crea valor. Si nadie compra $BRUTE, quien retire no tendrá
comprador y el precio se va a cero.

La fuente de valor de este modelo es concreta: **quien quiera skins, plazas o
entrar a un torneo sin dedicarle meses, compra tokens.** Ese es el dinero que
entra. Mientras la demanda de contenido supere a la presión de venta, el precio
aguanta. Es una economía de juego normal con moneda intercambiable.

Lo que NO puede prometerse es que jugar recupere una inversión. Si los números
se ajustan para que 50 € se recuperen en seis meses, el juego necesita duplicar
jugadores cada seis meses o revienta. Es lo que hundió a Axie, a StepN y a
todos los demás.

**Se vende contenido, no rentabilidad.**

---

## Suministro

**100 millones**, con este reparto:

| Parte | % | Notas |
|---|---|---|
| Recompensas | 40% | la reserva modelada arriba |
| Liquidez | 25% | **no es tuyo**: queda inmovilizado para que exista mercado |
| Tesorería | 15% | desarrollo, arte, servidores |
| Equipo | 15% | **con bloqueo público, 2-4 años y un año de espera** |
| Comunidad inicial | 5% | primeros jugadores |

El total es casi cosmético —100 millones o 1.000 son equivalentes si el reparto
es el mismo— pero 100 millones deja la recompensa diaria legible en todos los
escenarios: 274 tokens/día con 100 jugadores, 27 con mil, 2,7 con diez mil.
Con 21 millones, a diez mil jugadores ganarías media unidad al día y se siente
a nada.

**Los tokens del equipo sin bloquear son la señal de alarma número uno.** Da
igual la intención: nadie te conoce y lo único comprobable es si se pueden
mover.

---

## Arquitectura y riesgo

**El saldo vive en Postgres. El token aparece solo al retirar.** Poner cada
moneda on-chain sería lento y con comisión por pelea.

Eso concentra todo el riesgo en la retirada. Todo lo asegurado hasta ahora
protege un número en una base de datos; en cuanto ese número sea convertible,
un fallo deja de ser un bruto con trampas y pasa a ser dinero robado.

Medidas mínimas antes de que exista la retirada:

- Límite por jugador y día, comprobado en servidor.
- Tope global diario: si algo se rompe, que se rompa acotado.
- Cada retirada anotada en `admin_log` con su firma de transacción.
- **La firma guardada con índice único.** Sin eso, alguien reclama la misma
  retirada diez veces. Ya está escrito en `BACKEND.md` para las plazas.
- La clave del tesoro en un secreto de Supabase, y aun así será el objetivo
  más goloso del sistema.

---

## Antes de mainnet

**Devnet primero, sin excepción.** Tokens sin valor, transacciones gratis, y
ahí se construye la retirada entera y se ataca como se ha atacado todo lo
demás (ver `prueba-hostil.ts`).

**Y lo legal:** un token que se compra y reparte recompensas puede considerarse
un producto financiero regulado, y depende del país. Se resuelve antes de
mainnet, no después.

---

## Herramientas

Nada instalado todavía. Para devnet basta la CLI de Solana y `spl-token`;
Anchor solo haría falta para un programa propio, y un token SPL estándar no lo
necesita.
