import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { ContractProvider, useContractContext } from './ContractContext'
import { contracts as seedContracts } from '../lib/mockData'

const wrapper = ({ children }) => <ContractProvider>{children}</ContractProvider>

describe('ContractContext', () => {
  it('seeds from mockData.contracts on mount', () => {
    const { result } = renderHook(() => useContractContext(), { wrapper })
    expect(result.current.contracts).toHaveLength(seedContracts.length)
    expect(result.current.contracts[0].id).toBe('con_1')
  })

  it('addContract appends a new contract with a generated id', () => {
    const { result } = renderHook(() => useContractContext(), { wrapper })
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
    expect(result.current.contracts).toHaveLength(seedContracts.length + 1)
    expect(result.current.contracts.at(-1).title).toBe('New Agreement')
    expect(result.current.contracts.at(-1).id).toBeTruthy()
  })

  it('updateContract modifies the matching contract by id', () => {
    const { result } = renderHook(() => useContractContext(), { wrapper })
    const id = result.current.contracts[0].id
    act(() => result.current.updateContract(id, { title: 'Updated Agreement' }))
    expect(result.current.contracts.find((c) => c.id === id).title).toBe('Updated Agreement')
    expect(result.current.contracts).toHaveLength(seedContracts.length)
  })

  it('setContractStatus updates only the status field', () => {
    const { result } = renderHook(() => useContractContext(), { wrapper })
    const id = result.current.contracts[0].id
    const originalTitle = result.current.contracts[0].title
    act(() => result.current.setContractStatus(id, 'expired'))
    expect(result.current.contracts.find((c) => c.id === id).status).toBe('expired')
    expect(result.current.contracts.find((c) => c.id === id).title).toBe(originalTitle)
  })

  it('throws when used outside ContractProvider', () => {
    expect(() => renderHook(() => useContractContext())).toThrow(
      'useContractContext must be used inside ContractProvider'
    )
  })
})
