import test from 'node:test'
import assert from 'node:assert/strict'
import { EVALUATOR_PROMPT, ENGLISH_EVALUATOR_PROMPT, preserveMeaningInAlternative, reconcileEvaluation } from './evaluation-quality.ts'

test('the grader must produce grammatical, faithful corrections and avoid false stylistic claims', () => {
  assert.match(EVALUATOR_PROMPT, /"corrected_sentence"/)
  assert.match(EVALUATOR_PROMPT, /"grammar_explanation_es"/)
  assert.match(EVALUATOR_PROMPT, /"orthography_errors"/)
  assert.match(EVALUATOR_PROMPT, /"status"/)
  assert.match(EVALUATOR_PROMPT, /"score"/)
  assert.match(EVALUATOR_PROMPT, /qu'il n'y paraît/)
  assert.match(EVALUATOR_PROMPT, /films que nous avons vus/)
  assert.match(EVALUATOR_PROMPT, /"plaire"/)
  assert.match(EVALUATOR_PROMPT, /"aimer"/)
  assert.match(EVALUATOR_PROMPT, /una alternativa de verdad/)
})

test('a gratuitous beaucoup is removed when it is the only change', () => {
  const corrected = 'Nous avons aimé les films que nous avons vus.'
  const alt = 'Nous avons beaucoup aimé les films que nous avons vus.'
  assert.equal(preserveMeaningInAlternative('Nos gustaron las películas que vimos.', corrected, alt), corrected)
})

test('an original Spanish intensifier allows a faithful French intensifier', () => {
  const corrected = 'Nous avons aimé les films que nous avons vus.'
  const alt = 'Nous avons beaucoup aimé les films que nous avons vus.'
  assert.equal(preserveMeaningInAlternative('Nos gustaron mucho las películas que vimos.', corrected, alt), alt)
})

test('genuinely different natural French formulations are not edited', () => {
  const corrected = "Le sujet dont nous avons parlé hier est plus compliqué qu'il n'y paraît."
  const alt = "Le sujet abordé hier est plus complexe qu'il n'y paraît."
  assert.equal(preserveMeaningInAlternative('El tema del que hablamos ayer es más complicado de lo que parece.', corrected, alt), alt)
})

test('normalized duplicates use the corrected sentence without cosmetic variation', () => {
  const corrected = 'Je suis à la maison.'
  assert.equal(preserveMeaningInAlternative('Estoy en casa.', corrected, 'Je suis à la maison !'), corrected)
})

test('a non-sole-added intensifier is not blindly stripped', () => {
  const corrected = 'Il faut travailler.'
  const alt = 'Pour réussir, il faut beaucoup travailler.'
  assert.equal(preserveMeaningInAlternative('Hay que trabajar.', corrected, alt), alt)
})


test('a 20/100 grade never appears as almost perfect or leaves SRS unchanged', () => {
  assert.deepEqual(reconcileEvaluation({ status: 'minor_errors', score: 20 }), { status: 'incorrect', score: 20 })
  assert.deepEqual(reconcileEvaluation({ status: 'minor_errors', score: 92 }), { status: 'minor_errors', score: 92 })
})

test('perfect and incorrect statuses have matching numeric ranges', () => {
  assert.deepEqual(reconcileEvaluation({ status: 'perfect', score: 70 }), { status: 'perfect', score: 100 })
  assert.deepEqual(reconcileEvaluation({ status: 'incorrect', score: 95 }), { status: 'incorrect', score: 84 })
  assert.deepEqual(reconcileEvaluation({ status: 'minor_errors', score: 100 }), { status: 'minor_errors', score: 99 })
})

test('the English grader calibrates isolated third-conditional mistakes', () => {
  assert.match(ENGLISH_EVALUATOR_PROMPT, /If you had told me, I had gone with you/)
  assert.match(ENGLISH_EVALUATOR_PROMPT, /75\/100/)
  assert.match(EVALUATOR_PROMPT, /85-99/)
})
