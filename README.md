# Parole — traducción activa español → francés

Aplicación **Next.js App Router + TypeScript + Tailwind CSS** para practicar francés mediante traducción activa, con **corrección OpenAI**, audio en francés y **repetición espaciada (SRS)** en Supabase. Niveles A2, B1 y B2.

## Qué incluye

- 30 frases iniciales de nivel A2 / B1 / B2 (10 por nivel), con énfasis en dificultades típicas de hispanohablantes.
- Elección automática de la siguiente frase **vencida**, priorizando las de dominio más bajo; práctica anticipada opcional.
- Traducción escrita, caracteres franceses especiales, atajo Ctrl/⌘ + Enter, evaluación y corrección.
- Feedback con puntuación, alternativa natural, explicación gramatical y pronunciación por `speechSynthesis`.
- Banco de frases, búsqueda, filtros por nivel, estadísticas y fecha del próximo repaso.
- Generación por IA de nuevas frases (nivel, tema y cantidad). Sincronización con una base de datos común.
- PIN opcional y sesión firmada mediante cookie HttpOnly.

## Arranque local

Requisitos: Node.js **20.9 o superior**, npm y un proyecto de **Supabase separado** de cualquier aplicación existente.

1. Clona el repositorio: `git clone https://github.com/gonzaloares/traductor.git` y entra en la carpeta.
2. Instala las dependencias: `npm install`.
3. Crea `.env.local` a partir de `.env.example`.
4. En **Supabase → SQL Editor**, ejecuta el archivo completo `supabase/schema.sql`. Si se vuelve a ejecutar, las 30 frases semilla no se duplican.
5. Rellena en `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`: URL de **tu nuevo proyecto** Supabase.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: clave pública / publishable del proyecto.
   - `OPENAI_API_KEY`: clave privada de OpenAI (solo servidor).
   - `APP_PIN`: opcional, **recomendado** para proteger los endpoints con un PIN solo del servidor.
   - `NEXT_PUBLIC_APP_PIN`: opción compatible con el requisito; menos recomendable que `APP_PIN` porque las variables públicas no se deben considerar secretas. Si hay ambas, prevalece `APP_PIN`.
6. Inicia `npm run dev` y abre http://localhost:3000.

Verificación: `npm run typecheck` y `npm run build`. La acción de GitHub `Build and typecheck` también ejecuta estas comprobaciones en cada push.

## SRS

| Evaluación | Dominio | Próximo repaso |
| --- | --- | --- |
| `perfect` | +1 (máximo 5) | 1, 3, 7, 14 o 30 días según dominio resultante |
| `minor_errors` | se mantiene | 12 horas |
| `incorrect` | −1 (mínimo 0) | 10 minutos |

Cada evaluación incrementa los intentos y conserva la explicación. El backend utiliza un control de concurrencia sencillo para evitar que dos dispositivos reescriban el mismo intento silenciosamente.

## API

- `GET /api/sentences` — lista completa para la interfaz y el banco.
- `POST /api/evaluate` — corrige con `gpt-4o-mini`, actualiza el SRS y devuelve el resultado.
- `POST /api/generate-batch` — genera hasta 10 frases por solicitud y las guarda.
- `GET /api/auth` / `POST /api/auth` — estado de sesión y validación del PIN.

Las peticiones a OpenAI se hacen **únicamente en el servidor** y usan `response_format: { type: 'json_object' }`.

## Despliegue en Vercel

Importa este repositorio en Vercel como proyecto Next.js, añade allí las mismas variables de entorno y despliega. Aplica el SQL en Supabase **antes** de usar la app. No compartas `.env.local` ni subas claves privadas a GitHub. El sitio no estará plenamente operativo hasta configurar las variables y ejecutar el SQL.

### Advertencia sobre seguridad

Por petición expresa, `supabase/schema.sql` activa **RLS totalmente abierto** para `anon` y `authenticated` (`USING (true) WITH CHECK (true)`). **Esto no es un aislamiento seguro de datos.** Si alguien obtiene la URL y clave pública de Supabase, puede leer, modificar o borrar las frases saltándose incluso el PIN del sitio.

El PIN firmado protege los endpoints de Next.js contra el acceso casual, **pero no remedia una base con políticas abiertas**. Para un proyecto verdaderamente privado, reemplaza esas políticas por autenticación/autorización de Supabase o usa un backend privado con RLS restrictivo. El PIN guardado en `localStorage`, como se solicitó, también puede leerse desde scripts del mismo origen; usa un PIN exclusivo para esta app, nunca una contraseña reutilizada.

## Estado

Código fuente creado en el repositorio. El resultado de `npm run build` debe confirmarse mediante GitHub Actions o después de instalar las dependencias; sin claves de entorno de Supabase y OpenAI no es posible realizar pruebas extremo a extremo.
