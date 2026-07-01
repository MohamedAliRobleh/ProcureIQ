// Slug of the shared demo org. Both the sandbox bridge and permission/UI gating
// key off this. Leaf module (no imports) to avoid an auth.jsx <-> consumer cycle.
export const DEMO_ORG_SLUG = import.meta.env.VITE_DEMO_ORG_SLUG ?? 'procureiq-demo'
