import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useSuppliers } from './useSuppliers'
import { useContracts } from './useContracts'
import { useRisk } from './useRisk'
import { useSpend } from './useSpend'
import { suppliers, contracts, riskAssessments, spendRecords } from '../lib/mockData'

describe('data hooks', () => {
  it('useSuppliers starts loading then resolves with seeded suppliers', async () => {
    const { result } = renderHook(() => useSuppliers())
    expect(result.current.isLoading).toBe(true)
    expect(result.current.suppliers).toBe(null)

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.suppliers).toEqual(suppliers)
  })

  it('useContracts resolves with seeded contracts', async () => {
    const { result } = renderHook(() => useContracts())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.contracts).toEqual(contracts)
  })

  it('useRisk resolves with seeded risk assessments', async () => {
    const { result } = renderHook(() => useRisk())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.riskAssessments).toEqual(riskAssessments)
  })

  it('useSpend resolves with seeded spend records', async () => {
    const { result } = renderHook(() => useSpend())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.spendRecords).toEqual(spendRecords)
  })
})
