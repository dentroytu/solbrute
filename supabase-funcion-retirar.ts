// ══════════════════════════════════════════════════════════════════════════
// SolBrute · Edge Function `retirar` — el envío on-chain
// ══════════════════════════════════════════════════════════════════════════
//
//   ⚠️  Esta es la única pieza del proyecto que mueve valor fuera de la base
//       de datos. Todo lo demás protege un número; aquí ese número sale.
//
// ── Por qué va en una función APARTE y no dentro de `auth` ────────────────
//
//   · Las librerías de Solana pesan. Metidas en `auth`, cada login y cada
//     pelea pagarían su arranque en frío (~2 s medidos) por un código que
//     solo usa la retirada.
//   · La clave del tesoro compartiría contexto con todo el resto del juego.
//     Cuanto menos código conviva con esa clave, mejor.
//
// La contabilidad NO está aquí: vive en `supabase-18-retirada-cuentas.sql` y
// ya está probada (35 comprobaciones con el modo simulacro). Esta función solo
// añade los pasos 2, 4 y 5 del orden.
//
// ── El orden, que es lo único que impide cobrar dos veces ─────────────────
//
//   1. retirada_abrir     reserva el saldo y crea la fila    (SQL, atómico)
//   2. construir y FIRMAR la transacción                     → ya hay firma
//   3. retirada_firmar    la GUARDA                           ANTES de mandar
//   4. mandarla a la red                                     ← punto de no retorno
//   5. retirada_cerrar    marca enviada
//
// En Solana la firma se puede calcular antes de mandar la transacción. Por eso
// se apunta en el paso 3: si algo se rompe después, la firma está guardada y
// se puede ir a la cadena a comprobar si llegó. No hay que adivinar.
//
// ── La línea que separa «seguro devolver» de «no tocar» ───────────────────
//
// Antes del paso 4 NO se ha emitido nada a la red: es demostrablemente seguro
// devolver el saldo. A partir del paso 4 no lo es — «falló el envío» y «llegó
// pero no vi la confirmación» se parecen demasiado desde aquí, y devolver a
// ciegas es exactamente cómo alguien cobra dos veces.
//
// Esa línea es la variable `emitido`. Es lo más importante de este fichero.
//
// ── Los mensajes al jugador van en ASCII, a propósito ─────────────────────
//
// El editor de Supabase mangla el UTF-8 al pegar: se comprobó mirando los
// bytes que devuelve la función desplegada, y donde debía haber `c3 b3` (ó)
// había `e2 88 9a e2 89 a5` (√≥). El jugador veía «sesi√≥n no v√°lida».
//
// Los COMENTARIOS sí llevan acentos: su mojibake dentro del editor es fea pero
// no la ve nadie, y este fichero del repositorio es la fuente de verdad. Lo que
// no puede llevar acentos es lo que sale por pantalla — ni los NOMBRES, porque
// un identificador mal codificado tumba el despliegue entero (pasó con
// `dueñoDe`: `UnexpectedChar { c: '√' }`).
//
// ── Secretos que necesita ─────────────────────────────────────────────────
//   SOLANA_TESORO   clave de la wallet OPERATIVA, como array JSON de 64 bytes
//   SOLANA_MINT     dirección del mint de $BRUTE
//   SOLANA_RPC      opcional; por defecto el RPC público de devnet
//
// La operativa lleva ~90 días de emisión, no el 40% entero. Si comprometen
// este servidor se pierden tres meses de recompensas, no cuatro años.
// ══════════════════════════════════════════════════════════════════════════

import {
  Connection, Keypair, PublicKey, Transaction,
} from "npm:@solana/web3.js@1.98.4";
import {
  createTransferInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddress,
} from "npm:@solana/spl-token@0.4.15";

const URL_SB  = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RPC     = Deno.env.get("SOLANA_RPC") || "https://api.devnet.solana.com";

/* Los $BRUTE tienen 9 decimales, igual que el mint creado en devnet. Si algún
   día se crea el de mainnet con otros, esto hay que cambiarlo aquí — mandar
   con los decimales equivocados es enviar mil veces de más o de menos. */
const DECIMALES = 9n;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const responder = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status, headers: { ...CORS, "Content-Type": "application/json" },
  });

async function db(ruta: string, opciones: RequestInit = {}) {
  const r = await fetch(URL_SB + "/rest/v1" + ruta, {
    ...opciones,
    headers: {
      apikey: SERVICE, Authorization: "Bearer " + SERVICE,
      "Content-Type": "application/json", ...(opciones.headers || {}),
    },
  });
  if (!r.ok) throw new Error("db " + r.status + ": " + (await r.text()));
  const texto = await r.text();
  return texto ? JSON.parse(texto) : null;
}

/* La misma comprobación de sesión que `auth`: token opaco contra la tabla
   `sessions`. Se repite aquí en vez de compartirse porque estas quince líneas
   son el precio de que esta función no dependa de la otra — y una función que
   mueve dinero conviene que dependa de lo menos posible.

   El nombre va sin eñe a propósito: ver la cabecera. */
async function duenoDe(token: unknown): Promise<string | null> {
  if (typeof token !== "string" || token.length < 20 || token.length > 200) return null;
  const filas = await db("/sessions?token=eq." + encodeURIComponent(token) +
                         "&select=address,expires_at");
  const s = filas && filas[0];
  if (!s) return null;
  if (Date.parse(s.expires_at) < Date.now()) return null;
  return s.address as string;
}

/* Una dirección de Solana son 32 bytes en base58: 43-44 caracteres. */
function pubkey(v: unknown): PublicKey | null {
  if (typeof v !== "string" || v.length < 32 || v.length > 44) return null;
  try { return new PublicKey(v); } catch { return null; }
}

/* base58 a mano, sin dependencias, igual que en `wallet-solana.js`.

   OJO: el acumulador arranca VACÍO. Con un cero dentro, toda entrada que
   empiece por byte 0 sale con un «1» de más — y como una firma de cada 256
   empieza por cero, serían firmas mal escritas un 0,4 % de las veces, sin
   patrón aparente. Aquí eso sería una retirada imposible de rastrear. */
function bs58(buf: Uint8Array): string {
  const ALFA = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const d: number[] = [];
  for (const b of buf) {
    let c = b;
    for (let i = 0; i < d.length; i++) { c += d[i] << 8; d[i] = c % 58; c = (c / 58) | 0; }
    while (c) { d.push(c % 58); c = (c / 58) | 0; }
  }
  let out = "";
  for (const b of buf) { if (b === 0) out += "1"; else break; }
  return out + d.reverse().map((x) => ALFA[x]).join("");
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const cuerpo = await req.json().catch(() => ({}));
    const dueno = await duenoDe(cuerpo.token);
    if (!dueno) return responder({ error: "sesion no valida o caducada" }, 401);

    const monedas = Math.floor(Number(cuerpo.monedas));
    if (!Number.isFinite(monedas) || monedas <= 0 || monedas > 1e12) {
      return responder({ error: "cantidad no valida", clase: "cantidad" }, 400);
    }

    /* ── 0 · ¿está configurado el envío? ──
       Se comprueba ANTES de reservar nada. Si falta un secreto esta función no
       puede cumplir lo que promete, y descontar el saldo para dejar una fila
       pendiente que nadie va a resolver es peor que decir que no. */
    const secreto = Deno.env.get("SOLANA_TESORO");
    const mintTxt = Deno.env.get("SOLANA_MINT");
    if (!secreto || !mintTxt) {
      return responder({ error: "el envio no esta configurado", clase: "sin_enviador" }, 503);
    }
    let tesoro: Keypair, mint: PublicKey;
    try {
      tesoro = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secreto)));
      mint = new PublicKey(mintTxt);
    } catch {
      /* Nunca se dice QUÉ secreto está mal en la respuesta: eso le contaría a
         un atacante cómo está montado esto por dentro. Al log sí. */
      console.error("SOLANA_TESORO o SOLANA_MINT mal formados");
      return responder({ error: "el envio no esta configurado", clase: "sin_enviador" }, 503);
    }

    /* El destino es la wallet del JUGADOR y sale de la SESIÓN, nunca del cuerpo
       de la petición. Aceptarlo del navegador sería dejar que cualquiera se
       mande a sí mismo el saldo de otro. */
    const destino = pubkey(dueno);
    if (!destino) return responder({ error: "direccion de destino no valida" }, 400);

    /* ── 1 · reservar el saldo y crear la fila ──
       Todo dentro de una función de Postgres con `for update`: cobrar y apuntar
       tienen que cuadrar o no pasar. */
    let ap;
    try {
      ap = await db("/rpc/retirada_abrir", {
        method: "POST",
        body: JSON.stringify({ p_owner: dueno, p_monedas: monedas }),
      });
    } catch (e) {
      const m = (e as Error).message;
      /* Los mensajes de la función SQL llevan el dato dentro (`minimo:100`)
         para que la pantalla pueda decir cuánto falta sin consultarlo aparte. */
      if (m.includes("retiradas_cerradas"))
        return responder({ error: "las retiradas estan cerradas", clase: "cerradas" }, 403);
      if (m.includes("sin_saldo"))
        return responder({ error: "no te llegan las monedas", clase: "sin_saldo" }, 403);
      if (m.includes("minimo:"))
        return responder({ error: "por debajo del minimo", clase: "minimo",
                           minimo: Number((m.match(/minimo:(\d+)/) || [])[1] || 0) }, 403);
      if (m.includes("tope_jugador:"))
        return responder({ error: "has llegado a tu tope de hoy", clase: "tope_jugador",
                           tope: Number((m.match(/tope_jugador:(\d+)/) || [])[1] || 0) }, 403);
      if (m.includes("tope_global"))
        return responder({ error: "el tope global de hoy esta lleno; prueba manana",
                           clase: "tope_global" }, 429);
      if (m.includes("cantidad_invalida"))
        return responder({ error: "cantidad no valida", clase: "cantidad" }, 400);
      if (m.includes("jugador desconocido"))
        return responder({ error: "sesion no valida" }, 401);
      throw e;
    }

    const id = Number(ap.id);

    /* LA LÍNEA. Mientras sea false no ha salido nada a la red y devolver el
       saldo es demostrablemente seguro. En cuanto se pone a true, no lo es. */
    let emitido = false;

    try {
      const con = new Connection(RPC, "confirmed");
      const origen  = await getAssociatedTokenAddress(mint, tesoro.publicKey);
      const llegada = await getAssociatedTokenAddress(mint, destino);

      /* ── 2 · construir y firmar ──
         La cuenta de token del jugador puede no existir todavía: se crea en la
         misma transacción. `Idempotent` es lo que evita que falle si ya existe
         — sin eso, la SEGUNDA retirada de alguien reventaría siempre.

         La renta de esa cuenta la paga el TESORO, y es parte de por qué existe
         un mínimo de retirada. */
      const tx = new Transaction();
      tx.add(createAssociatedTokenAccountIdempotentInstruction(
        tesoro.publicKey, llegada, destino, mint));
      tx.add(createTransferInstruction(
        origen, llegada, tesoro.publicKey,
        BigInt(ap.tokens) * 10n ** DECIMALES));

      const bh = await con.getLatestBlockhash("confirmed");
      tx.recentBlockhash = bh.blockhash;
      tx.feePayer = tesoro.publicKey;
      tx.sign(tesoro);

      const firmaBytes = tx.signatures[0]?.signature;
      if (!firmaBytes) throw new Error("la transaccion no quedo firmada");
      const firma = bs58(firmaBytes);

      /* ── 3 · apuntar la firma ANTES de mandar ──
         Si esto falla todavía no se ha emitido nada: se cae al catch con
         `emitido = false` y el saldo se devuelve. */
      await db("/rpc/retirada_firmar", {
        method: "POST", body: JSON.stringify({ p_id: id, p_firma: firma }),
      });

      /* ── 4 · mandar ── PUNTO DE NO RETORNO ── */
      emitido = true;
      await con.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 3 });

      /* ── 5 · confirmar ──
         Si esto caduca, la transacción PUEDE haber llegado igual. Por eso no se
         devuelve nada: queda `fallida` con su firma y se mira en la cadena. */
      const conf = await con.confirmTransaction({
        signature: firma,
        blockhash: bh.blockhash,
        lastValidBlockHeight: bh.lastValidBlockHeight,
      }, "confirmed");
      if (conf.value.err) {
        throw new Error("la cadena rechazo la transaccion: " + JSON.stringify(conf.value.err));
      }

      await db("/rpc/retirada_cerrar", {
        method: "POST", body: JSON.stringify({ p_id: id, p_ok: true }),
      });

      const cluster = RPC.includes("devnet") ? "?cluster=devnet" : "";
      return responder({
        ...ap, estado: "enviada", firma,
        explorador: "https://explorer.solana.com/tx/" + firma + cluster,
      });

    } catch (e) {
      const msg = (e as Error).message || "error desconocido";
      await db("/rpc/retirada_cerrar", {
        method: "POST",
        body: JSON.stringify({ p_id: id, p_ok: false, p_error: msg }),
      }).catch(() => {});

      if (!emitido) {
        /* Nada salió a la red. Devolver es seguro y demostrable, así que se
           hace solo: dejar al jugador sin saldo por un fallo nuestro anterior
           a emitir nada sería quedarnos su dinero por un error de red. */
        await db("/rpc/retirada_devolver", {
          method: "POST",
          body: JSON.stringify({
            p_admin: "sistema", p_id: id,
            p_motivo: "fallo antes de emitir: " + msg.slice(0, 200),
          }),
        }).catch((x) => console.error("no pude devolver la retirada " + id + ": " + x.message));
        console.error("retirada " + id + " fallida ANTES de emitir: " + msg);
        return responder({ error: "no se pudo enviar; tu saldo esta intacto",
                           clase: "fallo_previo" }, 502);
      }

      /* Ya se emitió. NO se devuelve nada: puede haber llegado. */
      console.error("retirada " + id + " fallida DESPUES de emitir - revisar la cadena: " + msg);
      return responder({ error: "el envio quedo en revision; no se ha perdido nada",
                         clase: "en_revision", id }, 502);
    }

  } catch (e) {
    console.error(e);
    return responder({ error: "error del servidor" }, 500);
  }
});
