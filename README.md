# RecellFix Chat

Panel de chat tipo WhatsApp Web para supervisar a "Alex" (el agente de IA de RecellFix).
Se conecta directo a tu proyecto de Supabase existente (mismas tablas `conversaciones` y
`mensajes` que usa tu flujo de n8n) vía Supabase Realtime. No modifica ni toca el workflow
de n8n.

## Por qué no vive como Claude Artifact

Las páginas publicadas como Artifact de Claude corren en un entorno restringido que
bloquea peticiones de red hacia sitios externos (como tu Supabase). Por eso necesitas
hospedarlo tú mismo, en un hosting normal como Vercel — ahí no hay esa restricción.

## Desplegar en Vercel (recomendado, gratis)

**Opción rápida — sin GitHub, arrastrando la carpeta:**

1. Ve a [vercel.com](https://vercel.com) y crea una cuenta (puedes usar tu correo o GitHub).
2. Abre esta carpeta en tu computadora y corre:
   ```
   npm install
   npm install -g vercel
   vercel
   ```
3. Sigue las preguntas en pantalla (acepta los valores por defecto: es un proyecto Vite).
4. Al terminar te da un link `https://recellfix-chat-xxxx.vercel.app` ya funcionando.
5. Para actualizaciones futuras, repite `vercel --prod` desde la misma carpeta.

**Opción con GitHub (mejor a futuro, deploy automático con cada cambio):**

1. Crea un repositorio nuevo en tu GitHub (por ejemplo `recellfix-chat`).
2. Desde esta carpeta:
   ```
   git init
   git add .
   git commit -m "Primera versión del panel de chat"
   git remote add origin https://github.com/TU_USUARIO/recellfix-chat.git
   git push -u origin main
   ```
3. En [vercel.com/new](https://vercel.com/new) elige "Import Git Repository", selecciona
   ese repo, y dale "Deploy" (Vercel detecta Vite automáticamente, no necesitas configurar
   nada).
4. Cada vez que hagas `git push`, Vercel actualiza el sitio solo.

## Primer uso de la app (una vez desplegada)

1. Abre el link del sitio.
2. Pantalla de configuración: pon la **URL** y **anon key** de tu proyecto Supabase
   (Project Settings → API en el dashboard de Supabase). Se guardan solo en tu navegador
   (localStorage), nunca se envían a ningún servidor propio.
3. Pantalla de login: usa un usuario de **Authentication → Users** de ese mismo proyecto
   Supabase (créalo ahí si no tienes uno, marcando "Auto Confirm User").
4. Ya dentro verás las conversaciones en tiempo real, podrás enviar mensajes, y alternar
   modo bot/humano con el botón junto al nombre del cliente.

### Nota sobre enviar mensajes como humano

Al mandar un mensaje desde el panel, se guarda en la tabla `mensajes` de Supabase, pero
**no se reenvía automáticamente a WhatsApp** a menos que configures un webhook de n8n para
eso (ícono ⚙ arriba del chat). Si no tienes ese webhook creado todavía, el mensaje queda
guardado pero el cliente no lo recibe por WhatsApp — es el siguiente paso a construir en
n8n.

## Desarrollo local

```
npm install
npm run dev
```
