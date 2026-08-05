-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 35 — la segunda arma de cada familia
-- ══════════════════════════════════════════════════════════════════════════
-- Supabase → SQL Editor → New query → pegar → Run. Repetible.
-- ANTES de redesplegar la Edge Function, o el servidor intentara equipar un
-- martillo y Postgres lo rechazara: el jugador paga y no puede ponerselo.
--
-- ── Por que hay que tocar esto cada vez ───────────────────────────────────
-- `brutes.arma` lleva un `check` con la lista cerrada. Esta bien que exista
-- —impide que un `arma` inventado entre en la tabla— pero obliga a abrirlo al
-- añadir armas. Es el precio de tener la lista en dos sitios, y se paga a
-- proposito: la alternativa es que el navegador pueda escribir cualquier cosa.
--
-- Las skins no tienen este problema porque se validan por RANGO (0..9).
--
-- ── Las ocho nuevas ───────────────────────────────────────────────────────
--     estoque     nv 18   la daga son dos golpes flojos; esto es UNO y critico
--     paves       nv 22   protege muchisimo mas que el escudo y casi no pega
--     caballero   nv 25   fiable y se defiende sola, frente al mandoble bruto
--     tridente    nv 30   TRES golpes muy flojos
--     hachadoble  nv 35   dos golpes y se cae mas que ninguna
--     martillo    nv 40   lentisimo (ini -5) y demoledor
--     guerra      nv 50   un tajo enorme, de cristal
--     herrado     nv 60   pega de verdad y pierde la defensa del baston
--
-- NO son mejores: son otro trato. Las diecisiete estan medidas entre 47,5% y
-- 52% enfrentandolas todas contra todas, y ninguna se queda sin victimas ni
-- sin verdugos. Si la de nivel 60 pegara mas, las otras dieciseis serian
-- decoracion y comprar seria ganar.
-- ══════════════════════════════════════════════════════════════════════════

alter table brutes drop constraint if exists brutes_arma_check;
alter table brutes add constraint brutes_arma_check
  check (arma in ('ninguna','daga','mandoble','lanza','escudo',
                  'hacha','maza','guadana','baston',
                  'estoque','paves','caballero','tridente',
                  'hachadoble','martillo','guerra','herrado'));


-- ══════════════════════════════════════════════════════════════════════════
-- Comprobacion
-- ══════════════════════════════════════════════════════════════════════════
select pg_get_constraintdef(oid) as lista_permitida
  from pg_constraint where conname = 'brutes_arma_check';

-- Cero filas: ningun bruto con un arma que ya no vale.
select id, name, arma from brutes
 where arma is not null
   and arma not in ('ninguna','daga','mandoble','lanza','escudo',
                    'hacha','maza','guadana','baston',
                    'estoque','paves','caballero','tridente',
                    'hachadoble','martillo','guerra','herrado');
