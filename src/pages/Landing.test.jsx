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

  it('renders a "Sign in to the demo" CTA linking to the sign-in page', () => {
    renderLanding()
    const cta = screen.getByRole('link', { name: /Sign in to the demo/ })
    expect(cta).toHaveAttribute('href', '/sign-in')
  })

  it('renders 6 module feature cards', () => {
    renderLanding()
    for (const label of ['Dashboard', 'Suppliers', 'Contracts', 'Risk', 'ESG', 'Spend']) {
      expect(screen.getByRole('heading', { level: 3, name: label })).toBeInTheDocument()
    }
    expect(screen.queryByRole('heading', { level: 3, name: 'Admin' })).not.toBeInTheDocument()
  })
})
