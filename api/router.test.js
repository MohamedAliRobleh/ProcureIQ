import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./_lib/auth.js', () => ({ requireAuth: (h) => h }))
vi.mock('./_handlers/suppliers.js', () => ({ list: vi.fn(), byId: vi.fn() }))
vi.mock('./_handlers/spend.js', () => ({ list: vi.fn(), byId: vi.fn() }))
vi.mock('./_handlers/contracts.js', () => ({
  list: vi.fn(), byId: vi.fn(), summarize: vi.fn(), uploadSignature: vi.fn(), notify: vi.fn(),
}))
vi.mock('./_handlers/portalRequests.js', () => ({ list: vi.fn(), byId: vi.fn(), notify: vi.fn() }))
vi.mock('./_handlers/org.js', () => ({
  seed: vi.fn(), clear: vi.fn(), reset: vi.fn(), exportData: vi.fn(), audit: vi.fn(),
}))

import router from './[...path].js'
import * as suppliers from './_handlers/suppliers.js'
import * as spend from './_handlers/spend.js'
import * as contracts from './_handlers/contracts.js'
import * as portal from './_handlers/portalRequests.js'
import * as org from './_handlers/org.js'

function mockRes() {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.setHeader = vi.fn()
  return res
}

const call = (path, auth = {}) => {
  const req = { method: 'GET', query: { path }, auth }
  return [req, mockRes()]
}

beforeEach(() => vi.clearAllMocks())

describe('root API catch-all router', () => {
  it('routes a resource base path (no sub-segment) to list', async () => {
    const [req, res] = call(['suppliers'])
    await router(req, res)
    expect(suppliers.list).toHaveBeenCalledTimes(1)
    expect(suppliers.byId).not.toHaveBeenCalled()
  })

  it('routes a resource id segment to byId and sets req.query.id', async () => {
    const [req, res] = call(['suppliers', 'sup_1'])
    await router(req, res)
    expect(req.query.id).toBe('sup_1')
    expect(suppliers.byId).toHaveBeenCalledTimes(1)
  })

  it('routes spend base and id like suppliers', async () => {
    const [reqA, resA] = call(['spend'])
    await router(reqA, resA)
    expect(spend.list).toHaveBeenCalledTimes(1)
    const [reqB, resB] = call(['spend', 'spend_1'])
    await router(reqB, resB)
    expect(reqB.query.id).toBe('spend_1')
    expect(spend.byId).toHaveBeenCalledTimes(1)
  })

  it('routes contracts base, sub-routes, and id', async () => {
    const [r0, s0] = call(['contracts'])
    await router(r0, s0)
    expect(contracts.list).toHaveBeenCalledTimes(1)
    for (const [seg, fn] of [['summarize', contracts.summarize], ['upload-signature', contracts.uploadSignature], ['notify', contracts.notify]]) {
      const [r, s] = call(['contracts', seg])
      await router(r, s)
      expect(fn).toHaveBeenCalledTimes(1)
    }
    const [rId, sId] = call(['contracts', 'con_1'])
    await router(rId, sId)
    expect(rId.query.id).toBe('con_1')
    expect(contracts.byId).toHaveBeenCalledTimes(1)
  })

  it('routes portal-requests base, notify, and id', async () => {
    const [r0, s0] = call(['portal-requests'])
    await router(r0, s0)
    expect(portal.list).toHaveBeenCalledTimes(1)
    const [rn, sn] = call(['portal-requests', 'notify'])
    await router(rn, sn)
    expect(portal.notify).toHaveBeenCalledTimes(1)
    const [rId, sId] = call(['portal-requests', 'por_1'])
    await router(rId, sId)
    expect(rId.query.id).toBe('por_1')
    expect(portal.byId).toHaveBeenCalledTimes(1)
  })

  it('routes org seed for any member (no admin gate)', async () => {
    const [req, res] = call(['org', 'seed'], { orgRole: 'org:member' })
    await router(req, res)
    expect(org.seed).toHaveBeenCalledTimes(1)
  })

  it('403s a member on an org admin-only route and does not call the handler', async () => {
    const [req, res] = call(['org', 'clear'], { orgRole: 'org:member' })
    await router(req, res)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ error: 'Admin access required' })
    expect(org.clear).not.toHaveBeenCalled()
  })

  it('routes org admin-only segments for an admin (export -> exportData)', async () => {
    const [r1, s1] = call(['org', 'clear'], { orgRole: 'org:admin' })
    await router(r1, s1)
    const [r2, s2] = call(['org', 'export'], { orgRole: 'org:admin' })
    await router(r2, s2)
    expect(org.clear).toHaveBeenCalledTimes(1)
    expect(org.exportData).toHaveBeenCalledTimes(1)
  })

  it('404s an unknown org segment', async () => {
    const [req, res] = call(['org', 'nope'], { orgRole: 'org:admin' })
    await router(req, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('404s an unknown resource', async () => {
    const [req, res] = call(['nope'])
    await router(req, res)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ error: 'Not found' })
  })
})
