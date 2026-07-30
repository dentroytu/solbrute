-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 1 — las tablas base
-- ══════════════════════════════════════════════════════════════════════════
-- Cómo se usa: entra en tu proyecto de Supabase → SQL Editor → New query →
-- pega este fichero entero → Run. Se puede ejecutar dos veces sin romper nada
-- (todo lleva "if not exists").
--
-- Qué crea: los jugadores y sus brutos. Con esto, un bruto creado en un
-- ordenador aparece como rival en otro. Eso es el multijugador.
--
-- Qué NO crea todavía: la tabla de combates y la de nonces de login. Llegan en
-- los pasos 2 y 3, cuando movamos el combate al servidor. El esquema completo
-- está en BACKEND.md.
-- ══════════════════════════════════════════════════════════════════════════


-- ─── jugadores ────────────────────────────────────────────────────────────
-- La clave es la dirección de la wallet. No hay correo ni contraseña: en este
-- juego tu wallet es tu cuenta.
create table if not exists players (
  address      text primary key,               -- base58, la wallet de Solana
  created_at   timestamptz not null default now(),
  last_seen    timestamptz not null default now(),
  coins        bigint      not null default 0, -- moneda interna del juego
  slots        smallint    not null default 1  -- plazas de bruto compradas
);


-- ─── brutos ───────────────────────────────────────────────────────────────
create table if not exists brutes (
  id           bigserial primary key,
  owner        text not null references players(address) on delete cascade,
  name         text not null,
  level        smallint not null default 1,
  xp           integer  not null default 0,
  hp_max       smallint not null,
  str          smallint not null,
  agi          smallint not null,
  spd          smallint not null,
  wins         integer  not null default 0,
  losses       integer  not null default 0,

  -- El aspecto: los diez enteros del creador, tal cual salen de la forja.
  -- Los dibuja brute-render.js. Aquí solo se guardan los números.
  look         jsonb    not null,

  fights_left  smallint not null default 3,
  fights_day   date     not null default (now() at time zone 'utc')::date,
  created_at   timestamptz not null default now()
);

-- Índices: sin esto, buscar rivales obliga a leer la tabla entera.
create index if not exists brutes_owner_idx on brutes(owner);
create index if not exists brutes_level_idx on brutes(level);

-- Nombres únicos sin distinguir mayúsculas: "Crixus" y "CRIXUS" chocan.
create unique index if not exists brutes_name_key on brutes(lower(name));


-- ══════════════════════════════════════════════════════════════════════════
-- Seguridad de filas (RLS)
-- ══════════════════════════════════════════════════════════════════════════
-- IMPORTANTE, y es el fallo más común al empezar con Supabase.
--
-- La clave "anon" que va en el navegador es pública a propósito: cualquiera
-- que abra tu web puede leerla. Lo único que impide que un desconocido borre
-- tu tabla entera son estas políticas. Sin RLS activado, la tabla está abierta
-- de par en par.
--
-- Las de abajo son DE PROTOTIPO y son deliberadamente flojas: dejan escribir a
-- cualquiera, porque todavía no hay login con firma que permita comprobar quién
-- es quién. Eso se arregla en el paso 2, y entonces estas políticas se
-- sustituyen por otras que exigen el JWT de sesión.
--
-- Mientras tanto: no hay nada que robar. No existe el token, ni las monedas
-- valen dinero. Es un riesgo aceptable a cambio de ver el multijugador
-- funcionando ya. Pero no se te olvide que está abierto.
-- ══════════════════════════════════════════════════════════════════════════

alter table players enable row level security;
alter table brutes  enable row level security;

-- Leer: todo el mundo. El emparejamiento necesita ver los brutos de los demás.
drop policy if exists players_lectura_publica on players;
create policy players_lectura_publica on players
  for select using (true);

drop policy if exists brutes_lectura_publica on brutes;
create policy brutes_lectura_publica on brutes
  for select using (true);

-- Escribir: de momento abierto. TEMPORAL — ver el aviso de arriba.
drop policy if exists players_escritura_prototipo on players;
create policy players_escritura_prototipo on players
  for all using (true) with check (true);

drop policy if exists brutes_escritura_prototipo on brutes;
create policy brutes_escritura_prototipo on brutes
  for all using (true) with check (true);


-- ══════════════════════════════════════════════════════════════════════════
-- Realtime: que los brutos nuevos aparezcan sin recargar la página
-- ══════════════════════════════════════════════════════════════════════════
-- Esto es lo que hace que, cuando alguien forja un bruto en su casa, te salte
-- en la lista al momento.
alter publication supabase_realtime add table brutes;
