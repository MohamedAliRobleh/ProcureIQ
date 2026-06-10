import { describe, it, expect } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SupplierProvider } from '../context/SupplierContext'
import ESG from './ESG'
import { esgResponses } from '../lib/mockData'
import { esgRating } from '../utils/esgSelectors'

function renderESG() {
  return render(
    <MemoryRouter>
      <SupplierProvider>
        <ESG />
      </SupplierProvider>
    </MemoryRouter>
  )
}

describe('ESG', () => {
  it('shows 4 summary cards with correct counts and average after loading', async () => {
    renderESG()
    await waitFor(() => expect(screen.getByText('Atlas Steelworks')).toBeInTheDocument())

    const portfolioAverage = Math.round(
      esgResponses.reduce((sum, r) => sum + r.score, 0) / esgResponses.length
    )
    const strongCount = esgResponses.filter((r) => esgRating(r.score) === 'strong').length
    const developingCount = esgResponses.filter((r) => esgRating(r.score) === 'developing').length
    const needsImprovementCount = esgResponses.filter((r) => esgRating(r.score) === 'needs-improvement').length

    expect(screen.getByText('Portfolio Average')).toBeInTheDocument()
    expect(screen.getByText(String(portfolioAverage))).toBeInTheDocument()
    expect(screen.getByText('Strong')).toBeInTheDocument()
    expect(screen.getByText(String(strongCount))).toBeInTheDocument()
    expect(screen.getByText('Developing')).toBeInTheDocument()
    expect(screen.getByText(String(developingCount))).toBeInTheDocument()
    expect(screen.getByText('Needs Improvement')).toBeInTheDocument()
    expect(screen.getByText(String(needsImprovementCount))).toBeInTheDocument()
  })

  it('renders supplier names in the table after loading', async () => {
    renderESG()
    await waitFor(() => expect(screen.getByText('Atlas Steelworks')).toBeInTheDocument())
  })

  it('filters the table by supplier name search', async () => {
    renderESG()
    await waitFor(() => expect(screen.getByText('Atlas Steelworks')).toBeInTheDocument())
    fireEvent.change(screen.getByPlaceholderText('Search suppliers...'), {
      target: { value: 'atlas' },
    })
    expect(screen.getByText('Atlas Steelworks')).toBeInTheDocument()
    expect(screen.queryByText('Nordic Freight Solutions')).not.toBeInTheDocument()
  })

  it('filters the table by rating', async () => {
    renderESG()
    await waitFor(() => expect(screen.getByText('Atlas Steelworks')).toBeInTheDocument())
    const select = screen.getByDisplayValue('All Ratings')
    fireEvent.change(select, { target: { value: 'strong' } })
    expect(screen.getByText('Voltaic Energy Systems')).toBeInTheDocument()
    expect(screen.queryByText('Atlas Steelworks')).not.toBeInTheDocument()
  })

  it('keeps filter controls visible while loading', () => {
    renderESG()
    expect(screen.getByPlaceholderText('Search suppliers...')).toBeInTheDocument()
    expect(screen.getByDisplayValue('All Ratings')).toBeInTheDocument()
  })
})
