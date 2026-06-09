import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SupplierModal from './SupplierModal'

const mockSupplier = {
  name: 'Atlas Steelworks',
  email: 'contact@atlas.com',
  phone: '+1-555-0100',
  country: 'United States',
  category: 'Raw Materials',
  status: 'active',
  website: 'https://atlas.com',
  description: 'A steel supplier.',
}

describe('SupplierModal', () => {
  it('renders nothing when closed', () => {
    render(<SupplierModal isOpen={false} onClose={() => {}} supplier={null} onSubmit={() => {}} />)
    expect(screen.queryByRole('heading', { name: 'Add Supplier' })).not.toBeInTheDocument()
  })

  it('shows "Add Supplier" title with empty name field when no supplier is provided', () => {
    render(<SupplierModal isOpen onClose={() => {}} supplier={null} onSubmit={() => {}} />)
    expect(screen.getByRole('heading', { name: 'Add Supplier' })).toBeInTheDocument()
    expect(screen.getByLabelText('Supplier Name')).toHaveValue('')
  })

  it('shows "Edit Supplier" title pre-filled with supplier data', () => {
    render(<SupplierModal isOpen onClose={() => {}} supplier={mockSupplier} onSubmit={() => {}} />)
    expect(screen.getByRole('heading', { name: 'Edit Supplier' })).toBeInTheDocument()
    expect(screen.getByLabelText('Supplier Name')).toHaveValue('Atlas Steelworks')
    expect(screen.getByLabelText('Email')).toHaveValue('contact@atlas.com')
  })

  it('shows inline errors and blocks submit when name and email are empty', () => {
    const onSubmit = vi.fn()
    render(<SupplierModal isOpen onClose={() => {}} supplier={null} onSubmit={onSubmit} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add Supplier' }))
    expect(screen.getByText('Name is required')).toBeInTheDocument()
    expect(screen.getByText('Email is required')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('calls onSubmit with form data and onClose when form is valid', () => {
    const onSubmit = vi.fn()
    const onClose = vi.fn()
    render(<SupplierModal isOpen onClose={onClose} supplier={null} onSubmit={onSubmit} />)
    fireEvent.change(screen.getByLabelText('Supplier Name'), { target: { value: 'New Corp' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@corp.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Supplier' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Corp', email: 'new@corp.com' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows "Save Changes" submit button in edit mode', () => {
    render(<SupplierModal isOpen onClose={() => {}} supplier={mockSupplier} onSubmit={() => {}} />)
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument()
  })
})
