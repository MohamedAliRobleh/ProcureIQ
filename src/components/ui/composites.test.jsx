import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Building2 } from 'lucide-react'
import StatCard from './StatCard'
import AIInsightBox from './AIInsightBox'
import Modal from './Modal'
import DataTable from './DataTable'

describe('StatCard', () => {
  it('renders the label, value, and icon', () => {
    render(<StatCard label="Total Suppliers" value={20} icon={Building2} />)
    expect(screen.getByText('Total Suppliers')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
  })
})

describe('AIInsightBox', () => {
  it('renders a title and body content', () => {
    render(<AIInsightBox title="AI Insight">Some narrative text.</AIInsightBox>)
    expect(screen.getByText('AI Insight')).toBeInTheDocument()
    expect(screen.getByText('Some narrative text.')).toBeInTheDocument()
  })
})

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(<Modal isOpen={false} onClose={() => {}} title="Edit Supplier">body</Modal>)
    expect(screen.queryByText('Edit Supplier')).not.toBeInTheDocument()
  })

  it('renders title and content when open, and calls onClose', async () => {
    const onClose = vi.fn()
    render(<Modal isOpen onClose={onClose} title="Edit Supplier">body content</Modal>)
    expect(screen.getByText('Edit Supplier')).toBeInTheDocument()
    expect(screen.getByText('body content')).toBeInTheDocument()
    screen.getByLabelText('Close').click()
    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('DataTable', () => {
  const columns = [
    { key: 'name', header: 'Name' },
    { key: 'country', header: 'Country' },
  ]

  it('shows a loading spinner while loading', () => {
    render(<DataTable columns={columns} data={null} isLoading />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows an empty message when there is no data', () => {
    render(<DataTable columns={columns} data={[]} emptyMessage="No suppliers yet" />)
    expect(screen.getByText('No suppliers yet')).toBeInTheDocument()
  })

  it('renders rows using column render functions and raw values', () => {
    render(
      <DataTable
        columns={[
          { key: 'name', header: 'Name', render: (row) => row.name.toUpperCase() },
          { key: 'country', header: 'Country' },
        ]}
        data={[{ id: '1', name: 'atlas', country: 'Germany' }]}
      />
    )
    expect(screen.getByText('ATLAS')).toBeInTheDocument()
    expect(screen.getByText('Germany')).toBeInTheDocument()
  })

  it('uses rowKey function to generate row keys when provided', () => {
    render(
      <DataTable
        columns={[{ key: 'name', header: 'Name' }]}
        data={[{ name: 'Atlas' }, { name: 'Nordic' }]}
        rowKey={(row) => row.name}
      />
    )
    expect(screen.getByText('Atlas')).toBeInTheDocument()
    expect(screen.getByText('Nordic')).toBeInTheDocument()
  })
})
