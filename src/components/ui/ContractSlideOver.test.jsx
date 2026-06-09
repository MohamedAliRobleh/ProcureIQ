import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ContractSlideOver from './ContractSlideOver'

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

const mockSupplier = { id: 'sup_1', name: 'Atlas Steelworks' }

function renderSlideOver(props) {
  return render(
    <MemoryRouter>
      <ContractSlideOver {...props} />
    </MemoryRouter>
  )
}

describe('ContractSlideOver', () => {
  it('renders nothing when closed', () => {
    renderSlideOver({
      isOpen: false,
      onClose: () => {},
      contract: mockContract,
      supplier: mockSupplier,
      onEdit: () => {},
    })
    expect(screen.queryByText('Master Supply Agreement')).not.toBeInTheDocument()
  })

  it('shows contract title and supplier name when open', () => {
    renderSlideOver({
      isOpen: true,
      onClose: () => {},
      contract: mockContract,
      supplier: mockSupplier,
      onEdit: () => {},
    })
    expect(screen.getByText('Master Supply Agreement')).toBeInTheDocument()
    expect(screen.getByText('Atlas Steelworks')).toBeInTheDocument()
  })

  it('calls onEdit when Edit Contract button is clicked', () => {
    const onEdit = vi.fn()
    renderSlideOver({
      isOpen: true,
      onClose: () => {},
      contract: mockContract,
      supplier: mockSupplier,
      onEdit,
    })
    fireEvent.click(screen.getByRole('button', { name: 'Edit Contract' }))
    expect(onEdit).toHaveBeenCalled()
  })

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn()
    renderSlideOver({
      isOpen: true,
      onClose,
      contract: mockContract,
      supplier: mockSupplier,
      onEdit: () => {},
    })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when the overlay is clicked', () => {
    const onClose = vi.fn()
    renderSlideOver({
      isOpen: true,
      onClose,
      contract: mockContract,
      supplier: mockSupplier,
      onEdit: () => {},
    })
    fireEvent.click(screen.getByTestId('contract-slide-overlay'))
    expect(onClose).toHaveBeenCalled()
  })
})
