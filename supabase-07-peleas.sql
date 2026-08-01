-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 7 — registro de peleas y resumen para el panel
-- ══════════════════════════════════════════════════════════════════════════
-- Supabase → SQL Editor → New query → pegar → Run. Repetible.
--
-- Hasta ahora las peleas se calculaban, se aplicaban y se olvidaban. Guardarlas
-- sale casi gratis: el servidor ya tiene el resultado en la mano justo cuando
-- escribe el bruto.
--
-- Sirve para tres cosas:
--   · el historial de combates por bruto, pendiente desde el principio
--   · el panel de administración
--   · y la que de verdad importa con un token: saber CUÁNTAS MONEDAS SE EMITEN
--     al día. Ese número es el que avisa de que la economía se ha roto, mucho
--     antes de que se note en el precio.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists fights (
  id         bigserial primary key,
  seed       bigint   not null,          -- con esto cualquiera recalcula la pelea

  a_brute    bigint   not null references brutes(id) on delete cascade,
  a_owner    text     not null,

  -- El rival puede ser un jugador o un bruto de la casa. Si es de la casa no
  -- hay fila a la que apuntar, porque no se guardan.
  b_brute    bigint   references brutes(id) on delete set null,
  b_name     text     not null,
  b_bot      boolean  not null default true,

  -- Copia congelada del rival. IMPRESCINDIBLE: el rival sube de nivel después,
  -- y sin esto la pelea deja de poder reproducirse.
  b_snapshot jsonb    not null,

  winner     char(1)  not null check (winner in ('A','B')),
  turns      smallint not null,
  log        jsonb    not null,          -- registro completo, para reproducir
  coins      integer  not null,          -- lo que se emitió en esta pelea
  xp         integer  not null,
  created_at timestamptz not null default now()
);

create index if not exists fights_brute_idx on fights(a_brute, created_at desc);
create index if not exists fights_fecha_idx on fights(created_at desc);
create index if not exists fights_owner_idx on fights(a_owner);


-- ─── quién puede leerlas ──────────────────────────────────────────────────
-- Leer: todo el mundo. No hay nada sensible —direcciones públicas y números de
-- juguete— y así el historial por bruto se puede pintar sin pasar por la
-- función.
-- Escribir: nadie desde el navegador. Solo la Edge Function con service_role.
alter table fights enable row level security;

drop policy if exists fights_lectura on fights;
create policy fights_lectura on fights
  for select using (true);


-- ══════════════════════════════════════════════════════════════════════════
-- Resumen para el panel
-- ══════════════════════════════════════════════════════════════════════════
-- Una sola llamada en vez de diez consultas. Va como función porque hace
-- cuentas que PostgREST no expone bien.
--
-- OJO con `security definer`: hace que la función corra con los permisos de
-- quien la creó, saltándose RLS. Por eso justo debajo se le quita el permiso
-- de ejecución a anon y authenticated — si no, cualquiera con la clave pública
-- podría pedir el resumen de tu juego desde la consola.
-- Solo la Edge Function, que usa service_role, puede llamarla.
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

    -- Reparto por nivel: si todo el mundo se queda en el 2, la curva está mal.
    'por_nivel',        (select coalesce(json_agg(x order by x.level), '[]'::json)
                          from (select level, count(*) as n from brutes
                                 group by level) x),

    -- Peleas y monedas por día, para ver la tendencia.
    'por_dia',          (select coalesce(json_agg(x order by x.dia desc), '[]'::json)
                          from (select created_at::date as dia,
                                       count(*) as peleas,
                                       sum(coins) as monedas
                                  from fights
                                 where created_at >= now() - interval '14 days'
                                 group by 1) x),

    'ultimo_alta',      (select max(created_at) from players)
  );
$$;

-- Ver el aviso de supabase-08-admin.sql: revocar solo a anon y authenticated
-- no basta, porque en Postgres las funciones nacen ejecutables por PUBLIC.
revoke execute on function admin_resumen() from public;
revoke execute on function admin_resumen() from anon, authenticated;
grant  execute on function admin_resumen() to service_role;
