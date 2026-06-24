import { prisma } from '../_lib/prisma.js'
import { coerceDates } from '../_lib/dates.js'
import { requireAuth } from '../_lib/auth.js'

const TYPES = ['esg_questionnaire', 'document', 'risk_review', 'general']
const STATUSES = ['pending', 'submitted', 'approved', 'rejected']

async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const requests = await prisma.portalRequest.findMany({
        where: { orgId: req.auth.orgId },
        orderBy: { createdAt: 'desc' },
        include: { supplier: { select: { id: true, name: true } } },
      })
      return res.status(200).json(requests)
    }
    if (req.method === 'POST') {
      const body = req.body ?? {}
      if (!body.title || !body.supplierId) {
        return res.status(400).json({ error: 'title and supplierId are required' })
      }
      const type = body.type ?? 'general'
      const status = body.status ?? 'pending'
      if (!TYPES.includes(type)) return res.status(400).json({ error: 'invalid type' })
      if (!STATUSES.includes(status)) return res.status(400).json({ error: 'invalid status' })

      const supplier = await prisma.supplier.findFirst({
        where: { id: body.supplierId, orgId: req.auth.orgId },
      })
      if (!supplier) return res.status(404).json({ error: 'Supplier not found' })

      const created = await prisma.portalRequest.create({
        data: {
          ...coerceDates(body, ['dueDate']),
          id: `preq_${Date.now()}`,
          orgId: req.auth.orgId,
          type,
          status,
          createdBy: req.auth.userId,
        },
      })
      return res.status(201).json(created)
    }
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

export default requireAuth(handler)
