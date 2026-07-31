-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 5 — sesiones propias
-- ══════════════════════════════════════════════════════════════════════════
-- Supabase → SQL Editor → New query → pegar → Run. Repetible sin romper nada.
--
-- Sustituye a la idea del JWT. Este proyecto migró a claves de firma
-- asimétricas (ECC P-256), y esa clave privada la gestiona Supabase y no la
-- entrega: es imposible emitir un token que su API acepte. El secreto legacy
-- solo verifica, y está marcado para revocación.
--
-- Así que no dependemos de sus tokens. Emitimos los nuestros:
--
--   1. Firmas con la wallet → la función comprueba la firma
--   2. La función crea aquí una fila con un token aleatorio
--   3. El navegador manda ese token en cada escritura
--   4. La función lo busca aquí, ve de quién es, y escribe por ti
--
-- El navegador deja de escribir en la base de datos. Ni con el token: el token
-- no le sirve para hablar con Postgres, solo con la función.
--
-- Esto es más fuerte que el plan del JWT. Con aquel, el navegador escribía
-- directamente y las políticas le impedían tocar filas ajenas — pero podía
-- mentir libremente sobre las suyas: darse monedas, victorias o niveles. Con
-- esto el servidor es el que decide qué se escribe.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists sessions (
  token      text primary key,           -- aleatorio, 32 bytes en base64url
  address    text not null,              -- de quién es esta sesión
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists sessions_address_idx on sessions(address);
create index if not exists sessions_exp_idx     on sessions(expires_at);


-- ══════════════════════════════════════════════════════════════════════════
-- Igual que auth_nonces: RLS activo y CERO políticas = denegado a todos
-- ══════════════════════════════════════════════════════════════════════════
-- Si el navegador pudiera leer esta tabla, vería los tokens de los demás y
-- podría hacerse pasar por cualquiera. Solo entra la Edge Function, que usa
-- service_role y se salta RLS por diseño.
-- ══════════════════════════════════════════════════════════════════════════

alter table sessions enable row level security;


-- Barrido de sesiones caducadas, por si algún día quieres hacerlo a mano.
-- La función ya limpia sola cada vez que crea una.
create or replace function limpiar_sesiones() returns integer
language sql security definer as $$
  with borradas as (
    delete from sessions where expires_at < now() returning 1
  ) select count(*)::integer from borradas;
$$;
