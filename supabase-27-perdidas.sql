-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 27 — el historial tambien apunta lo que PIERDES
-- ══════════════════════════════════════════════════════════════════════════
-- Supabase → SQL Editor → New query → pegar → Run. Repetible.
--
-- Hasta ahora `movimientos` solo guardaba compras y retiradas: lo que sale del
-- saldo. Pero lo que de verdad hace desaparecer tus monedas no es el momento
-- de pagar, es el momento en que aquello se rompe.
--
--     compras un oso por 175        -> queda apuntado
--     el oso muere a las 30 peleas  -> no quedaba en ningun sitio
--
-- Y esa segunda linea es la que el jugador va a buscar cuando se pregunte
-- «¿donde esta mi oso?». En la arena se ve caer, pero quien le da a «saltar al
-- resultado» —o sea, todo el mundo a partir de la decima pelea— no ve nada.
--
-- ── Van con monedas = 0, y es a proposito ─────────────────────────────────
-- No son un movimiento de saldo: no te cobran nada al morir. Se apuntan para
-- que exista el rastro, no para cuadrar la contabilidad. El historial suma
-- `monedas` para enseñar el total gastado, y sumar aqui contaria la compra dos
-- veces — una al pagar y otra al perderlo.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function movimiento_apuntar(
  p_address  text,
  p_tipo     text,
  p_concepto text,
  p_monedas  bigint,
  p_meta     jsonb   default null,
  p_ref      bigint  default null
)
returns bigint
language plpgsql
security definer
as $$
declare v_id bigint;
begin
  if p_address is null or length(btrim(p_address)) = 0 then
    raise exception 'movimiento sin direccion';
  end if;

  -- La lista blanca vive aqui y solo aqui: un `tipo` inventado ensuciaria el
  -- historial y las estadisticas del panel. Los dos ultimos son nuevos.
  if p_tipo not in ('compra_arma','compra_plaza','retirada','skin','torneo',
                    'mascota','ajuste','arma_rota','mascota_muerta') then
    raise exception 'tipo de movimiento desconocido: %', p_tipo;
  end if;

  insert into movimientos (address, tipo, concepto, monedas, meta, ref)
  values (p_address, p_tipo, coalesce(left(p_concepto, 64), ''),
          coalesce(p_monedas, 0), p_meta, p_ref)
  returning id into v_id;

  return v_id;
end;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- LA TRAMPA DE SIEMPRE
-- ══════════════════════════════════════════════════════════════════════════
-- `create or replace` vuelve a conceder EXECUTE a PUBLIC. Hay que revocar cada
-- vez. Ya paso dos veces en este proyecto: el paso 8 deshizo en silencio lo que
-- habia puesto el 7.
--
-- Aqui importa especialmente: esta funcion es `security definer` y ESCRIBE en
-- una tabla que el navegador no puede ni leer. Abierta a anon, cualquiera se
-- inventaria movimientos en el historial de quien quisiera.
revoke execute on function movimiento_apuntar(text, text, text, bigint, jsonb, bigint)
  from public, anon, authenticated;
grant  execute on function movimiento_apuntar(text, text, text, bigint, jsonb, bigint)
  to service_role;


-- ══════════════════════════════════════════════════════════════════════════
-- Comprobacion — cero filas
-- ══════════════════════════════════════════════════════════════════════════
select p.proname, pg_get_function_identity_arguments(p.oid) as firma
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname = 'movimiento_apuntar'
   and (has_function_privilege('anon',   p.oid, 'execute')
     or has_function_privilege('public', p.oid, 'execute'));
