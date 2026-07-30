/* ══════════════════════════════════════════════════════════════════════════
   SolBrute · conexión con wallets de Solana
   ══════════════════════════════════════════════════════════════════════════
   Antes de esto la puerta era decorativa: los dos botones hacían lo mismo,
   los textos de "detectada / no detectada" estaban escritos a mano y la
   dirección se la inventaba fakeAddr(). Aquí se conecta de verdad.

   ── Conectar no es iniciar sesión ─────────────────────────────────────────
   Conectar solo entrega la dirección pública, y eso lo puede escribir
   cualquiera desde la consola. La prueba de identidad es la FIRMA: el
   usuario firma un mensaje con su clave privada y el servidor comprueba la
   firma contra su clave pública.

   Este fichero produce la firma. Todavía NO la verifica nadie: eso es la
   segunda mitad del trabajo (Edge Functions + tabla de nonces, ver
   BACKEND.md). Hasta entonces la sesión sigue siendo falsificable.

   El formato del mensaje ya es el definitivo a propósito, para que añadir la
   verificación no obligue a rehacer esto.

   Sin librerías: los proveedores de wallet se inyectan en window y el base58
   son treinta líneas. Sigue funcionando con doble clic.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";

  /* ═══════════ base58 ═══════════ */
  /* Solana escribe direcciones y firmas en base58 (el alfabeto de Bitcoin, sin
     los caracteres que se confunden: 0, O, I, l). La firma llega como bytes y
     el servidor la espera en texto. */
  const ALFABETO = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

  function base58(bytes){
    if(!bytes || !bytes.length) return "";
    /* Ojo: tiene que empezar VACÍO, no con [0]. Con un cero dentro, cualquier
       entrada que empiece por byte 0 sale con un "1" de más — y como una firma
       de cada 256 empieza por cero, eso es un login que falla de vez en cuando
       sin patrón aparente. */
    const digitos = [];
    for(const byte of bytes){
      let acarreo = byte;
      for(let i = 0; i < digitos.length; i++){
        acarreo += digitos[i] << 8;
        digitos[i] = acarreo % 58;
        acarreo = (acarreo / 58) | 0;
      }
      while(acarreo > 0){ digitos.push(acarreo % 58); acarreo = (acarreo / 58) | 0; }
    }
    /* Cada cero por delante se escribe como un "1". */
    let salida = "";
    for(const byte of bytes){ if(byte === 0) salida += "1"; else break; }
    for(let i = digitos.length - 1; i >= 0; i--) salida += ALFABETO[digitos[i]];
    return salida;
  }

  /* ═══════════ detección ═══════════ */
  /* Phantom se anuncia en window.phantom.solana; las versiones viejas solo
     ponían window.solana. Solflare usa window.solflare.
     Se comprueba la marca (isPhantom / isSolflare) porque más de una extensión
     escribe en window.solana y quedarse con la primera que aparezca hace que
     conectes con una wallet distinta de la que pulsaste. */
  const CATALOGO = {
    phantom: {
      nombre: "Phantom",
      instalar: "https://phantom.app/download",
      buscar(){
        if(window.phantom && window.phantom.solana && window.phantom.solana.isPhantom) return window.phantom.solana;
        if(window.solana && window.solana.isPhantom) return window.solana;
        return null;
      }
    },
    solflare: {
      nombre: "Solflare",
      instalar: "https://solflare.com/download",
      buscar(){
        if(window.solflare && window.solflare.isSolflare) return window.solflare;
        return null;
      }
    }
  };

  /* Errores con causa identificable, para poder decirle al usuario qué pasó
     en vez de un "error" genérico. */
  function ErrorWallet(causa, mensaje){
    const e = new Error(mensaje || causa);
    e.causa = causa;   // "no-instalada" | "rechazado" | "sin-firma" | "fallo"
    return e;
  }

  /* Phantom usa 4001 para "el usuario dijo que no", como los monederos de
     Ethereum. Solflare a veces solo manda un texto. */
  const esRechazo = e =>
    !!e && (e.code === 4001 || /reject|denied|cancel|user rejected/i.test(e.message || ""));

  window.SolBruteWallet = {

    base58,

    /* Qué wallets hay en este navegador ahora mismo. */
    detectar(){
      const salida = {};
      for(const id of Object.keys(CATALOGO)){
        salida[id] = {
          nombre: CATALOGO[id].nombre,
          instalada: !!CATALOGO[id].buscar(),
          instalar: CATALOGO[id].instalar
        };
      }
      return salida;
    },

    hayAlguna(){
      return Object.keys(CATALOGO).some(id => !!CATALOGO[id].buscar());
    },

    urlInstalar(id){
      return (CATALOGO[id] || CATALOGO.phantom).instalar;
    },

    /* Pide la conexión. Devuelve la dirección en base58.
       Esto es lo que abre la ventanita de la extensión. */
    async conectar(id){
      const entrada = CATALOGO[id];
      if(!entrada) throw ErrorWallet("fallo", "wallet desconocida: " + id);

      const proveedor = entrada.buscar();
      if(!proveedor) throw ErrorWallet("no-instalada", entrada.nombre + " no está en este navegador");

      let res;
      try{
        res = await proveedor.connect();
      }catch(e){
        throw esRechazo(e) ? ErrorWallet("rechazado", "conexión cancelada") : ErrorWallet("fallo", e.message);
      }

      /* Phantom devuelve {publicKey}; Solflare a veces deja la clave en el
         proveedor y no devuelve nada. */
      const clave = (res && res.publicKey) || proveedor.publicKey;
      if(!clave) throw ErrorWallet("fallo", "la wallet no devolvió ninguna dirección");

      return { id, proveedor, direccion: clave.toString() };
    },

    /* Reconexión silenciosa: si el usuario ya autorizó este sitio antes, se
       entra sin ventanita. Si no lo autorizó, falla en silencio y devuelve
       null — nunca hay que molestar con un diálogo que el usuario no pidió. */
    async reconectar(id){
      const entrada = CATALOGO[id];
      const proveedor = entrada && entrada.buscar();
      if(!proveedor || !proveedor.connect) return null;
      try{
        const res = await proveedor.connect({ onlyIfTrusted: true });
        const clave = (res && res.publicKey) || proveedor.publicKey;
        return clave ? { id, proveedor, direccion: clave.toString() } : null;
      }catch(e){ return null; }
    },

    /* El mensaje que se firma. Formato Sign In With Solana.
       Que incluya el DOMINIO importa: sin él, una web fraudulenta podría
       reutilizar una firma tuya para entrar aquí. Y el NONCE lo hace de un
       solo uso: sin él, quien capture una firma la reutiliza para siempre. */
    mensajeInicio({ dominio, direccion, uri, nonce, fecha }){
      return [
        dominio + " wants you to sign in with your Solana account:",
        direccion,
        "",
        "Sign in to SolBrute. This is free and moves no funds.",
        "",
        "URI: " + uri,
        "Version: 1",
        "Chain ID: mainnet",
        "Nonce: " + nonce,
        "Issued At: " + fecha
      ].join("\n");
    },

    /* Pide la firma. Devuelve la firma en base58, lista para mandar al
       servidor cuando exista la verificación. */
    async firmar(sesion, mensaje){
      const proveedor = sesion.proveedor;
      if(!proveedor || !proveedor.signMessage)
        throw ErrorWallet("sin-firma", "esta wallet no sabe firmar mensajes");

      const bytes = new TextEncoder().encode(mensaje);
      let res;
      try{
        res = await proveedor.signMessage(bytes, "utf8");
      }catch(e){
        throw esRechazo(e) ? ErrorWallet("rechazado", "firma cancelada") : ErrorWallet("fallo", e.message);
      }

      /* Phantom devuelve {signature}; Solflare devuelve los bytes pelados. */
      const firma = (res && res.signature) ? res.signature : res;
      if(!firma) throw ErrorWallet("fallo", "la wallet no devolvió ninguna firma");

      return base58(firma instanceof Uint8Array ? firma : new Uint8Array(firma));
    },

    async desconectar(sesion){
      try{ if(sesion && sesion.proveedor && sesion.proveedor.disconnect) await sesion.proveedor.disconnect(); }
      catch(e){}
    }
  };
})();
