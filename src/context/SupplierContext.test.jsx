import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { SupplierProvider, useSupplierContext } from './SupplierContext'
import { suppliers as seedSuppliers } from '../lib/mockData'

const wrapper = ({ children }) => <SupplierProvider>{children}</SupplierProvider>

describe('SupplierContext', () => {
  it('seeds from mockData.suppliers on mount', () => {
    const { result } = renderHook(() => useSupplierContext(), { wrapper })
    expect(result.current.suppliers).toHaveLength(seedSuppliers.length)
    expect(result.current.suppliers[0].id).toBe('sup_1')
  })

  it('addSupplier appends a new supplier with a generated id', () => {
    const { result } = renderHook(() => useSupplierContext(), { wrapper })
    act(() => {
      result.current.addSupplier({
        name: 'New Co',
        email: 'new@co.com',
        phone: '',
        country: 'Japan',
        category: 'Energy',
        status: 'pending',
        website: '',
        description: '',
      })
    })
    expect(result.current.suppliers).toHaveLength(seedSuppliers.length + 1)
    expect(result.current.suppliers.at(-1).name).toBe('New Co')
    expect(result.current.suppliers.at(-1).id).toBeTruthy()
  })

  it('updateSupplier modifies the matching supplier by id', () => {
    const { result } = renderHook(() => useSupplierContext(), { wrapper })
    const id = result.current.suppliers[0].id
    act(() => result.current.updateSupplier(id, { name: 'Renamed Corp' }))
    expect(result.current.suppliers.find((s) => s.id === id).name).toBe('Renamed Corp')
    expect(result.current.suppliers).toHaveLength(seedSuppliers.length)
  })

  it('setSupplierStatus updates only the status field', () => {
    const { result } = renderHook(() => useSupplierContext(), { wrapper })
    const id = result.current.suppliers[0].id
    act(() => result.current.setSupplierStatus(id, 'suspended'))
    expect(result.current.suppliers.find((s) => s.id === id).status).toBe('suspended')
    expect(result.current.suppliers.find((s) => s.id === id).name).toBe(seedSuppliers[0].name)
  })

  it('throws when used outside SupplierProvider', () => {
    expect(() => renderHook(() => useSupplierContext())).toThrow(
      'useSupplierContext must be used inside SupplierProvider'
    )
  })
})
