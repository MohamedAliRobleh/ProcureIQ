export const CONTRACT_STATUS_BADGE = { active: 'green', draft: 'amber', expired: 'red' }

export function filterContracts(contracts, { search = '', status = '', supplierId = '' } = {}) {
  return contracts.filter((c) => {
    const matchesSearch = !search || c.title.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = !status || c.status === status
    const matchesSupplierId = !supplierId || c.supplierId === supplierId
    return matchesSearch && matchesStatus && matchesSupplierId
  })
}

export function sortContracts(contracts, { key = 'title', direction = 'asc' } = {}) {
  return [...contracts].sort((a, b) => {
    const av = a[key] ?? ''
    const bv = b[key] ?? ''
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return direction === 'asc' ? cmp : -cmp
  })
}
