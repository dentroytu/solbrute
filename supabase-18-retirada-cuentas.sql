-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 18 — la retirada: la contabilidad
-- ══════════════════════════════════════════════════════════════════════════
-- Supabase → SQL Editor → New query → pegar → Run. Repetible.
--
--   ⚠️  Este es el fichero más delicado del proyecto. Todo lo demás protege un
--       número en Postgres; a partir de aquí ese número se convierte en dinero
--       y un fallo deja de ser un bruto con trampas para ser dinero robado.
--
-- Aquí va SOLO la contabilidad: los topes, reservar el saldo, la fila y el
-- estado. El envío on-chain se enchufa aparte, y por eso esto se puede atacar
-- ya, sin token y sin SOL.
--
-- ── El orden, que es lo único que impide cobrar dos veces ─────────────────
--
--   1. reservar el saldo y crear la fila       ← `retirada_abrir`   (atómico)
--   2. construir y firmar la transacción       → ya existe la firma
--   3. GUARDAR la firma                        ← `retirada_firmar`  ANTES de mandar
--   4. mandarla a la red
--   5. confirmar                               ← `retirada_confirmar`
--
-- El fallo clásico es mandar los tokens, caerse antes de apuntarlo, y al
-- reintentar mandarlos otra vez. En Solana la firma de una transacción se
-- puede calcular ANTES de mandarla, así que se apunta en el paso 3: si algo se
-- rompe después, la firma está guardada y siempre se puede ir a la cadena a
-- mirar si llegó. No hay que adivinar.
--
-- ── Y por qué un fallo NO devuelve el saldo solo ──────────────────────────
--
-- Porque «falló el envío» y «llegó pero no vi la confirmación» se parecen
-- demasiado desde aquí. Devolver el saldo automáticamente es exactamente cómo
-- alguien cobra dos veces: una en tokens, otra en saldo.
--
-- Queda en `fallida` con su firma, se mira la cadena, y si de verdad no llegó
-- se devuelve a mano con `retirada_devolver`, que deja rastro en `admin_log`.
-- ══════════════════════════════════════════════════════════════════════════


-- ── El mínimo, que no es un capricho ──────────────────────────────────────
-- Cada envío cuesta una comisión de red que paga EL TESORO, no el jugador.
-- Sin mínimo, mil retiradas de 1 moneda vacían el SOL del tesoro sin que nadie
-- haya retirado nada apreciable. Es un ataque barato y silencioso.
alter table economia add column if not exists minimo_retirada bigint not null default 100;

-- Cuántos $BRUTE son una moneda del juego. 1:1 de partida, pero en columna
-- para poder cambiarlo sin redesplegar si el reparto se recalibra.
alter table economia add column if not exists tokens_por_moneda numeric(12,6) not null default 1.0;

-- Rastro del error, para poder reconciliar a mano.
alter table withdrawals add column if not exists intentos int not null default 0;


-- ══════════════════════════════════════════════════════════════════════════
-- ①  ABRIR: reservar el saldo y crear la fila
-- ══════════════════════════════════════════════════════════════════════════
-- Todo en una función con `for update`. Si el cobro y el apunte fueran dos
-- escrituras desde la Edge Function, un fallo entre ellas dejaría al jugador
-- pagado sin fila, o con fila sin pagar — y las dos versiones son un agujero.
--
-- Devuelve json: { id, monedas, comision, tokens }
create or replace function retirada_abrir(p_owner text, p_monedas bigint)
returns json
language plpgsql
security definer
as $$
declare
  e          record;
  v_saldo    bigint;
  v_hoy_jug  bigint;
  v_hoy_glob bigint;
  v_comision bigint;
  v_neto     bigint;
  v_tokens   bigint;
  v_id       bigint;
begin
  select * into e from economia where id = 1 for update;
  if not found then raise exception 'economia sin configurar'; end if;

  -- El interruptor de pánico, lo primero. Vive en la BASE DE DATOS y no en el
  -- código para poder cerrarlo en caliente: un tope que exige redesplegar es
  -- un tope que llega tarde.
  if not e.retiradas_abiertas then
    raise exception 'retiradas_cerradas';
  end if;

  if p_monedas is null or p_monedas <= 0 then
    raise exception 'cantidad_invalida';
  end if;
  if p_monedas < e.minimo_retirada then
    raise exception 'minimo:%', e.minimo_retirada;
  end if;

  select coins into v_saldo from players where address = p_owner for update;
  if not found then raise exception 'jugador desconocido'; end if;
  if v_saldo < p_monedas then
    raise exception 'sin_saldo';
  end if;

  -- ── Los topes ──
  -- Cuentan lo PENDIENTE además de lo enviado: si solo contaran lo enviado,
  -- se podrían abrir cien retiradas a la vez y saltarse el tope entero
  -- mientras ninguna ha terminado todavía.
  select coalesce(sum(monedas), 0) into v_hoy_jug
    from withdrawals
   where address = p_owner and estado in ('pendiente','enviada')
     and created_at >= (now() at time zone 'utc')::date;
  if v_hoy_jug + p_monedas > e.tope_jugador_dia then
    raise exception 'tope_jugador:%', e.tope_jugador_dia;
  end if;

  select coalesce(sum(monedas), 0) into v_hoy_glob
    from withdrawals
   where estado in ('pendiente','enviada')
     and created_at >= (now() at time zone 'utc')::date;
  if v_hoy_glob + p_monedas > e.tope_global_dia then
    raise exception 'tope_global';
  end if;

  -- ── El reparto ──
  -- La comisión vuelve ENTERA a la reserva, no a la tesorería. Si se la queda
  -- el equipo es una tarifa; si vuelve al reparto, es un mecanismo. Y sube el
  -- techo igual que el reciclaje, así que se acota para no desbordarla.
  v_comision := (p_monedas * greatest(least(e.comision_pct, 100), 0)) / 100;
  v_neto     := p_monedas - v_comision;
  v_tokens   := floor(v_neto * e.tokens_por_moneda)::bigint;

  if v_tokens <= 0 then raise exception 'cantidad_invalida'; end if;

  update players set coins = coins - p_monedas where address = p_owner;

  update economia
     set reserva_restante = least(reserva_restante + v_comision, reserva_total),
         retirado_total   = retirado_total + v_tokens,
         actualizado = now()
   where id = 1;

  insert into withdrawals (address, monedas, comision, tokens, red, estado)
  values (p_owner, p_monedas, v_comision, v_tokens, e.red, 'pendiente')
  returning id into v_id;

  return json_build_object('id', v_id, 'monedas', p_monedas,
                           'comision', v_comision, 'tokens', v_tokens,
                           'red', e.red, 'saldo', v_saldo - p_monedas);
end;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- ②  FIRMAR: apuntar la firma ANTES de mandar nada a la red
-- ══════════════════════════════════════════════════════════════════════════
-- El índice único de `withdrawals.firma` es lo que hace esto valioso: si la
-- misma firma se intentara apuntar dos veces, Postgres lo rechaza. Sin él, un
-- reintento reclama el mismo envío otra vez.
create or replace function retirada_firmar(p_id bigint, p_firma text)
returns void
language plpgsql
security definer
as $$
begin
  if p_firma is null or length(p_firma) < 32 then
    raise exception 'firma no válida';
  end if;
  update withdrawals
     set firma = p_firma, intentos = intentos + 1
   where id = p_id and estado = 'pendiente';
  if not found then
    raise exception 'esa retirada no está pendiente';
  end if;
end;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- ③  CERRAR: enviada o fallida
-- ══════════════════════════════════════════════════════════════════════════
-- `fallida` NO devuelve el saldo. Ver la cabecera: devolverlo a ciegas es cómo
-- se cobra dos veces cuando la transacción sí llegó.
create or replace function retirada_cerrar(p_id bigint, p_ok boolean, p_error text default null)
returns void
language sql
security definer
as $$
  update withdrawals
     set estado = case when p_ok then 'enviada' else 'fallida' end,
         error  = case when p_ok then null else left(coalesce(p_error, ''), 300) end
   where id = p_id and estado = 'pendiente';
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- ④  DEVOLVER a mano, con motivo y rastro
-- ══════════════════════════════════════════════════════════════════════════
-- Solo después de MIRAR LA CADENA y comprobar que esa firma no llegó nunca.
-- Por eso pide la firma revisada: obliga a haber mirado.
create or replace function retirada_devolver(p_admin text, p_id bigint, p_motivo text)
returns json
language plpgsql
security definer
as $$
declare w record;
begin
  if p_motivo is null or length(btrim(p_motivo)) < 10 then
    raise exception 'hace falta un motivo de al menos 10 caracteres';
  end if;

  select * into w from withdrawals where id = p_id for update;
  if not found then raise exception 'retirada desconocida'; end if;
  if w.estado = 'devuelta' then raise exception 'ya estaba devuelta'; end if;
  if w.estado = 'enviada'  then raise exception 'esa retirada SI se envio; mira la cadena'; end if;

  update players  set coins = coins + w.monedas where address = w.address;
  update economia set reserva_restante = greatest(reserva_restante - w.comision, 0),
                      retirado_total   = greatest(retirado_total - w.tokens, 0),
                      actualizado = now()
   where id = 1;
  update withdrawals set estado = 'devuelta' where id = p_id;

  insert into admin_log (admin, accion, objetivo, antes, despues)
  values (coalesce(p_admin,'?'), 'retirada_devolver', btrim(p_motivo),
          to_jsonb(w), json_build_object('estado','devuelta','monedas_repuestas', w.monedas));

  return json_build_object('devuelto', w.monedas, 'a', w.address);
end;
$$;

-- El estado nuevo tiene que ser legal.
alter table withdrawals drop constraint if exists withdrawals_estado_valido;
alter table withdrawals add  constraint withdrawals_estado_valido
  check (estado in ('pendiente','enviada','fallida','devuelta'));


-- ══════════════════════════════════════════════════════════════════════════
-- ⑤  Lo que el jugador puede ver de lo suyo
-- ══════════════════════════════════════════════════════════════════════════
-- La dirección la pone la Edge Function desde el token de sesión, nunca el
-- navegador. Igual que `historial_de`.
create or replace function retiradas_de(p_address text, p_limite int default 20)
returns json
language sql
security definer
as $$
  select coalesce(json_agg(x order by x.created_at desc), '[]'::json)
    from (select id, monedas, comision, tokens, red, estado, firma, error, created_at
            from withdrawals where address = p_address
           order by created_at desc
           limit greatest(least(coalesce(p_limite,20),100),1)) x;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- LA TRAMPA DE SIEMPRE — y aquí es la peor de todas
-- ══════════════════════════════════════════════════════════════════════════
-- `retirada_abrir` abierta a `public` es literalmente regalar el tesoro: se
-- llama con la clave anon, se pone la dirección que quieras y se retira.
revoke execute on function retirada_abrir(text, bigint)        from public;
revoke execute on function retirada_abrir(text, bigint)        from anon, authenticated;
grant  execute on function retirada_abrir(text, bigint)        to service_role;

revoke execute on function retirada_firmar(bigint, text)       from public;
revoke execute on function retirada_firmar(bigint, text)       from anon, authenticated;
grant  execute on function retirada_firmar(bigint, text)       to service_role;

revoke execute on function retirada_cerrar(bigint, boolean, text) from public;
revoke execute on function retirada_cerrar(bigint, boolean, text) from anon, authenticated;
grant  execute on function retirada_cerrar(bigint, boolean, text) to service_role;

revoke execute on function retirada_devolver(text, bigint, text) from public;
revoke execute on function retirada_devolver(text, bigint, text) from anon, authenticated;
grant  execute on function retirada_devolver(text, bigint, text) to service_role;

revoke execute on function retiradas_de(text, int)             from public;
revoke execute on function retiradas_de(text, int)             from anon, authenticated;
grant  execute on function retiradas_de(text, int)             to service_role;


-- ══════════════════════════════════════════════════════════════════════════
-- Comprobación
-- ══════════════════════════════════════════════════════════════════════════
-- 1) Cero filas. Si sale alguna, cierra la puerta antes de seguir.
select p.proname as funcion_abierta
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('retirada_abrir','retirada_firmar','retirada_cerrar',
                     'retirada_devolver','retiradas_de')
   and (has_function_privilege('anon',   p.oid, 'execute')
     or has_function_privilege('public', p.oid, 'execute'));

-- 2) La puerta sigue CERRADA. Se abre a mano cuando exista el token y la
--    retirada esté probada de punta a punta — no antes.
select retiradas_abiertas, red, minimo_retirada, comision_pct,
       tope_jugador_dia, tope_global_dia, tokens_por_moneda
  from economia where id = 1;
