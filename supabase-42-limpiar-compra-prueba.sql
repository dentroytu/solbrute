-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 42 — sacar del cupo la compra de PRUEBA de devnet
-- ══════════════════════════════════════════════════════════════════════════
-- Supabase → SQL Editor → New query → pegar → Run.
--
-- La preventa estuvo abierta del 03/08 al 07/08/2026 y figura con 1.000 tokens
-- vendidos. No los compró nadie de fuera: la dirección compradora es la de
-- `.comprador-devnet.json`, o sea la wallet que usa `prueba-pago-devnet.mjs`,
-- y el pago se hizo el 04/08 con SOL de **devnet**, que no vale nada.
--
-- ── Por qué no basta con dejarlo estar ────────────────────────────────────
-- La fila sigue en estado `pagada`, así que el día que se abran los reclamos
-- `pv_reclamar` entregaria 1.000 tokens DE VERDAD contra ese pago. Y mientras
-- tanto esos 1.000 ocupan cupo: `preventa.vendido` los cuenta.
--
-- Es el mismo caso que los brutos de scripts del paso 41 y que los pasos 19 y
-- 20, con una diferencia que lo hace peor: aqui lo que sale por la puerta son
-- tokens, y en la cadena no hay vuelta atras.
--
-- ── Se CANCELA, no se borra ───────────────────────────────────────────────
-- Los pasos 16, 22 y 24 borran cuentas de juego. Esto es un registro de un
-- PAGO, y esos no se borran en este proyecto: se marcan. `cancelada` ya es un
-- estado que el sistema entiende y que `preventa_confirmar` rechaza, asi que
-- deja la fila inerte sin perder la historia de que aquel ensayo ocurrio.
--
-- ── Se ENUMERA la de prueba, al reves que el paso 41 ──────────────────────
-- Alli el riesgo era dejarse basura dentro, y por eso iba por lista blanca.
-- Aqui el riesgo es cancelarle la compra a alguien que pago de verdad, asi que
-- el valor por defecto es NO TOCAR NADA: se nombra la direccion de prueba y
-- todo lo demas se queda como esta.
-- ══════════════════════════════════════════════════════════════════════════

-- La wallet de `.comprador-devnet.json`. Si algun dia hay mas ensayos, se
-- añaden aqui.
create temp table _de_prueba (address text primary key);
insert into _de_prueba values
  ('6jadMcpWW9uWYEmFxBU9gZCVAz5njnBMzYCFUfqCb4LE');   -- prueba-pago-devnet.mjs

-- Quien ejecuta esto es quien tiene el SQL Editor. Si lo corre otra persona,
-- que cambie la wallet: un registro que no dice QUIEN no es auditoria.
create temp table _quien (admin text);
insert into _quien values ('GwoqZQ9GesBnqxeooG22t4BJK9hMu792Ddf62Ey5Rz3Q');


-- ── Red 1: los reclamos tienen que estar CERRADOS ─────────────────────────
-- Con los reclamos abiertos puede haber una entrega en vuelo, y cancelar por
-- debajo dejaria la contabilidad a medias.
do $$
declare v boolean;
begin
  select reclamos_abiertos into v from preventa where id = 1;
  if v then raise exception 'PARA: los reclamos estan ABIERTOS'; end if;
end $$;


-- ── Red 2: nada entregado ni reclamado ────────────────────────────────────
-- Si ya se entrego, esto no es una limpieza: es un descuadre que hay que
-- mirar a mano.
do $$
declare v int;
begin
  select count(*) into v from preventa_compras
   where address in (select address from _de_prueba)
     and (estado = 'entregada' or reclamo_id is not null or entregado is not null);
  if v > 0 then raise exception 'PARA: % compras de prueba ya se entregaron', v; end if;
end $$;


-- ── Red 3: solo se toca lo que se espera ──────────────────────────────────
-- Si aparecen compras de prueba que no son la conocida, mejor pararse y
-- mirarlas que cancelarlas a ciegas.
do $$
declare v int; v_tok bigint;
begin
  select count(*), coalesce(sum(tokens), 0) into v, v_tok
    from preventa_compras
   where address in (select address from _de_prueba)
     and estado in ('pagada', 'reservada');
  if v <> 1 or v_tok <> 1000 then
    raise exception 'PARA: esperaba 1 compra de 1000 tokens, hay % de %', v, v_tok;
  end if;
end $$;


select 'ANTES' as momento,
       (select vendido    from preventa where id=1) as vendido,
       (select reservado  from preventa where id=1) as reservado,
       (select cupo_total from preventa where id=1) as cupo,
       (select count(*) from preventa_compras)                          as compras,
       (select count(*) from preventa_compras where estado='pagada')    as pagadas;


-- ── Cancelar y devolver el cupo, en UNA transaccion ───────────────────────
do $$
declare
  v_tokens bigint;
  v_res    bigint;
  v_ids    text;
begin
  -- Se suma ANTES de cambiar el estado, porque despues ya no encajan el filtro.
  select coalesce(sum(tokens), 0), coalesce(sum(tokens) filter (where estado='reservada'), 0),
         string_agg(id::text, ',' order by id)
    into v_tokens, v_res, v_ids
    from preventa_compras
   where address in (select address from _de_prueba)
     and estado in ('pagada', 'reservada');

  update preventa_compras
     set estado = 'cancelada'
   where address in (select address from _de_prueba)
     and estado in ('pagada', 'reservada');

  -- `vendido` cuenta las pagadas y `reservado` las que estaban en vuelo. Se
  -- descuenta cada una de donde estaba, y con `greatest` por si acaso: dejar
  -- un contador en negativo seria vender cupo que no existe.
  update preventa
     set vendido     = greatest(vendido   - (v_tokens - v_res), 0),
         reservado   = greatest(reservado - v_res, 0),
         actualizado = now()
   where id = 1;

  insert into admin_log (admin, accion, objetivo, antes, despues)
  select (select admin from _quien), 'preventa_cancelar_prueba', 'compras:' || v_ids,
         json_build_object('tokens', v_tokens, 'motivo',
           'compra de prueba pagada con SOL de devnet por prueba-pago-devnet.mjs'),
         json_build_object('estado', 'cancelada');

  raise notice 'canceladas las compras %: % tokens devueltos al cupo', v_ids, v_tokens;
end $$;


select 'DESPUES' as momento,
       (select vendido    from preventa where id=1) as vendido,
       (select reservado  from preventa where id=1) as reservado,
       (select cupo_total from preventa where id=1) as cupo,
       (select count(*) from preventa_compras where estado='cancelada') as canceladas,
       (select count(*) from preventa_compras where estado='pagada')    as pagadas,
       -- Tiene que dar el cupo entero: no queda nada vendido.
       (select cupo_total - vendido - reservado from preventa where id=1) as queda;

drop table _de_prueba;
drop table _quien;
