import { describe, it, expect } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { PortalProvider, usePortalContext } from './PortalContext'
import { portalRequests as seedPortalRequests } from '../lib/mockData'

const wrapper = ({ children }) => <PortalProvider>{children}</PortalProvider>

describe('PortalContext', () => {
  it('loads requests from the API on mount', async () => {
    const { result } = renderHook(() => usePortalContext(), { wrapper })
    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.requests).toHaveLength(seedPortalRequests.length)
    expect(result.current.requests[0].id).toBe(seedPortalRequests[0].id)
  })

  it('createRequest prepends the API-created request', async () => {
    const { result } = renderHook(() => usePortalContext(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => {
      await result.current.createRequest({ title: 'New', supplierId: 'sup_1' })
    })
    await waitFor(() => expect(result.current.requests).toHaveLength(seedPortalRequests.length + 1))
    expect(result.current.requests[0].title).toBe('New')
    expect(result.current.requests[0].id).toBeTruthy()
  })

  it('updateRequest merges the API response into the matching request', async () => {
    const { result } = renderHook(() => usePortalContext(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const id = result.current.requests[0].id
    await act(async () => {
      await result.current.updateRequest(id, { status: 'approved' })
    })
    await waitFor(() => expect(result.current.requests.find((r) => r.id === id).status).toBe('approved'))
    expect(result.current.requests).toHaveLength(seedPortalRequests.length)
  })

  it('deleteRequest removes the matching request', async () => {
    const { result } = renderHook(() => usePortalContext(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const id = result.current.requests[0].id
    await act(async () => {
      await result.current.deleteRequest(id)
    })
    await waitFor(() => expect(result.current.requests).toHaveLength(seedPortalRequests.length - 1))
    expect(result.current.requests.find((r) => r.id === id)).toBeUndefined()
  })

  it('notifyRequest resolves with { ok: true }', async () => {
    const { result } = renderHook(() => usePortalContext(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const id = result.current.requests[0].id
    let outcome
    await act(async () => {
      outcome = await result.current.notifyRequest(id)
    })
    expect(outcome).toEqual({ ok: true })
  })

  it('throws when used outside PortalProvider', () => {
    expect(() => renderHook(() => usePortalContext())).toThrow(
      'usePortalContext must be used inside PortalProvider'
    )
  })
})
