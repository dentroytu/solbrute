-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 33 — cuatro armas mas
-- ══════════════════════════════════════════════════════════════════════════
-- Supabase → SQL Editor → New query → pegar → Run. Repetible.
--
-- ANTES de redesplegar la Edge Function. Si se despliega primero, el servidor
-- intentara equipar un hacha y Postgres la rechazara: el jugador pagaria y no
-- podria ponersela.
--
-- ── Lo que bloqueaba ──────────────────────────────────────────────────────
-- El paso 9 puso una lista cerrada:
--
--     check (arma in ('ninguna','daga','mandoble','lanza','escudo'))
--
-- Esta bien que exista —impide que un `arma` inventado entre en la tabla— pero
-- hay que abrirla cada vez que se añade una. Es el precio de tener la lista en
-- dos sitios, y se paga a proposito: la alternativa es que el navegador pueda
-- escribir cualquier cosa en esa columna.
--
-- ── Las nuevas ────────────────────────────────────────────────────────────
--     hacha     brutal y critica, pero se te cae mucho y se rompe pronto
--     maza      lenta de verdad y solida: aguanta y casi no se rompe
--     guadana   dos tajos amplios, la mas fragil de todas
--     baston    defensivo y velocisimo, pega poquisimo, dura 50 combates
--
-- Sin eñe en el identificador: `guadana`, no `guadaña`. El editor de Supabase
-- mangla el UTF-8 al pegar y un identificador con eñe ya tumbo un despliegue
-- entero en este proyecto (`UnexpectedChar { c: '√' }`).
--
-- Las nueve estan medidas entre 48,5% y 50,9% enfrentandolas todas contra
-- todas. Los daños de las CINCO VIEJAS tambien cambiaron: estaban cuadradas
-- entre ellas, y eso deja de valer cuando entran cuatro mas.
-- ══════════════════════════════════════════════════════════════════════════

alter table brutes drop constraint if exists brutes_arma_check;
alter table brutes add constraint brutes_arma_check
  check (arma in ('ninguna','daga','mandoble','lanza','escudo',
                  'hacha','maza','guadana','baston'));


-- ══════════════════════════════════════════════════════════════════════════
-- Comprobacion — la primera tiene que dar las nueve
-- ══════════════════════════════════════════════════════════════════════════
select pg_get_constraintdef(oid) as lista_permitida
  from pg_constraint where conname = 'brutes_arma_check';

-- Y que no haya quedado ningun bruto con un arma que ya no vale. Cero filas.
select id, name, arma from brutes
 where arma is not null
   and arma not in ('ninguna','daga','mandoble','lanza','escudo',
                    'hacha','maza','guadana','baston');
