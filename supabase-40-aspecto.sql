-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 40 — la barberia y los aspectos de pago
-- ══════════════════════════════════════════════════════════════════════════
-- Supabase → SQL Editor → New query → pegar → Run. Repetible.
-- ANTES de redesplegar la Edge Function.
--
-- ── Por que la barberia es lo primero y no los cosmeticos ─────────────────
-- El aspecto se fijaba al forjar y NO SE PODIA CAMBIAR NUNCA. Con eso, vender
-- un peinado no tiene sentido: el jugador solo forja tres veces en la vida de
-- su cuenta, y encima tendria que comprar a ciegas, antes de ver como le queda.
--
-- Asi que el sumidero no son los cosmeticos: es PODER CAMBIAR. Un cosmetico se
-- compra una vez; cambiar de aspecto se hace muchas. Por eso cada visita se
-- paga, tengas ya lo que te pongas o no.
--
-- ── Lo que se vende, y lo que no ──────────────────────────────────────────
-- Solo COLORES: pelo, ojos, tinta del tatuaje y ropa. Añadir un color es
-- añadir una entrada a una lista; añadir un peinado es dibujar SVG nuevo, que
-- es otro trabajo y vendra despues.
--
-- El color de PIEL no se vende, y no por falta de sitio. Vender el color de
-- piel de tu personaje es un sitio al que no hay que ir.
--
-- ── Como se sabe cual es de pago ──────────────────────────────────────────
-- No hay lista. `LOOK_N` en `brute-combate.js` dice cuantas opciones vienen de
-- casa y las tablas del arte son mas largas: premium = indice >= LOOK_N. Se
-- deriva, asi que no puede desincronizarse el dia que se añada un color y a
-- alguien se le olvide apuntarlo — que no falla, solo lo regala.
--
--     players.aspectos    lo que POSEES   {"hairC": [8, 9], "eyeC": [10]}
--     brutes.look         lo que LLEVA ese bruto
--
-- Mismo reparto que las armas y las skins desde el paso 14, y con la misma
-- diferencia que las skins: un color comprado NO se gasta al ponerlo. Puedes
-- vestir a tus tres brutos con el mismo oro sin comprarlo tres veces.
-- ══════════════════════════════════════════════════════════════════════════

alter table players add column if not exists aspectos jsonb not null default '{}'::jsonb;


-- ══════════════════════════════════════════════════════════════════════════
-- CAMBIAR EL ASPECTO
-- ══════════════════════════════════════════════════════════════════════════
-- Cobrar, dar lo comprado y aplicar el aspecto tienen que pasar juntas o
-- ninguna. Con `for update`, dos peticiones simultaneas no pueden comprar el
-- mismo color pagando una vez — que es el hueco por el que se duplica
-- cualquier cosa en este proyecto.
--
-- ── Por que el precio llega calculado desde fuera ─────────────────────────
-- Porque la tabla de que es premium y a cuanto vive en `brute-combate.js`, y
-- Postgres no la conoce. Es lo mismo que ya pasa con las armas y las skins.
--
-- Lo que SI se comprueba aqui es que lo que dice comprar no lo tenga YA: si lo
-- tuviera, el precio que trae estaria calculado sobre datos viejos y se le
-- cobraria de mas. Se rechaza en vez de cobrar: el jugador reintenta y paga lo
-- justo.
create or replace function aspecto_cambiar(
  p_owner text, p_bruto bigint, p_look jsonb, p_compra jsonb, p_precio bigint)
returns json
language plpgsql
security definer
as $$
declare
  v_saldo  bigint;
  v_tengo  jsonb;
  v_campo  text;
  v_idx    jsonb;
  v_i      jsonb;
  v_suyos  jsonb;
begin
  if p_precio is null or p_precio < 0 then raise exception 'precio_invalido'; end if;
  if p_look is null or jsonb_typeof(p_look) <> 'object' then raise exception 'aspecto_invalido'; end if;

  -- El bruto tiene que ser suyo. Se filtra por dueño en la misma consulta para
  -- no confirmarle a nadie que existe el bruto de otro.
  perform 1 from brutes where id = p_bruto and owner = p_owner;
  if not found then raise exception 'no_es_tuyo'; end if;

  select coins, coalesce(aspectos, '{}'::jsonb) into v_saldo, v_tengo
    from players where address = p_owner for update;
  if not found then raise exception 'sin_jugador'; end if;
  if v_saldo < p_precio then raise exception 'sin_saldo'; end if;

  -- Lo que compra no puede tenerlo ya: ver la nota de arriba.
  if p_compra is not null and jsonb_typeof(p_compra) = 'object' then
    for v_campo, v_idx in select * from jsonb_each(p_compra) loop
      v_suyos := coalesce(v_tengo -> v_campo, '[]'::jsonb);
      for v_i in select * from jsonb_array_elements(v_idx) loop
        if v_suyos @> v_i then raise exception 'ya_lo_tienes:%', v_campo; end if;
        v_suyos := v_suyos || v_i;
      end loop;
      v_tengo := jsonb_set(v_tengo, array[v_campo], v_suyos, true);
    end loop;
  end if;

  update players set coins = coins - p_precio, aspectos = v_tengo
   where address = p_owner;
  update brutes  set look = p_look
   where id = p_bruto and owner = p_owner;

  return json_build_object('bruto', p_bruto, 'look', p_look,
                           'balance', v_saldo - p_precio, 'aspectos', v_tengo);
end;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- EL VOCABULARIO: 'aspecto' tiene que existir en los TRES sitios
-- ══════════════════════════════════════════════════════════════════════════
-- Un tipo de movimiento vive en tres: la Edge Function lo escribe, esta lista
-- blanca lo permite, y `app.html` le pone etiqueta en tres idiomas. Si uno se
-- desincroniza NO FALLA NADA VISIBLE: `apuntar` se traga los errores a
-- proposito —el jugador ya pago, quedarse sin apunte es molesto pero perder la
-- compra seria peor— asi que el resultado es un historial con huecos y ninguna
-- alarma. El ataque 15 del banco lee los tres ficheros y lo compara.
--
-- Se recrea la funcion ENTERA aqui en vez de editar el paso 13: aquel esta
-- aplicado y nadie lo va a volver a pegar. Un cambio en un fichero que ya paso
-- es un cambio que no ocurre.
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
    raise exception 'movimiento sin direccion';
  end if;

  /* Esta lista es la del paso 27 MAS `aspecto`, no una copia del 13. Al
     escribir esto se copio el cuerpo del 13 y se perdieron `arma_rota` y
     `mascota_muerta`, que habia añadido el 27 — recrear una funcion desde una
     copia vieja borra en silencio lo que se añadio en medio, y no habria
     fallado nada: solo habrian dejado de apuntarse las armas rotas. */
  if p_tipo not in ('compra_arma','compra_plaza','retirada','skin','torneo',
                    'mascota','aspecto','ajuste','arma_rota','mascota_muerta') then
    raise exception 'tipo de movimiento desconocido: %', p_tipo;
  end if;

  insert into movimientos (address, tipo, concepto, monedas, meta, ref)
  values (p_address, p_tipo, coalesce(left(p_concepto, 64), ''),
          coalesce(p_monedas, 0), p_meta, p_ref)
  returning id into v_id;

  return v_id;
end;
$$;

-- Y su revoke, porque `create or replace` acaba de volver a concederselo a
-- PUBLIC. Es la misma trampa de abajo, y hay que repetirla por cada funcion
-- que se recree — no basta con revocar una.
revoke execute on function movimiento_apuntar(text, text, text, bigint, jsonb, bigint)
  from public, anon, authenticated;
grant  execute on function movimiento_apuntar(text, text, text, bigint, jsonb, bigint)
  to service_role;


-- ══════════════════════════════════════════════════════════════════════════
-- LA TRAMPA DE SIEMPRE
-- ══════════════════════════════════════════════════════════════════════════
-- En Postgres una funcion nace ejecutable por PUBLIC y `create or replace`
-- vuelve a concederlo. Hay que revocar CADA VEZ que se recrea. Abierta a anon,
-- cualquiera se regalaria todos los colores y le cambiaria la cara al bruto de
-- otro.
revoke execute on function aspecto_cambiar(text, bigint, jsonb, jsonb, bigint)
  from public, anon, authenticated;
grant  execute on function aspecto_cambiar(text, bigint, jsonb, jsonb, bigint)
  to service_role;


-- ══════════════════════════════════════════════════════════════════════════
-- Comprobacion — la primera tiene que dar CERO filas
-- ══════════════════════════════════════════════════════════════════════════
select p.proname as abierta_de_mas
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'aspecto_cambiar'
   and (has_function_privilege('anon',   p.oid, 'execute')
     or has_function_privilege('public', p.oid, 'execute'));

select column_name, data_type, column_default
  from information_schema.columns
 where table_name = 'players' and column_name = 'aspectos';

-- Y que `movimiento_apuntar` tampoco se haya quedado abierta al recrearla.
select p.proname as abierta_de_mas
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'movimiento_apuntar'
   and (has_function_privilege('anon',   p.oid, 'execute')
     or has_function_privilege('public', p.oid, 'execute'));
