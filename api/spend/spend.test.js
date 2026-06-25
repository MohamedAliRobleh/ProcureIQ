import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../_lib/prisma.js', () => ({
  prisma: {
    spendRecord: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
    supplier: { findFirst: vi.fn() },
  },
}))

vi.mock('../_lib/auth.js', () => ({ requireAuth: (handler) => handler }))

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
    await listHandler({ method: 'GET', auth: { userId: 'user_test', orgId: 'org_test' } }, res)
    expect(prisma.spendRecord.findMany).toHaveBeenCalledWith({
      where: { orgId: 'org_test' },
      orderBy: { date: 'asc' },
    })
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('POST creates a record with generated id and coerced date', async () => {
    prisma.supplier.findFirst.mockResolvedValue({ id: 'sup_1' })
    prisma.spendRecord.create.mockImplementation(async ({ data }) => data)
    const res = mockRes()
    await listHandler(
      { method: 'POST', body: { supplierId: 'sup_1', amount: 500, category: 'Logistics', date: '2026-06-01' }, auth: { userId: 'user_test', orgId: 'org_test' } },
      res
    )
    const created = prisma.spendRecord.create.mock.calls[0][0].data
    expect(created.id).toMatch(/^spend_/)
    expect(created.date).toBeInstanceOf(Date)
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('POST rejects missing supplierId/amount/category/date with 400', async () => {
    const res = mockRes()
    await listHandler({ method: 'POST', body: { amount: 500 }, auth: { userId: 'user_test', orgId: 'org_test' } }, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('PATCH updates by id', async () => {
    prisma.spendRecord.findFirst.mockResolvedValue({ id: 'spend_1' })
    prisma.spendRecord.update.mockResolvedValue({ id: 'spend_1', amount: 999 })
    const res = mockRes()
    await idHandler({ method: 'PATCH', query: { id: 'spend_1' }, body: { amount: 999 }, auth: { userId: 'user_test', orgId: 'org_test' } }, res)
    expect(prisma.spendRecord.findFirst).toHaveBeenCalledWith({
      where: { id: 'spend_1', orgId: 'org_test' },
    })
    expect(prisma.spendRecord.update).toHaveBeenCalledWith({
      where: { id: 'spend_1' },
      data: { amount: 999 },
    })
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('returns 404 when the id does not exist in the org', async () => {
    prisma.spendRecord.findFirst.mockResolvedValue(null)
    const res = mockRes()
    await idHandler({ method: 'PATCH', query: { id: 'spend_other_org' }, body: { amount: 999 }, auth: { userId: 'user_test', orgId: 'org_test' } }, res)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(prisma.spendRecord.update).not.toHaveBeenCalled()
  })

  it('ignores client-supplied orgId and id on PATCH (cannot move records across orgs)', async () => {
    prisma.spendRecord.findFirst.mockResolvedValue({ id: 'spend_1' })
    prisma.spendRecord.update.mockResolvedValue({ id: 'spend_1', amount: 999 })
    const res = mockRes()
    await idHandler(
      { method: 'PATCH', query: { id: 'spend_1' }, body: { orgId: 'evil_org', id: 'hijack', amount: 999 }, auth: { userId: 'user_test', orgId: 'org_test' } },
      res
    )
    const data = prisma.spendRecord.update.mock.calls[0][0].data
    expect(data).not.toHaveProperty('orgId')
    expect(data).not.toHaveProperty('id')
    expect(data.amount).toBe(999)
  })

  it('POST rejects a supplierId that is not in the org with 400', async () => {
    prisma.supplier.findFirst.mockResolvedValue(null)
    const res = mockRes()
    await listHandler(
      { method: 'POST', body: { supplierId: 'sup_foreign', amount: 500, category: 'Logistics', date: '2026-06-01' }, auth: { userId: 'user_test', orgId: 'org_test' } },
      res
    )
    expect(prisma.supplier.findFirst).toHaveBeenCalledWith({ where: { id: 'sup_foreign', orgId: 'org_test' } })
    expect(res.status).toHaveBeenCalledWith(400)
    expect(prisma.spendRecord.create).not.toHaveBeenCalled()
  })

  it('PATCH rejects reassigning to a supplierId not in the org with 400', async () => {
    prisma.spendRecord.findFirst.mockResolvedValue({ id: 'spend_1' })
    prisma.supplier.findFirst.mockResolvedValue(null)
    const res = mockRes()
    await idHandler(
      { method: 'PATCH', query: { id: 'spend_1' }, body: { supplierId: 'sup_foreign' }, auth: { userId: 'user_test', orgId: 'org_test' } },
      res
    )
    expect(res.status).toHaveBeenCalledWith(400)
    expect(prisma.spendRecord.update).not.toHaveBeenCalled()
  })

  it('PATCH without a supplierId does not run the supplier check', async () => {
    prisma.spendRecord.findFirst.mockResolvedValue({ id: 'spend_1' })
    prisma.spendRecord.update.mockResolvedValue({ id: 'spend_1', amount: 999 })
    const res = mockRes()
    await idHandler(
      { method: 'PATCH', query: { id: 'spend_1' }, body: { amount: 999 }, auth: { userId: 'user_test', orgId: 'org_test' } },
      res
    )
    expect(prisma.supplier.findFirst).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
  })
})
