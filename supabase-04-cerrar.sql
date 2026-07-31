-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 4 — CERRAR LA PUERTA
-- ══════════════════════════════════════════════════════════════════════════
--
--   ⚠️  ESTE VA EL ÚLTIMO. Antes tienen que estar hechos:
--         · supabase-03-auth.sql   (tabla de nonces)
--         · supabase-05-sesiones.sql (tabla de sesiones)
--         · la Edge Function "auth" desplegada
--         · el juego actualizado en GitHub Pages
--
--       Si lo aplicas antes, nadie podrá escribir nada y el juego quedará de
--       solo lectura hasta que el resto esté en su sitio. Al final del fichero
--       está la marcha atrás.
--
-- ── Qué cambia ────────────────────────────────────────────────────────────
-- Hasta ahora las políticas decían "que escriba cualquiera", porque no había
-- forma de saber quién era quién.
--
-- Ahora el navegador NO ESCRIBE. Punto. Ni el tuyo ni el de nadie. Todas las
-- escrituras pasan por la Edge Function, que comprueba tu firma primero y tu
-- token de sesión después, y escribe con service_role — que se salta RLS
-- porque vive en el servidor, donde el usuario no manda.
--
-- Leer sigue siendo público: la clasificación y los rivales tienen que verse.
-- Ahí no hay nada sensible, solo direcciones públicas y monedas de juguete.
--
-- ── Por qué así y no con permisos por fila ────────────────────────────────
-- El plan original era emitir un JWT que Supabase entendiera y dejar que
-- Postgres comparase tu dirección con la columna owner. No se puede: este
-- proyecto migró a claves de firma asimétricas (ECC P-256) y esa clave
-- privada la gestiona Supabase sin entregarla.
--
-- Este camino sale mejor. Con el JWT, el navegador escribía directamente y
-- solo se le impedía tocar filas ajenas: podía mentir cuanto quisiera sobre
-- las suyas. Ahora hay un servidor en medio que puede decir que no.
--
-- ── Lo que sigue sin estar cerrado ────────────────────────────────────────
-- El combate lo calcula el navegador y el servidor se lo cree. Recorta lo
-- imposible (nivel 9999, fuerza 500, vida infinita) pero no arbitra: puedes
-- darte monedas o victorias en tus propios brutos. Cerrarlo es mover
-- simulate() a la función. Ver BACKEND.md.
--
-- Mientras eso no esté, esto NO es seguro para dinero real.
-- ══════════════════════════════════════════════════════════════════════════


-- ─── players ──────────────────────────────────────────────────────────────
drop policy if exists players_lectura_publica     on players;
drop policy if exists players_escritura_prototipo on players;
drop policy if exists players_actualizar          on players;
drop policy if exists players_alta                on players;

create policy players_lectura on players
  for select using (true);

-- Sin políticas de insert / update / delete: en Postgres, lo que no está
-- permitido está prohibido. El navegador no puede escribir aquí de ninguna
-- forma, mande lo que mande.


-- ─── brutes ───────────────────────────────────────────────────────────────
drop policy if exists brutes_lectura_publica     on brutes;
drop policy if exists brutes_escritura_prototipo on brutes;
drop policy if exists brutes_crear               on brutes;
drop policy if exists brutes_actualizar          on brutes;
drop policy if exists brutes_borrar              on brutes;

create policy brutes_lectura on brutes
  for select using (true);

-- Igual: leer sí, escribir no. Forjar, pelear y vaciar el ludus pasan por la
-- Edge Function.


-- ══════════════════════════════════════════════════════════════════════════
-- Comprobación
-- ══════════════════════════════════════════════════════════════════════════
-- Debe salir exactamente una política por tabla, y las dos de SELECT.
-- Si aparece alguna de INSERT, UPDATE o DELETE, algo quedó sin borrar.
select tablename, policyname, cmd
  from pg_policies
 where tablename in ('players','brutes')
 order by tablename;

-- Y estas cuatro tablas deben tener RLS activo:
select relname as tabla, relrowsecurity as rls_activo
  from pg_class
 where relname in ('players','brutes','auth_nonces','sessions');


-- ══════════════════════════════════════════════════════════════════════════
-- MARCHA ATRÁS — solo si algo se rompe y necesitas jugar mientras se arregla
-- ══════════════════════════════════════════════════════════════════════════
-- Deja la base de datos abierta otra vez. No lo dejes así: es el agujero que
-- este fichero venía a cerrar.
--
-- create policy players_escritura_prototipo on players for all using (true) with check (true);
-- create policy brutes_escritura_prototipo  on brutes  for all using (true) with check (true);
