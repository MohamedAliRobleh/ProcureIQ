import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ContractProvider } from '../context/ContractContext'
import { SpendProvider } from '../context/SpendContext'
import { SupplierProvider } from '../context/SupplierContext'
import Dashboard from './Dashboard'
import { suppliers, contracts, riskAssessments } from '../lib/mockData'
import { getAverageRiskScore } from '../utils/dashboardSelectors'
import { authState } from '../test/authState'

describe('Dashboard', () => {
  it('shows a loading state, then the computed stat cards and AI insight', async () => {
    render(
      <SupplierProvider>
        <ContractProvider>
          <SpendProvider>
            <Dashboard />
          </SpendProvider>
        </ContractProvider>
      </SupplierProvider>
    )
    expect(screen.getByRole('status')).toBeInTheDocument()

    await waitFor(() => expect(screen.getByText('Total Suppliers')).toBeInTheDocument())

    expect(screen.getByText(String(suppliers.length))).toBeInTheDocument()

    const activeContracts = contracts.filter((c) => c.status === 'active')
    expect(screen.getByText('Active Contracts')).toBeInTheDocument()
    expect(screen.getByText(String(activeContracts.length))).toBeInTheDocument()

    expect(screen.getByText('Avg Risk Score')).toBeInTheDocument()
    expect(screen.getByText(String(getAverageRiskScore(riskAssessments)))).toBeInTheDocument()

    expect(screen.getByText('AI Insight of the Day')).toBeInTheDocument()
    expect(screen.getByText('Recent Activity')).toBeInTheDocument()
    expect(screen.getByText('Expiring Contracts')).toBeInTheDocument()
    expect(screen.getByText('Top Suppliers by Spend')).toBeInTheDocument()
  })
})

describe('Dashboard — empty org', () => {
  it('shows the Load sample data panel and seeds on click', async () => {
    const reload = vi.fn()
    Object.defineProperty(window, 'location', { value: { reload }, writable: true })

    const fetchMock = vi.fn(async (url, options = {}) => {
      const method = options.method ?? 'GET'
      if (method === 'POST' && url === '/api/org/seed') {
        return { ok: true, status: 200, json: async () => ({ seeded: true }) }
      }
      return { ok: true, status: 200, json: async () => [] }
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <SupplierProvider>
        <ContractProvider>
          <SpendProvider>
            <Dashboard />
          </SpendProvider>
        </ContractProvider>
      </SupplierProvider>
    )

    const button = await screen.findByRole('button', { name: 'Load sample data' })
    expect(screen.getByText('Your organization is empty')).toBeInTheDocument()

    fireEvent.click(button)

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/org/seed', expect.objectContaining({ method: 'POST' }))
    )
    await waitFor(() => expect(reload).toHaveBeenCalled())
  })

  it('shows a member note instead of the seed button on an empty org', async () => {
    authState.membership = { role: 'org:member' }

    const fetchMock = vi.fn(async (url, options = {}) => {
      const method = options.method ?? 'GET'
      if (method === 'POST' && url === '/api/org/seed') {
        return { ok: true, status: 200, json: async () => ({ seeded: true }) }
      }
      return { ok: true, status: 200, json: async () => [] }
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <SupplierProvider>
        <ContractProvider>
          <SpendProvider>
            <Dashboard />
          </SpendProvider>
        </ContractProvider>
      </SupplierProvider>
    )

    expect(await screen.findByText(/Ask an organization admin to load data/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Load sample data/i })).not.toBeInTheDocument()
  })
})
