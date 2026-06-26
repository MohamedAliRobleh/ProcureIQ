import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Billing from './Billing'
import { authState } from '../test/authState'

describe('Billing', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('shows the three plan tiers with a Current badge on Free for an admin', () => {
    render(<Billing />)
    expect(screen.getByRole('heading', { name: 'Billing' })).toBeInTheDocument()
    expect(screen.getByText('Free')).toBeInTheDocument()
    expect(screen.getByText('Pro')).toBeInTheDocument()
    expect(screen.getByText('Enterprise')).toBeInTheDocument()
    expect(screen.getByText('Current plan')).toBeInTheDocument()
  })

  it('calls checkout when an upgrade button is clicked', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ url: 'https://x' }) }))
    vi.stubGlobal('fetch', fetchMock)
    // jsdom: assigning location.href throws; stub it with an assign() spy instead
    Object.defineProperty(window, 'location', { writable: true, value: { href: '', assign: vi.fn() } })
    render(<Billing />)
    fireEvent.click(screen.getAllByRole('button', { name: /Upgrade/i })[0])
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/billing/checkout', expect.objectContaining({ method: 'POST' }))
    )
  })

  it('shows a graceful message when checkout is not configured (503)', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 503, json: async () => ({ error: 'Billing is not configured' }) }))
    vi.stubGlobal('fetch', fetchMock)
    render(<Billing />)
    fireEvent.click(screen.getAllByRole('button', { name: /Upgrade/i })[0])
    expect(await screen.findByText(/Billing isn't set up yet/i)).toBeInTheDocument()
  })

  it('shows an access-required notice for a non-admin member', () => {
    authState.membership = { role: 'org:member' }
    render(<Billing />)
    expect(screen.getByText('Admin access required')).toBeInTheDocument()
    expect(screen.queryByText('Pro')).not.toBeInTheDocument()
  })
})
