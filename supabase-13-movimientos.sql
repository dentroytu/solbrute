-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 13 — historial de movimientos del jugador
-- ══════════════════════════════════════════════════════════════════════════
-- Supabase → SQL Editor → New query → pegar → Run. Repetible.
--
-- El libro de cuentas de cada jugador: qué ha comprado, qué ha retirado, y
-- cuánto le costó. Hasta ahora las monedas de un arma comprada simplemente
-- desaparecían del saldo sin dejar rastro en ningún sitio.
--
-- ── Por qué esto NO se resuelve con RLS ───────────────────────────────────
--
-- La reacción natural es "política de lectura donde address = el usuario".
-- No funciona aquí, y conviene entender por qué antes de que alguien lo
-- intente:
--
-- El navegador lee con la clave `anon`, así que para Postgres TODOS los
-- jugadores son el mismo usuario. La sesión de SolBrute es un token opaco en
-- la tabla `sessions`, no un JWT — no hay `auth.uid()` que consultar. Una
-- política de lectura no podría distinguir a un jugador de otro, y acabaría
-- enseñando el historial de todos a cualquiera.
--
-- Por eso: RLS activo y CERO políticas. Desde el navegador esta tabla no
-- existe. Se lee por la ruta `historial` de la Edge Function, que sí sabe de
-- quién es el token — el mismo patrón que usan las escrituras.
--
-- Y esa ruta IGNORA la dirección que mande el navegador. Si la aceptara,
-- bastaría con pedir el historial de otro para verlo entero.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists movimientos (
  id       bigserial primary key,
  address  text not null,

  -- 'compra_arma' | 'compra_plaza' | 'retirada' | (futuro: skin, torneo, mascota)
  tipo     text not null,

  -- Qué fue exactamente: el id del arma, el número de plaza, la red de la
  -- retirada. Se guarda como texto porque cada tipo significa algo distinto.
  concepto text not null default '',

  -- CON SIGNO: negativo lo que sale del saldo, positivo lo que entra.
  -- Así el historial se suma sin tener que saber qué significa cada tipo, y
  -- el día que haya devoluciones o premios entran sin cambiar el esquema.
  monedas  bigint not null,

  -- Contexto libre: el bruto que recibió el arma, el precio de lista, lo que
  -- haga falta. Nunca datos que el jugador pueda escribir sin filtrar.
  meta     jsonb,

  -- Apunta a `withdrawals.id` cuando el movimiento es una retirada, para
  -- poder enseñar su estado (pendiente / enviada / fallida) y su firma.
  ref      bigint,

  created_at timestamptz not null default now()
);

create index if not exists movimientos_addr_idx on movimientos(address, created_at desc);
create index if not exists movimientos_tipo_idx on movimientos(tipo, created_at desc);

-- RLS activo y CERO políticas: ni leer ni escribir desde el navegador.
-- Esto es deliberado y es lo que hace que el historial sea privado. Si algún
-- día alguien añade una política de lectura "para que el jugador vea lo suyo",
-- estará abriendo el historial de TODOS. Lee la cabecera antes de tocarlo.
alter table movimientos enable row level security;


-- ══════════════════════════════════════════════════════════════════════════
-- Apuntar un movimiento
-- ══════════════════════════════════════════════════════════════════════════
-- La llama la Edge Function con `service_role`. Existe como función y no como
-- un insert suelto para que el saneado del tipo viva en un solo sitio: un
-- `tipo` inventado ensuciaría el historial y las estadísticas del panel.
create or replace function movimiento_apuntar(
  p_address  text,
  p_tipo     text,
  p_concepto text,
  p_monedas  bigint,
  p_meta     jsonb default null,
  p_ref      bigint default null
)
returns bigint
language plpgsql
security definer
as $$
declare
  v_id bigint;
begin
  if p_address is null or length(btrim(p_address)) = 0 then
    raise exception 'movimiento sin dirección';
  end if;

  if p_tipo not in ('compra_arma','compra_plaza','retirada','skin','torneo','mascota','ajuste') then
    raise exception 'tipo de movimiento desconocido: %', p_tipo;
  end if;

  insert into movimientos (address, tipo, concepto, monedas, meta, ref)
  values (p_address, p_tipo, coalesce(left(p_concepto, 64), ''),
          coalesce(p_monedas, 0), p_meta, p_ref)
  returning id into v_id;

  return v_id;
end;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- Leer el historial de UNA dirección
-- ══════════════════════════════════════════════════════════════════════════
-- La dirección la pone la Edge Function a partir del token de sesión, NUNCA
-- el navegador. Esta función no comprueba permisos porque no puede: para eso
-- haría falta saber quién llama, y eso solo lo sabe la capa de arriba.
--
-- De ahí que el `revoke` del final sea lo único que la protege. Si quedara
-- ejecutable por `public`, cualquiera leería el historial de cualquiera
-- pasando su dirección — que es pública, va en la clasificación.
create or replace function historial_de(p_address text, p_limite int default 50)
returns json
language sql
security definer
as $$
  select coalesce(json_agg(x order by x.created_at desc), '[]'::json)
    from (
      select m.id, m.tipo, m.concepto, m.monedas, m.meta, m.created_at,
             w.estado as estado, w.firma as firma, w.red as red
        from movimientos m
        left join withdrawals w on w.id = m.ref
       where m.address = p_address
       order by m.created_at desc
       limit greatest(least(coalesce(p_limite, 50), 200), 1)
    ) x;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- LA TRAMPA DE SIEMPRE
-- ══════════════════════════════════════════════════════════════════════════
-- En Postgres una función nace ejecutable por PUBLIC, y revocar solo a `anon`
-- NO quita ese permiso. Va por la cuarta vez en este proyecto.
--
-- Aquí el daño sería directo: las direcciones de wallet son públicas —salen
-- en la clasificación— así que con `historial_de` abierta cualquiera leería
-- las compras y retiradas de cualquiera con solo copiar su dirección.
--
-- Y hay que REPETIRLO cada vez que se haga `create or replace`.
revoke execute on function movimiento_apuntar(text, text, text, bigint, jsonb, bigint) from public;
revoke execute on function movimiento_apuntar(text, text, text, bigint, jsonb, bigint) from anon, authenticated;
grant  execute on function movimiento_apuntar(text, text, text, bigint, jsonb, bigint) to service_role;

revoke execute on function historial_de(text, int) from public;
revoke execute on function historial_de(text, int) from anon, authenticated;
grant  execute on function historial_de(text, int) to service_role;


-- ══════════════════════════════════════════════════════════════════════════
-- Comprobación — lo correcto es CERO filas
-- ══════════════════════════════════════════════════════════════════════════
select p.proname as funcion_abierta
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('movimiento_apuntar','historial_de')
   and (has_function_privilege('anon',   p.oid, 'execute')
     or has_function_privilege('public', p.oid, 'execute'));
