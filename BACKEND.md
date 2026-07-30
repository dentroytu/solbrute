# SolBrute — diseño del backend

Estado: **en construcción.** Lo que ya está en pie:

- Proyecto Supabase creado (`ihrcvartuuyvftxdxztt`, Postgres en París).
- Tablas `players` y `brutes` — ver `supabase-01-tablas.sql`.
- `app.html` lee y escribe contra ellas a través de `supabase-cliente.js`.
  Un bruto forjado en un ordenador aparece como rival en otro.

Lo que **no** está y hay que tener presente:

- **No hay autenticación.** Las políticas RLS dejan escribir a cualquiera. Sin
  firma, la dirección del jugador es una declaración, no una prueba.
- **El combate lo sigue calculando el navegador**, y el servidor se lo cree.
- Faltan las tablas `fights` y `auth_nonces`, y todos los endpoints: por ahora el
  cliente habla directamente con PostgREST, sin capa de funciones en medio.

El orden pendiente está al final del documento. El siguiente es la firma.

Recomendación de stack: **Supabase** (Postgres + Auth + Edge Functions). Entra en
el plan gratuito de sobra para el prototipo y evita montar servidor propio.
Cualquier Postgres + una capa de funciones sirve igual.

---

## La regla que lo gobierna todo

**El cliente no decide nada que tenga valor.**

Ahora mismo el navegador calcula el combate, resta la antorcha, suma las monedas
y sube el nivel. Eso está bien para una maqueta y es indefendible en cuanto
exista un token: cualquiera con la consola abierta se pone 999 peleas y monedas
infinitas.

Lo que **tiene que** resolverse en servidor:

| Acción | Por qué |
|---|---|
| Generar la semilla del combate | Si la elige el cliente, elige su victoria |
| Simular el combate | El resultado es dinero |
| Restar la pelea diaria | Es el límite del juego |
| Sumar monedas y XP, subir nivel | Es el balance económico |
| Comprar plaza de bruto | Mueve token real |
| Emparejar | Si no, el jugador elige siempre al más débil |

Lo que puede quedarse en el cliente: **la animación**. El servidor devuelve
semilla y registro; el navegador reproduce. Nada más.

---

## Autenticación: Sign In With Solana

Conectar la wallet solo da la dirección pública, y eso es falsificable. El flujo
correcto tiene tres pasos:

1. `POST /auth/nonce` con la dirección → el servidor guarda un nonce con caducidad
   corta (5 min) y lo devuelve.
2. El cliente pide a Phantom/Solflare **firmar** un mensaje que incluye el nonce,
   el dominio y la fecha.
3. `POST /auth/verify` con dirección + firma + nonce → el servidor verifica la
   firma con `ed25519` (en Node: `@noble/curves/ed25519`, o
   `nacl.sign.detached.verify`), comprueba que el nonce existe y no está usado,
   lo invalida, y emite un JWT de sesión.

Sin el paso 2 no hay autenticación, solo una dirección escrita a mano.

---

## Esquema

```sql
-- ─── jugadores ───────────────────────────────────────────────
create table players (
  address      text primary key,              -- base58, wallet de Solana
  created_at   timestamptz not null default now(),
  last_seen    timestamptz not null default now(),
  coins        bigint      not null default 0, -- moneda interna del juego
  slots        smallint    not null default 1  -- plazas de bruto compradas
);

-- ─── nonces de login ─────────────────────────────────────────
create table auth_nonces (
  nonce      text primary key,
  address    text not null,
  expires_at timestamptz not null,
  used       boolean not null default false
);

-- ─── brutos ──────────────────────────────────────────────────
create table brutes (
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
  -- aspecto: los diez enteros del creador, tal cual
  look         jsonb    not null,
  fights_left  smallint not null default 3,
  fights_day   date     not null default (now() at time zone 'utc')::date,
  created_at   timestamptz not null default now()
);

create index brutes_owner_idx on brutes(owner);
create index brutes_level_idx on brutes(level);          -- emparejamiento
create unique index brutes_name_key on brutes(lower(name));

-- ─── combates ────────────────────────────────────────────────
create table fights (
  id         bigserial primary key,
  seed       bigint   not null,
  a_brute    bigint   not null references brutes(id) on delete cascade,
  b_brute    bigint       references brutes(id) on delete set null, -- null si es bot
  b_snapshot jsonb    not null,   -- copia del rival en el momento del combate
  winner     char(1)  not null check (winner in ('A','B')),
  turns      smallint not null,
  log        jsonb    not null,   -- registro completo, para reproducir y auditar
  coins      integer  not null,
  xp         integer  not null,
  created_at timestamptz not null default now()
);

create index fights_brute_idx on fights(a_brute, created_at desc);
```

Nota sobre `b_snapshot`: **imprescindible.** El rival sube de nivel después, y si
guardas solo su id, el combate deja de poder reproducirse. Hay que congelar sus
stats y su aspecto.

Nota sobre `look`: son diez enteros pequeños. En `jsonb` va bien y es flexible;
si más adelante lo llevas a la cadena, cabe empaquetado en pocos bytes.

---

## Endpoints

Todos menos los de `auth` exigen el JWT de sesión.

```
POST /auth/nonce          { address }                → { nonce, message }
POST /auth/verify         { address, signature }     → { token }

GET  /me                                             → { player, brutes[] }

POST /brutes              { name, look }             → { brute }
     valida: nombre libre, longitud 2-16, look en rango,
     el jugador tiene plaza libre. Los stats los tira EL SERVIDOR.

POST /slots/buy           { txSignature }            → { slots, coins }
     verifica la transacción EN LA CADENA antes de conceder la plaza
     (ver más abajo).

GET  /match/:bruteId                                 → { opponents[5] }
     nivel ±1, excluye los del propio jugador, rellena con bots.
     El servidor recuerda la lista ofrecida (cache corta) para que el
     cliente no pueda pedir pelear contra un rival inventado.

POST /fight               { bruteId, opponentRef }   → { seed, log, result }
     1. comprueba fights_left > 0 (y recarga si fights_day < hoy)
     2. comprueba que opponentRef estaba en la lista ofrecida
     3. genera semilla, simula, escribe fights, resta antorcha,
        aplica monedas/XP/nivel — todo en UNA transacción
     4. devuelve el registro para que el cliente lo anime

GET  /fights/:bruteId                                → historial paginado
GET  /fight/:id                                      → un combate, reproducible
```

### La recarga diaria

No hace falta ningún cron. Al leer un bruto:

```sql
update brutes
   set fights_left = 3,
       fights_day  = (now() at time zone 'utc')::date
 where id = $1
   and fights_day < (now() at time zone 'utc')::date;
```

Se recarga sola en el primer acceso del día. Sin tareas programadas y sin
posibilidad de que se salte.

### Comprar plaza con token

El punto donde es más fácil equivocarse. **No** basta con que el cliente diga
que pagó. El servidor tiene que:

1. Recibir la firma de la transacción.
2. Consultarla en un RPC de Solana (`getTransaction`), confirmada.
3. Comprobar destinatario, mint del token y cantidad exacta.
4. Comprobar que esa firma no se ha usado ya — guárdala con índice único, o
   alguien reclama la misma plaza diez veces.

---

## Portar el cliente

Todo el acceso a datos de `app.html` está aislado a propósito en el objeto
`STORE`, con tres funciones y un comentario que lo señala. Migrar consiste en:

- Sustituir `STORE` por un cliente de la API con el JWT.
- Quitar `simulate()` del cliente como fuente de verdad — pasa a ser solo el
  reproductor del registro que manda el servidor.
- `loadMe()` → `GET /me`
- `saveMe()` desaparece: cada acción tiene su endpoint.
- `buildPool()` → `GET /match/:bruteId`
- `startFight()` → `POST /fight`, y animar con lo que devuelva.

Conviene mantener `simulate()` en el servidor **y** en el cliente con la misma
implementación de PRNG: así el cliente puede verificar por su cuenta que el
registro que recibe cuadra con la semilla. Eso es la base de la promesa de
"combate verificable" de la landing, y es el ensayo de lo que luego hará la
cadena.

---

## Orden sugerido

1. Auth con firma (sin esto, nada de lo demás tiene sentido)
2. `players` + `brutes` + `/me` + `/brutes`
3. `/match` + `/fight` con la simulación movida al servidor
4. Historial de combates
5. Compra de plaza con token — al final, cuando el token exista
