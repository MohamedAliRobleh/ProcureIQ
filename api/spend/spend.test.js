import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../_lib/prisma.js', () => ({
  prisma: {
    spendRecord: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}))

import listHandler from './index.js'
import idHandler from './[id].js'
import { prisma } from '../_lib/prisma.js'

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

describe('spend endpoints', () => {
  it('GET returns the org-scoped spend list', async () => {
    prisma.spendRecord.findMany.mockResolvedValue([])
    const res = mockRes()
    await listHandler({ method: 'GET' }, res)
    expect(prisma.spendRecord.findMany).toHaveBeenCalledWith({
      where: { orgId: 'org_demo' },
      orderBy: { date: 'asc' },
    })
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('POST creates a record with generated id and coerced date', async () => {
    prisma.spendRecord.create.mockImplementation(async ({ data }) => data)
    const res = mockRes()
    await listHandler(
      { method: 'POST', body: { supplierId: 'sup_1', amount: 500, category: 'Logistics', date: '2026-06-01' } },
      res
    )
    const created = prisma.spendRecord.create.mock.calls[0][0].data
    expect(created.id).toMatch(/^spend_/)
    expect(created.date).toBeInstanceOf(Date)
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('POST rejects missing supplierId/amount/category/date with 400', async () => {
    const res = mockRes()
    await listHandler({ method: 'POST', body: { amount: 500 } }, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('PATCH updates by id', async () => {
    prisma.spendRecord.update.mockResolvedValue({ id: 'spend_1', amount: 999 })
    const res = mockRes()
    await idHandler({ method: 'PATCH', query: { id: 'spend_1' }, body: { amount: 999 } }, res)
    expect(prisma.spendRecord.update).toHaveBeenCalledWith({
      where: { id: 'spend_1' },
      data: { amount: 999 },
    })
    expect(res.status).toHaveBeenCalledWith(200)
  })
})
