import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SupplierProvider } from '../../context/SupplierContext'
import SpendModal from './SpendModal'
import { formatDateToInput } from '../../utils/formatters'

const mockRecord = {
  id: 'spend_1',
  supplierId: 'sup_1',
  amount: 12000,
  currency: 'USD',
  category: 'Logistics',
  description: 'Monthly spend — Atlas Steelworks',
  date: new Date('2026-04-05'),
  invoiceRef: 'INV-2026-0001',
}

function renderModal(props) {
  return render(
    <SupplierProvider>
      <SpendModal {...props} />
    </SupplierProvider>
  )
}

describe('SpendModal', () => {
  it('renders nothing when closed', () => {
    renderModal({ isOpen: false, onClose: () => {}, record: null, onSubmit: () => {} })
    expect(screen.queryByRole('heading', { name: 'Add Spend Record' })).not.toBeInTheDocument()
  })

  it('shows "Add Spend Record" title with empty fields and today\'s date when no record is provided', () => {
    renderModal({ isOpen: true, onClose: () => {}, record: null, onSubmit: () => {} })
    expect(screen.getByRole('heading', { name: 'Add Spend Record' })).toBeInTheDocument()
    expect(screen.getByLabelText('Amount')).toHaveValue(null)
    expect(screen.getByLabelText('Date')).toHaveValue(formatDateToInput(new Date()))
  })

  it('shows "Edit Spend Record" title pre-filled when editing', () => {
    renderModal({ isOpen: true, onClose: () => {}, record: mockRecord, onSubmit: () => {} })
    expect(screen.getByRole('heading', { name: 'Edit Spend Record' })).toBeInTheDocument()
    expect(screen.getByLabelText('Amount')).toHaveValue(12000)
    expect(screen.getByLabelText('Invoice Ref')).toHaveValue('INV-2026-0001')
    expect(screen.getByLabelText('Date')).toHaveValue('2026-04-05')
  })

  it('pre-fills supplierId from defaultSupplierId in add mode', async () => {
    renderModal({ isOpen: true, onClose: () => {}, record: null, onSubmit: () => {}, defaultSupplierId: 'sup_1' })
    await screen.findByRole('option', { name: 'Atlas Steelworks' })
    expect(screen.getByLabelText('Supplier')).toHaveValue('sup_1')
  })

  it('shows inline errors and blocks submit when supplier, amount, and category are empty', () => {
    const onSubmit = vi.fn()
    renderModal({ isOpen: true, onClose: () => {}, record: null, onSubmit })
    fireEvent.click(screen.getByRole('button', { name: 'Add Record' }))
    expect(screen.getByText('Supplier is required')).toBeInTheDocument()
    expect(screen.getByText('Amount is required')).toBeInTheDocument()
    expect(screen.getByText('Category is required')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('calls onSubmit with form data and onClose when form is valid', async () => {
    const onSubmit = vi.fn()
    const onClose = vi.fn()
    renderModal({ isOpen: true, onClose, record: null, onSubmit })
    await screen.findByRole('option', { name: 'Atlas Steelworks' })
    fireEvent.change(screen.getByLabelText('Supplier'), { target: { value: 'sup_1' } })
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '5000' } })
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Logistics' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Record' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ supplierId: 'sup_1', amount: 5000, category: 'Logistics' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows "Save Changes" button in edit mode', () => {
    renderModal({ isOpen: true, onClose: () => {}, record: mockRecord, onSubmit: () => {} })
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument()
  })
})
