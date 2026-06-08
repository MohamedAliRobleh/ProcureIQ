import { Sparkles } from 'lucide-react'
import Card from './Card'

export default function AIInsightBox({ title = 'AI Insight', children }) {
  return (
    <Card className="border-accent-purple/30 bg-gradient-to-br from-bg-card to-accent-purple/5 p-5">
      <div className="flex items-center gap-2">
        <div className="rounded-lg bg-accent-purple/15 p-2">
          <Sparkles size={16} className="text-accent-purple" />
        </div>
        <h3 className="font-display text-sm font-semibold text-text-primary">{title}</h3>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-text-secondary">{children}</p>
    </Card>
  )
}
