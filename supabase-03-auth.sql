-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 3 — tabla de nonces para el login con firma
-- ══════════════════════════════════════════════════════════════════════════
-- Supabase → SQL Editor → New query → pegar → Run. Repetible sin romper nada.
--
-- Esto NO cierra todavía ningún agujero: solo prepara el terreno. El cierre es
-- supabase-04-cerrar.sql, que va al final, cuando el login ya funcione. Si se
-- aplicara antes, el juego dejaría de funcionar para todo el mundo mientras
-- tanto.
--
-- ── Qué es un nonce y por qué hace falta ──────────────────────────────────
-- Es un número de un solo uso. El servidor te lo da, tú lo metes dentro del
-- mensaje que firmas, y al verificar el servidor comprueba que ese número
-- existía, que lo dio él, y lo tacha para que no valga otra vez.
--
-- Sin nonce, una firma capturada serviría para siempre: cualquiera que la
-- viera —en un log, en un historial, en una extensión curiosa— podría
-- reenviarla y entrar como tú. Es lo que se llama un ataque de repetición.
--
-- Que lo genere el navegador, como hasta ahora, no vale para nada: quien se
-- inventa el número puede inventarse también todo lo demás.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists auth_nonces (
  nonce      text primary key,
  address    text not null,
  expires_at timestamptz not null,
  used       boolean not null default false,
  created_at timestamptz not null default now()
);

-- Para el barrido de caducados.
create index if not exists auth_nonces_exp_idx on auth_nonces(expires_at);


-- ══════════════════════════════════════════════════════════════════════════
-- Nadie toca esta tabla desde el navegador. Nunca.
-- ══════════════════════════════════════════════════════════════════════════
-- RLS activado y CERO políticas. En Postgres eso significa denegar todo: sin
-- política que lo permita, no hay acceso.
--
-- La Edge Function entra con la clave service_role, que se salta RLS por
-- diseño. Es el único sitio del sistema que puede leer y escribir aquí, y por
-- eso esa clave vive solo en el servidor y jamás en el HTML.
--
-- Si el navegador pudiera leer esta tabla, vería los nonces de los demás y el
-- mecanismo entero dejaría de servir.
-- ══════════════════════════════════════════════════════════════════════════

alter table auth_nonces enable row level security;

drop policy if exists nonces_nada on auth_nonces;
-- (sin políticas a propósito: RLS activo y sin permisos = denegado a todos)


-- ══════════════════════════════════════════════════════════════════════════
-- Limpieza de caducados
-- ══════════════════════════════════════════════════════════════════════════
-- Los nonces viven 5 minutos. Sin barrido, la tabla crece para siempre con
-- basura. No hace falta un cron: la propia función de login borra lo viejo
-- cada vez que reparte uno nuevo, que es el mismo truco que la recarga diaria
-- de peleas.
--
-- Esta función queda aquí por si algún día quieres barrer a mano.
create or replace function limpiar_nonces() returns integer
language sql security definer as $$
  with borrados as (
    delete from auth_nonces
     where expires_at < now() - interval '1 hour'
     returning 1
  ) select count(*)::integer from borrados;
$$;
