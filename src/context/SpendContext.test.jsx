import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { SpendProvider, useSpendContext } from './SpendContext'
import { spendRecords as seedSpendRecords } from '../lib/mockData'

const wrapper = ({ children }) => <SpendProvider>{children}</SpendProvider>

describe('SpendContext', () => {
  it('seeds from mockData.spendRecords on mount', () => {
    const { result } = renderHook(() => useSpendContext(), { wrapper })
    expect(result.current.spendRecords).toHaveLength(seedSpendRecords.length)
    expect(result.current.spendRecords[0].id).toBe(seedSpendRecords[0].id)
  })

  it('addSpendRecord appends a new record with a generated id', () => {
    const { result } = renderHook(() => useSpendContext(), { wrapper })
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
    expect(result.current.spendRecords).toHaveLength(seedSpendRecords.length + 1)
    expect(result.current.spendRecords.at(-1).description).toBe('New spend')
    expect(result.current.spendRecords.at(-1).id).toBeTruthy()
  })

  it('updateSpendRecord modifies the matching record by id', () => {
    const { result } = renderHook(() => useSpendContext(), { wrapper })
    const id = result.current.spendRecords[0].id
    act(() => result.current.updateSpendRecord(id, { amount: 99999 }))
    expect(result.current.spendRecords.find((r) => r.id === id).amount).toBe(99999)
    expect(result.current.spendRecords).toHaveLength(seedSpendRecords.length)
  })

  it('throws when used outside SpendProvider', () => {
    expect(() => renderHook(() => useSpendContext())).toThrow(
      'useSpendContext must be used inside SpendProvider'
    )
  })
})
