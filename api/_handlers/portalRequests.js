import { prisma } from '../_lib/prisma.js'
import { coerceDates } from '../_lib/dates.js'
import { canManage } from '../_lib/permissions.js'
import { isEmailConfigured, sendEmail } from '../_lib/email.js'
import { escapeHtml } from '../_lib/htmlEscape.js'

const TYPES = ['esg_questionnaire', 'document', 'risk_review', 'general']
const STATUSES = ['pending', 'submitted', 'approved', 'rejected']

export async function list(req, res) {
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
      if (!canManage(req.auth.orgRole, 'portal')) {
        return res.status(403).json({ error: 'You do not have permission to manage portal' })
      }
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

export async function byId(req, res) {
  try {
    if (req.method === 'PATCH') {
      if (!canManage(req.auth.orgRole, 'portal')) {
        return res.status(403).json({ error: 'You do not have permission to manage portal' })
      }
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
      if (!canManage(req.auth.orgRole, 'portal')) {
        return res.status(403).json({ error: 'You do not have permission to manage portal' })
      }
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

export async function notify(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!canManage(req.auth.orgRole, 'portal')) {
    return res.status(403).json({ error: 'You do not have permission to manage portal' })
  }
  const { id } = req.body ?? {}
  if (!id) return res.status(400).json({ error: 'id is required' })
  if (!isEmailConfigured()) return res.status(503).json({ error: 'Email notifications are not configured' })

  try {
    const request = await prisma.portalRequest.findFirst({
      where: { id, orgId: req.auth.orgId },
      include: { supplier: { select: { name: true, email: true } } },
    })
    if (!request || !request.supplier) return res.status(404).json({ error: 'Not found' })

    const due = request.dueDate ? new Date(request.dueDate).toISOString().slice(0, 10) : 'n/a'
    const html = [
      `<h2>${escapeHtml(request.title)}</h2>`,
      `<p>Hello ${escapeHtml(request.supplier.name)},</p>`,
      `<p>ProcureIQ has a request for you:</p>`,
      request.message ? `<p>${escapeHtml(request.message)}</p>` : '',
      `<ul>`,
      `<li>Due date: ${escapeHtml(due)}</li>`,
      `</ul>`,
      `<p>— ProcureIQ</p>`,
    ].join('')

    await sendEmail({ to: request.supplier.email, subject: `Request: ${request.title}`, html })
    return res.status(200).json({ ok: true })
  } catch (e) {
    return res.status(502).json({ error: e.message })
  }
}
