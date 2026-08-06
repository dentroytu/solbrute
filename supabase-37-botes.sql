-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 37 — las monedas en deposito TAMBIEN estan en circulacion
-- ══════════════════════════════════════════════════════════════════════════
-- Supabase → SQL Editor → New query → pegar → Run. Repetible.
-- No depende de la Edge Function: se puede aplicar antes o despues.
--
-- ── Que estaba mal ────────────────────────────────────────────────────────
-- `monedas_en_juego` sumaba solo `players.coins`. Pero al inscribirse en un
-- torneo las monedas SALEN de ahi y entran en `tournaments.bote`:
--
--     update players     set coins = coins - t.entrada    (paso 21, linea 193)
--     update tournaments set bote  = bote  + t.entrada
--
-- Siguen existiendo, solo que en deposito. Asi que con un torneo abierto el
-- panel enseñaba menos monedas de las que hay, por la cantidad exacta del
-- bote — y lo que lee el dueño es «han desaparecido monedas», que con un token
-- de por medio es justo el susto que no conviene darse sin motivo.
--
-- La invariante de verdad es esta, y es la que comprueba `respaldo.mjs`:
--
--     players.coins  +  botes en depostio  +  reserva_restante  =  reserva_total
--
-- Un torneo `terminado` o `cancelado` ya no retiene nada: los premios
-- volvieron a los jugadores y el resto se paso por `emision_reciclar`. Por eso
-- solo cuentan los que siguen vivos.
--
-- ── Se añade un campo, no se cambia el que habia ──────────────────────────
-- `monedas_en_juego` sigue significando lo mismo que siempre. Cambiarle el
-- sentido a un numero que el dueño ya sabe leer es peor que añadir otro al
-- lado: un dia comparas dos capturas de pantalla y no cuadran, y no hay forma
-- de saber cual medida era cual.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function admin_resumen()
returns json language sql security definer as $$
  select json_build_object(
    'jugadores',        (select count(*) from players),
    'jugadores_activos',(select count(distinct a_owner) from fights
                          where created_at >= now() - interval '7 days'),
    'brutos',           (select count(*) from brutes),
    'monedas_en_juego', (select coalesce(sum(coins),0) from players),

    -- NUEVO: lo que hay retenido en botes de torneos sin resolver.
    'monedas_deposito', (select coalesce(sum(bote),0) from tournaments
                          where estado not in ('terminado','cancelado')),

    'peleas_total',     (select count(*) from fights),
    'peleas_hoy',       (select count(*) from fights
                          where created_at >= (now() at time zone 'utc')::date),
    'monedas_hoy',      (select coalesce(sum(coins),0) from fights
                          where created_at >= (now() at time zone 'utc')::date),
    'monedas_7d',       (select coalesce(sum(coins),0) from fights
                          where created_at >= now() - interval '7 days'),

    'por_nivel',        (select coalesce(json_agg(x order by x.level), '[]'::json)
                          from (select level, count(*) as n from brutes
                                 group by level) x),

    'por_dia',          (select coalesce(json_agg(x order by x.dia desc), '[]'::json)
                          from (select created_at::date as dia,
                                       count(*) as peleas,
                                       sum(coins) as monedas
                                  from fights
                                 where created_at >= now() - interval '14 days'
                                 group by 1) x),

    'ultimo_alta',      (select max(created_at) from players),

    -- Las últimas 40 acciones del panel, para tenerlas a la vista.
    'registro',         (select coalesce(json_agg(x order by x.created_at desc), '[]'::json)
                          from (select admin, accion, objetivo, antes, despues, created_at
                                  from admin_log
                                 order by created_at desc limit 40) x)
  );
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- LA TRAMPA DE SIEMPRE, Y ESTA FUNCION YA CAYO EN ELLA
-- ══════════════════════════════════════════════════════════════════════════
-- `admin_resumen` es `security definer`, asi que se salta RLS. En Postgres una
-- funcion nace ejecutable por PUBLIC y **`create or replace` vuelve a
-- concederlo**: hay que revocar CADA VEZ que se recrea.
--
-- Ya paso aqui — el paso 8 deshizo en silencio lo que habia puesto el 7, y con
-- el revoke incompleto un `POST /rest/v1/rpc/admin_resumen` con la clave
-- publica devolvia las estadisticas completas del juego. Este fichero la
-- recrea otra vez, asi que el revoke va justo debajo y no en otro sitio.
revoke execute on function admin_resumen() from public;
revoke execute on function admin_resumen() from anon, authenticated;
grant  execute on function admin_resumen() to service_role;


-- ══════════════════════════════════════════════════════════════════════════
-- Comprobacion — la primera tiene que dar CERO filas
-- ══════════════════════════════════════════════════════════════════════════
select p.proname as abierta_de_mas
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'admin_resumen'
   and (has_function_privilege('anon',   p.oid, 'execute')
     or has_function_privilege('public', p.oid, 'execute'));

-- Y la invariante completa, con el deposito dentro. Tiene que dar `true`.
select (select coalesce(sum(coins),0) from players)                as en_circulacion,
       (select coalesce(sum(bote),0) from tournaments
         where estado not in ('terminado','cancelado'))            as en_deposito,
       e.reserva_restante,
       e.reserva_total,
       (select coalesce(sum(coins),0) from players)
         + (select coalesce(sum(bote),0) from tournaments
             where estado not in ('terminado','cancelado'))
         + e.reserva_restante
         + (e.reserva_seguridad - 5000000) = e.reserva_total        as cuadra
  from economia e;
