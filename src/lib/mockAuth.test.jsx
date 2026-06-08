import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { MockAuthProvider, useUser, useOrganization } from './mockAuth'

function wrapper({ children }) {
  return <MockAuthProvider>{children}</MockAuthProvider>
}

describe('mockAuth', () => {
  it('useUser returns a Clerk-shaped signed-in admin user', () => {
    const { result } = renderHook(() => useUser(), { wrapper })
    expect(result.current.isLoaded).toBe(true)
    expect(result.current.isSignedIn).toBe(true)
    expect(result.current.user.fullName).toBe('Amara Chen')
    expect(result.current.user.publicMetadata.role).toBe('org_admin')
  })

  it('useOrganization returns a Clerk-shaped organization', () => {
    const { result } = renderHook(() => useOrganization(), { wrapper })
    expect(result.current.isLoaded).toBe(true)
    expect(result.current.organization.id).toBe('org_demo')
    expect(result.current.organization.name).toBe('Procure IQ Demo Org')
  })
})
