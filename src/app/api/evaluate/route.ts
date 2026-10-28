import { NextRequest, NextResponse } from 'next/server'
import { isAuthorized, unauthorized } from '@/lib/auth'
import { getSupabase } from '@/lib/supabase'
import { getOpenAI } from '@/lib/openai'
import { jsonError } from '@/lib/http'
import { REVIEW_DAYS, type Evaluation, type Sentence } from '@/lib/types'

export const runtime = 'nodejs'
const SYSTEM_PROMPT = `Eres un profesor nativo de francés experto en enseñar a hispanohablantes. Evalúa la traducción del usuario del español al francés. Sé flexible con sinónimos o registros válidos (formal/informal, 'tu' o 'vous') siempre que la gramática y la ortografía (incluyendo acentos y elisiones) sean correctas. Devuelve SIEMPRE un objeto JSON con esta estructura exacta:
- \`status\`: 'perfect' (sin ningún error), 'minor_errors' (la estructura es buena pero falta un acento, una letra menor o puntuación), o 'incorrect' (error gramatical, de conjugación, vocabulario erróneo o sentido alterado).
- \`score\`: número del 0 al 100.
- \`corrected_sentence\`: la frase del usuario corregida manteniendo sus palabras elegidas en la medida de lo posible.
- \`natural_alternative\`: cómo lo diría un francés nativo hoy en día de forma muy natural.
- \`grammar_explanation_es\`: explicación breve, didáctica y directa en español de los errores cometidos o de por qué está bien.`

type Input = {
  sentenceId?: unknown
  spanishText?: unknown
  referenceFrench?: unknown
  level?: unknown
  grammarTopic?: unknown
  userAnswer?: unknown
}
function validEvaluation(value: unknown): value is Evaluation {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return ['perfect', 'minor_errors', 'incorrect'].includes(String(v.status))
    && typeof v.score === 'number' && Number.isFinite(v.score) && v.score >= 0 && v.score <= 100
    && ['corrected_sentence', 'natural_alternative', 'grammar_explanation_es']
      .every(k => typeof v[k] === 'string' && (v[k] as string).trim().length > 0)
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized()
  const body = await request.json().catch(() => null) as Input | null
  if (!body || typeof body.sentenceId !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.sentenceId)
    || typeof body.userAnswer !== 'string'
    || body.userAnswer.trim().length < 1 || body.userAnswer.length > 1500) {
    return NextResponse.json({ error: 'Datos de traducción no válidos' }, { status: 400 })
  }
  try {
    const supabase = getSupabase()
    const { data: found, error: readError } = await supabase.from('sentences')
      .select('*').eq('id', body.sentenceId).single()
    if (readError || !found) return NextResponse.json({ error: 'Frase no encontrada' }, { status: 404 })
    const current = found as Sentence
    // The DB is authoritative; client-sent reference, level and Spanish may be stale.
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify({
          spanishText: current.spanish_text, referenceFrench: current.reference_french,
          level: current.level, grammarTopic: current.grammar_topic,
          userAnswer: body.userAnswer.trim()
        }) }
      ]
    })
    let evaluation: unknown
    try { evaluation = JSON.parse(response.choices[0]?.message.content ?? '{}') }
    catch { throw new Error('La IA devolvió un JSON malformado') }
    if (!validEvaluation(evaluation)) throw new Error('La IA devolvió una evaluación incompleta')
    const previousScore = current.mastery_score
    const newScore = evaluation.status === 'perfect' ? Math.min(previousScore + 1, 5)
      : evaluation.status === 'incorrect' ? Math.max(previousScore - 1, 0) : previousScore
    const interval = evaluation.status === 'perfect' ? REVIEW_DAYS[newScore] * 86_400_000
      : evaluation.status === 'minor_errors' ? 12 * 3_600_000 : 10 * 60_000
    const nextReview = new Date(Date.now() + interval).toISOString()
    const { data: updated, error: updateError } = await supabase.from('sentences')
      .update({
        mastery_score: newScore, times_practiced: current.times_practiced + 1,
        next_review_at: nextReview, last_feedback: evaluation.grammar_explanation_es
      })
      .eq('id', current.id).eq('times_practiced', current.times_practiced)
      .select('*').maybeSingle()
    if (updateError) throw updateError
    if (!updated) return NextResponse.json({
      error: 'Esta frase se ha actualizado en otro dispositivo. Actualiza y vuelve a intentarlo.'
    }, { status: 409 })
    return NextResponse.json({ ...evaluation, sentence: updated })
  } catch (error) { return jsonError(error) }
}
