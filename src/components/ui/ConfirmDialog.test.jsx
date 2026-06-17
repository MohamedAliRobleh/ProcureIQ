import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ConfirmDialog from './ConfirmDialog'

function setup(props = {}) {
  const onConfirm = vi.fn()
  const onClose = vi.fn()
  render(
    <ConfirmDialog
      isOpen
      onClose={onClose}
      onConfirm={onConfirm}
      title="Clear all data?"
      description="This cannot be undone."
      confirmWord="clear"
      confirmLabel="Delete everything"
      {...props}
    />
  )
  return { onConfirm, onClose }
}

describe('ConfirmDialog', () => {
  it('keeps confirm disabled until the exact word is typed', () => {
    const { onConfirm } = setup()
    const confirm = screen.getByRole('button', { name: 'Delete everything' })
    expect(confirm).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'clea' } })
    expect(confirm).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'clear' } })
    expect(confirm).toBeEnabled()
    fireEvent.click(confirm)
    expect(onConfirm).toHaveBeenCalled()
  })

  it('calls onClose from the Cancel button', () => {
    const { onClose } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('clears the typed phrase when the dialog is closed and reopened by the parent', () => {
    const props = {
      onClose: vi.fn(),
      onConfirm: vi.fn(),
      title: 'Clear all data?',
      description: 'This cannot be undone.',
      confirmWord: 'clear',
      confirmLabel: 'Delete everything',
    }
    const { rerender } = render(<ConfirmDialog isOpen {...props} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'clear' } })
    expect(screen.getByRole('button', { name: 'Delete everything' })).toBeEnabled()

    // Parent closes the dialog directly (e.g. after a failed action), then reopens it.
    rerender(<ConfirmDialog isOpen={false} {...props} />)
    rerender(<ConfirmDialog isOpen {...props} />)

    expect(screen.getByRole('textbox')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Delete everything' })).toBeDisabled()
  })
})
