-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 34 — skins de arma
-- ══════════════════════════════════════════════════════════════════════════
-- Supabase → SQL Editor → New query → pegar → Run. Repetible.
-- ANTES de redesplegar la Edge Function.
--
-- ── Por que este es el mejor sumidero del proyecto ────────────────────────
-- Una skin cambia el dibujo y NADA mas: mismo daño, mismo critico, misma
-- rotura. Eso tiene dos consecuencias que ningun otro sumidero tiene:
--
--   · Se le puede poner el precio que se quiera sin convertir el juego en
--     pagar-para-ganar. Con las armas hay que medir; aqui no hay nada que
--     medir porque no hay nada que se pueda desequilibrar.
--   · Es RECURRENTE. Ocho armas x diez aspectos son ochenta compras posibles,
--     y comprar una no quita ganas de comprar otra. Los sumideros de compra
--     unica sacan monedas una vez.
--
-- ── Donde vive cada cosa, y por que ───────────────────────────────────────
--
--     players.skins    lo que POSEES, por FAMILIA   {"dagas": [3, 7]}
--     brutes.arma_skin lo que LLEVA ese bruto             3
--
-- Por familia y no por arma porque los iconos de una fila son los mismos para
-- todas sus armas: cobrar la espada en llamas dos veces —una para la corta y
-- otra para el mandoble— seria cobrar dos veces por el mismo dibujo.
--
-- Es el mismo reparto que las armas y las mascotas desde el paso 14: la bolsa
-- es del jugador y lo equipado es del bruto. Aqui hay una diferencia a
-- proposito: una skin comprada NO se gasta al ponerla. Puedes vestir a tus
-- tres brutos con la misma daga dorada sin comprarla tres veces.
--
-- Y va en el BRUTO y no en el jugador porque si no, el rival no la veria. La
-- lista de rivales sale de `brutes`, y un cosmetico que los demas no ven no lo
-- compra nadie.
--
-- ── Sin `check` con la lista de skins ─────────────────────────────────────
-- `arma_skin` es un numero de 0 a 9 y se valida por rango, no por lista. Con
-- las armas hubo que abrir un `check` cada vez que entraba una nueva (paso
-- 33); con un rango eso no vuelve a pasar. Y un numero fuera de rango no rompe
-- nada: el renderizador cae a la skin gratis.
-- ══════════════════════════════════════════════════════════════════════════

alter table players add column if not exists skins jsonb not null default '{}'::jsonb;
alter table brutes  add column if not exists arma_skin smallint;

alter table brutes drop constraint if exists brutes_arma_skin_check;
alter table brutes add constraint brutes_arma_skin_check
  check (arma_skin is null or (arma_skin >= 0 and arma_skin <= 9));


-- ══════════════════════════════════════════════════════════════════════════
-- COMPRAR una skin
-- ══════════════════════════════════════════════════════════════════════════
-- Cobrar y dar tienen que pasar juntas o ninguna. Con `for update`, dos
-- peticiones simultaneas no pueden comprar la misma pagando una vez — que es
-- el hueco por el que se duplica cualquier cosa en este proyecto.
--
-- El precio llega calculado desde `brute-combate.js`, como en las armas: la
-- tabla de precios vive en un solo sitio.
-- `p_arma` lleva la FAMILIA ("dagas"), no el arma. El nombre se queda por no
-- cambiar la firma —añadir un parametro crea otra funcion, no la reemplaza— y
-- porque lo unico que hace Postgres con el es usarlo de clave.
create or replace function skin_comprar(
  p_owner text, p_arma text, p_skin int, p_precio bigint)
returns json
language plpgsql
security definer
as $$
declare
  v_saldo bigint;
  v_skins jsonb;
  v_suyas jsonb;
begin
  if p_skin is null or p_skin < 0 or p_skin > 9 then raise exception 'skin_invalida'; end if;
  if p_precio is null or p_precio < 0     then raise exception 'precio_invalido';    end if;
  if p_arma is null or btrim(p_arma) = '' then raise exception 'desconocido:%', p_arma; end if;

  select coins, coalesce(skins, '{}'::jsonb) into v_saldo, v_skins
    from players where address = p_owner for update;
  if not found then raise exception 'sin_jugador'; end if;

  v_suyas := coalesce(v_skins -> p_arma, '[]'::jsonb);
  if v_suyas @> to_jsonb(p_skin) then raise exception 'ya_la_tienes'; end if;
  if v_saldo < p_precio          then raise exception 'sin_saldo';    end if;

  v_skins := jsonb_set(v_skins, array[p_arma], v_suyas || to_jsonb(p_skin), true);
  update players set coins = coins - p_precio, skins = v_skins where address = p_owner;

  return json_build_object('arma', p_arma, 'skin', p_skin,
                           'balance', v_saldo - p_precio, 'skins', v_skins);
end;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- PONERSELA a un bruto
-- ══════════════════════════════════════════════════════════════════════════
-- No se gasta: sigue en la bolsa. Es lo que la separa de un arma — una skin
-- comprada se puede repartir entre los tres brutos a la vez.
--
-- Se exige que el bruto LLEVE esa arma. Sin eso se podria dejar puesta la skin
-- de un mandoble en un bruto con daga, y al equiparle el mandoble mas tarde
-- apareceria una skin que quiza ya no posee.
-- Anadir un parametro NO reemplaza la funcion, crea otra. Hay que tirar la
-- firma vieja o quedan las dos y PostgREST puede llamar a la que no es.
drop function if exists skin_poner(text, bigint, int);

create or replace function skin_poner(p_owner text, p_bruto bigint, p_skin int, p_familia text)
returns json
language plpgsql
security definer
as $$
declare
  v_arma  text;
  v_skins jsonb;
begin
  select arma into v_arma from brutes
   where id = p_bruto and owner = p_owner for update;
  if not found then raise exception 'no_es_tuyo'; end if;
  if v_arma is null or v_arma = 'ninguna' then raise exception 'sin_arma'; end if;

  /* `null` = quitarsela y volver a la de casa. Siempre permitido: no se puede
     dejar a nadie atrapado con una skin que ya no le gusta. */
  if p_skin is not null then
    if p_skin < 0 or p_skin > 9 then raise exception 'skin_invalida'; end if;
    /* La bolsa esta indexada por FAMILIA, y aqui solo se conoce el arma. La
       Edge Function manda la familia en `p_familia` porque la tabla de
       familias vive en `brute-combate.js` y Postgres no la tiene. */
    select coalesce(skins, '{}'::jsonb) into v_skins from players where address = p_owner;
    if not coalesce(v_skins -> p_familia, '[]'::jsonb) @> to_jsonb(p_skin) then
      raise exception 'no_la_tienes';
    end if;
  end if;

  update brutes set arma_skin = p_skin where id = p_bruto and owner = p_owner;
  return json_build_object('bruto', p_bruto, 'arma', v_arma, 'skin', p_skin);
end;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- LA TRAMPA DE SIEMPRE
-- ══════════════════════════════════════════════════════════════════════════
-- En Postgres una funcion nace ejecutable por PUBLIC, y `create or replace`
-- vuelve a concederlo. Hay que revocar CADA VEZ. `skin_comprar` abierta a anon
-- es regalarse skins; `skin_poner`, ponerle una al bruto de otro.
revoke execute on function skin_comprar(text, text, int, bigint) from public, anon, authenticated;
revoke execute on function skin_poner(text, bigint, int, text)   from public, anon, authenticated;
grant  execute on function skin_comprar(text, text, int, bigint) to service_role;
grant  execute on function skin_poner(text, bigint, int, text)   to service_role;


-- ══════════════════════════════════════════════════════════════════════════
-- Comprobacion — la primera tiene que dar CERO filas
-- ══════════════════════════════════════════════════════════════════════════
select p.proname as abierta_de_mas
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('skin_comprar','skin_poner')
   and (has_function_privilege('anon',   p.oid, 'execute')
     or has_function_privilege('public', p.oid, 'execute'));

select column_name, data_type, column_default
  from information_schema.columns
 where (table_name = 'players' and column_name = 'skins')
    or (table_name = 'brutes'  and column_name = 'arma_skin');
