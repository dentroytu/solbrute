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
  Connection, Keypair, PublicKey, SystemProgram, Transaction,
} from "npm:@solana/web3.js@1.98.4";
import {
  createTransferInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddress,
  getMint,
} from "npm:@solana/spl-token@0.4.15";

const URL_SB  = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RPC     = Deno.env.get("SOLANA_RPC") || "https://api.devnet.solana.com";

/* ══════════════════════════════════════════════════════════════════════════
   LOS DECIMALES SE LE PREGUNTAN AL MINT, NO SE SUPONEN
   ══════════════════════════════════════════════════════════════════════════
   Aqui habia un `const DECIMALES = 9n` con un comentario que decia «si algun
   dia se crea el de mainnet con otros, esto hay que cambiarlo aqui».

   Y un comentario no es una comprobacion. Es la misma leccion que dejo el
   agujero de las skins, con la diferencia de que este cuesta MUCHO mas caro:
   el mint de mainnet no existe todavia, y si sale con 6 decimales —que es lo
   que usa USDC y de lo mas comun— cada retirada manda MIL VECES lo que toca.
   El tesoro se vacia con las primeras retiradas y en la cadena no hay vuelta
   atras.

   No hace falta acordarse: el propio mint lleva sus decimales dentro y se
   leen con una llamada. Se cachea porque de un mint no cambian nunca —el
   campo es inmutable— asi que preguntarlo una vez por arranque en frio sobra.

   Si algun dia no coinciden con lo esperado, NO se envia: se responde 503 y se
   deja dicho en el log cual es cual. Parar es recuperable; mandar mil veces de
   mas, no. */
const DECIMALES_ESPERADOS = 9;

let decCache: { mint: string; dec: bigint } | null = null;
async function decimalesDe(con: Connection, mint: PublicKey): Promise<bigint> {
  const k = mint.toBase58();
  if (decCache && decCache.mint === k) return decCache.dec;
  const info = await getMint(con, mint);
  if (info.decimals !== DECIMALES_ESPERADOS) {
    console.error("MINT CON DECIMALES INESPERADOS: " + k + " tiene " + info.decimals +
                  " y se esperaban " + DECIMALES_ESPERADOS + ". NO se envia nada.");
    throw new Error("decimales_inesperados:" + info.decimals);
  }
  decCache = { mint: k, dec: BigInt(info.decimals) };
  return decCache.dec;
}

/* La misma lista que usa `auth`, leida del mismo secreto. Se repite aqui en vez
   de preguntarle a la otra funcion porque una funcion que mueve dinero conviene
   que dependa de lo menos posible. */
const ADMINS = (Deno.env.get("ADMIN_WALLETS") || "")
  .split(",").map((x) => x.trim()).filter(Boolean);

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


/* ══════════════════════════════════════════════════════════════════════════
   LA PREVENTA
   ══════════════════════════════════════════════════════════════════════════
   Vive aqui y no en `auth` porque necesita hablar con la cadena: comprobar un
   pago y entregar tokens. Meter las librerias de Solana en `auth` haria que
   cada login y cada pelea pagaran su arranque en frio (~2 s medidos).

   ── No hay sesion, hay FIRMA ──────────────────────────────────────────────
   La preventa esta en la landing, donde nadie ha iniciado sesion. Y hace falta
   probar que quien reserva es dueño de esa direccion: sin eso, cualquiera
   bloquea el cupo entero reservando con direcciones ajenas cada tres minutos.

   Asi que se firma un mensaje corto. No abre sesion ni guarda nada: solo
   demuestra la propiedad de la wallet, que es lo unico que hace falta. */
const desde58 = (t: string): Uint8Array => {
  const A = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let n = 0n;
  for (const c of t) { const i = A.indexOf(c); if (i < 0) throw new Error("base58"); n = n * 58n + BigInt(i); }
  const b: number[] = [];
  while (n > 0n) { b.unshift(Number(n & 255n)); n >>= 8n; }
  for (const c of t) { if (c === "1") b.unshift(0); else break; }
  return Uint8Array.from(b);
};

const destinoPub = (t: string) => new PublicKey(t);

/* base64 a mano y sin trocear: una transaccion de pago son ~200 bytes, asi
   que `String.fromCharCode(...)` no llega a desbordar la pila. */
const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));

/* La misma lista que `auth`. Va repetida a proposito: son dos funciones
   desplegadas por separado y una constante compartida por URL es justo lo que
   el empaquetador de Supabase no deja hacer. Si se añade un dominio, va en las
   DOS — como ya avisa la nota del dominio propio en CLAUDE.md. */
const DOMINIOS_OK = [
  "solbrute.io",
  "www.solbrute.io",
  "dentroytu.github.io",
  "localhost:8777",
  "127.0.0.1:8777",
];

async function firmaValida(address: string, mensaje: string, firma: string): Promise<boolean> {
  try {
    /* El mensaje tiene que llevar la propia direccion y una fecha reciente.
       Sin la direccion, una firma dada en otro sitio valdria aqui; sin la
       fecha, una capturada valdria para siempre. */
    if (!mensaje.includes(address)) return false;

    /* ── Y tiene que nombrar ESTE sitio y ESTA operacion ──────────────────
       Faltaba, y era el mismo agujero contra el que ya se defiende el login:
       «sin el dominio, una web fraudulenta podria reutilizar tu firma aqui».

       Comprobar solo «lleva tu direccion y una fecha ISO» acepta un formato
       comunisimo: media cripto pide firmar exactamente eso. Con una firma que
       el comprador hubiera dado en CUALQUIER otra web se podia llamar a
       `pv_reservar` en su nombre y bloquear cupo con direcciones ajenas — que
       es literalmente lo unico que esta firma existe para impedir.

       No hay robo posible por aqui: los tokens de `pv_reclamar` van siempre a
       la direccion del firmante. Lo que se evita es el bloqueo del cupo.

       La landing ya mandaba las dos cosas dentro del mensaje (`location.host`
       y «SolBrute presale»); lo que faltaba era que el servidor las exigiera.
       Mandarlas y no comprobarlas es decoracion. */
    const primera = mensaje.split("\n")[0] || "";
    if (!DOMINIOS_OK.some((d) => primera.startsWith(d + " "))) return false;
    if (!mensaje.includes("SolBrute presale")) return false;

    const m = /(\d{4}-\d{2}-\d{2}T[\d:.]+Z)/.exec(mensaje);
    if (!m) return false;
    const edad = Date.now() - Date.parse(m[1]);
    if (!(edad > -60_000 && edad < 5 * 60_000)) return false;

    const clave = await crypto.subtle.importKey(
      "raw", desde58(address), { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify(
      { name: "Ed25519" }, clave, desde58(firma), new TextEncoder().encode(mensaje));
  } catch { return false; }
}

/* Comprueba EN LA CADENA que ese pago existe y es el que dice ser.
   Creerse al navegador aqui seria regalar tokens: bastaria con decir «ya he
   pagado, esta es una firma cualquiera». */
async function pagoValido(
  con: Connection, firma: string, de: string, a: string, lamports: number,
): Promise<{ ok: boolean; por: string }> {
  let tx;
  try {
    tx = await con.getTransaction(firma, {
      commitment: "confirmed", maxSupportedTransactionVersion: 0,
    });
  } catch { return { ok: false, por: "rpc" }; }
  if (!tx)          return { ok: false, por: "no_encontrada" };
  if (tx.meta?.err) return { ok: false, por: "fallo_en_cadena" };

  /* Se mide por el SALDO, no por las instrucciones. Un pago puede llegar de
     muchas formas —transferencia suelta, dentro de otra cosa, con varias
     instrucciones— y todas dejan el mismo rastro: la cuenta destino sube. */
  const claves = tx.transaction.message.getAccountKeys?.({
    accountKeysFromLookups: tx.meta?.loadedAddresses,
  });
  const lista: string[] = [];
  const n = claves?.length ?? 0;
  for (let i = 0; i < n; i++) lista.push(claves!.get(i)!.toBase58());

  const iDe = lista.indexOf(de), iA = lista.indexOf(a);
  if (iDe < 0 || iA < 0) return { ok: false, por: "otras_cuentas" };

  const subio = (tx.meta!.postBalances[iA] ?? 0) - (tx.meta!.preBalances[iA] ?? 0);
  if (subio < lamports) return { ok: false, por: "cantidad" };

  /* Y que el firmante sea quien dice. Sin esto, alguien podria reclamar el
     pago de OTRO: la transaccion es real, pero no la hizo el. */
  if (iDe !== 0) return { ok: false, por: "no_lo_firmo" };
  return { ok: true, por: "" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const cuerpo = await req.json().catch(() => ({}));

    /* ══════════ LA PREVENTA ══════════
       Va ANTES de la retirada porque no usa sesion: se identifica firmando.
       Y `pv_estado` no pide ni eso — es lo que la landing enseña sin que nadie
       haya conectado nada. */
    const acc = String(cuerpo.accion || "");
    if (acc.startsWith("pv_")) {
      const conP = new Connection(RPC, "confirmed");

      if (acc === "pv_estado") {
        const e = await db("/rpc/preventa_estado", { method: "POST", body: "{}" });
        return responder(e || {});
      }

      /* ── ¿hay con que pagar los reclamos? ──
         Abrir los reclamos con la wallet de entrega vacia no da un error
         bonito: cada reclamo falla, se queda en «revision», y hay que
         desatascarlos a mano uno por uno mientras la gente pregunta donde
         estan sus tokens.

         Asi que se puede mirar ANTES. Es admin porque enseña el saldo del
         tesoro, que no es asunto de nadie mas. */
      if (acc === "pv_fondos") {
        /* Se identifica con la SESION del panel, no firmando: quien llama aqui
           es el administrador desde `admin.html`, que ya tiene una abierta.
           Pedirle ademas la firma seria sacarle la ventanita de la wallet para
           mirar un saldo. */
        const quien = await duenoDe(cuerpo.token);
        if (!quien || !ADMINS.includes(quien)) {
          return responder({ error: "sesion no valida o caducada" }, 401);
        }

        const secreto = Deno.env.get("SOLANA_PREVENTA") || Deno.env.get("SOLANA_TESORO");
        const mintTxt = Deno.env.get("SOLANA_MINT");
        if (!secreto) return responder({ listo: false, motivo: "falta el secreto SOLANA_PREVENTA" });
        if (!mintTxt) return responder({ listo: false, motivo: "falta el secreto SOLANA_MINT" });

        let cofre: Keypair, mint: PublicKey;
        try {
          cofre = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secreto)));
          mint  = new PublicKey(mintTxt);
        } catch {
          return responder({ listo: false, motivo: "SOLANA_PREVENTA o SOLANA_MINT mal formados" });
        }

        const pv = (await db("/preventa?id=eq.1&select=vendido,mint"))?.[0] || {};
        const entregadas = (await db(
          "/preventa_compras?estado=eq.entregada&select=tokens")) || [];
        const yaEntregado = entregadas.reduce((a: number, c: { tokens: number }) => a + Number(c.tokens), 0);
        const debido = Math.max(0, Number(pv.vendido || 0) - yaEntregado);

        /* Cuantos compradores NO tienen todavia cuenta de ese token. Cada uno
           cuesta ~0,002 SOL de renta, y lo paga el tesoro. Es el gasto que en
           devnet fallo diciendo otra cosa. */
        const pendientes = (await db(
          "/preventa_compras?estado=eq.pagada&select=address")) || [];
        const quedan = new Set(pendientes.map((c: { address: string }) => c.address));

        let sol = 0, tokens = 0;
        try {
          sol = await conP.getBalance(cofre.publicKey) / 1e9;
          const cuenta = await getAssociatedTokenAddress(mint, cofre.publicKey);
          const b = await conP.getTokenAccountBalance(cuenta).catch(() => null);
          tokens = Number(b?.value?.uiAmount || 0);
        } catch (e) {
          return responder({ listo: false, motivo: "el RPC no responde: " + (e as Error).message });
        }

        const solHace = quedan.size * 0.00204 + quedan.size * 0.00001;
        const faltan: string[] = [];
        if (String(pv.mint || "") !== mintTxt) {
          faltan.push("el mint del panel no es el del secreto SOLANA_MINT");
        }
        if (tokens < debido) faltan.push(`faltan ${(debido - tokens).toLocaleString("es-ES")} $BRUTE`);
        if (sol < solHace)   faltan.push(`faltan ${(solHace - sol).toFixed(4)} SOL para comisiones y cuentas`);

        return responder({
          listo: faltan.length === 0,
          wallet: cofre.publicKey.toBase58(),
          tokens, debido, sol, sol_necesario: Number(solHace.toFixed(4)),
          compradores: quedan.size,
          faltan,
        });
      }


      const dir = String(cuerpo.address || "");
      if (!pubkey(dir)) return responder({ error: "direccion no valida" }, 400);

      /* ── mirar lo tuyo, SIN firma ──
         Es la unica que no la pide, y no es un descuido. Lo que devuelve —
         cuantos tokens compro una direccion y cuanto SOL pago— ya esta en la
         cadena: el pago es una transferencia publica a la wallet de la
         preventa, y cualquiera puede leerla. Pedir firma aqui no escondaria
         nada; solo obligaria a sacar la ventanita de la wallet nada mas
         entrar en la pagina, a alguien que solo queria mirar. */
      if (acc === "pv_mias") {
        const r = await db("/rpc/preventa_mias", {
          method: "POST", body: JSON.stringify({ p_address: dir }),
        });
        return responder(r || {});
      }

      /* De aqui en adelante SI hay que demostrar que la wallet es tuya:
         reservar bloquea cupo y reclamar mueve tokens. */
      if (!await firmaValida(dir, String(cuerpo.mensaje || ""), String(cuerpo.firma || ""))) {
        return responder({ error: "firma no valida", clase: "firma" }, 401);
      }

      const fallo = (e: Error) => {
        const m = e.message;
        const con = (k: string) => m.includes(k);
        if (con("cerrada"))           return responder({ error: "la preventa esta cerrada", clase: "cerrada" }, 403);
        if (con("no_empezada"))       return responder({ error: "todavia no ha empezado", clase: "pronto" }, 403);
        if (con("terminada"))         return responder({ error: "ya ha terminado", clase: "tarde" }, 403);
        if (con("sin_cupo"))          return responder({ error: "no queda tanto", clase: "cupo",
                                                        queda: Number((/sin_cupo:(\d+)/.exec(m) || [])[1] || 0) }, 409);
        if (con("tope_wallet"))       return responder({ error: "pasa tu tope", clase: "tope",
                                                        tope: Number((/tope_wallet:(\d+)/.exec(m) || [])[1] || 0) }, 403);
        if (con("minimo"))            return responder({ error: "por debajo del minimo", clase: "minimo",
                                                        minimo: Number((/minimo:(\d+)/.exec(m) || [])[1] || 0) }, 400);
        if (con("reclamos_cerrados")) return responder({ error: "los reclamos no estan abiertos", clase: "cerrado" }, 403);
        if (con("nada_que_reclamar")) return responder({ error: "no tienes nada que reclamar", clase: "nada" }, 404);
        if (con("reclamo_en_curso"))  return responder({ error: "ya tienes uno en curso", clase: "en_curso" }, 409);
        throw e;
      };

      /* ── reservar ──
         Antes de que el comprador firme nada. Si el cupo se acaba entre medias,
         mejor decirlo ahora que despues de que haya pagado la comision de red. */
      if (acc === "pv_reservar") {
        /* `isFinite` NO basta, y lo encontro el banco de ataque: 1e21 es finito
           y positivo, pasaba la validacion, y `JSON.stringify` lo escribia como
           `1e+21`. Postgres no puede meter eso en un bigint, asi que la llamada
           reventaba y salia un 500 generico — un error mudo por un numero que
           el navegador puede mandar cuando quiera.

           `isSafeInteger` corta ahi, y el tope de mil millones lo corta mucho
           antes: no hay preventa que venda mas que eso. */
        const tk = Math.floor(Number(cuerpo.tokens));
        if (!Number.isSafeInteger(tk) || tk <= 0 || tk > 1_000_000_000) {
          return responder({ error: "cantidad no valida" }, 400);
        }
        let r;
        try {
          r = await db("/rpc/preventa_reservar", {
            method: "POST", body: JSON.stringify({ p_address: dir, p_tokens: tk }),
          });
        } catch (e) { return fallo(e as Error); }

        /* La transaccion la construye el SERVIDOR, no el navegador.
           Si el destino y el importe viniera de ahi, bastaria con editar el
           JavaScript para pagarse a si mismo y pedir los tokens igual. Aqui
           van cocidos dentro de lo que la wallet le enseña al comprador.

           Se manda sin firmar: la unica firma que lleva es la suya. */
        try {
          const bh = await conP.getLatestBlockhash("confirmed");
          const tx = new Transaction({ feePayer: destinoPub(dir), ...bh });
          tx.add(SystemProgram.transfer({
            fromPubkey: destinoPub(dir),
            toPubkey:   destinoPub(String(r.wallet || "")),
            lamports:   Number(r.lamports),
          }));
          const cruda = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
          return responder({ ...r, tx: b64(cruda), caduca_bloque: bh.lastValidBlockHeight });
        } catch (e) {
          /* La reserva ya existe y caduca sola en 15 minutos. Se dice que no
             se pudo construir, no que no se pudo reservar: son cosas distintas
             y el comprador tiene que saber que puede reintentar. */
          console.error("preventa: no se pudo construir el pago", e);
          return responder({ error: "no pude preparar el pago", clase: "rpc" }, 503);
        }
      }

      /* ── he pagado ──
         Se comprueba EN LA CADENA. Creerse al navegador aqui seria regalar
         tokens: bastaria con decir «ya he pagado» y una firma cualquiera. */
      if (acc === "pv_pagado") {
        const id = Math.floor(Number(cuerpo.id));
        const firma = String(cuerpo.firma_pago || "");
        /* Mismo motivo que arriba: un id fuera del rango de un bigint no es un
           404, es un 500. Y las firmas de Solana miden 87-88 caracteres. */
        if (!Number.isSafeInteger(id) || id <= 0 || firma.length < 32 || firma.length > 128) {
          return responder({ error: "faltan datos" }, 400);
        }

        const fila = (await db("/preventa?id=eq.1&select=wallet"))?.[0];
        const compra = (await db("/preventa_compras?id=eq." + id + "&select=*"))?.[0];
        if (!compra || compra.address !== dir) return responder({ error: "esa compra no es tuya" }, 403);
        if (compra.estado === "pagada" || compra.estado === "entregada") {
          return responder({ ya: true, tokens: compra.tokens });
        }
        /* ── Una CADUCADA tambien pasa, y esto es dinero de alguien ───────
           `preventa_confirmar` acepta `caducada` a proposito y lleva un
           comentario de ocho lineas explicando por que: el comprador firma
           dentro de la ventana y la red asienta la transaccion despues.
           Firmar en el minuto 14:50 y que se confirme en el 15:05 es normal.

           Y aqui se devolvia 410 ANTES de llamarla, asi que esa defensa no
           llegaba a ejecutarse nunca. El estado pasa a `caducada` de forma
           perezosa —lo hace la reserva de OTRA persona, en `preventa_reservar`—
           o sea que ni siquiera dependia de Alicia:

               12:14     Alicia firma y paga, su SOL sale de su wallet
               12:15:02  Bruno reserva → esa llamada caduca la fila de Alicia
               12:15:10  Alicia dice "he pagado"  →  410

           Su SOL en nuestra wallet y ninguna compra apuntada. Es exactamente
           el caso que el SQL describe y que arriba se estaba impidiendo.

           No abre nada: quien llega hasta aqui ya paso `pagoValido`, que lo
           comprueba EN LA CADENA. Si no pago, no llega.

           `cancelada` si se rechaza: esa se anulo a mano, no por el reloj. */
        if (compra.estado !== "reservada" && compra.estado !== "caducada") {
          return responder({ error: "esa reserva ya no vale", clase: "caducada" }, 410);
        }

        const v = await pagoValido(conP, firma, dir, String(fila?.wallet || ""), Number(compra.lamports));
        if (!v.ok) {
          /* Se dice el motivo: «no la encuentro» y «pagaste de menos» piden
             cosas distintas del comprador. Un «no» mudo le deja sin saber si
             esperar o volver a intentarlo. */
          return responder({ error: "no pude comprobar el pago", clase: v.por }, 402);
        }
        const r = await db("/rpc/preventa_confirmar", {
          method: "POST", body: JSON.stringify({ p_id: id, p_firma: firma }),
        });
        return responder(r);
      }

      /* ── reclamar ──
         Mismo orden que la retirada: abrir, firmar, enviar, cerrar. */
      if (acc === "pv_reclamar") {
        const secreto = Deno.env.get("SOLANA_PREVENTA") || Deno.env.get("SOLANA_TESORO");
        const mintTxt = Deno.env.get("SOLANA_MINT");
        if (!secreto || !mintTxt) {
          return responder({ error: "la entrega no esta configurada", clase: "sin_enviador" }, 503);
        }
        let cofre: Keypair, mint: PublicKey;
        try {
          cofre = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secreto)));
          mint  = new PublicKey(mintTxt);
        } catch {
          console.error("SOLANA_PREVENTA o SOLANA_MINT mal formados");
          return responder({ error: "la entrega no esta configurada", clase: "sin_enviador" }, 503);
        }

        let ab;
        try {
          ab = await db("/rpc/preventa_reclamar_abrir", {
            method: "POST", body: JSON.stringify({ p_address: dir }),
          });
        } catch (e) { return fallo(e as Error); }

        const rid = Number(ab.id), tokens = BigInt(ab.tokens);
        const destino = new PublicKey(dir);
        let firmaEnv = "";
        /* Se declara FUERA del try porque lo necesita el catch. Con un 0 aqui,
           `resolver` daria "muerta" siempre —cualquier altura de bloque es
           mayor que cero— y una entrega que SI llego se marcaria fallida y se
           volveria a mandar. Eso son tokens duplicados. */
        let ultimoBloque = 0;
        try {
          const origen  = await getAssociatedTokenAddress(mint, cofre.publicKey);
          const llegada = await getAssociatedTokenAddress(mint, destino);
          const bh = await conP.getLatestBlockhash("confirmed");
          ultimoBloque = bh.lastValidBlockHeight;
          const tx = new Transaction({ feePayer: cofre.publicKey, ...bh });
          tx.add(createAssociatedTokenAccountIdempotentInstruction(
            cofre.publicKey, llegada, destino, mint));
          tx.add(createTransferInstruction(
            origen, llegada, cofre.publicKey,
            tokens * (10n ** await decimalesDe(conP, mint))));
          tx.sign(cofre);
          firmaEnv = bs58(tx.signature!);

          /* La firma se GUARDA antes de enviar. Si algo se rompe despues, se va
             a mirar a la cadena en vez de adivinar. */
          await db("/rpc/preventa_reclamar_firmar", {
            method: "POST", body: JSON.stringify({ p_id: rid, p_firma: firmaEnv }),
          });

          await conP.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 3 });
          await conP.confirmTransaction(
            { signature: firmaEnv, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight },
            "confirmed");

          await db("/rpc/preventa_reclamar_cerrar", {
            method: "POST", body: JSON.stringify({ p_id: rid, p_estado: "enviado" }),
          });
          return responder({ ok: true, tokens: ab.tokens, firma: firmaEnv });
        } catch (e) {
          /* Se le PREGUNTA a la cadena. «Fallo el envio» y «llego y no vi la
             confirmacion» se parecen demasiado desde aqui. */
          const v = firmaEnv ? await resolver(conP, firmaEnv, ultimoBloque) : "muerta";
          const estado = v === "llego" ? "enviado" : v === "muerta" ? "fallido" : "revision";
          await db("/rpc/preventa_reclamar_cerrar", {
            method: "POST", body: JSON.stringify({ p_id: rid, p_estado: estado }),
          }).catch(() => {});
          if (estado === "enviado") return responder({ ok: true, tokens: ab.tokens, firma: firmaEnv });
          return responder({ error: "no pude entregar ahora", clase: estado, firma: firmaEnv || null }, 502);
        }
      }

      return responder({ error: "accion desconocida" }, 400);
    }

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
      /* Si los decimales no cuadran esto LANZA, y lanza ANTES de firmar y de
         mandar nada: se cae al catch con `emitido = false` y el saldo vuelve
         intacto. Es el orden que hace que parar sea gratis. */
      tx.add(createTransferInstruction(
        origen, llegada, tesoro.publicKey,
        BigInt(ap.tokens) * 10n ** await decimalesDe(con, mint)));

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
