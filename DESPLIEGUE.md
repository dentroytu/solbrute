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
