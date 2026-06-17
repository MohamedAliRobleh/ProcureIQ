import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../_lib/auth.js', () => ({ requireAuth: (handler) => handler }))
vi.mock('../_lib/prisma.js', () => ({
  prisma: { contract: { findFirst: vi.fn() } },
}))
vi.mock('../_lib/email.js', () => ({
  isEmailConfigured: vi.fn(),
  sendEmail: vi.fn(),
}))

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

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/contracts/notify', () => {
  it('sends a reminder and returns { ok: true }', async () => {
    isEmailConfigured.mockReturnValue(true)
    prisma.contract.findFirst.mockResolvedValue({
      id: 'con_1',
      title: 'Master Supply Agreement',
      value: 600000,
      currency: 'USD',
      status: 'active',
      endDate: '2026-12-31',
    })
    sendEmail.mockResolvedValue(true)
    const res = mockRes()
    await handler({ method: 'POST', body: { id: 'con_1', toEmail: 'amara@demo.com' }, auth: { userId: 'user_test', orgId: 'org_test' } }, res)

    expect(prisma.contract.findFirst).toHaveBeenCalledWith({ where: { id: 'con_1', orgId: 'org_test' } })
    const arg = sendEmail.mock.calls[0][0]
    expect(arg.to).toBe('amara@demo.com')
    expect(arg.subject).toContain('Master Supply Agreement')
    expect(arg.html).toContain('Master Supply Agreement')
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ ok: true })
  })

  it('returns 404 when the contract is not in the org', async () => {
    isEmailConfigured.mockReturnValue(true)
    prisma.contract.findFirst.mockResolvedValue(null)
    const res = mockRes()
    await handler({ method: 'POST', body: { id: 'con_other', toEmail: 'a@b.com' }, auth: { userId: 'user_test', orgId: 'org_test' } }, res)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('returns 503 when email is not configured (before any DB call)', async () => {
    isEmailConfigured.mockReturnValue(false)
    const res = mockRes()
    await handler({ method: 'POST', body: { id: 'con_1', toEmail: 'a@b.com' }, auth: { userId: 'user_test', orgId: 'org_test' } }, res)
    expect(res.status).toHaveBeenCalledWith(503)
    expect(prisma.contract.findFirst).not.toHaveBeenCalled()
  })

  it('returns 400 when id or toEmail is missing', async () => {
    const res1 = mockRes()
    await handler({ method: 'POST', body: { toEmail: 'a@b.com' }, auth: { userId: 'user_test', orgId: 'org_test' } }, res1)
    expect(res1.status).toHaveBeenCalledWith(400)
    const res2 = mockRes()
    await handler({ method: 'POST', body: { id: 'con_1' }, auth: { userId: 'user_test', orgId: 'org_test' } }, res2)
    expect(res2.status).toHaveBeenCalledWith(400)
  })

  it('returns 405 for non-POST', async () => {
    const res = mockRes()
    await handler({ method: 'GET', auth: { userId: 'user_test', orgId: 'org_test' } }, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('returns 502 when the email send fails', async () => {
    isEmailConfigured.mockReturnValue(true)
    prisma.contract.findFirst.mockResolvedValue({ id: 'con_1', title: 'X', value: 1, currency: 'USD', status: 'active', endDate: null })
    sendEmail.mockRejectedValue(new Error('Brevo send failed: 400 bad sender'))
    const res = mockRes()
    await handler({ method: 'POST', body: { id: 'con_1', toEmail: 'a@b.com' }, auth: { userId: 'user_test', orgId: 'org_test' } }, res)
    expect(res.status).toHaveBeenCalledWith(502)
  })
})
