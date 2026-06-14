import { describe, it, expect, vi, afterEach } from 'vitest'
import { isEmailConfigured, sendEmail } from './email.js'

const ORIGINAL = {
  key: process.env.BREVO_API_KEY,
  sender: process.env.BREVO_SENDER_EMAIL,
  name: process.env.BREVO_SENDER_NAME,
}

function restore(k, v) {
  if (v === undefined) delete process.env[k]
  else process.env[k] = v
}

afterEach(() => {
  restore('BREVO_API_KEY', ORIGINAL.key)
  restore('BREVO_SENDER_EMAIL', ORIGINAL.sender)
  restore('BREVO_SENDER_NAME', ORIGINAL.name)
  vi.unstubAllGlobals()
})

describe('email lib', () => {
  it('isEmailConfigured is true only when key and sender are set', () => {
    delete process.env.BREVO_API_KEY
    delete process.env.BREVO_SENDER_EMAIL
    expect(isEmailConfigured()).toBe(false)
    process.env.BREVO_API_KEY = 'xkeysib-test'
    expect(isEmailConfigured()).toBe(false)
    process.env.BREVO_SENDER_EMAIL = 'noreply@demo.com'
    expect(isEmailConfigured()).toBe(true)
  })

  it('sendEmail POSTs to Brevo with the api-key header and the right body', async () => {
    process.env.BREVO_API_KEY = 'xkeysib-test'
    process.env.BREVO_SENDER_EMAIL = 'noreply@demo.com'
    process.env.BREVO_SENDER_NAME = 'ProcureIQ'
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ messageId: 'abc' }) }))
    vi.stubGlobal('fetch', fetchMock)

    await sendEmail({ to: 'amara@demo.com', subject: 'Reminder: X', html: '<p>hello</p>' })

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.brevo.com/v3/smtp/email')
    expect(options.method).toBe('POST')
    expect(options.headers['api-key']).toBe('xkeysib-test')
    const sent = JSON.parse(options.body)
    expect(sent.sender).toEqual({ email: 'noreply@demo.com', name: 'ProcureIQ' })
    expect(sent.to).toEqual([{ email: 'amara@demo.com' }])
    expect(sent.subject).toBe('Reminder: X')
    expect(sent.htmlContent).toBe('<p>hello</p>')
  })

  it('sendEmail throws on a non-OK Brevo response', async () => {
    process.env.BREVO_API_KEY = 'xkeysib-test'
    process.env.BREVO_SENDER_EMAIL = 'noreply@demo.com'
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 400, text: async () => 'bad sender' })))
    await expect(sendEmail({ to: 'a@b.com', subject: 'S', html: '<p>x</p>' })).rejects.toThrow('Brevo send failed')
  })
})
