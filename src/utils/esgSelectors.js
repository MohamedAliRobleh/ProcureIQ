export function esgRating(score) {
  if (score >= 67) return 'strong'
  if (score >= 34) return 'developing'
  return 'needs-improvement'
}

export const ESG_RATING_BADGE = {
  strong: 'green',
  developing: 'amber',
  'needs-improvement': 'red',
}

export const ESG_RATING_LABEL = {
  strong: 'Strong',
  developing: 'Developing',
  'needs-improvement': 'Needs Improvement',
}

export function filterEsgResponses(responses, suppliers, { search = '', rating = '' } = {}) {
  return responses.filter((r) => {
    const supplier = suppliers.find((s) => s.id === r.supplierId)
    const matchesSearch = !search || (supplier && supplier.name.toLowerCase().includes(search.toLowerCase()))
    const matchesRating = !rating || esgRating(r.score) === rating
    return matchesSearch && matchesRating
  })
}

export function sortEsgResponses(responses, { key = 'score', direction = 'desc' } = {}) {
  return [...responses].sort((a, b) => {
    const av = a[key] ?? 0
    const bv = b[key] ?? 0
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return direction === 'asc' ? cmp : -cmp
  })
}
