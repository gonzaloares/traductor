import type { Level, Language } from './types'

export type ExamQuestion = { prompt: string; options: string[] }
export type ExamPaper = {
  id: string
  level: Level
  language: Language
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
  started_at: string
  completed_at: string
  duration_minutes: number
  elapsed_seconds: number
  scores: { listening: number; reading: number; writing: number; speaking: number; total: number }
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
export function emptyExamAnswers(): ExamAnswers {
  return { listening: [-1,-1], reading: [-1,-1], writing: '', speaking: '', speaking_mode: 'skipped' }
}
export function examMinutes(seconds: number): string {
  return Math.floor(seconds / 60) + ':' + String(Math.max(0, seconds % 60)).padStart(2,'0')
}
