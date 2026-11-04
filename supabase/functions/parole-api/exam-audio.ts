// Pure helpers for expressive, multi-speaker exam listening.
// The same speaker keeps the same voice across the entire recording.
export type ListeningGender = 'female' | 'male'
export type ListeningEmotion = 'neutral' | 'happy' | 'sad' | 'worried' | 'angry' | 'excited' | 'surprised' | 'calm'
export type ListeningTurn = {
  speaker: string
  gender: ListeningGender
  emotion: ListeningEmotion
  text: string
}

const EMOTIONS = new Set<ListeningEmotion>([
  'neutral', 'happy', 'sad', 'worried', 'angry', 'excited', 'surprised', 'calm'
])
const FEMALE_VOICES = ['marin', 'coral', 'shimmer', 'sage'] as const
const MALE_VOICES = ['cedar', 'echo', 'ash', 'verse'] as const

export function validListeningTurns(value: unknown): value is ListeningTurn[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 24) return false
  const genderBySpeaker = new Map<string, ListeningGender>()
  let total = 0
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
    const turn = raw as Record<string, unknown>
    if (typeof turn.speaker !== 'string' || turn.speaker.trim().length < 1 ||
        turn.speaker.length > 40 || /[\n\r:]/.test(turn.speaker) ||
        (turn.gender !== 'female' && turn.gender !== 'male') ||
        typeof turn.emotion !== 'string' || !EMOTIONS.has(turn.emotion as ListeningEmotion) ||
        typeof turn.text !== 'string' || turn.text.trim().length < 2 || turn.text.length > 900) return false
    total += turn.text.length
    const speaker = turn.speaker.trim().toLocaleLowerCase()
    if (genderBySpeaker.has(speaker) && genderBySpeaker.get(speaker) !== turn.gender) return false
    genderBySpeaker.set(speaker, turn.gender)
  }
  return total >= 80 && total <= 5000 && genderBySpeaker.size <= 4
}

export function listeningScript(turns: ListeningTurn[]): string {
  const unique = new Set(turns.map(turn => turn.speaker.trim().toLowerCase()))
  return turns.map(turn => unique.size > 1 ? turn.speaker.trim() + ': ' + turn.text.trim() : turn.text.trim()).join('\n')
}

export function voiceForTurn(turns: ListeningTurn[], index: number): string {
  const current = turns[index]
  if (!current) throw new Error('Segmento fuera de rango')
  const distinct = [...new Set(turns.filter(t => t.gender === current.gender)
    .map(t => t.speaker.trim().toLowerCase()))]
  const speakerIndex = distinct.indexOf(current.speaker.trim().toLowerCase())
  const voices = current.gender === 'female' ? FEMALE_VOICES : MALE_VOICES
  return voices[speakerIndex % voices.length]
}

export function emotionDirection(emotion: ListeningEmotion): string {
  switch (emotion) {
    case 'happy': return 'cheerful, warm and smiling, with lively intonation'
    case 'sad': return 'genuinely sad and subdued, softer, with slower reflective pacing'
    case 'worried': return 'concerned and slightly anxious, with natural uncertainty'
    case 'angry': return 'frustrated and firm but controlled, with sharper stress and intonation'
    case 'excited': return 'energetic and enthusiastic, with bright expressive intonation'
    case 'surprised': return 'naturally surprised, with an authentic rise in intonation'
    case 'calm': return 'calm, comforting and reassuring, with measured pacing'
    default: return 'natural, expressive, everyday conversational delivery'
  }
}

function cleanScript(s: string): string {
  // The legacy paper may prefix dialogue lines with "Name:"; these labels must not
  // be spoken. Whitespace is immaterial, but every real word must be retained.
  return s.replace(/^[^\n:]{1,40}:\s*/gm, '').replace(/\s+/g, '').toLowerCase()
}

export function sameSpokenText(script: string, turns: ListeningTurn[]): boolean {
  return cleanScript(script) === turns.map(turn => turn.text.replace(/\s+/g, '').toLowerCase()).join('')
}

export function legacyListeningTurns(script: string, language: 'fr' | 'en'): ListeningTurn[] {
  const result: ListeningTurn[] = []
  const female = /^(madame|mme|mademoiselle|miss|mrs|ms|claire|marie|sophie|anna|anne|sarah|julie|emma|lucie|alice|élise|elise|camille)$/i
  const male = /^(monsieur|m\.|mr|pierre|paul|jean|luc|marc|thomas|julien|antoine|john|david|tom|james|alexandre)$/i
  const speakers = new Map<string, ListeningGender>()
  const lines = script.split(/\n+/).map(line => line.trim()).filter(Boolean)
  for (const line of lines) {
    const match = line.match(/^([^:\n]{1,35}):\s*(.{2,})$/)
    if (!match) {
      if (result.length) {
        result[result.length - 1].text += ' ' + line
      } else {
        result.push({ speaker: language === 'fr' ? 'Narrateur' : 'Narrator', gender: 'female',
          emotion: 'neutral', text: line })
      }
      continue
    }
    const speaker = match[1].trim()
    const key = speaker.toLowerCase()
    if (!speakers.has(key)) {
      const index = speakers.size
      speakers.set(key, female.test(speaker) ? 'female' : male.test(speaker) ? 'male'
        : index % 2 ? 'male' : 'female')
    }
    result.push({ speaker, gender: speakers.get(key)!, emotion: 'neutral', text: match[2] })
  }
  if (!result.length || !validListeningTurns(result) || !sameSpokenText(script, result)) {
    // Last-resort voice for an unstructured historic passage, not fabricated dialogue.
    return [{ speaker: language === 'fr' ? 'Narrateur' : 'Narrator', gender: 'female',
      emotion: 'neutral', text: script.slice(0, 5000) }]
  }
  return result
}
