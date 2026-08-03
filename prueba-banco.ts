/* SolBrute · base de datos simulada para el banco de ataque.
   Imita lo justo de PostgREST —filtros, insert, patch, delete y el índice
   único de nombres— para poder correr la Edge Function real sin tocar
   producción. Ver prueba-hostil.ts.

   Banco de pruebas: corre la Edge Function REAL contra una base de datos
   simulada en memoria, para poder atacarla antes de desplegarla. */
const TABLAS: Record<string, any[]> = { players: [], brutes: [], sessions: [], auth_nonces: [], fights: [], admin_log: [] };
let SEQ = 1;
/* Registro de las llamadas a funciones de Postgres, para poder comprobar
   CON QUE se las llamo. Ver el bloque /rpc/ mas abajo. */
const RPC: { fn: string; args: any }[] = [];

function filtros(qs: string) {
  const f: [string, string, string][] = [];
  for (const par of qs.split("&")) {
    const [k, v] = par.split("=");
    if (!k || !v || k === "select" || k === "order" || k === "limit") continue;
    const [op, ...resto] = v.split(".");
    f.push([decodeURIComponent(k), op, decodeURIComponent(resto.join("."))]);
  }
  return f;
}
const casa = (fila: any, f: [string, string, string][]) => f.every(([k, op, v]) => {
  const x = fila[k];
  if (op === "eq")  return String(x) === v;
  if (op === "neq") return String(x) !== v;
  if (op === "gte") return Number(x) >= Number(v);
  if (op === "lte") return Number(x) <= Number(v);
  if (op === "lt")  return new Date(String(x)).getTime() < new Date(v).getTime();
  if (op === "gt")  return Number(x) > Number(v);
  return true;
});

(globalThis as any).fetch = async (url: string, opciones: any = {}) => {
  const u = new URL(url, "http://x");
  const tabla = u.pathname.replace("/rest/v1/", "").split("?")[0];
  const T = TABLAS[tabla];
  const cuerpo = opciones.body ? JSON.parse(opciones.body) : null;
  const met = opciones.method || "GET";
  const f = filtros(u.search.slice(1));
  const resp = (d: any, s = 200) => ({ ok: s < 400, status: s, text: async () => JSON.stringify(d) });

  /* ── Las funciones de Postgres ──
     NO se reimplementa lo que hacen: solo se APUNTA con que se las llamo y se
     devuelve algo plausible.

     Es deliberado. La logica de `arma_comprar` vive en el .sql y ya se ataca
     contra el servidor de verdad. Copiarla aqui seria una tercera version que
     se desincroniza el primer dia — y una prueba que pasa contra una copia
     equivocada es peor que no tener prueba.

     Lo que SI puede comprobar este banco, y nadie mas, es que la Edge Function
     le pasa a Postgres lo que debe. Si alguien quita `p_nivel_min` de una
     llamada, el candado se apaga en silencio: el SQL tiene ese parametro con
     valor por defecto 1, asi que no falla, simplemente deja pasar todo. */
  if (u.pathname.startsWith("/rest/v1/rpc/")) {
    const fn = u.pathname.replace("/rest/v1/rpc/", "");
    RPC.push({ fn, args: cuerpo });
    if (fn === "arma_comprar" || fn === "mascota_comprar")
      return resp({ bolsa: {}, balance: 0 });
    if (fn === "arma_equipar")    return resp({ arma: cuerpo?.p_arma, bolsa: {}, cambio: true });
    if (fn === "mascota_equipar") return resp({ mascota: cuerpo?.p_id, bolsa: {}, cambio: true });
    return resp({});
  }

  if (!T) return resp({ message: "no existe " + tabla }, 404);
  if (met === "GET")    return resp(T.filter((x) => casa(x, f)));
  if (met === "DELETE") { for (let i = T.length - 1; i >= 0; i--) if (casa(T[i], f)) T.splice(i, 1); return resp(null, 204); }
  if (met === "PATCH")  { T.forEach((x) => { if (casa(x, f)) Object.assign(x, cuerpo); }); return resp(null, 204); }
  if (met === "POST") {
    const filas = Array.isArray(cuerpo) ? cuerpo : [cuerpo];
    /* el índice único de nombres, que es real y hay que simular */
    for (const fi of filas) {
      if (tabla === "brutes" && T.some((x) => String(x.name).toLowerCase() === String(fi.name).toLowerCase()))
        return resp({ message: 'duplicate key value violates unique constraint "brutes_name_key" (23505)' }, 409);
      if (tabla === "players" && T.some((x) => x.address === fi.address)) continue;
      /* Valores por defecto de las columnas, como haría Postgres. Sin esto,
         los campos que no manda la función quedan undefined y las pruebas
         dan falsos positivos. */
      const porDefecto = tabla === "brutes"
        ? { arma: "ninguna", armas: [], fights_left: 3, rerolls_left: 1, pool: null, wins: 0, losses: 0, xp: 0, level: 1 }
        : tabla === "players" ? { coins: 0, slots: 1 } : {};
      T.push({ id: SEQ++, ...porDefecto, ...fi });
    }
    return resp(T.slice(-filas.length));
  }
  return resp(null, 405);
};

(globalThis as any).Deno = {
  env: { get: (n: string) => n === "ADMIN_WALLETS" ? "" : "http://x" },
  serve: (f: any) => { (globalThis as any).__manejador = f; },
};
(globalThis as any).__TABLAS = TABLAS;
(globalThis as any).__RPC = RPC;
