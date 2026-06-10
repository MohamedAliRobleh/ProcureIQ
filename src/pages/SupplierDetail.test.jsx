import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SupplierProvider } from '../context/SupplierContext'
import { ContractProvider } from '../context/ContractContext'
import { SpendProvider } from '../context/SpendContext'
import SupplierDetail from './SupplierDetail'

function renderDetail(id = 'sup_1') {
  return render(
    <MemoryRouter initialEntries={[`/suppliers/${id}`]}>
      <SupplierProvider>
        <ContractProvider>
          <SpendProvider>
            <Routes>
              <Route path="/suppliers/:id" element={<SupplierDetail />} />
            </Routes>
          </SpendProvider>
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

  it('ESG tab shows rating, score, and sub-score cards for the supplier', () => {
    renderDetail()
    fireEvent.click(screen.getByRole('button', { name: 'ESG' }))
    expect(screen.getByText('Needs Improvement')).toBeInTheDocument()
    expect(screen.getByText('Environmental')).toBeInTheDocument()
    expect(screen.getByText('Social')).toBeInTheDocument()
    expect(screen.getByText('Governance')).toBeInTheDocument()
  })

  it('Spend tab shows the supplier spend records and total', () => {
    renderDetail()
    fireEvent.click(screen.getByRole('button', { name: 'Spend' }))
    expect(screen.getByText('Total Spend: $68,550')).toBeInTheDocument()
    expect(screen.getAllByText('Monthly spend — Atlas Steelworks').length).toBe(6)
  })

  it('Spend tab Add Spend Record flow opens modal and adds a record', async () => {
    renderDetail()
    fireEvent.click(screen.getByRole('button', { name: 'Spend' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add Spend Record' }))
    expect(screen.getByRole('heading', { name: 'Add Spend Record' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '2500' } })
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Logistics' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Extra freight charge' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Record' }))

    await waitFor(() => expect(screen.getByText('Extra freight charge')).toBeInTheDocument())
  })
})
