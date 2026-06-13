import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import PageHeader from './PageHeader'
import ErrorBoundary from './ErrorBoundary'

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
})

describe('TopBar', () => {
  it('renders the demo organization, user info, and user menu', () => {
    render(<TopBar />)
    expect(screen.getByText('Procure IQ Demo Org')).toBeInTheDocument()
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
