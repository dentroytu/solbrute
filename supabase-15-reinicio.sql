-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 15 — REINICIO de la economía
-- ══════════════════════════════════════════════════════════════════════════
-- Supabase → SQL Editor → New query → pegar → Run.
--
--   ⚠️  ESTO BORRA SALDOS. Léelo entero antes de ejecutarlo, y comprueba la
--       dirección de abajo. No es repetible sin consecuencias: cada pasada
--       vuelve a poner a cero a todo el mundo menos a esa dirección.
--
-- ── Por qué ahora y no después ────────────────────────────────────────────
--
-- Las monedas que hay en circulación se imprimieron ANTES de que existiera el
-- tope de emisión, cuando cada pelea creaba monedas sin techo. No salieron de
-- la reserva, así que no están respaldadas por nada.
--
-- Se notó el primer día: al gastarlas, el reciclaje las devolvió a la reserva
-- y la dejó en 40.000.117 — por encima de su propio techo. La aritmética era
-- correcta; la premisa no.
--
-- Y este es el momento. Hoy un saldo es un número en Postgres. El día que
-- exista el token pasa a ser un DERECHO A COBRAR tokens reales, y entonces
-- reiniciar deja de ser mantenimiento y pasa a ser quitarle valor a alguien.
--
-- ── Qué se conserva ───────────────────────────────────────────────────────
--
-- Los brutos, sus niveles, sus armas y el historial de peleas NO se tocan.
-- Eso es progreso jugado y no tiene nada que ver con la economía. Lo que se
-- reinicia es solo el dinero.
-- ══════════════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════════════
-- ①  COMPRUEBA ESTO ANTES DE EJECUTAR
-- ══════════════════════════════════════════════════════════════════════════
-- La dirección que conserva su saldo. Si te equivocas aquí, te quedas a cero
-- tú y le regalas el saldo a otro.
--
-- Para verla: en el juego, la pastilla de arriba a la derecha. O:
--     select address, coins from players order by coins desc;
create temp table _conservar (address text primary key);
insert into _conservar values
  ('7bXra6gaZi5rGvwgdyzyVd9vWKuUx5cKDNneXV8v2reZ');   -- ← tu wallet


-- ══════════════════════════════════════════════════════════════════════════
-- ②  Antes: para poder comparar después
-- ══════════════════════════════════════════════════════════════════════════
select 'ANTES' as momento,
       (select count(*) from players)                     as jugadores,
       (select count(*) from players where coins > 0)      as con_monedas,
       (select coalesce(sum(coins),0) from players)        as en_circulacion,
       (select reserva_restante  from economia where id=1) as reserva,
       (select reserva_seguridad from economia where id=1) as fondo;


-- ══════════════════════════════════════════════════════════════════════════
-- ③  Todos a cero menos los conservados
-- ══════════════════════════════════════════════════════════════════════════
update players
   set coins = 0
 where address not in (select address from _conservar)
   and coins <> 0;


-- ══════════════════════════════════════════════════════════════════════════
-- ④  Borrar las cuentas de prueba que no han jugado
-- ══════════════════════════════════════════════════════════════════════════
-- Sin brutos, sin monedas y sin peleas: son las que se crearon probando el
-- login. No se borra nada de nadie que haya jugado.
delete from players p
 where p.address not in (select address from _conservar)
   and p.coins = 0
   and not exists (select 1 from brutes  b where b.owner   = p.address)
   and not exists (select 1 from fights  f where f.a_owner = p.address);


-- ══════════════════════════════════════════════════════════════════════════
-- ⑤  Limpiar el rastro monetario
-- ══════════════════════════════════════════════════════════════════════════
-- `movimientos` es el libro de cuentas: apunta compras hechas con monedas que
-- ya no existen, así que dejarlo sería un historial que no cuadra con ningún
-- saldo. Las PELEAS no se tocan: son historia jugada, no dinero.
delete from movimientos;

-- La emisión vuelve a empezar. Sin esto, la tasa de mañana se calcularía
-- sobre los puntos de un día que ya no cuenta.
delete from emision;


-- ══════════════════════════════════════════════════════════════════════════
-- ⑥  Cuadrar la reserva con lo que queda en circulación
-- ══════════════════════════════════════════════════════════════════════════
-- La parte importante, y la que convierte esto en un reinicio honesto en vez
-- de un borrado.
--
-- Las monedas conservadas pasan a estar RESPALDADAS: se descuentan de la
-- reserva, como si hubieran salido de ella. A partir de aquí se cumple la
-- única invariante que sostiene el modelo:
--
--     en circulación + reserva restante  =  reserva total
--
-- El fondo de garantía vuelve a su 5.000.000 de partida, porque los 15 que
-- había acumulado venían de reciclar esas mismas monedas sin respaldo.
update economia
   set reserva_restante  = reserva_total
                           - (select coalesce(sum(coins),0) from players),
       reserva_seguridad = 5000000,
       actualizado = now()
 where id = 1;


-- ══════════════════════════════════════════════════════════════════════════
-- ⑦  Después: los libros tienen que cuadrar
-- ══════════════════════════════════════════════════════════════════════════
select 'DESPUES' as momento,
       (select count(*) from players)                      as jugadores,
       (select coalesce(sum(coins),0) from players)         as en_circulacion,
       (select reserva_restante  from economia where id=1)  as reserva,
       (select reserva_seguridad from economia where id=1)  as fondo,
       -- Esta columna es la prueba. Tiene que dar EXACTAMENTE reserva_total.
       (select coalesce(sum(coins),0) from players)
         + (select reserva_restante from economia where id=1) as suma_debe_dar_40M,
       (select reserva_total from economia where id=1)        as reserva_total;

drop table _conservar;
