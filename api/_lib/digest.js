// Builds a compact, model-readable text snapshot of the org's procurement data.
// Self-contained (no cross-imports) so it stays trivially testable.

function daysUntil(date) {
  if (!date) return null
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)
}

export function buildDigest({ suppliers, contracts, riskAssessments, esgResponses, spendRecords }) {
  const supplierName = (id) => suppliers.find((s) => s.id === id)?.name ?? id
  const lines = []

  lines.push('## Suppliers')
  for (const s of suppliers) {
    lines.push(`- ${s.name} (${s.category}, ${s.country}) — status ${s.status}, risk ${s.riskScore}, ESG ${s.esgScore}`)
  }

  lines.push('', '## Contracts')
  for (const c of contracts) {
    const d = daysUntil(c.endDate)
    const expiry = d == null ? 'no end date' : d < 0 ? `expired ${Math.abs(d)}d ago` : `${d}d to expiry`
    lines.push(`- "${c.title}" — ${supplierName(c.supplierId)}, ${c.currency} ${c.value}, ${c.status}, ${expiry}${c.autoRenew ? ', auto-renew' : ''}`)
  }

  lines.push('', '## Risk assessments')
  for (const r of riskAssessments) {
    lines.push(`- ${supplierName(r.supplierId)}: score ${r.score} (${r.level}) — financial ${r.financialRisk}, compliance ${r.complianceRisk}, operational ${r.operationalRisk}, geopolitical ${r.geopoliticalRisk}`)
  }

  lines.push('', '## ESG responses')
  for (const e of esgResponses) {
    lines.push(`- ${supplierName(e.supplierId)}: overall ${e.score} — environmental ${e.environmental}, social ${e.social}, governance ${e.governance}`)
  }

  const total = spendRecords.reduce((sum, r) => sum + r.amount, 0)
  const now = new Date()
  const thisMonth = spendRecords
    .filter((r) => {
      const d = new Date(r.date)
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    })
    .reduce((sum, r) => sum + r.amount, 0)
  const byCategory = {}
  const bySupplier = {}
  for (const r of spendRecords) {
    byCategory[r.category] = (byCategory[r.category] ?? 0) + r.amount
    bySupplier[r.supplierId] = (bySupplier[r.supplierId] ?? 0) + r.amount
  }

  lines.push('', '## Spend')
  lines.push(`- Total tracked spend: ${total}`)
  lines.push(`- This month: ${thisMonth}`)
  lines.push('- By category:')
  for (const [cat, amt] of Object.entries(byCategory)) lines.push(`  - ${cat}: ${amt}`)
  lines.push('- By supplier:')
  for (const [sid, amt] of Object.entries(bySupplier)) lines.push(`  - ${supplierName(sid)}: ${amt}`)

  return lines.join('\n')
}
