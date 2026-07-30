/* ══════════════════════════════════════════════════════════════════════════
   SolBrute · servidor local para desarrollo
   ══════════════════════════════════════════════════════════════════════════
   Uso:  node servidor-local.js     →  http://localhost:8777

   Para qué: abrir los ficheros con doble clic (file://) funciona y tiene que
   seguir funcionando, pero el navegador se queda con la versión antigua de los
   .js y acabas depurando un fallo que ya arreglaste. Aquí todo se sirve con
   Cache-Control: no-store, así que cada recarga lee el disco.

   No es una dependencia del juego: SolBrute no necesita servidor para
   funcionar. Es solo comodidad al desarrollar. Usa únicamente módulos que ya
   trae Node, nada que instalar.
   ══════════════════════════════════════════════════════════════════════════ */
const http = require("http");
const fs   = require("fs");
const path = require("path");

const RAIZ   = __dirname;
const PUERTO = process.env.PORT || 8777;
const TIPOS  = {
  ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8",
  ".css":"text/css; charset=utf-8",   ".json":"application/json; charset=utf-8",
  ".sql":"text/plain; charset=utf-8", ".png":"image/png", ".svg":"image/svg+xml"
};

http.createServer((req, res) => {
  const pedida = decodeURIComponent(req.url.split("?")[0]);
  const rel = pedida === "/" ? "/app.html" : pedida;
  /* normalize + quitar los ".." de delante: sin esto, /../../etc/passwd sale
     de la carpeta del proyecto. */
  const abs = path.join(RAIZ, path.normalize(rel).replace(/^(\.\.[/\\])+/, ""));
  if(!abs.startsWith(RAIZ)){ res.writeHead(403); res.end("fuera del proyecto"); return; }

  fs.readFile(abs, (err, buf) => {
    if(err){ res.writeHead(404); res.end("no existe: " + rel); return; }
    res.writeHead(200, {
      "Content-Type": TIPOS[path.extname(abs)] || "application/octet-stream",
      "Cache-Control": "no-store, no-cache, must-revalidate"
    });
    res.end(buf);
  });
}).listen(PUERTO, () => console.log("SolBrute en http://localhost:" + PUERTO));
