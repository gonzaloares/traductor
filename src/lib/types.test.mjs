import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isLevel, LEVELS } from './types.ts'

test('A1 through C2 are supported and ordered', () => {
  assert.deepEqual(LEVELS, ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
  for (const level of LEVELS) assert.equal(isLevel(level), true)
})

test('reject unknown CEFR levels and arbitrary values', () => {
  for (const value of ['Todos', 'C3', 'D1', '', null, 123]) {
    assert.equal(isLevel(value), false)
  }
})
