// Edge API for static GitHub Pages frontend.
// No credentials or privileged database access are exposed to the browser.
// Deployment: Supabase Edge Functions, verify_jwt = false.
// Every data-changing/read route requires a signed session issued after PAROLE_PIN verification.

type Level = 'A1' | 'A2' | 'B1' | 'B2'
type Status = 'perfect' | 'minor_errors' | 'incorrect'
type Sentence = {
  id: string; spanish_text: string; reference_french: string; level: Level;
  grammar_topic: string; mastery_score: number; times_practiced: number;
  next_review_at: string; source: string; created_at: string; last_feedback: string | null
}
type Evaluation = {
  status: Status; score: number; corrected_sentence: string;
  natural_alternative: string; grammar_explanation_es: string
}
const SESSION_AGE_MS = 30 * 24 * 60 * 60 * 1000
const encoder = new TextEncoder()
const REVIEW_DAYS = [0, 1, 3, 7, 14, 30]
const EVALUATOR_PROMPT = "Eres un profesor nativo de francés experto en enseñar a hispanohablantes. Evalúa la traducción del usuario del español al francés. Sé flexible con sinónimos o registros válidos (formal/informal, 'tu' o 'vous') siempre que la gramática y la ortografía (incluyendo acentos y elisiones) sean correctas. Devuelve SIEMPRE un objeto JSON con esta estructura exacta:\n" +
  "- \`status\`: 'perfect' (sin ningún error), 'minor_errors' (la estructura es buena pero falta un acento, una letra menor o puntuación), o 'incorrect' (error gramatical, de conjugación, vocabulario erróneo o sentido alterado).\n" +
  "- \`score\`: número del 0 al 100.\n" +
  "- \`corrected_sentence\`: la frase del usuario corregida manteniendo sus palabras elegidas en la medida de lo posible.\n" +
  "- \`natural_alternative\`: cómo lo diría un francés nativo hoy en día de forma muy natural.\n" +
  "- \`grammar_explanation_es\`: explicación breve, didáctica y directa en español de los errores cometidos o de por qué está bien.\\n" +
  "Prioridad: la frase española completa determina el significado. Conserva expresamente personas, parentescos, lugares, objetos, cantidades y demás información en las dos versiones francesas. Por ejemplo, «a mi hermana» no se puede omitir sustituyéndolo solo por «lui» sin contexto. No dupliques complementos sin una construcción correcta. La traducción de referencia es orientativa y puede contener errores; admite otras traducciones fieles y correctas. Si no existe una reformulación verdaderamente más natural que conserve toda la información, natural_alternative debe coincidir con corrected_sentence. Adapta las explicaciones al nivel indicado, especialmente A1."

function allowedOrigin(origin: string | null): boolean {
  return !origin || origin === 'https://gonzaloares.github.io' ||
    /^http:\/\/localhost:(3000|3001|5173)$/.test(origin) ||
    /^http:\/\/127\.0\.0\.1:(3000|3001|5173)$/.test(origin)
}
function headers(request: Request): HeadersInit {
  const origin = request.headers.get('origin')
  return {
    ...(origin && allowedOrigin(origin) ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' } : {}),
    'Access-Control-Allow-Headers': 'content-type, apikey, x-parole-session',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  }
}
function reply(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: headers(req) })
}
function env(key: string): string {
  const value = Deno.env.get(key)
  if (!value) throw new Error('Falta secreto/configuración del servidor: ' + key)
  return value
}
function equals(a: string, b: string): boolean {
  const first = encoder.encode(a)
  const second = encoder.encode(b)
  let difference = first.length ^ second.length
  for (let i = 0; i < Math.max(first.length, second.length); i++) {
    difference |= (first[i] ?? 0) ^ (second[i] ?? 0)
  }
  return difference === 0
}
async function signingKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw', encoder.encode(env('SUPABASE_SERVICE_ROLE_KEY')),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
}
function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}
async function sign(payload: string): Promise<string> {
  const signature = await crypto.subtle.sign('HMAC', await signingKey(), encoder.encode('parole-session-v1:' + env('PAROLE_PIN') + ':' + payload))
  return base64url(new Uint8Array(signature))
}
async function issueSession(): Promise<string> {
  const expiry = String(Date.now() + SESSION_AGE_MS)
  const nonce = base64url(crypto.getRandomValues(new Uint8Array(16)))
  const payload = expiry + '.' + nonce
  return payload + '.' + await sign(payload)
}
async function validSession(token: string | null): Promise<boolean> {
  if (!token || token.length > 300) return false
  const pieces = token.split('.')
  if (pieces.length !== 3) return false
  const [expiry, nonce, mac] = pieces
  if (!/^\d{13}$/.test(expiry) || !/^[\w-]{20,40}$/.test(nonce) ||
      !/^[\w-]{43}$/.test(mac) || Number(expiry) <= Date.now() ||
      Number(expiry) > Date.now() + SESSION_AGE_MS) return false
  const expected = await sign(expiry + '.' + nonce)
  return equals(mac, expected)
}
async function requestJSON(request: Request): Promise<Record<string, unknown>> {
  const raw: unknown = await request.json().catch(() => null)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('El cuerpo JSON no es válido')
  }
  return raw as Record<string, unknown>
}
async function db(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(env('SUPABASE_URL') + '/rest/v1/' + path, {
    ...init,
    headers: {
      'apikey': env('SUPABASE_SERVICE_ROLE_KEY'),
      'Authorization': 'Bearer ' + env('SUPABASE_SERVICE_ROLE_KEY'),
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    }
  })
  const json: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    console.error('Database request failed', response.status, json)
    throw new Error('No se pudo acceder a la base de datos')
  }
  return json
}
async function openAI(system: string, input: unknown, temperature: number): Promise<Record<string, unknown>> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + env('OPENAI_API_KEY'),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify(input) }
      ]
    })
  })
  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const errorInfo = data && typeof data === 'object' && 'error' in data &&
      (data as { error: unknown }).error && typeof (data as { error: unknown }).error === 'object'
      ? (data as { error: Record<string, unknown> }).error : {}
    const errorCode = typeof errorInfo.code === 'string' ? errorInfo.code : ''
    const errorType = typeof errorInfo.type === 'string' ? errorInfo.type : ''
    // Avoid logging the API key, user's answer or the raw third-party response.
    console.error('OpenAI request failed:', response.status, errorCode, errorType)

    if (response.status === 429) {
      const quotaCodes = [
        'insufficient_quota', 'credit_balance_exhausted',
        'organization_usage_limit_exceeded', 'organization_spend_limit_exceeded',
        'project_spend_limit_exceeded', 'billing_hard_limit_reached'
      ]
      if (quotaCodes.includes(errorCode) || quotaCodes.includes(errorType)) {
        throw new Error('Sin saldo o límite de gasto alcanzado en OpenAI API. Revisa la facturación y los límites de tu proyecto en platform.openai.com.')
      }
      throw new Error('OpenAI ha limitado temporalmente las solicitudes (429). Vuelve a intentarlo después de unos minutos y revisa los límites de tu proyecto API.')
    }
    if (response.status === 401) {
      throw new Error('La clave OPENAI_API_KEY no es válida o ha caducado. Revisa los secretos de Supabase.')
    }
    if (response.status === 403) {
      throw new Error('El proyecto de OpenAI no tiene permiso para utilizar el modelo. Revisa su configuración.')
    }
    throw new Error('OpenAI ha rechazado la solicitud (' + response.status + '). Revisa el estado de tu cuenta API.')
  }
  const raw = data && typeof data === 'object' && 'choices' in data
    ? (data as { choices?: { message?: { content?: string | null } }[] }).choices?.[0]?.message?.content
    : null
  if (!raw) throw new Error('La IA no ha devuelto contenido')
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { throw new Error('La IA ha devuelto JSON inválido') }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Respuesta de IA inválida')
  }
  return parsed as Record<string, unknown>
}
function validEvaluation(value: Record<string, unknown>): value is Record<string, unknown> & Evaluation {
  return ['perfect', 'minor_errors', 'incorrect'].includes(String(value.status)) &&
    typeof value.score === 'number' && Number.isFinite(value.score) &&
    value.score >= 0 && value.score <= 100 &&
    ['corrected_sentence', 'natural_alternative', 'grammar_explanation_es']
      .every(k => typeof value[k] === 'string' && (value[k] as string).trim().length > 0 &&
        (value[k] as string).length <= 4000)
}
function validDraft(value: unknown): value is {
  spanish_text: string; reference_french: string; grammar_topic: string
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return ['spanish_text', 'reference_french', 'grammar_topic'].every(k =>
    typeof record[k] === 'string' && (record[k] as string).trim().length > 0 &&
    (record[k] as string).length <= 500)
}
async function getSentences(): Promise<Sentence[]> {
  const all: Sentence[] = []
  for (let start = 0; start < 100000; start += 500) {
    const result = await db('sentences?select=*&order=created_at.asc,id.asc&limit=500&offset=' + start)
    if (!Array.isArray(result)) throw new Error('Formato de datos no válido')
    all.push(...(result as Sentence[]))
    if (result.length < 500) break
  }
  return all
}
async function evaluate(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (typeof body.sentenceId !== 'string' ||
      !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(body.sentenceId) ||
      typeof body.userAnswer !== 'string' || body.userAnswer.trim().length === 0 ||
      body.userAnswer.length > 1500) {
    return { error: 'Datos de traducción no válidos', statusCode: 400 }
  }
  const matches = await db('sentences?select=*&id=eq.' + encodeURIComponent(body.sentenceId) + '&limit=1')
  if (!Array.isArray(matches) || matches.length === 0) {
    return { error: 'Frase no encontrada', statusCode: 404 }
  }
  const current = matches[0] as Sentence
  // The database is authoritative; ignore client-side reference texts.
  const evaluation = await openAI(EVALUATOR_PROMPT, {
    spanishText: current.spanish_text,
    referenceFrench: current.reference_french,
    level: current.level,
    grammarTopic: current.grammar_topic,
    userAnswer: body.userAnswer.trim()
  }, 0.2)
  if (!validEvaluation(evaluation)) throw new Error('La IA ha devuelto una evaluación incompleta')
  const score = evaluation.status === 'perfect' ? Math.min(current.mastery_score + 1, 5)
    : evaluation.status === 'incorrect' ? Math.max(current.mastery_score - 1, 0)
      : current.mastery_score
  const delay = evaluation.status === 'perfect' ? REVIEW_DAYS[score] * 86_400_000
    : evaluation.status === 'minor_errors' ? 12 * 3_600_000 : 10 * 60_000
  const next = new Date(Date.now() + delay).toISOString()
  const update = await db('sentences?id=eq.' + encodeURIComponent(current.id) +
    '&times_practiced=eq.' + current.times_practiced + '&select=*', {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      mastery_score: score,
      next_review_at: next,
      times_practiced: current.times_practiced + 1,
      last_feedback: evaluation.grammar_explanation_es
    })
  })
  if (!Array.isArray(update) || update.length !== 1) {
    return { error: 'La frase ha cambiado en otro dispositivo. Actualiza los datos.', statusCode: 409 }
  }
  return { ...evaluation, sentence: update[0] }
}
async function generateBatch(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!['A1','A2','B1','B2'].includes(String(body.level)) ||
    typeof body.topic !== 'string' || body.topic.trim().length < 2 || body.topic.length > 100 ||
    typeof body.count !== 'number' || !Number.isInteger(body.count) ||
    body.count < 1 || body.count > 10) {
    return { error: 'Selecciona nivel, tema y entre 1 y 10 frases', statusCode: 400 }
  }
  const response = await openAI(
    'Eres un profesor de francés que diseña ejercicios de traducción activa del español al francés para hispanohablantes. Devuelve SOLO un objeto JSON con una propiedad "sentences" que sea un array. Cada elemento tendrá exactamente "spanish_text" (español natural), "reference_french" (traducción francesa impecable con acentos), "grammar_topic" (tema gramatical concreto). Las frases deben ser variadas, idiomáticas, no ambiguas, adecuadas al nivel solicitado, gramaticalmente correctas y didácticamente desafiantes. Para nivel A1, emplea frases cortas y concretas con vocabulario cotidiano, presente de indicativo, ser/estar/tener, artículos, plural, género, preguntas sencillas, negación y futuro próximo; evita subjuntivo, relativos complejos, oraciones largas y dobles negaciones. Conserva todos los detalles del español en la referencia francesa, sin omitir nombres de personas, parentescos, lugares, objetos, cantidades ni matices. No uses explicaciones ni Markdown. No repitas frases.',
    { level: body.level, topic: body.topic.trim(), count: body.count,
      instruction: 'Crea exactamente ' + body.count + ' frases nuevas para este tema.' }, 0.8)
  const drafts = response.sentences
  if (!Array.isArray(drafts) || drafts.length !== body.count || !drafts.every(validDraft)) {
    throw new Error('La IA no devolvió el número de frases solicitado')
  }
  const unique = new Map<string, typeof drafts[number]>()
  for (const item of drafts) {
    unique.set(item.spanish_text.trim().toLocaleLowerCase('es'), item)
  }
  if (unique.size !== body.count) throw new Error('La IA ha generado frases repetidas')
  const rows = [...unique.values()].map(item => ({
    spanish_text: item.spanish_text.trim(), reference_french: item.reference_french.trim(),
    grammar_topic: item.grammar_topic.trim(), level: body.level, source: 'ai_generated'
  }))
  const inserted = await db('sentences?on_conflict=level,spanish_text&select=*', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify(rows)
  })
  if (!Array.isArray(inserted)) throw new Error('Formato de inserción no válido')
  return { sentences: inserted, insertedCount: inserted.length }
}
Deno.serve(async (request: Request): Promise<Response> => {
  if (!allowedOrigin(request.headers.get('origin'))) {
    return reply(request, { error: 'Origen no permitido' }, 403)
  }
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers(request) })
  const action = new URL(request.url).searchParams.get('action')
  if (!['auth', 'sentences', 'evaluate', 'generate-batch'].includes(action ?? '')) {
    return reply(request, { error: 'Ruta no encontrada' }, 404)
  }
  try {
    const pin = env('PAROLE_PIN')
    if (pin.length < 8) {
      return reply(request, { error: 'Configura PAROLE_PIN con al menos 8 caracteres en Supabase Edge Functions > Secrets.' }, 503)
    }
    if (action === 'auth' && request.method === 'GET') {
      return reply(request, {
        required: true,
        authorized: await validSession(request.headers.get('x-parole-session'))
      })
    }
    if (action === 'auth' && request.method === 'POST') {
      const body = await requestJSON(request)
      if (typeof body.pin !== 'string' || body.pin.length > 200 || !equals(pin, body.pin)) {
        return reply(request, { error: 'PIN incorrecto' }, 401)
      }
      return reply(request, { authorized: true, session: await issueSession() })
    }
    if (!(await validSession(request.headers.get('x-parole-session')))) {
      return reply(request, { error: 'Sesión caducada. Introduce de nuevo el PIN.' }, 401)
    }
    if (action === 'sentences' && request.method === 'GET') {
      return reply(request, { sentences: await getSentences() })
    }
    if (action === 'evaluate' && request.method === 'POST') {
      const result = await evaluate(await requestJSON(request))
      return reply(request, result, typeof result.statusCode === 'number' ? result.statusCode : 200)
    }
    if (action === 'generate-batch' && request.method === 'POST') {
      const result = await generateBatch(await requestJSON(request))
      return reply(request, result, typeof result.statusCode === 'number' ? result.statusCode : 200)
    }
    return reply(request, { error: 'Método no permitido' }, 405)
  } catch (error) {
    console.error('Parole Edge Function error:', error instanceof Error ? error.message : 'unknown')
    const message = error instanceof Error ? error.message : ''
    const isOpenAIIssue = /^(Sin saldo o límite de gasto|OpenAI ha limitado temporalmente|La clave OPENAI_API_KEY|El proyecto de OpenAI|OpenAI ha rechazado)/.test(message)
    const publicMessage = isOpenAIIssue ? message
      : /Falta secreto/.test(message)
      ? 'Falta una variable privada en Supabase Edge Functions > Secrets.'
      : 'No se ha podido completar la operación. Comprueba la configuración del servidor.'
    return reply(request, { error: publicMessage }, isOpenAIIssue ? 502 : 500)
  }
})
