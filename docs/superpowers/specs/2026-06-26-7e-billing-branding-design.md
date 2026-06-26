# Lot E — Billing (demo) + Branding — Design

Date: 2026-06-26
Status: Approved (brainstorming)

## Summary

Add a demo-mode billing page and per-org branding. Billing is **key-optional** (mirrors
the Anthropic/Cloudinary/Brevo pattern): without a Stripe key the app degrades gracefully
(the upgrade flow returns 503 and the UI says so); with a key it creates a real Stripe
Checkout session. The current plan is a fixed "Free" in demo (real plan changes require a
Stripe webhook, out of scope). Branding makes the app shell reflect the active org's name
and logo.

## Scope (and non-goals)

In scope:
- `api/_lib/stripe.js` (key-optional lazy Stripe client) + `POST /api/billing/checkout`.
- `src/lib/billingPlans.js` (static plan tiers) + `src/pages/Billing.jsx` (admin-only) +
  the `/billing` route and nav item.
- Branding: the Sidebar shows the active org's name + logo (fallback "ProcureIQ"), and the
  nav admin-gating is generalized via an `adminOnly` flag.
- Tests for all of the above.

Non-goals (YAGNI):
- No plan persistence / no Billing DB model (current plan is fixed "Free" in demo; real
  upgrades need a Stripe webhook → a later lot).
- No Stripe webhook handler, no invoice/usage history, no proration.
- No per-org accent color / theming (branding is name + logo only).
- The real Stripe wiring is a deferred live step (needs `STRIPE_SECRET_KEY` +
  `STRIPE_PRICE_PRO`/`STRIPE_PRICE_ENTERPRISE` from the user); the suite stays green without it.

## Component: `api/_lib/stripe.js` (key-optional)

Mirrors `api/_lib/anthropic.js` but uses a **dynamic import** so the module loads even
when the `stripe` package isn't installed (keeps the suite green without the dependency —
the SDK is only needed on the configured live path). Server-side only — never imported
from `src/`.

```js
let client = null

// True when a Stripe secret key is present. Endpoints check this before touching the
// SDK so the app degrades gracefully when billing isn't configured (no key yet).
export function isBillingConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

// The configured Stripe price id for a plan, or undefined. (Demo: only pro/enterprise
// are purchasable; free has no price.)
export function priceIdForPlan(plan) {
  if (plan === 'pro') return process.env.STRIPE_PRICE_PRO
  if (plan === 'enterprise') return process.env.STRIPE_PRICE_ENTERPRISE
  return undefined
}

// Lazily imports + constructs a cached client. Never called without a key (guarded by
// isBillingConfigured at the call sites). The dynamic import means this module imports
// safely even when `stripe` isn't installed; the package is only required on the live
// configured path (a deferred step).
export async function getStripe() {
  if (!isBillingConfigured()) throw new Error('STRIPE_SECRET_KEY is not configured')
  if (!client) {
    const Stripe = (await import('stripe')).default
    client = new Stripe(process.env.STRIPE_SECRET_KEY)
  }
  return client
}
```

`getStripe()` is async (dynamic import). The checkout handler `await`s it. Installing the
`stripe` package is only needed for the real live path and is a deferred step; the
suite is green without it because `stripe.test.js` only exercises the guard functions and
`checkout.test.js` mocks this whole module.

## Component: `POST /api/billing/checkout`

Admin-only (`requireOrgAdmin`). Body `{ plan }` where `plan ∈ { 'pro', 'enterprise' }`.

- Method guard: non-POST → `405` with `Allow: POST`.
- `400` if `plan` is missing or not one of `pro`/`enterprise`.
- `503` if `!isBillingConfigured()` (before any SDK call) → `{ error: 'Billing is not configured' }`.
- `503` if `priceIdForPlan(plan)` is undefined (key present but the plan's price id isn't
  set) → `{ error: 'Billing is not configured' }` (same graceful message).
- Otherwise create a Checkout session and return `200 { url }`:

```js
const session = await getStripe().checkout.sessions.create({
  mode: 'subscription',
  line_items: [{ price: priceId, quantity: 1 }],
  success_url: `${appUrl}/billing?status=success`,
  cancel_url: `${appUrl}/billing?status=cancelled`,
  client_reference_id: req.auth.orgId,
})
return res.status(200).json({ url: session.url })
```

`appUrl` from `process.env.APP_URL ?? 'http://localhost:5173'`. `502` on a Stripe error
(catch). The handler reads `req.auth.orgId` (org-scoped reference) — no DB access needed.

## Component: `src/lib/billingPlans.js`

Static tiers (no persistence):

```js
export const CURRENT_PLAN = 'free'

export const BILLING_PLANS = [
  { id: 'free', name: 'Free', price: '$0', features: ['Up to 10 suppliers', 'Core modules', 'Community support'] },
  { id: 'pro', name: 'Pro', price: '$49/mo', features: ['Unlimited suppliers', 'AI summaries', 'Email reminders', 'Priority support'] },
  { id: 'enterprise', name: 'Enterprise', price: 'Custom', features: ['SSO & audit log', 'Dedicated success manager', 'Custom integrations', 'SLA'] },
]
```

## Component: `src/pages/Billing.jsx`

Admin-only — same gating shape as `Admin.jsx` (`useOrganization().membership?.role ===
'org:admin'`; non-admin sees an "Admin access required" card). For an admin:
- A `PageHeader` ("Billing", "Manage your organization's plan").
- The three `BILLING_PLANS` rendered as cards. The card whose `id === CURRENT_PLAN` shows
  a "Current plan" badge and no CTA. The other paid tiers show an "Upgrade" button.
- "Upgrade" → `api.post('/api/billing/checkout', { plan: id })`:
  - On success with `{ url }` → `window.location.href = url` (redirect to Stripe).
  - On error (503/any) → inline message "Billing isn't set up yet." (graceful, same style
    as other inline errors). Track a per-button busy + error state.

## Branding: `src/components/layout/Sidebar.jsx`

- Replace the hardcoded "ProcureIQ" header with the active org's branding via
  `useOrganization()`:
  - If `organization?.imageUrl` → render an `<img>` logo (alt = org name) next to the name.
  - Name = `organization?.name ?? 'ProcureIQ'`.
- Generalize the admin nav gating: add `adminOnly: true` to the Admin nav item and the new
  Billing nav item in `src/utils/constants.js`, and filter the Sidebar with
  `NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)` (replaces the current
  `item.path !== '/admin' || isAdmin`).

## Routing

- `src/utils/constants.js`: add `{ label: 'Billing', path: '/billing', icon: <CreditCard>, adminOnly: true }` to `NAV_ITEMS` (and `adminOnly: true` on the existing Admin item).
- `src/App.jsx`: import `Billing`, add `<Route path="/billing" element={<Billing />} />` in the protected group.

## Testing

Suite must stay green (currently 418). Key-optional: green with NO Stripe env.

- `api/_lib/stripe.test.js`: `isBillingConfigured()` true/false by `STRIPE_SECRET_KEY`;
  `priceIdForPlan('pro'/'enterprise'/'free')` reads the right env / undefined. (Set/clear
  `process.env` within the test; restore after.)
- `api/billing/checkout.test.js` (mock `../_lib/stripe.js` + `requireOrgAdmin` passthrough):
  503 when `isBillingConfigured()` false; 400 on bad/missing plan; admin happy-path returns
  `{ url }` (mock `getStripe().checkout.sessions.create` → `{ url: 'https://stripe/...' }`)
  with `client_reference_id: 'org_test'`; 503 when price id undefined; 405 non-POST. (The
  member-403 is `requireOrgAdmin`'s own behavior — since the test mocks it as passthrough,
  no member test here; the gating is covered by `requireOrgAdmin`'s existing tests.)
- `src/lib/billingPlans.test.js`: `BILLING_PLANS` has the three ids with non-empty
  name/price/features; `CURRENT_PLAN === 'free'`.
- `src/pages/Billing.test.jsx`: admin sees the three plan cards, a "Current plan" badge on
  Free, and "Upgrade" buttons on Pro/Enterprise; clicking Upgrade calls
  `fetch('/api/billing/checkout', POST)`; a 503 response shows "Billing isn't set up yet.";
  a non-admin (`authState.membership.role = 'org:member'`) sees "Admin access required".
- `src/components/layout/layout.test.jsx` (or a Sidebar test): the Sidebar shows the org
  name when `authState.organization.name` is set, and "ProcureIQ" when it's absent; the
  Billing nav item is hidden for a member and shown for an admin.
- `src/App.test.jsx`: `/billing` renders the Billing page (admin default) — assert the
  "Billing" heading.

## Execution

Lot E of the deferred-hardening roadmap (demo billing + branding; the last lot). Built via
`superpowers:subagent-driven-development` from a plan in `docs/superpowers/plans/`,
committed on a `7e-billing` branch, merged `--no-ff` to main. The real Stripe live wiring
(keys + price ids + a webhook for plan persistence) is a deferred step.
