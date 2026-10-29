/**
 * LCS comparison of a student's exact answer against the correction proposed
 * by OpenAI. This is only a visual diff: it does not decide whether the
 * translation is grammatically/semantically correct or modify the SRS score.
 */
export type ChangeKind = 'unchanged' | 'removed' | 'added'
export interface DiffPart {
  kind: ChangeKind
  text: string
}
export interface DiffChange {
  before: string
  after: string
}
export interface TranslationDiff {
  original: DiffPart[]
  corrected: DiffPart[]
  changes: DiffChange[]
  hasChanges: boolean
}

const TOKENS = /\s+|[\p{L}\p{M}\p{N}]+|[^\s\p{L}\p{M}\p{N}]+/gu

/** The keyboard fallback oe for œ is not a correction-worthy difference. */
function comparableToken(value: string): string {
  return value.normalize('NFC').replaceAll('œ', 'oe').replaceAll('Œ', 'OE')
}

function push(parts: DiffPart[], kind: ChangeKind, text: string): void {
  if (!text) return
  const last = parts[parts.length - 1]
  if (last?.kind === kind) last.text += text
  else parts.push({ kind, text })
}

export function compareTranslations(originalText: string, correctedText: string): TranslationDiff {
  // Keep whitespace/punctuation so both reconstructed strings remain exact.
  const originalTokens = originalText.match(TOKENS) ?? []
  const correctedTokens = correctedText.match(TOKENS) ?? []
  const original: DiffPart[] = []
  const corrected: DiffPart[] = []
  const changes: DiffChange[] = []

  // Bound memory for an unexpectedly long model response. The application
  // accepts short sentences; this is a defensive fallback, not normal flow.
  if (originalTokens.length * correctedTokens.length > 150000) {
    push(original, 'removed', originalText)
    push(corrected, 'added', correctedText)
    changes.push({ before: originalText, after: correctedText })
    return { original, corrected, changes, hasChanges: originalText !== correctedText }
  }

  const dp = Array.from(
    { length: originalTokens.length + 1 },
    () => new Uint16Array(correctedTokens.length + 1)
  )
  for (let i = originalTokens.length - 1; i >= 0; i--) {
    for (let j = correctedTokens.length - 1; j >= 0; j--) {
      dp[i][j] = comparableToken(originalTokens[i]) === comparableToken(correctedTokens[j])
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  let i = 0
  let j = 0
  let pendingOriginal = ''
  let pendingCorrected = ''
  const flush = () => {
    if (pendingOriginal || pendingCorrected) {
      changes.push({ before: pendingOriginal, after: pendingCorrected })
      pendingOriginal = ''
      pendingCorrected = ''
    }
  }

  while (i < originalTokens.length || j < correctedTokens.length) {
    if (i < originalTokens.length && j < correctedTokens.length &&
        comparableToken(originalTokens[i]) === comparableToken(correctedTokens[j])) {
      flush()
      push(original, 'unchanged', originalTokens[i])
      push(corrected, 'unchanged', correctedTokens[j])
      i++
      j++
    } else if (i < originalTokens.length &&
        (j === correctedTokens.length || dp[i + 1][j] >= dp[i][j + 1])) {
      push(original, 'removed', originalTokens[i])
      pendingOriginal += originalTokens[i]
      i++
    } else {
      push(corrected, 'added', correctedTokens[j])
      pendingCorrected += correctedTokens[j]
      j++
    }
  }
  flush()

  return {
    original, corrected, changes,
    hasChanges: changes.length > 0
  }
}
