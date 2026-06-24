import { describe, it, expect } from 'vitest'
import {
  PORTAL_REQUEST_TYPES,
  PORTAL_STATUSES,
  PORTAL_STATUS_BADGE,
  PORTAL_TYPE_LABEL,
  filterRequests,
} from './portalSelectors'

const rows = [
  { id: 'a', status: 'pending', supplierId: 's1' },
  { id: 'b', status: 'approved', supplierId: 's2' },
  { id: 'c', status: 'pending', supplierId: 's2' },
]

describe('portalSelectors', () => {
  it('exposes the fixed type and status vocabularies', () => {
    expect(PORTAL_REQUEST_TYPES).toEqual(['esg_questionnaire', 'document', 'risk_review', 'general'])
    expect(PORTAL_STATUSES).toEqual(['pending', 'submitted', 'approved', 'rejected'])
  })

  it('maps every status to a badge variant and every type to a label', () => {
    PORTAL_STATUSES.forEach((s) => expect(PORTAL_STATUS_BADGE[s]).toBeTruthy())
    PORTAL_REQUEST_TYPES.forEach((t) => expect(PORTAL_TYPE_LABEL[t]).toBeTruthy())
  })

  it('filters by status', () => {
    expect(filterRequests(rows, { status: 'pending' }).map((r) => r.id)).toEqual(['a', 'c'])
  })

  it('filters by supplierId', () => {
    expect(filterRequests(rows, { supplierId: 's2' }).map((r) => r.id)).toEqual(['b', 'c'])
  })

  it('returns all rows with no filters', () => {
    expect(filterRequests(rows)).toHaveLength(3)
  })
})
