import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PortalRequestSlideOver from './PortalRequestSlideOver'

const supplier = { id: 's1', name: 'Atlas Steelworks' }

function setup(request, props = {}) {
  return render(
    <MemoryRouter>
      <PortalRequestSlideOver
        isOpen
        onClose={() => {}}
        request={request}
        supplier={supplier}
        onUpdate={props.onUpdate ?? vi.fn()}
        onNotify={props.onNotify ?? vi.fn().mockResolvedValue({})}
        onDelete={props.onDelete ?? vi.fn()}
      />
    </MemoryRouter>
  )
}

describe('PortalRequestSlideOver', () => {
  it('marks a pending request submitted with a response note', () => {
    const onUpdate = vi.fn()
    setup({ id: 'preq_1', title: 'Submit ESG', type: 'esg_questionnaire', status: 'pending', message: 'do it', dueDate: null }, { onUpdate })
    fireEvent.change(screen.getByLabelText(/Response note/i), { target: { value: 'Got it via email' } })
    fireEvent.click(screen.getByRole('button', { name: /Mark submitted/i }))
    expect(onUpdate).toHaveBeenCalledWith({ status: 'submitted', responseNote: 'Got it via email' })
  })

  it('approves a submitted request', () => {
    const onUpdate = vi.fn()
    setup({ id: 'preq_1', title: 'x', type: 'document', status: 'submitted', message: null, dueDate: null }, { onUpdate })
    fireEvent.click(screen.getByRole('button', { name: /Approve/i }))
    expect(onUpdate).toHaveBeenCalledWith({ status: 'approved' })
  })

  it('rejects a submitted request', () => {
    const onUpdate = vi.fn()
    setup({ id: 'preq_1', title: 'x', type: 'document', status: 'submitted', message: null, dueDate: null }, { onUpdate })
    fireEvent.click(screen.getByRole('button', { name: /Reject/i }))
    expect(onUpdate).toHaveBeenCalledWith({ status: 'rejected' })
  })

  it('deletes after typing the confirm word', () => {
    const onDelete = vi.fn()
    setup({ id: 'preq_1', title: 'x', type: 'general', status: 'approved', message: null, dueDate: null }, { onDelete })
    fireEvent.click(screen.getByRole('button', { name: /^Delete request$/i }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'delete' } })
    fireEvent.click(screen.getByRole('button', { name: /^Delete$/i }))
    expect(onDelete).toHaveBeenCalled()
  })

  it('renders nothing when no request is given', () => {
    const { container } = setup(null)
    expect(container).toBeEmptyDOMElement()
  })

  it('hides status-action and delete controls when onUpdate/onDelete are not provided (read-only member)', () => {
    render(
      <MemoryRouter>
        <PortalRequestSlideOver
          isOpen
          onClose={() => {}}
          request={{ id: 'preq_1', title: 'Submit ESG', type: 'esg_questionnaire', status: 'pending', message: 'do it', dueDate: null }}
          supplier={supplier}
          onUpdate={undefined}
          onNotify={undefined}
          onDelete={undefined}
        />
      </MemoryRouter>
    )
    expect(screen.queryByRole('button', { name: /Mark submitted/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Approve/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Reject/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Email request/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Delete request$/i })).not.toBeInTheDocument()
  })

  it('hides the Approve/Reject controls for a submitted request when onUpdate is not provided', () => {
    render(
      <MemoryRouter>
        <PortalRequestSlideOver
          isOpen
          onClose={() => {}}
          request={{ id: 'preq_1', title: 'x', type: 'document', status: 'submitted', message: null, dueDate: null }}
          supplier={supplier}
          onUpdate={undefined}
          onNotify={undefined}
          onDelete={undefined}
        />
      </MemoryRouter>
    )
    expect(screen.queryByRole('button', { name: /Approve/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Reject/i })).not.toBeInTheDocument()
  })

  it('shows the status-action and delete controls when onUpdate/onDelete are provided', () => {
    setup({ id: 'preq_1', title: 'Submit ESG', type: 'esg_questionnaire', status: 'pending', message: 'do it', dueDate: null })
    expect(screen.getByRole('button', { name: /Mark submitted/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Delete request$/i })).toBeInTheDocument()
  })
})
