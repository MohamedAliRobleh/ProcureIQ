import { describe, it, expect } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { SpendProvider, useSpendContext } from './SpendContext'
import { spendRecords as seedSpendRecords } from '../lib/mockData'

const wrapper = ({ children }) => <SpendProvider>{children}</SpendProvider>

describe('SpendContext', () => {
  it('loads spend records from the API on mount', async () => {
    const { result } = renderHook(() => useSpendContext(), { wrapper })
    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.spendRecords).toHaveLength(seedSpendRecords.length)
    expect(result.current.spendRecords[0].id).toBe(seedSpendRecords[0].id)
  })

  it('addSpendRecord appends the API-created record', async () => {
    const { result } = renderHook(() => useSpendContext(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => {
      result.current.addSpendRecord({
        supplierId: 'sup_1',
        amount: 5000,
        currency: 'USD',
        category: 'Logistics',
        description: 'New spend',
        date: new Date('2026-06-01'),
        invoiceRef: 'INV-9999',
      })
    })
    await waitFor(() => expect(result.current.spendRecords).toHaveLength(seedSpendRecords.length + 1))
    expect(result.current.spendRecords.at(-1).description).toBe('New spend')
    expect(result.current.spendRecords.at(-1).id).toBeTruthy()
  })

  it('updateSpendRecord merges the API response into the matching record', async () => {
    const { result } = renderHook(() => useSpendContext(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const id = result.current.spendRecords[0].id
    act(() => result.current.updateSpendRecord(id, { amount: 99999 }))
    await waitFor(() => expect(result.current.spendRecords.find((r) => r.id === id).amount).toBe(99999))
    expect(result.current.spendRecords).toHaveLength(seedSpendRecords.length)
  })

  it('throws when used outside SpendProvider', () => {
    expect(() => renderHook(() => useSpendContext())).toThrow(
      'useSpendContext must be used inside SpendProvider'
    )
  })
})
