import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useSuppliers } from './useSuppliers'
import { useContracts } from './useContracts'
import { useRisk } from './useRisk'
import { useEsg } from './useEsg'
import { useSpend } from './useSpend'
import { ContractProvider } from '../context/ContractContext'
import { suppliers, contracts, riskAssessments, esgResponses, spendRecords } from '../lib/mockData'

describe('data hooks', () => {
  it('useSuppliers starts loading then resolves with seeded suppliers', async () => {
    const { result } = renderHook(() => useSuppliers())
    expect(result.current.isLoading).toBe(true)
    expect(result.current.suppliers).toBe(null)

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.suppliers).toEqual(suppliers)
    expect(result.current.error).toBeNull()
  })

  it('useContracts resolves with seeded contracts', async () => {
    const wrapper = ({ children }) => <ContractProvider>{children}</ContractProvider>
    const { result } = renderHook(() => useContracts(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.contracts).toEqual(contracts)
  })

  it('useRisk resolves with seeded risk assessments', async () => {
    const { result } = renderHook(() => useRisk())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.riskAssessments).toEqual(riskAssessments)
    expect(result.current.error).toBeNull()
  })

  it('useEsg resolves with seeded ESG responses', async () => {
    const { result } = renderHook(() => useEsg())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.esgResponses).toEqual(esgResponses)
    expect(result.current.error).toBeNull()
  })

  it('useSpend resolves with seeded spend records', async () => {
    const { result } = renderHook(() => useSpend())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.spendRecords).toEqual(spendRecords)
    expect(result.current.error).toBeNull()
  })
})
