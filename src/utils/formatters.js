export function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date) {
  const d = new Date(date)
  const options = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }
  // Date-only strings (e.g. "2026-03-15") parse as UTC midnight; format in UTC
  // so the displayed date matches the input regardless of local timezone.
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    options.timeZone = 'UTC'
  }
  return new Intl.DateTimeFormat('en-US', options).format(d)
}

export function formatPercent(value, decimals = 0) {
  return `${value.toFixed(decimals)}%`
}

export function daysUntil(date) {
  const ms = new Date(date).getTime() - Date.now()
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

export function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  const days = Math.floor(seconds / 86400)
  if (days > 0) return `${days}d ago`
  const hours = Math.floor(seconds / 3600)
  if (hours > 0) return `${hours}h ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes > 0) return `${minutes}m ago`
  return 'just now'
}
