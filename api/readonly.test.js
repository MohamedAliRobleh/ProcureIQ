import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./_lib/prisma.js', () => ({
  prisma: {
    riskAssessment: { findMany: vi.fn() },
    esgResponse: { findMany: vi.fn() },
  },
}))

vi.mock('./_lib/auth.js', () => ({ requireAuth: (handler) => handler }))

import riskHandler from './risk/index.js'
import esgHandler from './esg/index.js'
import { prisma } from './_lib/prisma.js'

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

describe('read-only endpoints', () => {
  it('GET /api/risk returns org-scoped assessments', async () => {
    prisma.riskAssessment.findMany.mockResolvedValue([{ id: 'risk_1' }])
    const res = mockRes()
    await riskHandler({ method: 'GET', auth: { userId: 'user_test', orgId: 'org_test' } }, res)
    expect(prisma.riskAssessment.findMany).toHaveBeenCalledWith({
      where: { orgId: 'org_test' },
      orderBy: { assessedAt: 'asc' },
    })
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('GET /api/esg returns org-scoped responses', async () => {
    prisma.esgResponse.findMany.mockResolvedValue([{ id: 'esg_1' }])
    const res = mockRes()
    await esgHandler({ method: 'GET', auth: { userId: 'user_test', orgId: 'org_test' } }, res)
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('rejects non-GET with 405', async () => {
    const res = mockRes()
    await riskHandler({ method: 'POST', auth: { userId: 'user_test', orgId: 'org_test' } }, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })
})
