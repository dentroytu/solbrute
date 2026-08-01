// ══════════════════════════════════════════════════════════════════════════
// SolBrute · función de PRUEBA — ¿puede la Edge Function hablar con Solana?
// ══════════════════════════════════════════════════════════════════════════
//
//   ⚠️  ESTO NO ES LA FUNCIÓN DEL JUEGO. Se despliega como una función NUEVA
//       y separada (nombre sugerido: `prueba-solana`). NO pegues esto encima
//       de `supabase-funcion-auth.ts` — ahí vive el login y las escrituras.
//
//   Se despliega, se lee la respuesta, y se BORRA. No lleva secretos, no
//   escribe en la base de datos y no envía nada a ninguna cadena: las claves
//   se generan al vuelo en memoria y mueren con la petición.
//
// ── Por qué existe esta prueba ────────────────────────────────────────────
//
// Toda la arquitectura de retirada del TOKEN.md descansa en una suposición
// que NADIE ha comprobado: que esta función puede construir y firmar una
// transacción de Solana.
//
// Y hay motivo para dudar. El empaquetador de Supabase ya rechazó una vez
// traer `brute-combate.js` desde la web:
//
//     Cannot import from dentroytu.github.io:443
//
// Si también rechaza `npm:@solana/web3.js`, la retirada no puede vivir aquí
// y hay que replantear dónde vive — antes de crear ningún token, no después.
//
// Cuesta menos responderla que discutirla.
//
// ── Las cuatro preguntas ──────────────────────────────────────────────────
//
//   1. ¿EMPAQUETA?    Si el despliegue falla, la respuesta es no y ya está.
//                     No hace falta ni llamarla.
//   2. ¿CONSTRUYE?    Montar la instrucción de transferencia SPL. Es
//                     literalmente lo que hará una retirada.
//   3. ¿FIRMA?        Firmar esa transacción. Prueba que el ed25519 de este
//                     entorno funciona — en algunos runtimes no está.
//   4. ¿SALE A LA RED? Preguntarle a un RPC de devnet. Sin salida a internet
//                     no puede ni enviar la transacción ni confirmarla.
//
// Las cuatro tienen que dar `true`. Tres de cuatro no sirve de nada.
//
// ── Solo se usan las DOS librerías que importan ───────────────────────────
// Nada de utilidades auxiliares. Si metiera una tercera dependencia y fallara
// ella, el resultado no diría lo que quiero saber. Todo lo que hace falta
// —generar claves, base58, firmar— ya viene dentro de web3.js.
// ══════════════════════════════════════════════════════════════════════════

// Las versiones van FIJADAS a propósito. Un `npm:@solana/web3.js` sin versión
// resuelve a la última cada vez que se redespliega, y una función que se
// comporta distinto según el día es imposible de depurar. Son las mismas
// versiones instaladas en local.
import {
  Connection,
  Keypair,
  Transaction,
} from "npm:@solana/web3.js@1.98.4";

import {
  createTransferInstruction,
  getAssociatedTokenAddress,
} from "npm:@solana/spl-token@0.4.15";

Deno.serve(async () => {
  // Cada comprobación en su propio try. Si falla la red no quiero perder el
  // resultado de la firma: el objetivo es saber QUÉ falla, no que falle.
  const r: Record<string, unknown> = {
    empaqueta: true,   // si esto se ejecuta, el bundler aceptó los imports
    construye: false,
    firma: false,
    red: false,
  };

  // Claves generadas al vuelo. NINGUNA es la del tesoro y no se guardan en
  // ningún sitio: existen durante esta petición y se descartan.
  //
  // Se usan claves generadas también para el mint y el destino en vez de
  // direcciones conocidas escritas a mano: una dirección mal copiada haría
  // fallar la prueba por el motivo equivocado.
  const tesoro  = Keypair.generate();
  const mint    = Keypair.generate().publicKey;
  const jugador = Keypair.generate().publicKey;

  r.tesoro_prueba = tesoro.publicKey.toBase58();

  // ── 2. ¿Construye una transferencia SPL? ────────────────────────────────
  // Esto es una retirada: mover tokens del tesoro a la wallet del jugador.
  let tx: Transaction | null = null;
  try {
    const origen  = await getAssociatedTokenAddress(mint, tesoro.publicKey);
    const destino = await getAssociatedTokenAddress(mint, jugador);

    const ix = createTransferInstruction(
      origen,
      destino,
      tesoro.publicKey,
      1_000_000_000n,          // 1 token con 9 decimales
    );

    tx = new Transaction().add(ix);
    r.construye = ix.keys.length > 0 && ix.data.length > 0;
    r.programa  = ix.programId.toBase58();
  } catch (e) {
    r.construye_error = String(e);
  }

  // ── 3. ¿Firma? ──────────────────────────────────────────────────────────
  // Se firma con un blockhash de mentira a propósito: firmar no lo valida, y
  // así esta comprobación no depende de que la red funcione. Si dependiera,
  // un fallo de red me dejaría sin saber si la firma va.
  try {
    if (!tx) throw new Error("sin transacción que firmar");
    tx.recentBlockhash = Keypair.generate().publicKey.toBase58(); // 32 bytes base58
    tx.feePayer = tesoro.publicKey;
    tx.sign(tesoro);

    const f = tx.signatures[0]?.signature;
    r.firma = !!f && f.length === 64;
    r.firma_bytes = f?.length ?? 0;

    // Y que además VERIFIQUE. Una firma de 64 bytes puede ser basura de 64
    // bytes; esto comprueba que el ed25519 de verdad cuadra.
    r.firma_verifica = tx.verifySignatures();
  } catch (e) {
    r.firma_error = String(e);
  }

  // ── 4. ¿Sale a la red? ──────────────────────────────────────────────────
  // Devnet y una llamada gratis que no necesita clave ni fondos. Si la salida
  // a internet estuviera cortada, la retirada no podría ni confirmarse.
  try {
    const con = new Connection("https://api.devnet.solana.com", "confirmed");
    const bh  = await con.getLatestBlockhash();
    r.red = typeof bh.blockhash === "string" && bh.blockhash.length > 30;
    r.blockhash = bh.blockhash;
  } catch (e) {
    r.red_error = String(e);
  }

  const ok = r.construye && r.firma && r.firma_verifica && r.red;
  r.veredicto = ok
    ? "SÍ — la retirada puede vivir en la Edge Function"
    : "NO — hace falta otra arquitectura, mira los campos *_error";

  return new Response(JSON.stringify(r, null, 2), {
    headers: { "content-type": "application/json" },
  });
});
