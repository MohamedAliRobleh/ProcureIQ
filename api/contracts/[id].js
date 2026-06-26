import { prisma } from '../_lib/prisma.js'
import { coerceDates } from '../_lib/dates.js'
import { requireAuth } from '../_lib/auth.js'
import { isSupplierInOrg } from '../_lib/validateSupplier.js'
import { canManage } from '../_lib/permissions.js'

async function handler(req, res) {
  try {
    if (req.method === 'PATCH') {
      if (!canManage(req.auth.orgRole, 'contracts')) {
        return res.status(403).json({ error: 'You do not have permission to manage contracts' })
      }
      const existing = await prisma.contract.findFirst({
        where: { id: req.query.id, orgId: req.auth.orgId },
      })
      if (!existing) return res.status(404).json({ error: 'Not found' })
      const { id: _ignoredId, orgId: _ignoredOrgId, ...rest } = req.body ?? {}
      if (rest.supplierId !== undefined && !(await isSupplierInOrg(prisma, rest.supplierId, req.auth.orgId))) {
        return res.status(400).json({ error: 'supplierId does not belong to your organization' })
      }
      const updated = await prisma.contract.update({
        where: { id: req.query.id },
        data: coerceDates(rest, ['startDate', 'endDate']),
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

export default requireAuth(handler)
