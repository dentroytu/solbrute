-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 16 — limpiar las cuentas de las pruebas de seguridad
-- ══════════════════════════════════════════════════════════════════════════
-- Supabase → SQL Editor → New query → pegar → Run.
--
-- Los 9 ataques al inventario (comprar sin saldo, equipar sin tener, equipar
-- el bruto de otro, y sobre todo las dos CARRERAS) no se pueden lanzar sin
-- una cuenta de verdad: hay que entrar firmando, forjar un bruto y ganar
-- monedas peleando. Eso dejó rastro en el juego.
--
-- Esto lo borra.
--
-- ── Por dirección, no por patrón ──────────────────────────────────────────
-- Las ocho direcciones van escritas una a una a propósito. Sería más corto
-- borrar "los brutos que se llamen Atk% o Dbg%", pero un jugador real puede
-- llamar así a su bruto y este fichero no tiene forma de saberlo. Una lista
-- explícita no puede llevarse por delante a nadie por accidente.
--
-- Los otros tres jugadores con 0 monedas —los de `Arbitrado`, `Sala7huk` e
-- `Iconok5i`— NO están aquí. No son míos.
-- ══════════════════════════════════════════════════════════════════════════

create temp table _basura (address text primary key);
insert into _basura values
  ('8amvLB61KHU7Ea7oL1rrWsHbs85Y82AUPKSAtR195AN4'),  -- Atk629682
  ('FXn9bvpDq56Z5XR6bwqJ84i3wRtyHU1wPhcxRLDdga5k'),  -- Vic630250
  ('6Qo5s8q3x5qzfXVyLxgFwbGupCr5dUKbcnoUxahnkbjy'),  -- Dbg684072
  ('57kuWo9meTLC5hyqjW4KAVJYF9YZVDeuTEQK2BguEHWb'),  -- Dbg731893
  ('9M9o9v6BrzzEbXNBX7U1hw4yT5fwHTwpfCLjAaWAkHd4'),  -- Race779002 (la carrera)
  ('AtEjHgCABUisVDHhHmR4aq5jcCpkE83BcAYsY2xxKGhc'),  -- sin bruto
  ('8VB1Lj8LZCae1TLz2bkYc34gMujxkQX7k2zcjAiAikqa'),  -- sin bruto
  ('BQNUEfMmBLQ5MQfw54rmx1cQxP4jAMfi9ZtqiKK44Zyd'),  -- sin bruto
  ('3BTanRiTZ5i5Lo3PPpEyuiM6KVWBokFyi14zFdVTwhBT'); -- Ev…, la prueba del tablón

-- Borrar por dirección es idempotente: las que ya no existan no hacen nada.
-- Por eso este fichero se puede volver a pasar cada vez que se añada una
-- cuenta nueva a la lista, sin tocar a nadie más.


select 'ANTES' as momento,
       (select count(*) from players) as jugadores,
       (select count(*) from brutes)  as brutos,
       (select coalesce(sum(coins),0) from players) as en_circulacion,
       (select reserva_restante from economia where id=1) as reserva;


-- En este orden: las peleas apuntan a los brutos y los brutos a su dueño.
delete from fights      where a_owner in (select address from _basura);
delete from movimientos where address in (select address from _basura);
delete from brutes      where owner   in (select address from _basura);
delete from players     where address in (select address from _basura);

-- Las sesiones y los nonces de esas cuentas, que si no quedan colgando.
delete from sessions     where address in (select address from _basura);
delete from auth_nonces  where address in (select address from _basura);

-- La emisión del día era ENTERA de mis peleas de prueba: después del paso 15
-- la tabla quedó vacía y solo he peleado yo. Se borra para que la tasa de
-- mañana no se calcule sobre puntos que no jugó nadie.
delete from emision;


-- ══════════════════════════════════════════════════════════════════════════
-- Cuadrar la reserva otra vez
-- ══════════════════════════════════════════════════════════════════════════
-- Mis peleas emitieron monedas y mi compra recicló parte. Al borrar esas
-- cuentas, sus monedas dejan de existir — así que la reserva vuelve a ser
-- todo lo que no está en manos de nadie.
--
--     en circulación + reserva restante  =  reserva total
update economia
   set reserva_restante  = reserva_total
                           - (select coalesce(sum(coins),0) from players),
       reserva_seguridad = 5000000,
       actualizado = now()
 where id = 1;


select 'DESPUES' as momento,
       (select count(*) from players) as jugadores,
       (select count(*) from brutes)  as brutos,
       (select coalesce(sum(coins),0) from players) as en_circulacion,
       (select reserva_restante from economia where id=1) as reserva,
       -- Tiene que dar EXACTAMENTE reserva_total.
       (select coalesce(sum(coins),0) from players)
         + (select reserva_restante from economia where id=1) as suma_debe_dar_40M;

drop table _basura;
