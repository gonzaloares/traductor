import assert from 'node:assert/strict'
import { test } from 'node:test'
import { LEVELS } from './types.ts'
import {
  ALL_GRAMMAR_TOPICS,
  CUSTOM_GRAMMAR_TOPIC,
  GRAMMAR_TOPICS,
  topicsForLevel,
  selectedGrammarTopic
} from './grammar-topics.ts'

test('all six CEFR levels have their own varied and unique topic catalogs', () => {
  assert.deepEqual(Object.keys(GRAMMAR_TOPICS), LEVELS)
  for (const level of LEVELS) {
    const topics = topicsForLevel(level)
    assert.ok(topics.length >= 10 && topics.length <= 20, level + ' has appropriate coverage')
    assert.equal(new Set(topics).size, topics.length, level + ' has no repeated topics')
    assert.ok(topics.every(topic => topic.length >= 2 && topic.length <= 100))
    assert.equal(topics.includes(ALL_GRAMMAR_TOPICS), false)
    assert.equal(topics.includes(CUSTOM_GRAMMAR_TOPIC), false)
  }
  assert.notDeepEqual(topicsForLevel('A1'), topicsForLevel('A2'))
  assert.notDeepEqual(topicsForLevel('B1'), topicsForLevel('B2'))
  assert.notDeepEqual(topicsForLevel('C1'), topicsForLevel('C2'))
})

test('mixed topics and custom topics resolve to the correct generator payload', () => {
  assert.equal(selectedGrammarTopic(ALL_GRAMMAR_TOPICS, ''), ALL_GRAMMAR_TOPICS)
  assert.equal(selectedGrammarTopic(topicsForLevel('B1')[0], ''), topicsForLevel('B1')[0])
  assert.equal(selectedGrammarTopic(CUSTOM_GRAMMAR_TOPIC, '  plus-que-parfait  '), 'plus-que-parfait')
  assert.equal(selectedGrammarTopic(CUSTOM_GRAMMAR_TOPIC, '  '), '')
})
