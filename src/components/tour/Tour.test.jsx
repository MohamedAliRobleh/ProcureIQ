import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TourProvider, useTour } from './TourProvider'
import Tour from './Tour'
import { resetAuthState, authState, DEMO_ORG } from '../../test/authState'

function StartButton() {
  const { start } = useTour()
  return <button onClick={start}>go</button>
}

beforeEach(() => {
  resetAuthState()
  authState.organization = DEMO_ORG
  localStorage.setItem('procureiq_tour_done_v1', '1') // prevent auto-start; we start manually
})

describe('Tour', () => {
  it('is not visible until started', () => {
    render(
      <TourProvider>
        <Tour />
      </TourProvider>
    )
    expect(screen.queryByText(/Welcome to the ProcureIQ demo/i)).not.toBeInTheDocument()
  })

  it('shows the first step and advances on Next', () => {
    render(
      <TourProvider>
        <StartButton />
        <Tour />
      </TourProvider>
    )
    fireEvent.click(screen.getByText('go'))
    expect(screen.getByText(/Welcome to the ProcureIQ demo/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Next/i }))
    expect(screen.getByText(/Every module, one click away/i)).toBeInTheDocument()
  })

  it('closes on Skip', () => {
    render(
      <TourProvider>
        <StartButton />
        <Tour />
      </TourProvider>
    )
    fireEvent.click(screen.getByText('go'))
    fireEvent.click(screen.getByRole('button', { name: /Skip/i }))
    expect(screen.queryByText(/Welcome to the ProcureIQ demo/i)).not.toBeInTheDocument()
  })
})
