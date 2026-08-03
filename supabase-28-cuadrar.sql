-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 28 — cuadrar los libros
-- ══════════════════════════════════════════════════════════════════════════
-- Supabase → SQL Editor → New query → pegar → Run.
--
-- ── Que paso ──────────────────────────────────────────────────────────────
-- Se anadieron monedas desde el panel de administracion. Esa ruta escribia
-- `players.coins` directamente y NO tocaba `economia`, asi que:
--
--     dar monedas    -> la reserva no baja   (nacen de la nada)
--     gastarlas      -> el reciclaje SI las devuelve
--
-- Salen sin permiso y entran con el. Resultado medido:
--
--     circulacion 122 + reserva 39.999.940 + fondo 38 = 40.000.100
--                                                       ^^^^^^^^^^ +100
--
-- Es el mismo fallo que dejo la reserva en 40.000.117 en su dia, y por eso
-- `emision_reciclar` ya tiene un tope que quema lo que no cabe. Aqui no salto
-- porque 40.000.100 sigue por debajo del techo de reserva_total.
--
-- ── Por que esto importa MAS de lo que parece ─────────────────────────────
-- Hoy son 100 monedas de juguete y se arreglan con un update. Con el token en
-- mainnet, cada moneda en `players.coins` es un DERECHO A COBRAR tokens reales
-- de la wallet operativa. Cien monedas de mas son cien tokens que alguien
-- puede pedir y que no existen: el ultimo en retirar se queda sin cobrar.
--
-- La invariante no es contabilidad bonita. Es lo que separa un saldo de una
-- promesa incumplida.
--
-- ── El agujero ya esta tapado ─────────────────────────────────────────────
-- La ruta `admin_editar_jugador` de la Edge Function ahora pasa por
-- `emision_cobrar` al dar y por `emision_reciclar` al quitar. Si la reserva no
-- llega, responde 409 en vez de inventarse la diferencia.
--
-- ESTE PASO SOLO ARREGLA EL PASADO. Aplica antes la Edge Function nueva, o el
-- descuadre vuelve la proxima vez que toques un saldo desde el panel.
-- ══════════════════════════════════════════════════════════════════════════

select 'ANTES' as momento,
       (select coalesce(sum(coins),0) from players)      as circulacion,
       (select reserva_restante  from economia where id=1) as reserva,
       (select reserva_seguridad from economia where id=1) - 5000000 as fondo_extra,
       (select coalesce(sum(coins),0) from players)
         + (select reserva_restante from economia where id=1)
         + (select reserva_seguridad - 5000000 from economia where id=1) as suma;


-- La reserva pasa a ser lo que NO esta en manos de nadie, descontando tambien
-- lo que se aparto en el fondo. No se toca el saldo de ningun jugador: lo que
-- tienen se lo han ganado o se les dio, y quitarselo ahora seria cobrarles un
-- error de contabilidad que no cometieron.
update economia
   set reserva_restante = reserva_total
                          - (select coalesce(sum(coins),0) from players)
                          - (reserva_seguridad - 5000000),
       actualizado = now()
 where id = 1;


-- ══════════════════════════════════════════════════════════════════════════
-- Comprobacion — `suma` tiene que dar EXACTAMENTE 40000000
-- ══════════════════════════════════════════════════════════════════════════
select 'DESPUES' as momento,
       (select coalesce(sum(coins),0) from players)      as circulacion,
       (select reserva_restante  from economia where id=1) as reserva,
       (select reserva_seguridad from economia where id=1) - 5000000 as fondo_extra,
       (select coalesce(sum(coins),0) from players)
         + (select reserva_restante from economia where id=1)
         + (select reserva_seguridad - 5000000 from economia where id=1) as suma;
