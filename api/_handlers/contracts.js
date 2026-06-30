import { prisma } from '../_lib/prisma.js'
import { coerceDates } from '../_lib/dates.js'
import { isSupplierInOrg } from '../_lib/validateSupplier.js'
import { canManage } from '../_lib/permissions.js'
import { getAnthropic, isAiConfigured, AI_MODEL } from '../_lib/anthropic.js'
import { isUploadConfigured, uploadConfig, signUpload } from '../_lib/cloudinary.js'
import { isEmailConfigured, sendEmail } from '../_lib/email.js'
import { escapeHtml } from '../_lib/htmlEscape.js'

export async function list(req, res) {
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

export async function byId(req, res) {
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

const SUMMARY_SYSTEM =
  'You are a procurement analyst. Summarize the contract below in 2-3 sentences for a procurement manager. ' +
  'Cover the value, term, renewal, and any notable terms. Output only the summary, with no preamble.'

export async function summarize(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!canManage(req.auth.orgRole, 'contracts')) {
    return res.status(403).json({ error: 'You do not have permission to manage contracts' })
  }
  const id = req.body?.id
  if (!id) return res.status(400).json({ error: 'id is required' })
  if (!isAiConfigured()) return res.status(503).json({ error: 'AI features are not configured' })

  try {
    const contract = await prisma.contract.findFirst({ where: { id, orgId: req.auth.orgId } })
    if (!contract) return res.status(404).json({ error: 'Not found' })

    const details = [
      `Title: ${contract.title}`,
      `Value: ${contract.currency} ${contract.value}`,
      `Status: ${contract.status}`,
      `Start: ${contract.startDate ?? 'n/a'}`,
      `End: ${contract.endDate ?? 'n/a'}`,
      `Auto-renew: ${contract.autoRenew ? 'yes' : 'no'}`,
      `Terms: ${contract.terms ?? 'n/a'}`,
    ].join('\n')

    const message = await getAnthropic().messages.create({
      model: AI_MODEL,
      max_tokens: 1024,
      thinking: { type: 'adaptive' },
      system: SUMMARY_SYSTEM,
      messages: [{ role: 'user', content: details }],
    })
    const aiSummary = message.content.find((b) => b.type === 'text')?.text?.trim()
    if (!aiSummary) return res.status(502).json({ error: 'No summary generated' })

    const updated = await prisma.contract.update({ where: { id }, data: { aiSummary } })
    return res.status(200).json(updated)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

export async function uploadSignature(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!canManage(req.auth.orgRole, 'contracts')) {
    return res.status(403).json({ error: 'You do not have permission to manage contracts' })
  }
  const id = req.body?.id
  if (!id) return res.status(400).json({ error: 'id is required' })
  if (!isUploadConfigured()) return res.status(503).json({ error: 'File uploads are not configured' })

  try {
    const contract = await prisma.contract.findFirst({ where: { id, orgId: req.auth.orgId } })
    if (!contract) return res.status(404).json({ error: 'Not found' })

    const timestamp = Math.round(Date.now() / 1000)
    const folder = `procureiq/${req.auth.orgId}/contracts`
    const signature = signUpload({ timestamp, folder })
    const { cloudName, apiKey } = uploadConfig()

    return res.status(200).json({ cloudName, apiKey, timestamp, folder, signature })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

export async function notify(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!canManage(req.auth.orgRole, 'contracts')) {
    return res.status(403).json({ error: 'You do not have permission to manage contracts' })
  }
  const { id, toEmail } = req.body ?? {}
  if (!id || !toEmail) return res.status(400).json({ error: 'id and toEmail are required' })
  if (!isEmailConfigured()) return res.status(503).json({ error: 'Email notifications are not configured' })

  try {
    const contract = await prisma.contract.findFirst({ where: { id, orgId: req.auth.orgId } })
    if (!contract) return res.status(404).json({ error: 'Not found' })

    const subject = `Reminder: ${contract.title}`
    const end = contract.endDate ? new Date(contract.endDate).toISOString().slice(0, 10) : 'n/a'
    const html = [
      `<h2>Contract reminder</h2>`,
      `<p>Here is a reminder about <strong>${escapeHtml(contract.title)}</strong>.</p>`,
      `<ul>`,
      `<li>Value: ${escapeHtml(contract.currency)} ${escapeHtml(contract.value)}</li>`,
      `<li>Status: ${escapeHtml(contract.status)}</li>`,
      `<li>End date: ${escapeHtml(end)}</li>`,
      `</ul>`,
      `<p>— ProcureIQ</p>`,
    ].join('')

    await sendEmail({ to: toEmail, subject, html })
    return res.status(200).json({ ok: true })
  } catch (e) {
    return res.status(502).json({ error: e.message })
  }
}
