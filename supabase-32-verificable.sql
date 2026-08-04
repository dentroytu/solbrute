-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 32 — que la pelea se pueda recalcular DE VERDAD
-- ══════════════════════════════════════════════════════════════════════════
-- Supabase → SQL Editor → New query → pegar → Run. Repetible.
--
-- ── El agujero ────────────────────────────────────────────────────────────
-- La landing promete «combate verificable»: misma semilla, misma pelea, y
-- cualquiera puede recalcularla. La arquitectura lo permite desde el primer
-- dia — `simulate()` es puro y el registro se guarda entero.
--
-- Pero para recalcular hacen falta TRES cosas: la semilla y los DOS
-- combatientes tal y como estaban. Y `fights` solo guardaba uno:
--
--     b_snapshot   copia congelada del rival          ✓
--     a_brute      una REFERENCIA a tu bruto          ✗
--
-- El comentario que justifica `b_snapshot` dice «el rival sube de nivel
-- despues, y sin congelarlo la pelea dejaria de poder reproducirse». Es
-- exactamente igual de cierto para tu propio bruto, y ahi no se hizo.
--
-- Peor: `mio` se MUTA con `aplicar()` justo despues de simular —sube el nivel,
-- la experiencia, las victorias— asi que cuando se escribe la fila ya no queda
-- ni en memoria como estaba al empezar.
--
-- Resultado: la promesa era cierta en el momento (el navegador tenia el bruto
-- que acababa de mandar) y falsa un segundo despues. Nadie podia comprobar
-- nada desde fuera.
--
-- ── Lo que NO arregla ─────────────────────────────────────────────────────
-- Las peleas ya guardadas. Ese dato no existe en ningun sitio, asi que no se
-- puede reconstruir: se quedan como estan y la pagina de la pelea lo dice sin
-- rodeos en vez de fingir que las verifica.
--
-- Aplicar esto ANTES de redesplegar la Edge Function no rompe nada: la columna
-- admite nulos y las peleas nuevas la rellenan en cuanto se despliegue.
-- ══════════════════════════════════════════════════════════════════════════

-- Tu bruto tal y como entro a la arena: antes de subir de nivel, antes de que
-- se rompiera el arma, antes de todo. Es la pieza que faltaba.
alter table fights add column if not exists a_snapshot jsonb;

comment on column fights.a_snapshot is
  'Copia congelada de A ANTES del combate. Con esto, seed + a_snapshot + b_snapshot recalculan la pelea entera.';


-- ══════════════════════════════════════════════════════════════════════════
-- Comprobacion
-- ══════════════════════════════════════════════════════════════════════════
-- La primera consulta dice cuantas peleas se pueden verificar y cuantas no.
-- Justo despues de aplicar esto seran todas «no»: las nuevas empiezan a
-- contar cuando se despliegue la funcion.
select count(*) filter (where a_snapshot is not null) as verificables,
       count(*) filter (where a_snapshot is null)     as antiguas,
       count(*)                                       as total
  from fights;

-- Y que la politica de lectura publica sigue en pie: la pagina de la pelea lee
-- directamente, sin pasar por la Edge Function. Una pelea la ve el rival igual
-- que tu, asi que no hay nada que decidir.
select policyname, cmd
  from pg_policies where tablename = 'fights';
