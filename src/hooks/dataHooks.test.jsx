import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useSuppliers } from './useSuppliers'
import { useContracts } from './useContracts'
import { useRisk } from './useRisk'
import { useEsg } from './useEsg'
import { useSpend } from './useSpend'
import { ContractProvider } from '../context/ContractContext'
import { SpendProvider } from '../context/SpendContext'
import { SupplierProvider } from '../context/SupplierContext'
import { suppliers, contracts, riskAssessments, esgResponses, spendRecords } from '../lib/mockData'

describe('data hooks', () => {
  it('useSuppliers resolves with API-loaded suppliers', async () => {
    const wrapper = ({ children }) => <SupplierProvider>{children}</SupplierProvider>
    const { result } = renderHook(() => useSuppliers(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.suppliers).toHaveLength(suppliers.length)
    expect(result.current.suppliers[0].id).toBe(suppliers[0].id)
  })

  it('useContracts resolves with seeded contracts', async () => {
    const wrapper = ({ children }) => <ContractProvider>{children}</ContractProvider>
    const { result } = renderHook(() => useContracts(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.contracts).toHaveLength(contracts.length)
    expect(result.current.contracts[0].id).toBe(contracts[0].id)
  })

  it('useRisk resolves with seeded risk assessments', async () => {
    const { result } = renderHook(() => useRisk())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.riskAssessments).toHaveLength(riskAssessments.length)
    expect(result.current.riskAssessments[0].id).toBe(riskAssessments[0].id)
    expect(result.current.error).toBeNull()
  })

  it('useEsg resolves with seeded ESG responses', async () => {
    const { result } = renderHook(() => useEsg())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.esgResponses).toHaveLength(esgResponses.length)
    expect(result.current.esgResponses[0].id).toBe(esgResponses[0].id)
    expect(result.current.error).toBeNull()
  })

  it('useSpend resolves with seeded spend records', async () => {
    const wrapper = ({ children }) => <SpendProvider>{children}</SpendProvider>
    const { result } = renderHook(() => useSpend(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.spendRecords).toHaveLength(spendRecords.length)
    expect(result.current.spendRecords[0].id).toBe(spendRecords[0].id)
  })
})
