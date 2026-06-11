import { describe, it, expect } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { SupplierProvider, useSupplierContext } from './SupplierContext'
import { suppliers as seedSuppliers } from '../lib/mockData'

const wrapper = ({ children }) => <SupplierProvider>{children}</SupplierProvider>

describe('SupplierContext', () => {
  it('loads suppliers from the API on mount', async () => {
    const { result } = renderHook(() => useSupplierContext(), { wrapper })
    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.suppliers).toHaveLength(seedSuppliers.length)
    expect(result.current.suppliers[0].id).toBe(seedSuppliers[0].id)
  })

  it('addSupplier appends the API-created supplier', async () => {
    const { result } = renderHook(() => useSupplierContext(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
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
    await waitFor(() => expect(result.current.suppliers).toHaveLength(seedSuppliers.length + 1))
    expect(result.current.suppliers.at(-1).name).toBe('New Co')
    expect(result.current.suppliers.at(-1).id).toBeTruthy()
  })

  it('updateSupplier merges the API response into the matching supplier', async () => {
    const { result } = renderHook(() => useSupplierContext(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const id = result.current.suppliers[0].id
    act(() => result.current.updateSupplier(id, { name: 'Renamed Corp' }))
    await waitFor(() => expect(result.current.suppliers.find((s) => s.id === id).name).toBe('Renamed Corp'))
    expect(result.current.suppliers).toHaveLength(seedSuppliers.length)
  })

  it('setSupplierStatus updates only the status field', async () => {
    const { result } = renderHook(() => useSupplierContext(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const id = result.current.suppliers[0].id
    act(() => result.current.setSupplierStatus(id, 'suspended'))
    await waitFor(() => expect(result.current.suppliers.find((s) => s.id === id).status).toBe('suspended'))
    expect(result.current.suppliers.find((s) => s.id === id).name).toBe(seedSuppliers[0].name)
  })

  it('throws when used outside SupplierProvider', () => {
    expect(() => renderHook(() => useSupplierContext())).toThrow(
      'useSupplierContext must be used inside SupplierProvider'
    )
  })
})
