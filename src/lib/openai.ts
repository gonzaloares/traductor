import 'server-only'
import OpenAI from 'openai'

export function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new Error('Configura OPENAI_API_KEY en el servidor')
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 30_000, maxRetries: 1 })
}
