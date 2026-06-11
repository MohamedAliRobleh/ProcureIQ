import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ContractProvider } from '../context/ContractContext'
import { SpendProvider } from '../context/SpendContext'
import { SupplierProvider } from '../context/SupplierContext'
import Dashboard from './Dashboard'
import { suppliers, contracts, riskAssessments } from '../lib/mockData'
import { getAverageRiskScore } from '../utils/dashboardSelectors'

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
