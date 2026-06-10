export function filterSpendRecords(records, suppliers, { search = '', category = '', supplierId = '' } = {}) {
  return records.filter((r) => {
    const supplier = suppliers.find((s) => s.id === r.supplierId)
    const searchLower = search.toLowerCase()
    const matchesSearch =
      !search ||
      (supplier && supplier.name.toLowerCase().includes(searchLower)) ||
      r.description.toLowerCase().includes(searchLower)
    const matchesCategory = !category || r.category === category
    const matchesSupplierId = !supplierId || r.supplierId === supplierId
    return matchesSearch && matchesCategory && matchesSupplierId
  })
}

export function sortSpendRecords(records, { key = 'date', direction = 'desc' } = {}) {
  return [...records].sort((a, b) => {
    let av = a[key]
    let bv = b[key]
    if (av instanceof Date || bv instanceof Date) {
      av = new Date(av).getTime()
      bv = new Date(bv).getTime()
    }
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return direction === 'asc' ? cmp : -cmp
  })
}

export function getMonthlySpendTrend(records, months = 6) {
  const now = new Date()
  const buckets = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    buckets.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleString('en-US', { month: 'short' }), total: 0 })
  }
  for (const record of records) {
    const d = new Date(record.date)
    const bucket = buckets.find((b) => b.year === d.getFullYear() && b.month === d.getMonth())
    if (bucket) bucket.total += record.amount
  }
  return buckets.map((b) => ({ month: b.label, total: b.total }))
}
