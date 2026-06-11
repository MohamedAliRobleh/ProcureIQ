import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SupplierProvider } from '../context/SupplierContext'
import { SpendProvider } from '../context/SpendContext'
import Spend from './Spend'
import { spendRecords, suppliers } from '../lib/mockData'
import { formatCompactCurrency } from '../utils/formatters'

function renderSpend() {
  return render(
    <MemoryRouter>
      <SupplierProvider>
        <SpendProvider>
          <Spend />
        </SpendProvider>
      </SupplierProvider>
    </MemoryRouter>
  )
}

describe('Spend', () => {
  it('renders page heading and stat cards with correct totals', () => {
    renderSpend()
    expect(screen.getByRole('heading', { name: 'Spend' })).toBeInTheDocument()
    const totalSpend = spendRecords.reduce((sum, r) => sum + r.amount, 0)
    expect(screen.getByText('Total Spend')).toBeInTheDocument()
    expect(screen.getByText(formatCompactCurrency(totalSpend))).toBeInTheDocument()
    expect(screen.getByText('This Month')).toBeInTheDocument()
    expect(screen.getByText('Top Category')).toBeInTheDocument()
    expect(screen.getByText('Suppliers Tracked')).toBeInTheDocument()
  })

  it('renders the spend records table with a seeded record', () => {
    renderSpend()
    expect(screen.getByText(spendRecords[0].invoiceRef)).toBeInTheDocument()
  })

  it('filters the table by supplier name search', () => {
    renderSpend()
    fireEvent.change(screen.getByPlaceholderText('Search spend records...'), {
      target: { value: 'Atlas' },
    })
    expect(screen.getAllByText('Monthly spend — Atlas Steelworks').length).toBeGreaterThan(0)
    expect(screen.queryByText('Monthly spend — Meridian Manufacturing')).not.toBeInTheDocument()
  })

  it('opens the Add Spend Record modal and adds a record to the table', async () => {
    renderSpend()
    fireEvent.click(screen.getByRole('button', { name: 'Add Spend Record' }))
    expect(screen.getByRole('heading', { name: 'Add Spend Record' })).toBeInTheDocument()

    await within(screen.getByLabelText('Supplier')).findByRole('option', { name: 'Atlas Steelworks' })
    fireEvent.change(screen.getByLabelText('Supplier'), { target: { value: suppliers[0].id } })
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '7500' } })
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Logistics' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'New consulting fee' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Record' }))

    await waitFor(() => expect(screen.getByText('New consulting fee')).toBeInTheDocument())
  })
})
