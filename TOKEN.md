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

| Parte | % | Tokens | Notas |
|---|---|---|---|
| Recompensas | 40% | 40.000.000 | la reserva modelada arriba |
| Liquidez | 25% | 25.000.000 | **no es tuyo**: queda inmovilizado para que exista mercado |
| Equipo | 15% | 15.000.000 | **con bloqueo público, 2-4 años y un año de espera** |
| Tesorería | 10% | 10.000.000 | desarrollo, arte, servidores |
| **Fondo de garantía** | **5%** | **5.000.000** | colchón. No se emite jugando |
| Comunidad inicial | 5% | 5.000.000 | primeros jugadores |

### El fondo de garantía sale de la tesorería, no de las recompensas

Tesorería baja del 15% al 10%. Es lo único que cambió al añadirlo, y es
deliberado: sacarlo del 40% de recompensas significaría **menos monedas por
pelea para pagar un fondo que protege al proyecto**, y obligaría a rehacer
toda la aritmética de arriba —los cuatro años, las tablas de reciclaje—.

Saliendo de tesorería, la emisión no cambia ni un punto y quien paga la
garantía es el dueño del proyecto. Que es de quien tiene que salir.

**Para qué es:** compensar a jugadores si un fallo se come su saldo, cubrir
retiradas legítimas si hay un incidente y se cierra el grifo, y hacer de
colchón si la reserva se agota antes de lo previsto.

**Para qué no:** gastos del proyecto. Para eso está la tesorería. Un fondo de
garantía que se usa para pagar cosas es tesorería con otro nombre, y el día
que haga falta de verdad no estará.

Por eso tocarlo no es un `update`: es `seguridad_usar()`, que exige un motivo
de al menos diez caracteres y lo deja en `admin_log` con el antes y el
después. Un fondo que el gestor puede mover sin dejar rastro no es una
garantía, es una cuenta suya.

**Y se rellena solo.** El 10% de todo lo que se gasta dentro del juego va al
fondo en vez de volver al reparto; el otro 90% sí vuelve a recompensas. Cuanto
más se juega, más colchón hay.

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

### Comprobado: la Edge Function SÍ puede firmar

Era la suposición grande sin verificar, y había motivo para dudar — el
empaquetador de Supabase ya había rechazado traer `brute-combate.js` por URL
(`Cannot import from dentroytu.github.io:443`).

Se desplegó una función desechable (`supabase-funcion-prueba-solana.ts`) que
reproduce una retirada entera. Las cuatro comprobaciones en verde:

| | Resultado |
|---|---|
| Empaqueta `npm:@solana/web3.js@1.98.4` y `spl-token@0.4.15` | sí |
| Construye la instrucción de transferencia SPL | sí — programa `Tokenkeg…` |
| Firma y `verifySignatures()` cuadra | sí — 64 bytes |
| Sale a internet y habla con un RPC | sí — blockhash de devnet |

Así que **no hace falta otra arquitectura**: el tesoro puede vivir en un
secreto y la función puede firmar los envíos.

Dos cosas que dejó por el camino:

- **Fijar las versiones de las librerías.** Sin versión, `npm:` resuelve a la
  última en cada redespliegue, y una función que cambia de comportamiento
  según el día es imposible de depurar.
- **2,1 s de respuesta**, arranque en frío incluido. Irrelevante para una
  retirada; a tener en cuenta si algún día Solana entra en una ruta que sí
  dependa del tiempo.

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

Sin CLI de Solana. `brew` no tiene binario para macOS 13 Intel y se puso a
compilar desde fuente; se mató. En su lugar, las librerías por npm:

```
@solana/web3.js@1.98.4    @solana/spl-token@0.4.15
```

Sirven para todo lo que hace falta —crear el mint, acuñar, transferir— desde
un script de Node, y son **las mismas que usa la Edge Function**. Anchor solo
haría falta para un programa propio, y un token SPL estándar no lo necesita.

**La clave del tesoro no la genera Claude.** Controla el suministro entero:
la crea el dueño, no pasa por el contexto de ningún asistente, y no vive en el
repositorio (ver `.gitignore`).
