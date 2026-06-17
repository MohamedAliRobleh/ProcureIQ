import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import RequireOrg from './RequireOrg'
import { authState } from '../../test/authState'

describe('RequireOrg', () => {
  it('renders children when an organization is active', () => {
    render(<RequireOrg><p>org content</p></RequireOrg>)
    expect(screen.getByText('org content')).toBeInTheDocument()
  })

  it('shows a spinner while the organization is loading', () => {
    authState.orgLoaded = false
    render(<RequireOrg><p>org content</p></RequireOrg>)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByText('org content')).not.toBeInTheDocument()
  })

  it('shows the org selection screen when no organization is active', () => {
    authState.organization = null
    render(<RequireOrg><p>org content</p></RequireOrg>)
    expect(screen.getByText('Select or create an organization')).toBeInTheDocument()
    expect(screen.getByTestId('org-switcher')).toBeInTheDocument()
    expect(screen.queryByText('org content')).not.toBeInTheDocument()
  })
})
