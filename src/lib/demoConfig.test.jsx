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

  it('is true when Clerk appends a uniqueness suffix to the demo slug', () => {
    authState.organization = { ...DEMO_ORG, slug: 'procureiq-demo-1782787479860281484' }
    const { result } = renderHook(() => useIsDemoOrg())
    expect(result.current).toBe(true)
  })

  it('is false for an unrelated org whose slug merely contains the demo word', () => {
    authState.organization = { ...DEMO_ORG, slug: 'acme-procureiq-demo' }
    const { result } = renderHook(() => useIsDemoOrg())
    expect(result.current).toBe(false)
  })
})
