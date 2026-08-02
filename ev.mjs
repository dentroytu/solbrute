import crypto from "node:crypto";
const ANON="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlocmN2YXJ0dXV5dmZ0eGR4enR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MjYyMzcsImV4cCI6MjEwMTAwMjIzN30.rhX_iI5qZROciWSBP3m0RhkMQXTSz6ttQz2zpXj_uxk";
const F="https://ihrcvartuuyvftxdxztt.supabase.co/functions/v1/auth";
const R="https://ihrcvartuuyvftxdxztt.supabase.co/rest/v1";
const A="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58(x){const d=[];for(const b of x){let c=b;for(let i=0;i<d.length;i++){c+=d[i]<<8;d[i]=c%58;c=(c/58)|0;}while(c){d.push(c%58);c=(c/58)|0;}}
 let o="";for(const b of x){if(b===0)o+="1";else break;}return o+d.reverse().map(y=>A[y]).join("");}
const H={apikey:ANON,Authorization:"Bearer "+ANON,"Content-Type":"application/json"};
const post=b=>fetch(F,{method:"POST",headers:H,body:JSON.stringify(b)}).then(async r=>({code:r.status,body:await r.json().catch(()=>({}))}));
const get=q=>fetch(R+q,{headers:H}).then(r=>r.json());
const LOOK={sex:0,skin:1,hair:1,hairC:1,cloth:1,clothC:1,face:0,eyeC:1,tat:0,tatC:0};

const kp=crypto.generateKeyPairSync("ed25519");
const addr=b58(kp.publicKey.export({type:"spki",format:"der"}).subarray(-32));
const n=await post({accion:"nonce",address:addr});
const msg=["localhost:8777 wants you to sign in with your Solana account:",addr,"",
 "Sign in to SolBrute. This is free and moves no funds.","",
 "URI: http://localhost:8777","Version: 1","Chain ID: mainnet",
 "Nonce: "+n.body.nonce,"Issued At: "+new Date().toISOString()].join("\n");
const t=(await post({accion:"verify",address:addr,message:msg,signature:b58(crypto.sign(null,Buffer.from(msg),kp.privateKey))})).body.token;
await post({accion:"tirar",token:t});
const id=(await post({accion:"forjar",token:t,bruto:{name:"Ev"+Date.now().toString().slice(-6),look:LOOK}})).body.id;
console.log("  bruto",id,"\n");

for(let i=0;i<3;i++){
  await post({accion:"arena",token:t,bruteId:id,version:6});
  const p=await post({accion:"pelear",token:t,bruteId:id,opponentIdx:0,version:6});
  if(p.code!==200){console.log("  pelea",p.code,JSON.stringify(p.body).slice(0,70));break;}
  console.log(`  pelea ${i+1}: ${p.body.winner==="A"?"gana":"pierde"} · ${p.body.turns}t · +${p.body.coins} · subio=${p.body.subio} ${p.body.ganancia||""}`);
}
console.log("\n  ── lo que quedó GUARDADO en fights ──");
const filas=await get(`/fights?a_brute=eq.${id}&select=id,winner,turns,coins,subio,nivel,ganancia,arma_rota,arma&order=id.asc`);
for(const f of filas) console.log("  ", JSON.stringify(f));
const ok = filas.length && filas.every(f=>f.arma!==null) && filas.some(f=>f.subio===true);
console.log(`\n  ${ok?"✓ PASA":"⚠ revisar"}  arma escrita en todas · subio registrado`);
console.log("  limpiar:",addr);
