/* ══════════════════════════════════════════════════════════════════════════
   SolBrute · banco de ataque
   ══════════════════════════════════════════════════════════════════════════
   Corre la Edge Function REAL contra una base de datos simulada y la ataca
   como lo haría un jugador que ha reescrito el cliente entero.

   Para qué: no se puede impedir que alguien edite el JavaScript de su
   navegador — es su ordenador. La defensa no es evitarlo, es que hacerlo no
   le sirva de nada. Esto lo comprueba ANTES de desplegar.

   Uso:
     1. cp supabase-funcion-auth.ts /tmp/f.ts  y cambiar el import de
        brute-combate.js por rutas absolutas más `import "./prueba-banco.ts"`
     2. node prueba-hostil.ts

   Si algún día se añade una ruta a la función, añade aquí su ataque.
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

  // 3 · comprar sin pagar
  const c=await pedir({accion:"comprar",token:A.token,bruteId:A.id,arma:"mandoble",precio:0});
  probar("comprar mandando el precio", c.s===200, `HTTP ${c.s} ${c.d.error||""}`);

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

  // 9 · comprar de verdad: ¿cobra exactamente el precio?
  /* Se le ponen monedas en la base simulada, como si las hubiera ganado
     peleando: lo que se prueba es el cobro, no cómo llegó al saldo. */
  T.players.find((x:any)=>x.address===A.dir).coins = 200;
  const t0=saldo(A.dir);
  const compra=await pedir({accion:"comprar",token:A.token,bruteId:A.id,arma:"mandoble"});
  if(compra.s===200){
    probar("comprar cobra el precio exacto", saldo(A.dir)!==t0-35, `${t0} → ${saldo(A.dir)} (esperado ${t0-35})`);
    probar("comprar dos veces la misma", (await pedir({accion:"comprar",token:A.token,bruteId:A.id,arma:"mandoble"})).s===200, "se puede repetir");
    probar("comprar un arma inexistente", (await pedir({accion:"comprar",token:A.token,bruteId:A.id,arma:"excalibur"})).s===200, "se acepta");
    probar("comprar 'ninguna' (puños) pagando", (await pedir({accion:"comprar",token:A.token,bruteId:A.id,arma:"ninguna"})).s===200, "se acepta");
  } else probar("comprar con saldo suficiente", true, `HTTP ${compra.s} ${compra.d.error||""} (saldo ${t0})`);

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

  console.log("\n══════ RESULTADO ══════");
  if(!hallazgos.length) console.log("Ningún ataque económico funciona.");
  else hallazgos.forEach((h,i)=>console.log(`${i+1}. ${h}`));
})();
