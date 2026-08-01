-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 11 — retiradas de token
-- ══════════════════════════════════════════════════════════════════════════
-- Supabase → SQL Editor → New query → pegar → Run. Repetible.
--
--   ⚠️  Esta es la tabla más delicada del proyecto. Todo lo asegurado hasta
--       ahora protege un número en una base de datos. A partir de aquí ese
--       número se convierte en dinero real, y un fallo deja de ser un bruto
--       con trampas para ser dinero robado.
--
-- ── Lo que NO está resuelto todavía ───────────────────────────────────────
-- El juego emite sin tope: `12 + turnos` por pelea y ya. El modelo de TOKEN.md
-- dice reserva fija con reparto diario, y eso NO está implementado. Mientras
-- no lo esté, la retirada solo debe existir en devnet.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists withdrawals (
  id         bigserial primary key,
  address    text   not null,
  monedas    bigint not null,          -- lo que se descuenta del saldo
  comision   bigint not null,          -- lo que vuelve a la reserva
  tokens     bigint not null,          -- lo que se envía on-chain
  red        text   not null,          -- 'devnet' o 'mainnet'

  -- LA FIRMA ES ÚNICA, y es lo que impide cobrar dos veces la misma retirada.
  -- Sin este índice, un reintento —o alguien pulsando dos veces— reclama el
  -- mismo envío otra vez. Ya está escrito en BACKEND.md para las plazas.
  firma      text unique,

  -- pendiente → enviada | fallida.
  -- La fila se escribe ANTES de mandar nada a la cadena. Si la función se cae
  -- a mitad, queda el rastro; al revés —enviar y luego anotar— un fallo de red
  -- deja tokens fuera sin registro, y al reintentar se envían dos veces.
  estado     text   not null default 'pendiente',
  error      text,
  created_at timestamptz not null default now()
);

create index if not exists withdrawals_addr_idx  on withdrawals(address, created_at desc);
create index if not exists withdrawals_fecha_idx on withdrawals(created_at desc);
create index if not exists withdrawals_estado_idx on withdrawals(estado) where estado = 'pendiente';

-- Ni leer ni escribir desde el navegador. Solo la Edge Function.
alter table withdrawals enable row level security;


-- ══════════════════════════════════════════════════════════════════════════
-- Estado de la economía: una sola fila
-- ══════════════════════════════════════════════════════════════════════════
-- Los topes viven en la BASE DE DATOS y no en el código de la función, para
-- poder bajarlos en caliente si algo se descontrola. Un tope que exige
-- redesplegar es un tope que llega tarde.
create table if not exists economia (
  id               int primary key default 1,
  reserva_total    bigint not null default 40000000,
  reserva_restante bigint not null default 40000000,
  retirado_total   bigint not null default 0,
  comision_pct     int    not null default 10,      -- vuelve a la reserva

  -- Topes. Si algo se rompe, que se rompa acotado.
  tope_jugador_dia bigint not null default 1000,
  tope_global_dia  bigint not null default 20000,
  retiradas_abiertas boolean not null default false, -- interruptor de pánico

  red              text   not null default 'devnet',
  actualizado      timestamptz not null default now(),
  constraint economia_una_fila check (id = 1)
);

insert into economia (id) values (1) on conflict (id) do nothing;

alter table economia enable row level security;

-- Leer sí: que el jugador vea cuánta reserva queda y qué comisión se cobra es
-- parte de ser honesto con él. Escribir, nadie desde el navegador.
drop policy if exists economia_lectura on economia;
create policy economia_lectura on economia for select using (true);


-- ══════════════════════════════════════════════════════════════════════════
-- Cuánto se ha retirado hoy, para los topes
-- ══════════════════════════════════════════════════════════════════════════
create or replace function retirado_hoy(dir text default null)
returns bigint language sql security definer as $$
  select coalesce(sum(tokens), 0)::bigint
    from withdrawals
   where estado in ('pendiente','enviada')
     and created_at >= (now() at time zone 'utc')::date
     and (dir is null or address = dir);
$$;

-- La trampa de siempre: en Postgres una función nace ejecutable por PUBLIC.
revoke execute on function retirado_hoy(text) from public;
revoke execute on function retirado_hoy(text) from anon, authenticated;
grant  execute on function retirado_hoy(text) to service_role;


-- ══════════════════════════════════════════════════════════════════════════
-- Comprobación
-- ══════════════════════════════════════════════════════════════════════════
select reserva_restante, comision_pct, tope_jugador_dia, tope_global_dia,
       retiradas_abiertas, red
  from economia;

-- retiradas_abiertas empieza en FALSE a propósito: la tabla existe pero la
-- puerta está cerrada hasta que se decida abrirla.
