-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 14 — el inventario pasa a ser del JUGADOR
-- ══════════════════════════════════════════════════════════════════════════
-- Supabase → SQL Editor → New query → pegar → Run. Repetible.
--
--   ⚠️  ORDEN: este SQL primero, la Edge Function después. Se mantiene la
--       columna vieja `brutes.armas` justo para eso — si se borrara, la
--       función desplegada se caería en el hueco entre los dos pasos.
--
-- ── El problema ───────────────────────────────────────────────────────────
--
-- El inventario vivía en `brutes.armas`, o sea que las armas eran del BRUTO.
-- Consecuencias que se notaban jugando:
--
--   · No se podían pasar de un bruto a otro. La daga que compraste no era
--     tuya, era de `tito`.
--   · Un bruto nuevo empezaba sin nada aunque tuvieras cinco armas guardadas.
--   · Y comprar la misma arma dos veces daba "ya la tienes", aunque la
--     quisieras para OTRO bruto.
--
-- ── El modelo ─────────────────────────────────────────────────────────────
--
--     players.armas  {"daga": 2, "mandoble": 1}   copias LIBRES, en la bolsa
--     brutes.arma    "daga"                        la que ese bruto lleva
--
-- La clave: en la bolsa solo están las copias SIN ASIGNAR. Cuando un bruto
-- equipa algo, sale de la bolsa; cuando lo suelta o lo cambia, vuelve.
--
-- Se hace así para que no haya dos sitios que digan lo mismo. Si la bolsa
-- guardara todo lo que posees Y además el bruto dijera qué lleva, habría que
-- restar para saber qué está libre — y el día que las dos cuentas no cuadren
-- (una petición a medias, una carrera) aparecen armas duplicadas o perdidas
-- sin que nadie sepa cuál de los dos números era el bueno.
--
-- Total poseído = bolsa + lo que llevan puesto tus brutos. No hace falta
-- guardarlo: se cuenta.
--
-- ── Con cantidades, a propósito ───────────────────────────────────────────
-- Tres brutos pueden llevar tres dagas, y para eso hay que comprar tres. Es
-- más natural como inventario y además es un sumidero más — que según el
-- TOKEN.md es la mitad de la economía.
-- ══════════════════════════════════════════════════════════════════════════

alter table players add column if not exists armas jsonb not null default '{}'::jsonb;


-- ══════════════════════════════════════════════════════════════════════════
-- Mudanza: lo que hay en los brutos pasa a su dueño
-- ══════════════════════════════════════════════════════════════════════════
-- La equipada NO se mueve: se queda puesta, que es donde está. A la bolsa van
-- solo las guardadas.
--
-- Es repetible porque al final se vacía `brutes.armas`: la segunda vez ya no
-- queda nada que mudar. Sin ese vaciado, volver a ejecutarlo duplicaría el
-- inventario de todo el mundo.
update players p
   set armas = coalesce(p.armas, '{}'::jsonb) || coalesce((
         select jsonb_object_agg(s.arma, s.n)
           from (select x.arma, count(*)::int as n
                   from brutes b
                   cross join lateral jsonb_array_elements_text(b.armas) as x(arma)
                  where b.owner = p.address
                    and x.arma is distinct from b.arma   -- la puesta se queda puesta
                    and x.arma <> 'ninguna'
                  group by x.arma) s
       ), '{}'::jsonb)
 where exists (select 1 from brutes b
                where b.owner = p.address
                  and jsonb_array_length(coalesce(b.armas, '[]'::jsonb)) > 0);

-- Y se vacía el sitio viejo. A partir de aquí `brutes.armas` no significa
-- nada: se deja por compatibilidad con la función todavía desplegada y para
-- no romper nada entre este paso y el redespliegue.
update brutes set armas = '[]'::jsonb
 where jsonb_array_length(coalesce(armas, '[]'::jsonb)) > 0;


-- ══════════════════════════════════════════════════════════════════════════
-- Equipar: mover una copia de la bolsa al bruto
-- ══════════════════════════════════════════════════════════════════════════
-- Todo en una función y con `for update` porque son dos escrituras que TIENEN
-- que cuadrar. Si se hicieran sueltas desde la Edge Function, un fallo entre
-- las dos dejaría el arma en los dos sitios a la vez, o en ninguno. Sobre un
-- token con valor real, eso es duplicar dinero.
--
-- `p_arma = 'ninguna'` desarma: devuelve lo puesto a la bolsa y deja al bruto
-- a puño limpio.
create or replace function arma_equipar(p_owner text, p_bruto bigint, p_arma text)
returns json
language plpgsql
security definer
as $$
declare
  v_actual text;
  v_bolsa  jsonb;
  v_n      int;
begin
  if p_arma not in ('ninguna','daga','mandoble','lanza','escudo') then
    raise exception 'arma desconocida: %', p_arma;
  end if;

  select armas into v_bolsa from players where address = p_owner for update;
  if not found then raise exception 'jugador desconocido'; end if;
  v_bolsa := coalesce(v_bolsa, '{}'::jsonb);

  -- El bruto se busca por id Y por dueño. Sin lo segundo se podría equipar el
  -- bruto de otro mandando su id.
  select arma into v_actual from brutes where id = p_bruto and owner = p_owner for update;
  if not found then raise exception 'ese bruto no es tuyo'; end if;

  if v_actual = p_arma then
    return json_build_object('arma', v_actual, 'bolsa', v_bolsa, 'cambio', false);
  end if;

  -- ¿hay copia libre de la que quiere ponerse?
  if p_arma <> 'ninguna' then
    v_n := coalesce((v_bolsa ->> p_arma)::int, 0);
    if v_n < 1 then raise exception 'no tienes ninguna % libre', p_arma; end if;
    -- sale de la bolsa; si era la última, se quita la clave en vez de dejar un 0
    v_bolsa := case when v_n = 1 then v_bolsa - p_arma
                    else jsonb_set(v_bolsa, array[p_arma], to_jsonb(v_n - 1)) end;
  end if;

  -- y lo que llevaba puesto vuelve a la bolsa
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
-- Comprar: una copia más a la bolsa
-- ══════════════════════════════════════════════════════════════════════════
-- El cobro y el alta van juntos por lo mismo de arriba: si se cobrara fuera y
-- fallara el alta, el jugador pagaría por un arma que no recibe.
--
-- El PRECIO no viene del navegador. Se pasa desde la Edge Function, que lo
-- saca de `brute-combate.js`, y aquí se vuelve a comprobar el saldo.
create or replace function arma_comprar(p_owner text, p_arma text, p_precio bigint)
returns json
language plpgsql
security definer
as $$
declare
  v_saldo bigint;
  v_bolsa jsonb;
begin
  if p_arma not in ('daga','mandoble','lanza','escudo') then
    raise exception 'arma desconocida: %', p_arma;
  end if;
  if p_precio is null or p_precio < 0 then
    raise exception 'precio no válido';
  end if;

  select coins, coalesce(armas, '{}'::jsonb) into v_saldo, v_bolsa
    from players where address = p_owner for update;
  if not found then raise exception 'jugador desconocido'; end if;

  if v_saldo < p_precio then
    raise exception 'sin_saldo';
  end if;

  v_bolsa := jsonb_set(v_bolsa, array[p_arma],
                       to_jsonb(coalesce((v_bolsa ->> p_arma)::int, 0) + 1));

  update players set coins = coins - p_precio, armas = v_bolsa where address = p_owner;

  return json_build_object('bolsa', v_bolsa, 'balance', v_saldo - p_precio);
end;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- Dar: una copia a la bolsa sin cobrar
-- ══════════════════════════════════════════════════════════════════════════
-- Para el arma que toca al subir de nivel. Es distinta de `arma_comprar`
-- aunque haga media cosa parecida: comprar cobra y esto no, y mezclarlas
-- obligaría a llamar a comprar con precio 0 — que funcionaría, y dejaría el
-- historial diciendo que el jugador "compró" algo que le regalaron.
create or replace function arma_dar(p_owner text, p_arma text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_bolsa jsonb;
begin
  if p_arma not in ('daga','mandoble','lanza','escudo') then
    raise exception 'arma desconocida: %', p_arma;
  end if;

  select coalesce(armas, '{}'::jsonb) into v_bolsa
    from players where address = p_owner for update;
  if not found then raise exception 'jugador desconocido'; end if;

  v_bolsa := jsonb_set(v_bolsa, array[p_arma],
                       to_jsonb(coalesce((v_bolsa ->> p_arma)::int, 0) + 1));
  update players set armas = v_bolsa where address = p_owner;
  return v_bolsa;
end;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- Romper: la copia que llevaba puesta desaparece del mundo
-- ══════════════════════════════════════════════════════════════════════════
-- NO vuelve a la bolsa: eso es lo que hace que las armas sean un sumidero y
-- que la más fuerte no sea gratis de mantener. El mandoble dura ~11 combates.
create or replace function arma_romper(p_owner text, p_bruto bigint)
returns json
language plpgsql
security definer
as $$
declare
  v_actual text;
begin
  select arma into v_actual from brutes where id = p_bruto and owner = p_owner for update;
  if not found then raise exception 'ese bruto no es tuyo'; end if;
  if v_actual is null or v_actual = 'ninguna' then
    return json_build_object('rota', '');
  end if;
  update brutes set arma = 'ninguna' where id = p_bruto and owner = p_owner;
  return json_build_object('rota', v_actual);
end;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- LA TRAMPA DE SIEMPRE
-- ══════════════════════════════════════════════════════════════════════════
-- Las tres son `security definer` y las tres ESCRIBEN. `arma_comprar` abierta
-- a public sería regalarse armas con la clave anon.
revoke execute on function arma_equipar(text, bigint, text)  from public;
revoke execute on function arma_equipar(text, bigint, text)  from anon, authenticated;
grant  execute on function arma_equipar(text, bigint, text)  to service_role;

revoke execute on function arma_comprar(text, text, bigint)  from public;
revoke execute on function arma_comprar(text, text, bigint)  from anon, authenticated;
grant  execute on function arma_comprar(text, text, bigint)  to service_role;

revoke execute on function arma_romper(text, bigint)         from public;
revoke execute on function arma_romper(text, bigint)         from anon, authenticated;
grant  execute on function arma_romper(text, bigint)         to service_role;

-- `arma_dar` regala armas. Abierta a public, cualquiera se llena la bolsa.
revoke execute on function arma_dar(text, text)              from public;
revoke execute on function arma_dar(text, text)              from anon, authenticated;
grant  execute on function arma_dar(text, text)              to service_role;


-- ══════════════════════════════════════════════════════════════════════════
-- Comprobación
-- ══════════════════════════════════════════════════════════════════════════
-- 1) Cero filas.
select p.proname as funcion_abierta
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('arma_equipar','arma_comprar','arma_romper','arma_dar')
   and (has_function_privilege('anon',   p.oid, 'execute')
     or has_function_privilege('public', p.oid, 'execute'));

-- 2) Cómo ha quedado la mudanza: bolsa del jugador y lo que lleva cada bruto.
select p.address, p.coins, p.armas as bolsa,
       (select json_agg(json_build_object('bruto', b.name, 'lleva', b.arma))
          from brutes b where b.owner = p.address) as brutos
  from players p
 where p.armas <> '{}'::jsonb
    or exists (select 1 from brutes b where b.owner = p.address and b.arma <> 'ninguna');
