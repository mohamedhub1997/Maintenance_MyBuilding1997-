# My Apartment — Maintenance Portal

A multi-role property-maintenance app for real estate owners managing apartment
units. Tenants submit maintenance tickets (with photos), maintenance staff
comment and post fix-photos, and admin oversees everything.

## Stack
- **Backend**: FastAPI + MongoDB (motor), JWT auth (httpOnly cookie + Bearer fallback), bcrypt, pywebpush
- **Frontend**: React 18 + React Router + Tailwind CSS
- **Languages**: English + Arabic (full RTL)

## Features
- Three roles: Admin, Tenant, Maintenance — strict data isolation
- Tenants can submit up to 3 tickets / day, with photo uploads (base64, compressed)
- Auto-assignment to the least-loaded maintenance staffer; admin can override
- 72-hour SLA timer with overdue badges and background scanner
- Web Push notifications (VAPID) for ticket assignment, status change, SLA breach
- Search & filter on tickets (text + priority + assignee + status)
- Admin can create tickets on behalf of any tenant
- Arabic + English with RTL layout

## Local Development

### Backend
```bash
cd backend
cp .env.example .env   # then fill in JWT_SECRET, VAPID_*, etc.
pip install -r requirements.txt
uvicorn server:app --port 8001 --reload
```

You also need MongoDB running locally on port 27017 (or update `MONGO_URL`).

### Frontend
```bash
cd frontend
cp .env.example .env   # ensure REACT_APP_BACKEND_URL points at your backend
yarn install
yarn start
```

### Default Admin
- Username: `admin`
- Password: `admin123` (change via `ADMIN_PASSWORD` in `.env`)

The admin user is auto-seeded on first startup. The admin then creates all
other tenant and maintenance accounts from the admin UI.

## VAPID Keys (for Web Push)

Generate a key pair on first deploy:

```python
from py_vapid import Vapid
from cryptography.hazmat.primitives.serialization import Encoding, PrivateFormat, PublicFormat, NoEncryption
import base64

v = Vapid()
v.generate_keys()
priv_pem = v.private_key.private_bytes(Encoding.PEM, PrivateFormat.PKCS8, NoEncryption()).decode()
pub_bytes = v.public_key.public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
pub_b64 = base64.urlsafe_b64encode(pub_bytes).rstrip(b"=").decode()

print("VAPID_PUBLIC_KEY =", pub_b64)
print("VAPID_PRIVATE_PEM =", priv_pem)
```

Paste both values into `backend/.env`.

## Tests
```bash
cd /
pytest backend/tests/backend_test.py
```
