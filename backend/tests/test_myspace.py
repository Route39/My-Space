"""My Space module tests: CRUD, pin, search, filters, visibility, uploads, reminders, tenant isolation."""
import base64
import io
import time

import pytest
import requests

from conftest import BASE_URL, CRED_PAIRS

CREATED = []  # (session, item_id)


def _login(email, password):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"login failed {email}: {r.status_code} {r.text[:200]}")
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s


@pytest.fixture(scope="module")
def demo_admin():
    # Demo Company admin (other org) - 4th credential pair
    if len(CRED_PAIRS) < 4:
        pytest.skip("demo admin credentials missing")
    return _login(CRED_PAIRS[3][0], CRED_PAIRS[3][1])


def mk(session, **kw):
    body = {"type": "note", "title": "TEST_item", "content": "", "visibility": "private"}
    body.update(kw)
    r = session.post(f"{BASE_URL}/api/myspace", json=body, timeout=30)
    assert r.status_code == 200, r.text[:300]
    d = r.json()
    CREATED.append((session, d["id"]))
    return d


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    for s, iid in CREATED:
        try:
            s.delete(f"{BASE_URL}/api/myspace/{iid}", timeout=30)
        except Exception:
            pass


# ---------- CRUD ----------
class TestMySpaceCrud:
    def test_list_empty_ok(self, staff):
        r = staff.get(f"{BASE_URL}/api/myspace", timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        for it in r.json():
            assert "_id" not in it

    def test_create_note_and_get(self, staff):
        d = mk(staff, type="note", title="TEST_Customer callback",
               content="<p>Call the <b>customer</b> tomorrow</p>")
        assert d["type"] == "note"
        assert d["visibility"] == "private"
        assert d["owner_id"]
        assert d["pinned"] is False
        g = staff.get(f"{BASE_URL}/api/myspace/{d['id']}", timeout=30)
        assert g.status_code == 200
        assert g.json()["title"] == "TEST_Customer callback"
        assert "customer" in g.json()["content"]

    def test_update_persists(self, staff):
        d = mk(staff, title="TEST_orig")
        r = staff.put(f"{BASE_URL}/api/myspace/{d['id']}", json={"title": "TEST_updated", "visibility": "company"}, timeout=30)
        assert r.status_code == 200
        assert r.json()["title"] == "TEST_updated"
        g = staff.get(f"{BASE_URL}/api/myspace/{d['id']}", timeout=30).json()
        assert g["title"] == "TEST_updated"
        assert g["visibility"] == "company"

    def test_checklist_and_table_payloads(self, staff):
        cl = [{"id": "a", "text": "TEST one", "done": True}, {"id": "b", "text": "TEST two", "done": False}]
        d = mk(staff, type="checklist", title="TEST_checklist", checklist=cl)
        assert len(d["checklist"]) == 2
        g = staff.get(f"{BASE_URL}/api/myspace/{d['id']}", timeout=30).json()
        assert g["checklist"][0]["done"] is True

        td = {"columns": [{"key": "c1", "name": "Name", "type": "text"},
                          {"key": "c2", "name": "Amount", "type": "number"}],
              "rows": [{"_id": "r1", "c1": "A", "c2": "100"}, {"_id": "r2", "c1": "B", "c2": "250"}]}
        t = mk(staff, type="table", title="TEST_table", table_data=td)
        g2 = staff.get(f"{BASE_URL}/api/myspace/{t['id']}", timeout=30).json()
        assert len(g2["table_data"]["rows"]) == 2
        assert g2["table_data"]["columns"][1]["type"] == "number"

    def test_pin_toggle(self, staff):
        d = mk(staff, title="TEST_pin")
        r = staff.put(f"{BASE_URL}/api/myspace/{d['id']}/pin", timeout=30)
        assert r.status_code == 200 and r.json()["pinned"] is True
        pinned = staff.get(f"{BASE_URL}/api/myspace", params={"filter": "pinned"}, timeout=30).json()
        assert d["id"] in [i["id"] for i in pinned]
        r2 = staff.put(f"{BASE_URL}/api/myspace/{d['id']}/pin", timeout=30)
        assert r2.json()["pinned"] is False

    def test_filters_and_search(self, staff):
        note = mk(staff, type="note", title="TEST_searchable widget")
        mk(staff, type="reminder", title="TEST_rem_filter", reminder_date="2030-01-01", reminder_time="09:00")
        notes = staff.get(f"{BASE_URL}/api/myspace", params={"filter": "note"}, timeout=30).json()
        assert all(i["type"] == "note" for i in notes)
        assert note["id"] in [i["id"] for i in notes]
        rems = staff.get(f"{BASE_URL}/api/myspace", params={"filter": "reminder"}, timeout=30).json()
        assert all(i["type"] == "reminder" for i in rems)
        found = staff.get(f"{BASE_URL}/api/myspace", params={"q": "searchable"}, timeout=30).json()
        assert note["id"] in [i["id"] for i in found]

    def test_delete_and_verify(self, staff):
        d = mk(staff, title="TEST_delete_me")
        r = staff.delete(f"{BASE_URL}/api/myspace/{d['id']}", timeout=30)
        assert r.status_code == 200
        assert staff.get(f"{BASE_URL}/api/myspace/{d['id']}", timeout=30).status_code == 404


# ---------- Visibility / permissions ----------
class TestVisibility:
    def test_private_item_hidden_from_admin(self, staff, admin):
        d = mk(staff, title="TEST_private_secret", visibility="private")
        lst = admin.get(f"{BASE_URL}/api/myspace", timeout=30).json()
        assert d["id"] not in [i["id"] for i in lst], "private item leaked to admin list"
        assert admin.get(f"{BASE_URL}/api/myspace/{d['id']}", timeout=30).status_code == 404

    def test_company_item_visible_to_admin(self, staff, admin):
        d = mk(staff, title="TEST_company_announce", visibility="company")
        lst = admin.get(f"{BASE_URL}/api/myspace", timeout=30).json()
        assert d["id"] in [i["id"] for i in lst]
        assert admin.get(f"{BASE_URL}/api/myspace/{d['id']}", timeout=30).status_code == 200

    def test_team_item_visible_to_admin_and_leader(self, staff, admin, leader):
        d = mk(staff, title="TEST_team_note", visibility="team")
        assert admin.get(f"{BASE_URL}/api/myspace/{d['id']}", timeout=30).status_code == 200
        # leader may or may not be staff's leader; only assert no server error
        assert leader.get(f"{BASE_URL}/api/myspace/{d['id']}", timeout=30).status_code in (200, 404)

    def test_non_owner_cannot_edit_or_delete(self, staff, admin):
        d = mk(staff, title="TEST_company_locked", visibility="company")
        assert admin.put(f"{BASE_URL}/api/myspace/{d['id']}", json={"title": "hacked"}, timeout=30).status_code == 403
        assert admin.delete(f"{BASE_URL}/api/myspace/{d['id']}", timeout=30).status_code == 403
        assert admin.put(f"{BASE_URL}/api/myspace/{d['id']}/pin", timeout=30).status_code == 404
        assert staff.get(f"{BASE_URL}/api/myspace/{d['id']}", timeout=30).json()["title"] == "TEST_company_locked"

    def test_requires_auth(self, anon):
        r = anon.get(f"{BASE_URL}/api/myspace", timeout=30)
        assert r.status_code in (401, 403)


# ---------- Tenant isolation ----------
class TestTenantIsolation:
    def test_cross_org_read_write_404(self, staff, demo_admin):
        d = mk(staff, title="TEST_org_isolated", visibility="company")
        assert demo_admin.get(f"{BASE_URL}/api/myspace/{d['id']}", timeout=30).status_code == 404
        assert demo_admin.put(f"{BASE_URL}/api/myspace/{d['id']}", json={"title": "x"}, timeout=30).status_code == 404
        assert demo_admin.delete(f"{BASE_URL}/api/myspace/{d['id']}", timeout=30).status_code == 404
        assert d["id"] not in [i["id"] for i in demo_admin.get(f"{BASE_URL}/api/myspace", timeout=30).json()]
        # still intact
        assert staff.get(f"{BASE_URL}/api/myspace/{d['id']}", timeout=30).status_code == 200


# ---------- Uploads ----------
class TestUploads:
    PNG = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=="
    )

    def _upload(self, session, name, content, ctype):
        s = requests.Session()
        s.headers.update({"Authorization": session.headers["Authorization"]})
        return s.post(f"{BASE_URL}/api/myspace/upload",
                      files={"file": (name, io.BytesIO(content), ctype)}, timeout=60)

    def test_image_upload_and_fetch(self, staff):
        r = self._upload(staff, "TEST_pixel.png", self.PNG, "image/png")
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d["type"] == "image/png"
        assert d["data_url"].startswith("data:image/png;base64,")
        assert d["size"] == len(self.PNG)
        item = mk(staff, type="file", title="TEST_file_item",
                  attachments=[{"file_id": d["file_id"], "name": d["name"], "type": d["type"], "size": d["size"]}])
        assert len(item["attachments"]) == 1
        g = staff.get(f"{BASE_URL}/api/myspace/file/{d['file_id']}", timeout=60)
        assert g.status_code == 200
        assert g.json()["data_url"] == d["data_url"]

    def test_file_cross_user_denied(self, staff, admin):
        r = self._upload(staff, "TEST_priv.png", self.PNG, "image/png")
        fid = r.json()["file_id"]
        mk(staff, type="file", title="TEST_priv_file", visibility="private",
           attachments=[{"file_id": fid, "name": "TEST_priv.png", "type": "image/png", "size": len(self.PNG)}])
        assert admin.get(f"{BASE_URL}/api/myspace/file/{fid}", timeout=30).status_code == 403

    def test_oversize_rejected(self, staff):
        big = b"0" * (5 * 1024 * 1024 + 1024)
        r = self._upload(staff, "TEST_big.bin", big, "application/octet-stream")
        assert r.status_code == 400, f"expected 400, got {r.status_code}"
        assert "5MB" in r.text or "large" in r.text.lower()


# ---------- Reminder -> notification ----------
class TestReminderNotification:
    def test_past_reminder_creates_notification(self, staff):
        title = f"TEST_due_{int(time.time())}"
        mk(staff, type="reminder", title=title, reminder_date="2020-01-01", reminder_time="09:00", repeat="none")
        time.sleep(1)
        r = staff.get(f"{BASE_URL}/api/notifications", timeout=30)
        assert r.status_code == 200
        msgs = [n.get("message", "") for n in r.json()]
        assert any(title in m for m in msgs), f"reminder notification missing. got: {msgs[:5]}"

    def test_future_reminder_no_notification(self, staff):
        title = f"TEST_future_{int(time.time())}"
        mk(staff, type="reminder", title=title, reminder_date="2035-06-01", reminder_time="09:00")
        staff.get(f"{BASE_URL}/api/notifications", timeout=30)
        msgs = [n.get("message", "") for n in staff.get(f"{BASE_URL}/api/notifications", timeout=30).json()]
        assert not any(title in m for m in msgs)


# ---------- Regression: existing modules ----------
class TestExistingModulesRegression:
    @pytest.mark.parametrize("path", [
        "/api/dashboard", "/api/employees", "/api/attendance/me", "/api/attendance",
        "/api/tasks", "/api/leaves", "/api/notifications", "/api/company",
        "/api/departments", "/api/designations", "/api/shifts",
    ])
    def test_admin_endpoints_ok(self, admin, path):
        r = admin.get(f"{BASE_URL}{path}", timeout=30)
        assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:200]}"
