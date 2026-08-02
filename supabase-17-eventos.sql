-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 17 — lo que hace falta para el tablón de eventos
-- ══════════════════════════════════════════════════════════════════════════
-- Supabase → SQL Editor → New query → pegar → Run. Repetible.
--
-- ── El problema ───────────────────────────────────────────────────────────
--
-- `fights` guarda ganador, turnos, monedas y XP. Con eso el tablón del ludus
-- solo podría decir «ganaste» y «perdiste», que es la mitad de lo interesante:
-- lo que la gente quiere ver al entrar es que SUBIÓ DE NIVEL y que se le ROMPIÓ
-- el mandoble.
--
-- Esos datos existen —los calcula la Edge Function en cada pelea— pero se
-- tiraban al terminar la petición. Aquí solo se les hace sitio.
--
-- ── Por qué en `fights` y no en una tabla de eventos ──────────────────────
--
-- Porque son propiedades DE la pelea, no cosas que pasaron aparte: subiste de
-- nivel *en* esa pelea, el arma se rompió *en* esa pelea. Una tabla `eventos`
-- separada tendría que apuntar a la pelea de todas formas, y abriría la puerta
-- a que las dos versiones se contradigan.
--
-- Y son gratis: la fila ya se escribe, esto son cuatro columnas más en el
-- mismo insert.
--
-- ── Y por qué se leen sin pasar por la Edge Function ──────────────────────
--
-- `fights` ya tiene política de lectura pública desde el paso 7, y con motivo:
-- no hay nada sensible dentro (direcciones que ya salen en la clasificación y
-- números de juguete). El tablón consulta directo, que es una petición menos
-- y no gasta la Edge Function en algo que no necesita decidir nada.
--
-- Esto es lo contrario que el HISTORIAL de compras y retiradas: eso SÍ es
-- privado y por eso `movimientos` tiene RLS sin políticas. La diferencia no es
-- caprichosa: una pelea la ve el rival igual que tú; lo que gastas, no.
-- ══════════════════════════════════════════════════════════════════════════

-- ¿Subió de nivel en esta pelea, y a cuál?
alter table fights add column if not exists subio     boolean  not null default false;
alter table fights add column if not exists nivel     smallint;

-- QUÉ tocó: 'str' | 'agi' | 'spd' | 'hp' | 'arma:daga'…
-- El mismo formato que devuelve `aplicar()` en brute-combate.js, sin traducir.
-- Traducirlo aquí obligaría a guardar tres idiomas o a elegir uno; guardando
-- la clave, la pantalla la traduce y añadir un idioma no toca la base.
alter table fights add column if not exists ganancia  text;

-- El arma que se rompió en esta pelea, si se rompió. Cadena vacía o null si no.
alter table fights add column if not exists arma_rota text;

-- El arma que llevaba puesta al pelear. Sin esto el tablón no puede decir
-- «ganaste con el mandoble», y es justo el dato que hace que las armas se
-- sientan parte del combate y no un número en una ficha.
alter table fights add column if not exists arma      text;


-- El tablón pide las últimas peleas de TUS brutos, ordenadas por fecha. Ya
-- existe `fights_owner_idx` sobre `a_owner` a secas, que obliga a ordenar
-- después; este las devuelve ya ordenadas.
create index if not exists fights_owner_fecha_idx on fights(a_owner, created_at desc);


-- ══════════════════════════════════════════════════════════════════════════
-- Comprobación
-- ══════════════════════════════════════════════════════════════════════════
select column_name, data_type
  from information_schema.columns
 where table_name = 'fights'
   and column_name in ('subio','nivel','ganancia','arma_rota','arma')
 order by column_name;
