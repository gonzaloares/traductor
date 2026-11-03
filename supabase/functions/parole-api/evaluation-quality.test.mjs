import test from 'node:test'
import assert from 'node:assert/strict'
import { EVALUATOR_PROMPT, ENGLISH_EVALUATOR_PROMPT, preserveMeaningInAlternative, protectDativeDislocation, correctUnchangedMinorEvaluation, normalizeFrenchKeyboardTypography, reconcileEvaluation } from './evaluation-quality.ts'

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

test('unchanged French answer: 90/100 becomes perfect 100/100', () => {
  const evaluation = {
    status: 'minor_errors', score: 90,
    corrected_sentence: 'Ce t-shirt est rouge.',
    grammar_explanation_es: 'Casi perfecta.',
    orthography_errors: [{ written: 'rouge', correct: 'rouge', meaning_es: 'rojo' }]
  }
  const result = correctUnchangedMinorEvaluation('Ce t-shirt est rouge.', evaluation)
  assert.equal(result.status, 'perfect')
  assert.equal(result.score, 100)
  assert.deepEqual(result.orthography_errors, [])
  assert.match(result.grammar_explanation_es, /No hay errores/)
})

test('real punctuation, spelling and capitalization differences still count', () => {
  const evaluation = {
    status: 'minor_errors', score: 90,
    corrected_sentence: 'Ce t-shirt est rouge.',
    grammar_explanation_es: 'Falta puntuación.'
  }
  assert.deepEqual(correctUnchangedMinorEvaluation('Ce t-shirt est rouge', evaluation), evaluation)
  assert.deepEqual(correctUnchangedMinorEvaluation('Ce T-shirt est rouge.', evaluation), evaluation)
  assert.deepEqual(correctUnchangedMinorEvaluation('Ce t-shirt est rougé.', evaluation), evaluation)
  assert.equal(correctUnchangedMinorEvaluation('  Ce t-shirt  est rouge.  ', evaluation).score, 100)
})

test('same safeguard applies to English', () => {
  const result = correctUnchangedMinorEvaluation('This shirt is red.', {
    status: 'minor_errors', score: 88,
    corrected_sentence: 'This shirt is red.', grammar_explanation_es: 'Minor issue'
  })
  assert.equal(result.status, 'perfect')
  assert.equal(result.score, 100)
})

test('the specific dative-dislocation rule retains its punctuation requirement', () => {
  const answer = 'Je lui ai donné les clés à ma sœur.'
  const modelOutput = correctUnchangedMinorEvaluation(answer, {
    status: 'minor_errors', score: 90,
    corrected_sentence: answer, natural_alternative: answer,
    grammar_explanation_es: 'Minor issue'
  })
  const result = protectDativeDislocation('Le he dado las llaves a mi hermana.', answer, modelOutput)
  assert.equal(result.status, 'minor_errors')
  assert.equal(result.score, 95)
  assert.match(result.corrected_sentence, /clés, à ma sœur/)
})

test('the exact user example is perfect despite keyboard punctuation', () => {
  const written = 'Elle n"est pas ma soeur.'
  const corrected = "Elle n'est pas ma sœur."
  assert.equal(normalizeFrenchKeyboardTypography(written), "Elle n'est pas ma soeur.")
  const result = correctUnchangedMinorEvaluation(written, {
    status: 'minor_errors', score: 90, corrected_sentence: corrected,
    grammar_explanation_es: 'Typographie', orthography_errors: [{ written: 'soeur', correct: 'sœur', meaning_es: 'hermana' }]
  })
  assert.equal(result.status, 'perfect')
  assert.equal(result.score, 100)
  assert.deepEqual(result.orthography_errors, [])
  assert.match(result.grammar_explanation_es, /sin penalización/)
})

test('accepts all apostrophe keyboard variants but does not hide grammatical errors', () => {
  for (const written of ["C’est ma sœur.", "C'est ma soeur.", 'C"est ma soeur.']) {
    const result = correctUnchangedMinorEvaluation(written, {
      status: 'minor_errors', score: 90, corrected_sentence: "C'est ma sœur.",
      grammar_explanation_es: 'Typographie'
    })
    assert.equal(result.score, 100)
  }
  const mismatch = correctUnchangedMinorEvaluation('Elle n"est pas mon soeur.', {
    status: 'minor_errors', score: 90, corrected_sentence: "Elle n'est pas ma sœur.",
    grammar_explanation_es: 'Accord'
  })
  assert.equal(mismatch.status, 'minor_errors')
  assert.equal(mismatch.score, 90)
})

test('quotation marks are not elisions, and English is unaffected', () => {
  assert.equal(normalizeFrenchKeyboardTypography('Il a dit "bonjour".'), 'Il a dit "bonjour".')
  const quote = correctUnchangedMinorEvaluation('Il a dit "bonjour".', {
    status: 'minor_errors', score: 90, corrected_sentence: "Il a dit 'bonjour'.",
    grammar_explanation_es: 'Typographie'
  })
  assert.equal(quote.score, 90)
  const english = correctUnchangedMinorEvaluation('My sister is here', {
    status: 'minor_errors', score: 90, corrected_sentence: 'My sister is here.',
    grammar_explanation_es: 'Punctuation'
  }, 'en')
  assert.equal(english.status, 'minor_errors')
})
