-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 8 — registro de acciones de administración
-- ══════════════════════════════════════════════════════════════════════════
-- Supabase → SQL Editor → New query → pegar → Run. Repetible.
--
-- ── Por qué esto va con la edición y no después ───────────────────────────
-- El panel puede cambiar monedas, atributos y niveles, y borrar jugadores.
-- Es decir: puede saltarse todo lo que construimos hoy para que nadie pudiera
-- hacer exactamente eso. Está bien, para eso es un panel de administración.
--
-- Pero con un token de por medio, un saldo que cambia sin explicación es un
-- problema, y el primer sospechoso siempre es quien tiene el panel. Este
-- registro no está para vigilarte: está para que puedas demostrar qué pasó.
--
-- Guarda el ANTES y el DESPUÉS. Sin el antes, un registro solo dice que algo
-- cambió, no de qué a qué — que es justo lo que hace falta saber.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists admin_log (
  id         bigserial primary key,
  admin      text not null,              -- wallet que hizo el cambio
  accion     text not null,              -- borrar_bruto, editar_jugador, …
  objetivo   text not null,              -- id del bruto o dirección del jugador
  antes      jsonb,                      -- cómo estaba
  despues    jsonb,                      -- cómo quedó
  created_at timestamptz not null default now()
);

create index if not exists admin_log_fecha_idx on admin_log(created_at desc);

-- Ni leer ni escribir desde el navegador. Solo la Edge Function.
-- Un registro de auditoría que el auditado puede editar no sirve de nada.
alter table admin_log enable row level security;


-- ══════════════════════════════════════════════════════════════════════════
-- El resumen incluye ahora las últimas acciones de administración
-- ══════════════════════════════════════════════════════════════════════════
create or replace function admin_resumen()
returns json language sql security definer as $$
  select json_build_object(
    'jugadores',        (select count(*) from players),
    'jugadores_activos',(select count(distinct a_owner) from fights
                          where created_at >= now() - interval '7 days'),
    'brutos',           (select count(*) from brutes),
    'monedas_en_juego', (select coalesce(sum(coins),0) from players),

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

revoke execute on function admin_resumen() from anon, authenticated;
