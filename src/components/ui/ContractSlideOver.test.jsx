import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ContractSlideOver from './ContractSlideOver'
import { resetAuthState, authState, DEMO_ORG } from '../../test/authState'

beforeEach(() => {
  resetAuthState()
})

const mockContract = {
  id: 'con_1',
  title: 'Master Supply Agreement',
  supplierId: 'sup_1',
  value: 600000,
  currency: 'USD',
  startDate: new Date('2025-01-12'),
  endDate: new Date('2026-07-22'),
  status: 'active',
  autoRenew: true,
  terms: 'Net-30 payment terms.',
}

const mockSupplier = { id: 'sup_1', name: 'Atlas Steelworks' }

function renderSlideOver(props) {
  return render(
    <MemoryRouter>
      <ContractSlideOver {...props} />
    </MemoryRouter>
  )
}

describe('ContractSlideOver', () => {
  it('renders nothing when closed', () => {
    renderSlideOver({
      isOpen: false,
      onClose: () => {},
      contract: mockContract,
      supplier: mockSupplier,
      onEdit: () => {},
    })
    expect(screen.queryByText('Master Supply Agreement')).not.toBeInTheDocument()
  })

  it('shows contract title and supplier name when open', () => {
    renderSlideOver({
      isOpen: true,
      onClose: () => {},
      contract: mockContract,
      supplier: mockSupplier,
      onEdit: () => {},
    })
    expect(screen.getByText('Master Supply Agreement')).toBeInTheDocument()
    expect(screen.getByText('Atlas Steelworks')).toBeInTheDocument()
  })

  it('calls onEdit when Edit Contract button is clicked', () => {
    const onEdit = vi.fn()
    renderSlideOver({
      isOpen: true,
      onClose: () => {},
      contract: mockContract,
      supplier: mockSupplier,
      onEdit,
    })
    fireEvent.click(screen.getByRole('button', { name: 'Edit Contract' }))
    expect(onEdit).toHaveBeenCalled()
  })

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn()
    renderSlideOver({
      isOpen: true,
      onClose,
      contract: mockContract,
      supplier: mockSupplier,
      onEdit: () => {},
    })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when the overlay is clicked', () => {
    const onClose = vi.fn()
    renderSlideOver({
      isOpen: true,
      onClose,
      contract: mockContract,
      supplier: mockSupplier,
      onEdit: () => {},
    })
    fireEvent.click(screen.getByTestId('contract-slide-overlay'))
    expect(onClose).toHaveBeenCalled()
  })

  it('renders an existing aiSummary and no generate button', () => {
    renderSlideOver({
      isOpen: true,
      onClose: () => {},
      contract: { ...mockContract, aiSummary: 'This is the AI summary.' },
      supplier: mockSupplier,
      onEdit: () => {},
      onSummarize: vi.fn(),
    })
    expect(screen.getByText('This is the AI summary.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Generate summary' })).not.toBeInTheDocument()
  })

  it('shows a Generate summary button that calls onSummarize', () => {
    const onSummarize = vi.fn().mockResolvedValue({})
    renderSlideOver({
      isOpen: true,
      onClose: () => {},
      contract: mockContract,
      supplier: mockSupplier,
      onEdit: () => {},
      onSummarize,
    })
    fireEvent.click(screen.getByRole('button', { name: 'Generate summary' }))
    expect(onSummarize).toHaveBeenCalled()
  })

  it('renders a View document link when the contract has a fileUrl', () => {
    renderSlideOver({
      isOpen: true,
      onClose: () => {},
      contract: { ...mockContract, fileUrl: 'https://res.cloudinary.com/democloud/x.pdf' },
      supplier: mockSupplier,
      onEdit: () => {},
      onUpload: vi.fn(),
    })
    const link = screen.getByRole('link', { name: 'View document' })
    expect(link).toHaveAttribute('href', 'https://res.cloudinary.com/democloud/x.pdf')
    expect(screen.getByRole('button', { name: 'Replace' })).toBeInTheDocument()
  })

  it('calls onUpload with the selected file', () => {
    const onUpload = vi.fn().mockResolvedValue({})
    renderSlideOver({
      isOpen: true,
      onClose: () => {},
      contract: mockContract,
      supplier: mockSupplier,
      onEdit: () => {},
      onUpload,
    })
    const input = screen.getByTestId('contract-file-input')
    const file = new File(['pdf'], 'contract.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [file] } })
    expect(onUpload).toHaveBeenCalledWith(file)
  })

  it('does not render the Edit Contract button without onEdit', () => {
    renderSlideOver({
      isOpen: true,
      onClose: () => {},
      contract: mockContract,
      supplier: mockSupplier,
    })
    expect(screen.queryByRole('button', { name: 'Edit Contract' })).not.toBeInTheDocument()
  })

  it('renders the Edit Contract button when onEdit is provided', () => {
    renderSlideOver({
      isOpen: true,
      onClose: () => {},
      contract: mockContract,
      supplier: mockSupplier,
      onEdit: () => {},
    })
    expect(screen.getByRole('button', { name: 'Edit Contract' })).toBeInTheDocument()
  })

  it('does not render the Email reminder button without onNotify', () => {
    renderSlideOver({
      isOpen: true,
      onClose: () => {},
      contract: mockContract,
      supplier: mockSupplier,
      onEdit: () => {},
    })
    expect(screen.queryByRole('button', { name: 'Email reminder' })).not.toBeInTheDocument()
  })

  it('clicking Email reminder calls onNotify and shows confirmation', async () => {
    const onNotify = vi.fn().mockResolvedValue({ ok: true })
    renderSlideOver({
      isOpen: true,
      onClose: () => {},
      contract: mockContract,
      supplier: mockSupplier,
      onEdit: () => {},
      onNotify,
    })
    fireEvent.click(screen.getByRole('button', { name: 'Email reminder' }))
    expect(onNotify).toHaveBeenCalled()
    expect(await screen.findByText(/Reminder sent/)).toBeInTheDocument()
  })
})

describe('ContractSlideOver — demo-org integration hiding', () => {
  it('hides AI Summary, Document, and Email reminder sections in the demo org', () => {
    authState.organization = DEMO_ORG
    renderSlideOver({
      isOpen: true,
      onClose: () => {},
      contract: mockContract,
      supplier: mockSupplier,
      onEdit: () => {},
      onSummarize: vi.fn(),
      onUpload: vi.fn(),
      onNotify: vi.fn(),
    })
    expect(screen.queryByText('AI Summary')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Generate summary/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Document')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Upload document/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Notifications')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Email reminder/i })).not.toBeInTheDocument()
  })

  it('shows AI Summary, Document, and Email reminder sections in a normal org (non-demo)', () => {
    // authState.organization is already DEFAULT_ORG (non-demo) from beforeEach / resetAuthState
    renderSlideOver({
      isOpen: true,
      onClose: () => {},
      contract: mockContract,
      supplier: mockSupplier,
      onEdit: () => {},
      onSummarize: vi.fn(),
      onUpload: vi.fn(),
      onNotify: vi.fn(),
    })
    expect(screen.getByText('AI Summary')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Generate summary/i })).toBeInTheDocument()
    expect(screen.getByText('Document')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Upload document/i })).toBeInTheDocument()
    expect(screen.getByText('Notifications')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Email reminder/i })).toBeInTheDocument()
  })
})
