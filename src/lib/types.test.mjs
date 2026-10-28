import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isLevel, LEVELS } from './types.ts'

test('A1 through B2 are supported and ordered', () => {
  assert.deepEqual(LEVELS, ['A1', 'A2', 'B1', 'B2'])
  for (const level of LEVELS) assert.equal(isLevel(level), true)
})

test('reject unknown CEFR levels and arbitrary values', () => {
  for (const value of ['Todos', 'C1', 'C2', '', null, 123]) {
    assert.equal(isLevel(value), false)
  }
})
