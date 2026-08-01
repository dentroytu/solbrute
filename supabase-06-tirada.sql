-- ══════════════════════════════════════════════════════════════════════════
-- SolBrute · paso 6 — la tirada de atributos la guarda el servidor
-- ══════════════════════════════════════════════════════════════════════════
-- Supabase → SQL Editor → New query → pegar → Run. Repetible.
--
-- ── El agujero que cierra ─────────────────────────────────────────────────
-- Hasta ahora la forja sorteaba los atributos EN EL NAVEGADOR y los mandaba.
-- El servidor solo los recortaba a 1-10, que es el tope de un bruto de nivel
-- máximo, no el de una tirada inicial (1-4). Comprobado: se podía forjar un
-- bruto de nivel 1 con 10/10/10 y 300 de vida desde la consola.
--
-- Con monedas de juguete daba igual. Con un token de verdad, ese bruto gana
-- todas las peleas todos los días: una máquina de imprimir dinero.
--
-- ── Cómo se cierra ────────────────────────────────────────────────────────
-- La tirada la hace el servidor y la guarda aquí, pegada a tu sesión. Volver
-- a tirar la sustituye. Al forjar se usa ESTA, no la que mande el navegador,
-- y se borra para que no valga dos veces.
--
-- Es la misma idea que la semilla del combate: si el jugador elige el número,
-- elige el resultado.
-- ══════════════════════════════════════════════════════════════════════════

alter table sessions add column if not exists roll jsonb;

-- Recordatorio: sessions tiene RLS activo y CERO políticas, así que el
-- navegador no puede leer ni escribir aquí. Solo entra la Edge Function con
-- service_role. Si pudiera leerla, vería su propia tirada antes de decidir
-- —da igual— pero también podría escribirla, que es justo lo que evitamos.
