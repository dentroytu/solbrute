-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 24 — limpiar las pruebas de mascotas y del dominio
-- ══════════════════════════════════════════════════════════════════════════
-- Supabase → SQL Editor → New query → pegar → Run. Repetible.
--
-- Probar el turno propio de la mascota, el despliegue de la VERSION 8 y la
-- lista blanca de `solbrute.io` exigio cuentas de verdad: entrar firmando con
-- claves ed25519 desechables, forjar un bruto y pelear. Son unas trece.
--
-- ── Por LISTA BLANCA, no por lista negra ──────────────────────────────────
-- Se conservan cuatro direcciones y se borra el resto. Enumerar las de prueba
-- es donde se escapa una y queda basura en la clasificacion para siempre.
--
-- Es la misma forma del paso 22, y a proposito: un fichero de borrado que se
-- lee igual que el anterior es un fichero que se revisa de un vistazo.
--
-- ── Ojo con la trampa del 204 ─────────────────────────────────────────────
-- No mires el mensaje de exito: mira el bloque DESPUES del final. RLS no da
-- error, hace las filas invisibles, y un borrado que no borro nada tiene el
-- mismo aspecto que uno que si.
-- ══════════════════════════════════════════════════════════════════════════

create temp table _conservar (address text primary key);
insert into _conservar values
  ('7bXra6gaZi5rGvwgdyzyVd9vWKuUx5cKDNneXV8v2reZ'),  -- tu wallet (bruto: tito)
  ('CCYXMEnhKZjH5WW43YnP3pizAyVz7sGM6RyASMdyvmCx'),  -- Arbitrado
  ('HkSPFBiesxW21tpaMcUTnjrBHcocb843u1wSRkFKQ24t'),  -- Sala7huk
  ('2EiWESwFsZpLBUzFe9T2Gkhh4uUpQ6rcdCJk3WUTes51');  -- Iconok5i


-- ── Red de seguridad ──────────────────────────────────────────────────────
-- Si algun bruto REAL quedara fuera de la lista, para antes de borrar nada.
-- Mejor un error hoy que descubrir mañana que falta un bruto.
do $$
declare v int;
begin
  select count(*) into v from brutes b
   where b.owner not in (select address from _conservar)
     and b.name in ('Arbitrado','Sala7huk','Iconok5i','tito','tita');
  if v > 0 then raise exception 'PARA: % brutos reales quedarian fuera', v; end if;
end $$;


select 'ANTES' as momento,
       (select count(*) from players) as jugadores,
       (select count(*) from brutes)  as brutos,
       (select count(*) from fights)  as peleas,
       (select coalesce(sum(coins),0) from players) as en_circulacion;


-- ── Las cuentas de prueba ─────────────────────────────────────────────────
-- El orden importa: primero lo que apunta a un jugador, al final el jugador.
delete from fights      where a_owner not in (select address from _conservar);
delete from withdrawals where address not in (select address from _conservar);
delete from movimientos where address not in (select address from _conservar);
delete from brutes      where owner   not in (select address from _conservar);
delete from players     where address not in (select address from _conservar);
delete from sessions    where address not in (select address from _conservar);
delete from auth_nonces where address not in (select address from _conservar);


-- ── Cuadrar la reserva ────────────────────────────────────────────────────
-- Las monedas de las cuentas borradas dejan de existir, asi que la reserva
-- vuelve a ser todo lo que no esta en manos de nadie.
--
-- ── OJO: la invariante NO es la que parece ────────────────────────────────
-- La primera version de este fichero escribia
--     reserva_restante = reserva_total - en_circulacion
-- y esta MAL, porque no ve el fondo de garantia. Cuando un jugador gasta,
-- `emision_reciclar` manda el 90% al pool y el 10% AL FONDO. Ese 10% sale del
-- circuito de recompensas y no puede volver a la reserva.
--
-- La invariante de verdad es:
--
--     en circulacion + reserva restante + (fondo - 5.000.000) = 40.000.000
--
-- Comprobado en vivo antes de escribir esto: 494 + 39.999.499 + 7 = 40.000.000,
-- y esos 7 son el 10% del lobo de 70 monedas que se compro el dueño.
--
-- Con la formula ingenua la reserva habria acabado 7 monedas por encima: siete
-- monedas creadas de la nada. Es calderilla, pero es EXACTAMENTE el error que
-- dejo la reserva en 40.000.117 en su dia — devolver a la reserva algo que no
-- salio de ella. Ver «La invariante, y el fallo que la rompio el primer dia».
--
-- El fondo NO se toca: esos 7 son reales y tienen que seguir ahi.
update economia
   set reserva_restante = reserva_total
                          - (select coalesce(sum(coins),0) from players)
                          - (reserva_seguridad - 5000000),
       actualizado = now()
 where id = 1;


-- ══════════════════════════════════════════════════════════════════════════
-- Comprobacion — esto es lo que hay que mirar, no el "Success"
-- ══════════════════════════════════════════════════════════════════════════
select 'DESPUES' as momento,
       (select count(*) from players) as jugadores,      -- debe dar 4
       (select count(*) from brutes)  as brutos,         -- debe dar 4
       (select coalesce(sum(coins),0) from players) as en_circulacion,
       (select reserva_restante  from economia where id=1) as reserva,
       (select reserva_seguridad from economia where id=1) as fondo,
       -- Tiene que dar EXACTAMENTE 40.000.000. Si da 39.999.99x o 40.000.00x,
       -- el fondo se ha quedado fuera de la cuenta: no lo redondees, miralo.
       (select coalesce(sum(coins),0) from players)
         + (select reserva_restante from economia where id=1)
         + (select reserva_seguridad - 5000000 from economia where id=1)
         as suma_debe_dar_40M;

-- Y que no quede ningun bruto de prueba: cero filas.
select id, name, owner from brutes
 where owner not in (select address from _conservar);

drop table _conservar;
