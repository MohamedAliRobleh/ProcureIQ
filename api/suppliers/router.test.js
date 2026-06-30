import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../_lib/auth.js', () => ({ requireAuth: (h) => h }))
vi.mock('../_handlers/suppliers.js', () => ({ list: vi.fn(), byId: vi.fn() }))

import router from './[[...path]].js'
import { list, byId } from '../_handlers/suppliers.js'

function mockRes() {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.setHeader = vi.fn()
  return res
}

beforeEach(() => vi.clearAllMocks())

describe('suppliers catch-all router', () => {
  it('routes the base path to list', async () => {
    const req = { method: 'GET', query: {}, auth: { orgId: 'org_test' } }
    await router(req, mockRes())
    expect(list).toHaveBeenCalledTimes(1)
    expect(byId).not.toHaveBeenCalled()
  })

  it('routes /:id to byId and sets req.query.id', async () => {
    const req = { method: 'PATCH', query: { path: ['sup_1'] }, auth: { orgId: 'org_test' } }
    await router(req, mockRes())
    expect(req.query.id).toBe('sup_1')
    expect(byId).toHaveBeenCalledTimes(1)
    expect(list).not.toHaveBeenCalled()
  })
})
