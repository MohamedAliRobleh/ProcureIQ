import {
  suppliers,
  contracts,
  riskAssessments,
  esgResponses,
  spendRecords,
} from '../../src/lib/mockData.js'

// Re-keys the canonical demo dataset (src/lib/mockData.js) into a target org.
// Every id is namespaced `${orgId}__<originalId>` so multiple orgs never
// collide; foreign keys are rewritten to the namespaced supplier ids; and
// orgId is stamped on every record. mockData.js is pure (no React), so it is
// safe to import here.
export function buildSeedData(orgId) {
  const ns = (id) => `${orgId}__${id}`
  return {
    suppliers: suppliers.map((s) => ({ ...s, id: ns(s.id), orgId })),
    contracts: contracts.map((c) => ({ ...c, id: ns(c.id), orgId, supplierId: ns(c.supplierId) })),
    riskAssessments: riskAssessments.map((r) => ({ ...r, id: ns(r.id), orgId, supplierId: ns(r.supplierId) })),
    esgResponses: esgResponses.map((e) => ({ ...e, id: ns(e.id), orgId, supplierId: ns(e.supplierId) })),
    spendRecords: spendRecords.map((sp) => ({ ...sp, id: ns(sp.id), orgId, supplierId: ns(sp.supplierId) })),
  }
}
