# Clerk setup — ProcureIQ

ProcureIQ uses **Clerk** for authentication and **Clerk Organizations** for
multi-tenancy: every workspace is an organization, and all data + billing are scoped
per-org. This doc lists the Clerk dashboard configuration the app expects, with the
recommended values.

## 1. Environment variables

Set these in `.env` (local) and in the Vercel project env (deployed). See `.env.example`.

| Variable | Where | Notes |
|---|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | frontend | `pk_test_…` / `pk_live_…` — safe to ship |
| `CLERK_SECRET_KEY` | backend only | `sk_test_…` / `sk_live_…` — never expose; verifies session tokens server-side |

## 2. Enable Organizations (required)

The app is org-scoped end to end — without an active organization the user is held at the
"Select or create an organization" gate (`RequireOrg`), and every API endpoint 403s with
"No active organization".

- **Clerk Dashboard → Configure → Organizations → Enable Organizations.**

Until this is on, the multi-org / admin / permissions features don't work (the test suite
stays green regardless, because tests mock Clerk).

## 3. Organization creation limit (recommended)

**How many organizations a user can create is a Clerk dashboard setting — the app imposes
no limit of its own** (org creation is delegated to Clerk's `<OrganizationSwitcher>`).

**Clerk Dashboard → Configure → Organizations → Settings:**

| Setting | Recommended | Why |
|---|---|---|
| Allow users to create organizations | **On** | Keeps the self-serve flow working (and lets you/reviewers spin up test orgs). |
| Maximum number of organizations a user can create | **1–2** (up to 3) | In B2B procurement a user usually represents **one company**. A low cap prevents spam and limits proliferation of **billable** workspaces (billing is per-org). Use 3 only if you expect consultants managing several companies. |

Alternative model — **sales-led / invite-only**: turn *Allow users to create
organizations* **Off**. Users then only **join** orgs you provision, via invitation (an
admin invites them from **Admin → OrganizationProfile**).

**Not recommended:** unlimited creation (spam + billable-workspace sprawl), or hard-coding
a limit in the app (redundant with Clerk, more surface to maintain). Build custom gating
only for a rule Clerk can't express — e.g. "creating a 2nd org requires a paid plan",
which would be a future lot wired to billing (Lot E).

## 4. Roles → app permissions

Clerk's two default org roles map directly to the app's permission model (Lot D):

| Clerk role | In ProcureIQ |
|---|---|
| `org:admin` | Full manage: create/edit/delete across suppliers/contracts/spend/portal, plus the Admin page (members, danger zone, audit log, export) and Billing. |
| `org:member` | **Read-only**: sees every module but write endpoints return 403 and write UI is hidden. |

Members and invitations are managed by Clerk's prebuilt `OrganizationProfile` on the
**`/admin`** page (admins only). No custom member table exists.

## 5. Appearance

The dark theme for all Clerk components (SignIn, SignUp, OrganizationSwitcher, UserButton,
OrganizationProfile) is configured **in code** — `CLERK_APPEARANCE` in `src/lib/auth.jsx`
(`baseTheme: dark` + brand variables/elements). No dashboard appearance change is needed.

## 6. Quick checklist

- [ ] `VITE_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` set (local + Vercel).
- [ ] Organizations **enabled**.
- [ ] *Allow users to create organizations* **On**; *max per user* **1–2**.
- [ ] Roles left as default `org:admin` / `org:member`.
- [ ] (Verify) sign in → create an org → invite a member as `org:member` → confirm they
      get read-only (no write buttons, write API 403, no Admin nav item).
