-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 29 — la valvula: solo se paga lo que hay
-- ══════════════════════════════════════════════════════════════════════════
-- Supabase → SQL Editor → New query → pegar → Run. Repetible.
--
-- ── El problema que resuelve ──────────────────────────────────────────────
-- Un juego que promete X al dia y no lo puede pagar acaba de una de dos
-- formas: incumpliendo, o pagando a los primeros con el dinero de los
-- ultimos. Axie hizo lo segundo hasta que dejo de entrar gente, y su token
-- cayo un 99,8%. Los que jugaban se quedaron sin nada.
--
-- La salida no es prometer menos. Es prometer una REGLA en vez de un numero:
--
--     tokens_por_moneda = min(objetivo, respaldo_disponible / deuda_total)
--
-- Si hay respaldo de sobra, se paga el objetivo. Si no lo hay, se paga menos —
-- automaticamente, sin que nadie tenga que decidirlo ni anunciarlo.
--
-- ── Lo que esto SI garantiza, y lo que no ─────────────────────────────────
-- SI: el sistema no puede quedar a deber. Nunca se promete mas de lo que se
--     tiene, asi que no hay incumplimiento posible.
-- SI: si falta, falta para todos por igual y a la vez. Sin `for update` esto
--     seria el primero que llega se lo lleva y el ultimo no cobra — una
--     carrera hacia la puerta, que es como se hunde un banco.
-- NO: no impide que las ganancias bajen si deja de entrar dinero. Eso no lo
--     arregla ningun mecanismo. Lo que hace es que bajen de forma ORDENADA y
--     visible en vez de acabar en un impago.
--
-- ── Por que se reparte el faltante y no se cierra la puerta ───────────────
-- La alternativa seria bloquear las retiradas cuando no llega. Pero eso es
-- peor: quien retiro ayer cobro entero y quien lo intenta hoy no cobra nada,
-- por haber llegado tarde. Repartir el faltante trata igual a todos.
-- ══════════════════════════════════════════════════════════════════════════

-- Cuantos tokens hay DE VERDAD disponibles para pagar retiradas. Lo pone el
-- administrador o lo refresca la funcion de retirada leyendo la cadena. Es el
-- unico numero que decide la valvula, asi que si esta mal, todo esta mal.
alter table economia add column if not exists respaldo_tokens  bigint  not null default 0;

-- El techo que quiere el dueño. La valvula nunca paga mas que esto, aunque
-- sobre respaldo. Sirve para arrancar suave y subir cuando haya con que.
alter table economia add column if not exists valvula_objetivo numeric(12,6) not null default 1.0;

-- Con esto en false, `tokens_por_moneda` se queda donde este y no se toca.
-- Existe para poder congelar el valor mientras se investiga algo raro.
alter table economia add column if not exists valvula_auto     boolean not null default true;

-- Cuando se recalculo por ultima vez, para poder enseñarlo sin mentir.
alter table economia add column if not exists valvula_vista    timestamptz;


-- ══════════════════════════════════════════════════════════════════════════
-- RECALCULAR
-- ══════════════════════════════════════════════════════════════════════════
-- Se llama antes de cada retirada y cuando el admin toca el respaldo. Es
-- barato: una suma sobre `players`, que tiene pocas filas por definicion.
create or replace function valvula_recalcular()
returns json
language plpgsql
security definer
as $$
declare
  e         economia%rowtype;
  v_deuda   bigint;
  v_nueva   numeric(12,6);
begin
  -- `for update` no es adorno: sin el, dos retiradas simultaneas leen el mismo
  -- respaldo, las dos se creen cubiertas, y entre las dos se llevan mas de lo
  -- que hay. Es exactamente la carrera que hunde un banco.
  select * into e from economia where id = 1 for update;
  if not found then raise exception 'sin_economia'; end if;

  -- La deuda es todo lo que los jugadores podrian pedir hoy. No lo que
  -- piden: lo que PUEDEN pedir. Calcular sobre lo que piden seria contar
  -- solo a los que ya estan en la cola.
  select coalesce(sum(coins), 0) into v_deuda from players;

  if not e.valvula_auto then
    return json_build_object('valvula', e.tokens_por_moneda, 'auto', false,
                             'deuda', v_deuda, 'respaldo', e.respaldo_tokens);
  end if;

  if v_deuda <= 0 then
    v_nueva := e.valvula_objetivo;          -- nadie tiene nada: no hay deuda
  else
    v_nueva := least(e.valvula_objetivo, e.respaldo_tokens::numeric / v_deuda);
  end if;
  if v_nueva < 0 then v_nueva := 0; end if;

  update economia
     set tokens_por_moneda = v_nueva,
         valvula_vista     = now(),
         actualizado       = now()
   where id = 1;

  return json_build_object('valvula', v_nueva, 'auto', true,
                           'deuda', v_deuda, 'respaldo', e.respaldo_tokens,
                           'objetivo', e.valvula_objetivo);
end;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- ACTUALIZAR EL RESPALDO
-- ══════════════════════════════════════════════════════════════════════════
-- Solo el servidor. Y deja rastro: el respaldo es el numero del que depende
-- lo que cobra todo el mundo, asi que cambiarlo sin registro seria poder
-- subir o bajar las ganancias de todos sin que quede constancia.
create or replace function respaldo_fijar(p_tokens bigint, p_motivo text)
returns json
language plpgsql
security definer
as $$
declare v_antes bigint;
begin
  if p_tokens is null or p_tokens < 0 then raise exception 'cantidad_invalida'; end if;
  if p_motivo is null or length(btrim(p_motivo)) < 10 then
    raise exception 'motivo_corto';
  end if;

  select respaldo_tokens into v_antes from economia where id = 1 for update;
  update economia set respaldo_tokens = p_tokens, actualizado = now() where id = 1;

  insert into admin_log (accion, objetivo, antes, despues)
  values ('respaldo_fijar', 'economia',
          jsonb_build_object('respaldo_tokens', v_antes),
          jsonb_build_object('respaldo_tokens', p_tokens, 'motivo', p_motivo));

  return valvula_recalcular();
end;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- LA TRAMPA DE SIEMPRE
-- ══════════════════════════════════════════════════════════════════════════
-- Las dos son `security definer` y las dos escriben. `respaldo_fijar` abierta
-- a anon es dejar que cualquiera decida cuanto cobran todos.
revoke execute on function valvula_recalcular()              from public, anon, authenticated;
revoke execute on function respaldo_fijar(bigint, text)      from public, anon, authenticated;
grant  execute on function valvula_recalcular()              to service_role;
grant  execute on function respaldo_fijar(bigint, text)      to service_role;


-- ══════════════════════════════════════════════════════════════════════════
-- Comprobacion — la primera consulta tiene que dar CERO filas
-- ══════════════════════════════════════════════════════════════════════════
select p.proname as abierta_de_mas
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('valvula_recalcular','respaldo_fijar')
   and (has_function_privilege('anon',   p.oid, 'execute')
     or has_function_privilege('public', p.oid, 'execute'));

select respaldo_tokens, valvula_objetivo, valvula_auto,
       tokens_por_moneda, (select coalesce(sum(coins),0) from players) as deuda
  from economia where id = 1;
