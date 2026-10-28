import { NextRequest, NextResponse } from 'next/server'
import { isAuthorized, unauthorized } from '@/lib/auth'
import { getSupabase } from '@/lib/supabase'
import { getOpenAI } from '@/lib/openai'
import { jsonError } from '@/lib/http'
import { isLevel } from '@/lib/types'

export const runtime = 'nodejs'
type Input = { level?: unknown; topic?: unknown; count?: unknown }
type Draft = { spanish_text: string; reference_french: string; grammar_topic: string }
function isDraft(value: unknown): value is Draft {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return ['spanish_text', 'reference_french', 'grammar_topic']
    .every(k => typeof v[k] === 'string' && (v[k] as string).trim().length > 0 && (v[k] as string).length <= 500)
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized()
  const body = await request.json().catch(() => null) as Input | null
  if (!body || !isLevel(body.level) || typeof body.topic !== 'string'
    || body.topic.trim().length < 2 || body.topic.length > 100
    || typeof body.count !== 'number' || !Number.isInteger(body.count)
    || body.count < 1 || body.count > 10) {
    return NextResponse.json({ error: 'Selecciona nivel, tema y entre 1 y 10 frases' }, { status: 400 })
  }
  try {
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.8,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Eres un profesor de francés que diseña ejercicios de traducción activa del español al francés para hispanohablantes. Devuelve SOLO un objeto JSON con una propiedad "sentences" que sea un array. Cada elemento tendrá exactamente "spanish_text" (español natural), "reference_french" (traducción francesa impecable con acentos), "grammar_topic" (tema gramatical concreto). Las frases deben ser variadas, idiomáticas, no ambiguas, adecuadas al nivel solicitado, gramaticalmente correctas y didácticamente desafiantes. No uses explicaciones ni Markdown. No repitas frases.'
        },
        {
          role: 'user',
          content: JSON.stringify({ level: body.level, topic: body.topic.trim(), count: body.count,
            instruction: 'Crea exactamente ' + body.count + ' frases nuevas en español con solución francesa para este tema. Incluye giros difíciles para hispanohablantes.' })
        }
      ]
    })
    let parsed: unknown
    try { parsed = JSON.parse(response.choices[0]?.message.content ?? '{}') }
    catch { throw new Error('La IA devolvió un JSON malformado') }
    const drafts = parsed && typeof parsed === 'object' && 'sentences' in parsed
      ? (parsed as { sentences: unknown }).sentences : null
    if (!Array.isArray(drafts) || drafts.length !== body.count || !drafts.every(isDraft)) {
      throw new Error('La IA no devolvió el número de frases solicitado')
    }
    const unique = new Map<string, Draft>()
    drafts.forEach(draft => unique.set(draft.spanish_text.trim().toLocaleLowerCase('es'), draft))
    if (unique.size !== body.count) throw new Error('La IA repitió frases; inténtalo de nuevo')
    const rows = [...unique.values()].map(d => ({
      spanish_text: d.spanish_text.trim(), reference_french: d.reference_french.trim(),
      grammar_topic: d.grammar_topic.trim(), level: body.level, source: 'ai_generated' as const
    }))
    const { data, error } = await getSupabase().from('sentences')
      .upsert(rows, { onConflict: 'level,spanish_text', ignoreDuplicates: true }).select('*')
    if (error) throw error
    return NextResponse.json({ sentences: data ?? [], insertedCount: data?.length ?? 0 })
  } catch (error) { return jsonError(error) }
}
