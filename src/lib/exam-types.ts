import type { Level, Language } from './types'

export type ExamMode = 'quick' | 'extended'
export type ExamQuestion = { prompt: string; options: string[] }
export type ExamScores = { listening: number; reading: number; writing: number; speaking: number; total: number }
export type ExamPaper = {
  id: string
  level: Level
  language: Language
  mode?: ExamMode // Older exam attempts were all quick.
  started_at: string
  duration_minutes: number
  listening: { script: string; questions: ExamQuestion[] }
  reading: { passage: string; questions: ExamQuestion[] }
  writing_prompt: string
  speaking_prompt: string
}
export type ExamAnswers = {
  listening: number[]
  reading: number[]
  writing: string
  speaking: string
  speaking_mode: 'audio' | 'skipped'
}
export type ExamResult = {
  id: string
  level: Level
  language: Language
  mode?: ExamMode
  started_at: string
  completed_at: string
  duration_minutes: number
  elapsed_seconds: number
  scores: ExamScores
  correct: { listening: number; reading: number }
  feedback: { writing: string; speaking: string; summary: string }
  answer_key: { listening: number[]; reading: number[] }
  answers: Omit<ExamAnswers, 'speaking_mode'>
  note: string
}
export type ExamHistoryResponse = { active: ExamPaper | null; history: ExamResult[] }

export const examParts = [
  { key: 'listening', title: 'Comprensión oral', time: '3 min' },
  { key: 'reading', title: 'Comprensión escrita', time: '3 min' },
  { key: 'writing', title: 'Producción escrita', time: '5 min' },
  { key: 'speaking', title: 'Producción oral', time: '4–9 min' }
] as const

export function examDuration(level: Level, mode: ExamMode): number {
  return mode === 'extended'
    ? (level === 'C1' || level === 'C2' ? 45 : 35)
    : (level === 'C1' || level === 'C2' ? 20 : 15)
}

export function emptyExamAnswers(questionCount = 2): ExamAnswers {
  return {
    listening: Array(questionCount).fill(-1),
    reading: Array(questionCount).fill(-1),
    writing: '', speaking: '', speaking_mode: 'skipped'
  }
}

export function examMinutes(seconds: number): string {
  return Math.floor(seconds / 60) + ':' + String(Math.max(0, seconds % 60)).padStart(2,'0')
}

export type ExamAssessment = {
  passed: boolean
  status: 'Aprobado' | 'No superado'
  criterion: string
  failures: string[]
  officialInspired: boolean
}

/**
 * DELF A1–B2 / DALF C1: >=50/100 and >=5/25 in each of four papers.
 * DALF C2: >=50/100 and >=10/50 in each combined oral and written paper.
 * English: Parole internal 60/100 threshold; NOT a Cambridge English Scale conversion.
 * Historic results are classified with the same rules, without modifying stored marks.
 */
export function assessExam(result: Pick<ExamResult, 'level' | 'language' | 'scores'>): ExamAssessment {
  const { level, language, scores } = result
  const failures: string[] = []
  if (language === 'fr') {
    if (scores.total < 50) failures.push('Nota global inferior a 50/100')
    if (level === 'C2') {
      const oral = scores.listening + scores.speaking
      const written = scores.reading + scores.writing
      if (oral < 10) failures.push('Prueba oral conjunta: ' + oral + '/50 (mínimo 10)')
      if (written < 10) failures.push('Prueba escrita conjunta: ' + written + '/50 (mínimo 10)')
    } else {
      const parts = [
        ['Comprensión oral', scores.listening],
        ['Comprensión escrita', scores.reading],
        ['Producción escrita', scores.writing],
        ['Producción oral', scores.speaking]
      ] as const
      for (const [label, score] of parts)
        if (score < 5) failures.push(label + ': ' + score + '/25 (mínimo 5)')
    }
    return {
      passed: failures.length === 0, status: failures.length === 0 ? 'Aprobado' : 'No superado',
      criterion: level === 'C2'
        ? 'Referencia DALF C2: ≥50/100 y ≥10/50 en las pruebas orales y escritas combinadas.'
        : 'Referencia DELF/DALF: ≥50/100 y ≥5/25 en cada competencia.',
      failures, officialInspired: true
    }
  }
  if (scores.total < 60) failures.push('Nota global inferior a 60/100')
  return {
    passed: failures.length === 0, status: failures.length === 0 ? 'Aprobado' : 'No superado',
    criterion: 'Criterio interno Parole: ≥60/100, sin mínimo por competencia. No equivale a la Cambridge English Scale' +
      (level === 'A1' ? '; Cambridge A1 Movers no emplea aprobado/suspenso.' : '.') ,
    failures, officialInspired: false
  }
}
