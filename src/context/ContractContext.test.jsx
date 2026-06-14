import { describe, it, expect } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { ContractProvider, useContractContext } from './ContractContext'
import { contracts as seedContracts } from '../lib/mockData'

const wrapper = ({ children }) => <ContractProvider>{children}</ContractProvider>

describe('ContractContext', () => {
  it('loads contracts from the API on mount', async () => {
    const { result } = renderHook(() => useContractContext(), { wrapper })
    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.contracts).toHaveLength(seedContracts.length)
    expect(result.current.contracts[0].id).toBe(seedContracts[0].id)
  })

  it('addContract appends the API-created contract', async () => {
    const { result } = renderHook(() => useContractContext(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => {
      result.current.addContract({
        title: 'New Agreement',
        supplierId: 'sup_1',
        value: 100000,
        currency: 'USD',
        status: 'draft',
        autoRenew: false,
        terms: '',
      })
    })
    await waitFor(() => expect(result.current.contracts).toHaveLength(seedContracts.length + 1))
    expect(result.current.contracts.at(-1).title).toBe('New Agreement')
    expect(result.current.contracts.at(-1).id).toBeTruthy()
  })

  it('updateContract merges the API response into the matching contract', async () => {
    const { result } = renderHook(() => useContractContext(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const id = result.current.contracts[0].id
    act(() => result.current.updateContract(id, { title: 'Updated Agreement' }))
    await waitFor(() => expect(result.current.contracts.find((c) => c.id === id).title).toBe('Updated Agreement'))
    expect(result.current.contracts).toHaveLength(seedContracts.length)
  })

  it('setContractStatus updates only the status field', async () => {
    const { result } = renderHook(() => useContractContext(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const id = result.current.contracts[0].id
    const originalTitle = result.current.contracts[0].title
    act(() => result.current.setContractStatus(id, 'expired'))
    await waitFor(() => expect(result.current.contracts.find((c) => c.id === id).status).toBe('expired'))
    expect(result.current.contracts.find((c) => c.id === id).title).toBe(originalTitle)
  })

  it('summarizeContract sets aiSummary on the matching contract', async () => {
    const { result } = renderHook(() => useContractContext(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const id = result.current.contracts[0].id
    await act(async () => {
      await result.current.summarizeContract(id)
    })
    expect(result.current.contracts.find((c) => c.id === id).aiSummary).toBe('MOCK AI SUMMARY')
  })

  it('attachContractDocument uploads and sets fileUrl on the matching contract', async () => {
    const { result } = renderHook(() => useContractContext(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const id = result.current.contracts[0].id
    const file = new File(['pdf'], 'contract.pdf', { type: 'application/pdf' })
    await act(async () => {
      await result.current.attachContractDocument(id, file)
    })
    expect(result.current.contracts.find((c) => c.id === id).fileUrl).toBe(
      'https://res.cloudinary.com/democloud/mock.pdf'
    )
  })

  it('notifyContract resolves with { ok: true }', async () => {
    const { result } = renderHook(() => useContractContext(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const id = result.current.contracts[0].id
    let outcome
    await act(async () => {
      outcome = await result.current.notifyContract(id, 'amara@demo.com')
    })
    expect(outcome).toEqual({ ok: true })
  })

  it('throws when used outside ContractProvider', () => {
    expect(() => renderHook(() => useContractContext())).toThrow(
      'useContractContext must be used inside ContractProvider'
    )
  })
})
