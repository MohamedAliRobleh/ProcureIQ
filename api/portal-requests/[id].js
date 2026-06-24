import { prisma } from '../_lib/prisma.js'
import { coerceDates } from '../_lib/dates.js'
import { requireAuth } from '../_lib/auth.js'

const TYPES = ['esg_questionnaire', 'document', 'risk_review', 'general']
const STATUSES = ['pending', 'submitted', 'approved', 'rejected']

async function handler(req, res) {
  try {
    if (req.method === 'PATCH') {
      const existing = await prisma.portalRequest.findFirst({
        where: { id: req.query.id, orgId: req.auth.orgId },
      })
      if (!existing) return res.status(404).json({ error: 'Not found' })
      const { id: _ignoredId, orgId: _ignoredOrgId, ...rest } = req.body ?? {}
      if (rest.type !== undefined && !TYPES.includes(rest.type)) {
        return res.status(400).json({ error: 'invalid type' })
      }
      if (rest.status !== undefined && !STATUSES.includes(rest.status)) {
        return res.status(400).json({ error: 'invalid status' })
      }
      const updated = await prisma.portalRequest.update({
        where: { id: req.query.id },
        data: coerceDates(rest, ['dueDate']),
      })
      return res.status(200).json(updated)
    }
    if (req.method === 'DELETE') {
      const existing = await prisma.portalRequest.findFirst({
        where: { id: req.query.id, orgId: req.auth.orgId },
      })
      if (!existing) return res.status(404).json({ error: 'Not found' })
      await prisma.portalRequest.delete({ where: { id: req.query.id } })
      return res.status(200).json({ deleted: true })
    }
    res.setHeader('Allow', 'PATCH, DELETE')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Not found' })
    return res.status(500).json({ error: e.message })
  }
}

export default requireAuth(handler)
