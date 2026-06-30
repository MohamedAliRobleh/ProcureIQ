import { prisma } from '../_lib/prisma.js'
import { canManage } from '../_lib/permissions.js'

export async function list(req, res) {
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

export async function byId(req, res) {
  try {
    if (req.method === 'PATCH') {
      if (!canManage(req.auth.orgRole, 'suppliers')) {
        return res.status(403).json({ error: 'You do not have permission to manage suppliers' })
      }
      const existing = await prisma.supplier.findFirst({
        where: { id: req.query.id, orgId: req.auth.orgId },
      })
      if (!existing) return res.status(404).json({ error: 'Not found' })
      const { id: _ignoredId, orgId: _ignoredOrgId, ...rest } = req.body ?? {}
      const updated = await prisma.supplier.update({
        where: { id: req.query.id },
        data: rest,
      })
      return res.status(200).json(updated)
    }
    res.setHeader('Allow', 'PATCH')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Not found' })
    return res.status(500).json({ error: e.message })
  }
}
