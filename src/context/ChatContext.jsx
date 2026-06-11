import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useSupplierContext } from './SupplierContext'
import { useContractContext } from './ContractContext'
import { useSpendContext } from './SpendContext'
import { riskAssessments, esgResponses } from '../lib/mockData'
import { getAssistantReply } from '../lib/assistantEngine'

const ChatContext = createContext(null)

const GREETING_TEXT =
  "Hi! I'm your ProcureIQ assistant. Ask me about supplier risk, spend, expiring contracts, ESG performance, or any supplier by name."

function makeGreeting() {
  return { id: 'msg_0', role: 'assistant', text: GREETING_TEXT, createdAt: new Date() }
}

export function ChatProvider({ children }) {
  const { suppliers } = useSupplierContext()
  const { contracts } = useContractContext()
  const { spendRecords } = useSpendContext()
  const [messages, setMessages] = useState(() => [makeGreeting()])
  const [isThinking, setIsThinking] = useState(false)
  const counterRef = useRef(0)
  const timerRef = useRef(null)
  const dataRef = useRef({ suppliers, contracts, riskAssessments, esgResponses, spendRecords })

  useEffect(() => {
    dataRef.current = { suppliers, contracts, riskAssessments, esgResponses, spendRecords }
  }, [suppliers, contracts, spendRecords])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  function sendMessage(text) {
    const trimmed = text.trim()
    if (!trimmed) return
    counterRef.current += 1
    const userMessage = { id: `msg_${counterRef.current}`, role: 'user', text: trimmed, createdAt: new Date() }
    setMessages((prev) => [...prev, userMessage])
    setIsThinking(true)
    timerRef.current = setTimeout(() => {
      const reply = getAssistantReply(trimmed, dataRef.current)
      counterRef.current += 1
      setMessages((prev) => [
        ...prev,
        { id: `msg_${counterRef.current}`, role: 'assistant', text: reply.text, createdAt: new Date() },
      ])
      setIsThinking(false)
    }, 600)
  }

  function clearChat() {
    clearTimeout(timerRef.current)
    setIsThinking(false)
    setMessages([makeGreeting()])
  }

  return (
    <ChatContext.Provider value={{ messages, sendMessage, isThinking, clearChat }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChatContext() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChatContext must be used inside ChatProvider')
  return ctx
}
