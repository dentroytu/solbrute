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
-- Se paga ahora y se RECLAMA despues. El comprador manda SOL, la compra queda
-- apuntada, y los tokens se entregan cuando el dueño abre los reclamos —
-- normalmente al crear el pool, para que el precio de referencia lo ponga el
-- proyecto y no el primero que reciba tokens.
--
-- ── Lo que esto exige a cambio, dicho claro ───────────────────────────────
-- Entre que alguien paga y recibe, SU DINERO ESTA EN TU WALLET Y EL NO TIENE
-- NADA. Eso es custodia y no hay forma de que no lo sea. Lo unico que se puede
-- hacer es que sea verificable a cada paso, y es lo que hace este fichero:
--
--   · la firma del pago se guarda -> comprobable en la cadena
--   · lo que se te debe esta a la vista en tu pantalla, siempre
--   · abrir los reclamos deja rastro en admin_log: quien y cuando
--   · la firma de la entrega tambien se guarda, ANTES de enviar
--
-- La alternativa —entregar en el acto— no necesita nada de esto, pero deja
-- que el primero que reciba tokens monte el mercado a su precio. Es un
-- intercambio consciente, no un descuido.
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
  -- La segunda puerta, y tambien nace cerrada. Se abre cuando exista el pool:
  -- entregar antes es justo lo que esta arquitectura evita.
  reclamos_abiertos boolean not null default false,
  actualizado     timestamptz not null default now()
);
insert into preventa (id) values (1) on conflict (id) do nothing;

create table if not exists preventa_compras (
  id          bigserial primary key,
  address     text   not null,
  tokens      bigint not null check (tokens > 0),
  lamports    bigint not null check (lamports >= 0),
  estado      text   not null default 'reservada'
              check (estado in ('reservada','pagada','entregada','caducada','cancelada')),
  -- La firma del PAGO vive aqui. La de la ENTREGA no: si alguien compro tres
  -- veces y reclama de golpe, eso es UNA transaccion con UNA firma, y no
  -- cabria en tres filas con la firma marcada como unica. Por eso el reclamo
  -- tiene tabla propia y las compras apuntan a el.
  firma       text unique,          -- el pago que hizo el comprador
  reclamo_id  bigint,               -- el reclamo que la entrego (ver abajo)
  creado      timestamptz not null default now(),
  caduca      timestamptz not null,
  confirmado  timestamptz,
  entregado   timestamptz
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
    'hasta',    p.hasta,
    'reclamos', p.reclamos_abiertos)
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
  values (p_address, p_tokens, v_lam, now() + interval '15 minutes')
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

  -- Una reserva CADUCADA tambien se confirma, y esto no es laxitud.
  --
  -- El comprador firma su pago dentro de la ventana, pero la transaccion tarda
  -- en confirmarse. Firmar en el minuto 14:50 y que la red la asiente en el
  -- 15:05 es normal. Si aqui se rechazara, ese SOL ya salio de su wallet y
  -- llego a la nuestra: nos habriamos quedado con su dinero por quince
  -- segundos de red.
  --
  -- Y no es una puerta abierta: quien llama a esto es la Edge Function DESPUES
  -- de comprobar el pago EN LA CADENA. Si no pago, no llega hasta aqui.
  if c.estado not in ('reservada','caducada') then raise exception 'no_reservada'; end if;

  update preventa_compras
     set estado = 'pagada', firma = p_firma, confirmado = now()
   where id = p_id;

  -- El descuento de `reservado` solo si seguia contando. Una caducada ya salio
  -- de esa cuenta al caducar, y restarla otra vez descuadraria el cupo libre
  -- hacia arriba: se venderian tokens que no quedan.
  update preventa
     set vendido   = vendido + c.tokens,
         reservado = case when c.estado = 'reservada'
                          then greatest(0, reservado - c.tokens) else reservado end,
         actualizado = now()
   where id = 1;

  return json_build_object('ya', false, 'tokens', c.tokens, 'lamports', c.lamports);
end;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- EL RECLAMO
-- ══════════════════════════════════════════════════════════════════════════
-- Mismo orden que la retirada, y por el mismo motivo:
--
--     1. abrir     toma las compras pagadas y las deja en vuelo   (atomico)
--     2. firmar    GUARDA la firma                                ANTES de enviar
--     3. enviar    a la red
--     4. cerrar    marca entregada
--
-- El fallo clasico es mandar los tokens, caerse antes de apuntarlo, y al
-- reintentar mandarlos otra vez. En Solana la firma se puede calcular antes de
-- enviar, asi que se apunta en el paso 2: si algo se rompe despues, la firma
-- esta guardada y se puede ir a mirar a la cadena si llego. No hay que
-- adivinar.
create table if not exists preventa_reclamos (
  id        bigserial primary key,
  address   text   not null,
  tokens    bigint not null check (tokens > 0),
  estado    text   not null default 'abierto'
            check (estado in ('abierto','enviado','fallido','revision')),
  firma     text unique,          -- unica: un reintento no reclama el mismo envio
  creado    timestamptz not null default now(),
  cerrado   timestamptz
);
create index if not exists preventa_rec_idx on preventa_reclamos(address, creado desc);
alter table preventa_reclamos enable row level security;


-- Lo que un comprador tiene y en que estado. Es lo que se le enseña.
create or replace function preventa_mias(p_address text)
returns json
language sql
security definer
as $$
  select json_build_object(
    'pagado',    coalesce((select sum(tokens) from preventa_compras
                            where address = p_address and estado = 'pagada'), 0),
    'entregado', coalesce((select sum(tokens) from preventa_compras
                            where address = p_address and estado = 'entregada'), 0),
    'lamports',  coalesce((select sum(lamports) from preventa_compras
                            where address = p_address and estado in ('pagada','entregada')), 0),
    'compras',   coalesce((select json_agg(x order by x.creado desc) from (
                    select id, tokens, lamports, estado, firma, creado
                      from preventa_compras
                     where address = p_address and estado in ('pagada','entregada')
                     limit 50) x), '[]'::json));
$$;


create or replace function preventa_reclamar_abrir(p_address text)
returns json
language plpgsql
security definer
as $$
declare
  v_abierto boolean;
  v_tokens  bigint;
  v_id      bigint;
  v_mint    text;
begin
  select reclamos_abiertos, mint into v_abierto, v_mint from preventa where id = 1;
  if not coalesce(v_abierto, false) then raise exception 'reclamos_cerrados'; end if;

  -- Si ya hay uno en vuelo no se abre otro: dos reclamos abiertos a la vez son
  -- dos transacciones por los mismos tokens.
  if exists (select 1 from preventa_reclamos
              where address = p_address and estado in ('abierto','revision')) then
    raise exception 'reclamo_en_curso';
  end if;

  select coalesce(sum(tokens), 0) into v_tokens
    from preventa_compras where address = p_address and estado = 'pagada' for update;
  if v_tokens <= 0 then raise exception 'nada_que_reclamar'; end if;

  insert into preventa_reclamos (address, tokens) values (p_address, v_tokens)
  returning id into v_id;

  update preventa_compras set reclamo_id = v_id
   where address = p_address and estado = 'pagada';

  return json_build_object('id', v_id, 'tokens', v_tokens, 'mint', v_mint);
end;
$$;


create or replace function preventa_reclamar_firmar(p_id bigint, p_firma text)
returns json
language plpgsql
security definer
as $$
begin
  if p_firma is null or length(p_firma) < 32 then raise exception 'firma_invalida'; end if;
  update preventa_reclamos set firma = p_firma
   where id = p_id and estado = 'abierto' and firma is null;
  if not found then raise exception 'no_abierto'; end if;
  return json_build_object('ok', true);
end;
$$;


-- Solo despues de que la red la haya aceptado. Marca las compras como
-- entregadas: a partir de aqui ese comprador ya no tiene nada pendiente.
create or replace function preventa_reclamar_cerrar(p_id bigint, p_estado text)
returns json
language plpgsql
security definer
as $$
declare r preventa_reclamos%rowtype;
begin
  if p_estado not in ('enviado','fallido','revision') then raise exception 'estado_invalido'; end if;
  select * into r from preventa_reclamos where id = p_id for update;
  if not found then raise exception 'no_existe'; end if;

  update preventa_reclamos set estado = p_estado, cerrado = now() where id = p_id;

  if p_estado = 'enviado' then
    update preventa_compras set estado = 'entregada', entregado = now()
     where reclamo_id = p_id and estado = 'pagada';
  else
    -- No llego: las compras vuelven a estar pendientes para reintentar. NO se
    -- devuelve el SOL solo: «fallo el envio» y «llego y no vi la confirmacion»
    -- se parecen demasiado desde el servidor, y devolver a ciegas es como
    -- alguien cobra dos veces.
    update preventa_compras set reclamo_id = null
     where reclamo_id = p_id and estado = 'pagada';
  end if;

  return json_build_object('estado', p_estado, 'tokens', r.tokens);
end;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- CONFIGURAR (solo el panel)
-- ══════════════════════════════════════════════════════════════════════════
-- Todo cambio queda en admin_log con el antes y el despues. Encender una
-- preventa es empezar a aceptar dinero de gente: tiene que quedar rastro de
-- quien la encendio, cuando, y con que precio.
-- OJO: en Postgres, anadir un parametro NO reemplaza la funcion, crea otra. La
-- version de dos parametros hay que tirarla a mano o quedan las dos, y PostgREST
-- puede acabar llamando a la vieja.
--
-- Nacio con dos y le faltaba `admin`, que en `admin_log` es NOT NULL: el insert
-- de auditoria reventaba y se llevaba por delante el guardado entero. El sintoma
-- era «algo ha fallado en el servidor» al pulsar Guardar, sin decir por que.
--
-- Y arreglarlo pasandole un '?' habria sido peor que el fallo: un registro de
-- auditoria que no dice QUIEN no es auditoria. Con un token de por medio, el
-- primer sospechoso de un precio raro es siempre quien tiene el panel.
drop function if exists preventa_config(jsonb, text);

create or replace function preventa_config(p_admin text, p_campos jsonb, p_motivo text)
returns json
language plpgsql
security definer
as $$
declare
  v_antes preventa%rowtype;
  v_val   jsonb;
begin
  if p_motivo is null or length(btrim(p_motivo)) < 10 then raise exception 'motivo_corto'; end if;
  if p_admin is null or length(btrim(p_admin)) = 0 then raise exception 'sin_admin'; end if;
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
    reclamos_abiertos = coalesce((p_campos->>'reclamos_abiertos')::boolean, reclamos_abiertos),
    actualizado     = now()
  where id = 1;

  select to_jsonb(p.*) into v_val from preventa p where p.id = 1;
  insert into admin_log (admin, accion, objetivo, antes, despues)
  values (p_admin, 'preventa_config', 'preventa', to_jsonb(v_antes),
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
revoke execute on function preventa_config(text, jsonb, text) from public, anon, authenticated;
grant  execute on function preventa_estado()                  to service_role;
grant  execute on function preventa_reservar(text, bigint)    to service_role;
grant  execute on function preventa_confirmar(bigint, text)   to service_role;
grant  execute on function preventa_config(text, jsonb, text) to service_role;

revoke execute on function preventa_mias(text)                    from public, anon, authenticated;
revoke execute on function preventa_reclamar_abrir(text)          from public, anon, authenticated;
revoke execute on function preventa_reclamar_firmar(bigint, text) from public, anon, authenticated;
revoke execute on function preventa_reclamar_cerrar(bigint, text) from public, anon, authenticated;
grant  execute on function preventa_mias(text)                    to service_role;
grant  execute on function preventa_reclamar_abrir(text)          to service_role;
grant  execute on function preventa_reclamar_firmar(bigint, text) to service_role;
grant  execute on function preventa_reclamar_cerrar(bigint, text) to service_role;


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
