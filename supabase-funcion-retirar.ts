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
// ── El RPC público NO vale para mainnet ───────────────────────────────────
//
// `api.devnet.solana.com` limita peticiones y lo hace pronto: probando esto
// contra devnet, dos retiradas seguidas ya devolvían 429 y la transacción no
// llegaba a salir. Con la reconciliación de arriba eso deja de costarle el
// saldo al jugador, pero sigue siendo una retirada fallida que hay que
// reintentar.
//
// Antes de mainnet hay que poner un RPC de pago (Helius, QuickNode, Triton) en
// `SOLANA_RPC`. Es barato y quita de golpe la causa más común de fallo.
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

/* ══════════════════════════════════════════════════════════════════════════
   Cuando algo falla después de mandar: PREGUNTARLE A LA CADENA
   ══════════════════════════════════════════════════════════════════════════
   La primera versión daba por perdida cualquier retirada que fallara después
   de emitir, y el jugador se quedaba sin saldo y sin tokens. Probándolo contra
   devnet salió que eso pasa a menudo por una tontería: el RPC público limita
   peticiones, `sendRawTransaction` lanza, y la transacción NUNCA llegó a la
   red. Castigar al jugador por eso es cobrarle un fallo nuestro.

   Y no hace falta adivinar, porque Solana lo deja demostrar:

     · Si la firma aparece en la cadena SIN error → llegó. Se cobra.
     · Si aparece CON error → la cadena la rechazó y no movió tokens (una
       transacción fallida no transfiere nada). Devolver es seguro.
     · Si NO aparece y el blockhash ya CADUCÓ → no puede llegar nunca. Muerta.
       Devolver es seguro y demostrable.
     · Si no aparece y el blockhash sigue vivo → todavía puede llegar. Solo
       aquí se deja en revisión, que es lo honesto.

   Ese último caso es raro y es el único que necesita una persona. */
type Veredicto = "llego" | "muerta" | "no_se_sabe";

async function resolver(
  con: Connection, firma: string, ultimoBloqueValido: number,
): Promise<Veredicto> {
  /* Ocho vueltas de 1,5 s ≈ 12 s. Un blockhash vive ~60-90 s, así que esto no
     siempre alcanza a verlo caducar — por eso existe "no_se_sabe" en vez de
     esperar hasta agotar el tiempo de la función. */
  for (let i = 0; i < 8; i++) {
    const st = await con.getSignatureStatus(firma, { searchTransactionHistory: true })
                        .catch(() => null);
    if (st?.value?.confirmationStatus) return st.value.err ? "muerta" : "llego";

    const altura = await con.getBlockHeight("confirmed").catch(() => null);
    if (altura !== null && altura > ultimoBloqueValido) return "muerta";

    await new Promise((r) => setTimeout(r, 1500));
  }
  return "no_se_sabe";
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

    /* La conexión se crea aquí arriba porque la necesitan tres sitios: la
       comprobación de SOL de abajo, el envío, y el `catch` cuando tiene que ir
       a preguntarle a la cadena si la transacción llegó.

       Estaba declarada justo antes del `try` y la comprobación de SOL la usaba
       cien líneas antes: en JavaScript eso no es un aviso, es un ReferenceError
       en cuanto alguien intenta retirar. */
    const con = new Connection(RPC, "confirmed");

    /* El destino es la wallet del JUGADOR y sale de la SESIÓN, nunca del cuerpo
       de la petición. Aceptarlo del navegador sería dejar que cualquiera se
       mande a sí mismo el saldo de otro. */
    const destino = pubkey(dueno);
    if (!destino) return responder({ error: "direccion de destino no valida" }, 400);

    /* ── 0 bis · ¿tiene el tesoro SOL para pagar el envío? ──
       Los $BRUTE no se mandan solos: cada transacción cuesta comisión de red y,
       si el jugador retira por primera vez, hay que CREARLE su cuenta de token
       — unos 0,00204 SOL de renta. Todo eso lo paga la wallet operativa, en SOL,
       no en $BRUTE.

       Esto salió probando en devnet y es de los hallazgos que justifican el
       ensayo entero: la operativa se quedó sin SOL después de la primera
       retirada y todas las siguientes empezaron a fallar. Lo grave no era
       quedarse sin SOL —eso se rellena— sino que fallaba con un error de red
       genérico. En mainnet habrían sido retiradas cayendo en cascada sin que
       nadie supiera por qué.

       Se comprueba ANTES de `retirada_abrir`, para no descontarle el saldo a
       nadie por un problema que es nuestro. */
    const MINIMO_SOL = 5_000_000;   // 0,005 SOL: renta de una cuenta + margen
    try {
      const solTesoro = await con.getBalance(tesoro.publicKey);
      if (solTesoro < MINIMO_SOL) {
        console.error("TESORO SIN SOL: " + (solTesoro / 1e9).toFixed(6) +
                      " SOL. Recarga la wallet operativa " + tesoro.publicKey.toBase58());
        return responder({ error: "las retiradas no estan disponibles ahora mismo",
                           clase: "tesoro_sin_gas" }, 503);
      }
    } catch (e) {
      /* Si ni siquiera se puede consultar el saldo, el RPC no responde y no
         tiene sentido seguir: mejor parar aquí que a mitad de una retirada. */
      console.error("no pude consultar el saldo del tesoro: " + (e as Error).message);
      return responder({ error: "no se puede contactar con la red ahora mismo",
                         clase: "sin_red" }, 503);
    }

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
       saldo es demostrablemente seguro. En cuanto se pone a true deja de serlo
       — pero deja de serlo POR SÍ SOLO: si algo falla después, se le pregunta a
       la cadena (ver `resolver`) en vez de rendirse. */
    let emitido = false;

    /* Fuera del try para que el catch pueda ir a comprobar la cadena. Sin la
       firma y sin el bloque límite no hay nada que preguntar, y la retirada se
       quedaría en revisión para siempre por un fallo de red de dos segundos. */
    let firma = "";
    let ultimoBloqueValido = 0;

    try {
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
      ultimoBloqueValido = bh.lastValidBlockHeight;
      tx.recentBlockhash = bh.blockhash;
      tx.feePayer = tesoro.publicKey;
      tx.sign(tesoro);

      const firmaBytes = tx.signatures[0]?.signature;
      if (!firmaBytes) throw new Error("la transaccion no quedo firmada");
      firma = bs58(firmaBytes);

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

      const devolver = async (motivo: string) =>
        await db("/rpc/retirada_devolver", {
          method: "POST",
          body: JSON.stringify({ p_admin: "sistema", p_id: id,
                                 p_motivo: motivo.slice(0, 250) }),
        }).catch((x) => console.error("no pude devolver la retirada " + id + ": " + x.message));

      const cerrar = async (ok: boolean, err?: string) =>
        await db("/rpc/retirada_cerrar", {
          method: "POST",
          body: JSON.stringify({ p_id: id, p_ok: ok, p_error: err || null }),
        }).catch(() => {});

      /* ── Caso 1: nada salió a la red ──
         Demostrable: no se llegó a llamar a `sendRawTransaction`. Devolver es
         seguro, y no hacerlo sería quedarnos el saldo del jugador por un fallo
         nuestro. */
      if (!emitido || !firma) {
        await cerrar(false, msg);
        await devolver("fallo antes de emitir: " + msg);
        console.error("retirada " + id + " fallida ANTES de emitir: " + msg);
        return responder({ error: "no se pudo enviar; tu saldo esta intacto",
                           clase: "fallo_previo" }, 502);
      }

      /* ── Caso 2: se emitió y algo falló ──
         Aquí NO se adivina: se le pregunta a la cadena. Es la diferencia entre
         dejar al jugador sin saldo y sin tokens por un límite de peticiones del
         RPC —que es lo que hacía la primera versión— y resolverlo de verdad. */
      const veredicto = await resolver(con, firma, ultimoBloqueValido);
      const cluster = RPC.includes("devnet") ? "?cluster=devnet" : "";

      if (veredicto === "llego") {
        /* Falló la confirmación, no el envío. Los tokens SÍ están en su wallet:
           lo que había que arreglar era nuestro registro, no su saldo. */
        await cerrar(true);
        console.warn("retirada " + id + " confirmada a la segunda: " + msg);
        return responder({ ...ap, estado: "enviada", firma,
                           explorador: "https://explorer.solana.com/tx/" + firma + cluster });
      }

      if (veredicto === "muerta") {
        /* O la cadena la rechazó —y una transaccion fallida no mueve tokens— o
           el blockhash caducó sin que apareciera, y entonces ya no puede llegar
           nunca. En los dos casos devolver es seguro y demostrable. */
        await cerrar(false, msg);
        await devolver("comprobado en la cadena: la transaccion no llego. " + msg);
        console.error("retirada " + id + " muerta, devuelta: " + msg);
        return responder({ error: "no se pudo enviar; tu saldo esta intacto",
                           clase: "fallo_previo" }, 502);
      }

      /* ── Caso 3: el único que necesita a una persona ──
         El blockhash sigue vivo y la firma aún no aparece: todavía puede
         llegar. Devolver aquí sería el doble cobro clásico. Queda `fallida` con
         su firma apuntada, que es exactamente para lo que se guardó antes de
         mandar nada. */
      await cerrar(false, "sin resolver: " + msg);
      console.error("retirada " + id + " SIN RESOLVER, revisar la firma " + firma + ": " + msg);
      return responder({ error: "el envio esta en revision; no se ha perdido nada",
                         clase: "en_revision", id, firma }, 502);
    }

  } catch (e) {
    console.error(e);
    return responder({ error: "error del servidor" }, 500);
  }
});
