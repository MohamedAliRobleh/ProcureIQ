import { describe, it, expect } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { authState } from '../../test/authState'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import PageHeader from './PageHeader'
import ErrorBoundary from './ErrorBoundary'
import { TourProvider } from '../tour/TourProvider'

describe('Sidebar', () => {
  it('renders a nav link for every module', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    )
    expect(screen.getByRole('link', { name: /Dashboard/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Suppliers/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /AI Assistant/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Admin/ })).toBeInTheDocument()
  })

  it('hides the Admin link for non-admin members', () => {
    authState.membership = { role: 'org:member' }
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    )
    expect(screen.queryByRole('link', { name: /Admin/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Dashboard/ })).toBeInTheDocument()
  })

  it('shows the Billing link for an admin and hides it for a member', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    )
    expect(screen.getByRole('link', { name: /Billing/ })).toBeInTheDocument()

    cleanup()
    authState.membership = { role: 'org:member' }
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    )
    expect(screen.queryByRole('link', { name: /Billing/ })).not.toBeInTheDocument()
  })

  it('shows the active org name in the header, with a ProcureIQ fallback', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    )
    expect(screen.getByText(authState.organization.name)).toBeInTheDocument()

    cleanup()
    authState.organization = null
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    )
    expect(screen.getByText('ProcureIQ')).toBeInTheDocument()
  })
})

describe('TopBar', () => {
  it('renders the organization switcher, user info, and user menu', () => {
    render(
      <TourProvider>
        <TopBar />
      </TourProvider>
    )
    expect(screen.getByTestId('org-switcher')).toBeInTheDocument()
    expect(screen.getByText('Amara Chen')).toBeInTheDocument()
    expect(screen.getByTestId('user-button')).toBeInTheDocument()
  })
})

describe('PageHeader', () => {
  it('renders title, description, breadcrumb, and actions', () => {
    render(
      <PageHeader
        title="Suppliers"
        description="Manage your supplier relationships"
        breadcrumb={['Home', 'Suppliers']}
        actions={<button>Add Supplier</button>}
      />
    )
    expect(screen.getByRole('heading', { name: 'Suppliers' })).toBeInTheDocument()
    expect(screen.getByText('Manage your supplier relationships')).toBeInTheDocument()
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add Supplier' })).toBeInTheDocument()
  })
})

function Boom() {
  throw new Error('boom')
}

describe('ErrorBoundary', () => {
  it('renders a friendly fallback when a child throws', () => {
    const originalError = console.error
    console.error = () => {}
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    console.error = originalError
  })

  it('renders children normally when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>all good</p>
      </ErrorBoundary>
    )
    expect(screen.getByText('all good')).toBeInTheDocument()
  })
})
