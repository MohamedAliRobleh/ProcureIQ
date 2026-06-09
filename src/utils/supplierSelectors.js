export function filterSuppliers(suppliers, { search = '', category = '', status = '' } = {}) {
  return suppliers.filter((s) => {
    const matchesSearch = !search || s.name.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = !category || s.category === category
    const matchesStatus = !status || s.status === status
    return matchesSearch && matchesCategory && matchesStatus
  })
}

export function sortSuppliers(suppliers, { key = 'name', direction = 'asc' } = {}) {
  return [...suppliers].sort((a, b) => {
    const av = a[key] ?? ''
    const bv = b[key] ?? ''
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return direction === 'asc' ? cmp : -cmp
  })
}
