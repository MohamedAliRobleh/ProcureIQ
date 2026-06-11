import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SupplierProvider } from '../context/SupplierContext'
import { ContractProvider } from '../context/ContractContext'
import Contracts from './Contracts'

function renderContracts() {
  return render(
    <MemoryRouter>
      <SupplierProvider>
        <ContractProvider>
          <Contracts />
        </ContractProvider>
      </SupplierProvider>
    </MemoryRouter>
  )
}

describe('Contracts', () => {
  it('renders page heading and at least one seeded contract', async () => {
    renderContracts()
    expect(screen.getByRole('heading', { name: 'Contracts' })).toBeInTheDocument()
    expect(await screen.findByText('Master Supply Agreement — Atlas Steelworks')).toBeInTheDocument()
  })

  it('renders 4 stat cards with labelled headings', () => {
    renderContracts()
    expect(screen.getByText('Total Value')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Expiring <30d')).toBeInTheDocument()
    expect(screen.getByText('Expired')).toBeInTheDocument()
  })

  it('filters contracts by search text', async () => {
    renderContracts()
    expect(await screen.findByText('Master Supply Agreement — Atlas Steelworks')).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('Search contracts...'), {
      target: { value: 'Master Supply' },
    })
    expect(screen.getByText('Master Supply Agreement — Atlas Steelworks')).toBeInTheDocument()
    expect(screen.queryByText('Annual Logistics Contract — Nordic Freight Solutions')).not.toBeInTheDocument()
  })

  it('opens the ContractSlideOver when a contract title is clicked', async () => {
    renderContracts()
    fireEvent.click(await screen.findByText('Master Supply Agreement — Atlas Steelworks'))
    expect(screen.getByRole('heading', { level: 2, name: 'Master Supply Agreement — Atlas Steelworks' })).toBeInTheDocument()
  })
})
