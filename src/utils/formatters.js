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

export function daysUntil(date, referenceDate = new Date()) {
  const ms = new Date(date).getTime() - new Date(referenceDate).getTime()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
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

export function formatCompactCurrency(amount) {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `$${Math.round(amount / 1_000)}k`
  return `$${amount}`
}

export function riskColor(score) {
  if (score <= 33) return 'text-accent-green'
  if (score <= 66) return 'text-accent-amber'
  return 'text-accent-red'
}

export function esgColor(score) {
  if (score >= 67) return 'text-accent-green'
  if (score >= 34) return 'text-accent-amber'
  return 'text-accent-red'
}

export function formatDateToInput(date) {
  const d = new Date(date)
  // Date-only strings (e.g. "2026-04-05") parse as UTC midnight, which can
  // shift to the previous day in local-getter output for timezones behind
  // UTC. Detect that case and read UTC parts instead so the input value
  // matches the date that was passed in.
  const isUtcMidnight =
    d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0
  const yyyy = isUtcMidnight ? d.getUTCFullYear() : d.getFullYear()
  const mm = String((isUtcMidnight ? d.getUTCMonth() : d.getMonth()) + 1).padStart(2, '0')
  const dd = String(isUtcMidnight ? d.getUTCDate() : d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
