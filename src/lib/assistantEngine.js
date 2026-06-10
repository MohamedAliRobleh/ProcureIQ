import { daysUntil, formatCurrency, formatCompactCurrency } from '../utils/formatters'
import { esgRating, ESG_RATING_LABEL } from '../utils/esgSelectors'
import { getSpendByCategory, getAverageRiskScore } from '../utils/dashboardSelectors'

const HELP_TEXT = [
  'I can answer questions about your procurement data. Try:',
  '• "Which suppliers are riskiest?"',
  '• "How much have we spent this month?"',
  '• "Which contracts expire soon?"',
  '• "Who are our ESG laggards?"',
  '• "Give me a portfolio overview"',
  'You can also ask about any supplier by name.',
].join('\n')

const FALLBACK_TEXT =
  "I'm not sure how to answer that yet. Try asking about supplier risk, spend, expiring contracts, ESG performance, or a specific supplier by name."

function supplierSnapshot(supplier, { contracts, riskAssessments, esgResponses, spendRecords }) {
  const risk = riskAssessments.find((r) => r.supplierId === supplier.id)
  const esg = esgResponses.find((r) => r.supplierId === supplier.id)
  const supplierContracts = contracts.filter((c) => c.supplierId === supplier.id)
  const totalSpend = spendRecords
    .filter((r) => r.supplierId === supplier.id)
    .reduce((sum, r) => sum + r.amount, 0)
  return [
    `${supplier.name} (${supplier.category}, ${supplier.country}) — status: ${supplier.status}.`,
    risk ? `Risk: ${risk.score} (${risk.level})` : 'Risk: no assessment on file',
    esg ? `ESG: ${esg.score} (${ESG_RATING_LABEL[esgRating(esg.score)]})` : 'ESG: no response on file',
    `Contracts: ${supplierContracts.length}`,
    `Total spend: ${formatCurrency(totalSpend)}`,
  ].join('\n')
}

function riskiestSuppliers({ suppliers, riskAssessments }) {
  const top = [...riskAssessments].sort((a, b) => b.score - a.score).slice(0, 3)
  const lines = top.map((a, i) => {
    const supplier = suppliers.find((s) => s.id === a.supplierId)
    return `${i + 1}. ${supplier ? supplier.name : a.supplierId} — risk score ${a.score} (${a.level})`
  })
  return `Your highest-risk suppliers right now:\n${lines.join('\n')}`
}

function spendSummary({ spendRecords }) {
  const total = spendRecords.reduce((sum, r) => sum + r.amount, 0)
  const now = new Date()
  const thisMonth = spendRecords
    .filter((r) => {
      const d = new Date(r.date)
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    })
    .reduce((sum, r) => sum + r.amount, 0)
  const byCategory = getSpendByCategory(spendRecords)
  const top = byCategory.length
    ? byCategory.reduce((best, c) => (c.amount > best.amount ? c : best))
    : null
  const topText = top ? `Your top category is ${top.category} at ${formatCompactCurrency(top.amount)}.` : ''
  return `Total tracked spend is ${formatCompactCurrency(total)}, including ${formatCompactCurrency(thisMonth)} this month. ${topText}`.trim()
}

function expiringContracts({ contracts }) {
  const active = contracts.filter((c) => c.status === 'active')
  const expiring = active
    .map((c) => ({ title: c.title, days: daysUntil(c.endDate) }))
    .filter((c) => c.days >= 0 && c.days <= 60)
    .sort((a, b) => a.days - b.days)
  if (expiring.length === 0) {
    return `You have ${active.length} active contracts and none expiring in the next 60 days.`
  }
  const lines = expiring.map((c) => `• ${c.title} — ${c.days}d left`)
  return `You have ${active.length} active contracts. Expiring within 60 days:\n${lines.join('\n')}`
}

function esgLaggards({ suppliers, esgResponses }) {
  const average = esgResponses.length
    ? Math.round(esgResponses.reduce((sum, r) => sum + r.score, 0) / esgResponses.length)
    : 0
  const laggards = esgResponses
    .filter((r) => esgRating(r.score) === 'needs-improvement')
    .map((r) => suppliers.find((s) => s.id === r.supplierId))
    .filter(Boolean)
  if (laggards.length === 0) {
    return `Portfolio ESG average is ${average}. No suppliers are currently rated Needs Improvement.`
  }
  const lines = laggards.map((s) => `• ${s.name}`)
  return `Portfolio ESG average is ${average}. ${laggards.length} supplier${laggards.length > 1 ? 's are' : ' is'} rated Needs Improvement:\n${lines.join('\n')}`
}

function portfolioOverview({ suppliers, contracts, riskAssessments, spendRecords }) {
  const activeSuppliers = suppliers.filter((s) => s.status === 'active').length
  const totalSpend = spendRecords.reduce((sum, r) => sum + r.amount, 0)
  const averageRisk = getAverageRiskScore(riskAssessments)
  return `You're tracking ${suppliers.length} suppliers (${activeSuppliers} active), ${contracts.length} contracts, and ${formatCompactCurrency(totalSpend)} in spend. Average risk score is ${averageRisk}.`
}

export function getAssistantReply(message, data) {
  const q = message.toLowerCase()

  if (q.includes('help') || q.includes('what can you')) return { text: HELP_TEXT }

  const supplier = data.suppliers.find((s) => q.includes(s.name.toLowerCase()))
  if (supplier) return { text: supplierSnapshot(supplier, data) }

  if (q.includes('risk')) return { text: riskiestSuppliers(data) }
  if (q.includes('spend') || q.includes('spent')) return { text: spendSummary(data) }
  if (q.includes('contract') || q.includes('expir') || q.includes('renew')) return { text: expiringContracts(data) }
  if (q.includes('esg') || q.includes('sustainab')) return { text: esgLaggards(data) }
  if (q.includes('how many') || q.includes('overview') || q.includes('summary')) return { text: portfolioOverview(data) }

  return { text: FALLBACK_TEXT }
}
