-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 9 — armas
-- ══════════════════════════════════════════════════════════════════════════
-- Supabase → SQL Editor → New query → pegar → Run. Repetible.
--
-- Dos columnas en `brutes`:
--
--   arma   la que lleva puesta ahora. "ninguna" son los puños, que no son un
--          arma sino no llevar ninguna — y están equilibrados a propósito para
--          que no llevar nada siga siendo jugable.
--
--   armas  lo que tiene guardado, una lista de identificadores.
--
-- ── Por qué esto vive en el servidor ──────────────────────────────────────
-- Si el inventario lo llevara el navegador, todo el mundo tendría todas las
-- armas en cinco minutos. Las armas caen al subir de nivel (20% de las veces)
-- y se rompen solas, y las dos cosas las decide la Edge Function.
--
-- ── Y por qué el arma no da más monedas ───────────────────────────────────
-- Porque la recompensa es `12 + turnos`: ganar rápido paga MENOS. Medido, un
-- bruto con mandoble gana más peleas y cobra menos al día que el mismo bruto
-- a puño limpio. Lo que sube los ingresos es el nivel, y eso se juega.
-- ══════════════════════════════════════════════════════════════════════════

alter table brutes add column if not exists arma  text  not null default 'ninguna';
alter table brutes add column if not exists armas jsonb not null default '[]'::jsonb;

-- Solo identificadores que existen. Si algún día añades un arma nueva, hay que
-- añadirla aquí también — molesto a propósito: una restricción que se olvida
-- es una restricción que no protege.
alter table brutes drop constraint if exists brutes_arma_valida;
alter table brutes add  constraint brutes_arma_valida
  check (arma in ('ninguna','daga','mandoble','lanza','escudo'));

-- Cuántos brutos llevan cada arma. Útil en el panel para ver si alguna se ha
-- vuelto la favorita de todos: si pasa, es que ha dejado de ser una alternativa.
create or replace function admin_armas()
returns json language sql security definer as $$
  select coalesce(json_agg(x order by x.n desc), '[]'::json)
    from (select arma, count(*) as n from brutes group by arma) x;
$$;

-- La misma trampa de siempre: en Postgres las funciones nacen ejecutables por
-- PUBLIC, y revocar solo a anon no basta.
revoke execute on function admin_armas() from public;
revoke execute on function admin_armas() from anon, authenticated;
grant  execute on function admin_armas() to service_role;
