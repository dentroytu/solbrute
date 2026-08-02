-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 23 — mascotas (el vivarium)
-- ══════════════════════════════════════════════════════════════════════════
-- Supabase → SQL Editor → New query → pegar → Run. Repetible.
--
-- Mismo modelo que las armas del paso 14, y a propósito: la bolsa es del
-- JUGADOR y lo equipado es del BRUTO, así que una mascota se puede pasar de un
-- bruto a otro.
--
--     players.mascotas  {"perro": 2, "oso": 1}   copias LIBRES, en tu bolsa
--     brutes.mascota    "perro"                   la que ese bruto lleva
--
-- ── En qué se diferencian de las armas ────────────────────────────────────
--
-- Una mascota SÍ es una ventaja: quien lleva una gana ~57% contra quien no.
-- Las armas están todas al 50%, incluidos los puños. Eso es deliberado, y lo
-- que impide que sea comprar victorias son tres frenos, todos en
-- `brute-combate.js`:
--
--   · ESTORBA — resta 2 de iniciativa. Sin eso la ventaja sube al 63%.
--   · MUERE, y no vuelve. Como el arma que se rompe.
--   · Y NO da más monedas ni más XP.
--
-- Los números salen de `prueba-mascotas.mjs`, que copia el bucle de
-- `simulate()` y comprueba que sin mascota da idéntico antes de medir nada.
--
-- ── La muerte NO la decide el navegador ───────────────────────────────────
-- Igual que romper un arma: si la decidiera el cliente, no se moriría ninguna.
-- La calcula `simulate()` en el servidor y la ejecuta `mascota_morir`.
-- ══════════════════════════════════════════════════════════════════════════

alter table players add column if not exists mascotas jsonb  not null default '{}'::jsonb;
alter table brutes  add column if not exists mascota  text   not null default 'ninguna';

alter table brutes drop constraint if exists brutes_mascota_valida;
alter table brutes add  constraint brutes_mascota_valida
  check (mascota in ('ninguna','perro','lobo','oso'));


-- Dos columnas mas en `fights`, por lo mismo que las del paso 17: la muerte de
-- una mascota es una propiedad DE la pelea, y sin guardarla el tablon del ludus
-- no podria contarla — que es justo lo que la gente quiere ver al entrar.
alter table fights add column if not exists mascota        text;
alter table fights add column if not exists mascota_muerta text;


-- ══════════════════════════════════════════════════════════════════════════
-- COMPRAR: cobrar y dar, o ninguna de las dos
-- ══════════════════════════════════════════════════════════════════════════
-- Con `for update`, como `arma_comprar`. Si el cobro y el alta fueran dos
-- escrituras sueltas desde la Edge Function, un fallo entre medias cobraría
-- sin dar nada — o al revés, que sobre un token con valor real es imprimir.
--
-- El PRECIO no viene del navegador: lo pasa la Edge Function desde
-- `brute-combate.js` y aquí se vuelve a comprobar el saldo.
create or replace function mascota_comprar(p_owner text, p_id text, p_precio bigint)
returns json
language plpgsql
security definer
as $$
declare
  v_saldo bigint;
  v_bolsa jsonb;
begin
  if p_id not in ('perro','lobo','oso') then
    raise exception 'mascota desconocida: %', p_id;
  end if;
  if p_precio is null or p_precio < 0 then raise exception 'precio no valido'; end if;

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


-- ══════════════════════════════════════════════════════════════════════════
-- EQUIPAR: mover una copia entre la bolsa y el bruto
-- ══════════════════════════════════════════════════════════════════════════
-- En la bolsa solo están las copias SIN ASIGNAR. Al equipar sale de la bolsa;
-- al soltarla o cambiarla, vuelve. Mismo razonamiento que con las armas: si la
-- bolsa guardara todo lo que posees Y además el bruto dijera qué lleva, habría
-- que restar para saber qué está libre, y el día que las dos cuentas no cuadren
-- aparecen mascotas duplicadas o perdidas.
--
-- `p_id = 'ninguna'` la guarda: la devuelve a la bolsa y deja al bruto solo.
create or replace function mascota_equipar(p_owner text, p_bruto bigint, p_id text)
returns json
language plpgsql
security definer
as $$
declare
  v_actual text;
  v_bolsa  jsonb;
  v_n      int;
begin
  if p_id not in ('ninguna','perro','lobo','oso') then
    raise exception 'mascota desconocida: %', p_id;
  end if;

  select coalesce(mascotas, '{}'::jsonb) into v_bolsa
    from players where address = p_owner for update;
  if not found then raise exception 'jugador desconocido'; end if;

  -- Por id Y por dueño: mandar el id de un bruto ajeno no lo toca.
  select mascota into v_actual from brutes
   where id = p_bruto and owner = p_owner for update;
  if not found then raise exception 'ese bruto no es tuyo'; end if;

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
-- MORIR: la que llevaba puesta desaparece del mundo
-- ══════════════════════════════════════════════════════════════════════════
-- NO vuelve a la bolsa. Es lo que hace que llevarla sea una decisión que se
-- repite y no una compra única — y lo que la convierte en un sumidero, que es
-- la mitad de lo que le falta a esta economía.
--
-- La decide `simulate()` en el servidor. Si la decidiera el navegador, no se
-- moriría ninguna.
create or replace function mascota_morir(p_owner text, p_bruto bigint)
returns json
language plpgsql
security definer
as $$
declare v_actual text;
begin
  select mascota into v_actual from brutes
   where id = p_bruto and owner = p_owner for update;
  if not found then raise exception 'ese bruto no es tuyo'; end if;
  if v_actual is null or v_actual = 'ninguna' then
    return json_build_object('muerta', '');
  end if;
  update brutes set mascota = 'ninguna' where id = p_bruto and owner = p_owner;
  return json_build_object('muerta', v_actual);
end;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- LA TRAMPA DE SIEMPRE
-- ══════════════════════════════════════════════════════════════════════════
-- Las tres son `security definer` y las tres ESCRIBEN. `mascota_comprar`
-- abierta a public es regalar mascotas con la clave anon.
revoke execute on function mascota_comprar(text, text, bigint) from public;
revoke execute on function mascota_comprar(text, text, bigint) from anon, authenticated;
grant  execute on function mascota_comprar(text, text, bigint) to service_role;

revoke execute on function mascota_equipar(text, bigint, text) from public;
revoke execute on function mascota_equipar(text, bigint, text) from anon, authenticated;
grant  execute on function mascota_equipar(text, bigint, text) to service_role;

revoke execute on function mascota_morir(text, bigint) from public;
revoke execute on function mascota_morir(text, bigint) from anon, authenticated;
grant  execute on function mascota_morir(text, bigint) to service_role;


-- ══════════════════════════════════════════════════════════════════════════
-- Comprobación — cero filas
-- ══════════════════════════════════════════════════════════════════════════
select p.proname as funcion_abierta
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('mascota_comprar','mascota_equipar','mascota_morir')
   and (has_function_privilege('anon',   p.oid, 'execute')
     or has_function_privilege('public', p.oid, 'execute'));

select address, coins, mascotas from players where mascotas <> '{}'::jsonb;
select name, arma, mascota from brutes order by id;
