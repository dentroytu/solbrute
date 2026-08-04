// ══════════════════════════════════════════════════════════════════════════
// SolBrute · comprar en la preventa DE VERDAD, contra devnet
// ══════════════════════════════════════════════════════════════════════════
//
//   node prueba-pago-devnet.mjs
//
// `prueba-preventa.mjs` comprueba que nadie puede colarse. Esto comprueba lo
// contrario: que quien SI paga, cobra. Son la misma pieza vista por sus dos
// caras, y ninguna de las dos vale sin la otra — un sistema que rechaza todo
// pasa el banco de ataque con matricula.
//
// Hace el camino entero, sin navegador y sin Phantom:
//
//   1. firma la prueba de propiedad de la wallet
//   2. pv_reservar          → el servidor devuelve la transaccion YA MONTADA
//   3. la firma y la manda a devnet
//   4. pv_pagado            → el servidor la busca EN LA CADENA
//   5. pv_mias              → comprueba que los tokens estan apuntados
//
// ── Por que no usa @solana/web3.js ────────────────────────────────────────
// Porque no hace falta y este proyecto no tiene dependencias. Lo unico que hay
// que hacer con la transaccion es firmarla, y una transaccion de Solana sin
// firmar es:
//
//     [numero de firmas][64 bytes a cero por cada una][mensaje]
//
// Firmar es poner ed25519 sobre el mensaje y escribirlo en su hueco. Node trae
// ed25519 de serie.
//
// Y hay algo mejor: al no usar la misma libreria que el servidor, si el
// formato estuviera mal, esto lo veria. Una prueba que usa el mismo codigo que
// lo que prueba no prueba el formato, solo que consigo mismo se entiende.
//
// ── La cuenta que paga ────────────────────────────────────────────────────
// Se guarda en `.comprador-devnet.json`, que NO va al repositorio. Es una
// clave de devnet y no vale nada, pero una clave privada en un repo publico es
// un habito que no conviene coger.
// ══════════════════════════════════════════════════════════════════════════

import { generateKeyPairSync, createPrivateKey, sign as firmarCon } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const FUENTE = readFileSync(new URL("./supabase-cliente.js", import.meta.url), "utf8");
const BASE = /const URL_BASE = "([^"]+)"/.exec(FUENTE)[1];
const ANON = /const ANON = "([^"]+)"/.exec(FUENTE)[1];
const FN   = BASE + "/functions/v1/retirar";
const RPC  = process.env.SOLANA_RPC || "https://api.devnet.solana.com";
const CARTERA = new URL("./.comprador-devnet.json", import.meta.url);

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

/* La cuenta se reutiliza entre pasadas: pedir SOL al faucet en cada ejecucion
   seria pedirlo cada vez, y el faucet publico se cansa enseguida. */
function comprador() {
  if (existsSync(CARTERA)) {
    const g = JSON.parse(readFileSync(CARTERA, "utf8"));
    return { dir: g.dir, priv: createPrivateKey({ key: Buffer.from(g.pkcs8, "base64"), format: "der", type: "pkcs8" }) };
  }
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const dir = b58(publicKey.export({ type: "spki", format: "der" }).subarray(-32));
  writeFileSync(CARTERA, JSON.stringify({
    dir, pkcs8: privateKey.export({ type: "pkcs8", format: "der" }).toString("base64"),
  }, null, 2));
  return { dir, priv: privateKey };
}

async function pedir(cuerpo) {
  const r = await fetch(FN, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON, Authorization: "Bearer " + ANON },
    body: JSON.stringify(cuerpo),
  });
  let j = {}; try { j = await r.json(); } catch {}
  return { s: r.status, j };
}

async function rpc(metodo, params) {
  const r = await fetch(RPC, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: metodo, params }),
  });
  return await r.json();
}

const yo = comprador();
const prueba = () => {
  const mensaje = [
    "solbrute.io wants you to verify your Solana account:",
    yo.dir, "",
    "SolBrute presale. Signing is free and moves no funds.",
    "The payment itself is a separate transaction you approve after this.",
    "", "Issued At: " + new Date().toISOString(),
  ].join("\n");
  return { mensaje, firma: b58(firmarCon(null, Buffer.from(mensaje, "utf8"), yo.priv)) };
};

const paso = (n, t) => console.log(`\n${n}. ${t}`);
const bien = (t) => console.log("   ✓ " + t);
const mal  = (t) => { console.log("   ✗ " + t); process.exitCode = 1; };

// ══════════════════════════════════════════════════════════════════════════
console.log("\nComprando en la preventa · " + RPC.replace(/\?.*/, ""));
console.log("comprador: " + yo.dir);

paso(1, "¿esta abierta?");
const est = (await pedir({ accion: "pv_estado" })).j;
console.log(`   activa=${est.activa} precio=${est.precio} minimo=${est.minimo} queda=${est.queda}`);
if (!est.activa) {
  mal("la preventa esta cerrada. Enciendela en el panel (y revisa la fecha de inicio).");
  process.exit(1);
}

const TOKENS = Math.max(Number(est.minimo) || 1, 1000);
const coste = TOKENS * Number(est.precio);

paso(2, "saldo del comprador");
const saldo = (await rpc("getBalance", [yo.dir]))?.result?.value ?? 0;
console.log(`   ${(saldo / 1e9).toFixed(4)} SOL · hacen falta ${(coste / 1e9).toFixed(4)} + comision`);
if (saldo < coste + 10_000) {
  mal(`sin SOL de devnet. Mandale al menos ${((coste + 1e7) / 1e9).toFixed(2)} SOL a:\n     ${yo.dir}`);
  process.exit(1);
}

paso(3, `reservar ${TOKENS} tokens`);
const p1 = prueba();
const res = await pedir({ accion: "pv_reservar", address: yo.dir, tokens: TOKENS, ...p1 });
if (res.s !== 200) { mal(`${res.s} ${JSON.stringify(res.j)}`); process.exit(1); }
bien(`reserva ${res.j.id} · ${res.j.lamports} lamports · cobra ${res.j.wallet}`);

/* Lo que de verdad se comprueba aqui: que el destino y el importe NO los pone
   el navegador. Vienen dentro de la transaccion que monto el servidor. */
if (String(res.j.wallet) === yo.dir) {
  mal("la wallet que cobra es la MISMA que paga. El saldo destino no sube, baja por la comision, y el pago se rechazara. Pon otra en el panel.");
  process.exit(1);
}

paso(4, "firmar la transaccion que mando el servidor");
const cruda = Buffer.from(res.j.tx, "base64");
/* [compact-u16: numero de firmas][64 bytes por firma][mensaje]. Con una sola
   firma el primer byte es 1 y no hay continuacion, asi que basta con leerlo. */
const nFirmas = cruda[0];
if (nFirmas !== 1) { mal(`esperaba 1 firma y la transaccion pide ${nFirmas}`); process.exit(1); }
const mensaje = cruda.subarray(1 + 64 * nFirmas);
const firmaTx = firmarCon(null, mensaje, yo.priv);
firmaTx.copy(cruda, 1);
const firma = b58(firmaTx);
bien("firma " + firma.slice(0, 24) + "…");

paso(5, "mandarla a la red");
const env = await rpc("sendTransaction", [cruda.toString("base64"), { encoding: "base64", preflightCommitment: "confirmed" }]);
if (env.error) { mal(JSON.stringify(env.error).slice(0, 300)); process.exit(1); }
bien("enviada · " + env.result.slice(0, 24) + "…");

paso(6, "esperar a que la red la asiente");
let asentada = false;
for (let i = 0; i < 30 && !asentada; i++) {
  const st = (await rpc("getSignatureStatuses", [[firma], { searchTransactionHistory: true }]))?.result?.value?.[0];
  if (st?.confirmationStatus) {
    if (st.err) { mal("la transaccion fallo en la cadena: " + JSON.stringify(st.err)); process.exit(1); }
    asentada = true; bien("confirmada (" + st.confirmationStatus + ")");
  } else await new Promise((r) => setTimeout(r, 2000));
}
if (!asentada) { mal("no se confirmo en 60 s"); process.exit(1); }

paso(7, "decirle al servidor que se ha pagado");
/* El servidor NO se cree esto: va a la cadena a mirarlo. Por eso puede tardar
   un par de intentos aunque la red ya la haya asentado. */
let ok = null;
for (let i = 0; i < 8 && !ok; i++) {
  const p = prueba();
  const r = await pedir({ accion: "pv_pagado", address: yo.dir, id: res.j.id, firma_pago: firma, ...p });
  if (r.s === 200) ok = r.j;
  else if (r.j.clase === "no_encontrada" || r.j.clase === "rpc") await new Promise((x) => setTimeout(x, 3000));
  else { mal(`${r.s} ${JSON.stringify(r.j)}`); process.exit(1); }
}
if (!ok) { mal("el servidor no llego a ver el pago"); process.exit(1); }
bien(`confirmado · ${ok.tokens} tokens`);

paso(8, "¿aparecen como mios?");
const mias = (await pedir({ accion: "pv_mias", address: yo.dir })).j;
console.log(`   pagado=${mias.pagado} entregado=${mias.entregado} SOL=${(Number(mias.lamports) / 1e9).toFixed(4)}`);
if (Number(mias.pagado) < TOKENS) mal("no cuadran los tokens apuntados"); else bien("cuadra");

paso(9, "y el cupo global");
const est2 = (await pedir({ accion: "pv_estado" })).j;
console.log(`   vendido ${est.vendido} → ${est2.vendido} · queda ${est.queda} → ${est2.queda}`);
if (Number(est2.vendido) - Number(est.vendido) !== TOKENS) mal("el cupo vendido no subio lo que debia");
else bien("el cupo baja exactamente lo comprado");

paso(10, "pagar DOS VECES la misma reserva");
/* Que no cobre dos veces por el mismo pago. `preventa_compras.firma` es unica
   y el estado ya no es «reservada», asi que tiene que decir «ya». */
{
  const p = prueba();
  const r = await pedir({ accion: "pv_pagado", address: yo.dir, id: res.j.id, firma_pago: firma, ...p });
  const est3 = (await pedir({ accion: "pv_estado" })).j;
  if (Number(est3.vendido) !== Number(est2.vendido)) mal("¡el cupo vendido subio otra vez!");
  else bien(`no cuenta dos veces (${r.s} · ${r.j.ya ? "ya" : JSON.stringify(r.j).slice(0, 60)})`);
}

console.log(process.exitCode ? "\nHay algo que no cuadra.\n" : "\nLa compra funciona de punta a punta.\n");
