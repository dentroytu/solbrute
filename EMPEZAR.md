# Empezar de cero — guía para SolBrute

Escrita para alguien que nunca ha usado terminal, git ni bases de datos.

**Regla de oro:** una herramienta nueva cada vez, y cada paso termina con algo
que puedes ver funcionando. Si un paso falla, no sigas al siguiente.

---

## Paso 0 · La carpeta (15 min)

Crea una carpeta llamada `solbrute` (el escritorio vale) y mete dentro los
ficheros que ya tienes:

```
solbrute/
├── index.html
├── app.html
├── creator.html      ← banco de pruebas, no es producto
├── fight.html        ← banco de pruebas, no es producto
├── CLAUDE.md
├── BACKEND.md
└── EMPEZAR.md        ← esto
```

Haz doble clic en `index.html`. Si se abre tu web, el paso está hecho.

---

## Paso 1 · Git y GitHub (1 h)

**Qué es y por qué primero.** Git guarda una foto de tu proyecto cada vez que se
lo pides, y puedes volver a cualquier foto anterior. GitHub es donde se guardan
esas fotos en internet.

Esto va primero por una razón: en cuanto un agente empiece a editar tus ficheros,
necesitas poder deshacer. Sin git, un cambio malo se lleva por delante horas de
trabajo. **Es el hábito más importante que vas a coger.**

1. Instala Git: https://git-scm.com/downloads
2. Crea una cuenta en https://github.com
3. Instala GitHub Desktop: https://desktop.github.com — es git con botones, sin
   terminal. Para empezar, mucho mejor que la línea de comandos.
4. En GitHub Desktop: `File → Add Local Repository` → elige tu carpeta → te
   ofrecerá crear un repositorio, acepta.
5. Escribe un resumen ("primera versión") y pulsa **Commit**.
6. Pulsa **Publish repository**. Márcalo como **privado** de momento.

Hecho: tu proyecto está guardado en internet con historial.

**Costumbre a coger:** cada vez que algo funcione, vuelve aquí, escribe qué
cambiaste y haz commit. Antes de un cambio grande, commit. Es tu red de seguridad.

---

## Paso 2 · Vercel: tu web en internet (30 min)

Todavía no tocamos código. Vamos a poner lo que ya tienes online.

1. Entra en https://vercel.com y regístrate **con tu cuenta de GitHub**.
2. `Add New → Project` → elige tu repositorio `solbrute`.
3. No cambies nada de la configuración. Tu proyecto es HTML puro, sin
   compilación: Vercel lo sirve tal cual.
4. **Deploy.**

En un minuto tendrás una dirección tipo `solbrute.vercel.app`. Tu web, en
internet, funcionando, con la app en `/app.html`.

A partir de ahora, **cada commit que subas a GitHub se publica solo**. No hay más
que hacer.

Aprovecha y tacha dos pendientes: sustituye `REPLACE_WITH_YOUR_DOMAIN` en los
meta tags de `index.html` por tu dirección de Vercel, y sube una `og-image.png`
de 1200×630 a la carpeta.

---

## Paso 3 · Claude Code (1 h)

Ahora sí, la herramienta de trabajo.

1. Instálalo siguiendo https://code.claude.com/docs/en/overview
2. Abre la terminal **dentro de tu carpeta**. En Windows: clic derecho dentro de
   la carpeta → "Abrir en Terminal". En Mac: clic derecho → "Nuevo terminal en
   la carpeta".
3. Escribe `claude` y pulsa Enter.

Lee tu `CLAUDE.md` automáticamente. Pruébalo con algo pequeño y comprobable:

> ¿por qué la wallet va antes que devnet en el roadmap?

Si te contesta que el login no depende del contrato, lo ha leído bien.

**Cómo trabajar con él sin perderte:**

- Pídele **una cosa cada vez**. "Arregla el menú móvil" es buena petición;
  "mejora la web" no lo es.
- Cuando te enseñe un cambio, **léelo antes de aceptar**. Si no entiendes algo,
  pregúntale qué hace esa línea. Está para eso.
- Después de cada cambio que funcione: commit en GitHub Desktop.
- Si algo se rompe y no sabes por qué: vuelve al último commit bueno. Por eso
  hicimos el paso 1 primero.

**Primera tarea real sugerida**, pequeña y útil: quitar la barra de maqueta de
`app.html` y sacar el renderizador de retratos a un fichero `brute-render.js`
compartido entre `index.html` y `app.html`. Ahora está duplicado, y ya nos dio
un fallo por eso.

---

## Paso 4 · Supabase: la base de datos (una tarde)

Aquí es donde el juego deja de ser una maqueta. Léete `BACKEND.md` antes: tiene
el esquema SQL y los endpoints ya decididos.

1. Crea cuenta en https://supabase.com y un proyecto nuevo. Región: la más
   cercana a tus jugadores.
2. Abre el **SQL Editor** y pega las tablas de `BACKEND.md`. Ejecuta.
3. En `Settings → API` verás dos claves:
   - **anon / public** — esta puede ir en el navegador, no pasa nada.
   - **service_role** — esta **NUNCA** sale de tu servidor. Si acaba en GitHub,
     cualquiera controla tu base de datos entera.
4. Crea un fichero `.gitignore` en la carpeta con esta línea dentro:
   ```
   .env
   .env.local
   ```
   Eso evita que las claves se suban por accidente.

**El orden dentro de este paso** (está en `BACKEND.md`, lo repito porque importa):

1. Login con firma de wallet — sin esto nada de lo demás tiene sentido
2. Tablas `players` y `brutes`, y leer/crear brutos
3. Mover la simulación del combate al servidor
4. Historial de combates
5. Compra de plaza con token — al final del todo

---

## Paso 5 · Conectar la app a Supabase

Todo el acceso a datos de `app.html` está aislado a propósito en un objeto
llamado `STORE`, con tres funciones y un comentario que lo señala. Migrar es
reescribir esas tres para que hablen con Supabase.

Dile a Claude Code exactamente eso: que sustituya `STORE` por llamadas a Supabase
respetando el contrato de `BACKEND.md`, empezando por la autenticación.

---

## Lo que NO hacer todavía

- **Antigravity, Cursor y otros agentes.** Uno cada vez. Cuando domines Claude
  Code, prueba otros y compara con criterio.
- **Frameworks** (React, Next.js…). Tu proyecto es HTML puro y funciona. Migrar
  ahora es cambiar de problema, no resolverlo.
- **El contrato en Anchor.** Va después de saber si el juego engancha. Un
  contrato mal diseñado es mucho más caro de cambiar que una tabla.
- **El token.** Lo último. En serio.

---

## Cuánto cuesta

GitHub, Vercel y Supabase tienen nivel gratuito de sobra para un prototipo. Lo
único que se paga desde el principio es el uso de la herramienta de IA. No
necesitas tarjeta para los pasos 1 y 2.

---

## Si te atascas

Pega el error tal cual a Claude Code y dile qué estabas intentando hacer. Los
mensajes de error dan miedo pero suelen decir exactamente qué pasa. No los
ignores ni los rodees: entiéndelos, que es como se aprende esto.
