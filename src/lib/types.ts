export type Level = 'A1' | 'A2' | 'B1' | 'B2'
export type Status = 'perfect' | 'minor_errors' | 'incorrect'
export interface Sentence {
  id: string
  spanish_text: string
  reference_french: string
  level: Level
  grammar_topic: string
  source: 'seed' | 'ai_generated'
  mastery_score: number
  times_practiced: number
  last_feedback: string | null
  next_review_at: string
  created_at: string
}
export interface Evaluation {
  status: Status
  score: number
  corrected_sentence: string
  natural_alternative: string
  grammar_explanation_es: string
}
export interface EvaluationResponse extends Evaluation { sentence: Sentence }
export const LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2']
export const isLevel = (value: unknown): value is Level => LEVELS.includes(value as Level)
export const REVIEW_DAYS: Record<number, number> = { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 }
