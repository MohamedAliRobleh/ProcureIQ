import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useIsDemoOrg } from './auth'
import { authState, resetAuthState, DEMO_ORG } from '../test/authState'

describe('useIsDemoOrg', () => {
  beforeEach(() => resetAuthState())

  it('is false in a normal org', () => {
    const { result } = renderHook(() => useIsDemoOrg())
    expect(result.current).toBe(false)
  })

  it('is true in the demo org', () => {
    authState.organization = DEMO_ORG
    const { result } = renderHook(() => useIsDemoOrg())
    expect(result.current).toBe(true)
  })
})
