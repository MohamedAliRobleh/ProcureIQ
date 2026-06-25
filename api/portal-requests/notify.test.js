import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../_lib/auth.js', () => ({ requireAuth: (handler) => handler }))
vi.mock('../_lib/prisma.js', () => ({ prisma: { portalRequest: { findFirst: vi.fn() } } }))
vi.mock('../_lib/email.js', () => ({ isEmailConfigured: vi.fn(), sendEmail: vi.fn() }))

import handler from './notify.js'
import { prisma } from '../_lib/prisma.js'
import { isEmailConfigured, sendEmail } from '../_lib/email.js'

function mockRes() {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.setHeader = vi.fn()
  return res
}

const auth = { userId: 'user_test', orgId: 'org_test', orgRole: 'org:admin' }

beforeEach(() => vi.clearAllMocks())

describe('POST /api/portal-requests/notify', () => {
  it('emails the supplier and returns { ok: true }', async () => {
    isEmailConfigured.mockReturnValue(true)
    prisma.portalRequest.findFirst.mockResolvedValue({
      id: 'preq_1',
      title: 'Submit ESG questionnaire',
      message: 'Please complete it.',
      dueDate: '2026-07-01',
      supplier: { name: 'Atlas Steelworks', email: 'contact@atlas.com' },
    })
    sendEmail.mockResolvedValue(true)
    const res = mockRes()
    await handler({ method: 'POST', auth, body: { id: 'preq_1' } }, res)
    expect(prisma.portalRequest.findFirst).toHaveBeenCalledWith({
      where: { id: 'preq_1', orgId: 'org_test' },
      include: { supplier: { select: { name: true, email: true } } },
    })
    const arg = sendEmail.mock.calls[0][0]
    expect(arg.to).toBe('contact@atlas.com')
    expect(arg.subject).toContain('Submit ESG questionnaire')
    expect(arg.html).toContain('Atlas Steelworks')
    expect(res.json).toHaveBeenCalledWith({ ok: true })
  })

  it('escapes HTML-dangerous characters in title, message, and supplier name', async () => {
    isEmailConfigured.mockReturnValue(true)
    prisma.portalRequest.findFirst.mockResolvedValue({
      id: 'preq_1',
      title: 'A<b>&"X',
      message: 'm<i>&\'',
      dueDate: '2026-07-01',
      supplier: { name: 'A<b>&"', email: 's@x.com' },
    })
    sendEmail.mockResolvedValue(true)
    const res = mockRes()
    await handler({ method: 'POST', auth, body: { id: 'preq_1' } }, res)
    const arg = sendEmail.mock.calls[0][0]
    expect(arg.html).toContain('&lt;')
    expect(arg.html).toContain('&gt;')
    expect(arg.html).toContain('&amp;')
    expect(arg.html).toContain('&quot;')
    expect(arg.html).toContain('&#39;')
    expect(arg.html).not.toContain('<b>')
    expect(arg.html).not.toContain('<i>')
    expect(res.json).toHaveBeenCalledWith({ ok: true })
  })

  it('returns 400 when id is missing', async () => {
    const res = mockRes()
    await handler({ method: 'POST', auth, body: {} }, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('returns 503 when email is not configured (before any DB call)', async () => {
    isEmailConfigured.mockReturnValue(false)
    const res = mockRes()
    await handler({ method: 'POST', auth, body: { id: 'preq_1' } }, res)
    expect(res.status).toHaveBeenCalledWith(503)
    expect(prisma.portalRequest.findFirst).not.toHaveBeenCalled()
  })

  it('returns 404 when the request is not in the org', async () => {
    isEmailConfigured.mockReturnValue(true)
    prisma.portalRequest.findFirst.mockResolvedValue(null)
    const res = mockRes()
    await handler({ method: 'POST', auth, body: { id: 'preq_other' } }, res)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('returns 502 when the send fails', async () => {
    isEmailConfigured.mockReturnValue(true)
    prisma.portalRequest.findFirst.mockResolvedValue({
      id: 'preq_1', title: 'X', message: null, dueDate: null,
      supplier: { name: 'S', email: 's@x.com' },
    })
    sendEmail.mockRejectedValue(new Error('Brevo send failed: 400'))
    const res = mockRes()
    await handler({ method: 'POST', auth, body: { id: 'preq_1' } }, res)
    expect(res.status).toHaveBeenCalledWith(502)
  })

  it('returns 405 for non-POST', async () => {
    const res = mockRes()
    await handler({ method: 'GET', auth }, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('returns 403 for a member', async () => {
    const res = mockRes()
    await handler({ method: 'POST', auth: { userId: 'user_test', orgId: 'org_test', orgRole: 'org:member' }, body: { id: 'preq_1' } }, res)
    expect(res.status).toHaveBeenCalledWith(403)
  })
})
