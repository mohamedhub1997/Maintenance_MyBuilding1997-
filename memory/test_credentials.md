# Test Credentials — Apartment Maintenance App

## Admin (seeded automatically at startup)
- **URL:** https://apt-management-1.preview.emergentagent.com/login
- **Username:** `admin`
- **Password:** `admin123`
- **Role:** admin

## Tenant / Maintenance accounts
There are no pre-seeded tenant or maintenance accounts. The Admin creates them
via the Admin UI:
- Admin → Tenants → "Add Tenant" (username, password, full name, phone,
  national ID, contract number, unit)
- Admin → Maintenance Staff → "Add Staff" (username, password, full name, phone)

## Auth endpoints
- `POST /api/auth/login`  body: `{"username": "...", "password": "..."}`
  Sets httpOnly cookie `access_token`; also returns `{"token": "..."}` for non-browser clients.
- `POST /api/auth/logout` clears the cookie.
- `GET  /api/auth/me`     reads cookie OR `Authorization: Bearer <token>`.

## Notes for testing
- Tenants are limited to 3 ticket submissions per day (HTTP 429 once exceeded).
- Tenants can only see their own tickets / unit.
- Maintenance can only see tickets where they are the assignee.
- Admin sees everything, can assign / reassign tickets, and full CRUD on users/units.
- New tickets auto-assign to the maintenance staff with the fewest open/in-progress tickets if any exist.
