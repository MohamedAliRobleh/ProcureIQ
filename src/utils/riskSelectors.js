export const RISK_LEVEL_BADGE = {
  low: 'green',
  medium: 'amber',
  high: 'red',
  critical: 'purple',
}

export function filterRiskAssessments(assessments, suppliers, { search = '', level = '' } = {}) {
  return assessments.filter((a) => {
    const supplier = suppliers.find((s) => s.id === a.supplierId)
    const matchesSearch = !search || (supplier && supplier.name.toLowerCase().includes(search.toLowerCase()))
    const matchesLevel = !level || a.level === level
    return matchesSearch && matchesLevel
  })
}

export function sortRiskAssessments(assessments, { key = 'score', direction = 'desc' } = {}) {
  return [...assessments].sort((a, b) => {
    const av = a[key] ?? 0
    const bv = b[key] ?? 0
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return direction === 'asc' ? cmp : -cmp
  })
}
