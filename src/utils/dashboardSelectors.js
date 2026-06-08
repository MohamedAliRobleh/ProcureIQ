export function getAverageRiskScore(riskAssessments) {
  if (riskAssessments.length === 0) return 0
  const total = riskAssessments.reduce((sum, r) => sum + r.score, 0)
  return Math.round(total / riskAssessments.length)
}

export function getRiskDistribution(riskAssessments) {
  const levels = ['low', 'medium', 'high', 'critical']
  return levels.map((level) => ({
    level,
    count: riskAssessments.filter((r) => r.level === level).length,
  }))
}

export function getSpendByCategory(spendRecords) {
  const totals = new Map()
  for (const record of spendRecords) {
    totals.set(record.category, (totals.get(record.category) ?? 0) + record.amount)
  }
  return [...totals.entries()].map(([category, amount]) => ({ category, amount }))
}

export function getTotalSpendYTD(spendRecords, referenceDate = new Date()) {
  const year = referenceDate.getFullYear()
  return spendRecords
    .filter((record) => new Date(record.date).getFullYear() === year)
    .reduce((sum, record) => sum + record.amount, 0)
}

export function getExpiringContracts(contracts, referenceDate = new Date()) {
  const dayMs = 1000 * 60 * 60 * 24
  const daysUntil = (date) => Math.ceil((new Date(date).getTime() - referenceDate.getTime()) / dayMs)
  const active = contracts.filter((c) => c.status === 'active')

  return {
    within30: active.filter((c) => { const d = daysUntil(c.endDate); return d >= 0 && d <= 30 }),
    within60: active.filter((c) => { const d = daysUntil(c.endDate); return d > 30 && d <= 60 }),
    within90: active.filter((c) => { const d = daysUntil(c.endDate); return d > 60 && d <= 90 }),
  }
}

export function getTopSuppliersBySpend(spendRecords, suppliers, limit = 5) {
  const totals = new Map()
  for (const record of spendRecords) {
    totals.set(record.supplierId, (totals.get(record.supplierId) ?? 0) + record.amount)
  }
  return [...totals.entries()]
    .map(([supplierId, totalSpend]) => ({
      supplier: suppliers.find((s) => s.id === supplierId),
      totalSpend,
    }))
    .filter((entry) => entry.supplier)
    .sort((a, b) => b.totalSpend - a.totalSpend)
    .slice(0, limit)
}
