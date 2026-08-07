/* ══════════════════════════════════════════════════════════════════════════
   SolBrute · banco de ataque
   ══════════════════════════════════════════════════════════════════════════
   Corre la Edge Function REAL contra una base de datos simulada y la ataca
   como lo haría un jugador que ha reescrito el cliente entero.

   Para qué: no se puede impedir que alguien edite el JavaScript de su
   navegador — es su ordenador. La defensa no es evitarlo, es que hacerlo no
   le sirva de nada. Esto lo comprueba ANTES de desplegar.

   Uso — dos ordenes, y la primera GENERA el fichero bajo prueba a partir de
   la funcion de verdad, para que no se pueda probar una copia vieja:

     sed 's|import "./brute-combate.js";|import "./prueba-banco.ts";\
     import "./brute-combate.js";|' supabase-funcion-auth.ts > funcion-bajo-prueba.ts
     node --experimental-strip-types prueba-hostil.ts

   `funcion-bajo-prueba.ts` esta en .gitignore: es un derivado, y un derivado
   commiteado es el que acabas probando en vez del original.

   Si algún día se añade una ruta a la función, añade aquí su ataque.
   Y si una ruta pasa un dato NUEVO a Postgres, comprueba aquí que lo pasa:
   un parámetro que se deja de mandar no da error, solo apaga lo que protegía.
   ══════════════════════════════════════════════════════════════════════════ */
import "./funcion-bajo-prueba.ts";
import { webcrypto, generateKeyPairSync, sign as firmarNode } from "node:crypto";
import { readFile } from "node:fs/promises";

const H = (globalThis as any).__manejador;
const T = (globalThis as any).__TABLAS;
const C = (globalThis as any).BruteCombate;
const b58 = (() => { (globalThis as any).window = {}; return null; })();

const ALF = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58(bytes: Uint8Array){ const d:number[]=[];
  for(const b of bytes){ let c=b; for(let i=0;i<d.length;i++){ c+=d[i]<<8; d[i]=c%58; c=(c/58)|0; } while(c>0){ d.push(c%58); c=(c/58)|0; } }
  let out=""; for(const b of bytes){ if(b===0) out+="1"; else break; }
  for(let i=d.length-1;i>=0;i--) out+=ALF[d[i]]; return out; }

const pedir = async (cuerpo:any) => {
  const r = await H(new Request("http://x", { method:"POST", body: JSON.stringify(cuerpo) }));
  return { s: r.status, d: await r.json().catch(()=>({})) };
};

const look = {sex:0,skin:1,hair:0,hairC:0,cloth:1,clothC:0,face:0,eyeC:0,tat:0,tatC:0};
const hallazgos:string[]=[];
const probar=(n:string,vulnerable:boolean,det:string)=>{ console.log((vulnerable?"  ⚠ ROTO   ":"  · aguanta")+"  "+n.padEnd(42)+det); if(vulnerable) hallazgos.push(n+" — "+det); };

async function entrar(nombre:string, conLook?:any){
  const {publicKey,privateKey}=generateKeyPairSync("ed25519");
  const dir=base58(new Uint8Array(publicKey.export({type:"spki",format:"der"}).slice(-32)));
  const n=(await pedir({accion:"nonce",address:dir})).d.nonce;
  const m=[`dentroytu.github.io wants you to sign in with your Solana account:`,dir,"","Sign in to SolBrute. This is free and moves no funds.","","URI: x","Version: 1","Chain ID: mainnet","Nonce: "+n,"Issued At: "+new Date().toISOString()].join("\n");
  const firma=base58(new Uint8Array(firmarNode(null,new TextEncoder().encode(m),privateKey)));
  const v=await pedir({accion:"verify",address:dir,message:m,signature:firma});
  const token=v.d.token;
  await pedir({accion:"tirar",token});
  const f=await pedir({accion:"forjar",token,bruto:{name:nombre,lv:1,xp:0,hpMax:45,str:2,agi:2,spd:2,w:0,l:0,fights:3,rerolls:1,look:conLook||look}});
  return {dir,token,id:f.d.id};
}
const bruto=(id:number)=>T.brutes.find((x:any)=>x.id===id);
const saldo=(dir:string)=>T.players.find((x:any)=>x.address===dir)?.coins ?? 0;

(async()=>{
  /* el dominio del banco es "x": se acepta porque DOMINIOS_OK no aplica aquí.
     Lo que importa es lo económico, no el login, que ya se probó en producción. */
  (globalThis as any).__saltarDominio = true;
  const A = await entrar("Hostil");
  if(!A.id){ console.log("no pude crear el bruto de prueba — dominio rechazado, esperado en el banco"); }

  console.log("\n═══ UN CLIENTE COMPLETAMENTE REESCRITO INTENTA… ═══\n");
  const hoy=new Date().toISOString().slice(0,10);
  const b=bruto(A.id);

  // 1 · subirse a sí mismo
  await pedir({accion:"guardar",token:A.token,brutos:[{rid:A.id,name:"x",lv:100,xp:9e5,hpMax:300,str:10,agi:10,spd:10,w:99999,l:0,look,dia:hoy,fights:99,rerolls:99,arma:"mandoble",armas:["daga","mandoble","lanza","escudo"],pool:[{name:"pipo",lv:1,hpMax:1,str:1,agi:1,spd:1,w:0,l:0,look,bot:true}]}]});
  const d=bruto(A.id);
  probar("subirse nivel / atributos / victorias", d.level>1||d.str>4||d.hp_max>50||d.wins>0, `nivel ${d.level} · ${d.str}/${d.agi}/${d.spd} · vida ${d.hp_max} · ${d.wins}V`);
  probar("regalarse peleas del día",  d.fights_left>3, `${d.fights_left} peleas`);
  probar("regalarse cambios de lista", d.rerolls_left>1, `${d.rerolls_left} cambios`);
  probar("regalarse armas",            (d.armas||[]).length>0, JSON.stringify(d.armas||[]));
  probar("inventarse la lista de rivales", !!d.pool, JSON.stringify(d.pool)?.slice(0,30) ?? "null");

  // 2 · monedas
  const antes=saldo(A.dir);
  await pedir({accion:"guardar",token:A.token,balance:1e9,brutos:[]});
  probar("fijarse el saldo", saldo(A.dir)!==antes, `${antes} → ${saldo(A.dir)}`);

  // 3 · comprar poniendo TU precio
  /* Se comprueba en el parametro que sale hacia Postgres, no en el saldo: el
     cobro ocurre DENTRO de la funcion de Postgres, que este banco no
     reimplementa a proposito. Mirar el saldo aqui daria una falsa alarma. */
  {
    const R=(globalThis as any).__RPC as {fn:string;args:any}[];
    R.length=0;
    await pedir({accion:"comprar",token:A.token,arma:"mandoble",precio:0,p_precio:0});
    const l=R.find(r=>r.fn==="arma_comprar");
    probar("comprar poniendo tu propio precio",
           !!l && l.args.p_precio!==C.ARMAS.mandoble.precio,
           `mande 0, la funcion paso ${l?.args.p_precio} (precio real ${C.ARMAS.mandoble.precio})`);
  }

  // 4 · equipar lo que no tiene
  await pedir({accion:"equipar",token:A.token,bruteId:A.id,arma:"mandoble"});
  probar("equipar sin tenerla", bruto(A.id).arma!=="ninguna", "lleva "+bruto(A.id).arma);

  // 5 · pelear más de 3 veces
  await pedir({accion:"arena",token:A.token,bruteId:A.id,version:C.VERSION});
  let peleas=0;
  for(let i=0;i<10;i++){
    const r=await pedir({accion:"pelear",token:A.token,bruteId:A.id,opponentIdx:0,version:C.VERSION});
    if(r.s===200) peleas++;
    await pedir({accion:"guardar",token:A.token,brutos:[{rid:A.id,name:"x",lv:1,xp:0,hpMax:45,str:2,agi:2,spd:2,w:0,l:0,look,dia:hoy,fights:3}]});
  }
  probar("encadenar peleas saltando el tope", peleas>3, `${peleas} peleas`);

  // 6 · elegir la semilla
  const p=await pedir({accion:"pelear",token:A.token,bruteId:A.id,opponentIdx:0,version:C.VERSION,seed:1});
  probar("elegir la semilla del combate", p.s===200 && p.d.seed===1, "semilla "+(p.d.seed ?? "—"));

  // 7 · cuarto bruto y plaza gratis
  await pedir({accion:"tirar",token:A.token});
  await pedir({accion:"forjar",token:A.token,bruto:{name:"Dos",lv:1,xp:0,hpMax:45,str:2,agi:2,spd:2,w:0,l:0,fights:3,rerolls:1,look}});
  probar("saltarse el precio de la 2ª plaza", T.brutes.filter((x:any)=>x.owner===A.dir).length>1 && saldo(A.dir)>=0 && T.brutes.filter((x:any)=>x.owner===A.dir).length>1 && saldo(A.dir)===antes, `brutos ${T.brutes.filter((x:any)=>x.owner===A.dir).length} · saldo ${saldo(A.dir)}`);

  // 8 · aspecto y nombre envenenados
  await pedir({accion:"tirar",token:A.token});
  const mal=await pedir({accion:"forjar",token:A.token,bruto:{name:'<img src=x o',lv:1,xp:0,hpMax:45,str:2,agi:2,spd:2,w:0,l:0,fights:3,rerolls:1,look:{sex:0,skin:'"><script>',hair:999,hairC:null,cloth:0,clothC:0,face:0,eyeC:0,tat:0,tatC:0}}});
  const env=T.brutes.find((x:any)=>x.id===mal.d.id);
  if(env){
    probar("nombre con HTML", /[<>"'&]/.test(String(env.name).replace(/'/g,"")), JSON.stringify(env.name));
    probar("aspecto fuera de rango", JSON.stringify(env.look).includes("script")||JSON.stringify(env.look).includes("999"), JSON.stringify(env.look).slice(0,50));
  }

  // 9 · el precio que sale hacia Postgres es el del servidor, para TODAS
  /* Antes esto miraba el saldo y esperaba 35 monedas — el precio del mandoble
     de hace tres cambios. Una prueba con un numero copiado a mano envejece
     sola y acaba fallando por estar desactualizada, no por haber encontrado
     nada. Ahora se lee de `C.ARMAS`, que es la misma fuente que usa el juego.

     Y la que decia "comprar dos veces la misma" se ha quitado: marcaba como
     agujero algo que desde el inventario del paso 14 es lo correcto — tres
     brutos pueden llevar tres dagas, y para eso hay que comprar tres. Pasaba
     solo porque la llamada moria antes de llegar. */
  {
    const R=(globalThis as any).__RPC as {fn:string;args:any}[];
    R.length=0;
    for(const id of Object.keys(C.ARMAS)) if(id!=="ninguna") await pedir({accion:"comprar",token:A.token,arma:id});
    for(const id of Object.keys(C.MASCOTAS)) if(id!=="ninguna") await pedir({accion:"comprar_mascota",token:A.token,mascota:id});
    const mal=R.filter(r=>{
      const tabla = r.fn==="arma_comprar" ? C.ARMAS : r.fn==="mascota_comprar" ? C.MASCOTAS : null;
      if(!tabla) return false;
      const it = tabla[r.args.p_arma||r.args.p_id];
      return !it || r.args.p_precio!==it.precio;
    });
    probar("el precio lo pone el servidor, en todas", mal.length>0,
           mal.length ? mal.map(r=>`${r.args.p_arma||r.args.p_id}=${r.args.p_precio}`).join(" ")
                      : `${R.length} compras con el precio de brute-combate.js`);
  }
  /* El detalle decia "se acepta" SIEMPRE, ganara o perdiera el ataque. Un
     banco cuyo texto dice lo contrario de su veredicto se lee mal justo el dia
     que encuentra algo. Ahora enseña el codigo que respondio de verdad. */
  {
    const r1 = await pedir({accion:"comprar",token:A.token,arma:"excalibur"});
    probar("comprar un arma inexistente", r1.s===200, `respondio ${r1.s}`);
    const r2 = await pedir({accion:"comprar",token:A.token,arma:"ninguna"});
    probar("comprar 'ninguna' (puños) pagando", r2.s===200, `respondio ${r2.s}`);
  }

  /* ── 9c · las claves del PROTOTIPO ────────────────────────────────────────
     `ARMAS["constructor"]` no es undefined: es una funcion, o sea verdadera. Y
     media docena de rutas comprueban la existencia con `if (!w)`, asi que
     pasaba, `w.precio` salia undefined, JSON.stringify borraba la clave, y
     PostgREST devolvia PGRST202 → 500 mudo. Alcanzable por cualquier jugador
     con sesion.

     Se arreglo quitandole el prototipo a las tablas en brute-combate.js. Esta
     prueba es lo que impide que vuelva el dia que alguien escriba una tabla
     nueva sin acordarse. */
  {
    const VENENO = ["constructor","__proto__","toString","valueOf","hasOwnProperty"];
    const rutas: [string, (v:string)=>any][] = [
      ["comprar",          v => ({accion:"comprar",          token:A.token, arma:v})],
      ["equipar",          v => ({accion:"equipar",          token:A.token, bruteId:A.id, arma:v})],
      ["comprar_mascota",  v => ({accion:"comprar_mascota",  token:A.token, mascota:v})],
      ["equipar_mascota",  v => ({accion:"equipar_mascota",  token:A.token, bruteId:A.id, mascota:v})],
      ["comprar_skin",     v => ({accion:"comprar_skin",     token:A.token, arma:v, skin:0})],
      ["poner_skin",       v => ({accion:"poner_skin",       token:A.token, bruteId:A.id, arma:v, skin:0})],
    ];
    /* ── Lo que se mide NO es el codigo de estado ─────────────────────────
       La primera version contaba «200 = agujero», y fallaba 1 de cada 6
       pasadas por un motivo que no tenia nada que ver: en las pruebas de
       antes el bruto pelea, a veces sube de nivel y le toca un ARMA. Entonces
       `poner_skin` encuentra un arma de verdad, deriva su familia —ignorando
       el `arma` del cuerpo, que es justo el arreglo— y llama a Postgres. El
       banco no ejecuta Postgres, asi que devuelve 200.

       O sea que el 200 era correcto y la prueba estaba mal. Y una prueba que
       falla 1 de cada 6 veces es peor que ninguna: se aprende a repetirla
       hasta que salga verde.

       Lo que de verdad hay que exigir es que el valor envenenado NO LLEGUE a
       Postgres, mas los 500. Eso vale para las seis rutas por igual y no
       depende de si el bruto llego a la pelea con arma o sin ella. */
    const RPC = (globalThis as any).__RPC as {fn:string;args:any}[];
    const rotas: string[] = [];
    for (const [ruta, cuerpo] of rutas)
      for (const v of VENENO) {
        RPC.length = 0;
        const r = await pedir(cuerpo(v));
        if (r.s >= 500) { rotas.push(`${ruta}:${v}=${r.s}`); continue; }
        const colado = RPC.find(x => JSON.stringify(x.args || {}).includes('"' + v + '"'));
        if (colado) rotas.push(`${ruta}:${v}→${colado.fn}`);
      }
    probar("claves del prototipo como id", rotas.length>0,
           rotas.length ? rotas.slice(0,4).join(" ")
                        : `${rutas.length*VENENO.length} intentos: ni un 500, y ninguno llego a Postgres`);
    /* Y que las tablas de verdad no las tengan, que es donde se arreglo. */
    const conProto = ["ARMAS","MASCOTAS","SKINS","FAMILIAS","FAMILIA_DE"]
      .filter(t => C[t] && VENENO.some(v => (C[t] as any)[v]));
    probar("las tablas heredan de Object.prototype", conProto.length>0,
           conProto.length ? conProto.join(",") : "las 5 sin prototipo");
  }

  /* ── 9d · la skin de una familia puesta en OTRA ───────────────────────────
     `poner_skin` mandaba a Postgres la familia sacada de `cuerpo.arma`, o sea
     de lo que dijera el navegador — y Postgres comprueba la propiedad contra
     ESA familia, pero le pone la skin al arma que el bruto lleva DE VERDAD.

     O sea: una skin de dagas por 45 monedas, puesta en un mandoble, y ese
     indice se lleva en las ocho familias. Ocho skins al precio de una, con el
     sumidero convertido en un descuento.

     El banco no ejecuta Postgres, y no hace falta: lo que hay que comprobar es
     CON QUE se le llama, que es justo para lo que existe. Se le da al bruto un
     mandoble (familia `espadas`) y se pide la skin diciendo que lleva `daga`.
     Si la Edge Function repite la mentira, `p_familia` llega como `dagas`. */
  {
    bruto(A.id).arma = "mandoble";
    const RPC=(globalThis as any).__RPC as {fn:string;args:any}[];
    RPC.length = 0;
    const r = await pedir({accion:"poner_skin", token:A.token, bruteId:A.id, arma:"daga", skin:3});
    const l = RPC.find(x => x.fn === "skin_poner");
    const mintio = l?.args?.p_familia === "dagas";
    probar("colar la skin de otra familia", mintio || r.s === 200 && !l,
           l ? `el bruto lleva mandoble y paso p_familia=${l.args.p_familia}` : `respondio ${r.s}, sin llamada`);
    bruto(A.id).arma = "ninguna";
  }

  // 10 · adelantar el día para recargar peleas
  bruto(A.id).fights_day="2020-01-01";
  await pedir({accion:"arena",token:A.token,bruteId:A.id,version:C.VERSION});
  const tras=bruto(A.id);
  probar("recarga diaria da lo justo", tras.fights_left!==3 || tras.rerolls_left!==1, `${tras.fights_left} peleas, ${tras.rerolls_left} cambios`);

  // 11 · tocar el bruto de otro
  const B=await entrar("Victima");
  await pedir({accion:"guardar",token:A.token,brutos:[{rid:B.id,name:"x",lv:99,xp:0,hpMax:300,str:10,agi:10,spd:10,w:999,l:0,look,dia:hoy}]});
  await pedir({accion:"equipar",token:A.token,bruteId:B.id,arma:"mandoble"});
  await pedir({accion:"comprar",token:A.token,bruteId:B.id,arma:"daga"});
  const v=bruto(B.id);
  probar("tocar el bruto de otro jugador", v.level>1||v.arma!=="ninguna"||v.wins>0, `nivel ${v.level} · arma ${v.arma} · ${v.wins}V`);

  // 12 · rutas de admin sin ser admin
  /* ── La lista se LEE del fichero, no se escribe aqui ──────────────────────
     Estaba a mano con ocho rutas cuando ya habia quince, y ademas el total
     decia "de 7". Una lista copiada envejece sola: el dia que se añada
     `admin_lo_que_sea`, esta prueba seguiria en verde sin haberla tocado — y
     habria dicho "aguanta" sobre una superficie que no miro.

     Ahora sale del propio `supabase-funcion-auth.ts`, asi que una ruta nueva
     entra en el ataque el mismo dia que se escribe. */
  const FUENTE = await readFile("supabase-funcion-auth.ts", "utf8");
  const RUTAS_ADMIN = [...FUENTE.matchAll(/accion === "(admin_[a-z_0-9]+)"/g)]
    .map(m => m[1]).filter((v, i, a) => a.indexOf(v) === i);
  let admins = 0;
  const coladas: string[] = [];
  for (const a of RUTAS_ADMIN) {
    /* Un cuerpo con TODO lo que pide cualquiera de ellas: si alguna se cuela
       por faltarle un campo, se cuela de verdad y no por accidente. */
    const r = await pedir({
      accion: a, token: A.token, id: A.id, torneoId: 1, bruteId: A.id,
      address: B.dir, campos: { coins: 1e9, activa: true, precio_lamports: 1 },
      motivo: "me la abro yo solo", activo: true,
    });
    if (r.s === 200) { admins++; coladas.push(a); }
  }
  probar("entrar en las rutas de admin", admins>0,
         admins ? coladas.join(" ") : `las ${RUTAS_ADMIN.length} respondieron 401`);

  /* ── 11b · toda compra se apunta en NEGATIVO ─────────────────────────────
     El historial pinta por el signo —`neg = monedas < 0`, y si no lo es le
     pone un `+` delante y lo colorea de ganancia—, asi que un apunte de compra
     en positivo se lee como si al jugador le hubieran PAGADO por comprar.
     Paso con las skins, que eran el apunte mas nuevo de los seis.

     Se lee del propio fichero en vez de provocar cada compra: son seis rutas
     con sus precios y sus saldos, y lo que se rompio no fue el flujo sino el
     signo de una linea. */
  {
    const F = await readFile("supabase-funcion-auth.ts", "utf8");
    const COMPRAS = ["compra_plaza","compra_arma","skin","mascota","torneo"];
    const positivas = [...F.matchAll(/apuntar\([^,]+,\s*"([a-z_]+)"[^,]*,[^,]+,\s*(-?)[A-Za-z0-9_.()\s]+?,/g)]
      .filter(m => COMPRAS.includes(m[1]) && m[2] !== "-")
      .map(m => m[1]);
    probar("una compra apuntada en positivo", positivas.length>0,
           positivas.length ? positivas.join(" ") : `las ${COMPRAS.length} clases de compra van en negativo`);
  }

  /* ── 11d · la forja no puede regalar los colores de pago ─────────────────
     `sanearLook` se abrio a las opciones premium para que un bruto pueda
     LLEVAR lo comprado, y eso abrio de paso la puerta de regalarlas: forjar es
     gratis, asi que bastaba con mandar el indice premium en el aspecto del
     bruto nuevo.

     Se comprueba con el resultado, no leyendo el codigo: se forja pidiendo el
     ultimo color de cada tabla y se mira que lo escrito NO sea premium. */
  {
    /* Va en el PRIMER bruto de una cuenta nueva: el segundo cuesta 50 monedas
       y una cuenta recien hecha tiene cero, asi que la forja fallaba y esta
       prueba decia «aguanta» sin haber medido nada. Se vio devolviendo el
       fallo a mano. */
    const caro = { ...look };
    for (const campo of Object.keys(C.ASPECTO)) caro[campo] = C.LOOK_TOTAL[campo] - 1;
    const B2 = await entrar("Caro"+Date.now().toString().slice(-5), caro);
    const fila = T.brutes.find((x:any)=>x.id===B2.id);
    const cuela = fila ? Object.keys(C.premiumDe(fila.look)) : [];
    probar("forjar con colores de pago sin pagarlos", cuela.length>0,
      cuela.length ? "se colaron: " + cuela.join(",")
                   : "los " + Object.keys(C.ASPECTO).length + " cayeron a los de casa");
  }

  /* ── 11c · el mantenimiento no puede cerrarse por dentro ─────────────────
     La puerta del mantenimiento dejaba pasar las rutas `admin_` pero NO
     `nonce` ni `verify`, que son con las que se entra. Y durante el login
     todavia no hay token, asi que echaba a todo el mundo — administrador
     incluido. El resultado: con el juego parado, el dueño no podia iniciar
     sesion ni en el juego ni en el panel, y solo se salia con un `update` a
     mano en el SQL Editor.

     Un interruptor de emergencia que se cierra por dentro. Y el comentario que
     hay encima ya decia que el admin tenia que pasar SIEMPRE. */
  {
    T.mantenimiento[0].activo = true;
    /* La funcion cachea la respuesta diez segundos; el reloj no se puede mover
       desde aqui, asi que se comprueba lo unico que importa y no depende de la
       cache: que las rutas de login no esten detras de la puerta. */
    const F = await readFile("supabase-funcion-auth.ts", "utf8");
    /* Dos formas de escribirlo y las dos valen: los nombres sueltos dentro del
       `if`, o una lista aparte. Buscar solo una fue lo que hizo que esta misma
       prueba dijera «siguen detras» con el fallo ya arreglado. */
    const cond = /if \(!accion\.startsWith\("admin_"\)([^{]*)\)\s*\{/.exec(F);
    /* La lista solo cuenta si la CONDICION la usa. Sin esto, la prueba
       encontraba `SIN_PUERTA` declarada y daba el visto bueno aunque el `if`
       no la mirara — o sea aprobaba con el fallo puesto. Se vio devolviendo el
       fallo a mano, que es la unica forma de saber si un detector detecta. */
    const usaLista = /SIN_PUERTA/.test(cond?.[1] || "");
    const lista = usaLista ? /SIN_PUERTA\s*=\s*\[([^\]]*)\]/.exec(F) : null;
    const libres = new Set([
      ...[...(cond?.[1] || "").matchAll(/"(\w+)"/g)].map(x => x[1]),
      ...[...(lista?.[1] || "").matchAll(/"(\w+)"/g)].map(x => x[1]),
    ]);
    const faltan = ["nonce", "verify"].filter(x => !libres.has(x));
    probar("el mantenimiento cierra la puerta por dentro", faltan.length > 0,
      faltan.length ? `${faltan.join(" y ")} quedan detras de la puerta`
                    : "nonce y verify pasan: siempre se puede entrar a apagarlo");
    T.mantenimiento[0].activo = false;
  }

  /* ── 12a · borrar un jugador NO puede quemar sus monedas ─────────────────
     Borrar la fila sin devolver el saldo deja la invariante coja para siempre:
     baja «en circulacion» y no sube la reserva. No es imprimir dinero, es
     quemarlo — pero `respaldo.mjs` diria «no cuadra» a partir de ese dia y
     esas monedas no podrian volver a emitirse nunca.

     Los pasos 16 y 24 SI cuadran la reserva despues de borrar. El panel no lo
     hacia: la capa de abajo sabia y la de arriba no. */
  {
    const AD = (globalThis as any).__ADMIN_DIR as string;
    T.sessions.push({ token: "tok-admin-de-prueba-largo-32-bytes-xyz", address: AD,
                      expires_at: new Date(Date.now() + 3600e3).toISOString() });
    T.players.push({ address: AD, coins: 0, slots: 1 });
    const victima = "VictimaConSaldo" + Date.now().toString().slice(-6);
    T.players.push({ address: victima, coins: 777, slots: 1 });

    const RPC = (globalThis as any).__RPC as {fn:string;args:any}[];
    RPC.length = 0;
    const r = await pedir({ accion: "admin_borrar_jugador", token: "tok-admin-de-prueba-largo-32-bytes-xyz",
                            address: victima });
    const dev = RPC.find(x => x.fn === "emision_reciclar");
    const sigue = T.players.some((p: any) => p.address === victima);
    probar("borrar un jugador quema sus monedas",
           r.s === 200 && !sigue && Number(dev?.args?.p_monedas) !== 777,
           r.s !== 200 ? `respondio ${r.s}`
             : dev ? `borrado y devueltas ${dev.args.p_monedas} a la reserva`
                   : "BORRADO SIN DEVOLVER NADA");
  }

  /* ── 12b · las dos capas tienen que aceptar los MISMOS estados ───────────
     `preventa_confirmar` acepta `reservada` y `caducada`, y lleva ocho lineas
     explicando que la segunda es lo que impide quedarse con el SOL de alguien
     por quince segundos de red. La Edge Function devolvia 410 antes de llegar
     a llamarla, asi que esa defensa no se ejecutaba nunca.

     Es el patron de siempre en este proyecto: una capa defiende y la de encima
     no se ha enterado. No se puede probar con una peticion —haria falta una
     reserva de verdad caducando a mitad— pero SI se puede leer las dos listas
     y exigir que coincidan, que es lo que de verdad se rompio. */
  {
    const sql = await readFile("supabase-31-preventa.sql", "utf8");
    const ts  = await readFile("supabase-funcion-retirar.ts", "utf8");
    const mSql = /c\.estado\s+not\s+in\s*\(([^)]*)\)/.exec(sql);
    const enSql = new Set([...(mSql?.[1] || "").matchAll(/'([a-z]+)'/g)].map(m => m[1]));
    const mTs = /compra\.estado !== "([a-z]+)"(?:\s*&&\s*compra\.estado !== "([a-z]+)")?/.exec(ts);
    const enTs = new Set([mTs?.[1], mTs?.[2]].filter(Boolean) as string[]);
    const soloSql = [...enSql].filter(x => !enTs.has(x));
    const soloTs  = [...enTs].filter(x => !enSql.has(x));
    probar("estados de la preventa desalineados", soloSql.length>0 || soloTs.length>0,
      soloSql.length || soloTs.length
        ? `el SQL acepta ${[...enSql].join("+")} y la funcion ${[...enTs].join("+")}`
        : `las dos aceptan ${[...enSql].sort().join(" + ")}`);
  }

  /* ── 12c · el torneo: las dos capas, otra vez ────────────────────────────
     `torneo_tomar` (SQL) y `admin_torneo_resolver` (la funcion) tienen que
     aceptar los mismos estados. Si el SQL admite rescatar uno atascado y el
     panel sigue exigiendo `inscripcion`, el rescate existe y no hay boton que
     lo alcance — que es exactamente como estaba. */
  {
    const sql = await readFile("supabase-38-torneo-atascado.sql", "utf8");
    const ts  = await readFile("supabase-funcion-auth.ts", "utf8");
    const mSql = /t\.estado\s+not\s+in\s*\(([^)]*)\)/.exec(sql);
    const enSql = new Set([...(mSql?.[1] || "").matchAll(/'([a-z_]+)'/g)].map(m => m[1]));
    const mTs = /antes\.estado !== "([a-z_]+)"\s*&&\s*antes\.estado !== "([a-z_]+)"/.exec(ts);
    const enTs = new Set([mTs?.[1], mTs?.[2]].filter(Boolean) as string[]);
    const iguales = enSql.size === enTs.size && [...enSql].every(x => enTs.has(x));
    probar("estados del torneo desalineados", !iguales,
      iguales ? `las dos resuelven ${[...enSql].sort().join(" + ")}`
              : `el SQL ${[...enSql].join("+")} y el panel ${[...enTs].join("+")}`);
  }

  /* Y que la puerta sea de PREFIJO, no una lista. Si alguien la cambiara por
     un `includes([...])`, una ruta nueva nacería abierta y nada lo diría. */
  probar("la puerta de admin es por lista, no por prefijo",
         !/accion\.startsWith\("admin_"\)/.test(FUENTE),
         'la cubre `accion.startsWith("admin_")`');

  /* La preventa es la unica parte del juego donde alguien manda SOL de verdad
     antes de recibir nada. Encenderla desde fuera del panel seria abrir la
     puerta a cobrar en una wallet que no es la del dueño. */
  {
    const r=await pedir({accion:"admin_preventa_config",token:A.token,
                         campos:{wallet:"11111111111111111111111111111112",activa:true},
                         motivo:"cambiar la wallet que cobra"});
    probar("cambiar la wallet que cobra el SOL", r.s===200, `respondio ${r.s}`);
  }

  // 13 · el candado de nivel: que la funcion se lo PASE a Postgres
  /* El candado vive en el .sql y ya se ataca contra el servidor real. Lo que
     solo puede comprobarse aqui es que la Edge Function manda `p_nivel_min`:
     si alguien lo quita de una llamada, el SQL usa su valor por defecto (1) y
     el candado se apaga SIN FALLAR. Un candado con la llave puesta y ningun
     error que lo delate — el peor tipo de agujero. */
  const RPC=(globalThis as any).__RPC as {fn:string;args:any}[];
  RPC.length=0;
  const esperado:[string,string,number][]=[];
  for(const [id,w] of Object.entries(C.ARMAS) as any){
    if(id==="ninguna") continue;
    await pedir({accion:"comprar",token:A.token,arma:id});
    await pedir({accion:"equipar",token:A.token,bruteId:A.id,arma:id});
    esperado.push(["arma_comprar",id,w.nivel],["arma_equipar",id,w.nivel]);
  }
  for(const [id,m] of Object.entries(C.MASCOTAS) as any){
    if(id==="ninguna") continue;
    await pedir({accion:"comprar_mascota",token:A.token,mascota:id});
    await pedir({accion:"equipar_mascota",token:A.token,bruteId:A.id,mascota:id});
    esperado.push(["mascota_comprar",id,m.nivel],["mascota_equipar",id,m.nivel]);
  }
  const sinNivel=RPC.filter(r=>/comprar|equipar/.test(r.fn) && r.args?.p_nivel_min===undefined);
  probar("mandar el nivel minimo a Postgres", sinNivel.length>0,
         sinNivel.length ? `${sinNivel.length} llamadas SIN p_nivel_min: ${[...new Set(sinNivel.map(r=>r.fn))].join(", ")}`
                         : `${RPC.length} llamadas, todas con p_nivel_min`);
  const malNivel=RPC.filter(r=>{
    const t=esperado.find(e=>e[0]===r.fn && (r.args.p_arma===e[1]||r.args.p_id===e[1]));
    return t && r.args.p_nivel_min!==t[2];
  });
  probar("mandar el nivel CORRECTO de cada objeto", malNivel.length>0,
         malNivel.length ? malNivel.map(r=>`${r.fn}(${r.args.p_arma||r.args.p_id})=${r.args.p_nivel_min}`).join(" ")
                         : "daga 1 · escudo 2 · lanza 4 · mandoble 7 · perro 1 · lobo 4 · oso 8");
  /* Y que el nivel NO se pueda mandar desde el navegador. */
  RPC.length=0;
  await pedir({accion:"comprar",token:A.token,arma:"mandoble",p_nivel_min:1,nivel_min:1,nivel:1});
  const colado=RPC.find(r=>r.fn==="arma_comprar");
  probar("colar tu propio nivel minimo por el cuerpo",
         !!colado && colado.args.p_nivel_min!==C.ARMAS.mandoble.nivel,
         `mande 1, la funcion paso ${colado?.args.p_nivel_min}`);

  // 14 · que el servidor ENTIENDA lo que le dice Postgres
  /* El fallo que esto existe para cazar no es un ataque: es que las dos partes
     dejen de hablar el mismo idioma. Paso de verdad — el paso 14 lanzaba «no
     tienes NINGUNA % libre» y el 25 lo reescribio como «NINGUN %». La funcion
     buscaba «ninguna», no encajaba, y equipar algo que no tienes devolvia «algo
     ha fallado en el servidor». Una letra, y ninguna parte mal por si sola.

     Cada marca se prueba contra LA RUTA QUE PUEDE LANZARLA: `sin_saldo` solo
     sale de comprar, y dispararlo contra equipar seria una falsa alarma. Se
     saca todo del .sql, funcion por funcion, para no tener aqui una lista
     copiada a mano — que es justo la tercera version que causo el problema. */
  {
    /* Estaba clavado a `supabase-25-niveles.sql`, y por eso las marcas del
       paso 43 —`sin_titulo`, `sin_id`, `sin_admin`— pasaron sin traducir sin
       que nadie se enterara: el numero de marcas no se movio de 20 y esto
       siguio en verde sobre una superficie que no miraba.

       El comentario de arriba ya decia que se saca todo del .sql «para no
       tener aqui una lista copiada a mano». Y la lista de FICHEROS estaba
       copiada a mano. Ahora se leen todos los pasos, que es lo que hacia falta
       para que el fichero de mañana entre solo. */
    const fs2 = await import("node:fs/promises");
    const pasosSql = (await fs2.readdir("."))
      .filter(f=>/^supabase-\d+.*\.sql$/.test(f))
      .sort((a,b)=>parseInt(a.slice(9))-parseInt(b.slice(9)));
    const fuentes: string[] = [];
    for (const f of pasosSql) fuentes.push(await fs2.readFile(f, "utf8"));

    /* La ULTIMA definicion de cada funcion, no la primera. Concatenarlo todo y
       buscar con `indexOf` encuentra la version mas vieja —`arma_comprar` la
       define el paso 14 y la reescribe el 25— y entonces se prueban marcas que
       ya no existen y se dejan fuera las que si. Se noto porque el numero de
       marcas BAJO de 20 a 7: por eso el detalle lleva la cuenta y no un «ok».
       Es la misma correccion que ya hubo que hacerle al ataque 15. */
    const cuerpoDe = (fn: string) => {
      let ultimo = "";
      for (const t of fuentes) {
        const i = t.indexOf("function " + fn + "(");
        if (i >= 0) ultimo = t.slice(i, t.indexOf("$$;", i));
      }
      return ultimo;
    };

    /* Cada funcion, con la ruta que puede lanzarla y con QUE sesion. El blog
       solo lo tocan las rutas de admin, asi que con el token de un jugador
       normal ni llegarian a Postgres — y esto diria «aguanta» sin haber
       probado nada. */
    const AD2 = (globalThis as any).__ADMIN_DIR as string;
    const TOKAD = "tok-marcas-de-prueba-largo-32-bytes-ab";
    T.sessions.push({ token: TOKAD, address: AD2,
                      expires_at: new Date(Date.now() + 3600e3).toISOString() });
    const campoBlog = { id:"marca", fecha:"2026-01-01", tag:"contenido", es:{ titulo:"t" } };

    const RUTA:Record<string,any> = {
      arma_comprar:     {accion:"comprar",          arma:"daga"},
      arma_equipar:     {accion:"equipar",          arma:"daga",  bruteId:A.id},
      mascota_comprar:  {accion:"comprar_mascota",  mascota:"perro"},
      mascota_equipar:  {accion:"equipar_mascota",  mascota:"perro", bruteId:A.id},
      blog_guardar:     {accion:"admin_blog_guardar", campos:campoBlog, __tok:TOKAD},
      blog_borrar:      {accion:"admin_blog_borrar",  id:"marca",      __tok:TOKAD},
    };
    const ejemplo=(m:string)=> m==="nivel_insuficiente" ? m+":7"
                             : m==="sin_copias" ? m+":daga"
                             : m==="desconocido" ? m+":x" : m;
    const mudos:string[]=[]; let total=0;
    for(const [fn, extra] of Object.entries(RUTA)){
      const marcas=[...new Set([...cuerpoDe(fn).matchAll(/raise exception '([a-z_]+)(?::%)?'/g)].map(x=>x[1]))];
      for(const marca of marcas){
        total++;
        (globalThis as any).__RPC_LANZA = ejemplo(marca);
        const { __tok, ...cuerpo } = extra;
        const r = await pedir({token: __tok || A.token, ...cuerpo});
        if(r.s>=500) mudos.push(`${fn}/${marca}→${r.s}`);
      }
    }
    (globalThis as any).__RPC_LANZA = null;
    probar("entender los errores de Postgres", mudos.length>0,
           mudos.length ? `${mudos.join(" ")} — cae en un 500 mudo`
                        : `${total} marcas del .sql, todas traducidas a un error con sentido`);
  }

  // 15 · que las tres capas usen el mismo vocabulario
  /* Los tipos de movimiento viven en tres sitios: la Edge Function los escribe,
     el .sql tiene la lista blanca, y app.html las etiquetas. Si uno se
     desincroniza no falla nada visible — el apunte se pierde en silencio,
     porque `apuntar` traga los errores a proposito para no tumbar una compra
     ya cobrada. Un historial con huecos y ninguna alarma.

     Se leen los tres ficheros, no una lista de aqui. */
  {
    const fs = await import("node:fs/promises");
    const ts  = await fs.readFile("supabase-funcion-auth.ts","utf8");
    /* La lista blanca vive en la funcion `movimiento_apuntar`, y esa se ha
       recreado varias veces —cada paso que añade un tipo la vuelve a escribir
       entera—. Asi que vale la del fichero de numero MAS ALTO que la defina,
       que es la que quedo en la base: `create or replace` sustituye.

       Estaba clavado al paso 27, asi que al añadir un tipo en el 40 esta
       prueba decia que el .sql lo rechazaba. Un numero de paso escrito a mano
       envejece igual que una lista escrita a mano. */
    /* La lista vale la del fichero de numero MAS ALTO que redefina
       `movimiento_apuntar`: cada paso que añade un tipo la reescribe entera, y
       `create or replace` sustituye. Estaba clavada al paso 27, asi que al
       añadir un tipo en el 40 la prueba decia que el .sql lo rechazaba.

       Y hay que buscar DENTRO de esa funcion, no cualquier `p_tipo not in`:
       `perdida_apuntar` (paso 30) tiene su propia lista con el mismo nombre de
       parametro, y buscar a lo bruto las mezclaba. Dos listas blancas
       distintas que se parecen es peor que dos que no. */
    const pasos = (await fs.readdir(".")).filter(f=>/^supabase-\d+.*\.sql$/.test(f)).sort();
    let sql = "";
    for (const f of pasos) {
      const t = await fs.readFile(f, "utf8");
      const i = t.indexOf("function movimiento_apuntar");
      if (i >= 0) sql = t.slice(i);
    }
    const web = await fs.readFile("app.html","utf8");
    const usados = [...new Set([...ts.matchAll(/apuntar\([^,]+,\s*"([a-z_]+)"/g)].map(m=>m[1]))];
    const lista  = (sql.match(/p_tipo not in \(([^)]*)\)/s)||["",""])[1];
    const permitidos = [...new Set([...lista.matchAll(/'([a-z_]+)'/g)].map(m=>m[1]))];
    const sinPermiso = usados.filter(t=>!permitidos.includes(t));
    const sinEtiqueta = permitidos.filter(t=>(web.match(new RegExp("hist_"+t+":","g"))||[]).length!==3);
    probar("tipos de movimiento: SQL los permite", sinPermiso.length>0,
           sinPermiso.length ? `la funcion escribe ${sinPermiso.join(", ")} y el .sql los rechaza`
                             : `${usados.length} tipos usados, todos en la lista blanca`);
    probar("tipos de movimiento: la web los nombra", sinEtiqueta.length>0,
           sinEtiqueta.length ? `sin etiqueta en los 3 idiomas: ${sinEtiqueta.join(", ")}`
                              : `${permitidos.length} tipos, todos con etiqueta es/en/fr`);
  }

  /* ── 19 · el blog: lo que se publica se pinta en la pantalla de CUALQUIERA ──
     Es la unica superficie donde un administrador escribe texto que acaba en
     el navegador de gente que no ha iniciado sesion. El cuerpo va en bloques
     tipados justamente para eso, y lo que hay que comprobar aqui es que el
     filtro esta en el SERVIDOR y no solo al pintar: si solo lo filtrara el
     navegador, el dia que otra pagina lea `blog_posts` se lo comeria entero. */
  {
    const AD = (globalThis as any).__ADMIN_DIR as string;
    const TOK = "tok-blog-de-prueba-largo-32-bytes-abc";
    T.sessions.push({ token: TOK, address: AD,
                      expires_at: new Date(Date.now() + 3600e3).toISOString() });
    const RPC = (globalThis as any).__RPC as {fn:string;args:any}[];

    RPC.length = 0;
    await pedir({ accion:"admin_blog_guardar", token:TOK, campos:{
      id:"  Hola Mundo!! /../ ", fecha:"2026-08-07", tag:"inventado",
      es:{ titulo:"t", resumen:"r", cuerpo:[
        { t:"script", x:"<img src=x onerror=alert(1)>" },   // tipo inventado
        { t:"p", x:"esto si vale" },
        { t:"raw",    x:"<b>hola</b>" },                    // otro inventado
      ]},
    }});
    const g = RPC.find(r => r.fn === "blog_guardar");
    const tipos = g ? (g.args.p_es.cuerpo || []).map((b: any) => b.t) : [];
    probar("colar un bloque de tipo inventado en el blog",
           !g || tipos.some((t: string) => !["p","h","q","ul","kv"].includes(t)),
           g ? `llegaron a Postgres: [${tipos.join(", ")}]` : "no llamo a Postgres");

    /* El slug ES la URL. Si dejara pasar barras o espacios, la entrada
       quedaria en una direccion que no se puede compartir — o peor, en una
       que se parece a otra ruta del sitio. */
    probar("colar barras y espacios en la URL de una entrada",
           !g || !/^[a-z0-9-]+$/.test(g.args.p_id),
           g ? `el slug quedo en "${g.args.p_id}"` : "no llamo a Postgres");

    /* Un tag desconocido no puede reventar ni colarse: cae al primero. La
       leccion del paso 33 — el `check` de Postgres se quedo fuera a proposito
       para no tener que abrirlo cada vez que se añada un tipo. */
    probar("colar un tag que no existe",
           !g || !["equilibrio","transparencia","contenido","mantenimiento"].includes(g.args.p_tag),
           g ? `el tag quedo en "${g.args.p_tag}"` : "no llamo a Postgres");

    /* Sin español no hay entrada: es el idioma en el que se escribe y al que
       caen los otros dos. Una fila con los tres vacios se veria como un hueco
       en la home sin que nadie sepa por que. */
    RPC.length = 0;
    const sinEs = await pedir({ accion:"admin_blog_guardar", token:TOK,
      campos:{ id:"vacia", fecha:"2026-08-07", tag:"contenido", es:{ titulo:"  " } }});
    probar("publicar una entrada sin titulo en castellano",
           sinEs.s === 200 || RPC.some(r => r.fn === "blog_guardar"),
           `respondio ${sinEs.s}`);

    /* Una fecha inventada tiene que dar 400, no un 500 mudo: `date` en
       Postgres la rechazaria y el jugador leeria "algo ha fallado". */
    RPC.length = 0;
    const mala = await pedir({ accion:"admin_blog_guardar", token:TOK,
      campos:{ id:"fecha-mala", fecha:"32 de marzo", tag:"contenido", es:{ titulo:"t" } }});
    probar("colar una fecha inventada", mala.s >= 500 || RPC.some(r => r.fn === "blog_guardar"),
           `respondio ${mala.s}`);

  }

  console.log("\n══════ RESULTADO ══════");
  if(!hallazgos.length) console.log("Ningún ataque económico funciona.");
  else hallazgos.forEach((h,i)=>console.log(`${i+1}. ${h}`));
})();
