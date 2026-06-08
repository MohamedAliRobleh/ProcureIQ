import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PlaceholderPage from './PlaceholderPage'

describe('PlaceholderPage', () => {
  it('renders the module title and the phase it is scheduled for', () => {
    render(<PlaceholderPage title="Suppliers" phase="Phase 2" />)
    expect(screen.getByRole('heading', { name: 'Suppliers' })).toBeInTheDocument()
    expect(screen.getByText(/coming in Phase 2/)).toBeInTheDocument()
  })
})
