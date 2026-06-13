import { prisma } from './_lib/prisma.js'
import { ORG_ID } from './_lib/org.js'
import { requireAuth } from './_lib/auth.js'
import { getAnthropic, isAiConfigured, AI_MODEL } from './_lib/anthropic.js'
import { buildDigest } from './_lib/digest.js'
import { getAssistantReply } from '../src/lib/assistantEngine.js'

const SYSTEM_PREAMBLE =
  "You are the ProcureIQ procurement assistant. Answer the user's questions using ONLY the procurement data provided below. " +
  'Be concise and specific — cite real numbers and supplier names from the data. ' +
  'If a question cannot be answered from this data, say so plainly. Respond in plain text (no markdown tables).\n\nPROCUREMENT DATA:'

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const incoming = req.body?.messages
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return res.status(400).json({ error: 'messages is required' })
  }
  try {
    const [suppliers, contracts, riskAssessments, esgResponses, spendRecords] = await Promise.all([
      prisma.supplier.findMany({ where: { orgId: ORG_ID } }),
      prisma.contract.findMany({ where: { orgId: ORG_ID } }),
      prisma.riskAssessment.findMany({ where: { orgId: ORG_ID } }),
      prisma.esgResponse.findMany({ where: { orgId: ORG_ID } }),
      prisma.spendRecord.findMany({ where: { orgId: ORG_ID } }),
    ])
    const data = { suppliers, contracts, riskAssessments, esgResponses, spendRecords }

    if (isAiConfigured()) {
      try {
        const message = await getAnthropic().messages.create({
          model: AI_MODEL,
          max_tokens: 2048,
          thinking: { type: 'adaptive' },
          system: `${SYSTEM_PREAMBLE}\n${buildDigest(data)}`,
          messages: incoming.map((m) => ({ role: m.role, content: m.content })),
        })
        const text = message.content.find((b) => b.type === 'text')?.text?.trim()
        if (text) return res.status(200).json({ reply: text, fallback: false })
      } catch {
        // fall through to the deterministic engine
      }
    }

    const lastUser = [...incoming].reverse().find((m) => m.role === 'user')
    const reply = getAssistantReply(lastUser?.content ?? '', data)
    return res.status(200).json({ reply: reply.text, fallback: true })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

export default requireAuth(handler)
