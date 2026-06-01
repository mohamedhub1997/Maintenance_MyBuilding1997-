# Apartment Maintenance App — PRD

## Original Problem Statement
User wants a maintenance app for their real estate business to view maintenance
tickets and tenant issues, with maintenance staff documenting fixes via comments
and photo uploads. 3 user roles: Admin (full access), Tenant (>30 tenants, own
data only), Maintenance (assigned tickets only). Admin creates all user accounts.

## User Personas
1. **Admin (property owner)** — sees everything, creates units, tenants,
   maintenance staff, assigns tickets, can delete tickets, view all comments.
2. **Tenant** — logs in with admin-created credentials. Creates maintenance
   tickets (max 3/day) with description + photos. Sees only own tickets + unit.
3. **Maintenance staff** — logs in, sees only tickets assigned to them.
   Adds comments + fix photos. Updates status (open → in_progress → resolved).

## Tech Stack
- Backend: FastAPI + MongoDB (motor), JWT auth (Bearer header), bcrypt
- Frontend: React 18 + React Router + Tailwind (Dark + mid-green)
- Images: base64 stored in MongoDB (compressed client-side to ≤1280px JPEG)

## Core Requirements (static)
- Single login page for all roles, routes user to role-specific dashboard
- Admin-only user creation (no self-registration)
- Tenants linked to specific Units (1:1)
- Tenant rate limit: 3 tickets per UTC day → HTTP 429
- Auto-assign new tickets to least-loaded maintenance staff
- Each ticket has: title, description, category, priority, status, images,
  comment thread (with author role + images)
- Cross-role data isolation enforced on backend (403 on mismatched access)
- Tenant info captured: full_name, phone, national_id, contract_number, unit

## Implemented (2026-01)
- [x] **Web Push notifications** (VAPID + service worker `/sw.js`). Per-user subscriptions stored in MongoDB. "Enable notifications" button in the sidebar. Pushes fire on: ticket assigned to a staffer, status change → tenant, SLA breached → admin + assignee.
- [x] **72-hour SLA** with `due_at` stored on every ticket. Visible `SLA` badge (Due in 5h / Overdue · 12h late / Resolved in 8h) on every ticket card, in the admin Tickets table, and in the ticket Details card. Background asyncio scanner runs every 5 min, marks overdue tickets, and pushes notifications to admin + assignee exactly once.
- [x] **Only admin can mark a ticket resolved** (HTTP 403 for maintenance). Maintenance UI shows only "Open" and "In Progress" buttons.
- [x] **Search & filter on Admin Tickets** — text search (title/desc/tenant/unit/assignee), priority dropdown, assignee dropdown (incl. "Unassigned"), status chips, results counter, Clear filters.
- [x] **Overdue stats card** on the admin dashboard (count of unresolved tickets past due_at).
- [x] **i18n (English + Arabic)** with full RTL.
- [x] **Admin can create tickets on behalf of any tenant** with optional manual assignee.
- [x] **Cancel button** on every Add/Edit modal.
- [x] **httpOnly cookie auth** + Bearer-token fallback.
- [x] 24/24 backend tests passing.

## Architecture / File Map
```
/app/backend/server.py            # FastAPI app, all routes
/app/backend/.env                 # MONGO_URL, JWT_SECRET, admin seed creds
/app/frontend/src/App.js          # Router + role guards
/app/frontend/src/context/AuthContext.js
/app/frontend/src/lib/api.js      # axios w/ Bearer interceptor
/app/frontend/src/components/     # RoleLayout, UI, ImageUploader, ImageGallery
/app/frontend/src/pages/Login.js
/app/frontend/src/pages/TicketDetail.js
/app/frontend/src/pages/admin/    # AdminLayout, Dashboard, Tickets, Tenants,
                                  # Maintenance, Units
/app/frontend/src/pages/tenant/   # TenantLayout, Home, NewTicket
/app/frontend/src/pages/maintenance/  # MaintenanceLayout, Home
```

## Backlog / Future
- P1: Push or email notifications when a ticket changes status / gets a comment
- P1: Export tickets (PDF / CSV) per month / per unit
- P2: Tenant lease end date + reminder
- P2: Bulk CSV import for 30+ existing tenants
- P2: Search & filter on Tickets (text search, by unit, by date range)
- P2: Tenant rating after resolution (1–5 stars)
- P2: SMS-based 2FA on admin login

## Next Action Items
- Smoke-test the UI end-to-end (admin creates unit → tenant → tenant logs
  in → submits ticket → maintenance comments → resolves)
- Optional: split server.py into routers/ as it grows
