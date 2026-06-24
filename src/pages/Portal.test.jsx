import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SupplierProvider } from '../context/SupplierContext'
import { PortalProvider } from '../context/PortalContext'
import Portal from './Portal'

function renderPortal() {
  return render(
    <MemoryRouter>
      <SupplierProvider>
        <PortalProvider>
          <Portal />
        </PortalProvider>
      </SupplierProvider>
    </MemoryRouter>
  )
}

describe('Portal page', () => {
  it('lists requests with supplier name and status', async () => {
    renderPortal()
    expect(screen.getByRole('heading', { name: 'Supplier Portal' })).toBeInTheDocument()
    expect(await screen.findByText('Submit 2026 ESG questionnaire')).toBeInTheDocument()
    expect(screen.getByText('Atlas Steelworks')).toBeInTheDocument()
  })

  it('opens the create modal from the New request button', () => {
    renderPortal()
    fireEvent.click(screen.getByRole('button', { name: /New request/i }))
    expect(screen.getByText('New supplier request')).toBeInTheDocument()
  })

  it('opens the slide-over when a request row is clicked', async () => {
    renderPortal()
    fireEvent.click(await screen.findByText('Submit 2026 ESG questionnaire'))
    expect(screen.getByRole('button', { name: /Mark submitted/i })).toBeInTheDocument()
  })

  it('filters by status', async () => {
    renderPortal()
    expect(await screen.findByText('Submit 2026 ESG questionnaire')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Status/i), { target: { value: 'approved' } })
    expect(screen.queryByText('Submit 2026 ESG questionnaire')).not.toBeInTheDocument()
  })
})
