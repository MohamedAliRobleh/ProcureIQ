import { describe, it, expect } from 'vitest'
import { getAssistantReply } from '../_lib/assistantEngine.js'

function daysFromNow(days) {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return d
}

const suppliers = [
  { id: 'sup_1', name: 'Atlas Steelworks', category: 'Raw Materials', country: 'United States', status: 'active' },
  { id: 'sup_2', name: 'Nordic Freight Solutions', category: 'Logistics', country: 'Germany', status: 'active' },
  { id: 'sup_3', name: 'Quantum IT Partners', category: 'IT Services', country: 'Japan', status: 'pending' },
]

const riskAssessments = [
  { id: 'r1', supplierId: 'sup_1', score: 20, level: 'low' },
  { id: 'r2', supplierId: 'sup_2', score: 85, level: 'critical' },
  { id: 'r3', supplierId: 'sup_3', score: 55, level: 'high' },
]

const esgResponses = [
  { id: 'e1', supplierId: 'sup_1', score: 80 },
  { id: 'e2', supplierId: 'sup_2', score: 20 },
  { id: 'e3', supplierId: 'sup_3', score: 50 },
]

const contracts = [
  { id: 'c1', supplierId: 'sup_1', title: 'Master Supply Agreement', status: 'active', endDate: daysFromNow(10) },
  { id: 'c2', supplierId: 'sup_2', title: 'Logistics Contract', status: 'active', endDate: daysFromNow(200) },
  { id: 'c3', supplierId: 'sup_1', title: 'Old Deal', status: 'expired', endDate: daysFromNow(-50) },
]

const now = new Date()
const spendRecords = [
  // 5th of the current month — always "this month" no matter what day the suite runs
  { id: 's1', supplierId: 'sup_1', amount: 1000, category: 'Raw Materials', date: new Date(now.getFullYear(), now.getMonth(), 5) },
  { id: 's2', supplierId: 'sup_2', amount: 3000, category: 'Logistics', date: daysFromNow(-95) },
]

const data = { suppliers, contracts, riskAssessments, esgResponses, spendRecords }

describe('getAssistantReply', () => {
  it('answers help questions with a capability list', () => {
    const { text } = getAssistantReply('What can you do?', data)
    expect(text).toContain('portfolio overview')
    expect(text).toContain('riskiest')
  })

  it('returns the riskiest suppliers sorted by score descending', () => {
    const { text } = getAssistantReply('Which suppliers are riskiest?', data)
    expect(text).toContain('Nordic Freight Solutions — risk score 85 (critical)')
    expect(text).toContain('Quantum IT Partners — risk score 55 (high)')
    expect(text.indexOf('Nordic Freight Solutions')).toBeLessThan(text.indexOf('Quantum IT Partners'))
  })

  it('answers spend questions with total, this month, and top category', () => {
    const { text } = getAssistantReply('How much have we spent this month?', data)
    expect(text).toContain('$4k')
    expect(text).toContain('$1k')
    expect(text).toContain('Logistics')
  })

  it('lists active contracts expiring within 60 days', () => {
    const { text } = getAssistantReply('Which contracts expire soon?', data)
    expect(text).toContain('2 active contracts')
    expect(text).toContain('Master Supply Agreement')
    expect(text).not.toContain('Logistics Contract —')
    expect(text).not.toContain('Old Deal')
  })

  it('reports no expirations when nothing ends within 60 days', () => {
    const farOut = { ...data, contracts: [{ id: 'c9', supplierId: 'sup_1', title: 'Far Deal', status: 'active', endDate: daysFromNow(300) }] }
    const { text } = getAssistantReply('any contract renewals coming up?', farOut)
    expect(text).toContain('none expiring')
  })

  it('answers ESG questions with portfolio average and laggards', () => {
    const { text } = getAssistantReply('Who are our ESG laggards?', data)
    expect(text).toContain('50')
    expect(text).toContain('Nordic Freight Solutions')
    expect(text).not.toContain('Atlas Steelworks')
  })

  it('answers overview questions with portfolio counts', () => {
    const { text } = getAssistantReply('Give me a portfolio overview', data)
    expect(text).toContain('3 suppliers')
    expect(text).toContain('2 active')
    expect(text).toContain('3 contracts')
    expect(text).toContain('$4k')
    expect(text).toContain('53')
  })

  it('returns a supplier snapshot when the message names a supplier (case-insensitive)', () => {
    const { text } = getAssistantReply('tell me about ATLAS STEELWORKS', data)
    expect(text).toContain('Atlas Steelworks')
    expect(text).toContain('Risk: 20 (low)')
    expect(text).toContain('ESG: 80 (Strong)')
    expect(text).toContain('Contracts: 2')
    expect(text).toContain('$1,000')
  })

  it('prefers the supplier snapshot over topic intents', () => {
    const { text } = getAssistantReply("what's the risk for Atlas Steelworks?", data)
    expect(text).toContain('Risk: 20 (low)')
    expect(text).not.toContain('Nordic Freight Solutions')
  })

  it('falls back politely for unrecognized questions', () => {
    const { text } = getAssistantReply('what is the weather today?', data)
    expect(text).toContain("I'm not sure")
  })
})
