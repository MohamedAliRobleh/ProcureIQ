import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../_lib/prisma.js', () => ({
  prisma: {
    $transaction: vi.fn(),
    contract: { deleteMany: vi.fn((a) => ({ op: 'del:contract', ...a })), createMany: vi.fn((a) => ({ op: 'new:contract', ...a })) },
    riskAssessment: { deleteMany: vi.fn((a) => ({ op: 'del:risk', ...a })), createMany: vi.fn((a) => ({ op: 'new:risk', ...a })) },
    esgResponse: { deleteMany: vi.fn((a) => ({ op: 'del:esg', ...a })), createMany: vi.fn((a) => ({ op: 'new:esg', ...a })) },
    spendRecord: { deleteMany: vi.fn((a) => ({ op: 'del:spend', ...a })), createMany: vi.fn((a) => ({ op: 'new:spend', ...a })) },
    supplier: { deleteMany: vi.fn((a) => ({ op: 'del:supplier', ...a })), createMany: vi.fn((a) => ({ op: 'new:supplier', ...a })) },
  },
}))
vi.mock('../_lib/auth.js', () => ({ requireOrgAdmin: (handler) => handler }))
vi.mock('../_lib/seedData.js', () => ({
  buildSeedData: vi.fn(() => ({
    suppliers: [{ id: 'org_test__sup_1' }],
    contracts: [{ id: 'org_test__con_1' }],
    riskAssessments: [{ id: 'org_test__risk_1' }],
    esgResponses: [{ id: 'org_test__esg_1' }],
    spendRecords: [{ id: 'org_test__spend_1' }],
  })),
}))

import handler from './reset.js'
import { prisma } from '../_lib/prisma.js'

function mockRes() {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.setHeader = vi.fn()
  return res
}

const authReq = (over = {}) => ({
  method: 'POST',
  auth: { userId: 'user_test', orgId: 'org_test', orgRole: 'org:admin' },
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/org/reset', () => {
  it('clears child-first then re-seeds parent-first in one transaction', async () => {
    const res = mockRes()
    await handler(authReq(), res)
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    const ops = prisma.$transaction.mock.calls[0][0].map((o) => o.op)
    expect(ops).toEqual([
      'del:contract', 'del:risk', 'del:esg', 'del:spend', 'del:supplier',
      'new:supplier', 'new:contract', 'new:risk', 'new:esg', 'new:spend',
    ])
    expect(prisma.supplier.createMany).toHaveBeenCalledWith({ data: [{ id: 'org_test__sup_1' }] })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ reset: true })
  })

  it('rejects non-POST with 405', async () => {
    const res = mockRes()
    await handler(authReq({ method: 'GET' }), res)
    expect(res.status).toHaveBeenCalledWith(405)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
