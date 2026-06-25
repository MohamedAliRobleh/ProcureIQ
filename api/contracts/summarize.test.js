import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../_lib/auth.js', () => ({ requireAuth: (handler) => handler }))
vi.mock('../_lib/prisma.js', () => ({
  prisma: { contract: { findFirst: vi.fn(), update: vi.fn() } },
}))
vi.mock('../_lib/anthropic.js', () => ({
  AI_MODEL: 'claude-opus-4-8',
  isAiConfigured: vi.fn(),
  getAnthropic: vi.fn(),
}))

import handler from './summarize.js'
import { prisma } from '../_lib/prisma.js'
import { isAiConfigured, getAnthropic } from '../_lib/anthropic.js'

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

describe('POST /api/contracts/summarize', () => {
  it('generates, persists, and returns the contract with aiSummary', async () => {
    isAiConfigured.mockReturnValue(true)
    prisma.contract.findFirst.mockResolvedValue({ id: 'con_1', title: 'Master Supply Agreement', value: 600000, currency: 'USD', status: 'active', terms: 'Net-30' })
    getAnthropic.mockReturnValue({
      messages: { create: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'A concise summary.' }] }) },
    })
    prisma.contract.update.mockResolvedValue({ id: 'con_1', aiSummary: 'A concise summary.' })
    const res = mockRes()
    await handler({ method: 'POST', body: { id: 'con_1' }, auth: { userId: 'user_test', orgId: 'org_test', orgRole: 'org:admin' } }, res)
    expect(prisma.contract.findFirst).toHaveBeenCalledWith({ where: { id: 'con_1', orgId: 'org_test' } })
    expect(prisma.contract.update).toHaveBeenCalledWith({ where: { id: 'con_1' }, data: { aiSummary: 'A concise summary.' } })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ id: 'con_1', aiSummary: 'A concise summary.' })
  })

  it('returns 404 when the contract is not in the org', async () => {
    isAiConfigured.mockReturnValue(true)
    prisma.contract.findFirst.mockResolvedValue(null)
    const res = mockRes()
    await handler({ method: 'POST', body: { id: 'con_other' }, auth: { userId: 'user_test', orgId: 'org_test', orgRole: 'org:admin' } }, res)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(prisma.contract.update).not.toHaveBeenCalled()
  })

  it('returns 503 when AI is not configured', async () => {
    isAiConfigured.mockReturnValue(false)
    const res = mockRes()
    await handler({ method: 'POST', body: { id: 'con_1' }, auth: { userId: 'user_test', orgId: 'org_test', orgRole: 'org:admin' } }, res)
    expect(res.status).toHaveBeenCalledWith(503)
    expect(prisma.contract.findFirst).not.toHaveBeenCalled()
  })

  it('returns 400 when id is missing', async () => {
    const res = mockRes()
    await handler({ method: 'POST', body: {}, auth: { userId: 'user_test', orgId: 'org_test', orgRole: 'org:admin' } }, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('returns 405 for non-POST', async () => {
    const res = mockRes()
    await handler({ method: 'GET', auth: { userId: 'user_test', orgId: 'org_test' } }, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('returns 403 for a member', async () => {
    const res = mockRes()
    await handler({ method: 'POST', auth: { userId: 'user_test', orgId: 'org_test', orgRole: 'org:member' }, body: { id: 'con_1' } }, res)
    expect(res.status).toHaveBeenCalledWith(403)
  })
})
