import { vi } from 'vitest'
import { suppliers, contracts, riskAssessments, esgResponses, spendRecords } from '../lib/mockData'

// Serializes Date fields to ISO strings — the same shape the real API returns.
const toJson = (data) => JSON.parse(JSON.stringify(data))

let counter = 0

function jsonResponse(body, status = 200) {
  return { ok: status < 400, status, json: async () => body }
}

const COLLECTIONS = {
  '/api/suppliers': { data: suppliers, prefix: 'sup' },
  '/api/contracts': { data: contracts, prefix: 'con' },
  '/api/spend': { data: spendRecords, prefix: 'spend' },
}

export function createMockFetch() {
  return vi.fn(async (url, options = {}) => {
    const method = options.method ?? 'GET'
    const body = options.body ? JSON.parse(options.body) : null

    if (method === 'GET') {
      if (url === '/api/risk') return jsonResponse(toJson(riskAssessments))
      if (url === '/api/esg') return jsonResponse(toJson(esgResponses))
      if (COLLECTIONS[url]) return jsonResponse(toJson(COLLECTIONS[url].data))
    }
    if (method === 'POST' && COLLECTIONS[url]) {
      counter += 1
      return jsonResponse(
        {
          orgId: 'org_demo',
          riskScore: 0,
          esgScore: 0,
          createdAt: new Date().toISOString(),
          ...body,
          id: `${COLLECTIONS[url].prefix}_test_${counter}`,
        },
        201
      )
    }
    if (method === 'PATCH') {
      const match = url.match(/^\/api\/(?:suppliers|contracts|spend)\/(.+)$/)
      if (match) return jsonResponse({ ...body, id: match[1] })
    }
    return jsonResponse({ error: `mockApi: unhandled ${method} ${url}` }, 500)
  })
}
