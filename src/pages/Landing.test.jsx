import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Landing from './Landing'

function renderLanding() {
  return render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>
  )
}

describe('Landing', () => {
  it('renders the hero with wordmark and tagline', () => {
    renderLanding()
    expect(screen.getByRole('heading', { level: 1, name: 'ProcureIQ' })).toBeInTheDocument()
    expect(screen.getByText('AI-powered procurement intelligence')).toBeInTheDocument()
  })

  it('renders an Open App CTA linking to the dashboard', () => {
    renderLanding()
    const cta = screen.getByRole('link', { name: /Open App/ })
    expect(cta).toHaveAttribute('href', '/dashboard')
  })

  it('renders 6 module feature cards', () => {
    renderLanding()
    for (const label of ['Dashboard', 'Suppliers', 'Contracts', 'Risk', 'ESG', 'Spend']) {
      expect(screen.getByRole('heading', { level: 3, name: label })).toBeInTheDocument()
    }
    expect(screen.queryByRole('heading', { level: 3, name: 'Admin' })).not.toBeInTheDocument()
  })
})
