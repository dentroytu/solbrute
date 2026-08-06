-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 36 — modo mantenimiento
-- ══════════════════════════════════════════════════════════════════════════
-- Supabase → SQL Editor → New query → pegar → Run. Repetible.
-- ANTES de redesplegar la Edge Function.
--
-- ── Para que sirve de verdad ──────────────────────────────────────────────
-- Para el rato en que la base esta a medias: un `alter table` a medio aplicar,
-- una Edge Function recien pegada, una migracion de datos. En ese hueco, una
-- pelea que entra puede escribir contra un esquema que ya no es el que espera
-- — y eso no da un error bonito, da datos torcidos.
--
-- Hasta hoy ese hueco se cubria a base de ir rapido. Con dinero de por medio,
-- ir rapido no es un plan.
--
-- ── Y para lo otro: que no parezca roto ───────────────────────────────────
-- Sin esto, el jugador ve «algo ha fallado en el servidor» y se va pensando
-- que el juego no funciona. Con esto ve «volvemos en 20 minutos», que es la
-- diferencia entre una molestia y una mala impresion.
--
-- ── Donde se comprueba ────────────────────────────────────────────────────
-- En la EDGE FUNCTION, antes de repartir a ninguna ruta. Esconder botones en
-- el navegador no para nada: las rutas se llaman con curl. Es la misma razon
-- por la que el panel de admin comprueba en el servidor.
--
-- ── El administrador NO se bloquea ────────────────────────────────────────
-- Si se bloqueara, quedarias fuera de tu propio panel justo cuando necesitas
-- entrar a apagarlo. Los de `ADMIN_WALLETS` pasan siempre.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists mantenimiento (
  id       int primary key default 1 check (id = 1),
  activo   boolean not null default false,   -- NACE APAGADO
  -- Lo que se le enseña al jugador. Vacio = un texto por defecto en su idioma.
  mensaje  text,
  -- Cuando se espera volver. Es informativo y puede estar vacio: prometer una
  -- hora y no cumplirla es peor que no decirla.
  hasta    timestamptz,
  desde    timestamptz,
  actualizado timestamptz not null default now()
);
insert into mantenimiento (id) values (1) on conflict (id) do nothing;

-- Como el resto: RLS activo y CERO politicas. Lo lee la Edge Function con
-- `service_role` y lo sirve por una ruta publica. Asi el dia que haya que
-- apagarlo tambien para las lecturas directas, se apaga en un sitio.
alter table mantenimiento enable row level security;


-- ══════════════════════════════════════════════════════════════════════════
-- ENCENDER Y APAGAR
-- ══════════════════════════════════════════════════════════════════════════
-- Deja rastro en `admin_log` con el antes y el despues. Parar el juego es la
-- accion mas visible que existe en este panel: tiene que quedar quien y cuando.
--
-- `p_admin` sale de la SESION, nunca del cuerpo. Un registro que no dice quien
-- no es auditoria — y ya costo un 500 mudo aprenderlo con `preventa_config`.
create or replace function mantenimiento_fijar(
  p_admin text, p_activo boolean, p_mensaje text, p_hasta timestamptz, p_motivo text)
returns json
language plpgsql
security definer
as $$
declare
  v_antes mantenimiento%rowtype;
  v_val   jsonb;
begin
  if p_admin is null or length(btrim(p_admin)) = 0 then raise exception 'sin_admin'; end if;
  if p_motivo is null or length(btrim(p_motivo)) < 10 then raise exception 'motivo_corto'; end if;

  select * into v_antes from mantenimiento where id = 1 for update;

  update mantenimiento set
    activo  = coalesce(p_activo, activo),
    mensaje = left(nullif(btrim(coalesce(p_mensaje, '')), ''), 200),
    hasta   = p_hasta,
    /* `desde` lo pone el servidor, no el panel: es cuando de verdad se paro,
       y sirve para saber cuanto lleva caido sin fiarse de nadie. */
    desde   = case when coalesce(p_activo, activo) and not v_antes.activo
                   then now()
                   when not coalesce(p_activo, activo) then null
                   else v_antes.desde end,
    actualizado = now()
  where id = 1;

  select to_jsonb(m.*) into v_val from mantenimiento m where m.id = 1;
  insert into admin_log (admin, accion, objetivo, antes, despues)
  values (p_admin, 'mantenimiento', 'juego', to_jsonb(v_antes),
          v_val || jsonb_build_object('motivo', p_motivo));

  return v_val;
end;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- LA TRAMPA DE SIEMPRE
-- ══════════════════════════════════════════════════════════════════════════
-- Abierta a anon, cualquiera podria parar el juego entero.
revoke execute on function mantenimiento_fijar(text, boolean, text, timestamptz, text)
  from public, anon, authenticated;
grant  execute on function mantenimiento_fijar(text, boolean, text, timestamptz, text)
  to service_role;


-- ══════════════════════════════════════════════════════════════════════════
-- Comprobacion — la primera tiene que dar CERO filas
-- ══════════════════════════════════════════════════════════════════════════
select p.proname as abierta_de_mas
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'mantenimiento_fijar'
   and (has_function_privilege('anon',   p.oid, 'execute')
     or has_function_privilege('public', p.oid, 'execute'));

select activo, mensaje, hasta from mantenimiento where id = 1;

select relrowsecurity as rls_activo,
       (select count(*) from pg_policies where tablename = 'mantenimiento') as politicas
  from pg_class where relname = 'mantenimiento';
