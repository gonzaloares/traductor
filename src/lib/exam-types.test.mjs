import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assessExam, emptyExamAnswers, examDuration } from './exam-types.ts'

const exam = (language, level, listening, reading, writing, speaking) => ({
  language, level,
  scores: { listening, reading, writing, speaking, total: listening + reading + writing + speaking }
})

test('DELF and DALF C1 pass with 50 points and each part at least 5', () => {
  for (const level of ['A1', 'A2', 'B1', 'B2', 'C1'])
    assert.equal(assessExam(exam('fr', level, 18, 17, 10, 5)).passed, true)
})

test('a French score above 50 fails if one paper is below 5', () => {
  const outcome = assessExam(exam('fr', 'C1', 25, 25, 25, 4))
  assert.equal(outcome.passed, false)
  assert.ok(outcome.failures.some(reason => reason.includes('Producción oral')))
})

test('a balanced French exam below 50 fails overall', () => {
  const outcome = assessExam(exam('fr', 'B2', 10, 10, 10, 10))
  assert.equal(outcome.passed, false)
  assert.ok(outcome.failures.some(reason => reason.includes('global')))
})

test('DALF C2 uses 10 out of 50 for the combined oral and written papers', () => {
  assert.equal(assessExam(exam('fr', 'C2', 25, 25, 25, 0)).passed, true)
  const outcome = assessExam(exam('fr', 'C2', 5, 25, 25, 4))
  assert.equal(outcome.passed, false)
  assert.ok(outcome.failures.some(reason => reason.includes('oral conjunta')))
})

test('English uses an internal global 60 threshold without a per-skill elimination', () => {
  const pass = assessExam(exam('en', 'C1', 20, 20, 20, 0))
  assert.equal(pass.passed, true)
  assert.equal(pass.officialInspired, false)
  assert.match(pass.criterion, /Cambridge English Scale/)
  assert.equal(assessExam(exam('en', 'C1', 20, 20, 19, 0)).passed, false)
})

test('quick and extended exams have distinct durations and question counts', () => {
  assert.equal(examDuration('B1', 'quick'), 15)
  assert.equal(examDuration('C1', 'quick'), 20)
  assert.equal(examDuration('B1', 'extended'), 35)
  assert.equal(examDuration('C1', 'extended'), 45)
  assert.equal(emptyExamAnswers().listening.length, 2)
  assert.deepEqual(emptyExamAnswers(6).reading, [-1, -1, -1, -1, -1, -1])
})
