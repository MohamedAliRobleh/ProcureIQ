let client = null

// True when a Stripe secret key is present. Endpoints check this before touching the
// SDK so the app degrades gracefully when billing isn't configured (no key yet).
export function isBillingConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

// The configured Stripe price id for a plan, or undefined. Demo: only pro/enterprise
// are purchasable; free has no price.
export function priceIdForPlan(plan) {
  if (plan === 'pro') return process.env.STRIPE_PRICE_PRO
  if (plan === 'enterprise') return process.env.STRIPE_PRICE_ENTERPRISE
  return undefined
}

// Lazily imports + constructs a cached client. Never called without a key (guarded by
// isBillingConfigured at the call sites). The dynamic import keeps this module safe to
// import even when `stripe` isn't installed; the package is only needed on the live path.
export async function getStripe() {
  if (!isBillingConfigured()) throw new Error('STRIPE_SECRET_KEY is not configured')
  if (!client) {
    const Stripe = (await import('stripe')).default
    client = new Stripe(process.env.STRIPE_SECRET_KEY)
  }
  return client
}
