"""My Space Kanban STATUS enhancement — backend tests.

Covers: default status on create for every item type, explicit status on create,
status update via PUT, invalid status -> 422, GET ?status= filter, independence
of status from pin/visibility/reminder, owner-only status edit, cross-tenant 404,
and migration backfill (no item without a status).
"""
import pytest
import requests

from conftest import BASE_URL, CRED_PAIRS

TYPES = ["note", "reminder", "checklist", "table", "file"]


@pytest.fixture(scope="module")
def created(staff):
    ids = []
    yield ids
    for i in ids:
        staff.delete(f"{BASE_URL}/api/myspace/{i}", timeout=30)


@pytest.fixture(scope="module")
def demo_admin():
    pair = next((p for p in CRED_PAIRS if p[0].startswith("demo@")), None)
    if not pair:
        pytest.skip("demo credentials missing")
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": pair[0], "password": pair[1]}, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"demo login failed: {r.status_code} {r.text[:200]}")
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s


def _mk(client, created, **kw):
    body = {"type": "note", "title": "TEST_status_item"}
    body.update(kw)
    r = client.post(f"{BASE_URL}/api/myspace", json=body, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    created.append(d["id"])
    return d


# ---------- default status per type ----------
class TestDefaultStatus:
    @pytest.mark.parametrize("itype", TYPES)
    def test_create_defaults_to_new(self, staff, created, itype):
        d = _mk(staff, created, type=itype, title=f"TEST_st_{itype}")
        assert d["status"] == "new"
        g = staff.get(f"{BASE_URL}/api/myspace/{d['id']}", timeout=30)
        assert g.status_code == 200
        assert g.json()["status"] == "new"
        assert "_id" not in g.json()

    def test_create_with_explicit_status(self, staff, created):
        d = _mk(staff, created, title="TEST_st_explicit", status="in_progress")
        assert d["status"] == "in_progress"
        assert staff.get(f"{BASE_URL}/api/myspace/{d['id']}", timeout=30).json()["status"] == "in_progress"

    def test_create_invalid_status_422(self, staff):
        r = staff.post(f"{BASE_URL}/api/myspace", json={"type": "note", "title": "TEST_bad", "status": "done"}, timeout=30)
        assert r.status_code == 422, r.text


# ---------- update ----------
class TestStatusUpdate:
    def test_put_status_transitions_persist(self, staff, created):
        d = _mk(staff, created, title="TEST_st_flow")
        for st in ["in_progress", "completed", "new"]:
            r = staff.put(f"{BASE_URL}/api/myspace/{d['id']}", json={"status": st}, timeout=30)
            assert r.status_code == 200, r.text
            assert r.json()["status"] == st
            g = staff.get(f"{BASE_URL}/api/myspace/{d['id']}", timeout=30)
            assert g.json()["status"] == st

    def test_put_invalid_status_422(self, staff, created):
        d = _mk(staff, created, title="TEST_st_badupd")
        r = staff.put(f"{BASE_URL}/api/myspace/{d['id']}", json={"status": "done"}, timeout=30)
        assert r.status_code == 422, r.text
        assert staff.get(f"{BASE_URL}/api/myspace/{d['id']}", timeout=30).json()["status"] == "new"

    def test_status_only_put_preserves_other_fields(self, staff, created):
        d = _mk(staff, created, title="TEST_st_preserve", content="hello world",
                visibility="company", pinned=True)
        r = staff.put(f"{BASE_URL}/api/myspace/{d['id']}", json={"status": "completed"}, timeout=30)
        assert r.status_code == 200
        g = staff.get(f"{BASE_URL}/api/myspace/{d['id']}", timeout=30).json()
        assert g["status"] == "completed"
        assert g["content"] == "hello world"
        assert g["visibility"] == "company"
        assert g["pinned"] is True

    def test_non_owner_cannot_change_status(self, staff, admin, created):
        d = _mk(staff, created, title="TEST_st_shared", visibility="company")
        r = admin.put(f"{BASE_URL}/api/myspace/{d['id']}", json={"status": "completed"}, timeout=30)
        assert r.status_code == 403, r.text
        assert staff.get(f"{BASE_URL}/api/myspace/{d['id']}", timeout=30).json()["status"] == "new"

    def test_cross_tenant_status_update_404(self, staff, demo_admin, created):
        d = _mk(staff, created, title="TEST_st_xtenant", visibility="company")
        r = demo_admin.put(f"{BASE_URL}/api/myspace/{d['id']}", json={"status": "completed"}, timeout=30)
        assert r.status_code == 404, r.text


# ---------- filtering ----------
class TestStatusFilter:
    def test_filter_by_status(self, staff, created):
        a = _mk(staff, created, title="TEST_st_f_ip", status="in_progress")
        b = _mk(staff, created, title="TEST_st_f_done", status="completed")
        r = staff.get(f"{BASE_URL}/api/myspace", params={"status": "in_progress"}, timeout=30)
        assert r.status_code == 200
        ids = [i["id"] for i in r.json()]
        assert a["id"] in ids and b["id"] not in ids
        assert all(i["status"] == "in_progress" for i in r.json())

    def test_status_and_type_filter_combine(self, staff, created):
        c = _mk(staff, created, type="checklist", title="TEST_st_cl", status="completed")
        r = staff.get(f"{BASE_URL}/api/myspace", params={"filter": "checklist", "status": "completed"}, timeout=30)
        assert r.status_code == 200
        assert all(i["type"] == "checklist" and i["status"] == "completed" for i in r.json())
        assert c["id"] in [i["id"] for i in r.json()]

    def test_all_listed_items_have_status(self, staff):
        """Migration backfill: every visible item exposes a valid status."""
        r = staff.get(f"{BASE_URL}/api/myspace", timeout=30)
        assert r.status_code == 200
        bad = [i["id"] for i in r.json() if i.get("status") not in ("new", "in_progress", "completed")]
        assert not bad, f"items without valid status: {bad}"


# ---------- independence ----------
class TestIndependence:
    def test_pin_does_not_change_status(self, staff, created):
        d = _mk(staff, created, title="TEST_st_pin", status="in_progress")
        r = staff.put(f"{BASE_URL}/api/myspace/{d['id']}/pin", timeout=30)
        assert r.status_code == 200
        assert r.json()["pinned"] is True
        assert r.json()["status"] == "in_progress"

    def test_visibility_change_keeps_status(self, staff, created):
        d = _mk(staff, created, title="TEST_st_vis", status="completed", visibility="private")
        r = staff.put(f"{BASE_URL}/api/myspace/{d['id']}", json={"visibility": "company"}, timeout=30)
        assert r.status_code == 200
        assert r.json()["visibility"] == "company"
        assert r.json()["status"] == "completed"

    def test_reminder_fields_independent_of_status(self, staff, created):
        d = _mk(staff, created, type="reminder", title="TEST_st_rem", status="in_progress",
                reminder_date="2030-01-15", reminder_time="09:30")
        assert d["status"] == "in_progress"
        r = staff.put(f"{BASE_URL}/api/myspace/{d['id']}", json={"status": "completed"}, timeout=30)
        g = r.json()
        assert g["status"] == "completed"
        assert g["reminder_date"] == "2030-01-15"
        assert g["reminder_time"] == "09:30"
