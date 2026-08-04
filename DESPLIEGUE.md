# Qué aplicar y en qué orden

Lista para ir tachando. **El orden importa**: varios pasos dependen del
anterior y a medias el juego se rompe.

Cada `.sql` se pega en **Supabase → SQL Editor → New query → Run**, uno por
pestaña. Nunca dos ficheros juntos en la misma consulta: si algo falla a
mitad, el editor tira atrás el lote entero y te quedas sin saber qué se aplicó.

---

## 1 · `supabase-12-emision.sql` — otra vez

Ya lo aplicaste, pero **ha cambiado**. Vuélvelo a pasar entero.

**Qué arregla:** la reserva se había puesto en 40.000.117, por encima de su
propio techo de 40 millones. Pasó porque el reciclaje devolvía a la reserva
monedas que nunca salieron de ella — las que se imprimieron antes de que
existiera el tope. Ahora el reciclaje no puede desbordarla, y el propio
fichero corrige el valor que ya se desbordó.

**Es repetible.** Todo es `create or replace` y la corrección solo actúa si la
reserva está por encima del total.

**Comprueba:** la primera consulta del final tiene que devolver **cero filas**
(ninguna función llamable con la clave pública).

---

## 2 · `supabase-14-inventario.sql`

**Qué hace:** el inventario deja de ser del bruto y pasa a ser tuyo.

```
ANTES   brutes.armas   ["daga"]      las armas eran del BRUTO
AHORA   players.armas  {"daga": 2}   son tuyas, y las mueves entre brutos
```

Mueve lo que haya en los brutos a tu bolsa. **Lo equipado se queda equipado** —
la daga de `tito` sigue puesta.

**Es repetible:** vacía `brutes.armas` al terminar, así que una segunda pasada
no duplica nada.

**Comprueba:** la última consulta te enseña la bolsa de cada jugador y qué
lleva puesto cada bruto. Y otra vez, cero filas en la de funciones abiertas.

---

## 3 · `supabase-15-reinicio.sql`

> ⚠️ **Este borra saldos. Antes de ejecutarlo, mira la línea de la dirección.**

Cerca del principio hay esto:

```sql
insert into _conservar values
  ('7bXra6gaZi5rGvwgdyzyVd9vWKuUx5cKDNneXV8v2reZ');   -- ← tu wallet
```

Esa es la dirección que **conserva** su saldo. Es la tuya según la base de
datos, pero compruébala: la ves en el juego, en la pastilla de arriba a la
derecha. Si te equivocas, te quedas a cero tú y le regalas el saldo a otro.

**Qué hace:** pone a cero a todos los demás, borra las cuentas de prueba que
nunca jugaron, limpia el libro de movimientos y el historial de emisión, y
cuadra la reserva.

**Qué NO toca:** brutos, niveles, armas equipadas y el historial de peleas.
Eso es progreso jugado, no dinero.

**Por qué ahora:** hoy un saldo es un número. El día que exista el token pasa a
ser un derecho a cobrar tokens reales, y entonces reiniciar ya no es
mantenimiento, es quitarle valor a alguien.

**Comprueba:** la última consulta tiene una columna `suma_debe_dar_40M`.
Tiene que dar **exactamente** lo mismo que `reserva_total`. Si no cuadra, no
sigas y dímelo.

**Este NO es repetible.** Cada pasada vuelve a poner a cero a todo el mundo.

---

## 4 · Redesplegar la Edge Function

**Supabase → Edge Functions → `auth` → pestaña Code → fichero `index.ts`.**

Clic dentro, **⌘A**, y pega encima el contenido de
`supabase-funcion-auth.ts`. Reemplazo completo, no añadir al final.

**No toques `brute-combate.js`**, el segundo fichero de esa función. No ha
cambiado y tiene que seguir ahí.

Luego **Deploy**.

> El paso 2 va antes que este, sin excepción. La función nueva llama a
> `arma_comprar` y `arma_equipar`; si no existen todavía, comprar y equipar
> se caen.

---

## 5 · Publicar la web

Esto lo hago yo con `git push` cuando digas. Lleva la versión en la cabecera,
la armería nueva, la pantalla de Historial y el arreglo del arma.

> El paso 4 va antes. La web nueva ya no manda `bruteId` al comprar, y la ruta
> vieja lo exige.

---

## Después

Quedan dos cosas y las dos son mías:

- **Los ataques del inventario** en `prueba-hostil.ts`: comprar sin saldo,
  equipar un arma que no tienes, equipar el bruto de otro, y la carrera de
  equipar la misma copia en dos brutos a la vez. Hasta que pasen, el
  inventario no está verificado.
- **El tablón de eventos del ludus**, que necesita guardar en `fights` si
  subiste de nivel y si se rompió el arma — hoy no se guardan.

---

# La preventa

Esto es aparte de todo lo de arriba. **No hace falta hacerlo para que el juego
funcione**, y mientras no lo hagas la sección de preventa ni siquiera aparece
en la landing.

El orden importa por el mismo motivo de siempre: la Edge Function llama a
funciones de Postgres que tiene que haber creado el SQL antes.

## 1 · `supabase-31-preventa.sql`

Pestaña nueva del SQL Editor, `cat supabase-31-preventa.sql | pbcopy`, pegar y
Run. Crea tres tablas (`preventa`, `preventa_compras`, `preventa_reclamos`) y
ocho funciones.

**Nace apagada**: `activa = false` y `reclamos_abiertos = false`. Aplicarlo no
enciende nada ni acepta un solo SOL.

**Comprueba** que la primera consulta del final da **cero filas** (ninguna
función abierta a `anon`) y que la segunda enseña las tres tablas con RLS
activo y cero políticas.

## 2 · Redesplegar `retirar`

**Supabase → Edge Functions → `retirar` → Code**, ⌘A y pegar
`supabase-funcion-retirar.ts` entero. Deploy.

Después, busca dentro del código desplegado la palabra `pv_reservar`. Si no
está, se ha desplegado la versión vieja — le pasa al editor y ya ha pasado
antes.

## 3 · Redesplegar `auth`

Igual, con `supabase-funcion-auth.ts`. Trae las dos rutas del panel
(`admin_preventa` y `admin_preventa_config`). Busca `admin_preventa_config`
dentro del código desplegado para confirmarlo.

## 3b · Atacarla antes de que toque dinero

```bash
node prueba-preventa.mjs
```

Habla con tu servidor de verdad, con claves ed25519 recién generadas. **Es
seguro pasarlo con la preventa encendida**: ningún ataque compra nada — o le
falta la firma, o la lleva mal, o pide algo que no es suyo.

Tiene que acabar en «Ningun ataque a la preventa funciona» y **sin errores
mudos**. Si sale algún 500, no sigas: es el servidor cayéndose por una entrada
que cualquiera puede mandar.

## 4 · Los secretos

**Supabase → Project Settings → Edge Functions → Secrets.**

| Secreto | Qué es | Cuándo hace falta |
|---|---|---|
| `SOLANA_MINT` | el mint de $BRUTE | para entregar |
| `SOLANA_PREVENTA` | clave de la wallet que ENTREGA los tokens, array JSON de 64 bytes | para entregar |
| `SOLANA_RPC` | RPC de pago | **antes de cobrar a nadie** |

Si no pones `SOLANA_PREVENTA`, se usa `SOLANA_TESORO`. Es mejor separarlas:
así la wallet de la preventa lleva solo los tokens vendidos y no toda la
operativa del juego.

**El RPC público no vale aquí.** Cada compra pide `getTransaction` para
comprobar el pago en la cadena, y el público empieza a devolver 429 enseguida.
Un 429 en ese momento es un comprador que ha pagado y no ve sus tokens.

## 5 · Configurar desde el panel

`admin.html` → bloque **Preventa de $BRUTE**. Rellena y guarda **sin marcar
«Preventa abierta»** todavía:

- **Wallet que cobra el SOL** — la del dueño, no la operativa del juego.
- **Precio por token, en lamports.** 1 SOL = 1.000.000.000 lamports. El panel
  te enseña debajo cuánto entra si se vende el cupo entero.
- **Cupo, tope por wallet y mínimo.**
- **Mint** — solo hace falta para abrir los reclamos, no para vender.

Guarda, míralo, y solo entonces marca «Preventa abierta». El panel te lo hace
confirmar: a partir de ese clic la landing la enseña y la gente puede pagar.

## 6 · Los reclamos, mucho después

**No abras los reclamos hasta que la liquidez esté puesta.** Es el orden
entero del diseño: se vende ahora y se entrega cuando existe el mercado. Quien
recibe tokens sin pool los vende contra un pool que no está, y el precio lo
pone él.

Antes de abrirlos, la wallet de `SOLANA_PREVENTA` tiene que tener:

- **los $BRUTE vendidos**, que el panel te dice en «vendidos»;
- **SOL para las comisiones**, y para crear la cuenta de token de cada
  comprador que no tenga una — unos 0,002 SOL cada uno.

Quedarse sin ese SOL es lo que en devnet falló diciendo otra cosa. Ahora se
comprueba antes, pero es dinero que hay que presupuestar.
