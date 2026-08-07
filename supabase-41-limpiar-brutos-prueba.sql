-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 41 — los brutos de prueba que se quedaron en producción
-- ══════════════════════════════════════════════════════════════════════════
-- Supabase → SQL Editor → New query → pegar → Run.
--
-- Al revisar la base el 07/08/2026 había ONCE brutos y CINCO eran de scripts.
-- Se reconocen por el patrón: PREFIJO + los seis últimos dígitos del reloj,
-- que es exactamente como los nombra `ev.mjs`:
--
--     "Ev" + Date.now().toString().slice(-6)
--
--     Ev983490 · Ev836500 · Chk4517221 · Barb028294 · Caro029923
--
-- No es suciedad cosmética: los brutos de la casa se generan en el navegador y
-- no se guardan nunca, así que `brutes` es la clasificación y es de donde sale
-- el emparejamiento. Un bruto de script ahí sale como jugador real — y ya ha
-- pasado: la pelea #157 es un jugador de verdad contra `Ev836500`.
--
-- Y con ellos SEIS cuentas que firmaron y nunca llegaron a forjar, con cero
-- monedas: el rastro de los bancos de ataque, que generan claves ed25519
-- nuevas en cada pasada.
--
-- ── Por LISTA BLANCA, igual que los pasos 16, 22 y 24 ─────────────────────
-- Se conservan cuatro direcciones y se borra el resto. Enumerar las de prueba
-- es donde se escapa una y queda basura en la clasificación para siempre.
--
-- ── Lo que este paso NO toca, y por qué ───────────────────────────────────
-- `emision` se queda. Guarda los puntos por día para calcular la tasa, y
-- borrar los de las peleas que se van no cambia nada mientras la tasa siga
-- topada en 1,0 — que con quince cuentas lo está de sobra. Tocarlo sería
-- mover el reparto de mañana para arreglar algo que no está roto.
--
-- `preventa_compras` tampoco: su `address` no tiene clave ajena a `players`,
-- así que borrar un jugador no puede arrastrar una compra. Aun así hay una
-- red de seguridad más abajo, porque ahí hay SOL de verdad.
-- ══════════════════════════════════════════════════════════════════════════

create temp table _conservar (address text primary key);
insert into _conservar values
  ('7bXra6gaZi5rGvwgdyzyVd9vWKuUx5cKDNneXV8v2reZ'),  -- tu wallet
  ('CCYXMEnhKZjH5WW43YnP3pizAyVz7sGM6RyASMdyvmCx'),  -- Arbitrado
  ('HkSPFBiesxW21tpaMcUTnjrBHcocb843u1wSRkFKQ24t'),  -- Sala7huk
  ('2EiWESwFsZpLBUzFe9T2Gkhh4uUpQ6rcdCJk3WUTes51');  -- Iconok5i


-- ── Red 1: ningún bruto REAL puede quedar fuera de la lista ───────────────
-- Mejor un error que descubrir mañana que faltan brutos.
do $$
declare v int;
begin
  select count(*) into v from brutes b
   where b.owner not in (select address from _conservar)
     and b.name in ('Arbitrado','Sala7huk','Iconok5i','tito','tita','test');
  if v > 0 then raise exception 'PARA: % brutos reales quedarian fuera', v; end if;
end $$;


-- ── Red 2: nadie que haya PAGADO en la preventa ───────────────────────────
-- Esta no la tenían los pasos 16, 22 y 24 porque cuando se escribieron no
-- había preventa. Ahora la hay, está abierta, y alguien que pagó SOL y
-- todavía no ha reclamado sus tokens es lo último que puede desaparecer de
-- esta base. `pv_mias` va por dirección, no por jugador: quien compró desde
-- la landing sin jugar no tiene fila en `players` — pero quien juegue Y compre
-- tendrá las dos, y este delete llegaría a la suya.
do $$
declare v int;
begin
  select count(*) into v from preventa_compras c
   where c.address not in (select address from _conservar)
     and c.address in (select address from players);
  if v > 0 then
    raise exception 'PARA: % compras de la preventa son de cuentas a borrar', v;
  end if;
end $$;


-- ── Red 3: ningún torneo reteniendo bote ──────────────────────────────────
-- Un torneo vivo tiene monedas en depósito que no están en `players.coins`.
-- Borrar inscritos por debajo dejaría el bote sin poder repartirse.
do $$
declare v int;
begin
  select count(*) into v from tournaments
   where estado in ('inscripcion','en_curso');
  if v > 0 then raise exception 'PARA: % torneos vivos con bote dentro', v; end if;
end $$;


select 'ANTES' as momento,
       (select count(*) from players)  as jugadores,
       (select count(*) from brutes)   as brutos,
       (select count(*) from fights)   as peleas,
       (select coalesce(sum(coins),0) from players)        as en_circulacion,
       (select reserva_restante  from economia where id=1) as reserva,
       (select reserva_seguridad from economia where id=1) as fondo;


-- ── El borrado y el reciclaje, en UNA transacción ─────────────────────────
-- Va todo en el mismo bloque a propósito: si algo falla a mitad no se borra
-- ni una fila, y no queda una base a medio limpiar con los libros torcidos.
do $$
declare
  v_monedas bigint;
  v_res     json;
begin
  -- Se SUMA antes de borrar, porque después ya no están; se RECICLA después.
  select coalesce(sum(coins), 0) into v_monedas
    from players where address not in (select address from _conservar);

  -- `fights` primero: se iría sola por `on delete cascade` desde `brutes`,
  -- pero explícita se ve qué se borra. Las peleas donde uno de estos era el
  -- RIVAL sobreviven — `b_brute` es `on delete set null` y el combate se
  -- recalcula desde `b_snapshot`, que está congelado. Se siguen verificando.
  delete from fights      where a_owner not in (select address from _conservar);
  delete from withdrawals where address not in (select address from _conservar);
  delete from movimientos where address not in (select address from _conservar);
  delete from perdidas    where address not in (select address from _conservar);
  delete from brutes      where owner   not in (select address from _conservar);
  delete from players     where address not in (select address from _conservar);
  delete from sessions    where address not in (select address from _conservar);
  delete from auth_nonces where address not in (select address from _conservar);

  -- DESPUÉS del borrado, nunca antes. Al revés, si el borrado fallara tras
  -- haber reciclado, las monedas estarían en los dos sitios a la vez: eso sí
  -- sería imprimir. Entre quemar e imprimir se elige quemar.
  --
  -- Y se recicla en vez de dejarlas caer, porque un `delete` a secas las QUEMA:
  -- la circulación baja y la reserva no sube, y `respaldo.mjs` diría «no
  -- cuadra» a partir de ese día y para siempre. Es el mismo agujero que tenía
  -- el botón de borrar jugador del panel.
  v_res := emision_reciclar(v_monedas);
  raise notice 'recicladas % monedas -> %', v_monedas, v_res;
end $$;


select 'DESPUES' as momento,
       (select count(*) from players)  as jugadores,
       (select count(*) from brutes)   as brutos,
       (select count(*) from fights)   as peleas,
       (select coalesce(sum(coins),0) from players)        as en_circulacion,
       (select reserva_restante  from economia where id=1) as reserva,
       (select reserva_seguridad from economia where id=1) as fondo,
       -- La invariante COMPLETA, con el fondo dentro. Tiene que dar
       -- EXACTAMENTE 40.000.000, igual que antes de empezar.
       (select coalesce(sum(coins),0) from players)
         + (select reserva_restante from economia where id=1)
         + (select reserva_seguridad - 5000000 from economia where id=1)
         as suma_debe_dar_40M;

drop table _conservar;
