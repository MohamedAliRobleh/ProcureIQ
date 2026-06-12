# ProcureIQ Phase 6b: Clerk Authentication — Design Spec

## Context

Phase 6a put the app on a real Neon/Prisma backend behind Vercel functions. 6b replaces the mock auth layer with Clerk: real sign-up/sign-in, a verified session on every API call, and the PATCH org-scoping gap from the 6a review closed.

**Phase 6 decomposition:** 6a backend+DB ✅ → **6b Clerk auth (this spec)** → 6c Anthropic → 6d Cloudinary → 6e EmailJS. Phase 7 (Admin + Portal) follows.

**Decisions made during brainstorming:**
- **Tenancy: shared demo org.** Every authenticated user works in `org_demo` and sees the seeded data. Auth genuinely gates the SPA and the API, but `ORG_ID` stays a server-side constant. True per-org isolation (Clerk Organizations, org switcher, per-org seeding) is Phase 7.
- **Sign-in UX: embedded Clerk components** (`<SignIn/>`/`<SignUp/>` on in-app routes, dark appearance) — no hosted-portal redirect.
- **API auth: Bearer token + networkless `verifyToken`** (`@clerk/backend`), not cookie-based `authenticateRequest`.
- User has a Clerk application; `VITE_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` go into `.env` at implementation time (`.env.example` documents both).

## Goal

Signed-out users can only see the landing page and the sign-in/sign-up routes. Signed-in users get the full app, with every API request carrying a Clerk session token that the functions verify before touching the database.

## Architecture

### Frontend auth adapter (`src/lib/auth.jsx` replaces `src/lib/mockAuth.jsx`)

A local seam so the rest of the app (and the test suite) never imports `@clerk/clerk-react` directly:

- `AuthProvider` — wraps `ClerkProvider` with `publishableKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY` and a dark `appearance` config matching the app palette. Renders a child bridge component that registers Clerk's `getToken` into the apiClient (see Token plumbing). Replaces `MockAuthProvider` in App.jsx.
- `useUser` — re-exported from `@clerk/clerk-react`.
- `useOrganization` — returns `{ isLoaded: true, organization: DEMO_ORG }` where `DEMO_ORG` is the static demo-org object (id `org_demo`, name "Procure IQ Demo Org"). Honest for the shared-org tenancy model; Phase 7 swaps this for Clerk's real hook.
- Re-exports `UserButton`, `SignIn`, `SignUp` from `@clerk/clerk-react` so pages/components import them from the seam.

`mockAuth.jsx` is deleted. TopBar imports from `../../lib/auth`, renders `<UserButton/>` instead of the initials circle (sign-out for free), and falls back to `'member'` when `user.publicMetadata.role` is absent (real users won't have the mock's metadata). TopBar guards `user` being null during load.

### Routes and gating

- `/sign-in` and `/sign-up` — public pages rendering the embedded Clerk components (path routing), centered on the dark background.
- `ProtectedRoute` component (in `src/components/layout/`): `useUser()` → not loaded → `LoadingSpinner`; signed out → `<Navigate to="/sign-in" replace />`; signed in → children. Wraps the AppShell route element in App.jsx, so all module routes are gated at once.
- Landing stays public at `/`. Its "Open App" CTA still points at `/dashboard` — signed-out visitors get bounced to `/sign-in` by ProtectedRoute.

### Token plumbing (`src/lib/apiClient.js`)

- New export `setTokenGetter(fn)` stores a module-level async token getter (null by default).
- `request()` awaits the getter when registered and adds `Authorization: Bearer <token>` to the headers. When no getter is registered (tests), no header is added and behavior is unchanged.
- The bridge component inside `AuthProvider` calls `setTokenGetter(getToken)` from Clerk's `useAuth()` (and clears it on unmount).

### Backend verification (`api/_lib/auth.js`)

```js
requireAuth(handler) → async (req, res)
```

- Reads `req.headers.authorization`; missing/malformed → `401 { error: 'Unauthorized' }`.
- `verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY })` from `@clerk/backend`; rejection → 401.
- Success → `req.auth = { userId: payload.sub }`, then calls the wrapped handler.

All 8 endpoints change their default export to `requireAuth(handler)`. `ORG_ID` stays the constant `'org_demo'` (shared demo org), with its comment updated to say so.

### PATCH org-scoping fix (closes the 6a IDOR flag)

The three `[id].js` handlers (suppliers, contracts, spend) currently update by `id` alone. Each becomes: `findFirst({ where: { id, orgId: ORG_ID } })` → absent → `404`; present → `update({ where: { id }, data })`. The `[id].js` files now import `ORG_ID`, so a future per-request org id reaches every query.

## Data Flow (after 6b)

```
Clerk (session) ──getToken()──▶ apiClient (Bearer header)
                                      │
                                      ▼
                    requireAuth → verifyToken (networkless, CLERK_SECRET_KEY)
                                      │ req.auth.userId
                                      ▼
                          handlers (org-scoped, incl. PATCH) → Prisma → Neon
```

## Testing

- **Backend:** `api/_lib/auth.test.js` — missing header → 401, invalid token (mocked `verifyToken` rejecting) → 401, valid token → handler called with `req.auth.userId`. Existing handler test files add `vi.mock('../_lib/auth.js', () => ({ requireAuth: (h) => h }))` so they keep testing handler logic directly; the PATCH tests gain the org-scope cases (found+updated, not-found → 404).
- **Frontend:** the vitest setup globally mocks `src/lib/auth.jsx` with the old mock shapes — pass-through `AuthProvider`, mock `useUser`/`useOrganization` (Amara Chen / demo org), stub `UserButton`/`SignIn`/`SignUp` placeholders — so every existing page test runs unchanged with zero Clerk network. ProtectedRoute tests override the mocked `useUser` per-test (re-mock `src/lib/auth.jsx` locally in that test file) to simulate loading and signed-out states.
- **New tests:** ProtectedRoute (loading → spinner, signed out → redirect, signed in → children); App routes (`/sign-in` renders the SignIn surface; `/dashboard` while "signed in" via the default mock still renders).
- **Manual:** `vercel dev` → sign up a real account → land on dashboard → CRUD round-trip (API calls carry the Bearer token; a curl without a token gets 401) → sign out → bounced to sign-in.

## Out of Scope (deferred)

- Clerk Organizations, org switcher, per-org data isolation/seeding (Phase 7)
- Roles/permissions enforcement (`publicMetadata.role` is display-only for now; Phase 7 Admin)
- Clerk webhooks / syncing users into the database
- MFA, social-login configuration (Clerk dashboard concerns, not code)
- Rate limiting and audit logging
