# ATTENDY — Multi-Tenant SaaS Foundation

Model: `companyname.attendy.in` (e.g. `route39.attendy.in`, `abc.attendy.in`). One
application deployment serves all tenants; each company's data is fully isolated.

## 1. Architecture
- Single FastAPI + MongoDB backend, single React frontend, one deployment for all tenants.
- Every tenant = one `companies` document (the existing organization system, extended).
- Every domain record carries `org_id` and is queried scoped to the authenticated user's org.

## 2. Tenant identification
- **Frontend** (`src/lib/tenant.js` → `getTenantSlug()`): parses the hostname.
  `route39.attendy.in` → slug `route39`. `localhost`, IPs and the `*.preview.emergentagent.com`
  URL return `null` → the shared/demo workspace (dev backward-compat).
- On load the app calls public `GET /api/tenant/{slug}` to fetch branding (name, logo, brand_color, active).
- On login the resolved slug is sent as `tenant_slug`; the backend rejects a login whose
  account belongs to a different workspace (403).

## 3. Tenant isolation (enforced in the backend, not the UI)
- `get_current_user` loads the user from the DB; `org_id` comes from the stored record, never
  from the client. The client cannot supply/override an org id.
- Every list/read/write query is scoped by `{"org_id": user["org_id"]}`.
- Mutations follow the pattern **fetch-scoped → 404 if missing → update → return scoped**, so a
  foreign tenant id yields 404 (no read or write leak).
- `/api/payslip/{id}` additionally checks org + (for staff) ownership.
- Verified with direct API calls using another tenant's IDs (see Security Testing below).

## 4. Roles
- `super_admin` — platform level, not tied to a company (`org_id = null`). Manages tenants.
- `admin` — full access within their own company.
- `team_leader` — their team's attendance/tasks/leave.
- `staff` — self-service.

## 5. Database changes (companies collection)
Added fields: `slug` (unique index), `brand_color`, `active`, `email`, `phone`, `created_at`
(existing `id`, `name`, `logo`, `address` retained). A super_admin user and a second demo org
are ensured on startup by `run_migrations()` (idempotent). Existing Route39 data is preserved
and backfilled with `slug=route39`.

## 6. API changes (all under `/api`)
Public: `GET /tenant/{slug}`, `GET /onboarding/slug-available/{slug}`, `POST /onboarding/signup`.
Auth: `POST /auth/login` now accepts optional `tenant_slug` and enforces active + workspace match.
Platform (super_admin only): `GET /platform/companies`, `PUT /platform/companies/{org_id}/status`.
All existing endpoints unchanged in contract; isolation hardened internally.

## 7. Slug rules
Lowercase, 3–32 chars, `[a-z0-9-]`, must start/end alphanumeric, unique, and not a reserved
word (www, app, admin, api, support, billing, help, status, platform, attendy, …).

## 8. Company onboarding
`POST /api/onboarding/signup {company_name, slug, admin_name, admin_email, password}` →
creates the org + default departments/designations/shift + company admin + returns a JWT.
Frontend page: `/signup` (slug auto-fills from company name with live availability check).

## 9. Deployment for *.attendy.in (infra to be configured at launch)
1. **DNS**: wildcard `*.attendy.in` A/CNAME → the load balancer/ingress (provider-agnostic).
2. **TLS**: wildcard certificate for `*.attendy.in` (e.g. cert-manager / ACME DNS-01).
3. **Ingress / reverse proxy**: route ALL subdomains to the same frontend + backend service
   (no per-tenant deployment). The app derives the tenant from the `Host` header client-side.
4. **CORS**: set `CORS_ORIGINS` to `https://*.attendy.in` (use an explicit allowlist /
   `allow_origin_regex`) rather than `*` once cookie-based auth is adopted.
5. No DNS-provider lock-in; any provider supporting wildcard records works.

## 10. Security tests performed (2 orgs: Route39 + Demo, via direct API)
- Demo token vs Route39 ids: GET employee/task → 404; payslip → 403; lists scoped to own org.
- Cross-tenant WRITES (task status/update/comment/checklist, employee update/salary, attendance
  edit/mark, leave approve/reject, payroll status/adjust) → 404, no mutation, no data returned.
- Tenant-aware login: mismatched slug → 403; matching slug → 200; no slug → 200 (dev).
- Platform: company admin → 403 on /platform; super_admin lists companies; deactivate → users'
  login 403; unknown org → 404. Both companies left active.

## 11. Remaining work before commercial SaaS launch (NOT in this foundation task)
- Login brute-force throttling / lockout; consider httpOnly cookie sessions vs localStorage JWT.
- Rate limiting / captcha on public `POST /onboarding/signup`.
- Tighten CORS to `*.attendy.in` allowlist.
- Subscription billing, pricing page, customer portal, usage metering, white-label, custom
  domains, SSO (explicitly deferred).
- Move super_admin/demo seeding behind env flags so production has no known-password accounts.
- Split `server.py` into routers/models modules as tenant features grow.
