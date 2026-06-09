import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SupplierProvider } from '../../context/SupplierContext'
import ContractModal from './ContractModal'

const mockContract = {
  id: 'con_1',
  title: 'Master Supply Agreement',
  supplierId: 'sup_1',
  value: 600000,
  currency: 'USD',
  startDate: new Date('2025-01-12'),
  endDate: new Date('2026-07-22'),
  status: 'active',
  autoRenew: true,
  terms: 'Net-30 payment terms.',
}

function renderModal(props) {
  return render(
    <SupplierProvider>
      <ContractModal {...props} />
    </SupplierProvider>
  )
}

describe('ContractModal', () => {
  it('renders nothing when closed', () => {
    renderModal({ isOpen: false, onClose: () => {}, contract: null, onSubmit: () => {} })
    expect(screen.queryByRole('heading', { name: 'Add Contract' })).not.toBeInTheDocument()
  })

  it('shows "Add Contract" title with empty title field when no contract is provided', () => {
    renderModal({ isOpen: true, onClose: () => {}, contract: null, onSubmit: () => {} })
    expect(screen.getByRole('heading', { name: 'Add Contract' })).toBeInTheDocument()
    expect(screen.getByLabelText('Contract Title')).toHaveValue('')
  })

  it('shows "Edit Contract" title pre-filled when editing', () => {
    renderModal({ isOpen: true, onClose: () => {}, contract: mockContract, onSubmit: () => {} })
    expect(screen.getByRole('heading', { name: 'Edit Contract' })).toBeInTheDocument()
    expect(screen.getByLabelText('Contract Title')).toHaveValue('Master Supply Agreement')
  })

  it('shows inline errors and blocks submit when title, supplier, and value are empty', () => {
    const onSubmit = vi.fn()
    renderModal({ isOpen: true, onClose: () => {}, contract: null, onSubmit })
    fireEvent.click(screen.getByRole('button', { name: 'Add Contract' }))
    expect(screen.getByText('Title is required')).toBeInTheDocument()
    expect(screen.getByText('Supplier is required')).toBeInTheDocument()
    expect(screen.getByText('Value is required')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('calls onSubmit with form data and onClose when form is valid', () => {
    const onSubmit = vi.fn()
    const onClose = vi.fn()
    renderModal({ isOpen: true, onClose, contract: null, onSubmit })
    fireEvent.change(screen.getByLabelText('Contract Title'), { target: { value: 'New Deal' } })
    fireEvent.change(screen.getByLabelText('Supplier'), { target: { value: 'sup_1' } })
    fireEvent.change(screen.getByLabelText('Value (USD)'), { target: { value: '100000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Contract' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ title: 'New Deal', value: 100000 }))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows "Save Changes" button in edit mode', () => {
    renderModal({ isOpen: true, onClose: () => {}, contract: mockContract, onSubmit: () => {} })
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument()
  })
})
