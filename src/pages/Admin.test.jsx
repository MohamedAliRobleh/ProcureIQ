import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Admin from './Admin'
import { authState } from '../test/authState'

describe('Admin', () => {
  it('shows the org profile and danger zone for an admin, and clears data on confirm', async () => {
    const reload = vi.fn()
    Object.defineProperty(window, 'location', { value: { reload }, writable: true })
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ cleared: true }) }))
    vi.stubGlobal('fetch', fetchMock)

    render(<Admin />)
    expect(screen.getByTestId('org-profile')).toBeInTheDocument()
    expect(screen.getByText('Danger zone')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Clear all data' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'clear' } })
    fireEvent.click(screen.getByRole('button', { name: 'Delete everything' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/org/clear', expect.objectContaining({ method: 'POST' }))
    )
    await waitFor(() => expect(reload).toHaveBeenCalled())
  })

  it('shows an access-required notice for a non-admin member', () => {
    authState.membership = { role: 'org:member' }
    render(<Admin />)
    expect(screen.getByText('Admin access required')).toBeInTheDocument()
    expect(screen.queryByTestId('org-profile')).not.toBeInTheDocument()
    expect(screen.queryByText('Danger zone')).not.toBeInTheDocument()
  })

  it('downloads a JSON backup when the export button is clicked', async () => {
    const exportPayload = { exportedAt: '2026-06-25T00:00:00.000Z', orgId: 'org_test', data: { suppliers: [] } }
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => exportPayload }))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL: vi.fn() })
    const realCreate = document.createElement.bind(document)
    let clickedDownload = null
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = realCreate(tag)
      if (tag === 'a') vi.spyOn(el, 'click').mockImplementation(() => { clickedDownload = el.download })
      return el
    })

    render(<Admin />)
    fireEvent.click(screen.getByRole('button', { name: /Download backup/i }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/org/export', expect.anything())
    )
    await waitFor(() => expect(clickedDownload).toMatch(/^procureiq-backup-.*\.json$/))
  })
})
