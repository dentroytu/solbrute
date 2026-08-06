-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 39 — con QUE reglas se jugo cada pelea
-- ══════════════════════════════════════════════════════════════════════════
-- Supabase → SQL Editor → New query → pegar → Run. Repetible.
-- ANTES de redesplegar la Edge Function.
--
-- ── El agujero, que es el mismo de siempre con otra cara ──────────────────
-- Para recalcular una pelea hacen falta CUATRO cosas:
--
--     seed         ✓
--     a_snapshot   ✓   tu bruto, congelado
--     b_snapshot   ✓   el rival, congelado
--     las REGLAS   ✗   ¿con que version de `brute-combate.js` se jugo?
--
-- El paso 32 arreglo la tercera y dejo escrito que «para recalcular hacen falta
-- tres cosas y `fights` solo guardaba dos». Eran cuatro.
--
-- ── Y no es teorico: paso ayer ────────────────────────────────────────────
-- Al recalibrar las mascotas subio la VERSION de 13 a 14. Desde ese momento,
-- `pelea.html` recalcula CUALQUIER pelea vieja con las reglas nuevas, le sale
-- otro resultado, y dice:
--
--     ✗ NO CUADRA
--
-- Que es exactamente el cartel que esa pagina existe para NO tener que
-- enseñar. La promesa de la landing es «combate verificable», y el historial
-- entero pasaba a leerse como si estuviera amañado — por un cambio de
-- equilibrio que se hizo a la vista de todos.
--
-- ── Lo que arregla y lo que no ────────────────────────────────────────────
-- No hace que una pelea vieja se pueda recalcular: las reglas de la v13 ya no
-- estan en el navegador de nadie. Lo que hace es que la pagina pueda decir la
-- VERDAD — «esta pelea se jugo con la version 13 y tu navegador tiene la 14,
-- asi que no se puede comprobar» — en vez de insinuar que hay algo torcido.
--
-- Un «no cuadra» y un «no lo puedo comprobar» son cosas distintas, y
-- confundirlas en la pagina que vende honestidad es el peor sitio para
-- hacerlo.
--
-- Las peleas ya guardadas se quedan con `reglas` a NULL, y eso tambien se
-- dice tal cual: «anterior al registro de version». No se rellena a mano
-- inventando un numero — seria escribir un dato que nadie comprobo.
-- ══════════════════════════════════════════════════════════════════════════

alter table fights add column if not exists reglas smallint;

comment on column fights.reglas is
  'VERSION de brute-combate.js con la que se simulo. Sin esto, un cambio de '
  'equilibrio hace que todas las peleas anteriores salgan como «no cuadra» en '
  'pelea.html. NULL = anterior al paso 39.';

-- Sirve para responder «cuantas peleas hay de cada version», que es lo que se
-- mira el dia que alguien reporta que su pelea no se puede comprobar.
create index if not exists fights_reglas_idx on fights (reglas);


-- ══════════════════════════════════════════════════════════════════════════
-- Comprobacion
-- ══════════════════════════════════════════════════════════════════════════
select column_name, data_type, is_nullable
  from information_schema.columns
 where table_name = 'fights' and column_name = 'reglas';

-- El reparto por version. Hoy sale todo en NULL; a partir del redespliegue
-- empezaran a aparecer con su numero.
select coalesce(reglas::text, '(antes del paso 39)') as reglas,
       count(*) as peleas,
       min(created_at)::date as desde,
       max(created_at)::date as hasta
  from fights group by 1 order by 1;
