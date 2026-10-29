import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compareTranslations } from './translation-diff.ts'

test('highlights one incorrect French word and preserves both exact texts', () => {
  const before = 'Je ne vois pas mes voisines depuis deux semaines.'
  const after = 'Je ne vois pas mes voisins depuis deux semaines.'
  const result = compareTranslations(before, after)
  assert.equal(result.hasChanges, true)
  assert.equal(result.original.map(p => p.text).join(''), before)
  assert.equal(result.corrected.map(p => p.text).join(''), after)
  assert.deepEqual(result.changes, [{ before: 'voisines', after: 'voisins' }])
  assert.deepEqual(result.original.filter(p => p.kind === 'removed').map(p => p.text), ['voisines'])
  assert.deepEqual(result.corrected.filter(p => p.kind === 'added').map(p => p.text), ['voisins'])
})

test('keeps elisions and accents visible', () => {
  const result = compareTranslations("J ai ete", "J'ai été")
  assert.ok(result.hasChanges)
  assert.equal(result.corrected.map(p => p.text).join(''), "J'ai été")
  assert.ok(result.corrected.some(p => p.kind === 'added' && p.text.includes('été')))
})

test('handles a missing word without inventing a removed segment', () => {
  const result = compareTranslations('Je suis allé.', 'Je suis déjà allé.')
  assert.equal(result.original.map(p => p.text).join(''), 'Je suis allé.')
  assert.equal(result.corrected.map(p => p.text).join(''), 'Je suis déjà allé.')
  assert.ok(result.changes.some(p => p.before === '' && p.after === 'déjà '))
})

test('identical answers are not highlighted', () => {
  const text = 'Je suis arrivé quand même.'
  const result = compareTranslations(text, text)
  assert.equal(result.hasChanges, false)
  assert.deepEqual(result.original, [{ kind: 'unchanged', text }])
  assert.deepEqual(result.corrected, [{ kind: 'unchanged', text }])
  assert.deepEqual(result.changes, [])
})

test('highlights a punctuation-only correction', () => {
  const result = compareTranslations('Tu viens', 'Tu viens ?')
  assert.equal(result.hasChanges, true)
  assert.equal(result.corrected.map(p => p.text).join(''), 'Tu viens ?')
  assert.ok(result.changes.length > 0)
})

test('oe is accepted as a keyboard fallback for œ without false change highlights', () => {
  const before = 'Ma soeur a un grand coeur.'
  const after = 'Ma sœur a un grand cœur.'
  const result = compareTranslations(before, after)
  assert.equal(result.hasChanges, false)
  assert.deepEqual(result.changes, [])
  assert.equal(result.original.map(p => p.text).join(''), before)
  assert.equal(result.corrected.map(p => p.text).join(''), after)
  assert.deepEqual(result.original.filter(p => p.kind === 'removed'), [])
  assert.deepEqual(result.corrected.filter(p => p.kind === 'added'), [])
})

test('real spelling mistakes still appear alongside an accepted oe ligature fallback', () => {
  const result = compareTranslations('Ma soeur est fatigué.', 'Ma sœur est fatiguée.')
  assert.equal(result.hasChanges, true)
  assert.deepEqual(result.changes, [{ before: 'fatigué', after: 'fatiguée' }])
})

test('accents and unrelated spelling are not ignored', () => {
  const result = compareTranslations('Je suis alle au theatre.', 'Je suis allé au théâtre.')
  assert.equal(result.hasChanges, true)
  assert.ok(result.changes.some(x => x.before === 'alle' && x.after === 'allé'))
  assert.ok(result.changes.some(x => x.before === 'theatre' && x.after === 'théâtre'))
})

test('uppercase ligature fallback is accepted without changing case rules', () => {
  const result = compareTranslations('SOEUR', 'SŒUR')
  assert.equal(result.hasChanges, false)
  assert.deepEqual(result.changes, [])
})
