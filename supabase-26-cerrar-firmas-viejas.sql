-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 26 — cerrar las firmas viejas de comprar y equipar
-- ══════════════════════════════════════════════════════════════════════════
-- Supabase → SQL Editor → New query → pegar → Run.
--
-- ┌──────────────────────────────────────────────────────────────────────┐
-- │  ESTO VA DESPUES DE REDESPLEGAR LA EDGE FUNCTION, NO ANTES.          │
-- │  Si se lanza antes, la funcion desplegada —que todavia llama con 3   │
-- │  parametros— deja de poder comprar y equipar al instante.            │
-- └──────────────────────────────────────────────────────────────────────┘
--
-- ── Por que hace falta un paso aparte ─────────────────────────────────────
-- En Postgres, anadir un parametro NO reemplaza la funcion: crea otra. Asi
-- que despues del paso 25 conviven dos versiones de cada una:
--
--     arma_comprar(text, text, bigint)         <- la vieja, SIN candado
--     arma_comprar(text, text, bigint, int)    <- la nueva, con candado
--
-- Que la vieja siguiera viva era DELIBERADO: es lo que permite aplicar el SQL
-- sin romper la Edge Function que aun no se ha cambiado. Pero en cuanto la
-- nueva esta desplegada, esa puerta es una version de la funcion que se salta
-- el nivel entero. Y las funciones que sobran no se quedan "por si acaso": se
-- quedan hasta que alguien las llama por error.
--
-- ── Comprobacion previa ───────────────────────────────────────────────────
-- Antes de borrar nada, mira que la Edge Function nueva ESTA desplegada:
-- entra en la armeria e intenta equipar algo. Si funciona, esta llamando a la
-- de 4 parametros y puedes seguir. Si da error, no lances esto todavia.
-- ══════════════════════════════════════════════════════════════════════════

drop function if exists arma_comprar(text, text, bigint);
drop function if exists arma_equipar(text, bigint, text);
drop function if exists mascota_comprar(text, text, bigint);
drop function if exists mascota_equipar(text, bigint, text);


-- ══════════════════════════════════════════════════════════════════════════
-- Comprobacion — tiene que quedar UNA sola version de cada una,
-- la de 4 parametros, y ninguna abierta a anon ni a public
-- ══════════════════════════════════════════════════════════════════════════
select p.proname,
       pg_get_function_identity_arguments(p.oid) as firma,
       has_function_privilege('service_role', p.oid, 'execute') as la_usa_el_servidor,
       has_function_privilege('anon',         p.oid, 'execute') as abierta_a_anon,
       has_function_privilege('public',       p.oid, 'execute') as abierta_a_public
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('arma_comprar','arma_equipar','mascota_comprar','mascota_equipar')
 order by p.proname;
