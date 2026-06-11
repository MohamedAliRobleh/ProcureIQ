import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../_lib/prisma.js', () => ({
  prisma: {
    contract: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
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

describe('contracts endpoints', () => {
  it('GET returns the org-scoped contract list', async () => {
    prisma.contract.findMany.mockResolvedValue([])
    const res = mockRes()
    await listHandler({ method: 'GET' }, res)
    expect(prisma.contract.findMany).toHaveBeenCalledWith({
      where: { orgId: 'org_demo' },
      orderBy: { createdAt: 'asc' },
    })
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('POST coerces yyyy-mm-dd dates to Date objects', async () => {
    prisma.contract.create.mockImplementation(async ({ data }) => data)
    const res = mockRes()
    await listHandler(
      {
        method: 'POST',
        body: { title: 'Deal', supplierId: 'sup_1', value: 1000, startDate: '2026-01-12', endDate: '' },
      },
      res
    )
    const created = prisma.contract.create.mock.calls[0][0].data
    expect(created.startDate).toBeInstanceOf(Date)
    expect('endDate' in created).toBe(false)
    expect(created.id).toMatch(/^con_/)
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('POST rejects missing title/supplierId/value with 400', async () => {
    const res = mockRes()
    await listHandler({ method: 'POST', body: { title: 'No supplier' } }, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('PATCH coerces dates and updates by id', async () => {
    prisma.contract.update.mockResolvedValue({ id: 'con_1' })
    const res = mockRes()
    await idHandler({ method: 'PATCH', query: { id: 'con_1' }, body: { endDate: '2026-07-22' } }, res)
    const data = prisma.contract.update.mock.calls[0][0].data
    expect(data.endDate).toBeInstanceOf(Date)
    expect(res.status).toHaveBeenCalledWith(200)
  })
})
