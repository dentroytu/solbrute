-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 21 — torneos
-- ══════════════════════════════════════════════════════════════════════════
-- Supabase → SQL Editor → New query → pegar → Run. Repetible.
--
-- Los crea el ADMIN desde el panel, con todo configurable: nombre, plazas,
-- entrada, cuándo se resuelve, rango de niveles y reparto del bote. No hay
-- tarea programada ni «todos los sábados» escrito en el código: si mañana
-- quieres uno diario o uno al mes, es un formulario, no un despliegue.
--
-- ── El premio sale del BOTE, no de la reserva ─────────────────────────────
--
-- Es la decisión que sostiene todo lo demás. Si el premio saliera de la
-- reserva, cada torneo sería emisión nueva: más torneos = la reserva dura
-- menos, y si el premio compensa, las peleas diarias sobran y el torneo se
-- come el juego. Está avisado en el CLAUDE.md desde que se anotó la idea.
--
-- Saliendo del bote:
--
--     bote = plazas × entrada
--       1º      50%
--       2º      20%
--       3º/4º   15%   (repartido entre los dos semifinalistas)
--       casa    15%   → vuelve a la reserva. ESTO es el sumidero
--
-- Emisión neta CERO, y de cada torneo desaparece un 15% de circulación para
-- siempre. El torneo no es solo contenido: es el segundo sumidero real del
-- juego, después de las armas que se rompen.
--
-- ── Un bruto por jugador ──────────────────────────────────────────────────
-- Si alguien pudiera apuntar sus tres brutos tendría el triple de opciones, y
-- comprar plazas pasaría a ser pay-to-win en los torneos. Un jugador, una
-- entrada.
--
-- ── Las peleas del torneo NO gastan las 3 diarias ─────────────────────────
-- Está decidido desde que se anotó la idea: si las gastaran, habría que
-- elegir entre torneo y jugar, y eso convierte un extra en un castigo. El
-- torneo se resuelve entero en el servidor y no toca `fights_left`.
-- ══════════════════════════════════════════════════════════════════════════


create table if not exists tournaments (
  id          bigserial primary key,
  nombre      text    not null,

  -- borrador     lo está montando el admin, nadie lo ve
  -- inscripcion  abierto, la gente se apunta
  -- en_curso     resolviéndose (dura segundos, pero existe para que dos
  --              resoluciones simultáneas no se pisen)
  -- terminado    resuelto, con ganador y premios repartidos
  -- cancelado    no salió; las entradas se devuelven
  estado      text    not null default 'borrador',

  -- Potencia de 2. El cuadro es de eliminatorias directas y con otro número
  -- habría rondas cojas; con menos apuntados se rellena con descansos.
  plazas      int     not null default 8,
  entrada     bigint  not null default 50,

  -- Cuándo se resuelve. No lo dispara un reloj: la Edge Function comprueba
  -- esta fecha cuando alguien entra al torneo. Sin tarea programada que
  -- mantener, y el resultado es el mismo.
  empieza_at  timestamptz not null,

  nivel_min   int     not null default 1,
  nivel_max   int     not null default 100,

  -- Reparto del bote, en porcentaje. Tienen que sumar 100.
  pct_1       int     not null default 50,
  pct_2       int     not null default 20,
  pct_semis   int     not null default 15,   -- entre los DOS semifinalistas
  pct_casa    int     not null default 15,   -- a la reserva: el sumidero

  bote        bigint  not null default 0,
  ganador     bigint,                        -- id de la inscripción ganadora
  creado_por  text,
  created_at  timestamptz not null default now(),
  resuelto_at timestamptz,

  constraint torneo_estado_valido check (estado in
    ('borrador','inscripcion','en_curso','terminado','cancelado')),
  constraint torneo_plazas_validas check (plazas in (4,8,16,32)),
  constraint torneo_reparto_cuadra check (pct_1 + pct_2 + pct_semis + pct_casa = 100),
  constraint torneo_niveles       check (nivel_min >= 1 and nivel_max >= nivel_min)
);

create index if not exists torneos_estado_idx on tournaments(estado, empieza_at);

alter table tournaments enable row level security;

-- Leer sí: un torneo es público y el jugador tiene que poder verlo antes de
-- apuntarse. Menos los borradores, que el admin todavía está montando.
drop policy if exists torneos_lectura on tournaments;
create policy torneos_lectura on tournaments
  for select using (estado <> 'borrador');


-- ══════════════════════════════════════════════════════════════════════════
-- Quién se ha apuntado
-- ══════════════════════════════════════════════════════════════════════════
create table if not exists tournament_entries (
  id         bigserial primary key,
  torneo_id  bigint not null references tournaments(id) on delete cascade,
  bruto_id   bigint not null references brutes(id) on delete cascade,
  address    text   not null,

  -- El bruto CONGELADO al apuntarse. Imprescindible por lo mismo que
  -- `fights.b_snapshot`: entre la inscripción y la resolución pueden pasar
  -- días, el bruto sube de nivel, y sin la copia el cuadro dejaría de poder
  -- reproducirse. Y además es más justo: entras con el bruto que tenías.
  snapshot   jsonb  not null,

  posicion   int,                    -- 1, 2, 3… nulo hasta que se resuelve
  premio     bigint not null default 0,
  created_at timestamptz not null default now(),

  -- Un bruto no se apunta dos veces...
  constraint entrada_bruto_unico  unique (torneo_id, bruto_id),
  -- ...y un JUGADOR tampoco, aunque tenga tres brutos. Si no, comprar plazas
  -- sería comprar opciones de ganar el torneo.
  constraint entrada_jugador_unico unique (torneo_id, address)
);

create index if not exists entradas_torneo_idx on tournament_entries(torneo_id, posicion);

alter table tournament_entries enable row level security;
drop policy if exists entradas_lectura on tournament_entries;
create policy entradas_lectura on tournament_entries for select using (true);


-- ══════════════════════════════════════════════════════════════════════════
-- El cuadro: cada combate, reproducible
-- ══════════════════════════════════════════════════════════════════════════
-- Misma promesa que las peleas normales: se guarda semilla y registro, así que
-- cualquiera puede recalcular cada combate del torneo y comprobar que salió
-- eso. Un torneo cuyo resultado hay que creerse no vale nada.
create table if not exists tournament_fights (
  id        bigserial primary key,
  torneo_id bigint not null references tournaments(id) on delete cascade,
  ronda     int    not null,          -- 1 = primera, la última es la final
  puesto    int    not null,          -- índice del combate dentro de la ronda
  a_entry   bigint references tournament_entries(id) on delete set null,
  b_entry   bigint references tournament_entries(id) on delete set null,
  seed      bigint not null,
  winner    char(1),                  -- 'A' | 'B'; nulo si fue descanso
  turns     smallint,
  log       jsonb,
  created_at timestamptz not null default now()
);

create index if not exists cuadro_torneo_idx on tournament_fights(torneo_id, ronda, puesto);

alter table tournament_fights enable row level security;
drop policy if exists cuadro_lectura on tournament_fights;
create policy cuadro_lectura on tournament_fights for select using (true);


-- ══════════════════════════════════════════════════════════════════════════
-- APUNTARSE: cobra la entrada y guarda la plaza, o ninguna de las dos
-- ══════════════════════════════════════════════════════════════════════════
-- Con `for update` sobre el torneo: si dos jugadores piden la última plaza a
-- la vez, uno entra y el otro recibe 'torneo_lleno'. Sin el bloqueo entrarían
-- los dos y el cuadro tendría un participante de más.
create or replace function torneo_inscribir(p_owner text, p_torneo bigint, p_bruto bigint)
returns json
language plpgsql
security definer
as $$
declare
  t        record;
  b        record;
  v_saldo  bigint;
  v_dentro int;
  v_id     bigint;
begin
  select * into t from tournaments where id = p_torneo for update;
  if not found then raise exception 'torneo_desconocido'; end if;
  if t.estado <> 'inscripcion' then raise exception 'inscripcion_cerrada'; end if;
  if t.empieza_at <= now() then raise exception 'inscripcion_cerrada'; end if;

  select count(*) into v_dentro from tournament_entries where torneo_id = p_torneo;
  if v_dentro >= t.plazas then raise exception 'torneo_lleno'; end if;

  -- El bruto se busca por id Y por dueño: mandar el id de otro no lo apunta.
  select * into b from brutes where id = p_bruto and owner = p_owner;
  if not found then raise exception 'ese bruto no es tuyo'; end if;
  if b.level < t.nivel_min or b.level > t.nivel_max then
    raise exception 'nivel_fuera:%-%', t.nivel_min, t.nivel_max;
  end if;

  select coins into v_saldo from players where address = p_owner for update;
  if v_saldo < t.entrada then raise exception 'sin_saldo'; end if;

  update players set coins = coins - t.entrada where address = p_owner;
  update tournaments set bote = bote + t.entrada where id = p_torneo;

  insert into tournament_entries (torneo_id, bruto_id, address, snapshot)
  values (p_torneo, p_bruto, p_owner,
          jsonb_build_object(
            'name', b.name, 'lv', b.level, 'hpMax', b.hp_max,
            'str', b.str, 'agi', b.agi, 'spd', b.spd,
            'w', b.wins, 'l', b.losses, 'look', b.look,
            'arma', coalesce(b.arma, 'ninguna')))
  returning id into v_id;

  return json_build_object('entrada_id', v_id, 'pagado', t.entrada,
                           'bote', t.bote + t.entrada,
                           'plazas_libres', t.plazas - v_dentro - 1);
end;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- TOMAR EL TORNEO para resolverlo
-- ══════════════════════════════════════════════════════════════════════════
-- Lo pasa a `en_curso` y devuelve las inscripciones. El cambio de estado es lo
-- que impide que dos peticiones simultáneas resuelvan el mismo torneo dos
-- veces y repartan el premio dos veces: la segunda se encuentra el estado ya
-- cambiado y no hace nada.
--
-- El cuadro NO se calcula aquí: hace falta `simulate()`, que vive en
-- brute-combate.js. Esto solo entrega los datos y cierra la puerta.
create or replace function torneo_tomar(p_torneo bigint)
returns json
language plpgsql
security definer
as $$
declare t record; v_n int;
begin
  select * into t from tournaments where id = p_torneo for update;
  if not found then raise exception 'torneo_desconocido'; end if;
  if t.estado <> 'inscripcion' then raise exception 'no_resoluble'; end if;
  if t.empieza_at > now() then raise exception 'todavia_no'; end if;

  select count(*) into v_n from tournament_entries where torneo_id = p_torneo;

  -- Con menos de dos no hay torneo. Se cancela y se devuelven las entradas:
  -- quedarse el dinero de quien se apuntó a algo que no llegó a celebrarse
  -- sería quedárselo, sin más.
  if v_n < 2 then
    update players p set coins = p.coins + t.entrada
      from tournament_entries e
     where e.torneo_id = p_torneo and p.address = e.address;
    update tournaments set estado = 'cancelado', bote = 0 where id = p_torneo;
    return json_build_object('cancelado', true, 'inscritos', v_n);
  end if;

  update tournaments set estado = 'en_curso' where id = p_torneo;

  return json_build_object(
    'torneo', to_jsonb(t),
    'entradas', (select coalesce(json_agg(json_build_object(
                          'id', e.id, 'bruto_id', e.bruto_id,
                          'address', e.address, 'snapshot', e.snapshot)
                        order by e.created_at), '[]'::json)
                   from tournament_entries e where e.torneo_id = p_torneo));
end;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- CERRAR: guardar el cuadro y repartir el bote
-- ══════════════════════════════════════════════════════════════════════════
-- `p_puestos` llega como [{entrada_id, posicion}, …] y `p_cuadro` como los
-- combates. Todo el reparto va en una sola función para que no pueda quedarse
-- a medias: premios pagados sin torneo cerrado, o al revés.
--
-- La parte de la casa NO se queda en ningún sitio: vuelve a la reserva por
-- `emision_reciclar`, igual que el dinero de un arma comprada. Ese es el
-- sumidero.
create or replace function torneo_cerrar(
  p_torneo  bigint,
  p_cuadro  jsonb,
  p_puestos jsonb
)
returns json
language plpgsql
security definer
as $$
declare
  t        record;
  v_fila   jsonb;
  v_pos    int;
  v_eid    bigint;
  v_premio bigint;
  v_casa   bigint;
  v_ganador bigint;
begin
  select * into t from tournaments where id = p_torneo for update;
  if not found then raise exception 'torneo_desconocido'; end if;
  if t.estado <> 'en_curso' then raise exception 'no_estaba_en_curso'; end if;

  -- El cuadro, combate a combate. Con semilla y registro: reproducible.
  for v_fila in select * from jsonb_array_elements(p_cuadro) loop
    insert into tournament_fights (torneo_id, ronda, puesto, a_entry, b_entry,
                                   seed, winner, turns, log)
    values (p_torneo,
            (v_fila->>'ronda')::int, (v_fila->>'puesto')::int,
            nullif(v_fila->>'a_entry','')::bigint,
            nullif(v_fila->>'b_entry','')::bigint,
            (v_fila->>'seed')::bigint,
            nullif(v_fila->>'winner',''),
            nullif(v_fila->>'turns','')::smallint,
            v_fila->'log');
  end loop;

  -- Los premios. Los porcentajes salen del torneo, no de quien llama.
  for v_fila in select * from jsonb_array_elements(p_puestos) loop
    v_eid := (v_fila->>'entrada_id')::bigint;
    v_pos := (v_fila->>'posicion')::int;
    v_premio := case
      when v_pos = 1 then (t.bote * t.pct_1) / 100
      when v_pos = 2 then (t.bote * t.pct_2) / 100
      when v_pos = 3 then (t.bote * t.pct_semis) / 100 / 2
      else 0 end;

    update tournament_entries set posicion = v_pos, premio = v_premio
     where id = v_eid and torneo_id = p_torneo;

    if v_premio > 0 then
      update players p set coins = p.coins + v_premio
        from tournament_entries e
       where e.id = v_eid and p.address = e.address;
    end if;

    if v_pos = 1 then v_ganador := v_eid; end if;
  end loop;

  -- Lo que queda sin repartir —la parte de la casa y los redondeos— vuelve a
  -- la reserva.
  --
  -- Con DESCANSOS el cuadro queda desigual y puede haber un solo semifinalista
  -- en vez de dos (probado: con 5 inscritos en un cuadro de 8 pasa). Entonces
  -- se paga media parte de semifinales y la otra media cae aquí. No se pierde
  -- ni se inventa una moneda: la casa se lleva un poco más cuando el torneo no
  -- se llena, que es exactamente el incentivo correcto para llenarlo. Es el sumidero, y por eso se pasa por `emision_reciclar` en
  -- vez de sumarlo a mano: así el 10% del fondo de garantía también se lleva
  -- su parte, igual que con las armas.
  select t.bote - coalesce(sum(premio), 0) into v_casa
    from tournament_entries where torneo_id = p_torneo;
  if v_casa > 0 then perform emision_reciclar(v_casa); end if;

  update tournaments
     set estado = 'terminado', ganador = v_ganador, resuelto_at = now()
   where id = p_torneo;

  return json_build_object('ganador', v_ganador, 'bote', t.bote, 'a_la_reserva', v_casa);
end;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- LA TRAMPA DE SIEMPRE
-- ══════════════════════════════════════════════════════════════════════════
-- `torneo_inscribir` cobra y `torneo_cerrar` PAGA. Abiertas a public, se
-- reparten premios con la clave anon.
revoke execute on function torneo_inscribir(text, bigint, bigint) from public;
revoke execute on function torneo_inscribir(text, bigint, bigint) from anon, authenticated;
grant  execute on function torneo_inscribir(text, bigint, bigint) to service_role;

revoke execute on function torneo_tomar(bigint) from public;
revoke execute on function torneo_tomar(bigint) from anon, authenticated;
grant  execute on function torneo_tomar(bigint) to service_role;

revoke execute on function torneo_cerrar(bigint, jsonb, jsonb) from public;
revoke execute on function torneo_cerrar(bigint, jsonb, jsonb) from anon, authenticated;
grant  execute on function torneo_cerrar(bigint, jsonb, jsonb) to service_role;


-- ══════════════════════════════════════════════════════════════════════════
-- Comprobación — cero filas
-- ══════════════════════════════════════════════════════════════════════════
select p.proname as funcion_abierta
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('torneo_inscribir','torneo_tomar','torneo_cerrar')
   and (has_function_privilege('anon',   p.oid, 'execute')
     or has_function_privilege('public', p.oid, 'execute'));

select count(*) as torneos from tournaments;
