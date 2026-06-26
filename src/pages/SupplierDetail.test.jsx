import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SupplierProvider } from '../context/SupplierContext'
import { ContractProvider } from '../context/ContractContext'
import { SpendProvider } from '../context/SpendContext'
import { authState } from '../test/authState'
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
  it('renders the supplier name and Overview tab by default', async () => {
    renderDetail()
    expect(await screen.findByText('Atlas Steelworks')).toBeInTheDocument()
    expect(screen.getByText('Contact Information')).toBeInTheDocument()
  })

  it('shows a Suspend button for an active supplier that toggles to Activate after click', async () => {
    renderDetail()
    const suspendBtn = await screen.findByRole('button', { name: 'Suspend' })
    fireEvent.click(suspendBtn)
    expect(await screen.findByRole('button', { name: 'Activate' })).toBeInTheDocument()
  })

  it('Contracts tab shows the supplier contracts table', async () => {
    renderDetail()
    fireEvent.click(await screen.findByRole('button', { name: 'Contracts' }))
    expect(await screen.findByText('Master Supply Agreement — Atlas Steelworks')).toBeInTheDocument()
  })

  it('Risk tab shows sub-score cards for the supplier', async () => {
    renderDetail()
    fireEvent.click(await screen.findByRole('button', { name: 'Risk' }))
    expect(await screen.findByText('Financial Risk')).toBeInTheDocument()
    expect(screen.getByText('Compliance Risk')).toBeInTheDocument()
    expect(screen.getByText('Operational Risk')).toBeInTheDocument()
    expect(screen.getByText('Geopolitical Risk')).toBeInTheDocument()
  })

  it('shows a not-found message for an unknown supplier id', async () => {
    renderDetail('sup_unknown_999')
    expect(await screen.findByRole('heading', { name: 'Supplier not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Back to Suppliers/i })).toBeInTheDocument()
  })

  it('opens the Edit Supplier modal when Edit is clicked', async () => {
    renderDetail()
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    expect(screen.getByRole('heading', { name: 'Edit Supplier' })).toBeInTheDocument()
  })

  it('hides write controls for a read-only member', async () => {
    authState.membership = { role: 'org:member' }
    renderDetail()
    await screen.findByText('Atlas Steelworks')
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Suspend' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Activate' })).not.toBeInTheDocument()
  })

  it('hides contract write controls on the Contracts tab for a read-only member', async () => {
    authState.membership = { role: 'org:member' }
    renderDetail()
    fireEvent.click(await screen.findByRole('button', { name: 'Contracts' }))
    expect(await screen.findByText('Master Supply Agreement — Atlas Steelworks')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add Contract' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })

  it('hides spend write controls on the Spend tab for a read-only member', async () => {
    authState.membership = { role: 'org:member' }
    renderDetail()
    fireEvent.click(await screen.findByRole('button', { name: 'Spend' }))
    expect(await screen.findByText('Total Spend: $68,550')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add Spend Record' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })

  it('ESG tab shows rating, score, and sub-score cards for the supplier', async () => {
    renderDetail()
    fireEvent.click(await screen.findByRole('button', { name: 'ESG' }))
    expect(await screen.findByText('Needs Improvement')).toBeInTheDocument()
    expect(screen.getByText('Environmental')).toBeInTheDocument()
    expect(screen.getByText('Social')).toBeInTheDocument()
    expect(screen.getByText('Governance')).toBeInTheDocument()
  })

  it('Spend tab shows the supplier spend records and total', async () => {
    renderDetail()
    fireEvent.click(await screen.findByRole('button', { name: 'Spend' }))
    expect(await screen.findByText('Total Spend: $68,550')).toBeInTheDocument()
    expect(screen.getAllByText('Monthly spend — Atlas Steelworks').length).toBe(6)
  })

  it('Spend tab Add Spend Record flow opens modal and adds a record', async () => {
    renderDetail()
    fireEvent.click(await screen.findByRole('button', { name: 'Spend' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add Spend Record' }))
    expect(screen.getByRole('heading', { name: 'Add Spend Record' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '2500' } })
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Logistics' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Extra freight charge' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Record' }))

    await waitFor(() => expect(screen.getByText('Extra freight charge')).toBeInTheDocument())
  })
})
