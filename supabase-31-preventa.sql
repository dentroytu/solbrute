-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 31 — la preventa
-- ══════════════════════════════════════════════════════════════════════════
-- Supabase → SQL Editor → New query → pegar → Run. Repetible.
--
-- NACE APAGADA. `activa = false`, y no se enciende desde el codigo: se
-- enciende desde el panel, a mano, cuando el dueño decida. Mientras este
-- apagada la landing no enseña nada.
--
-- ── Como funciona la compra ───────────────────────────────────────────────
-- UNA transaccion con DOS firmas. El servidor la construye con las dos
-- instrucciones dentro —el SOL del comprador hacia la wallet de preventa, y
-- los tokens de esa wallet hacia el comprador—, la firma por su parte, y el
-- navegador la firma por la del comprador.
--
-- O pasan las dos cosas o no pasa ninguna. Sin custodia, sin lista de espera,
-- y sin que nadie tenga que fiarse de que el equipo entregue despues.
--
-- ── Por que hay que RESERVAR antes de firmar ──────────────────────────────
-- Entre que se construye la transaccion y el comprador la firma pasan
-- segundos, y en esos segundos otro puede llevarse el cupo. Si no se reserva,
-- dos personas firman transacciones validas por los mismos tokens y la
-- segunda falla en la cadena — habiendo pagado la comision de red.
--
-- Asi que se reserva primero (con `for update`), se firma despues, y la
-- reserva caduca sola si no se confirma.
--
-- ── El tope por wallet no es contra ballenas ──────────────────────────────
-- Es contra que UNA persona se lleve el cupo entero y luego decida ella sola
-- el precio del token vendiendolo. Con 5.000.000 en preventa y un tope de
-- 250.000, hacen falta 20 compradores como minimo. Eso no impide que alguien
-- use varias wallets, pero le obliga a molestarse.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists preventa (
  id              int primary key default 1 check (id = 1),

  activa          boolean not null default false,   -- NACE APAGADA
  -- El precio va en lamports por token, no en dolares: lo que se firma es una
  -- transferencia de SOL. El dolar es una consecuencia del precio del SOL, no
  -- algo que podamos fijar.
  precio_lamports bigint  not null default 0,
  cupo_total      bigint  not null default 0,       -- tokens a la venta
  vendido         bigint  not null default 0,
  reservado       bigint  not null default 0,       -- en vuelo, sin confirmar
  tope_wallet     bigint  not null default 0,       -- 0 = sin tope
  minimo          bigint  not null default 0,       -- compra minima, en tokens
  desde           timestamptz,
  hasta           timestamptz,
  wallet          text,                             -- donde llega el SOL
  mint            text,                             -- el token que se entrega
  actualizado     timestamptz not null default now()
);
insert into preventa (id) values (1) on conflict (id) do nothing;

create table if not exists preventa_compras (
  id          bigserial primary key,
  address     text   not null,
  tokens      bigint not null check (tokens > 0),
  lamports    bigint not null check (lamports >= 0),
  estado      text   not null default 'reservada'
              check (estado in ('reservada','pagada','caducada','cancelada')),
  firma       text unique,          -- unica: un envio no se puede reclamar dos veces
  creado      timestamptz not null default now(),
  caduca      timestamptz not null,
  confirmado  timestamptz
);
create index if not exists preventa_addr_idx on preventa_compras(address, creado desc);
create index if not exists preventa_res_idx  on preventa_compras(caduca)
  where estado = 'reservada';

-- Como `movimientos` y `withdrawals`: RLS activo y CERO politicas. Lo que se
-- enseña en la web sale por la Edge Function, que decide QUE se enseña.
alter table preventa         enable row level security;
alter table preventa_compras enable row level security;


-- ══════════════════════════════════════════════════════════════════════════
-- LO QUE PUEDE VER CUALQUIERA
-- ══════════════════════════════════════════════════════════════════════════
-- Sin la wallet ni el mint: eso lo pone el servidor al construir la
-- transaccion. Si viniera de aqui, bastaria con enseñar otra direccion en la
-- pantalla para que el SOL fuera a otro sitio.
create or replace function preventa_estado()
returns json
language sql
security definer
as $$
  select json_build_object(
    'activa',   p.activa and (p.desde is null or now() >= p.desde)
                          and (p.hasta is null or now() <= p.hasta),
    'precio',   p.precio_lamports,
    'cupo',     p.cupo_total,
    'vendido',  p.vendido,
    'queda',    greatest(0, p.cupo_total - p.vendido - p.reservado),
    'tope',     p.tope_wallet,
    'minimo',   p.minimo,
    'desde',    p.desde,
    'hasta',    p.hasta)
  from preventa p where p.id = 1;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- RESERVAR
-- ══════════════════════════════════════════════════════════════════════════
-- Antes de construir nada. Devuelve el id y lo que hay que pagar; si algo no
-- cuadra, lanza y no se construye ninguna transaccion.
create or replace function preventa_reservar(p_address text, p_tokens bigint)
returns json
language plpgsql
security definer
as $$
declare
  pv     preventa%rowtype;
  v_suyo bigint;
  v_lam  bigint;
  v_id   bigint;
begin
  select * into pv from preventa where id = 1 for update;
  if not found then raise exception 'sin_preventa'; end if;

  -- Antes de nada, soltar lo que quedo en vuelo y nunca se pago. Se hace aqui
  -- y no en una tarea aparte para que el cupo no se quede bloqueado por
  -- reservas muertas si nadie ejecuta la limpieza.
  update preventa_compras set estado = 'caducada'
   where estado = 'reservada' and caduca < now();
  select coalesce(sum(tokens), 0) into v_lam
    from preventa_compras where estado = 'reservada';
  update preventa set reservado = v_lam where id = 1;
  select * into pv from preventa where id = 1;

  if not pv.activa then raise exception 'cerrada'; end if;
  if pv.desde is not null and now() < pv.desde then raise exception 'no_empezada'; end if;
  if pv.hasta is not null and now() > pv.hasta then raise exception 'terminada'; end if;
  if p_tokens is null or p_tokens <= 0 then raise exception 'cantidad_invalida'; end if;
  if pv.minimo > 0 and p_tokens < pv.minimo then
    raise exception 'minimo:%', pv.minimo;
  end if;

  if p_tokens > pv.cupo_total - pv.vendido - pv.reservado then
    raise exception 'sin_cupo:%', greatest(0, pv.cupo_total - pv.vendido - pv.reservado);
  end if;

  if pv.tope_wallet > 0 then
    select coalesce(sum(tokens), 0) into v_suyo from preventa_compras
     where address = p_address and estado in ('reservada','pagada');
    if v_suyo + p_tokens > pv.tope_wallet then
      raise exception 'tope_wallet:%', pv.tope_wallet;
    end if;
  end if;

  v_lam := p_tokens * pv.precio_lamports;

  insert into preventa_compras (address, tokens, lamports, caduca)
  values (p_address, p_tokens, v_lam, now() + interval '3 minutes')
  returning id into v_id;

  update preventa set reservado = reservado + p_tokens, actualizado = now() where id = 1;

  return json_build_object('id', v_id, 'tokens', p_tokens, 'lamports', v_lam,
                           'wallet', pv.wallet, 'mint', pv.mint);
end;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- CONFIRMAR
-- ══════════════════════════════════════════════════════════════════════════
-- Con la firma de la transaccion ya enviada. La firma es UNICA en la tabla,
-- asi que un reintento no puede reclamar el mismo envio dos veces.
create or replace function preventa_confirmar(p_id bigint, p_firma text)
returns json
language plpgsql
security definer
as $$
declare c preventa_compras%rowtype;
begin
  if p_firma is null or length(p_firma) < 32 then raise exception 'firma_invalida'; end if;

  select * into c from preventa_compras where id = p_id for update;
  if not found            then raise exception 'no_existe';   end if;
  if c.estado = 'pagada'  then return json_build_object('ya', true, 'tokens', c.tokens); end if;
  if c.estado <> 'reservada' then raise exception 'no_reservada'; end if;

  update preventa_compras
     set estado = 'pagada', firma = p_firma, confirmado = now()
   where id = p_id;

  update preventa
     set vendido   = vendido + c.tokens,
         reservado = greatest(0, reservado - c.tokens),
         actualizado = now()
   where id = 1;

  return json_build_object('ya', false, 'tokens', c.tokens, 'lamports', c.lamports);
end;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- CONFIGURAR (solo el panel)
-- ══════════════════════════════════════════════════════════════════════════
-- Todo cambio queda en admin_log con el antes y el despues. Encender una
-- preventa es empezar a aceptar dinero de gente: tiene que quedar rastro de
-- quien la encendio, cuando, y con que precio.
create or replace function preventa_config(p_campos jsonb, p_motivo text)
returns json
language plpgsql
security definer
as $$
declare
  v_antes preventa%rowtype;
  v_val   jsonb;
begin
  if p_motivo is null or length(btrim(p_motivo)) < 10 then raise exception 'motivo_corto'; end if;
  select * into v_antes from preventa where id = 1 for update;

  update preventa set
    activa          = coalesce((p_campos->>'activa')::boolean,        activa),
    precio_lamports = coalesce((p_campos->>'precio_lamports')::bigint, precio_lamports),
    cupo_total      = coalesce((p_campos->>'cupo_total')::bigint,      cupo_total),
    tope_wallet     = coalesce((p_campos->>'tope_wallet')::bigint,     tope_wallet),
    minimo          = coalesce((p_campos->>'minimo')::bigint,          minimo),
    desde           = coalesce((p_campos->>'desde')::timestamptz,      desde),
    hasta           = coalesce((p_campos->>'hasta')::timestamptz,      hasta),
    wallet          = coalesce( p_campos->>'wallet',                   wallet),
    mint            = coalesce( p_campos->>'mint',                     mint),
    actualizado     = now()
  where id = 1;

  select to_jsonb(p.*) into v_val from preventa p where p.id = 1;
  insert into admin_log (accion, objetivo, antes, despues)
  values ('preventa_config', 'preventa', to_jsonb(v_antes),
          v_val || jsonb_build_object('motivo', p_motivo));

  return v_val;
end;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- LA TRAMPA DE SIEMPRE
-- ══════════════════════════════════════════════════════════════════════════
-- `preventa_estado` es la unica que podria abrirse, y aun asi NO se abre: que
-- lo sirva la Edge Function permite apagar la preventa sin depender de que el
-- navegador haga caso.
revoke execute on function preventa_estado()                  from public, anon, authenticated;
revoke execute on function preventa_reservar(text, bigint)    from public, anon, authenticated;
revoke execute on function preventa_confirmar(bigint, text)   from public, anon, authenticated;
revoke execute on function preventa_config(jsonb, text)       from public, anon, authenticated;
grant  execute on function preventa_estado()                  to service_role;
grant  execute on function preventa_reservar(text, bigint)    to service_role;
grant  execute on function preventa_confirmar(bigint, text)   to service_role;
grant  execute on function preventa_config(jsonb, text)       to service_role;


-- ══════════════════════════════════════════════════════════════════════════
-- Comprobacion — cero filas, y la preventa APAGADA
-- ══════════════════════════════════════════════════════════════════════════
select p.proname as abierta_de_mas
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname like 'preventa%'
   and (has_function_privilege('anon',   p.oid, 'execute')
     or has_function_privilege('public', p.oid, 'execute'));

select activa, precio_lamports, cupo_total, vendido, tope_wallet, wallet, mint
  from preventa where id = 1;
