-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 22 — limpiar las pruebas de los torneos
-- ══════════════════════════════════════════════════════════════════════════
-- Supabase → SQL Editor → New query → pegar → Run.
--
-- Probar los torneos exigio cuentas de verdad: entrar firmando, forjar un
-- bruto, pelear hasta juntar la entrada y apuntarse. Son unas quince cuentas
-- repartidas en varias tandas.
--
-- ── Por LISTA BLANCA ──────────────────────────────────────────────────────
-- Se conservan cuatro direcciones y se borra el resto. Enumerar las de prueba
-- es donde se escapa una y queda basura en la clasificacion para siempre.
-- ══════════════════════════════════════════════════════════════════════════

create temp table _conservar (address text primary key);
insert into _conservar values
  ('7bXra6gaZi5rGvwgdyzyVd9vWKuUx5cKDNneXV8v2reZ'),  -- tu wallet
  ('CCYXMEnhKZjH5WW43YnP3pizAyVz7sGM6RyASMdyvmCx'),  -- Arbitrado
  ('HkSPFBiesxW21tpaMcUTnjrBHcocb843u1wSRkFKQ24t'),  -- Sala7huk
  ('2EiWESwFsZpLBUzFe9T2Gkhh4uUpQ6rcdCJk3WUTes51');  -- Iconok5i


-- Red de seguridad: si algun bruto REAL quedara fuera de la lista, para antes
-- de borrar nada. Mejor un error que descubrir mañana que faltan brutos.
do $$
declare v int;
begin
  select count(*) into v from brutes b
   where b.owner not in (select address from _conservar)
     and b.name in ('Arbitrado','Sala7huk','Iconok5i','tito','tita');
  if v > 0 then raise exception 'PARA: % brutos reales quedarian fuera', v; end if;
end $$;


select 'ANTES' as momento,
       (select count(*) from players)            as jugadores,
       (select count(*) from brutes)             as brutos,
       (select count(*) from tournaments)        as torneos,
       (select count(*) from tournament_entries) as inscripciones,
       (select coalesce(sum(coins),0) from players) as en_circulacion;


-- ── Los torneos de prueba ─────────────────────────────────────────────────
-- Se borran ENTEROS: las inscripciones y el cuadro se van solos por
-- `on delete cascade`. Y da igual que tuvieran gente apuntada, porque esa
-- gente son mis cuentas, que tambien se van.
delete from tournaments;

-- ── Las cuentas de prueba ─────────────────────────────────────────────────
delete from fights      where a_owner not in (select address from _conservar);
delete from withdrawals where address not in (select address from _conservar);
delete from movimientos where address not in (select address from _conservar);
delete from brutes      where owner   not in (select address from _conservar);
delete from players     where address not in (select address from _conservar);
delete from sessions    where address not in (select address from _conservar);
delete from auth_nonces where address not in (select address from _conservar);

-- La emision del dia era de mis peleas de prueba.
delete from emision;


-- ── Cuadrar la reserva ────────────────────────────────────────────────────
-- Las monedas de las cuentas borradas dejan de existir, asi que la reserva
-- vuelve a ser todo lo que no esta en manos de nadie.
update economia
   set reserva_restante  = reserva_total
                           - (select coalesce(sum(coins),0) from players),
       reserva_seguridad = 5000000,
       retirado_total    = 0,
       actualizado = now()
 where id = 1;


select 'DESPUES' as momento,
       (select count(*) from players)     as jugadores,
       (select count(*) from brutes)      as brutos,
       (select count(*) from tournaments) as torneos,
       (select coalesce(sum(coins),0) from players) as en_circulacion,
       (select reserva_restante from economia where id=1) as reserva,
       -- Tiene que dar EXACTAMENTE 40.000.000.
       (select coalesce(sum(coins),0) from players)
         + (select reserva_restante from economia where id=1) as suma_debe_dar_40M,
       (select retiradas_abiertas from economia where id=1) as puerta;

drop table _conservar;
