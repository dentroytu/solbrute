-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 38 — un torneo no puede quedarse atascado con el bote dentro
-- ══════════════════════════════════════════════════════════════════════════
-- Supabase → SQL Editor → New query → pegar → Run. Repetible.
-- Va CON el redespliegue de la Edge Function `auth` (el panel tambien cambia).
--
-- ── El hueco ──────────────────────────────────────────────────────────────
-- Resolver un torneo son dos llamadas, y entre medias pasa todo el trabajo:
--
--     torneo_tomar    exige 'inscripcion'   →  deja 'en_curso'
--        ...barajar, simular los 15 combates de un cuadro de 16,
--           y mandar el cuadro entero con el registro de cada pelea...
--     torneo_cerrar   exige 'en_curso'      →  deja 'terminado'
--
-- Si algo falla en medio —un fallo de red al mandar el cuadro, que con 16
-- inscritos son varios cientos de KB— el torneo se queda en 'en_curso' PARA
-- SIEMPRE: el bote retenido, nadie cobra, y ninguna ruta lo puede rescatar.
-- `admin_torneo_resolver` exigia 'inscripcion', asi que desde el panel
-- tampoco.
--
-- Hoy no hay ningun torneo creado, asi que esto es latente. Se arregla ahora
-- porque el dia que pase habra dinero de gente dentro.
--
-- ── Por que volver a tomarlo es SEGURO ────────────────────────────────────
-- Esta es la parte que hace que el arreglo valga: `torneo_cerrar` es una
-- funcion de plpgsql, o sea UNA transaccion. Si falla a mitad no deja nada
-- escrito — ni un combate, ni un premio, ni el estado. Asi que un torneo en
-- 'en_curso' es, con certeza, uno del que NO se ha guardado nada.
--
-- Volver a tomarlo no puede duplicar combates ni pagar dos veces. Lo unico
-- que cambia es que el cuadro se sortea otra vez con otra semilla, y eso da
-- igual: el anterior no llego a existir en ningun sitio.
--
-- Y si `torneo_cerrar` SI llego a guardar pero la respuesta se perdio por el
-- camino, el estado ya es 'terminado' y este `if` lo rechaza igual que antes.
-- Los dos casos quedan cubiertos por el mismo estado.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function torneo_tomar(p_torneo bigint)
returns json
language plpgsql
security definer
as $$
declare t record; v_n int;
begin
  select * into t from tournaments where id = p_torneo for update;
  if not found then raise exception 'torneo_desconocido'; end if;

  -- 'en_curso' ENTRA: es un torneo que se empezo a resolver y no llego a
  -- cerrarse. Ver la cabecera: `torneo_cerrar` es atomico, asi que de ese no
  -- se guardo nada y rehacerlo no duplica nada.
  if t.estado not in ('inscripcion', 'en_curso') then raise exception 'no_resoluble'; end if;
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
-- LA TRAMPA DE SIEMPRE
-- ══════════════════════════════════════════════════════════════════════════
-- En Postgres una funcion nace ejecutable por PUBLIC y `create or replace`
-- vuelve a concederlo. Hay que revocar CADA VEZ que se recrea, y este fichero
-- la recrea. Abierta a anon, cualquiera resolveria torneos ajenos.
revoke execute on function torneo_tomar(bigint) from public, anon, authenticated;
grant  execute on function torneo_tomar(bigint) to service_role;


-- ══════════════════════════════════════════════════════════════════════════
-- Comprobacion — la primera tiene que dar CERO filas
-- ══════════════════════════════════════════════════════════════════════════
select p.proname as abierta_de_mas
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'torneo_tomar'
   and (has_function_privilege('anon',   p.oid, 'execute')
     or has_function_privilege('public', p.oid, 'execute'));

-- Y si hubiera alguno atascado, aqui saldria. Con la funcion nueva, el boton
-- «Resolver ya» del panel lo saca solo.
select id, nombre, estado, bote, empieza_at
  from tournaments where estado = 'en_curso';
