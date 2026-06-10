import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('redirects the root route to the Dashboard and renders the shell', async () => {
    window.history.pushState({}, '', '/')
    render(<App />)
    await waitFor(() => expect(screen.getByText('Total Suppliers')).toBeInTheDocument())
    expect(screen.getByText('ProcureIQ', { exact: false })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Suppliers/ })).toBeInTheDocument()
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

  it('renders a placeholder page for not-yet-built modules', async () => {
    window.history.pushState({}, '', '/ai-assistant')
    render(<App />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'AI Assistant' })).toBeInTheDocument())
    expect(screen.getByText(/coming in Phase 5/i)).toBeInTheDocument()
  })
})
