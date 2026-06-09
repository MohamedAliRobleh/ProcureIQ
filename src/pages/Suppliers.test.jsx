import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SupplierProvider } from '../context/SupplierContext'
import Suppliers from './Suppliers'

function renderSuppliers() {
  return render(
    <MemoryRouter>
      <SupplierProvider>
        <Suppliers />
      </SupplierProvider>
    </MemoryRouter>
  )
}

describe('Suppliers', () => {
  it('renders page heading and at least one seeded supplier', () => {
    renderSuppliers()
    expect(screen.getByRole('heading', { name: 'Suppliers' })).toBeInTheDocument()
    expect(screen.getByText('Atlas Steelworks')).toBeInTheDocument()
  })

  it('filters suppliers by search text', () => {
    renderSuppliers()
    fireEvent.change(screen.getByPlaceholderText('Search suppliers...'), { target: { value: 'atlas' } })
    expect(screen.getByText('Atlas Steelworks')).toBeInTheDocument()
    expect(screen.queryByText('Nordic Freight Solutions')).not.toBeInTheDocument()
  })

  it('shows the empty message when no suppliers match the filter', () => {
    renderSuppliers()
    fireEvent.change(screen.getByPlaceholderText('Search suppliers...'), { target: { value: 'zzznomatch' } })
    expect(screen.getByText('No suppliers match your filters')).toBeInTheDocument()
  })

  it('opens the Add Supplier modal when the Add Supplier button is clicked', () => {
    renderSuppliers()
    fireEvent.click(screen.getByRole('button', { name: /Add Supplier/i }))
    expect(screen.getByRole('heading', { name: 'Add Supplier' })).toBeInTheDocument()
  })
})
