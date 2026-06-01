"""
Backend API tests for Apartment Maintenance app.
Covers: health, auth, users, units, tickets (CRUD + RBAC + daily limit + auto-assign),
comments, stats. Uses external REACT_APP_BACKEND_URL.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://apt-management-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
# Passwords used for tenant/maintenance test fixtures (override via env if desired)
TENANT_PASSWORD = os.environ.get("TEST_TENANT_PASSWORD", "tenant-test-pw")
MAINTENANCE_PASSWORD = os.environ.get("TEST_MAINTENANCE_PASSWORD", "maint-test-pw")

# Unique suffix avoids username collisions on rerun
SUFFIX = uuid.uuid4().hex[:8]


# ------------------------------ Fixtures ------------------------------
@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(session, username, password):
    r = session.post(f"{API}/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, f"Login failed for {username}: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="session")
def admin_token(session):
    return _login(session, ADMIN_USERNAME, ADMIN_PASSWORD)["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def seeded(session, admin_headers):
    """Create one unit, one tenant, one maintenance, plus a second tenant on another unit."""
    # Unit 1
    u1 = session.post(f"{API}/units", headers=admin_headers, json={
        "unit_number": f"TEST_{SUFFIX}_101", "address": "1 Test Ave", "building": "A"
    })
    assert u1.status_code == 200, u1.text
    unit1 = u1.json()

    # Unit 2
    u2 = session.post(f"{API}/units", headers=admin_headers, json={
        "unit_number": f"TEST_{SUFFIX}_102", "address": "2 Test Ave", "building": "A"
    })
    assert u2.status_code == 200, u2.text
    unit2 = u2.json()

    # Maintenance user
    m_username = f"test_maint_{SUFFIX}"
    m_password = MAINTENANCE_PASSWORD
    rm = session.post(f"{API}/users", headers=admin_headers, json={
        "username": m_username, "password": m_password, "role": "maintenance",
        "full_name": "Test Maint", "phone": "555-0001",
    })
    assert rm.status_code == 200, rm.text
    maint = rm.json()

    # Tenant 1
    t1_username = f"test_tenant1_{SUFFIX}"
    t1_password = TENANT_PASSWORD
    rt1 = session.post(f"{API}/users", headers=admin_headers, json={
        "username": t1_username, "password": t1_password, "role": "tenant",
        "full_name": "Test Tenant1", "phone": "555-1001",
        "national_id": "ID-001", "contract_number": "C-001",
        "unit_id": unit1["id"],
    })
    assert rt1.status_code == 200, rt1.text
    tenant1 = rt1.json()

    # Tenant 2
    t2_username = f"test_tenant2_{SUFFIX}"
    t2_password = TENANT_PASSWORD
    rt2 = session.post(f"{API}/users", headers=admin_headers, json={
        "username": t2_username, "password": t2_password, "role": "tenant",
        "full_name": "Test Tenant2", "phone": "555-1002",
        "unit_id": unit2["id"],
    })
    assert rt2.status_code == 200, rt2.text
    tenant2 = rt2.json()

    data = {
        "unit1": unit1, "unit2": unit2, "maint": maint,
        "maint_creds": (m_username, m_password),
        "tenant1": tenant1, "tenant1_creds": (t1_username, t1_password),
        "tenant2": tenant2, "tenant2_creds": (t2_username, t2_password),
        "tokens": {},
    }
    data["tokens"]["maint"] = _login(session, m_username, m_password)["token"]
    data["tokens"]["tenant1"] = _login(session, t1_username, t1_password)["token"]
    data["tokens"]["tenant2"] = _login(session, t2_username, t2_password)["token"]

    yield data

    # Teardown: delete tickets first, then users, then units
    # Admin sees all tickets
    r = session.get(f"{API}/tickets", headers=admin_headers)
    if r.status_code == 200:
        for t in r.json():
            if t.get("tenant_id") in (tenant1["id"], tenant2["id"]):
                session.delete(f"{API}/tickets/{t['id']}", headers=admin_headers)
    for uid in (tenant1["id"], tenant2["id"], maint["id"]):
        session.delete(f"{API}/users/{uid}", headers=admin_headers)
    for uid in (unit1["id"], unit2["id"]):
        session.delete(f"{API}/units/{uid}", headers=admin_headers)


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ------------------------------ Health & Auth ------------------------------
class TestHealthAndAuth:
    def test_health(self, session):
        r = session.get(f"{API}/health")
        assert r.status_code == 200
        assert r.json().get("status") == "ok"

    def test_admin_login(self, session):
        r = session.post(f"{API}/auth/login", json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        data = r.json()
        assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 20
        assert data["user"]["role"] == "admin"
        assert data["user"]["username"] == "admin"

    def test_login_invalid(self, session):
        r = session.post(f"{API}/auth/login", json={"username": "admin", "password": "wrong"})
        assert r.status_code == 401

    def test_auth_me(self, session, admin_headers):
        r = session.get(f"{API}/auth/me", headers=admin_headers)
        assert r.status_code == 200
        body = r.json()
        assert body["role"] == "admin"
        assert "password_hash" not in body
        assert "_id" not in body

    def test_auth_me_no_token(self):
        # Use a fresh requests session with no cookies and no Authorization header
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401


# ------------------------------ Users & Units (admin) ------------------------------
class TestAdminCrud:
    def test_seed_creates_objects(self, seeded):
        assert seeded["unit1"]["unit_number"].startswith("TEST_")
        assert seeded["tenant1"]["role"] == "tenant"
        assert seeded["tenant1"]["unit_id"] == seeded["unit1"]["id"]
        assert seeded["maint"]["role"] == "maintenance"
        # password_hash must not leak
        assert "password_hash" not in seeded["tenant1"]
        assert "password_hash" not in seeded["maint"]

    def test_list_users_admin_only(self, session, admin_headers, seeded):
        r = session.get(f"{API}/users", headers=admin_headers)
        assert r.status_code == 200
        ids = [u["id"] for u in r.json()]
        assert seeded["tenant1"]["id"] in ids
        # Tenant cannot list
        r2 = session.get(f"{API}/users", headers=_h(seeded["tokens"]["tenant1"]))
        assert r2.status_code == 403

    def test_create_user_with_bad_unit(self, session, admin_headers):
        r = session.post(f"{API}/users", headers=admin_headers, json={
            "username": f"bad_{SUFFIX}", "password": "x", "role": "tenant",
            "full_name": "X", "unit_id": "non-existent",
        })
        assert r.status_code == 400

    def test_duplicate_username(self, session, admin_headers, seeded):
        u, _p = seeded["tenant1_creds"]
        r = session.post(f"{API}/users", headers=admin_headers, json={
            "username": u, "password": "X", "role": "tenant", "full_name": "Dup",
        })
        assert r.status_code == 400

    def test_admin_cannot_delete_admin(self, session, admin_headers):
        r = session.get(f"{API}/users", headers=admin_headers, params={"role": "admin"})
        assert r.status_code == 200
        admins = r.json()
        assert len(admins) >= 1
        admin_id = admins[0]["id"]
        rd = session.delete(f"{API}/users/{admin_id}", headers=admin_headers)
        assert rd.status_code == 403

    def test_list_units_role_scope(self, session, admin_headers, seeded):
        r = session.get(f"{API}/units", headers=admin_headers)
        assert r.status_code == 200
        nums = [u["unit_number"] for u in r.json()]
        assert seeded["unit1"]["unit_number"] in nums

        # tenant1 -> only unit1
        rt = session.get(f"{API}/units", headers=_h(seeded["tokens"]["tenant1"]))
        assert rt.status_code == 200
        tu = rt.json()
        assert len(tu) == 1 and tu[0]["id"] == seeded["unit1"]["id"]
        assert tu[0]["tenant"]["id"] == seeded["tenant1"]["id"]

        # maintenance -> empty list per current spec
        rm = session.get(f"{API}/units", headers=_h(seeded["tokens"]["maint"]))
        assert rm.status_code == 200
        assert rm.json() == []

    def test_admin_stats(self, session, admin_headers):
        r = session.get(f"{API}/stats", headers=admin_headers)
        assert r.status_code == 200
        body = r.json()
        for k in ("open", "in_progress", "resolved", "total_tickets", "tenants", "maintenance", "units"):
            assert k in body
            assert isinstance(body[k], int)


# ------------------------------ Tickets ------------------------------
class TestTickets:
    def test_tenant_create_ticket_auto_assign(self, session, seeded):
        body = {
            "title": "Leaky faucet", "description": "Drip drip",
            "priority": "high",
            "images": ["data:image/png;base64,iVBORw0KGgo="],
        }
        r = session.post(f"{API}/tickets", headers=_h(seeded["tokens"]["tenant1"]), json=body)
        assert r.status_code == 200, r.text
        t = r.json()
        assert t["status"] == "open"
        assert t["tenant_id"] == seeded["tenant1"]["id"]
        assert t["unit_id"] == seeded["unit1"]["id"]
        # auto-assigned to our maintenance user (only one in system or least-loaded)
        assert t["maintenance_id"] == seeded["maint"]["id"]
        assert t["maintenance"]["id"] == seeded["maint"]["id"]
        assert len(t["images"]) == 1
        seeded["ticket1_id"] = t["id"]

    def test_tenant_lists_only_own(self, session, seeded):
        # Tenant2 creates one too
        r = session.post(f"{API}/tickets", headers=_h(seeded["tokens"]["tenant2"]), json={
            "title": "Light bulb", "description": "Out"
        })
        assert r.status_code == 200
        t2 = r.json()
        seeded["ticket2_id"] = t2["id"]

        r1 = session.get(f"{API}/tickets", headers=_h(seeded["tokens"]["tenant1"]))
        assert r1.status_code == 200
        ids1 = [t["id"] for t in r1.json()]
        assert seeded["ticket1_id"] in ids1
        assert seeded["ticket2_id"] not in ids1

    def test_tenant_cannot_view_other_ticket(self, session, seeded):
        r = session.get(f"{API}/tickets/{seeded['ticket2_id']}", headers=_h(seeded["tokens"]["tenant1"]))
        assert r.status_code == 403

    def test_tenant_cannot_change_status(self, session, seeded):
        r = session.patch(f"{API}/tickets/{seeded['ticket1_id']}/status",
                          headers=_h(seeded["tokens"]["tenant1"]),
                          json={"status": "resolved"})
        assert r.status_code == 403

    def test_maintenance_lists_only_assigned(self, session, seeded):
        r = session.get(f"{API}/tickets", headers=_h(seeded["tokens"]["maint"]))
        assert r.status_code == 200
        for t in r.json():
            assert t["maintenance_id"] == seeded["maint"]["id"]

    def test_maintenance_comment_transitions_status(self, session, seeded):
        tid = seeded["ticket1_id"]
        r = session.post(f"{API}/tickets/{tid}/comments",
                         headers=_h(seeded["tokens"]["maint"]),
                         json={"text": "Will fix today", "images": []})
        assert r.status_code == 200, r.text
        t = r.json()
        assert t["status"] == "in_progress"
        assert any(c["text"] == "Will fix today" for c in t["comments"])

    def test_maintenance_cannot_resolve(self, session, seeded):
        """Maintenance staff are not allowed to mark a ticket resolved — only admin can."""
        tid = seeded["ticket1_id"]
        r = session.patch(f"{API}/tickets/{tid}/status",
                          headers=_h(seeded["tokens"]["maint"]),
                          json={"status": "resolved"})
        assert r.status_code == 403, r.text

    def test_admin_resolve(self, session, seeded, admin_headers):
        """Admin can mark resolved; sets resolved_at."""
        tid = seeded["ticket1_id"]
        r = session.patch(f"{API}/tickets/{tid}/status",
                          headers=admin_headers,
                          json={"status": "resolved"})
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "resolved"

        rg = session.get(f"{API}/tickets/{tid}", headers=admin_headers)
        assert rg.status_code == 200
        assert rg.json()["status"] == "resolved"
        assert rg.json().get("resolved_at")

    def test_maintenance_cannot_touch_other_ticket(self, session, seeded):
        other = seeded["ticket2_id"]
        # Create a second maintenance user so the first one is NOT auto-assigned to other
        # Actually both tickets auto-assigned... t2 was created when both maint had similar loads.
        # Check who t2 is assigned to via admin
        # If maint is also the assignee, this test would not show 403, so create another maint
        # and reassign ticket2 first.
        admin_token = _login(session, ADMIN_USERNAME, ADMIN_PASSWORD)["token"]
        ah = _h(admin_token)
        # Create second maintenance
        m2_username = f"test_maint2_{SUFFIX}"
        rm = session.post(f"{API}/users", headers=ah, json={
            "username": m2_username, "password": "Maint#1234", "role": "maintenance",
            "full_name": "Test Maint2",
        })
        assert rm.status_code == 200
        m2 = rm.json()
        # Reassign ticket2 to m2
        ra = session.patch(f"{API}/tickets/{other}/assign", headers=ah, json={"maintenance_id": m2["id"]})
        assert ra.status_code == 200
        assert ra.json()["maintenance_id"] == m2["id"]

        # Now original maint should be forbidden
        rg = session.get(f"{API}/tickets/{other}", headers=_h(seeded["tokens"]["maint"]))
        assert rg.status_code == 403
        rs = session.patch(f"{API}/tickets/{other}/status",
                           headers=_h(seeded["tokens"]["maint"]),
                           json={"status": "resolved"})
        assert rs.status_code == 403
        rc = session.post(f"{API}/tickets/{other}/comments",
                          headers=_h(seeded["tokens"]["maint"]),
                          json={"text": "hi"})
        assert rc.status_code == 403

        # cleanup secondary maint
        session.delete(f"{API}/users/{m2['id']}", headers=ah)

    def test_admin_assign_ticket(self, session, admin_headers, seeded):
        # Reassign ticket1 to maint (idempotent)
        r = session.patch(f"{API}/tickets/{seeded['ticket1_id']}/assign",
                          headers=admin_headers,
                          json={"maintenance_id": seeded["maint"]["id"]})
        assert r.status_code == 200
        assert r.json()["maintenance_id"] == seeded["maint"]["id"]

    def test_assign_invalid_maintenance(self, session, admin_headers, seeded):
        r = session.patch(f"{API}/tickets/{seeded['ticket1_id']}/assign",
                          headers=admin_headers,
                          json={"maintenance_id": "not-real"})
        assert r.status_code == 400

    def test_tenant_daily_limit(self, session, seeded):
        # tenant1 already has 1 ticket today. Create 2 more (ok), 4th should 429.
        h = _h(seeded["tokens"]["tenant1"])
        for i in range(2):
            r = session.post(f"{API}/tickets", headers=h,
                             json={"title": f"extra {i}", "description": "x"})
            assert r.status_code == 200, f"expected 200, got {r.status_code} {r.text}"
        r4 = session.post(f"{API}/tickets", headers=h,
                          json={"title": "fourth", "description": "should fail"})
        assert r4.status_code == 429, f"expected 429, got {r4.status_code} {r4.text}"
