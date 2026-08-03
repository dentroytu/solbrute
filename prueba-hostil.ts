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

async function entrar(nombre:string){
  const {publicKey,privateKey}=generateKeyPairSync("ed25519");
  const dir=base58(new Uint8Array(publicKey.export({type:"spki",format:"der"}).slice(-32)));
  const n=(await pedir({accion:"nonce",address:dir})).d.nonce;
  const m=[`dentroytu.github.io wants you to sign in with your Solana account:`,dir,"","Sign in to SolBrute. This is free and moves no funds.","","URI: x","Version: 1","Chain ID: mainnet","Nonce: "+n,"Issued At: "+new Date().toISOString()].join("\n");
  const firma=base58(new Uint8Array(firmarNode(null,new TextEncoder().encode(m),privateKey)));
  const v=await pedir({accion:"verify",address:dir,message:m,signature:firma});
  const token=v.d.token;
  await pedir({accion:"tirar",token});
  const f=await pedir({accion:"forjar",token,bruto:{name:nombre,lv:1,xp:0,hpMax:45,str:2,agi:2,spd:2,w:0,l:0,fights:3,rerolls:1,look}});
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
  probar("comprar un arma inexistente", (await pedir({accion:"comprar",token:A.token,arma:"excalibur"})).s===200, "se acepta");
  probar("comprar 'ninguna' (puños) pagando", (await pedir({accion:"comprar",token:A.token,arma:"ninguna"})).s===200, "se acepta");

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
  let admins=0;
  for(const a of ["admin_resumen","admin_jugadores","admin_editar_bruto","admin_borrar_jugador"]){
    const r=await pedir({accion:a,token:A.token,id:A.id,address:B.dir,campos:{coins:1e9}});
    if(r.s===200) admins++;
  }
  probar("entrar en las rutas de admin", admins>0, `${admins} de 4 respondieron`);

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
    const sql = await (await import("node:fs/promises")).readFile("supabase-25-niveles.sql","utf8");
    const RUTA:Record<string,any> = {
      arma_comprar:     {accion:"comprar",          arma:"daga"},
      arma_equipar:     {accion:"equipar",          arma:"daga",  bruteId:A.id},
      mascota_comprar:  {accion:"comprar_mascota",  mascota:"perro"},
      mascota_equipar:  {accion:"equipar_mascota",  mascota:"perro", bruteId:A.id},
    };
    const ejemplo=(m:string)=> m==="nivel_insuficiente" ? m+":7"
                             : m==="sin_copias" ? m+":daga"
                             : m==="desconocido" ? m+":x" : m;
    const mudos:string[]=[]; let total=0;
    for(const [fn, extra] of Object.entries(RUTA)){
      const ini = sql.indexOf("function "+fn+"(");
      const fin = sql.indexOf("$$;", ini);
      const marcas=[...new Set([...sql.slice(ini,fin).matchAll(/raise exception '([a-z_]+)(?::%)?'/g)].map(x=>x[1]))];
      for(const marca of marcas){
        total++;
        (globalThis as any).__RPC_LANZA = ejemplo(marca);
        const r = await pedir({token:A.token, ...extra});
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
    const sql = await fs.readFile("supabase-27-perdidas.sql","utf8");
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

  console.log("\n══════ RESULTADO ══════");
  if(!hallazgos.length) console.log("Ningún ataque económico funciona.");
  else hallazgos.forEach((h,i)=>console.log(`${i+1}. ${h}`));
})();
