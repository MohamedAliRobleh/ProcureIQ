import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../_lib/auth.js', () => ({ requireAuth: (h) => h }))
vi.mock('../_handlers/spend.js', () => ({ list: vi.fn(), byId: vi.fn() }))

import router from './[[...path]].js'
import { list, byId } from '../_handlers/spend.js'

function mockRes() {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.setHeader = vi.fn()
  return res
}

beforeEach(() => vi.clearAllMocks())

describe('spend catch-all router', () => {
  it('routes the base path to list', async () => {
    const req = { method: 'GET', query: {}, auth: { orgId: 'org_test' } }
    await router(req, mockRes())
    expect(list).toHaveBeenCalledTimes(1)
    expect(byId).not.toHaveBeenCalled()
  })

  it('routes /:id to byId and sets req.query.id', async () => {
    const req = { method: 'PATCH', query: { path: ['spend_1'] }, auth: { orgId: 'org_test' } }
    await router(req, mockRes())
    expect(req.query.id).toBe('spend_1')
    expect(byId).toHaveBeenCalledTimes(1)
  })
})
