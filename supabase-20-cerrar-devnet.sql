-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 20 — cerrar las pruebas de devnet y limpiar
-- ══════════════════════════════════════════════════════════════════════════
-- Supabase → SQL Editor → New query → pegar → Run.
--
-- La retirada on-chain quedó probada contra devnet: los $BRUTE salen de la
-- wallet operativa y llegan a la del jugador, el destino sale siempre de la
-- sesión y nunca del navegador, y dos retiradas simultáneas solo cobran una.
--
-- Esto deshace el montaje de pruebas.
--
--   ⚠️  Después de esto `retiradas_abiertas` vuelve a FALSE. Ahí se queda hasta
--       que exista el token de MAINNET y su tesoro, que son cosas del dueño.
--
-- ── Por LISTA BLANCA, y no al revés ───────────────────────────────────────
-- Se conservan cuatro direcciones y se borra todo lo demás. Enumerar las de
-- prueba —que son trece y salieron de seis tandas distintas— es donde se
-- escapa una y queda basura en la clasificación para siempre.
--
-- La lista está comprobada: esas cuatro son las dueñas de los cinco brutos
-- reales (Arbitrado, Sala7huk, tito, Iconok5i, tita).
-- ══════════════════════════════════════════════════════════════════════════

create temp table _conservar (address text primary key);
insert into _conservar values
  ('7bXra6gaZi5rGvwgdyzyVd9vWKuUx5cKDNneXV8v2reZ'),  -- tu wallet (tito, tita)
  ('CCYXMEnhKZjH5WW43YnP3pizAyVz7sGM6RyASMdyvmCx'),  -- Arbitrado
  ('HkSPFBiesxW21tpaMcUTnjrBHcocb843u1wSRkFKQ24t'),  -- Sala7huk
  ('2EiWESwFsZpLBUzFe9T2Gkhh4uUpQ6rcdCJk3WUTes51');  -- Iconok5i


-- ── Red de seguridad ──────────────────────────────────────────────────────
-- Si la lista blanca no cubriera a los dueños de todos los brutos reales,
-- esto para el script antes de borrar nada. Mejor un error que descubrir
-- mañana que faltan brutos.
do $$
declare v_huerfanos int;
begin
  select count(*) into v_huerfanos
    from brutes b
   where b.owner not in (select address from _conservar)
     and b.name in ('Arbitrado','Sala7huk','tito','Iconok5i','tita');
  if v_huerfanos > 0 then
    raise exception 'PARA: % brutos reales quedarian fuera de la lista blanca', v_huerfanos;
  end if;
end $$;


select 'ANTES' as momento,
       (select count(*) from players)     as jugadores,
       (select count(*) from brutes)      as brutos,
       (select count(*) from withdrawals) as retiradas,
       (select coalesce(sum(coins),0) from players) as en_circulacion;


-- En este orden: las peleas apuntan a los brutos y los brutos a su dueño.
delete from fights      where a_owner not in (select address from _conservar);
delete from withdrawals where address not in (select address from _conservar);
delete from movimientos where address not in (select address from _conservar);
delete from brutes      where owner   not in (select address from _conservar);
delete from players     where address not in (select address from _conservar);
delete from sessions    where address not in (select address from _conservar);
delete from auth_nonces where address not in (select address from _conservar);

-- Las retiradas de devnet tampoco son reales: los tokens que movieron no valen
-- nada. Dejarlas ensuciaria para siempre las estadisticas de retirada.
delete from movimientos where tipo = 'retirada'
   and ref in (select id from withdrawals where red in ('devnet','simulacro'));
delete from withdrawals where red in ('devnet','simulacro');

-- La emision del dia era de mis peleas de prueba.
delete from emision;


-- ══════════════════════════════════════════════════════════════════════════
-- Volver a producción, con la puerta cerrada
-- ══════════════════════════════════════════════════════════════════════════
update economia
   set red                = 'devnet',
       retiradas_abiertas = false,      -- ← cerrada hasta que exista mainnet
       minimo_retirada    = 100,
       tope_jugador_dia   = 1000,
       tope_global_dia    = 20000,
       retirado_total     = 0,          -- lo retirado era de devnet
       reserva_seguridad  = 5000000,
       actualizado = now()
 where id = 1;

update economia
   set reserva_restante = reserva_total
                          - (select coalesce(sum(coins),0) from players)
 where id = 1;


select 'DESPUES' as momento,
       (select count(*) from players)     as jugadores,
       (select count(*) from brutes)      as brutos,
       (select count(*) from withdrawals) as retiradas,
       (select coalesce(sum(coins),0) from players) as en_circulacion,
       (select reserva_restante from economia where id=1) as reserva,
       -- Tiene que dar EXACTAMENTE 40.000.000.
       (select coalesce(sum(coins),0) from players)
         + (select reserva_restante from economia where id=1) as suma_debe_dar_40M,
       (select retiradas_abiertas from economia where id=1) as puerta;

drop table _conservar;
