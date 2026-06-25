import { prisma } from '../_lib/prisma.js'
import { coerceDates } from '../_lib/dates.js'
import { requireAuth } from '../_lib/auth.js'
import { isSupplierInOrg } from '../_lib/validateSupplier.js'
import { canManage } from '../_lib/permissions.js'

async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const records = await prisma.spendRecord.findMany({
        where: { orgId: req.auth.orgId },
        orderBy: { date: 'asc' },
      })
      return res.status(200).json(records)
    }
    if (req.method === 'POST') {
      if (!canManage(req.auth.orgRole, 'spend')) {
        return res.status(403).json({ error: 'You do not have permission to manage spend' })
      }
      const body = req.body ?? {}
      if (!body.supplierId || body.amount == null || !body.category || !body.date) {
        return res.status(400).json({ error: 'supplierId, amount, category, and date are required' })
      }
      if (!(await isSupplierInOrg(prisma, body.supplierId, req.auth.orgId))) {
        return res.status(400).json({ error: 'supplierId does not belong to your organization' })
      }
      const record = await prisma.spendRecord.create({
        data: {
          ...coerceDates(body, ['date']),
          id: `spend_${Date.now()}`,
          orgId: req.auth.orgId,
          createdAt: new Date(),
        },
      })
      return res.status(201).json(record)
    }
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

export default requireAuth(handler)
