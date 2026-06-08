import PageHeader from '../components/layout/PageHeader'
import Card from '../components/ui/Card'

export default function PlaceholderPage({ title, phase }) {
  return (
    <div>
      <PageHeader title={title} description={`This module is coming in ${phase}.`} />
      <Card className="flex flex-col items-center justify-center gap-2 p-12 text-center">
        <p className="font-display text-lg font-semibold text-text-primary">{title} is under construction</p>
        <p className="max-w-md text-sm text-text-secondary">
          We're building this module in {phase}. Check back soon — in the meantime, explore the Dashboard for a
          preview of ProcureIQ's data.
        </p>
      </Card>
    </div>
  )
}
