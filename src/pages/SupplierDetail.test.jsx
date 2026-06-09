import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SupplierProvider } from '../context/SupplierContext'
import { ContractProvider } from '../context/ContractContext'
import SupplierDetail from './SupplierDetail'

function renderDetail(id = 'sup_1') {
  return render(
    <MemoryRouter initialEntries={[`/suppliers/${id}`]}>
      <SupplierProvider>
        <ContractProvider>
          <Routes>
            <Route path="/suppliers/:id" element={<SupplierDetail />} />
          </Routes>
        </ContractProvider>
      </SupplierProvider>
    </MemoryRouter>
  )
}

describe('SupplierDetail', () => {
  it('renders the supplier name and Overview tab by default', () => {
    renderDetail()
    expect(screen.getByText('Atlas Steelworks')).toBeInTheDocument()
    expect(screen.getByText('Contact Information')).toBeInTheDocument()
  })

  it('shows a Suspend button for an active supplier that toggles to Activate after click', () => {
    renderDetail()
    const suspendBtn = screen.getByRole('button', { name: 'Suspend' })
    fireEvent.click(suspendBtn)
    expect(screen.getByRole('button', { name: 'Activate' })).toBeInTheDocument()
  })

  it('Contracts tab shows the supplier contracts table', () => {
    renderDetail()
    fireEvent.click(screen.getByRole('button', { name: 'Contracts' }))
    expect(screen.getByText('Master Supply Agreement — Atlas Steelworks')).toBeInTheDocument()
  })

  it('Risk tab shows sub-score cards for the supplier', () => {
    renderDetail()
    fireEvent.click(screen.getByRole('button', { name: 'Risk' }))
    expect(screen.getByText('Financial Risk')).toBeInTheDocument()
    expect(screen.getByText('Compliance Risk')).toBeInTheDocument()
    expect(screen.getByText('Operational Risk')).toBeInTheDocument()
    expect(screen.getByText('Geopolitical Risk')).toBeInTheDocument()
  })

  it('shows a not-found message for an unknown supplier id', () => {
    renderDetail('sup_unknown_999')
    expect(screen.getByRole('heading', { name: 'Supplier not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Back to Suppliers/i })).toBeInTheDocument()
  })

  it('opens the Edit Supplier modal when Edit is clicked', () => {
    renderDetail()
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByRole('heading', { name: 'Edit Supplier' })).toBeInTheDocument()
  })
})
