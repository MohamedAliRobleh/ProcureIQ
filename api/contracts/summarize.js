import { prisma } from '../_lib/prisma.js'
import { requireAuth } from '../_lib/auth.js'
import { getAnthropic, isAiConfigured, AI_MODEL } from '../_lib/anthropic.js'

const SUMMARY_SYSTEM =
  'You are a procurement analyst. Summarize the contract below in 2-3 sentences for a procurement manager. ' +
  'Cover the value, term, renewal, and any notable terms. Output only the summary, with no preamble.'

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
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

export default requireAuth(handler)
