-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 25 — armas y mascotas con nivel minimo
-- ══════════════════════════════════════════════════════════════════════════
-- Supabase → SQL Editor → New query → pegar → Run. Repetible.
--
-- A partir de aqui cada arma y cada mascota pide un nivel:
--
--     daga 1 · escudo 3 · lanza 6 · mandoble 10
--     perro 2 · lobo 5 · oso 9
--
-- ── Por que esto es una funcion de Postgres y no un `if` en el cliente ────
-- Porque el cliente se puede saltar. La armeria puede esconder el mandoble
-- todo lo que quiera: un `POST /rpc/arma_equipar` con curl lo pide igual. Si la
-- comprobacion no vive aqui, no existe.
--
-- ── Y por que el nivel lo manda la Edge Function ──────────────────────────
-- Mismo razonamiento que con el precio, que ya funciona asi: la tabla de armas
-- vive en `brute-combate.js`, que cargan el navegador y la Edge Function. Aqui
-- llega ya resuelto en `p_nivel_min`, y esta funcion solo comprueba que el
-- bruto llega. Duplicar la tabla en SQL seria una tercera copia que mantener y
-- que se desincroniza el primer dia.
--
-- El navegador NO puede mandarlo: la Edge Function lo saca de su propia copia
-- de la tabla, nunca del cuerpo de la peticion.
--
-- ── Se comprueba al EQUIPAR, y tambien al COMPRAR ─────────────────────────
-- Equipar es el candado de verdad: es lo que decide con que pelea el bruto.
-- Pero comprar algo que no puedes usar es tirar el dinero sin avisar, asi que
-- comprar exige tener ALGUN bruto que llegue al nivel. Son dos reglas
-- distintas a proposito:
--
--     comprar   -> tu mejor bruto llega al nivel   (es tuyo, para tu ludus)
--     equipar   -> ESE bruto llega al nivel        (es de ese gladiador)
--
-- Asi puedes comprarle el mandoble a tu bruto de nivel 12 y guardarlo en la
-- bolsa, pero no puedes ponerselo al de nivel 2.
--
-- ── Lo que YA estaba equipado no se toca ──────────────────────────────────
-- Nadie pierde nada al aplicar esto. Un bruto de nivel 1 que ya llevaba un
-- mandoble se lo queda: quitarselo seria confiscar algo comprado con las
-- reglas de antes. El candado solo actua de aqui en adelante.
-- ══════════════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════════════
-- ARMAS
-- ══════════════════════════════════════════════════════════════════════════
create or replace function arma_comprar(p_owner text, p_arma text, p_precio bigint,
                                        p_nivel_min int default 1)
returns json
language plpgsql
security definer
as $$
declare
  v_saldo bigint;
  v_bolsa jsonb;
  v_mejor int;
begin
  if p_arma not in ('daga','escudo','lanza','mandoble') then
    raise exception 'arma desconocida: %', p_arma;
  end if;
  if p_precio is null or p_precio < 0 then raise exception 'precio no valido'; end if;
  if p_nivel_min is null or p_nivel_min < 1 then p_nivel_min := 1; end if;

  -- Tu MEJOR bruto. Comprar algo que ninguno puede usar es tirar monedas.
  select coalesce(max(level), 0) into v_mejor from brutes where owner = p_owner;
  if v_mejor < p_nivel_min then
    raise exception 'nivel_insuficiente:%', p_nivel_min;
  end if;

  select coins, coalesce(armas, '{}'::jsonb) into v_saldo, v_bolsa
    from players where address = p_owner for update;
  if not found then raise exception 'jugador desconocido'; end if;
  if v_saldo < p_precio then raise exception 'sin_saldo'; end if;

  v_bolsa := jsonb_set(v_bolsa, array[p_arma],
                       to_jsonb(coalesce((v_bolsa ->> p_arma)::int, 0) + 1));
  update players set coins = coins - p_precio, armas = v_bolsa where address = p_owner;

  return json_build_object('bolsa', v_bolsa, 'balance', v_saldo - p_precio);
end;
$$;


create or replace function arma_equipar(p_owner text, p_bruto bigint, p_arma text,
                                        p_nivel_min int default 1)
returns json
language plpgsql
security definer
as $$
declare
  v_actual text;
  v_bolsa  jsonb;
  v_n      int;
  v_nivel  int;
begin
  if p_arma not in ('ninguna','daga','escudo','lanza','mandoble') then
    raise exception 'arma desconocida: %', p_arma;
  end if;
  if p_nivel_min is null or p_nivel_min < 1 then p_nivel_min := 1; end if;

  select coalesce(armas, '{}'::jsonb) into v_bolsa
    from players where address = p_owner for update;
  if not found then raise exception 'jugador desconocido'; end if;

  -- Por id Y por dueño: mandar el id de un bruto ajeno no lo toca.
  select arma, level into v_actual, v_nivel from brutes
   where id = p_bruto and owner = p_owner for update;
  if not found then raise exception 'ese bruto no es tuyo'; end if;

  -- El candado. Soltar el arma ('ninguna') no pide nivel: nadie puede quedar
  -- atrapado con algo puesto por no llegar al nivel de quitarselo.
  if p_arma <> 'ninguna' and v_nivel < p_nivel_min then
    raise exception 'nivel_insuficiente:%', p_nivel_min;
  end if;

  if v_actual = p_arma then
    return json_build_object('arma', v_actual, 'bolsa', v_bolsa, 'cambio', false);
  end if;

  if p_arma <> 'ninguna' then
    v_n := coalesce((v_bolsa ->> p_arma)::int, 0);
    if v_n < 1 then raise exception 'no tienes ningun % libre', p_arma; end if;
    v_bolsa := case when v_n = 1 then v_bolsa - p_arma
                    else jsonb_set(v_bolsa, array[p_arma], to_jsonb(v_n - 1)) end;
  end if;

  if v_actual is not null and v_actual <> 'ninguna' then
    v_bolsa := jsonb_set(v_bolsa, array[v_actual],
                         to_jsonb(coalesce((v_bolsa ->> v_actual)::int, 0) + 1));
  end if;

  update players set armas = v_bolsa where address = p_owner;
  update brutes  set arma  = p_arma  where id = p_bruto and owner = p_owner;

  return json_build_object('arma', p_arma, 'bolsa', v_bolsa, 'cambio', true);
end;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- MASCOTAS — mismas dos reglas
-- ══════════════════════════════════════════════════════════════════════════
create or replace function mascota_comprar(p_owner text, p_id text, p_precio bigint,
                                           p_nivel_min int default 1)
returns json
language plpgsql
security definer
as $$
declare
  v_saldo bigint;
  v_bolsa jsonb;
  v_mejor int;
begin
  if p_id not in ('perro','lobo','oso') then
    raise exception 'mascota desconocida: %', p_id;
  end if;
  if p_precio is null or p_precio < 0 then raise exception 'precio no valido'; end if;
  if p_nivel_min is null or p_nivel_min < 1 then p_nivel_min := 1; end if;

  select coalesce(max(level), 0) into v_mejor from brutes where owner = p_owner;
  if v_mejor < p_nivel_min then
    raise exception 'nivel_insuficiente:%', p_nivel_min;
  end if;

  select coins, coalesce(mascotas, '{}'::jsonb) into v_saldo, v_bolsa
    from players where address = p_owner for update;
  if not found then raise exception 'jugador desconocido'; end if;
  if v_saldo < p_precio then raise exception 'sin_saldo'; end if;

  v_bolsa := jsonb_set(v_bolsa, array[p_id],
                       to_jsonb(coalesce((v_bolsa ->> p_id)::int, 0) + 1));
  update players set coins = coins - p_precio, mascotas = v_bolsa where address = p_owner;

  return json_build_object('bolsa', v_bolsa, 'balance', v_saldo - p_precio);
end;
$$;


create or replace function mascota_equipar(p_owner text, p_bruto bigint, p_id text,
                                           p_nivel_min int default 1)
returns json
language plpgsql
security definer
as $$
declare
  v_actual text;
  v_bolsa  jsonb;
  v_n      int;
  v_nivel  int;
begin
  if p_id not in ('ninguna','perro','lobo','oso') then
    raise exception 'mascota desconocida: %', p_id;
  end if;
  if p_nivel_min is null or p_nivel_min < 1 then p_nivel_min := 1; end if;

  select coalesce(mascotas, '{}'::jsonb) into v_bolsa
    from players where address = p_owner for update;
  if not found then raise exception 'jugador desconocido'; end if;

  select mascota, level into v_actual, v_nivel from brutes
   where id = p_bruto and owner = p_owner for update;
  if not found then raise exception 'ese bruto no es tuyo'; end if;

  if p_id <> 'ninguna' and v_nivel < p_nivel_min then
    raise exception 'nivel_insuficiente:%', p_nivel_min;
  end if;

  if v_actual = p_id then
    return json_build_object('mascota', v_actual, 'bolsa', v_bolsa, 'cambio', false);
  end if;

  if p_id <> 'ninguna' then
    v_n := coalesce((v_bolsa ->> p_id)::int, 0);
    if v_n < 1 then raise exception 'no tienes ningun % libre', p_id; end if;
    v_bolsa := case when v_n = 1 then v_bolsa - p_id
                    else jsonb_set(v_bolsa, array[p_id], to_jsonb(v_n - 1)) end;
  end if;

  if v_actual is not null and v_actual <> 'ninguna' then
    v_bolsa := jsonb_set(v_bolsa, array[v_actual],
                         to_jsonb(coalesce((v_bolsa ->> v_actual)::int, 0) + 1));
  end if;

  update players set mascotas = v_bolsa where address = p_owner;
  update brutes  set mascota  = p_id    where id = p_bruto and owner = p_owner;

  return json_build_object('mascota', p_id, 'bolsa', v_bolsa, 'cambio', true);
end;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- LA TRAMPA DE SIEMPRE
-- ══════════════════════════════════════════════════════════════════════════
-- `create or replace` vuelve a conceder EXECUTE a PUBLIC. Hay que revocar
-- otra vez, CADA vez. Ya paso dos veces en este proyecto: el paso 8 deshizo en
-- silencio lo que habia puesto el 7.
--
-- Y ojo: las firmas han CAMBIADO (un parametro mas), asi que las viejas siguen
-- existiendo y hay que revocarlas tambien o quedan abiertas.
revoke execute on function arma_comprar(text, text, bigint)          from public, anon, authenticated;
revoke execute on function arma_equipar(text, bigint, text)          from public, anon, authenticated;
revoke execute on function mascota_comprar(text, text, bigint)       from public, anon, authenticated;
revoke execute on function mascota_equipar(text, bigint, text)       from public, anon, authenticated;

revoke execute on function arma_comprar(text, text, bigint, int)     from public, anon, authenticated;
revoke execute on function arma_equipar(text, bigint, text, int)     from public, anon, authenticated;
revoke execute on function mascota_comprar(text, text, bigint, int)  from public, anon, authenticated;
revoke execute on function mascota_equipar(text, bigint, text, int)  from public, anon, authenticated;

grant execute on function arma_comprar(text, text, bigint, int)      to service_role;
grant execute on function arma_equipar(text, bigint, text, int)      to service_role;
grant execute on function mascota_comprar(text, text, bigint, int)   to service_role;
grant execute on function mascota_equipar(text, bigint, text, int)   to service_role;


-- ══════════════════════════════════════════════════════════════════════════
-- Comprobacion — la primera consulta tiene que dar CERO filas
-- ══════════════════════════════════════════════════════════════════════════
select p.proname as funcion_abierta, pg_get_function_identity_arguments(p.oid) as firma
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('arma_comprar','arma_equipar','mascota_comprar','mascota_equipar')
   and (has_function_privilege('anon',   p.oid, 'execute')
     or has_function_privilege('public', p.oid, 'execute'));

-- Y esto ensena que brutos se quedan con algo que hoy no podrian equipar.
-- No es un error: lo comprado con las reglas de antes no se confisca.
select id, name, level, arma, mascota from brutes
 where (arma    = 'escudo'   and level < 3)
    or (arma    = 'lanza'    and level < 6)
    or (arma    = 'mandoble' and level < 10)
    or (mascota = 'perro'    and level < 2)
    or (mascota = 'lobo'     and level < 5)
    or (mascota = 'oso'      and level < 9)
 order by id;
