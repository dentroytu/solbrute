// ══════════════════════════════════════════════════════════════════════════
// SolBrute · ataque a la preventa, contra el SERVIDOR DESPLEGADO
// ══════════════════════════════════════════════════════════════════════════
//
//   node prueba-preventa.mjs
//
// No usa base simulada: habla con la Edge Function de verdad y con Postgres de
// verdad, con claves ed25519 recien generadas. Es la misma forma en que se
// atacaron la economia y el inventario, y por el mismo motivo — editar el
// JavaScript del navegador es MENOS peligroso que llamar a la API con curl,
// que es lo que hace esto.
//
// ── Por que existe ────────────────────────────────────────────────────────
// La preventa es la unica parte del proyecto donde alguien manda dinero ANTES
// de recibir nada. Todo lo demas protege un numero; aqui hay SOL de por medio.
//
// ── Es seguro pasarlo con la preventa encendida ───────────────────────────
// Ningun ataque compra nada ni mueve saldo: o le falta la firma, o la lleva
// mal, o pide algo que no es suyo. Lo unico que llega a tocar la base es una
// reserva legitima, y esa se hace SOLO si la preventa esta abierta y caduca
// sola en quince minutos.
//
// ── Si añades una ruta a `retirar`, añadele aqui su ataque ────────────────
// Esto aguanta porque se prueba, no porque el codigo sea bonito.
// ══════════════════════════════════════════════════════════════════════════

import { generateKeyPairSync, sign as firmarCon } from "node:crypto";
import { readFileSync } from "node:fs";

const FUENTE = readFileSync(new URL("./supabase-cliente.js", import.meta.url), "utf8");
const BASE = /const URL_BASE = "([^"]+)"/.exec(FUENTE)[1];
const ANON = /const ANON = "([^"]+)"/.exec(FUENTE)[1];
const FN   = BASE + "/functions/v1/retirar";
const REST = BASE + "/rest/v1";

/* base58, a mano y sin dependencias, igual que en `wallet-solana.js`.
   El acumulador arranca VACIO: con un cero dentro, toda entrada que empiece
   por byte 0 sale con un «1» de mas. */
const ALFA = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58(buf) {
  const d = [];
  for (const b of buf) {
    let c = b;
    for (let i = 0; i < d.length; i++) { c += d[i] << 8; d[i] = c % 58; c = (c / 58) | 0; }
    while (c) { d.push(c % 58); c = (c / 58) | 0; }
  }
  let out = "";
  for (const b of buf) { if (b === 0) out += "1"; else break; }
  return out + d.reverse().map((x) => ALFA[x]).join("");
}

/* Una wallet de Solana ES una clave publica ed25519 en base58. Generarla aqui
   es exactamente lo que hace Phantom, sin Phantom. */
function walletNueva() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  /* Los ultimos 32 bytes del DER SPKI son la clave publica pelada, que es
     exactamente lo que Solana llama «direccion». */
  const cruda = publicKey.export({ type: "spki", format: "der" }).subarray(-32);
  return { dir: b58(cruda), priv: privateKey };
}

const mensajeDe = (dir, fecha) => [
  "solbrute.io wants you to verify your Solana account:",
  dir, "",
  "SolBrute presale. Signing is free and moves no funds.",
  "The payment itself is a separate transaction you approve after this.",
  "", "Issued At: " + fecha,
].join("\n");

const firmar = (priv, msg) => b58(firmarCon(null, Buffer.from(msg, "utf8"), priv));

async function pedir(cuerpo) {
  const r = await fetch(FN, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON, Authorization: "Bearer " + ANON },
    body: JSON.stringify(cuerpo),
  });
  let j = {}; try { j = await r.json(); } catch {}
  return { s: r.status, j };
}

async function rpc(fn, args) {
  const r = await fetch(REST + "/rpc/" + fn, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON, Authorization: "Bearer " + ANON },
    body: JSON.stringify(args),
  });
  let j = {}; try { j = await r.json(); } catch {}
  return { s: r.status, code: j.code, j };
}

const fallos = [];
const quinientos = [];
function probar(nombre, funciona, detalle) {
  console.log(`${funciona ? "  ✗ AGUANTA MAL" : "  ✓"}  ${nombre}${detalle ? "  ·  " + detalle : ""}`);
  if (funciona) fallos.push(nombre);
  /* Un 500 no es un ataque que funcione, pero tampoco es aguantar bien: es el
     servidor cayendose por una entrada que el navegador puede mandar cuando
     quiera, y sin decir por que. Ya paso con `tokens: 1e21`, que es finito y
     positivo y Postgres no puede meter en un bigint.

     Se cuenta aparte para que no se confunda con un agujero, pero se cuenta. */
  if (/(^|\s)5\d\d(\s|$)/.test(String(detalle || ""))) quinientos.push(nombre + " → " + detalle);
}

// ══════════════════════════════════════════════════════════════════════════
console.log("\nAtacando la preventa en " + BASE + "\n");

const yo    = walletNueva();
const otro  = walletNueva();
const ahora = () => new Date().toISOString();

const estado = (await pedir({ accion: "pv_estado" })).j;
console.log(`  estado: ${estado.activa ? "ABIERTA" : "cerrada"} · cupo ${estado.cupo} · precio ${estado.precio} lamports\n`);

// ── 1 · sin firma ─────────────────────────────────────────────────────────
{
  const r = await pedir({ accion: "pv_reservar", address: yo.dir, tokens: 1000 });
  probar("reservar sin firma", r.s === 200, `${r.s} ${r.j.clase || ""}`);
}
{
  const r = await pedir({ accion: "pv_reclamar", address: yo.dir });
  probar("reclamar sin firma", r.s === 200, `${r.s} ${r.j.clase || ""}`);
}

// ── 2 · firma inventada ───────────────────────────────────────────────────
{
  const r = await pedir({
    accion: "pv_reservar", address: yo.dir, tokens: 1000,
    mensaje: mensajeDe(yo.dir, ahora()), firma: b58(Buffer.alloc(64, 7)),
  });
  probar("reservar con una firma inventada", r.s === 200, `${r.s} ${r.j.clase || ""}`);
}

// ── 3 · firma VALIDA pero de otra wallet ──────────────────────────────────
/* Este es el ataque de verdad: la firma cuadra criptograficamente, pero la
   hizo otra clave. Si pasara, cualquiera bloquearia el cupo con direcciones
   ajenas — o peor, reclamaria los tokens de otro. */
{
  const msg = mensajeDe(yo.dir, ahora());
  const r = await pedir({
    accion: "pv_reservar", address: yo.dir, tokens: 1000,
    mensaje: msg, firma: firmar(otro.priv, msg),
  });
  probar("firmar con OTRA clave la direccion de uno", r.s === 200, `${r.s} ${r.j.clase || ""}`);
}

// ── 4 · firma propia, valida, pero para OTRA direccion ────────────────────
/* El mensaje lleva la direccion dentro justo para esto. Sin esa comprobacion,
   una firma dada en cualquier otro sitio valdria aqui. */
{
  const msg = mensajeDe(otro.dir, ahora());
  const r = await pedir({
    accion: "pv_reservar", address: yo.dir, tokens: 1000,
    mensaje: msg, firma: firmar(yo.priv, msg),
  });
  probar("mensaje que nombra a otra direccion", r.s === 200, `${r.s} ${r.j.clase || ""}`);
}

// ── 5 · repeticion: una firma vieja ───────────────────────────────────────
/* Sin la fecha, una firma capturada una vez valdria para siempre. */
for (const [nombre, mins] of [["de hace una hora", 60], ["del futuro", -60]]) {
  const f = new Date(Date.now() - mins * 60_000).toISOString();
  const msg = mensajeDe(yo.dir, f);
  const r = await pedir({
    accion: "pv_reservar", address: yo.dir, tokens: 1000,
    mensaje: msg, firma: firmar(yo.priv, msg),
  });
  probar("reusar una firma " + nombre, r.s === 200, `${r.s} ${r.j.clase || ""}`);
}

// ── 6 · sin fecha ninguna ─────────────────────────────────────────────────
{
  const msg = "dame tokens " + yo.dir;
  const r = await pedir({
    accion: "pv_reservar", address: yo.dir, tokens: 1000,
    mensaje: msg, firma: firmar(yo.priv, msg),
  });
  probar("firmar un mensaje sin fecha", r.s === 200, `${r.s} ${r.j.clase || ""}`);
}

// ── 7 · direcciones que no lo son ─────────────────────────────────────────
for (const mala of ["", "0x1234", "'; drop table preventa; --", "1".repeat(200)]) {
  const r = await pedir({ accion: "pv_reservar", address: mala, tokens: 1 });
  probar(`reservar con la direccion ${JSON.stringify(mala.slice(0, 24))}`, r.s === 200, `${r.s}`);
}

// ── 8 · cantidades absurdas, con firma BUENA ──────────────────────────────
/* Aqui la firma es correcta a proposito: lo que se ataca es el numero, no la
   identidad. Con la preventa cerrada corta antes; con ella abierta, el que
   tiene que decir que no es el cupo. */
{
  const msg = mensajeDe(yo.dir, ahora());
  const firma = firmar(yo.priv, msg);
  for (const t of [0, -1, 1e15, "999999999999999999999", 1.5, null]) {
    const r = await pedir({ accion: "pv_reservar", address: yo.dir, tokens: t, mensaje: msg, firma });
    const compro = r.s === 200 && r.j.id;
    probar(`reservar ${JSON.stringify(t)} tokens`, compro, `${r.s} ${r.j.clase || r.j.error || ""}`);
  }
}

// ── 9 · decir «ya he pagado» sin haber pagado ─────────────────────────────
/* El pago se comprueba EN LA CADENA. Creerse al navegador aqui seria regalar
   tokens: bastaria con decir «ya pague, esta es una firma cualquiera». */
{
  const msg = mensajeDe(yo.dir, ahora());
  const firma = firmar(yo.priv, msg);
  for (const id of [1, 2, 999999]) {
    const r = await pedir({
      accion: "pv_pagado", address: yo.dir, mensaje: msg, firma,
      id, firma_pago: b58(Buffer.alloc(64, 3)),
    });
    probar(`confirmar la compra ${id} sin haber pagado`, r.s === 200 && !r.j.error, `${r.s} ${r.j.clase || ""}`);
  }
}

// ── 10 · reclamar con los reclamos cerrados ───────────────────────────────
{
  const msg = mensajeDe(yo.dir, ahora());
  const r = await pedir({ accion: "pv_reclamar", address: yo.dir, mensaje: msg, firma: firmar(yo.priv, msg) });
  probar("reclamar tokens que no se han comprado", r.s === 200, `${r.s} ${r.j.clase || ""}`);
}

// ── 11 · saltarse la Edge Function y llamar a Postgres ────────────────────
/* La trampa de siempre: en Postgres una funcion nace ejecutable por PUBLIC, y
   `create or replace` vuelve a concederlo. Ya deshizo en silencio un revoke
   dos veces en este proyecto. */
{
  const casos = [
    ["preventa_estado", {}],
    ["preventa_reservar", { p_address: "x", p_tokens: -1 }],
    ["preventa_confirmar", { p_id: 1, p_firma: "corta" }],
    ["preventa_mias", { p_address: "x" }],
    ["preventa_config", { p_admin: "x", p_campos: {}, p_motivo: "x" }],
    ["preventa_reclamar_abrir", { p_address: "x" }],
    ["preventa_reclamar_firmar", { p_id: 1, p_firma: "corta" }],
    ["preventa_reclamar_cerrar", { p_id: 1, p_estado: "inventado" }],
  ];
  let abiertas = [];
  for (const [fn, args] of casos) {
    const r = await rpc(fn, args);
    /* PGRST202 NO vale como aprobado: significa «no encuentro esa firma», que
       es lo que pasa si mandas los parametros mal. Se exige 42501. */
    if (r.code === "PGRST202") abiertas.push(fn + " (firma mal, prueba invalida)");
    else if (r.code !== "42501") abiertas.push(fn + " → " + (r.code || r.s));
  }
  probar("llamar a las 8 funciones con la clave anon", abiertas.length > 0,
         abiertas.length ? abiertas.join(", ") : "42501 las ocho");
}

// ── 12 · leer las tablas ──────────────────────────────────────────────────
/* OJO con interpretarlo: RLS con cero politicas devuelve `200 []` siempre. Lo
   que lo convierte en prueba es que `preventa` TIENE una fila (id=1) y aun asi
   sale vacia — o sea que no se ve, no que no exista. */
{
  let leidas = [];
  for (const t of ["preventa", "preventa_compras", "preventa_reclamos"]) {
    const r = await fetch(`${REST}/${t}?select=*`, { headers: { apikey: ANON, Authorization: "Bearer " + ANON } });
    const j = await r.json().catch(() => []);
    if (Array.isArray(j) && j.length) leidas.push(`${t} (${j.length} filas)`);
  }
  probar("leer las tablas de la preventa con anon", leidas.length > 0,
         leidas.length ? leidas.join(", ") : "las tres invisibles, y `preventa` tiene fila");
}

// ── 13 · escribir directamente en las tablas ──────────────────────────────
/* Y aqui la OTRA cara de la trampa: un PATCH bloqueado devuelve 204 sin tocar
   nada. Hay que mirar la fila despues, nunca el codigo de estado — solo que
   aqui la fila tampoco se puede leer, asi que se comprueba por el otro lado:
   `pv_estado`, que si la ve, a traves de la funcion. */
{
  const antes = (await pedir({ accion: "pv_estado" })).j;
  await fetch(`${REST}/preventa?id=eq.1`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", apikey: ANON, Authorization: "Bearer " + ANON },
    body: JSON.stringify({ activa: true, cupo_total: 999999999, precio_lamports: 1 }),
  }).catch(() => {});
  await fetch(`${REST}/preventa_compras`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON, Authorization: "Bearer " + ANON },
    body: JSON.stringify({ address: yo.dir, tokens: 1e6, lamports: 0, estado: "pagada", caduca: "2099-01-01" }),
  }).catch(() => {});
  const despues = (await pedir({ accion: "pv_estado" })).j;
  const cambio = JSON.stringify(antes) !== JSON.stringify(despues);
  probar("encenderla y regalarse tokens con un PATCH/POST directo", cambio,
         cambio ? JSON.stringify(despues) : "la fila no se movio");
}

// ── 14 · el historial de otro ─────────────────────────────────────────────
/* `pv_mias` no pide firma a proposito —lo que devuelve ya esta en la cadena—
   asi que esto NO es un agujero. Lo que si seria un fallo es que devolviera
   algo distinto de lo de esa direccion. */
{
  const r = await pedir({ accion: "pv_mias", address: otro.dir });
  const suyo = r.s === 200 && Number(r.j.pagado) === 0 && Number(r.j.entregado) === 0;
  probar("pedir lo de una direccion ajena devuelve algo que no es suyo", r.s === 200 && !suyo,
         `${r.s} pagado=${r.j.pagado} entregado=${r.j.entregado}`);
}

// ── 15 · la ruta de admin de `retirar` ────────────────────────────────────
/* `pv_fondos` enseña el saldo del cofre. Va por sesion, no por firma, asi que
   se ataca con un token inventado y sin token. */
for (const [nombre, cuerpo] of [
  ["sin token", { accion: "pv_fondos" }],
  ["con un token inventado", { accion: "pv_fondos", token: "a".repeat(43) }],
]) {
  const r = await pedir(cuerpo);
  probar("mirar el saldo del cofre " + nombre, r.s === 200, `${r.s} ${r.j.error || ""}`);
}

// ── 16 · acciones inventadas ──────────────────────────────────────────────
for (const a of ["pv_", "pv_regalar", "pv_config", "pv_admin", "pv_estado_"]) {
  const r = await pedir({ accion: a, address: yo.dir });
  probar(`la accion inventada "${a}"`, r.s === 200, `${r.s} ${r.j.error || ""}`);
}

// ══════════════════════════════════════════════════════════════════════════
console.log("");
if (!fallos.length) console.log("Ningun ataque a la preventa funciona.");
else { console.log("HALLAZGOS:\n" + fallos.map((f) => "  · " + f).join("\n")); process.exitCode = 1; }
if (quinientos.length) {
  console.log("\nERRORES MUDOS (500) — no son agujeros, pero hay que traducirlos:\n" +
              quinientos.map((f) => "  · " + f).join("\n"));
  process.exitCode = 1;
}
console.log("");
