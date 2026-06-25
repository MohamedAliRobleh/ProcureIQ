import { describe, it, expect } from 'vitest'
import { canManage, MANAGE_RESOURCES } from './permissions.js'

describe('canManage', () => {
  it('lets an admin manage every known resource', () => {
    for (const r of MANAGE_RESOURCES) expect(canManage('org:admin', r)).toBe(true)
  })
  it('denies a member every resource', () => {
    for (const r of MANAGE_RESOURCES) expect(canManage('org:member', r)).toBe(false)
  })
  it('denies an unknown role and an unknown resource', () => {
    expect(canManage(null, 'suppliers')).toBe(false)
    expect(canManage('org:admin', 'unknown')).toBe(false)
  })
})
