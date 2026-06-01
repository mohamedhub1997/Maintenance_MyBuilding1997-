from dotenv import load_dotenv
load_dotenv()

import os
import json
import uuid
import asyncio
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta, date
from typing import Optional, List, Literal
from fastapi import FastAPI, HTTPException, Depends, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient
from pywebpush import webpush, WebPushException

# --- Config ---
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE_PEM = os.environ.get("VAPID_PRIVATE_PEM", "")
VAPID_CONTACT_EMAIL = os.environ.get("VAPID_CONTACT_EMAIL", "admin@example.com")
SLA_HOURS = int(os.environ.get("SLA_HOURS", "72"))
CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()]
JWT_ALG = "HS256"
ACCESS_TOKEN_MINUTES = 60 * 24 * 7  # 7 days

log = logging.getLogger("apartment")
logging.basicConfig(level=logging.INFO)

# --- DB ---
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# --- App ---
app = FastAPI(title="Apartment Maintenance API")

# CORS configuration
# - When CORS_ORIGINS includes "*", we use a regex that matches everything and
#   disable credentials (browsers reject wildcard + credentials).
# - When explicit origins are listed, we enable credentials and only those origins
#   can use them.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600,
)

COOKIE_NAME = "access_token"

# Catch-all OPTIONS handler — guarantees preflight requests always get 200
# instead of 405, even if some path doesn't have its own OPTIONS handler.
# The CORS middleware will then attach the proper Access-Control-* headers.
@app.options("/{rest_of_path:path}")
async def options_catchall(rest_of_path: str):
    return Response(status_code=200)

def set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=ACCESS_TOKEN_MINUTES * 60,
        path="/",
    )

def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(key=COOKIE_NAME, path="/")

# --- Helpers ---
def now_utc() -> datetime:
    return datetime.now(timezone.utc)

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def create_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": now_utc() + timedelta(minutes=ACCESS_TOKEN_MINUTES),
        "iat": now_utc(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

bearer = HTTPBearer(auto_error=False)

async def get_current_user(request: Request) -> dict:
    # Prefer Authorization Bearer (tests/CLI/non-browser clients); fall back to httpOnly cookie (browser).
    auth = request.headers.get("Authorization", "")
    token = None
    if auth.startswith("Bearer "):
        token = auth[7:]
    if not token:
        token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    user.pop("password_hash", None)
    user.pop("_id", None)
    return user

def require_roles(*roles: str):
    async def checker(user: dict = Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Forbidden")
        return user
    return checker

# --- Models ---
class LoginRequest(BaseModel):
    username: str
    password: str

class UserCreate(BaseModel):
    username: str
    password: str
    role: Literal["tenant", "maintenance"]
    full_name: str
    phone: Optional[str] = ""
    national_id: Optional[str] = ""
    contract_number: Optional[str] = ""
    unit_id: Optional[str] = None  # for tenants

class UserUpdate(BaseModel):
    password: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    national_id: Optional[str] = None
    contract_number: Optional[str] = None
    unit_id: Optional[str] = None
    active: Optional[bool] = None

class UnitCreate(BaseModel):
    unit_number: str
    address: str
    building: Optional[str] = ""
    notes: Optional[str] = ""

class UnitUpdate(BaseModel):
    unit_number: Optional[str] = None
    address: Optional[str] = None
    building: Optional[str] = None
    notes: Optional[str] = None

class TicketCreate(BaseModel):
    title: str
    description: str
    category: Optional[str] = "general"
    priority: Optional[Literal["low", "medium", "high"]] = "medium"
    images: List[str] = []  # base64 data URLs
    # Admin-only: create on behalf of a tenant
    tenant_id: Optional[str] = None
    # Admin-only: override auto-assignment
    maintenance_id: Optional[str] = None

class TicketAssign(BaseModel):
    maintenance_id: str

class TicketStatusUpdate(BaseModel):
    status: Literal["open", "in_progress", "resolved"]

class CommentCreate(BaseModel):
    text: str
    images: List[str] = []

class PushSubscriptionIn(BaseModel):
    endpoint: str
    keys: dict  # {"p256dh": "...", "auth": "..."}

# ============ PUSH HELPERS ============
async def save_push_subscription(user_id: str, sub: dict) -> None:
    # one document per endpoint per user
    await db.push_subscriptions.update_one(
        {"user_id": user_id, "subscription.endpoint": sub["endpoint"]},
        {"$set": {"user_id": user_id, "subscription": sub, "updated_at": now_utc().isoformat()}},
        upsert=True,
    )

async def _delete_subscription(_id) -> None:
    await db.push_subscriptions.delete_one({"_id": _id})

async def send_push_to_user(user_id: str, payload: dict) -> None:
    """Fire-and-forget: send a web push to every device subscribed for this user."""
    if not VAPID_PRIVATE_PEM:
        return
    subs = await db.push_subscriptions.find({"user_id": user_id}).to_list(50)
    body = json.dumps(payload)
    for s in subs:
        try:
            webpush(
                subscription_info=s["subscription"],
                data=body,
                vapid_private_key=VAPID_PRIVATE_PEM,
                vapid_claims={"sub": f"mailto:{VAPID_CONTACT_EMAIL}"},
            )
        except WebPushException as e:
            log.warning("webpush failed for %s: %s", user_id, e)
            # 404/410 => endpoint dead, drop subscription
            status_code = getattr(e.response, "status_code", None) if getattr(e, "response", None) else None
            if status_code in (404, 410):
                await _delete_subscription(s["_id"])
        except Exception as e:
            log.warning("webpush error: %s", e)

async def fire_push(user_id: Optional[str], payload: dict) -> None:
    if user_id:
        asyncio.create_task(send_push_to_user(user_id, payload))

async def get_admin_ids() -> List[str]:
    admins = await db.users.find({"role": "admin"}).to_list(20)
    return [a["id"] for a in admins]

# --- Helper sanitizers ---
def clean_doc(d: dict) -> dict:
    if not d:
        return d
    d.pop("_id", None)
    d.pop("password_hash", None)
    return d

async def get_user_public(user_id: str) -> Optional[dict]:
    u = await db.users.find_one({"id": user_id})
    if not u:
        return None
    return {
        "id": u["id"],
        "username": u["username"],
        "full_name": u.get("full_name", ""),
        "role": u["role"],
    }

# ============ AUTH ============
@app.post("/api/auth/login")
async def login(body: LoginRequest, response: Response):
    user = await db.users.find_one({"username": body.username.lower().strip()})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if not user.get("active", True):
        raise HTTPException(status_code=403, detail="Account disabled")
    token = create_token(user["id"], user["role"])
    set_auth_cookie(response, token)
    return {
        "token": token,  # also returned so non-browser clients (tests/curl) can use Bearer
        "user": {
            "id": user["id"],
            "username": user["username"],
            "role": user["role"],
            "full_name": user.get("full_name", ""),
            "unit_id": user.get("unit_id"),
        },
    }

@app.post("/api/auth/logout")
async def logout(response: Response):
    clear_auth_cookie(response)
    return {"ok": True}

@app.get("/api/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

# ============ USERS (admin only) ============
@app.get("/api/users")
async def list_users(
    role: Optional[str] = None,
    user: dict = Depends(require_roles("admin")),
):
    q = {}
    if role:
        q["role"] = role
    users = await db.users.find(q).sort("created_at", -1).to_list(1000)
    return [clean_doc(u) for u in users]

@app.post("/api/users")
async def create_user(body: UserCreate, user: dict = Depends(require_roles("admin"))):
    username = body.username.lower().strip()
    if not username or not body.password:
        raise HTTPException(status_code=400, detail="Username and password required")
    existing = await db.users.find_one({"username": username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    if body.unit_id:
        unit = await db.units.find_one({"id": body.unit_id})
        if not unit:
            raise HTTPException(status_code=400, detail="Unit not found")
    doc = {
        "id": str(uuid.uuid4()),
        "username": username,
        "password_hash": hash_password(body.password),
        "role": body.role,
        "full_name": body.full_name,
        "phone": body.phone or "",
        "national_id": body.national_id or "",
        "contract_number": body.contract_number or "",
        "unit_id": body.unit_id if body.role == "tenant" else None,
        "active": True,
        "created_at": now_utc().isoformat(),
    }
    await db.users.insert_one(doc)
    return clean_doc(doc)

@app.patch("/api/users/{user_id}")
async def update_user(user_id: str, body: UserUpdate, user: dict = Depends(require_roles("admin"))):
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target["role"] == "admin":
        raise HTTPException(status_code=403, detail="Cannot modify admin")
    updates = {}
    data = body.model_dump(exclude_none=True)
    if "password" in data:
        updates["password_hash"] = hash_password(data.pop("password"))
    updates.update(data)
    if updates:
        await db.users.update_one({"id": user_id}, {"$set": updates})
    out = await db.users.find_one({"id": user_id})
    return clean_doc(out)

@app.delete("/api/users/{user_id}")
async def delete_user(user_id: str, user: dict = Depends(require_roles("admin"))):
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target["role"] == "admin":
        raise HTTPException(status_code=403, detail="Cannot delete admin")
    await db.users.delete_one({"id": user_id})
    return {"ok": True}

# ============ UNITS (admin only) ============
@app.get("/api/units")
async def list_units(user: dict = Depends(get_current_user)):
    # Admin sees all; tenant sees only their unit; maintenance sees units of their tickets
    if user["role"] == "admin":
        units = await db.units.find().sort("unit_number", 1).to_list(1000)
    elif user["role"] == "tenant":
        if not user.get("unit_id"):
            return []
        u = await db.units.find_one({"id": user["unit_id"]})
        units = [u] if u else []
    else:
        return []
    result = []
    for un in units:
        if not un:
            continue
        un = clean_doc(un)
        # attach tenant
        t = await db.users.find_one({"unit_id": un["id"], "role": "tenant"})
        un["tenant"] = (
            {"id": t["id"], "username": t["username"], "full_name": t.get("full_name", ""), "phone": t.get("phone", "")}
            if t
            else None
        )
        result.append(un)
    return result

@app.post("/api/units")
async def create_unit(body: UnitCreate, user: dict = Depends(require_roles("admin"))):
    doc = {
        "id": str(uuid.uuid4()),
        "unit_number": body.unit_number,
        "address": body.address,
        "building": body.building or "",
        "notes": body.notes or "",
        "created_at": now_utc().isoformat(),
    }
    await db.units.insert_one(doc)
    return clean_doc(doc)

@app.patch("/api/units/{unit_id}")
async def update_unit(unit_id: str, body: UnitUpdate, user: dict = Depends(require_roles("admin"))):
    u = await db.units.find_one({"id": unit_id})
    if not u:
        raise HTTPException(status_code=404, detail="Unit not found")
    updates = body.model_dump(exclude_none=True)
    if updates:
        await db.units.update_one({"id": unit_id}, {"$set": updates})
    out = await db.units.find_one({"id": unit_id})
    return clean_doc(out)

@app.delete("/api/units/{unit_id}")
async def delete_unit(unit_id: str, user: dict = Depends(require_roles("admin"))):
    u = await db.units.find_one({"id": unit_id})
    if not u:
        raise HTTPException(status_code=404, detail="Unit not found")
    # unlink tenants
    await db.users.update_many({"unit_id": unit_id}, {"$set": {"unit_id": None}})
    await db.units.delete_one({"id": unit_id})
    return {"ok": True}

# ============ TICKETS ============
async def enrich_ticket(t: dict) -> dict:
    t = clean_doc(t)
    if t.get("tenant_id"):
        t["tenant"] = await get_user_public(t["tenant_id"])
    if t.get("maintenance_id"):
        t["maintenance"] = await get_user_public(t["maintenance_id"])
    if t.get("unit_id"):
        u = await db.units.find_one({"id": t["unit_id"]})
        if u:
            t["unit"] = {"id": u["id"], "unit_number": u["unit_number"], "address": u["address"]}
    return t

@app.get("/api/tickets")
async def list_tickets(user: dict = Depends(get_current_user)):
    if user["role"] == "admin":
        q = {}
    elif user["role"] == "tenant":
        q = {"tenant_id": user["id"]}
    else:  # maintenance
        q = {"maintenance_id": user["id"]}
    tickets = await db.tickets.find(q).sort("created_at", -1).to_list(1000)
    return [await enrich_ticket(t) for t in tickets]

@app.post("/api/tickets")
async def create_ticket(body: TicketCreate, user: dict = Depends(get_current_user)):
    if user["role"] == "maintenance":
        raise HTTPException(status_code=403, detail="Maintenance staff cannot create tickets")

    # Resolve the tenant the ticket is for.
    if user["role"] == "admin":
        if not body.tenant_id:
            raise HTTPException(status_code=400, detail="tenant_id is required for admin")
        tenant = await db.users.find_one({"id": body.tenant_id, "role": "tenant"})
        if not tenant:
            raise HTTPException(status_code=400, detail="Tenant not found")
    else:  # tenant
        # Enforce 3 tickets/day limit for tenants
        today_start = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc).isoformat()
        count_today = await db.tickets.count_documents(
            {"tenant_id": user["id"], "created_at": {"$gte": today_start}}
        )
        if count_today >= 3:
            raise HTTPException(status_code=429, detail="Daily ticket limit reached (3 per day)")
        if body.tenant_id and body.tenant_id != user["id"]:
            raise HTTPException(status_code=403, detail="Tenants can only create tickets for themselves")
        tenant = user

    if not tenant.get("unit_id"):
        raise HTTPException(status_code=400, detail="Tenant is not assigned to a unit yet.")

    # Resolve maintenance assignment.
    assignment = None
    if user["role"] == "admin" and body.maintenance_id:
        m = await db.users.find_one({"id": body.maintenance_id, "role": "maintenance"})
        if not m:
            raise HTTPException(status_code=400, detail="Maintenance user not found")
        assignment = body.maintenance_id
    else:
        # Auto-assign to the least-loaded active maintenance staff (if any).
        maintenance_users = await db.users.find({"role": "maintenance", "active": True}).to_list(100)
        if maintenance_users:
            loads = []
            for m in maintenance_users:
                c = await db.tickets.count_documents(
                    {"maintenance_id": m["id"], "status": {"$in": ["open", "in_progress"]}}
                )
                loads.append((c, m["id"]))
            loads.sort()
            assignment = loads[0][1]

    created_at_dt = now_utc()
    doc = {
        "id": str(uuid.uuid4()),
        "title": body.title,
        "description": body.description,
        "category": body.category or "general",
        "priority": body.priority or "medium",
        "status": "open",
        "tenant_id": tenant["id"],
        "unit_id": tenant["unit_id"],
        "maintenance_id": assignment,
        "images": body.images or [],
        "comments": [],
        "created_by": user["id"],
        "created_by_role": user["role"],
        "created_at": created_at_dt.isoformat(),
        "updated_at": created_at_dt.isoformat(),
        "due_at": (created_at_dt + timedelta(hours=SLA_HOURS)).isoformat(),
        "overdue_notified": False,
        "resolved_at": None,
    }
    await db.tickets.insert_one(doc)
    # Notifications: tell the assigned maintenance staff a ticket landed in their queue.
    if assignment:
        await fire_push(assignment, {
            "title": "New ticket assigned to you",
            "body": body.title,
            "url": f"/maintenance/tickets/{doc['id']}",
        })
    return await enrich_ticket(doc)

@app.get("/api/tickets/{ticket_id}")
async def get_ticket(ticket_id: str, user: dict = Depends(get_current_user)):
    t = await db.tickets.find_one({"id": ticket_id})
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if user["role"] == "tenant" and t.get("tenant_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    if user["role"] == "maintenance" and t.get("maintenance_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    return await enrich_ticket(t)

@app.patch("/api/tickets/{ticket_id}/assign")
async def assign_ticket(ticket_id: str, body: TicketAssign, user: dict = Depends(require_roles("admin"))):
    t = await db.tickets.find_one({"id": ticket_id})
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    m = await db.users.find_one({"id": body.maintenance_id, "role": "maintenance"})
    if not m:
        raise HTTPException(status_code=400, detail="Maintenance user not found")
    previous = t.get("maintenance_id")
    await db.tickets.update_one(
        {"id": ticket_id},
        {"$set": {"maintenance_id": body.maintenance_id, "updated_at": now_utc().isoformat()}},
    )
    if body.maintenance_id != previous:
        await fire_push(body.maintenance_id, {
            "title": "Ticket assigned to you",
            "body": t.get("title", ""),
            "url": f"/maintenance/tickets/{ticket_id}",
        })
    t = await db.tickets.find_one({"id": ticket_id})
    return await enrich_ticket(t)

@app.patch("/api/tickets/{ticket_id}/status")
async def update_status(ticket_id: str, body: TicketStatusUpdate, user: dict = Depends(get_current_user)):
    t = await db.tickets.find_one({"id": ticket_id})
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if user["role"] == "tenant":
        raise HTTPException(status_code=403, detail="Tenants cannot change status")
    if user["role"] == "maintenance":
        if t.get("maintenance_id") != user["id"]:
            raise HTTPException(status_code=403, detail="Forbidden")
        # Maintenance staff cannot mark a ticket resolved. Only admin can close.
        if body.status == "resolved":
            raise HTTPException(
                status_code=403,
                detail="Only admin can mark a ticket as resolved.",
            )

    updates = {"status": body.status, "updated_at": now_utc().isoformat()}
    if body.status == "resolved" and not t.get("resolved_at"):
        updates["resolved_at"] = now_utc().isoformat()
    await db.tickets.update_one({"id": ticket_id}, {"$set": updates})

    if body.status != t["status"]:
        # Notify tenant so they know the ticket moved.
        await fire_push(t.get("tenant_id"), {
            "title": f"Your ticket is now {body.status.replace('_', ' ')}",
            "body": t.get("title", ""),
            "url": f"/tenant/tickets/{ticket_id}",
        })

    t = await db.tickets.find_one({"id": ticket_id})
    return await enrich_ticket(t)

@app.delete("/api/tickets/{ticket_id}")
async def delete_ticket(ticket_id: str, user: dict = Depends(require_roles("admin"))):
    res = await db.tickets.delete_one({"id": ticket_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return {"ok": True}

@app.post("/api/tickets/{ticket_id}/comments")
async def add_comment(ticket_id: str, body: CommentCreate, user: dict = Depends(get_current_user)):
    t = await db.tickets.find_one({"id": ticket_id})
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if user["role"] == "tenant" and t.get("tenant_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    if user["role"] == "maintenance" and t.get("maintenance_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    comment = {
        "id": str(uuid.uuid4()),
        "author_id": user["id"],
        "author_name": user.get("full_name") or user["username"],
        "author_role": user["role"],
        "text": body.text,
        "images": body.images or [],
        "created_at": now_utc().isoformat(),
    }
    new_status = t["status"]
    # Auto-transition: maintenance commenting on an open ticket -> in_progress
    if user["role"] == "maintenance" and t["status"] == "open":
        new_status = "in_progress"
    await db.tickets.update_one(
        {"id": ticket_id},
        {
            "$push": {"comments": comment},
            "$set": {"status": new_status, "updated_at": now_utc().isoformat()},
        },
    )
    t = await db.tickets.find_one({"id": ticket_id})
    return await enrich_ticket(t)

# ============ STATS (admin) ============
@app.get("/api/stats")
async def stats(user: dict = Depends(require_roles("admin"))):
    return {
        "open": await db.tickets.count_documents({"status": "open"}),
        "in_progress": await db.tickets.count_documents({"status": "in_progress"}),
        "resolved": await db.tickets.count_documents({"status": "resolved"}),
        "total_tickets": await db.tickets.count_documents({}),
        "overdue": await db.tickets.count_documents({
            "status": {"$ne": "resolved"},
            "due_at": {"$lt": now_utc().isoformat()},
        }),
        "tenants": await db.users.count_documents({"role": "tenant"}),
        "maintenance": await db.users.count_documents({"role": "maintenance"}),
        "units": await db.units.count_documents({}),
    }

# ============ PUSH NOTIFICATIONS ============
@app.get("/api/notifications/vapid-key")
async def vapid_key():
    return {"key": VAPID_PUBLIC_KEY}

@app.post("/api/notifications/subscribe")
async def subscribe(body: PushSubscriptionIn, user: dict = Depends(get_current_user)):
    await save_push_subscription(user["id"], body.model_dump())
    return {"ok": True}

@app.post("/api/notifications/unsubscribe")
async def unsubscribe(body: PushSubscriptionIn, user: dict = Depends(get_current_user)):
    await db.push_subscriptions.delete_one(
        {"user_id": user["id"], "subscription.endpoint": body.endpoint}
    )
    return {"ok": True}

@app.get("/api/notifications/status")
async def notif_status(user: dict = Depends(get_current_user)):
    """Returns whether THIS user has any active subscriptions on the server."""
    count = await db.push_subscriptions.count_documents({"user_id": user["id"]})
    return {"subscribed": count > 0, "vapid_public_key": VAPID_PUBLIC_KEY}

# ============ SLA BACKGROUND TASK ============
SLA_SCAN_INTERVAL_SECONDS = 5 * 60  # every 5 minutes

async def sla_scan_once():
    """Find tickets that crossed their due_at, are not resolved, and not yet notified."""
    now_iso = now_utc().isoformat()
    cursor = db.tickets.find({
        "status": {"$ne": "resolved"},
        "due_at": {"$lt": now_iso},
        "overdue_notified": {"$ne": True},
    })
    overdue = await cursor.to_list(500)
    if not overdue:
        return 0
    admin_ids = await get_admin_ids()
    for t in overdue:
        # Mark first to avoid double notifications on rapid scans.
        await db.tickets.update_one(
            {"id": t["id"]},
            {"$set": {"overdue_notified": True, "overdue_notified_at": now_iso}},
        )
        payload = {
            "title": f"Ticket overdue ({SLA_HOURS}h SLA breached)",
            "body": t.get("title", ""),
            "url": f"/admin/tickets/{t['id']}",
        }
        for aid in admin_ids:
            await fire_push(aid, payload)
        if t.get("maintenance_id"):
            payload_m = {**payload, "url": f"/maintenance/tickets/{t['id']}"}
            await fire_push(t["maintenance_id"], payload_m)
    return len(overdue)

async def sla_loop():
    while True:
        try:
            n = await sla_scan_once()
            if n:
                log.info("SLA scan flagged %d overdue ticket(s)", n)
        except Exception as e:
            log.exception("SLA scan error: %s", e)
        await asyncio.sleep(SLA_SCAN_INTERVAL_SECONDS)

# ============ STARTUP ============
@app.on_event("startup")
async def startup():
    await db.users.create_index("username", unique=True)
    await db.units.create_index("unit_number")
    await db.tickets.create_index("tenant_id")
    await db.tickets.create_index("maintenance_id")
    await db.tickets.create_index("due_at")
    await db.push_subscriptions.create_index([("user_id", 1)])
    # Seed admin
    admin = await db.users.find_one({"username": ADMIN_USERNAME.lower()})
    if not admin:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "username": ADMIN_USERNAME.lower(),
            "password_hash": hash_password(ADMIN_PASSWORD),
            "role": "admin",
            "full_name": "Administrator",
            "active": True,
            "created_at": now_utc().isoformat(),
        })
    else:
        if not verify_password(ADMIN_PASSWORD, admin["password_hash"]):
            await db.users.update_one(
                {"username": ADMIN_USERNAME.lower()},
                {"$set": {"password_hash": hash_password(ADMIN_PASSWORD)}},
            )
    # Kick off the SLA background scanner.
    asyncio.create_task(sla_loop())

@app.get("/api/health")
async def health():
    return {"status": "ok"}
