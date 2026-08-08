-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 44 — limite de peticiones por IP
-- ══════════════════════════════════════════════════════════════════════════
-- Supabase → SQL Editor → New query → pegar → Run.
-- **ANTES de redesplegar la Edge Function**, que llama a esta funcion.
--
-- Hasta ahora nada impedia machacar las rutas. Da igual lo bien cerrado que
-- este cada permiso: un bucle pidiendo `nonce` mil veces por segundo llena
-- `auth_nonces`, uno pidiendo `pelear` quema el presupuesto de la funcion, y
-- uno pidiendo `pv_reservar` bloquea cupo de la preventa cada quince minutos.
-- Ninguno roba nada; todos hacen dano.
--
-- ── Por que en Postgres y no en memoria ───────────────────────────────────
-- Una Edge Function no guarda estado entre llamadas: arranca en frio, se
-- duplica en varias instancias y se apaga sola. Un contador en memoria contaria
-- una fraccion de las peticiones y daria una falsa sensacion de proteccion —
-- que es peor que no tener nada, porque se deja de mirar.
--
-- ── Ventana fija, no deslizante ───────────────────────────────────────────
-- La ventana deslizante es mas justa y necesita guardar cada peticion. Esto
-- guarda UNA fila por IP y minuto. El precio es que en el peor caso —justo en
-- el cambio de ventana— se cuela el doble del tope durante un instante. Para
-- lo que protege esto, sobra.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists peticiones (
  ip      text        not null,
  ventana timestamptz not null,
  n       int         not null default 0,
  primary key (ip, ventana)
);

create index if not exists peticiones_ventana_idx on peticiones(ventana);

-- Ni leer ni escribir desde el navegador. Como `withdrawals` o `admin_log`:
-- RLS activo y CERO politicas.
alter table peticiones enable row level security;


-- ══════════════════════════════════════════════════════════════════════════
-- Pedir permiso: incrementa y decide, en UNA llamada
-- ══════════════════════════════════════════════════════════════════════════
-- Es una consulta mas por peticion HTTP, asi que tiene que hacerlo todo de una
-- vez. Dos llamadas —leer y luego escribir— ademas de costar el doble abren
-- una carrera: dos peticiones simultaneas leerian el mismo valor.
--
-- `p_peso` deja cobrar mas por las rutas caras. Una pelea simula un combate
-- entero; leer el estado no hace nada. Cobrarlas igual seria o ahogar al que
-- solo mira, o dejar barata la que duele.
create or replace function limite_pedir(
  p_ip   text,
  p_peso int  default 1,
  p_tope int  default 120,
  p_seg  int  default 60
)
returns json
language plpgsql
security definer
as $$
declare
  v_ventana timestamptz;
  v_n       int;
begin
  if p_ip is null or length(trim(p_ip)) = 0 then
    -- Sin IP no se puede contar. Se deja pasar en vez de bloquear a todos:
    -- ver la nota de abajo sobre por que este limite nunca dice que no por
    -- las malas.
    return json_build_object('permitido', true, 'usado', 0, 'tope', p_tope);
  end if;

  -- El principio de la ventana actual. Con p_seg = 60, todas las peticiones
  -- del mismo minuto caen en la misma fila.
  v_ventana := to_timestamp(floor(extract(epoch from now()) / p_seg) * p_seg);

  insert into peticiones (ip, ventana, n)
  values (left(p_ip, 64), v_ventana, greatest(p_peso, 1))
  on conflict (ip, ventana) do update
    set n = peticiones.n + greatest(p_peso, 1)
  returning n into v_n;

  -- Limpieza perezosa, como las reservas caducadas de la preventa: no hay
  -- tarea programada que mantener. Solo de vez en cuando, porque borrar en
  -- cada peticion costaria mas que el propio limite.
  if random() < 0.01 then
    delete from peticiones where ventana < now() - interval '10 minutes';
  end if;

  return json_build_object(
    'permitido', v_n <= p_tope,
    'usado',     v_n,
    'tope',      p_tope,
    -- Cuantos segundos faltan para que la ventana se renueve. Es lo que va en
    -- la cabecera `Retry-After`: decirle a alguien que espere sin decir cuanto
    -- es lo que hace que reintente en bucle.
    'faltan',    greatest(1, ceil(extract(epoch from (v_ventana + make_interval(secs => p_seg)) - now()))::int)
  );
end;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- Permisos
-- ══════════════════════════════════════════════════════════════════════════
-- La trampa de siempre: en Postgres una funcion nace ejecutable por PUBLIC.
-- Y hay que repetirlo cada vez que se haga `create or replace`.
--
-- Aqui importa el doble: si `anon` pudiera llamarla, cualquiera podria gastar
-- el cupo de OTRA IP mandando la suya en el parametro. El limitador se
-- convertiria en el ataque.
revoke execute on function limite_pedir(text, int, int, int) from public;
revoke execute on function limite_pedir(text, int, int, int) from anon, authenticated;
grant  execute on function limite_pedir(text, int, int, int) to service_role;


select 'listo' as estado,
       (select count(*) from peticiones) as filas;
