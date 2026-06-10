import { describe, it, expect } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { SupplierProvider } from './SupplierContext'
import { ContractProvider } from './ContractContext'
import { SpendProvider } from './SpendContext'
import { ChatProvider, useChatContext } from './ChatContext'

const wrapper = ({ children }) => (
  <SupplierProvider>
    <ContractProvider>
      <SpendProvider>
        <ChatProvider>{children}</ChatProvider>
      </SpendProvider>
    </ContractProvider>
  </SupplierProvider>
)

describe('ChatContext', () => {
  it('seeds with a single assistant greeting', () => {
    const { result } = renderHook(() => useChatContext(), { wrapper })
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0].role).toBe('assistant')
    expect(result.current.messages[0].text).toContain('ProcureIQ assistant')
    expect(result.current.isThinking).toBe(false)
  })

  it('appends the user message immediately and the data-backed reply after the delay', async () => {
    const { result } = renderHook(() => useChatContext(), { wrapper })
    act(() => result.current.sendMessage('Which suppliers are riskiest?'))

    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[1].role).toBe('user')
    expect(result.current.messages[1].text).toBe('Which suppliers are riskiest?')
    expect(result.current.isThinking).toBe(true)

    await waitFor(() => expect(result.current.messages).toHaveLength(3), { timeout: 2000 })
    expect(result.current.messages[2].role).toBe('assistant')
    expect(result.current.messages[2].text).toContain('Pacific Rim Logistics')
    expect(result.current.isThinking).toBe(false)
  })

  it('assigns unique ids to user and assistant messages', async () => {
    const { result } = renderHook(() => useChatContext(), { wrapper })
    act(() => result.current.sendMessage('help'))
    await waitFor(() => expect(result.current.messages).toHaveLength(3), { timeout: 2000 })
    const ids = result.current.messages.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('ignores empty and whitespace-only messages', () => {
    const { result } = renderHook(() => useChatContext(), { wrapper })
    act(() => result.current.sendMessage('   '))
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.isThinking).toBe(false)
  })

  it('clearChat resets to the greeting', async () => {
    const { result } = renderHook(() => useChatContext(), { wrapper })
    act(() => result.current.sendMessage('help'))
    await waitFor(() => expect(result.current.messages).toHaveLength(3), { timeout: 2000 })
    act(() => result.current.clearChat())
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0].role).toBe('assistant')
    expect(result.current.isThinking).toBe(false)
  })

  it('throws when used outside ChatProvider', () => {
    expect(() => renderHook(() => useChatContext())).toThrow(
      'useChatContext must be used inside ChatProvider'
    )
  })
})
