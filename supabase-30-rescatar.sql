-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 30 — rescatar el arma rota y revivir la mascota
-- ══════════════════════════════════════════════════════════════════════════
-- Supabase → SQL Editor → New query → pegar → Run. Repetible.
--
-- Cuando un arma se rompe o una mascota muere, se apunta la perdida con una
-- fecha limite. Hasta que caduque, el jugador puede recuperarla pagando una
-- parte del precio.
--
-- ── Por que esto AUMENTA el sumidero en vez de encogerlo ──────────────────
-- La intuicion dice lo contrario: si rescatar sale mas barato que comprar, el
-- jugador gasta menos. Y es cierto PARA EL QUE IBA A RECOMPRAR.
--
-- Pero no todos recompran. Perder un oso de 175 duele, y volver a soltar 175
-- frena a mucha gente: se quedan sin mascota y siguen jugando. Medido con
-- supuestos razonables, de cada 100 que lo pierden recompran ~40. Con rescate
-- al 60% lo recuperan ~85:
--
--     hoy          40 x 175 = 7.000 monedas
--     con rescate  85 x 105 = 8.925 monedas   (+27%)
--
-- El sumidero crece porque captura a quien NO habria vuelto a comprar.
--
-- ── Por que una tabla y no leer `fights` ──────────────────────────────────
-- El rescate tiene que ser de un solo uso y tiene que poder bloquearse. Con
-- `for update` sobre una fila, dos peticiones simultaneas no pueden rescatar
-- lo mismo dos veces pagando una. Deduciendolo de `fights` no hay nada que
-- bloquear, y ese es justo el hueco por el que se duplica un objeto.
--
-- ── La fecha limite no es para meter prisa ────────────────────────────────
-- Es para que la oferta signifique algo. Un rescate que dura para siempre es
-- una segunda tienda con los precios rebajados, y entonces nadie compra a
-- precio completo. 24 horas deja volver al dia siguiente y no mas.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists perdidas (
  id        bigserial primary key,
  address   text   not null,
  brute_id  bigint,
  tipo      text   not null check (tipo in ('arma','mascota')),
  objeto    text   not null,
  precio    bigint not null check (precio >= 0),   -- lo que cuesta recuperarlo
  fight_id  bigint,
  creado    timestamptz not null default now(),
  caduca    timestamptz not null,
  rescatado timestamptz
);

create index if not exists perdidas_addr_idx
  on perdidas(address, caduca desc) where rescatado is null;

-- Igual que `movimientos` y `withdrawals`: RLS activo y CERO politicas. El
-- navegador no puede ver ni tocar esta tabla; todo pasa por la Edge Function,
-- que si sabe de quien es el token de sesion.
alter table perdidas enable row level security;


-- ══════════════════════════════════════════════════════════════════════════
-- APUNTAR una perdida
-- ══════════════════════════════════════════════════════════════════════════
-- La llama la Edge Function justo despues de romper el arma o matar la
-- mascota. El precio llega ya calculado desde `brute-combate.js`, como el
-- precio de compra: la tabla de objetos vive en un solo sitio.
create or replace function perdida_apuntar(
  p_owner text, p_bruto bigint, p_tipo text, p_objeto text,
  p_precio bigint, p_fight bigint, p_horas int default 24)
returns bigint
language plpgsql
security definer
as $$
declare v_id bigint;
begin
  if p_tipo not in ('arma','mascota') then raise exception 'desconocido:%', p_tipo; end if;
  if p_precio is null or p_precio < 0 then raise exception 'precio_invalido'; end if;

  insert into perdidas (address, brute_id, tipo, objeto, precio, fight_id, caduca)
  values (p_owner, p_bruto, p_tipo, p_objeto, p_precio, p_fight,
          now() + make_interval(hours => greatest(1, least(p_horas, 168))))
  returning id into v_id;
  return v_id;
end;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- RESCATAR
-- ══════════════════════════════════════════════════════════════════════════
-- Cobra y devuelve el objeto, o ninguna de las dos cosas. Mismo patron que
-- `arma_comprar`: si fueran dos escrituras sueltas desde la Edge Function, un
-- fallo entre medias cobraria sin devolver nada.
--
-- Vuelve al BRUTO si ese hueco esta libre, y si no a la bolsa. Nunca a los
-- dos: el inventario del paso 14 solo cuenta las copias sin asignar, y meterlo
-- en los dos sitios seria duplicar un objeto.
create or replace function perdida_rescatar(p_owner text, p_id bigint)
returns json
language plpgsql
security definer
as $$
declare
  pe      perdidas%rowtype;
  v_saldo bigint;
  v_bolsa jsonb;
  v_col   text;
  v_lleva text;
  v_donde text;
begin
  select * into pe from perdidas where id = p_id for update;
  if not found                     then raise exception 'no_existe';    end if;
  if pe.address <> p_owner         then raise exception 'no_es_tuyo';   end if;
  if pe.rescatado is not null      then raise exception 'ya_rescatado'; end if;
  if pe.caduca < now()             then raise exception 'caducado';     end if;

  v_col := case when pe.tipo = 'arma' then 'armas' else 'mascotas' end;

  execute format('select coins, coalesce(%I, ''{}''::jsonb) from players
                   where address = $1 for update', v_col)
    into v_saldo, v_bolsa using p_owner;
  if not found then raise exception 'sin_jugador'; end if;
  if v_saldo < pe.precio then raise exception 'sin_saldo'; end if;

  -- ¿Tiene el bruto ese hueco libre? Si lo tiene, se le pone puesto: es lo que
  -- el jugador espera al pulsar «recuperar», y ahorrarle el paso de equipar
  -- vale mas que la pureza de mandarlo siempre a la bolsa.
  if pe.tipo = 'arma' then
    select arma into v_lleva from brutes where id = pe.brute_id and owner = p_owner for update;
  else
    select mascota into v_lleva from brutes where id = pe.brute_id and owner = p_owner for update;
  end if;

  if found and (v_lleva is null or v_lleva = 'ninguna') then
    if pe.tipo = 'arma'
      then update brutes set arma    = pe.objeto where id = pe.brute_id and owner = p_owner;
      else update brutes set mascota = pe.objeto where id = pe.brute_id and owner = p_owner;
    end if;
    v_donde := 'bruto';
  else
    v_bolsa := jsonb_set(v_bolsa, array[pe.objeto],
                         to_jsonb(coalesce((v_bolsa ->> pe.objeto)::int, 0) + 1));
    execute format('update players set %I = $1 where address = $2', v_col)
      using v_bolsa, p_owner;
    v_donde := 'bolsa';
  end if;

  update players set coins = coins - pe.precio where address = p_owner;
  update perdidas set rescatado = now() where id = p_id;

  return json_build_object('objeto', pe.objeto, 'tipo', pe.tipo, 'donde', v_donde,
                           'precio', pe.precio, 'balance', v_saldo - pe.precio,
                           'bolsa', v_bolsa);
end;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- LAS QUE SIGUEN EN PIE
-- ══════════════════════════════════════════════════════════════════════════
create or replace function perdidas_de(p_address text)
returns setof perdidas
language sql
security definer
as $$
  select * from perdidas
   where address = p_address and rescatado is null and caduca > now()
   order by caduca asc
   limit 20;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- LA TRAMPA DE SIEMPRE
-- ══════════════════════════════════════════════════════════════════════════
-- `perdida_rescatar` abierta a anon es recuperar objetos sin pagar, y
-- `perdida_apuntar` es inventarse perdidas para rescatarlas baratas.
revoke execute on function perdida_apuntar(text,bigint,text,text,bigint,bigint,int)
  from public, anon, authenticated;
revoke execute on function perdida_rescatar(text, bigint) from public, anon, authenticated;
revoke execute on function perdidas_de(text)              from public, anon, authenticated;
grant  execute on function perdida_apuntar(text,bigint,text,text,bigint,bigint,int) to service_role;
grant  execute on function perdida_rescatar(text, bigint) to service_role;
grant  execute on function perdidas_de(text)              to service_role;


-- ══════════════════════════════════════════════════════════════════════════
-- Comprobacion — cero filas en la primera, y la tabla sin politicas
-- ══════════════════════════════════════════════════════════════════════════
select p.proname as abierta_de_mas
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('perdida_apuntar','perdida_rescatar','perdidas_de')
   and (has_function_privilege('anon',   p.oid, 'execute')
     or has_function_privilege('public', p.oid, 'execute'));

select relrowsecurity as rls_activo,
       (select count(*) from pg_policies where tablename = 'perdidas') as politicas
  from pg_class where relname = 'perdidas';
