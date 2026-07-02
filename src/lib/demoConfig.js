// Slug of the shared demo org. Both the sandbox bridge and permission/UI gating
// key off this. Leaf module (no imports) to avoid an auth.jsx <-> consumer cycle.
export const DEMO_ORG_SLUG = import.meta.env.VITE_DEMO_ORG_SLUG ?? 'procureiq-demo'

// True for the demo org's slug. Matches DEMO_ORG_SLUG exactly OR with a Clerk
// auto-generated uniqueness suffix (e.g. "procureiq-demo-1782787479860281484"),
// which Clerk appends when a slug isn't explicitly reserved.
export function isDemoSlug(slug) {
  return !!slug && (slug === DEMO_ORG_SLUG || slug.startsWith(`${DEMO_ORG_SLUG}-`))
}
