import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validListeningTurns, voiceForTurn, listeningScript,
  sameSpokenText, legacyListeningTurns, emotionDirection
} from './exam-audio.ts'

const dialogue = [
  { speaker: 'Claire', gender: 'female', emotion: 'happy', text: 'Bonjour ! Je suis ravie de te revoir.' },
  { speaker: 'Sophie', gender: 'female', emotion: 'worried', text: 'Je suis désolée, mais le train est supprimé.' },
  { speaker: 'Paul', gender: 'male', emotion: 'calm', text: 'Pas de souci, nous pouvons attendre ici.' },
  { speaker: 'Claire', gender: 'female', emotion: 'sad', text: 'Oh, c’est vraiment dommage, j’avais réservé une place.' },
  { speaker: 'Jacques', gender: 'male', emotion: 'surprised', text: 'Vous n’avez pas encore reçu le message ?' }
]

test('speaker identity, sex and contextual emotion are validated', () => {
  assert.equal(validListeningTurns(dialogue), true)
  assert.equal(validListeningTurns(dialogue.map(t => ({ ...t, gender: t.speaker === 'Claire' && t.emotion === 'sad' ? 'male' : t.gender }))), false)
  assert.equal(validListeningTurns(dialogue.map(t => ({ ...t, emotion: 'fantastic' }))), false)
})

test('voices remain stable and are distinct for same-sex speakers', () => {
  assert.equal(voiceForTurn(dialogue, 0), voiceForTurn(dialogue, 3))
  assert.notEqual(voiceForTurn(dialogue, 0), voiceForTurn(dialogue, 1))
  assert.notEqual(voiceForTurn(dialogue, 2), voiceForTurn(dialogue, 4))
  assert.notEqual(voiceForTurn(dialogue, 0), voiceForTurn(dialogue, 2))
})

test('transcript rendering preserves all spoken words and assigns labeled turns', () => {
  const transcript = listeningScript(dialogue)
  assert.match(transcript, /^Claire: Bonjour/)
  assert.match(transcript, /Sophie: Je suis désolée/)
  assert.equal(sameSpokenText(transcript, dialogue), true)
})

test('legacy dialog yields individual identifiable speakers', () => {
  const original = 'Claire: Bonjour, Paul. Je voudrais aller au cinéma ce soir, si tu es libre.\n' +
    'Paul: Je suis désolé, je ne peux pas. Je dois travailler tard ce soir.'
  const turns = legacyListeningTurns(original, 'fr')
  assert.equal(validListeningTurns(turns), true)
  assert.equal(turns[0].gender, 'female')
  assert.equal(turns[1].gender, 'male')
  assert.equal(sameSpokenText(original, turns), true)
})

test('older long monologues are split into clips under 900 chars without changing speech', () => {
  const script = 'Bonjour, je voudrais réserver une chambre pour la semaine prochaine. '.repeat(26)
  const turns = legacyListeningTurns(script, 'fr')
  assert.equal(validListeningTurns(turns), true)
  assert.ok(turns.length >= 2)
  assert.ok(turns.every(t => t.text.length <= 900))
  assert.equal(sameSpokenText(script, turns), true)
})

test('emotion instructions distinguish sadness and happiness', () => {
  assert.notEqual(emotionDirection('sad'), emotionDirection('happy'))
  assert.match(emotionDirection('excited'), /energetic/)
})
