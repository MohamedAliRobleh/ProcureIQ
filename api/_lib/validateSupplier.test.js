import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isSupplierInOrg } from './validateSupplier.js'

function makePrisma(found) {
  return { supplier: { findFirst: vi.fn().mockResolvedValue(found) } }
}

beforeEach(() => vi.clearAllMocks())

describe('isSupplierInOrg', () => {
  it('returns true when a supplier exists in the org', async () => {
    const prisma = makePrisma({ id: 'sup_1', orgId: 'org_test' })
    const result = await isSupplierInOrg(prisma, 'sup_1', 'org_test')
    expect(result).toBe(true)
    expect(prisma.supplier.findFirst).toHaveBeenCalledWith({ where: { id: 'sup_1', orgId: 'org_test' } })
  })

  it('returns false when no supplier matches the id+org', async () => {
    const prisma = makePrisma(null)
    const result = await isSupplierInOrg(prisma, 'sup_other', 'org_test')
    expect(result).toBe(false)
  })
})
