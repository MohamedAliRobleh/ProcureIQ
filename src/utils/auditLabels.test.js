import { describe, it, expect } from 'vitest'
import { AUDIT_ACTION_LABEL } from './auditLabels'

describe('AUDIT_ACTION_LABEL', () => {
  it('maps each audited action to a non-empty label', () => {
    for (const action of ['org.clear', 'org.reset', 'org.seed', 'org.export']) {
      expect(typeof AUDIT_ACTION_LABEL[action]).toBe('string')
      expect(AUDIT_ACTION_LABEL[action].length).toBeGreaterThan(0)
    }
  })
})
