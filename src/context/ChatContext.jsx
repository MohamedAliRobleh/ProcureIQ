import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { api } from '../lib/apiClient'

const ChatContext = createContext(null)

const GREETING_TEXT =
  "Hi! I'm your ProcureIQ assistant. Ask me about supplier risk, spend, expiring contracts, ESG performance, or any supplier by name."

const ERROR_TEXT = "Sorry, I couldn't reach the assistant just now. Please try again."

function makeGreeting() {
  return { id: 'msg_0', role: 'assistant', text: GREETING_TEXT, createdAt: new Date() }
}

export function ChatProvider({ children }) {
  const [messages, setMessages] = useState(() => [makeGreeting()])
  const [isThinking, setIsThinking] = useState(false)
  const counterRef = useRef(0)
  const activeRef = useRef(true)

  useEffect(() => () => { activeRef.current = false }, [])

  function appendAssistant(text) {
    counterRef.current += 1
    setMessages((prev) => [...prev, { id: `msg_${counterRef.current}`, role: 'assistant', text, createdAt: new Date() }])
  }

  function sendMessage(text) {
    const trimmed = text.trim()
    if (!trimmed) return
    // Conversation turns after the greeting, plus the new user turn.
    const priorTurns = messages.slice(1).map((m) => ({ role: m.role, content: m.text }))
    const payload = [...priorTurns, { role: 'user', content: trimmed }]

    counterRef.current += 1
    setMessages((prev) => [...prev, { id: `msg_${counterRef.current}`, role: 'user', text: trimmed, createdAt: new Date() }])
    setIsThinking(true)

    api
      .post('/api/assistant', { messages: payload })
      .then((data) => {
        if (activeRef.current) appendAssistant(data.reply)
      })
      .catch(() => {
        if (activeRef.current) appendAssistant(ERROR_TEXT)
      })
      .finally(() => {
        if (activeRef.current) setIsThinking(false)
      })
  }

  function clearChat() {
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
