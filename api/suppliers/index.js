import { prisma } from '../_lib/prisma.js'
import { requireAuth } from '../_lib/auth.js'
import { canManage } from '../_lib/permissions.js'

async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const suppliers = await prisma.supplier.findMany({
        where: { orgId: req.auth.orgId },
        orderBy: { createdAt: 'asc' },
      })
      return res.status(200).json(suppliers)
    }
    if (req.method === 'POST') {
      if (!canManage(req.auth.orgRole, 'suppliers')) {
        return res.status(403).json({ error: 'You do not have permission to manage suppliers' })
      }
      const body = req.body ?? {}
      if (!body.name || !body.email) {
        return res.status(400).json({ error: 'name and email are required' })
      }
      const supplier = await prisma.supplier.create({
        data: {
          ...body,
          id: `sup_${Date.now()}`,
          orgId: req.auth.orgId,
          riskScore: 0,
          esgScore: 0,
          logoUrl: null,
          onboardedAt: new Date(),
          createdAt: new Date(),
        },
      })
      return res.status(201).json(supplier)
    }
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

export default requireAuth(handler)
