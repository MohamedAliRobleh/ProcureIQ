import { describe, it, expect } from 'vitest'
import { buildAuditData } from './audit.js'

describe('buildAuditData', () => {
  it('builds an audit row with the given fields and an audit_-prefixed id', () => {
    const row = buildAuditData({ orgId: 'org_test', actorId: 'user_test', action: 'org.clear' })
    expect(row.orgId).toBe('org_test')
    expect(row.actorId).toBe('user_test')
    expect(row.action).toBe('org.clear')
    expect(row.id).toMatch(/^audit_/)
  })

  it('generates distinct ids on successive calls', () => {
    const a = buildAuditData({ orgId: 'o', actorId: 'a', action: 'org.seed' })
    const b = buildAuditData({ orgId: 'o', actorId: 'a', action: 'org.seed' })
    expect(a.id).not.toBe(b.id)
  })
})
