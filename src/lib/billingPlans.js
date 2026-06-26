export const CURRENT_PLAN = 'free'

export const BILLING_PLANS = [
  { id: 'free', name: 'Free', price: '$0', features: ['Up to 10 suppliers', 'Core modules', 'Community support'] },
  { id: 'pro', name: 'Pro', price: '$49/mo', features: ['Unlimited suppliers', 'AI summaries', 'Email reminders', 'Priority support'] },
  { id: 'enterprise', name: 'Enterprise', price: 'Custom', features: ['SSO & audit log', 'Dedicated success manager', 'Custom integrations', 'SLA'] },
]
