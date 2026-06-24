import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PortalRequestModal from './PortalRequestModal'

const suppliers = [
  { id: 's1', name: 'Atlas Steelworks' },
  { id: 's2', name: 'Nordic Freight' },
]

describe('PortalRequestModal', () => {
  it('submits the entered request and closes', () => {
    const onSubmit = vi.fn()
    const onClose = vi.fn()
    render(<PortalRequestModal isOpen onClose={onClose} suppliers={suppliers} onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText(/Supplier/i), { target: { value: 's2' } })
    fireEvent.change(screen.getByLabelText(/Type/i), { target: { value: 'document' } })
    fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: 'Upload W-9' } })
    fireEvent.change(screen.getByLabelText(/Message/i), { target: { value: 'Please upload your W-9.' } })

    fireEvent.click(screen.getByRole('button', { name: /Create request/i }))

    expect(onSubmit).toHaveBeenCalledWith({
      supplierId: 's2',
      type: 'document',
      title: 'Upload W-9',
      message: 'Please upload your W-9.',
      dueDate: '',
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('disables submit until supplier and title are set', () => {
    render(<PortalRequestModal isOpen onClose={() => {}} suppliers={suppliers} onSubmit={() => {}} />)
    expect(screen.getByRole('button', { name: /Create request/i })).toBeDisabled()
  })
})
