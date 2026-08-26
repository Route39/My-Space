# ATTENDY — Product Requirements & Progress

## Problem Statement
ATTENDY — a clean, simple, production-ready employee management web app.
Tagline: "Attendance. Work. Payroll." Combines Staff Management, Attendance, Leave,
Payroll, and Trello-style Kanban Tasks. Must be extremely easy to use, mobile-responsive,
minimal — feels like a modern productivity app, not a complex HRMS.

## Architecture
- Backend: FastAPI + MongoDB (motor). All routes under `/api`. JWT Bearer auth.
- Frontend: React (CRA/craco) + Tailwind + shadcn/ui. Fonts: Outfit (headings) + Figtree (body).
- Auth: JWT token in localStorage (`attendy_token`), sent as Authorization: Bearer.
- Kanban drag & drop via @hello-pangea/dnd. Payslip PDF via jsPDF.
- Business timezone: Asia/Kolkata (IST) for attendance/hours/status.
- Currency: ₹ INR.

## Roles
- Super Admin: platform level, manages all tenants. (platform@attendy.in / super123)
- Admin: full access within own company. (support@route39.in / admin123)
- Team Leader: own team, attendance, assign/manage tasks, approve/reject leave. (arjun.mehta@attendy.app / password123)
- Staff: check in/out, view attendance, view/update tasks, apply leave, view payslip. (dhanusha.r@attendy.app / password123)

## Multi-Tenant SaaS (June 2026)
- Model: companyname.attendy.in; one deployment serves all tenants; data isolated by org_id.
- Companies extended with slug (unique), brand_color, active, email, phone, created_at.
- Tenant resolved from hostname (frontend lib/tenant.js); public GET /api/tenant/{slug} for branding.
- Tenant-aware login (tenant_slug enforced), company signup (/signup + /api/onboarding/*), slug validation + reserved words.
- Super admin role + /api/platform/companies (+/status). Second seeded org "Demo Company" for isolation tests.
- Isolation hardened: all mutations use fetch-scoped→404→update→return-scoped; verified via direct cross-tenant API calls (all 404/403).
- Full details + deployment guide: /app/MULTI_TENANT.md
- Pre-launch remaining: login throttling, signup rate limiting, CORS allowlist for *.attendy.in, env-flagged seeding, billing/SSO (deferred).

## Implemented (June 2026)
- JWT auth (login/me/logout), role-based access + org isolation.
- Dashboard: admin (4 stats, today's attendance, task counts, payroll total, activity) & staff home (check-in card, my tasks, leave, latest task).
- Staff module: list + search, add staff (creates linked user), employee profile with tabs + salary edit.
- Attendance: staff check-in/out with live timer, history w/ Today/Week/Month filters; admin view all w/ date/dept/status filters + manual mark; shift-based Late/Present logic (IST).
- Tasks: Trello-style Kanban (To Do / In Progress / Completed), drag & drop, create task, card detail (checklist toggle, comments, priority, assignee, due date, status).
- Leave: apply (type/from/to/reason), balance (available/used/pending), TL/admin approve/reject → deducts balance + marks attendance Leave.
- Payroll: generate per month (salary, LOP, overtime, incentive, deduction, net), status Draft/Approved/Paid; staff payslip (earnings/deductions/net + PDF download, gated to Approved/Paid).
- Settings: company, departments, designations, shifts.
- Notifications: top-bar bell (new task, leave decision, payroll) + mark all read.
- Mobile bottom nav (Home/Attendance/Tasks/Leave/Profile).
- Rich seed: Route39 Technologies, 11 employees, 20 days attendance, 10 tasks, leaves, 2 months payroll.

## Security fixes applied (post-test)
- Staff scoped to self on /employees and /employees/{id}.
- Payslip ownership/org check (IDOR fixed).
- Frontend route guards (staff can't open /staff /payroll /settings).
- IST timezone handling + clamp worked-hours >= 0.
- Leave to_date >= from_date validation.

## Backlog (P1/P2)
- P1: org/ownership filters on task mutation & payroll/attendance PUT endpoints; restrict TL leave approve to own team.
- P2: EmailStr validation, salary non-negative validation, pagination on list endpoints, per-employee data inside profile tabs (attendance/tasks/leave currently summarized), shadcn Calendar instead of native date inputs, Dialog aria-describedby.

## My Space module (June 2026)
- New personal-workspace module (sidebar + mobile nav) for every user: Notes (rich text + image/file attachments), Reminders (date/time/repeat → fire via existing notification bell), Checklists (progress), simple Tables (columns/rows, cell edit, numeric Σ totals, sort), Image/File uploads (≤5MB, base64 in `myspace_files`).
- Items: title, type, visibility (private/team/company, default private), pinned, created/updated, owner. Search + filter tabs + pinned section.
- Collections: myspace_items, myspace_files. Endpoints under /api/myspace (+ /upload, /file/{id}, /{id}/pin). Reminders delivered lazily in GET /api/notifications via process_due_reminders.
- Isolation & privacy: org-scoped; owner-only edit/delete; can_view_item enforces private=owner, team=same team, company=same org; verified via pytest (29/29) + cross-tenant 404s.
- Type/visibility validated as enums; search regex escaped; non-owner editor is read-only.

## Next tasks
- Address P1 authorization hardening if multi-org scale is needed.
