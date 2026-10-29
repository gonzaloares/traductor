type Level = 'A1'|'A2'|'B1'|'B2'|'C1'|'C2'
type Question = { prompt: string; options: string[]; correct_index: number }
type Paper = {
  listening: { script: string; questions: Question[] };
  reading: { passage: string; questions: Question[] };
  writing_prompt: string; speaking_prompt: string
}
type Row = {
  id: string; level: Level; state: string; duration_minutes: number;
  paper: Paper; result: Record<string, unknown> | null;
  started_at: string; completed_at: string | null
}
type Database = (path: string, init?: RequestInit) => Promise<unknown>
type AI = (system: string, input: unknown, temperature: number, maxTokens?: number) => Promise<Record<string, unknown>>
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i
const generationPrompt = `Genera una prueba ORIGINAL y breve de francés para el nivel MCER indicado, inspirada en las cuatro competencias DELF/DALF. Devuelve únicamente un objeto JSON con este formato:
{"listening":{"script":"...","questions":[{"prompt":"...","options":["...","...","...","..."],"correct_index":0},{"prompt":"...","options":["...","...","...","..."],"correct_index":2}]},"reading":{"passage":"...","questions":[{"prompt":"...","options":["...","...","...","..."],"correct_index":1},{"prompt":"...","options":["...","...","...","..."],"correct_index":3}]},"writing_prompt":"...","speaking_prompt":"..."}.
Los textos script y passage son distintos, naturales y enteramente en francés: 60-130 palabras A1-B2, 110-190 C1-C2. El script será una conversación, anécdota o anuncio para escuchar, no las preguntas. Dos preguntas de comprensión diferentes para cada texto, escritas en francés, con cuatro respuestas plausibles y una única correcta; variar la posición correcta. Las consignas de escritura y habla son distintas, completas y están en francés, apropiadas al nivel: A1-A2 presentación y vida diaria, B1-B2 relato, opinión e hipótesis, C1-C2 síntesis y argumentación matizada. Los ejercicios deben poder completarse en 15 minutos (A1-B2) o 20 (C1-C2). No copies exámenes oficiales, no incluyas respuestas en los enunciados y evita ambigüedades.`
function validPaper(v: unknown): v is Paper {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false
  const p = v as Record<string, unknown>
  if (typeof p.writing_prompt !== 'string' || p.writing_prompt.length < 12 || p.writing_prompt.length > 700 ||
      typeof p.speaking_prompt !== 'string' || p.speaking_prompt.length < 12 || p.speaking_prompt.length > 700) return false
  for (const area of ['listening','reading'] as const) {
    const item = p[area] as Record<string, unknown> | undefined
    const paragraph = item?.[area === 'listening' ? 'script' : 'passage']
    if (!item || typeof paragraph !== 'string' || paragraph.length < 100 ||
        paragraph.length > 3000 || !Array.isArray(item.questions) || item.questions.length !== 2) return false
    for (const q of item.questions) {
      if (!q || typeof q.prompt !== 'string' || q.prompt.length < 5 || q.prompt.length > 500 ||
          !Array.isArray(q.options) || q.options.length !== 4 ||
          !q.options.every((text: unknown) => typeof text === 'string' && text.length >= 2 && text.length < 260) ||
          new Set(q.options.map((t: string) => t.trim().toLowerCase())).size !== 4 ||
          !Number.isInteger(q.correct_index) || q.correct_index < 0 || q.correct_index > 3) return false
    }
  }
  return true
}
function publicPaper(row: Row) {
  const questions = (items: Question[]) => items.map(q => ({ prompt: q.prompt, options: q.options }))
  return {
    id: row.id, level: row.level, started_at: row.started_at, duration_minutes: row.duration_minutes,
    listening: { script: row.paper.listening.script, questions: questions(row.paper.listening.questions) },
    reading: { passage: row.paper.reading.passage, questions: questions(row.paper.reading.questions) },
    writing_prompt: row.paper.writing_prompt, speaking_prompt: row.paper.speaking_prompt
  }
}
export function createMiniExams(db: Database, openAI: AI, apiKey: () => string) {
  async function start(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (!['A1','A2','B1','B2','C1','C2'].includes(String(body.level))) {
      return { error: 'Elige un nivel válido entre A1 y C2.', statusCode: 400 }
    }
    const level = body.level as Level
    const paper = await openAI(generationPrompt, { level }, 0.7, 3500)
    if (!validPaper(paper)) throw new Error('El examen generado no tiene un formato válido')
    const inserted = await db('mini_exams?select=*', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ level, duration_minutes: level === 'C1' || level === 'C2' ? 20 : 15, paper })
    })
    if (!Array.isArray(inserted) || inserted.length !== 1) throw new Error('No se ha podido guardar el examen')
    return { exam: publicPaper(inserted[0] as Row) }
  }
  async function history(): Promise<Record<string, unknown>> {
    const rows = await db('mini_exams?select=*&order=started_at.desc&limit=50')
    if (!Array.isArray(rows)) throw new Error('No se ha podido leer el historial')
    const exams = rows as Row[]
    return {
      active: exams.find(row => row.state === 'active') ? publicPaper(exams.find(row => row.state === 'active')!) : null,
      history: exams.filter(row => row.state === 'completed' && row.result).slice(0,30).map(row => row.result)
    }
  }
