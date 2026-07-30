-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 4 — CERRAR LA PUERTA
-- ══════════════════════════════════════════════════════════════════════════
--
--   ⚠️  ESTE ES EL ÚLTIMO. No lo ejecutes hasta haber comprobado que puedes
--       entrar firmando con tu wallet. Si lo aplicas antes, nadie podrá
--       escribir nada y el juego quedará de solo lectura hasta que el login
--       funcione.
--
--       Si lo aplicas y algo va mal: al final del fichero está el SQL para
--       volver atrás.
--
-- ── Qué cambia ────────────────────────────────────────────────────────────
-- Hasta ahora las políticas decían "que escriba cualquiera", porque no había
-- forma de saber quién era quién. Ahora sí la hay: la Edge Function comprueba
-- tu firma y emite un token con tu dirección dentro, en el campo "wallet".
--
-- A partir de aquí Postgres compara ese campo con la columna owner de cada
-- fila. Puedes tocar las tuyas. Las de los demás, no. Y no es una comprobación
-- del navegador —que se salta con la consola abierta— sino de la base de
-- datos, que es donde no manda el usuario.
--
-- ── Lo que este fichero NO arregla ────────────────────────────────────────
-- El combate lo sigue calculando el navegador. Un tramposo ya no puede tocar
-- brutos ajenos, pero sí puede mentir sobre los suyos: darse monedas, XP o
-- victorias. Cerrar eso es mover simulate() al servidor. Ver BACKEND.md.
-- Mientras no esté hecho, esto NO es seguro para dinero real.
-- ══════════════════════════════════════════════════════════════════════════


-- ─── players ──────────────────────────────────────────────────────────────
drop policy if exists players_lectura_publica    on players;
drop policy if exists players_escritura_prototipo on players;

-- Leer: todo el mundo. Hace falta para la clasificación y el emparejamiento,
-- y no hay nada sensible: direcciones públicas y monedas de juguete.
create policy players_lectura on players
  for select using (true);

-- Cambiar tus monedas: solo tú, y solo tu fila.
-- El "with check" es tan necesario como el "using": sin él podrías coger tu
-- fila y reescribirle la dirección para apropiarte de otra cuenta.
create policy players_actualizar on players
  for update to authenticated
  using       ((auth.jwt() ->> 'wallet') = address)
  with check  ((auth.jwt() ->> 'wallet') = address);

-- Darse de alta: solo a tu propio nombre. En la práctica lo hace la Edge
-- Function al verificar la firma, pero la política tiene que aguantar sola.
create policy players_alta on players
  for insert to authenticated
  with check ((auth.jwt() ->> 'wallet') = address);

-- Nadie borra jugadores desde el navegador: no hay política de delete.


-- ─── brutes ───────────────────────────────────────────────────────────────
drop policy if exists brutes_lectura_publica    on brutes;
drop policy if exists brutes_escritura_prototipo on brutes;

-- Leer: todo el mundo. Los rivales y la clasificación son públicos por diseño.
create policy brutes_lectura on brutes
  for select using (true);

-- Forjar: solo brutos tuyos.
create policy brutes_crear on brutes
  for insert to authenticated
  with check ((auth.jwt() ->> 'wallet') = owner);

-- Modificar: solo los tuyos, y sin poder regalárselos a otro.
create policy brutes_actualizar on brutes
  for update to authenticated
  using       ((auth.jwt() ->> 'wallet') = owner)
  with check  ((auth.jwt() ->> 'wallet') = owner);

-- Borrar: solo los tuyos. Lo usa el botón de vaciar ludus.
create policy brutes_borrar on brutes
  for delete to authenticated
  using ((auth.jwt() ->> 'wallet') = owner);


-- ══════════════════════════════════════════════════════════════════════════
-- Comprobación rápida
-- ══════════════════════════════════════════════════════════════════════════
-- Debe listar 3 políticas en players y 4 en brutes.
select tablename, policyname, cmd, roles
  from pg_policies
 where tablename in ('players','brutes')
 order by tablename, cmd;


-- ══════════════════════════════════════════════════════════════════════════
-- MARCHA ATRÁS — solo si algo se rompe y necesitas jugar mientras se arregla
-- ══════════════════════════════════════════════════════════════════════════
-- Descomenta y ejecuta. Deja la base de datos abierta otra vez, como estaba.
-- No lo dejes así: es exactamente el agujero que este fichero venía a cerrar.
--
-- drop policy if exists players_actualizar on players;
-- drop policy if exists players_alta       on players;
-- drop policy if exists brutes_crear       on brutes;
-- drop policy if exists brutes_actualizar  on brutes;
-- drop policy if exists brutes_borrar      on brutes;
-- create policy players_escritura_prototipo on players for all using (true) with check (true);
-- create policy brutes_escritura_prototipo  on brutes  for all using (true) with check (true);
