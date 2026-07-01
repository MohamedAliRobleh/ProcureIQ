import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SandboxBadge from './SandboxBadge'
import { resetAuthState, authState, DEMO_ORG } from '../../test/authState'

beforeEach(() => resetAuthState())

describe('SandboxBadge', () => {
  it('renders nothing outside the demo org', () => {
    const { container } = render(<SandboxBadge />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the sandbox pill and a Reset control in the demo org', () => {
    authState.organization = DEMO_ORG
    render(<SandboxBadge />)
    expect(screen.getByText(/Sandbox — changes are local/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Reset/i })).toBeInTheDocument()
  })

  it('clears the sandbox and reloads on Reset', () => {
    authState.organization = DEMO_ORG
    const reload = vi.fn()
    Object.defineProperty(window, 'location', { value: { reload }, writable: true })
    localStorage.setItem('procureiq_sandbox_v1:suppliers', '[]')
    render(<SandboxBadge />)
    fireEvent.click(screen.getByRole('button', { name: /Reset/i }))
    expect(localStorage.getItem('procureiq_sandbox_v1:suppliers')).toBeNull()
    expect(reload).toHaveBeenCalled()
  })
})
