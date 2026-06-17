import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./_lib/auth.js', () => ({ requireAuth: (handler) => handler }))
vi.mock('./_lib/prisma.js', () => ({
  prisma: {
    supplier: { findMany: vi.fn() },
    contract: { findMany: vi.fn() },
    riskAssessment: { findMany: vi.fn() },
    esgResponse: { findMany: vi.fn() },
    spendRecord: { findMany: vi.fn() },
  },
}))
vi.mock('./_lib/anthropic.js', () => ({
  AI_MODEL: 'claude-opus-4-8',
  isAiConfigured: vi.fn(),
  getAnthropic: vi.fn(),
}))

import handler from './assistant.js'
import { prisma } from './_lib/prisma.js'
import { isAiConfigured, getAnthropic } from './_lib/anthropic.js'

function mockRes() {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.setHeader = vi.fn()
  return res
}

beforeEach(() => {
  vi.clearAllMocks()
  prisma.supplier.findMany.mockResolvedValue([
    { id: 'sup_1', name: 'Atlas Steelworks', category: 'Raw Materials', country: 'US', status: 'active', riskScore: 90, esgScore: 40 },
    { id: 'sup_2', name: 'Nordic Freight', category: 'Logistics', country: 'DE', status: 'active', riskScore: 20, esgScore: 80 },
  ])
  prisma.contract.findMany.mockResolvedValue([])
  prisma.riskAssessment.findMany.mockResolvedValue([
    { supplierId: 'sup_1', score: 90, level: 'critical', financialRisk: 90, complianceRisk: 90, operationalRisk: 90, geopoliticalRisk: 90 },
    { supplierId: 'sup_2', score: 20, level: 'low', financialRisk: 20, complianceRisk: 20, operationalRisk: 20, geopoliticalRisk: 20 },
  ])
  prisma.esgResponse.findMany.mockResolvedValue([])
  prisma.spendRecord.findMany.mockResolvedValue([])
})

describe('POST /api/assistant', () => {
  it('returns the Claude reply when AI is configured', async () => {
    isAiConfigured.mockReturnValue(true)
    getAnthropic.mockReturnValue({
      messages: { create: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'CLAUDE REPLY' }] }) },
    })
    const res = mockRes()
    await handler({ method: 'POST', auth: { userId: 'user_test', orgId: 'org_test' }, body: { messages: [{ role: 'user', content: 'Which suppliers are riskiest?' }] } }, res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ reply: 'CLAUDE REPLY', fallback: false })
    expect(prisma.supplier.findMany).toHaveBeenCalledWith({ where: { orgId: 'org_test' } })
  })

  it('falls back to the deterministic engine when AI is not configured', async () => {
    isAiConfigured.mockReturnValue(false)
    const res = mockRes()
    await handler({ method: 'POST', auth: { userId: 'user_test', orgId: 'org_test' }, body: { messages: [{ role: 'user', content: 'Which suppliers are riskiest?' }] } }, res)
    expect(res.status).toHaveBeenCalledWith(200)
    const payload = res.json.mock.calls[0][0]
    expect(payload.fallback).toBe(true)
    expect(payload.reply).toContain('Atlas Steelworks')
  })

  it('falls back when the Claude call throws', async () => {
    isAiConfigured.mockReturnValue(true)
    getAnthropic.mockReturnValue({
      messages: { create: vi.fn().mockRejectedValue(new Error('boom')) },
    })
    const res = mockRes()
    await handler({ method: 'POST', auth: { userId: 'user_test', orgId: 'org_test' }, body: { messages: [{ role: 'user', content: 'Which suppliers are riskiest?' }] } }, res)
    const payload = res.json.mock.calls[0][0]
    expect(payload.fallback).toBe(true)
    expect(payload.reply).toContain('Atlas Steelworks')
  })

  it('returns 400 when messages is missing or empty', async () => {
    const res = mockRes()
    await handler({ method: 'POST', auth: { userId: 'user_test', orgId: 'org_test' }, body: {} }, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('returns 405 for non-POST', async () => {
    const res = mockRes()
    await handler({ method: 'GET', auth: { userId: 'user_test', orgId: 'org_test' } }, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })
})
