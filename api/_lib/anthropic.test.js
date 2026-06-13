// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest'
import { isAiConfigured, getAnthropic, AI_MODEL } from './anthropic.js'

const ORIGINAL = process.env.ANTHROPIC_API_KEY

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.ANTHROPIC_API_KEY
  else process.env.ANTHROPIC_API_KEY = ORIGINAL
})

describe('anthropic lib', () => {
  it('AI_MODEL is the Opus 4.8 id', () => {
    expect(AI_MODEL).toBe('claude-opus-4-8')
  })

  it('isAiConfigured reflects the env var', () => {
    delete process.env.ANTHROPIC_API_KEY
    expect(isAiConfigured()).toBe(false)
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    expect(isAiConfigured()).toBe(true)
  })

  it('getAnthropic throws when the key is missing', () => {
    delete process.env.ANTHROPIC_API_KEY
    expect(() => getAnthropic()).toThrow('ANTHROPIC_API_KEY is not configured')
  })

  it('getAnthropic returns a client with a messages API when configured', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    const client = getAnthropic()
    expect(client.messages).toBeTruthy()
    expect(typeof client.messages.create).toBe('function')
  })
})
