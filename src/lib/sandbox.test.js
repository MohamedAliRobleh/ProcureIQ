import { describe, it, expect, beforeEach } from 'vitest'
import {
  parsePath, setSandboxActive, isSandboxActive, SANDBOX_RESOURCES,
  sandboxGet, sandboxCreate, sandboxUpdate, sandboxDelete, resetSandbox,
} from './sandbox'

beforeEach(() => {
  localStorage.clear()
  setSandboxActive(false)
})

describe('parsePath', () => {
  it('parses list and id paths for managed resources', () => {
    expect(parsePath('/api/suppliers')).toEqual({ resource: 'suppliers', id: null })
    expect(parsePath('/api/suppliers/sup_1')).toEqual({ resource: 'suppliers', id: 'sup_1' })
    expect(parsePath('/api/portal-requests/preq_9?_=1')).toEqual({ resource: 'portal-requests', id: 'preq_9' })
  })
  it('returns null for non-managed resources and named sub-routes', () => {
    expect(parsePath('/api/esg')).toBeNull()
    expect(parsePath('/api/contracts/summarize')).toEqual({ resource: 'contracts', id: 'summarize' })
    expect(parsePath('/api/org/seed')).toBeNull()
    expect(parsePath('/api/assistant')).toBeNull()
  })
})

describe('sandbox flag', () => {
  it('toggles', () => {
    expect(isSandboxActive()).toBe(false)
    setSandboxActive(true)
    expect(isSandboxActive()).toBe(true)
  })
})

describe('sandbox CRUD', () => {
  it('seeds once from seedFn, then serves the snapshot', async () => {
    let calls = 0
    const seedFn = async () => { calls += 1; return [{ id: 'a', name: 'Seed' }] }
    expect(await sandboxGet('suppliers', seedFn)).toEqual([{ id: 'a', name: 'Seed' }])
    expect(await sandboxGet('suppliers', seedFn)).toEqual([{ id: 'a', name: 'Seed' }])
    expect(calls).toBe(1)
  })
  it('creates with a local id, updates by merge, deletes', async () => {
    await sandboxGet('suppliers', async () => [{ id: 'a', name: 'A' }])
    const created = sandboxCreate('suppliers', { name: 'B' })
    expect(created.id).toMatch(/^sbx_suppliers_/)
    expect((await sandboxGet('suppliers', async () => [])).length).toBe(2)

    const updated = sandboxUpdate('suppliers', 'a', { name: 'A2', id: 'hijack' })
    expect(updated).toMatchObject({ id: 'a', name: 'A2' })

    expect(sandboxDelete('suppliers', 'a')).toEqual({ deleted: true })
    expect((await sandboxGet('suppliers', async () => [])).map((r) => r.id)).toEqual([created.id])
  })
  it('resetSandbox clears snapshots so the next get re-seeds', async () => {
    await sandboxGet('suppliers', async () => [{ id: 'a' }])
    sandboxCreate('suppliers', { name: 'B' })
    resetSandbox()
    expect(await sandboxGet('suppliers', async () => [{ id: 'fresh' }])).toEqual([{ id: 'fresh' }])
  })
})

it('SANDBOX_RESOURCES lists the four managed resources', () => {
  expect(SANDBOX_RESOURCES).toEqual(['suppliers', 'contracts', 'spend', 'portal-requests'])
})
