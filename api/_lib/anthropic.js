import Anthropic from '@anthropic-ai/sdk'

export const AI_MODEL = 'claude-opus-4-8'

let client = null

// True when an API key is present. Endpoints check this before touching the SDK
// so the app degrades gracefully when AI isn't configured (no key yet).
export function isAiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

// Lazily constructs a cached client. Never called without a key (guarded by
// isAiConfigured at the call sites), so importing this module is always safe.
export function getAnthropic() {
  if (!isAiConfigured()) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }
  if (!client) client = new Anthropic()
  return client
}
