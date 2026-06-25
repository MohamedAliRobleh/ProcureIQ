import { prisma } from '../_lib/prisma.js'
import { requireOrgAdmin } from '../_lib/auth.js'

// Admin-only: the org's recent audit log, newest first.
async function handler(req, res) {
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

export default requireOrgAdmin(handler)
