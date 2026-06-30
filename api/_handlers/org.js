import { prisma } from '../_lib/prisma.js'
import { buildSeedData } from '../_lib/seedData.js'
import { buildAuditData } from '../_lib/audit.js'

// Populates a brand-new org with the canonical demo dataset. Open to ANY org
// member (not just admins) so visitors/members can self-serve demo data.
// Count-guarded so it never duplicates: if the org already has suppliers, it is
// a no-op.
export async function seed(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const { orgId } = req.auth
  try {
    const existing = await prisma.supplier.count({ where: { orgId } })
    if (existing > 0) return res.status(200).json({ seeded: false })

    const data = buildSeedData(orgId)
    // FK order: suppliers first, then everything that references them — all atomic.
    await prisma.$transaction([
      prisma.supplier.createMany({ data: data.suppliers }),
      prisma.contract.createMany({ data: data.contracts }),
      prisma.riskAssessment.createMany({ data: data.riskAssessments }),
      prisma.esgResponse.createMany({ data: data.esgResponses }),
      prisma.spendRecord.createMany({ data: data.spendRecords }),
      prisma.portalRequest.createMany({ data: data.portalRequests }),
      prisma.auditLog.create({ data: buildAuditData({ orgId, actorId: req.auth.userId, action: 'org.seed' }) }),
    ])
    return res.status(200).json({ seeded: true })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

// Admin-only: permanently delete every record in the active org. Children are
// deleted before suppliers (no onDelete cascade in the schema), all in one
// transaction.
export async function clear(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const { orgId } = req.auth
  try {
    await prisma.$transaction([
      prisma.contract.deleteMany({ where: { orgId } }),
      prisma.riskAssessment.deleteMany({ where: { orgId } }),
      prisma.esgResponse.deleteMany({ where: { orgId } }),
      prisma.spendRecord.deleteMany({ where: { orgId } }),
      prisma.portalRequest.deleteMany({ where: { orgId } }),
      prisma.supplier.deleteMany({ where: { orgId } }),
      prisma.auditLog.create({ data: buildAuditData({ orgId, actorId: req.auth.userId, action: 'org.clear' }) }),
    ])
    return res.status(200).json({ cleared: true })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

// Admin-only: wipe the org then re-seed the canonical demo dataset, all in one
// transaction. Deletes child-first, inserts parent-first.
export async function reset(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const { orgId } = req.auth
  try {
    const data = buildSeedData(orgId)
    await prisma.$transaction([
      prisma.contract.deleteMany({ where: { orgId } }),
      prisma.riskAssessment.deleteMany({ where: { orgId } }),
      prisma.esgResponse.deleteMany({ where: { orgId } }),
      prisma.spendRecord.deleteMany({ where: { orgId } }),
      prisma.portalRequest.deleteMany({ where: { orgId } }),
      prisma.supplier.deleteMany({ where: { orgId } }),
      prisma.supplier.createMany({ data: data.suppliers }),
      prisma.contract.createMany({ data: data.contracts }),
      prisma.riskAssessment.createMany({ data: data.riskAssessments }),
      prisma.esgResponse.createMany({ data: data.esgResponses }),
      prisma.spendRecord.createMany({ data: data.spendRecords }),
      prisma.portalRequest.createMany({ data: data.portalRequests }),
      prisma.auditLog.create({ data: buildAuditData({ orgId, actorId: req.auth.userId, action: 'org.reset' }) }),
    ])
    return res.status(200).json({ reset: true })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

// Admin-only: return every record in the active org as one JSON payload, so an
// admin can download a backup before a clear/reset. Read-only, org-scoped.
export async function exportData(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const { orgId } = req.auth
  try {
    const where = { where: { orgId } }
    const [suppliers, contracts, riskAssessments, esgResponses, spendRecords, portalRequests] =
      await Promise.all([
        prisma.supplier.findMany(where),
        prisma.contract.findMany(where),
        prisma.riskAssessment.findMany(where),
        prisma.esgResponse.findMany(where),
        prisma.spendRecord.findMany(where),
        prisma.portalRequest.findMany(where),
      ])

    await prisma.auditLog
      .create({ data: buildAuditData({ orgId, actorId: req.auth.userId, action: 'org.export' }) })
      .catch(() => {})

    return res.status(200).json({
      exportedAt: new Date().toISOString(),
      orgId,
      data: { suppliers, contracts, riskAssessments, esgResponses, spendRecords, portalRequests },
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

// Admin-only: the org's recent audit log, newest first.
export async function audit(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    const entries = await prisma.auditLog.findMany({
      where: { orgId: req.auth.orgId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return res.status(200).json(entries)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
