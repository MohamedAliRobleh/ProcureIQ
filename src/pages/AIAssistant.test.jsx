import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SupplierProvider } from '../context/SupplierContext'
import { ContractProvider } from '../context/ContractContext'
import { SpendProvider } from '../context/SpendContext'
import { ChatProvider } from '../context/ChatContext'
import AIAssistant from './AIAssistant'

function renderPage() {
  return render(
    <SupplierProvider>
      <ContractProvider>
        <SpendProvider>
          <ChatProvider>
            <AIAssistant />
          </ChatProvider>
        </SpendProvider>
      </ContractProvider>
    </SupplierProvider>
  )
}

describe('AIAssistant', () => {
  it('renders the heading and the greeting message', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: 'AI Assistant' })).toBeInTheDocument()
    expect(screen.getByText(/ProcureIQ assistant/)).toBeInTheDocument()
  })

  it('shows 5 suggested prompt chips while the conversation is fresh', () => {
    renderPage()
    expect(screen.getByRole('button', { name: 'Which suppliers are riskiest?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'How much have we spent this month?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Which contracts expire soon?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Who are our ESG laggards?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Give me a portfolio overview' })).toBeInTheDocument()
  })

  it('clicking a chip sends the prompt, hides the chips, and renders a data-backed reply', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Which suppliers are riskiest?' }))

    expect(screen.getByText('Which suppliers are riskiest?')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Give me a portfolio overview' })).not.toBeInTheDocument()
    expect(screen.getByTestId('thinking-indicator')).toBeInTheDocument()

    await waitFor(() => expect(screen.getByText(/Pacific Rim Logistics/)).toBeInTheDocument(), { timeout: 2000 })
    expect(screen.queryByTestId('thinking-indicator')).not.toBeInTheDocument()
  })

  it('sends a typed message on submit and clears the input', async () => {
    renderPage()
    const input = screen.getByPlaceholderText('Ask about suppliers, contracts, spend...')
    fireEvent.change(input, { target: { value: 'help' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(input).toHaveValue('')
    await waitFor(() => expect(screen.getByText(/portfolio overview/)).toBeInTheDocument(), { timeout: 2000 })
  })

  it('ignores submitting an empty input', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(screen.queryByTestId('thinking-indicator')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Give me a portfolio overview' })).toBeInTheDocument()
  })

  it('Clear chat resets the conversation and restores the chips', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Which contracts expire soon?' }))
    await waitFor(() => expect(screen.getByText(/active contracts/)).toBeInTheDocument(), { timeout: 2000 })

    fireEvent.click(screen.getByRole('button', { name: 'Clear chat' }))
    expect(screen.queryByText(/active contracts/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Give me a portfolio overview' })).toBeInTheDocument()
  })
})
