# Parole — francés activo en GitHub Pages

**Parole** es una aplicación de traducción activa español → francés para los seis niveles del MCER (A1, A2, B1, B2, C1 y C2). Sus datos se sincronizan en Supabase mediante un algoritmo de repetición espaciada (SRS). La corrección de las respuestas y la generación de nuevas frases se realizan con **OpenAI `gpt-4o-mini`**.

## Instalar Parole como aplicación (PWA)

Parole está preparada como una **PWA** instalable en Android, iPhone/iPad y escritorio, servida directamente desde GitHub Pages en `https://gonzaloares.github.io/traductor/`.

- **Android (Chrome):** abre la página, pulsa el menú de tres puntos y selecciona **Instalar aplicación** o **Añadir a pantalla de inicio**.
- **iPhone/iPad (Safari):** abre la página, pulsa **Compartir** y selecciona **Añadir a pantalla de inicio** y confirma la opción de abrir como aplicación si aparece.
- **Ordenador (Chrome/Edge):** abre Parole y utiliza la opción **Instalar** del menú o del navegador.

El icono abre Parole en una ventana independiente, sin barra de navegación. No se necesita publicar en tiendas ni cambiar de hosting. El manifiesto y el service worker usan la ruta de GitHub Pages `/traductor/`.

### Comportamiento sin conexión y privacidad

El service worker guarda únicamente archivos públicos de la interfaz (HTML, scripts, estilos e iconos), versionados por despliegue. La aplicación podrá abrir su interfaz sin conexión una vez se haya cargado y almacenado correctamente, pero el **inicio de sesión, banco de frases, correcciones con IA, generación y sincronización necesitan Internet**. No se guardan respuestas de Supabase, fichas personales ni resultados de OpenAI en la caché del service worker. Las sesiones siguen gestionándose en el navegador como antes; el PIN no se almacena.

Para crear los iconos (PNG 192/512, variante maskable y Apple 180), el build ejecuta `node scripts/generate-pwa-icons.mjs` sin dependencias adicionales. Tras `next build`, `scripts/finalize-pwa.mjs` genera una caché de recursos inmutables con el identificador de compilación y valida la salida estática. El navegador comprueba las actualizaciones del service worker al abrir la aplicación.

---

## Dónde se ejecuta

- **Interfaz web:** [GitHub Pages](https://gonzaloares.github.io/traductor/), desplegada desde `main` usando `.github/workflows/pages.yml` (exportación estática Next.js).
- **Servidor:** función [Supabase Edge `parole-api`](https://supabase.com/dashboard/project/wymmmzraxwjgcwivmbse/functions) que comprueba un PIN, emite una sesión firmada y llama a OpenAI.
- **Base de datos:** tabla `public.sentences` de Supabase, protegida contra el acceso directo con claves públicas. **No** se usa Vercel ni un servidor Next.js.

La URL GitHub Pages solo funcionará tras activar el alojamiento en la configuración del repositorio (apartado siguiente). Una compilación aprobada no significa por sí sola que la página esté publicada.

## Activación: dos pasos manuales

**1. Define los secretos privados en Supabase**

Abre [Edge Functions → Secrets](https://supabase.com/dashboard/project/wymmmzraxwjgcwivmbse/functions/secrets) y crea:

| Nombre | Valor |
|---|---|
| `PAROLE_PIN` | Tu **PIN exclusivo de al menos 8 caracteres** (recomendable una frase larga y difícil de adivinar) |
| `OPENAI_API_KEY` | Tu clave privada para la API de OpenAI |

No guardes ninguno de estos secretos en GitHub ni en archivos del repositorio. Supabase proporciona automáticamente `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` a las Edge Functions.

**2. Activa GitHub Pages**

En [Settings → Pages](https://github.com/gonzaloares/traductor/settings/pages), selecciona **Source: GitHub Actions**. El workflow `Publish Parole to GitHub Pages` compila el sitio con Node 22, comprueba los tipos, genera el directorio `out/` y lo publica. Una vez terminada la acción, abre:

**https://gonzaloares.github.io/traductor/**

Si no se despliega automáticamente, ejecuta `Publish Parole to GitHub Pages` mediante **Actions → Run workflow**, o realiza un nuevo commit en `main`.

La URL y la clave **publicable** de Supabase están incluidas en el workflow de GitHub Pages. No se incluye la clave privada de OpenAI, la clave service-role ni el PIN.

## Ejecución local

```bash
git clone https://github.com/gonzaloares/traductor.git
cd traductor
npm ci
cp .env.example .env.local
# Completa NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local
npm run dev
```

Accede a **http://localhost:3000/traductor/** (en local también usa el backend Supabase remoto).

- `npm run typecheck`: verificación TypeScript.
- `npm run build`: genera el sitio estático en `out/`.
- `supabase/schema.sql`: esquema SQL seguro, incluye 30 frases iniciales y es idempotente.
- `supabase/functions/parole-api/index.ts`: backend de corrección, generación, consulta y autenticación.
- `supabase/config.toml`: configuración de la función (`verify_jwt = false`; toda llamada a datos se protege mediante una **sesión firmada**).
- `.github/workflows/pages.yml`: publicación estática automática.

## Datos, evaluación y SRS

El banco inicial incluye 96 frases: 30 de A1, 10 de A2, 10 de B1, 10 de B2, 18 de C1 y 18 de C2. Puedes generar más frases según nivel y tema, consultar los repasos pendientes, escuchar el francés y revisar las explicaciones.

| Resultado | Dominio | Intervalo |
|---|---|---|
| `perfect` | +1 (hasta 5) | 1, 3, 7, 14 o 30 días |
| `minor_errors` | Sin cambio | 12 horas |
| `incorrect` | −1 (hasta 0) | 10 minutos |

Las acciones de lectura, corrección y generación necesitan un token temporal firmado por el servidor, almacenado en el navegador; **el PIN no se almacena en localStorage**. La sesión dura un máximo de 30 días.

La clave OpenAI se usa exclusivamente en Supabase Edge Functions, no en GitHub Pages. El coste de OpenAI es independiente de los límites gratuitos de Supabase.

## Seguridad

La base **ya tiene revocados** los permisos de lectura/escritura para roles públicos `anon` y `authenticated`, y no contiene políticas RLS abiertas. Solo la función Edge utiliza `SUPABASE_SERVICE_ROLE_KEY` en el servidor, después de comprobar la sesión firmada. No coloques nunca esa clave en la web estática.

El PIN es una protección de uso personal, no un sistema completo de gestión de identidades. Escoge una clave larga y no reutilizada: los intentos fallidos no disponen actualmente de bloqueo distribuido. Si necesitas protección robusta frente a ataques automatizados, usa autenticación de Supabase con un usuario real y añade limitación de peticiones.

## Desplegar actualizaciones de la Edge Function

Los cambios del código en `supabase/functions/parole-api/index.ts` **no** se despliegan automáticamente con GitHub Pages. Se publican con la CLI de Supabase o desde la integración de Supabase:

```bash
supabase login
supabase functions deploy parole-api --project-ref wymmmzraxwjgcwivmbse --no-verify-jwt
```

La versión inicial de la Edge Function se ha desplegado por separado desde esta configuración.

## Problemas habituales

- **«Falta PAROLE_PIN» o error 503:** crea el secreto en Supabase; por seguridad el servidor no permite operar sin él.
- **La corrección falla:** verifica `OPENAI_API_KEY` en Supabase y que tu cuenta tenga saldo API disponible.
- **Página 404:** verifica que GitHub Pages esté configurado con **GitHub Actions** y comprueba el workflow.
- **El banco aparece vacío:** comprueba la sesión PIN y la tabla `sentences` de Supabase.
- **Acceso caducado:** vuelve a introducir el PIN en el dispositivo.
