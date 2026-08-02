-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 19 — cerrar el simulacro y limpiar lo que dejó
-- ══════════════════════════════════════════════════════════════════════════
-- Supabase → SQL Editor → New query → pegar → Run.
--
-- El simulacro (`red = 'simulacro'`) sirvió para atacar la contabilidad de la
-- retirada sin token y sin SOL: 35 comprobaciones, ninguna falla, y un fallo
-- real encontrado por el camino —la firma de simulacro medía 30 caracteres y
-- `retirada_firmar` exige 32—.
--
-- Esto deshace el montaje: borra las cuentas de prueba, borra las retiradas
-- de simulacro, devuelve los límites a producción y cierra la puerta.
--
--   ⚠️  Después de esto `retiradas_abiertas` vuelve a FALSE, que es donde
--       tiene que estar hasta que exista el token y el envío on-chain esté
--       escrito y probado.
-- ══════════════════════════════════════════════════════════════════════════

create temp table _basura (address text primary key);
insert into _basura values
  ('4UxDSWP8jBoKAtJxznuK6YiKhvLGBApKoS4Qy5259dDM'),
  ('5bzYNemfKThMDuQ7FPxfY6oRbJEZNsqMkdRCfn4ED58N'),
  ('4Xu7Jx2GP1ckVuLXVWiN35TtH28zLys25aGwg7WQnrjH'),
  ('BaXxSQvWnbHqZwQkPdRdK92AVsWvS3GeE4XH6zWfKVLp'),
  ('3z7KJeQNGdy5ahNuM7Lsh8X1ZsgZFjvBsSGH8A1BhYDG'),
  ('AiEVbc3Md9EFakYp9bg12SBUNRcGAf9BSr23pEbvc8dq'),
  ('35guzi8LGsFUFhrG2c4yNVHTUMFQJYZqmMW7jdMQhtVB'),
  ('A1x95kvLwZxQ2CBZdsJskViu3CzUWBwL9nPkqP6ZDj6J'),
  ('DwvKVPbWkMCWaeLZkHRayGTsAsUxhMJ8fceex82oLto1'),
  ('JDCzbtNw88cBg7unKX8JEp1xuy8PZ6r5hJyeKc16bqfx'),
  ('3BTanRiTZ5i5Lo3PPpEyuiM6KVWBokFyi14zFdVTwhBT');

select 'ANTES' as momento,
       (select count(*) from players)     as jugadores,
       (select count(*) from brutes)      as brutos,
       (select count(*) from withdrawals) as retiradas,
       (select coalesce(sum(coins),0) from players) as en_circulacion,
       (select reserva_restante from economia where id=1) as reserva;


-- ── Las cuentas de prueba ─────────────────────────────────────────────────
-- Por dirección explícita, no por patrón: un jugador real puede llamar a su
-- bruto como le dé la gana, y una lista escrita a mano no puede llevárselo
-- por delante sin querer.
delete from fights      where a_owner in (select address from _basura);
delete from withdrawals where address in (select address from _basura);
delete from movimientos where address in (select address from _basura);
delete from brutes      where owner   in (select address from _basura);
delete from players     where address in (select address from _basura);
delete from sessions    where address in (select address from _basura);
delete from auth_nonces where address in (select address from _basura);

-- ── Y CUALQUIER retirada de simulacro que quede suelta ────────────────────
-- Incluye la fila `pendiente` huérfana que dejó el fallo de la firma corta.
-- Son de mentira por definición —su firma empieza por SIMULACRO-— y dejarlas
-- ensuciaría para siempre las estadísticas de emisión y retirada.
delete from movimientos where tipo = 'retirada'
   and ref in (select id from withdrawals where red = 'simulacro');
delete from withdrawals where red = 'simulacro';

-- La emisión del día era de mis peleas de prueba.
delete from emision;


-- ══════════════════════════════════════════════════════════════════════════
-- Volver a producción
-- ══════════════════════════════════════════════════════════════════════════
-- Los límites tuvieron que bajarse para poder ver saltar los topes: una cuenta
-- nueva solo gana ~20 monedas al día y con el mínimo en 100 no llegaba a
-- retirar nada. Aquí vuelven a su sitio.
update economia
   set red                = 'devnet',
       retiradas_abiertas = false,      -- ← la puerta, cerrada
       minimo_retirada    = 100,
       tope_jugador_dia   = 1000,
       tope_global_dia    = 20000,
       retirado_total     = 0,          -- lo retirado era de simulacro
       reserva_seguridad  = 5000000,
       actualizado = now()
 where id = 1;

-- Y cuadrar la reserva con lo que queda de verdad en circulación.
update economia
   set reserva_restante = reserva_total
                          - (select coalesce(sum(coins),0) from players)
 where id = 1;


select 'DESPUES' as momento,
       (select count(*) from players)     as jugadores,
       (select count(*) from brutes)      as brutos,
       (select count(*) from withdrawals) as retiradas,
       (select coalesce(sum(coins),0) from players) as en_circulacion,
       (select reserva_restante from economia where id=1) as reserva,
       -- Tiene que dar EXACTAMENTE 40.000.000.
       (select coalesce(sum(coins),0) from players)
         + (select reserva_restante from economia where id=1) as suma_debe_dar_40M,
       (select retiradas_abiertas from economia where id=1) as puerta,
       (select red from economia where id=1) as red;

drop table _basura;
