import { prisma } from '../_lib/prisma.js'
import { coerceDates } from '../_lib/dates.js'
import { requireAuth } from '../_lib/auth.js'
import { isSupplierInOrg } from '../_lib/validateSupplier.js'
import { canManage } from '../_lib/permissions.js'

async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const contracts = await prisma.contract.findMany({
        where: { orgId: req.auth.orgId },
        orderBy: { createdAt: 'asc' },
      })
      return res.status(200).json(contracts)
    }
    if (req.method === 'POST') {
      if (!canManage(req.auth.orgRole, 'contracts')) {
        return res.status(403).json({ error: 'You do not have permission to manage contracts' })
      }
      const body = req.body ?? {}
      if (!body.title || !body.supplierId || body.value == null) {
        return res.status(400).json({ error: 'title, supplierId, and value are required' })
      }
      if (!(await isSupplierInOrg(prisma, body.supplierId, req.auth.orgId))) {
        return res.status(400).json({ error: 'supplierId does not belong to your organization' })
      }
      const contract = await prisma.contract.create({
        data: {
          ...coerceDates(body, ['startDate', 'endDate']),
          id: `con_${Date.now()}`,
          orgId: req.auth.orgId,
          createdBy: 'user_demo_admin',
        },
      })
      return res.status(201).json(contract)
    }
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

export default requireAuth(handler)
