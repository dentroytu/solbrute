-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 12 — TOPE DE EMISIÓN
-- ══════════════════════════════════════════════════════════════════════════
-- Supabase → SQL Editor → New query → pegar → Run. Repetible.
--
-- ── El problema que arregla ───────────────────────────────────────────────
--
-- Hasta ahora cada pelea IMPRIME monedas: `12 + turnos`, sin techo. Un bruto
-- saca ~40 al día y una wallet con las 3 plazas ~120. El presupuesto del
-- TOKEN.md son 27.397/día — los 40 millones de reserva repartidos en 4 años.
--
--     27.397 ÷ 120 = 228 wallets
--
-- A partir de 228 jugadores el juego emite más de lo que la reserva puede
-- pagar, y no se estabiliza: crece en línea recta con la gente.
--
--     200 jugadores  →     24.000/día  → la reserva dura 4 años
--   1.000 jugadores  →    120.000/día  → 11 meses
--  10.000 jugadores  →  1.200.000/día  → 33 días
--
-- Con diez mil jugadores —o sea, teniendo éxito— la reserva se evapora en un
-- mes. El juego se rompe justo cuando funciona.
--
-- Y no es solo la velocidad: con emisión libre, CREAR CUENTAS ES IMPRIMIR
-- DINERO. Cien wallets falsas son 12.000 monedas diarias salidas de la nada.
-- Eso es una granja de bots, y es lo que ha matado a todos los juegos del
-- género.
--
-- ── La idea: se invierte quién manda ──────────────────────────────────────
--
--   ANTES:   las peleas deciden cuántas monedas existen
--   AHORA:   la reserva decide cuántas existen, y las peleas cómo se reparten
--
-- Lo que gana una pelea pasa a ser PUNTOS (los mismos `12 + turnos` de
-- siempre: el equilibrio no se toca). Los puntos se convierten en monedas con
-- una TASA, y la tasa se recalcula cada día:
--
--     tasa = pool_diario ÷ puntos_de_ayer          ...y nunca más de 1,0
--
-- El jugador sigue cobrando al instante, que es lo que hace que vuelva.
--
-- ── Por qué la tasa se topa en 1,0 ────────────────────────────────────────
--
-- Es la decisión importante de este fichero.
--
-- Con pocos jugadores, `pool ÷ puntos_ayer` sale enorme: si ayer solo hubo
-- 10 puntos, la fórmula pura pagaría 2.739 monedas por punto. Eso reventaría
-- los precios internos, que están calibrados sobre "un arma cuesta ~3 monedas
-- por combate sobre las ~40 que se ganan al día".
--
-- Topándola en 1,0:
--
--   · Con pocos jugadores todo el mundo cobra EXACTAMENTE lo de hoy, y la
--     reserva simplemente dura más de 4 años. No cambia nada para nadie.
--   · Pasados los ~228 jugadores la tasa baja de 1,0 y el presupuesto empieza
--     a mandar de verdad.
--
-- O sea: el tope no se nota hasta que hace falta. Que es como debe ser.
--
-- ── Lo que esto arregla de los bots, gratis ───────────────────────────────
--
-- Con reparto fijo, meter cuentas falsas NO crea monedas: reparte las mismas
-- entre más cuentas. El tramposo se diluye a sí mismo. Está escrito en el
-- CLAUDE.md como propiedad del modelo — pero solo existe si el reparto es
-- fijo, y hasta este fichero no lo era.
-- ══════════════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════════════
-- Una fila por día
-- ══════════════════════════════════════════════════════════════════════════
-- Además de servir para el cálculo, es el historial de emisión: el número que
-- avisa de que la economía se ha roto ANTES de que se note en el precio.
create table if not exists emision (
  dia      date primary key,
  puntos   bigint  not null default 0,   -- puntos otorgados ese día
  monedas  bigint  not null default 0,   -- monedas realmente emitidas
  tasa     numeric(14,6) not null,       -- la que se usó (se congela al abrir el día)
  peleas   int     not null default 0
);

create index if not exists emision_dia_idx on emision(dia desc);

alter table emision enable row level security;

-- Leer sí. Que el jugador vea la tasa del día y cuánto se ha emitido es parte
-- de ser honesto con él, y es lo que permite enseñar "1 punto = 0,94 monedas"
-- en la pantalla de victoria. Escribir, solo la Edge Function.
drop policy if exists emision_lectura on emision;
create policy emision_lectura on emision for select using (true);


-- La reserva y el presupuesto viven en `economia`, creada en el paso 11.
-- Se añaden aquí las columnas que faltaban. Si no has aplicado el 11 todavía,
-- aplícalo antes: este `alter` fallará con "relation economia does not exist".
alter table economia add column if not exists pool_diario bigint not null default 27397;

-- Cortafuegos. Si un día la emisión se dispara —crecimiento repentino o
-- alguien creando cuentas en masa— la tasa se reajusta EN CALIENTE sin
-- esperar al cambio de día, en vez de dejar correr el desastre 24 horas.
-- Factor 2 = se tolera el doble del presupuesto antes de frenar.
alter table economia add column if not exists tope_factor numeric(6,2) not null default 2.0;


-- ══════════════════════════════════════════════════════════════════════════
-- LA RESERVA DE SEGURIDAD
-- ══════════════════════════════════════════════════════════════════════════
-- Un 5% del suministro (5.000.000) apartado y que NO se emite nunca por
-- jugar. `emision_cobrar` solo mira `reserva_restante` y no puede tocar esto
-- ni por error.
--
-- ── De dónde sale ─────────────────────────────────────────────────────────
-- De la TESORERÍA, que baja del 15% al 10%. No de las recompensas.
--
-- Es deliberado: si saliera del 40% de recompensas, la reserva de seguridad
-- la estarían pagando los jugadores con menos monedas por pelea, y toda la
-- aritmética del TOKEN.md —los 4 años, las tablas de reciclaje— habría que
-- rehacerla. Saliendo de tesorería, la emisión no cambia ni un punto y quien
-- pone el dinero es el dueño del proyecto. Que es de quien tiene que salir un
-- fondo de garantía.
--
-- ── Para qué es ───────────────────────────────────────────────────────────
--   · Compensar a jugadores si un fallo se come su saldo.
--   · Cubrir retiradas legítimas si hay un incidente y se cierra el grifo
--     (`retiradas_abiertas = false` del paso 11).
--   · Colchón si la reserva de recompensas se agota antes de lo previsto.
--
-- ── Y para qué NO ─────────────────────────────────────────────────────────
-- Para gastos del proyecto. Para eso está la tesorería. Una reserva de
-- seguridad que se usa para pagar cosas es tesorería con otro nombre, y el
-- día que haga falta de verdad no estará.
--
-- Por eso tocarla NO es un `update`: es `seguridad_usar()`, que obliga a dar
-- un motivo y lo deja en `admin_log`. Un fondo de garantía que el gestor
-- puede mover sin dejar rastro no es una garantía, es una cuenta suya.
alter table economia add column if not exists reserva_seguridad bigint not null default 5000000;

-- Y además se rellena sola. Un porcentaje de todo lo que se gasta dentro va
-- al fondo en vez de volver al reparto: cuanto más se juega, más colchón hay.
-- El otro 90% sí vuelve a recompensas, que es lo que alarga la vida del token.
alter table economia add column if not exists reciclaje_seguridad_pct int not null default 10;


-- ══════════════════════════════════════════════════════════════════════════
-- LA FUNCIÓN: convertir puntos en monedas
-- ══════════════════════════════════════════════════════════════════════════
-- Un único punto de entrada, y hace las cuatro cosas de una vez para que no
-- puedan quedar a medias: abrir el día, calcular, apuntar y descontar de la
-- reserva. Si esto fueran cuatro llamadas, un fallo entre la segunda y la
-- tercera dejaría monedas emitidas sin registrar.
--
-- Devuelve json: { monedas, tasa, dia }
create or replace function emision_cobrar(p_puntos bigint)
returns json
language plpgsql
security definer
as $$
declare
  v_hoy      date := (now() at time zone 'utc')::date;
  v_pool     bigint;
  v_reserva  bigint;
  v_factor   numeric;
  v_ayer     bigint;
  v_tasa     numeric;
  v_efectiva numeric;
  v_emitido  bigint;
  v_monedas  bigint;
begin
  -- Puntos negativos o absurdos: fuera. Nunca deberían llegar —la Edge
  -- Function los calcula— pero una función `security definer` se salta RLS y
  -- no se fía de su llamante ni aunque hoy sea de confianza.
  if p_puntos is null or p_puntos <= 0 then
    return json_build_object('monedas', 0, 'tasa', 0, 'dia', v_hoy);
  end if;
  p_puntos := least(p_puntos, 100000);

  select pool_diario, reserva_restante, tope_factor
    into v_pool, v_reserva, v_factor
    from economia where id = 1
     for update;                     -- serializa: dos peleas a la vez no se pisan

  -- La reserva manda sobre el presupuesto. Cuando queda menos de un día de
  -- pool, el pool ES lo que queda: nunca se emite lo que no hay.
  v_pool := least(v_pool, greatest(v_reserva, 0));

  if v_pool <= 0 then
    -- Reserva agotada. No se emite nada; el juego sigue funcionando y las
    -- monedas que circulan se reciclan. Es un final, no un fallo.
    return json_build_object('monedas', 0, 'tasa', 0, 'dia', v_hoy, 'agotada', true);
  end if;

  -- ── Abrir el día ────────────────────────────────────────────────────────
  -- La tasa se calcula UNA VEZ al día y se congela en la fila. Si se
  -- recalculara en cada pelea, dos jugadores del mismo día cobrarían distinto
  -- por lo mismo, y eso es imposible de explicar.
  if not exists (select 1 from emision where dia = v_hoy) then
    select puntos into v_ayer from emision where dia = v_hoy - 1;

    if v_ayer is null or v_ayer <= 0 then
      -- Primer día, o ayer no peleó nadie: se arranca a 1,0, que es
      -- exactamente el comportamiento de hoy. Estrenar esto no cambia nada.
      v_tasa := 1.0;
    else
      -- El tope de 1,0 es la decisión explicada en la cabecera.
      v_tasa := least(1.0, v_pool::numeric / v_ayer::numeric);
    end if;

    insert into emision (dia, tasa) values (v_hoy, v_tasa)
      on conflict (dia) do nothing;   -- carrera entre dos peleas simultáneas
  end if;

  select tasa, monedas into v_tasa, v_emitido from emision where dia = v_hoy;

  -- ── Cortafuegos ─────────────────────────────────────────────────────────
  -- Si ya se ha emitido más de `factor × pool`, la tasa efectiva baja de
  -- forma inversamente proporcional a lo emitido. La emisión del día tiende a
  -- ese techo en vez de dispararse, y NADIE se queda a cero: se cobra menos,
  -- no nada. Con el reparto bien calibrado esto no llega a activarse nunca.
  v_efectiva := v_tasa;
  if v_emitido > v_pool * v_factor then
    v_efectiva := v_tasa * ((v_pool * v_factor) / greatest(v_emitido, 1)::numeric);
  end if;

  v_monedas := greatest(round(p_puntos * v_efectiva)::bigint, 0);
  -- Nunca más de lo que queda en la reserva.
  v_monedas := least(v_monedas, greatest(v_reserva, 0));

  update emision
     set puntos  = puntos  + p_puntos,
         monedas = monedas + v_monedas,
         peleas  = peleas  + 1
   where dia = v_hoy;

  update economia
     set reserva_restante = reserva_restante - v_monedas,
         actualizado = now()
   where id = 1;

  return json_build_object('monedas', v_monedas, 'tasa', v_efectiva, 'dia', v_hoy);
end;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- El reciclaje: lo que se gasta dentro VUELVE a la reserva
-- ══════════════════════════════════════════════════════════════════════════
-- Es la otra mitad del modelo y hasta ahora no existía: al comprar un arma
-- las monedas simplemente desaparecían del saldo del jugador y no volvían a
-- ningún sitio. Con esto, gastar dentro alarga la vida de la reserva — que
-- según el TOKEN.md importa el DOBLE que la comisión de retirada.
--
-- El reparto: `reciclaje_seguridad_pct` al fondo de garantía (10% por
-- defecto), el resto al pool de recompensas.
create or replace function emision_reciclar(p_monedas bigint)
returns json
language plpgsql
security definer
as $$
declare
  v_total bigint := greatest(coalesce(p_monedas, 0), 0);
  v_pct   int;
  v_seg   bigint;
begin
  if v_total = 0 then
    return json_build_object('pool', 0, 'seguridad', 0);
  end if;

  select reciclaje_seguridad_pct into v_pct from economia where id = 1 for update;

  v_seg := (v_total * greatest(least(coalesce(v_pct, 0), 100), 0)) / 100;

  update economia
     set reserva_restante  = reserva_restante  + (v_total - v_seg),
         reserva_seguridad = reserva_seguridad + v_seg,
         actualizado = now()
   where id = 1;

  return json_build_object('pool', v_total - v_seg, 'seguridad', v_seg);
end;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- Sacar del fondo de garantía: solo con motivo y dejando rastro
-- ══════════════════════════════════════════════════════════════════════════
-- Mueve monedas de `reserva_seguridad` a `reserva_restante` (o las saca del
-- sistema, si `p_a_pool` es false, para compensar a alguien directamente).
--
-- Lo importante no es la resta: es que queda escrito QUIÉN, CUÁNTO y POR QUÉ,
-- con el antes y el después. Sin el antes, un registro solo dice que algo
-- cambió, no de qué a qué — la misma razón por la que `admin_log` guarda las
-- dos caras desde el paso 8.
--
-- Con un token de por medio, el primer sospechoso de un saldo raro es siempre
-- quien tiene las llaves. Esto existe para poder demostrar qué pasó.
create or replace function seguridad_usar(
  p_admin   text,
  p_monedas bigint,
  p_motivo  text,
  p_a_pool  boolean default true
)
returns json
language plpgsql
security definer
as $$
declare
  v_antes  bigint;
  v_pool   bigint;
  v_mover  bigint;
begin
  if p_motivo is null or length(btrim(p_motivo)) < 10 then
    raise exception 'hace falta un motivo de al menos 10 caracteres';
  end if;

  select reserva_seguridad, reserva_restante into v_antes, v_pool
    from economia where id = 1 for update;

  v_mover := greatest(coalesce(p_monedas, 0), 0);
  if v_mover > v_antes then
    raise exception 'el fondo de garantía tiene % y se piden %', v_antes, v_mover;
  end if;

  update economia
     set reserva_seguridad = reserva_seguridad - v_mover,
         reserva_restante  = reserva_restante + (case when p_a_pool then v_mover else 0 end),
         actualizado = now()
   where id = 1;

  insert into admin_log (admin, accion, objetivo, antes, despues)
  values (
    coalesce(p_admin, '?'), 'seguridad_usar', btrim(p_motivo),
    json_build_object('reserva_seguridad', v_antes, 'reserva_restante', v_pool),
    json_build_object('reserva_seguridad', v_antes - v_mover,
                      'reserva_restante',  v_pool + (case when p_a_pool then v_mover else 0 end))
  );

  return json_build_object('movido', v_mover, 'seguridad_restante', v_antes - v_mover);
end;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- Resumen para el panel
-- ══════════════════════════════════════════════════════════════════════════
create or replace function emision_resumen()
returns json
language sql
security definer
as $$
  select json_build_object(
    'reserva_restante',  (select reserva_restante  from economia where id = 1),
    'reserva_total',     (select reserva_total     from economia where id = 1),
    'reserva_seguridad', (select reserva_seguridad from economia where id = 1),
    'pool_diario',       (select pool_diario       from economia where id = 1),
    'dias',             (select coalesce(json_agg(x order by x.dia desc), '[]'::json)
                           from (select dia, puntos, monedas, tasa, peleas
                                   from emision order by dia desc limit 30) x)
  );
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- LA TRAMPA DE SIEMPRE
-- ══════════════════════════════════════════════════════════════════════════
-- En Postgres una función nace ejecutable por PUBLIC, y revocar solo a `anon`
-- NO quita ese permiso. Ya pasó dos veces en este proyecto: `admin_resumen`
-- devolvía las estadísticas con la clave pública, y el paso 8 deshizo en
-- silencio lo que había puesto el 7.
--
-- Aquí sería mucho peor: `emision_cobrar` es `security definer` y ESCRIBE.
-- Abierta a public, cualquiera con la clave anon se regala monedas llamándola
-- en bucle desde curl. Sería el agujero más grave del proyecto.
--
-- Y hay que REPETIR esto cada vez que se haga `create or replace`.
revoke execute on function emision_cobrar(bigint)   from public;
revoke execute on function emision_cobrar(bigint)   from anon, authenticated;
grant  execute on function emision_cobrar(bigint)   to service_role;

revoke execute on function emision_reciclar(bigint) from public;
revoke execute on function emision_reciclar(bigint) from anon, authenticated;
grant  execute on function emision_reciclar(bigint) to service_role;

revoke execute on function emision_resumen()        from public;
revoke execute on function emision_resumen()        from anon, authenticated;
grant  execute on function emision_resumen()        to service_role;

-- Esta es la más golosa de todas: mueve el fondo de garantía.
revoke execute on function seguridad_usar(text, bigint, text, boolean) from public;
revoke execute on function seguridad_usar(text, bigint, text, boolean) from anon, authenticated;
grant  execute on function seguridad_usar(text, bigint, text, boolean) to service_role;


-- ══════════════════════════════════════════════════════════════════════════
-- Comprobación
-- ══════════════════════════════════════════════════════════════════════════
-- 1) Ninguna de las tres puede llamarse con la clave pública.
--    Lo correcto es que esto devuelva CERO filas.
select p.proname as funcion_abierta
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('emision_cobrar','emision_reciclar','emision_resumen','seguridad_usar')
   and (has_function_privilege('anon',   p.oid, 'execute')
     or has_function_privilege('public', p.oid, 'execute'));

-- 2) Estado de partida.
select reserva_restante, reserva_seguridad, pool_diario, tope_factor,
       reciclaje_seguridad_pct
  from economia where id = 1;
