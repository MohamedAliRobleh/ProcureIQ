import { useEffect, useRef, useState } from 'react'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import { useChatContext } from '../context/ChatContext'
import { cn } from '../utils/cn'

const SUGGESTED_PROMPTS = [
  'Which suppliers are riskiest?',
  'How much have we spent this month?',
  'Which contracts expire soon?',
  'Who are our ESG laggards?',
  'Give me a portfolio overview',
]

export default function AIAssistant() {
  const { messages, sendMessage, isThinking, clearChat } = useChatContext()
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' })
  }, [messages, isThinking])

  function handleSubmit(e) {
    e.preventDefault()
    if (!input.trim()) return
    sendMessage(input)
    setInput('')
  }

  const isFresh = messages.length <= 1

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="AI Assistant"
        description="Ask questions about your procurement data"
        actions={
          <Button variant="ghost" onClick={clearChat}>
            Clear chat
          </Button>
        }
      />

      <div className="flex-1 space-y-4 overflow-y-auto pb-4">
        {messages.map((m) => (
          <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[80%] whitespace-pre-line rounded-xl px-4 py-3 text-sm',
                m.role === 'user'
                  ? 'bg-gradient-blue text-white'
                  : 'border border-border bg-bg-card text-text-primary'
              )}
            >
              {m.text}
            </div>
          </div>
        ))}
        {isThinking && (
          <div className="flex justify-start" data-testid="thinking-indicator">
            <div className="flex items-center gap-1.5 rounded-xl border border-border bg-bg-card px-4 py-3">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-secondary [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-secondary [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-secondary [animation-delay:300ms]" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {isFresh && (
        <div className="mb-3 flex flex-wrap gap-2">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => sendMessage(prompt)}
              className="rounded-full border border-border bg-bg-card px-3 py-1.5 text-xs text-text-secondary transition-colors hover:border-border-accent hover:text-text-primary"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about suppliers, contracts, spend..."
          className="flex-1 rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
        />
        <Button type="submit" variant="primary">
          Send
        </Button>
      </form>
    </div>
  )
}
