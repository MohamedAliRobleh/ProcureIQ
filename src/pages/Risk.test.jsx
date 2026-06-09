import { describe, it, expect } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Risk from './Risk'

function renderRisk() {
  return render(
    <MemoryRouter>
      <Risk />
    </MemoryRouter>
  )
}

describe('Risk', () => {
  it('shows 4 risk level summary cards after loading', async () => {
    renderRisk()
    await waitFor(() => expect(screen.getAllByText('Low')).toHaveLength(2))
    expect(screen.getAllByText('Medium')).toHaveLength(2)
    expect(screen.getAllByText('High')).toHaveLength(2)
    expect(screen.getAllByText('Critical')).toHaveLength(2)
  })

  it('renders supplier names in the table after loading', async () => {
    renderRisk()
    await waitFor(() => expect(screen.getByText('Atlas Steelworks')).toBeInTheDocument())
  })

  it('filters the table by supplier name search', async () => {
    renderRisk()
    await waitFor(() => expect(screen.getByText('Atlas Steelworks')).toBeInTheDocument())
    fireEvent.change(screen.getByPlaceholderText('Search suppliers...'), {
      target: { value: 'atlas' },
    })
    expect(screen.getByText('Atlas Steelworks')).toBeInTheDocument()
    expect(screen.queryByText('Nordic Freight Solutions')).not.toBeInTheDocument()
  })
})
