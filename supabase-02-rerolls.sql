-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 2 — límite de cambios de lista de rivales
-- ══════════════════════════════════════════════════════════════════════════
-- Cómo se usa: Supabase → SQL Editor → New query → pegar → Run.
-- Se puede ejecutar dos veces sin romper nada.
--
-- Qué añade y por qué:
--
--   rerolls_left  Cuántas veces puedes pedir otra lista de rivales hoy.
--                 Se recarga sola al cambiar el día UTC, igual que las peleas.
--
--   pool          LA LISTA QUE SE TE OFRECIÓ, congelada.
--                 Esta es la importante. Sin ella el límite sería decorativo:
--                 la lista se generaba al entrar en la pantalla, así que
--                 bastaba con volver al ludus y entrar otra vez para tener
--                 rivales nuevos sin gastar nada. Guardándola, entrar y salir
--                 devuelve la MISMA lista, y cambiarla cuesta un reroll.
--
--                 Es también lo que pide BACKEND.md: "el servidor recuerda la
--                 lista ofrecida para que el cliente no pueda pedir pelear
--                 contra un rival inventado". Todavía no se valida contra ella
--                 —el navegador sigue mandando—, pero el dato ya está donde
--                 tiene que estar para cuando el combate se mueva al servidor.
-- ══════════════════════════════════════════════════════════════════════════

alter table brutes add column if not exists rerolls_left smallint not null default 1;
alter table brutes add column if not exists pool jsonb;

-- Los brutos que ya existían no tenían el campo: se les da su cambio del día.
update brutes set rerolls_left = 1 where rerolls_left is null;
