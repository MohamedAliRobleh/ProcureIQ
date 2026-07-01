import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Routes, Route } from 'react-router-dom'
import AppShell from './AppShell'
import { resetAuthState, authState, DEMO_ORG } from '../../test/authState'

function renderShell() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<p>dash</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

describe('AppShell tour wiring', () => {
  beforeEach(() => {
    resetAuthState()
    localStorage.clear()
  })

  it('auto-starts the tour on first demo visit', async () => {
    authState.organization = DEMO_ORG
    renderShell()
    expect(await screen.findByText(/Welcome to the ProcureIQ demo/i)).toBeInTheDocument()
  })

  it('does not start the tour outside the demo org', () => {
    renderShell() // default org is non-demo
    expect(screen.queryByText(/Welcome to the ProcureIQ demo/i)).not.toBeInTheDocument()
  })

  it('does not auto-start again once done', () => {
    authState.organization = DEMO_ORG
    localStorage.setItem('procureiq_tour_done_v1', '1')
    renderShell()
    expect(screen.queryByText(/Welcome to the ProcureIQ demo/i)).not.toBeInTheDocument()
  })
})
