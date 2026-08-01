-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 10 — cerrar funciones que quedaron abiertas
-- ══════════════════════════════════════════════════════════════════════════
-- Supabase → SQL Editor → New query → pegar → Run. Repetible.
--
-- Encontrado haciendo una revisión de seguridad completa: `limpiar_nonces()` y
-- `limpiar_sesiones()` son `security definer` —se saltan RLS— y se podían
-- llamar con la clave pública. Un `POST /rest/v1/rpc/limpiar_sesiones` desde
-- cualquier sitio devolvía 200.
--
-- El daño directo es pequeño (solo borran filas ya caducadas), pero:
--   · son funciones privilegiadas al alcance de cualquiera
--   · se pueden llamar en bucle para dar trabajo a la base de datos
--   · y sobre todo: el patrón es el mismo que el de `admin_resumen`, que sí
--     filtraba las estadísticas del juego. Si se escapa una, se escapan más.
--
-- Es la misma trampa de siempre y por eso se repite aquí: en Postgres una
-- función nace ejecutable por PUBLIC, y revocar a `anon` no quita ese permiso.
-- Hay que revocar a `public` explícitamente, y REPETIRLO cada vez que se haga
-- `create or replace` de la función.
-- ══════════════════════════════════════════════════════════════════════════

revoke execute on function limpiar_nonces()   from public;
revoke execute on function limpiar_nonces()   from anon, authenticated;
grant  execute on function limpiar_nonces()   to service_role;

revoke execute on function limpiar_sesiones() from public;
revoke execute on function limpiar_sesiones() from anon, authenticated;
grant  execute on function limpiar_sesiones() to service_role;

-- Y por si acaso, las otras dos otra vez: son idempotentes y más vale
-- repetirlas que descubrir dentro de un mes que un `create or replace` las
-- volvió a abrir.
revoke execute on function admin_resumen() from public;
revoke execute on function admin_resumen() from anon, authenticated;
grant  execute on function admin_resumen() to service_role;

revoke execute on function admin_armas() from public;
revoke execute on function admin_armas() from anon, authenticated;
grant  execute on function admin_armas() to service_role;


-- ══════════════════════════════════════════════════════════════════════════
-- Comprobación: qué funciones propias quedan al alcance del navegador
-- ══════════════════════════════════════════════════════════════════════════
-- Lo ideal es que esta consulta no devuelva NINGUNA fila. Si aparece alguna,
-- es que se puede llamar con la clave pública.
select p.proname as funcion,
       has_function_privilege('anon',   p.oid, 'execute') as la_puede_llamar_anon,
       has_function_privilege('public', p.oid, 'execute') as la_puede_llamar_public
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('admin_resumen','admin_armas','limpiar_nonces','limpiar_sesiones')
   and (has_function_privilege('anon', p.oid, 'execute')
        or has_function_privilege('public', p.oid, 'execute'));
