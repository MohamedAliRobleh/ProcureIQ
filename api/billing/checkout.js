import { requireOrgAdmin } from '../_lib/auth.js'
import { isBillingConfigured, priceIdForPlan, getStripe } from '../_lib/stripe.js'

const PLANS = ['pro', 'enterprise']

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const { plan } = req.body ?? {}
  if (!PLANS.includes(plan)) return res.status(400).json({ error: 'plan must be pro or enterprise' })
  if (!isBillingConfigured()) return res.status(503).json({ error: 'Billing is not configured' })
  const priceId = priceIdForPlan(plan)
  if (!priceId) return res.status(503).json({ error: 'Billing is not configured' })

  try {
    const appUrl = process.env.APP_URL ?? 'http://localhost:5173'
    const stripe = await getStripe()
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/billing?status=success`,
      cancel_url: `${appUrl}/billing?status=cancelled`,
      client_reference_id: req.auth.orgId,
    })
    return res.status(200).json({ url: session.url })
  } catch (e) {
    return res.status(502).json({ error: e.message })
  }
}

export default requireOrgAdmin(handler)
