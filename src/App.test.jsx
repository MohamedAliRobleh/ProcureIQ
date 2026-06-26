import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import App from './App'
import { authState } from './test/authState'

describe('App', () => {
  it('renders the public landing page at the root route', async () => {
    window.history.pushState({}, '', '/')
    render(<App />)
    expect(await screen.findByRole('link', { name: /Open App/ })).toBeInTheDocument()
    expect(screen.getByText('AI-powered procurement intelligence')).toBeInTheDocument()
  })

  it('renders the Suppliers list page at /suppliers', async () => {
    window.history.pushState({}, '', '/suppliers')
    render(<App />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Suppliers' })).toBeInTheDocument())
    expect(screen.getByPlaceholderText('Search suppliers...')).toBeInTheDocument()
  })

  it('renders the Contracts list page at /contracts', async () => {
    window.history.pushState({}, '', '/contracts')
    render(<App />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Contracts' })).toBeInTheDocument())
    expect(screen.getByPlaceholderText('Search contracts...')).toBeInTheDocument()
  })

  it('renders the Risk dashboard page at /risk', async () => {
    window.history.pushState({}, '', '/risk')
    render(<App />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Risk' })).toBeInTheDocument())
    expect(screen.getByPlaceholderText('Search suppliers...')).toBeInTheDocument()
  })

  it('renders the ESG dashboard page at /esg', async () => {
    window.history.pushState({}, '', '/esg')
    render(<App />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'ESG' })).toBeInTheDocument())
    expect(screen.getByPlaceholderText('Search suppliers...')).toBeInTheDocument()
  })

  it('renders the Spend dashboard page at /spend', async () => {
    window.history.pushState({}, '', '/spend')
    render(<App />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Spend' })).toBeInTheDocument())
    expect(screen.getByPlaceholderText('Search spend records...')).toBeInTheDocument()
  })

  it('renders the AI Assistant page at /ai-assistant', async () => {
    window.history.pushState({}, '', '/ai-assistant')
    render(<App />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'AI Assistant' })).toBeInTheDocument())
    expect(screen.getByPlaceholderText('Ask about suppliers, contracts, spend...')).toBeInTheDocument()
  })

  it('renders the Supplier Portal page at /portal', async () => {
    window.history.pushState({}, '', '/portal')
    render(<App />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Supplier Portal' })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /New request/i })).toBeInTheDocument()
  })

  it('renders the Billing page at /billing', async () => {
    window.history.pushState({}, '', '/billing')
    render(<App />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Billing' })).toBeInTheDocument())
  })

  it('renders the embedded sign-in at /sign-in', async () => {
    window.history.pushState({}, '', '/sign-in')
    render(<App />)
    expect(await screen.findByTestId('clerk-sign-in')).toBeInTheDocument()
  })

  it('renders the embedded sign-up at /sign-up', async () => {
    window.history.pushState({}, '', '/sign-up')
    render(<App />)
    expect(await screen.findByTestId('clerk-sign-up')).toBeInTheDocument()
  })

  it('redirects app routes to sign-in when signed out', async () => {
    authState.isSignedIn = false
    window.history.pushState({}, '', '/dashboard')
    render(<App />)
    expect(await screen.findByTestId('clerk-sign-in')).toBeInTheDocument()
  })
})
