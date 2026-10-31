export type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
export type Language = 'fr' | 'en'
export type Status = 'perfect' | 'minor_errors' | 'incorrect'
export interface Sentence {
  id: string
  spanish_text: string
  reference_french: string
  language: Language
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
export interface PracticeScore {
  practice_id: string
  sentence_id: string
  language: Language
  level: Level
  score: number
  created_at: string
}
export interface OrthographyWord {
  id: string
  word_key: string
  correct_word: string
  wrong_example: string
  meaning_es: string
  context_es: string | null
  context_fr: string
  language: Language
  level: Level
  mastery_score: number
  times_practiced: number
  misspellings_count: number
  state: 'active' | 'dismissed'
  next_review_at: string
  created_at: string
  updated_at: string
}
export interface OrthographyReviewResponse {
  correct: boolean
  word: OrthographyWord
}
export interface EvaluationResponse extends Evaluation {
  orthographySaved?: number
  sentence: Sentence
  scoreRecord?: PracticeScore | null
}
export const LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
export const isLevel = (value: unknown): value is Level => LEVELS.includes(value as Level)
export const REVIEW_DAYS: Record<number, number> = { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 }
