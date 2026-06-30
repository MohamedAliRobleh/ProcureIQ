import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { canManage, canSeed, usePermissions } from './permissions'
import { resetAuthState, authState } from '../test/authState'

describe('frontend permissions', () => {
  beforeEach(() => resetAuthState())

  it('canManage matches the backend rule', () => {
    expect(canManage('org:admin', 'contracts')).toBe(true)
    expect(canManage('org:member', 'contracts')).toBe(false)
    expect(canManage('org:admin', 'risk')).toBe(false)
  })

  it('usePermissions binds canManage to the current org role', () => {
    authState.membership = { role: 'org:member' }
    const { result } = renderHook(() => usePermissions())
    expect(result.current.role).toBe('org:member')
    expect(result.current.canManage('suppliers')).toBe(false)
  })

  it('usePermissions allows an admin', () => {
    authState.membership = { role: 'org:admin' }
    const { result } = renderHook(() => usePermissions())
    expect(result.current.canManage('suppliers')).toBe(true)
  })

  it('canSeed allows both admins and members but not a roleless user', () => {
    expect(canSeed('org:admin')).toBe(true)
    expect(canSeed('org:member')).toBe(true)
    expect(canSeed(null)).toBe(false)
  })

  it('usePermissions binds canSeed to the current role', () => {
    authState.membership = { role: 'org:member' }
    const { result } = renderHook(() => usePermissions())
    expect(result.current.canSeed()).toBe(true)
  })
})
