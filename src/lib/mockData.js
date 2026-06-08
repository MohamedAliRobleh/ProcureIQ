const COUNTRIES = ['United States', 'Germany', 'Japan', 'United Kingdom', 'Singapore', 'Brazil', 'India', 'Netherlands', 'Australia', 'South Korea']
const CATEGORIES = ['Raw Materials', 'Logistics', 'IT Services', 'Manufacturing', 'Packaging', 'Professional Services', 'Energy', 'Components']
const STATUSES = ['active', 'active', 'active', 'pending', 'suspended']

const SUPPLIER_NAMES = [
  'Atlas Steelworks', 'Nordic Freight Solutions', 'Quantum IT Partners', 'Meridian Manufacturing',
  'Greenleaf Packaging Co', 'Sterling Consulting Group', 'Voltaic Energy Systems', 'Precision Components Ltd',
  'Pacific Rim Logistics', 'Helios Solar Supply', 'Cascade Raw Materials', 'Titan Industrial Group',
  'BlueWave Technologies', 'Summit Professional Services', 'Ironclad Manufacturing', 'EcoPack Solutions',
  'Vertex Components', 'Global Energy Partners', 'Crestline Logistics', 'Apex Consulting Worldwide',
]

function daysFromNow(days) {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return d
}

function daysAgo(days) {
  return daysFromNow(-days)
}

export const suppliers = SUPPLIER_NAMES.map((name, i) => {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const category = CATEGORIES[i % CATEGORIES.length]
  const country = COUNTRIES[i % COUNTRIES.length]
  return {
    id: `sup_${i + 1}`,
    orgId: 'org_demo',
    name,
    email: `contact@${slug}.com`,
    phone: `+1-555-01${String(i).padStart(2, '0')}`,
    country,
    category,
    status: STATUSES[i % STATUSES.length],
    riskScore: (i * 13 + 7) % 100,
    esgScore: (i * 17 + 23) % 100,
    website: `https://www.${slug}.com`,
    description: `${name} is a ${category.toLowerCase()} supplier based in ${country}, partnering with ProcureIQ clients since ${2018 + (i % 7)}.`,
    logoUrl: null,
    onboardedAt: daysAgo(30 + i * 11),
    createdAt: daysAgo(40 + i * 11),
  }
})

const CONTRACT_TITLES = [
  'Master Supply Agreement', 'Annual Logistics Contract', 'IT Services Retainer', 'Manufacturing Framework Agreement',
  'Packaging Supply Contract', 'Consulting Services Agreement', 'Energy Procurement Contract', 'Component Supply Agreement',
  'Freight & Distribution Contract', 'Raw Materials Purchase Agreement', 'Equipment Maintenance Contract',
  'Professional Services SOW', 'Renewable Energy Supply Deal', 'Custom Manufacturing Agreement', 'Regional Distribution Contract',
]

const CONTRACT_STATUSES = ['active', 'active', 'active', 'draft', 'expired']

export const contracts = CONTRACT_TITLES.map((title, i) => {
  const supplier = suppliers[(i * 3) % suppliers.length]
  const start = daysAgo(200 - i * 5)
  const end = daysFromNow(-30 + i * 18)
  return {
    id: `con_${i + 1}`,
    orgId: 'org_demo',
    supplierId: supplier.id,
    title: `${title} — ${supplier.name}`,
    status: CONTRACT_STATUSES[i % CONTRACT_STATUSES.length],
    value: 50000 + i * 37500,
    currency: 'USD',
    startDate: start,
    endDate: end,
    autoRenew: i % 3 === 0,
    fileUrl: null,
    aiSummary: null,
    terms: 'Standard net-30 payment terms with quarterly performance reviews.',
    createdBy: 'user_demo_admin',
    createdAt: start,
    updatedAt: start,
  }
})

export const riskAssessments = suppliers.map((supplier, i) => {
  const financial = (i * 11 + 5) % 100
  const compliance = (i * 7 + 15) % 100
  const operational = (i * 19 + 9) % 100
  const geopolitical = (i * 23 + 3) % 100
  const score = Math.round((financial + compliance + operational + geopolitical) / 4)
  const level = score < 30 ? 'low' : score < 55 ? 'medium' : score < 80 ? 'high' : 'critical'
  return {
    id: `risk_${i + 1}`,
    orgId: 'org_demo',
    supplierId: supplier.id,
    score,
    level,
    financialRisk: financial,
    complianceRisk: compliance,
    operationalRisk: operational,
    geopoliticalRisk: geopolitical,
    aiAnalysis: null,
    assessedAt: daysAgo(5 + i * 4),
    assessedBy: i % 4 === 0 ? 'AI' : 'user_demo_admin',
  }
})

export const esgResponses = suppliers.map((supplier, i) => {
  const environmental = (i * 9 + 12) % 100
  const social = (i * 14 + 8) % 100
  const governance = (i * 6 + 20) % 100
  return {
    id: `esg_${i + 1}`,
    orgId: 'org_demo',
    supplierId: supplier.id,
    score: Math.round((environmental + social + governance) / 3),
    environmental,
    social,
    governance,
    answers: {},
    aiSuggestions: null,
    submittedAt: daysAgo(10 + i * 6),
  }
})

const SPEND_CATEGORIES = ['Raw Materials', 'Logistics', 'IT Services', 'Manufacturing', 'Packaging', 'Professional Services', 'Energy', 'Components']

export const spendRecords = []
let spendCounter = 1
for (let month = 0; month < 6; month++) {
  for (let s = 0; s < suppliers.length; s += 3) {
    const supplier = suppliers[s]
    spendRecords.push({
      id: `spend_${spendCounter}`,
      orgId: 'org_demo',
      supplierId: supplier.id,
      amount: 8000 + ((s + month) * 1370) % 42000,
      currency: 'USD',
      category: SPEND_CATEGORIES[(s + month) % SPEND_CATEGORIES.length],
      description: `Monthly spend — ${supplier.name}`,
      date: daysAgo(month * 30 + 5),
      invoiceRef: `INV-2026-${String(spendCounter).padStart(4, '0')}`,
      createdAt: daysAgo(month * 30 + 5),
    })
    spendCounter++
  }
}

export const recentActivity = [
  { id: 'act_1', type: 'supplier_onboarded', message: `${suppliers[0].name} completed onboarding`, timestamp: daysAgo(1) },
  { id: 'act_2', type: 'contract_signed', message: `${contracts[2].title} was signed`, timestamp: daysAgo(2) },
  { id: 'act_3', type: 'risk_alert', message: `${suppliers[3].name} risk level changed to ${riskAssessments[3].level}`, timestamp: daysAgo(3) },
  { id: 'act_4', type: 'esg_submitted', message: `${suppliers[5].name} submitted their ESG questionnaire`, timestamp: daysAgo(4) },
  { id: 'act_5', type: 'contract_expiring', message: `${contracts[5].title} expires soon`, timestamp: daysAgo(5) },
  { id: 'act_6', type: 'supplier_onboarded', message: `${suppliers[7].name} completed onboarding`, timestamp: daysAgo(7) },
]
