"""ATTENDY multi-tenant: isolation, tenant-aware login, onboarding, platform super-admin."""
import time
import uuid

import pytest
import requests

from conftest import BASE_URL

R39 = {"email": "support@route39.in", "password": "admin123", "slug": "route39"}
DEMO = {"email": "demo@attendy.app", "password": "demo123", "slug": "demo"}
SUPER = {"email": "platform@attendy.in", "password": "super123"}


def login(email, password, tenant_slug=None, raw=False):
    body = {"email": email, "password": password}
    if tenant_slug:
        body["tenant_slug"] = tenant_slug
    r = requests.post(f"{BASE_URL}/api/auth/login", json=body, timeout=30)
    if raw:
        return r
    if r.status_code != 200:
        pytest.fail(f"login failed {email}: {r.status_code} {r.text[:300]}")
    return r.json()


def client(email, password):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json",
                      "Authorization": f"Bearer {login(email, password)['token']}"})
    return s


@pytest.fixture(scope="module")
def r39():
    return client(R39["email"], R39["password"])


@pytest.fixture(scope="module")
def demo():
    return client(DEMO["email"], DEMO["password"])


@pytest.fixture(scope="module")
def sup():
    return client(SUPER["email"], SUPER["password"])


@pytest.fixture(scope="module")
def r39_ids(r39):
    """Collect Route39 resource ids to attack with Demo's token."""
    ids = {}
    emps = r39.get(f"{BASE_URL}/api/employees", timeout=30)
    assert emps.status_code == 200
    ids["employees"] = emps.json()
    ids["employee_id"] = emps.json()[0]["id"]

    tasks = r39.get(f"{BASE_URL}/api/tasks", timeout=30)
    assert tasks.status_code == 200
    ids["task"] = tasks.json()[0]

    att = r39.get(f"{BASE_URL}/api/attendance", timeout=30)
    assert att.status_code == 200
    row = next((a for a in att.json() if a.get("attendance_id")), None)
    ids["attendance"] = ({"id": row["attendance_id"], "date": time.strftime("%Y-%m-%d"),
                          "status": row["status"], "employee_id": row["employee_id"]} if row else None)

    leaves = r39.get(f"{BASE_URL}/api/leaves", timeout=30)
    assert leaves.status_code == 200
    ids["leave"] = next((x for x in leaves.json() if x["status"] == "Pending"), None) or (leaves.json()[0] if leaves.json() else None)

    month = time.strftime("%Y-%m")
    pay = r39.get(f"{BASE_URL}/api/payroll", params={"month": month}, timeout=30)
    assert pay.status_code == 200, pay.text[:300]
    rows = pay.json()
    if not rows:
        gen = r39.post(f"{BASE_URL}/api/payroll/generate", params={"month": month}, timeout=60)
        assert gen.status_code == 200, gen.text[:300]
        rows = r39.get(f"{BASE_URL}/api/payroll", params={"month": month}, timeout=30).json()
    ids["payroll"] = rows[0] if rows else None
    return ids


# ---------------- cross-tenant READ isolation ----------------
class TestCrossTenantRead:
    def test_employees_list_scoped(self, demo, r39_ids):
        r = demo.get(f"{BASE_URL}/api/employees", timeout=30)
        assert r.status_code == 200
        demo_ids = {e["id"] for e in r.json()}
        r39_set = {e["id"] for e in r39_ids["employees"]}
        assert not (demo_ids & r39_set), "Demo admin sees Route39 employees!"
        assert len(demo_ids) < len(r39_set)

    def test_get_employee_cross_tenant_404(self, demo, r39_ids):
        r = demo.get(f"{BASE_URL}/api/employees/{r39_ids['employee_id']}", timeout=30)
        assert r.status_code == 404, r.text[:300]

    def test_get_task_cross_tenant_404(self, demo, r39_ids):
        r = demo.get(f"{BASE_URL}/api/tasks/{r39_ids['task']['id']}", timeout=30)
        assert r.status_code == 404, r.text[:300]

    def test_tasks_list_scoped(self, demo, r39_ids):
        r = demo.get(f"{BASE_URL}/api/tasks", timeout=30)
        assert r.status_code == 200
        assert r39_ids["task"]["id"] not in {t["id"] for t in r.json()}

    def test_attendance_list_scoped(self, demo, r39_ids):
        r = demo.get(f"{BASE_URL}/api/attendance", timeout=30)
        assert r.status_code == 200
        demo_emp_ids = {a["employee_id"] for a in r.json()}
        r39_emp_ids = {e["id"] for e in r39_ids["employees"]}
        assert not (demo_emp_ids & r39_emp_ids), "Demo attendance list contains Route39 employees"

    def test_payslip_cross_tenant_403(self, demo, r39_ids):
        if not r39_ids["payroll"]:
            pytest.skip("no route39 payroll row")
        r = demo.get(f"{BASE_URL}/api/payslip/{r39_ids['payroll']['id']}", timeout=30)
        assert r.status_code == 403, r.text[:300]

    def test_dashboard_scoped(self, demo, r39):
        d = demo.get(f"{BASE_URL}/api/dashboard", timeout=30)
        a = r39.get(f"{BASE_URL}/api/dashboard", timeout=30)
        assert d.status_code == 200 and a.status_code == 200
        assert d.json() != a.json()


# ---------------- cross-tenant WRITE isolation ----------------
class TestCrossTenantWrite:
    def test_task_status_cross_tenant_noop(self, demo, r39, r39_ids):
        tid = r39_ids["task"]["id"]
        before = r39.get(f"{BASE_URL}/api/tasks/{tid}", timeout=30).json()
        target = "Done" if before["status"] != "Done" else "To Do"
        r = demo.put(f"{BASE_URL}/api/tasks/{tid}/status", json={"status": target}, timeout=30)
        after = r39.get(f"{BASE_URL}/api/tasks/{tid}", timeout=30).json()
        assert after["status"] == before["status"], f"cross-tenant status change! resp={r.status_code}"

    def test_task_status_cross_tenant_no_data_leak(self, demo, r39_ids):
        """Write is a no-op, but the response must not return the other tenant's document."""
        tid = r39_ids["task"]["id"]
        r = demo.put(f"{BASE_URL}/api/tasks/{tid}/status", json={"status": "Done"}, timeout=30)
        assert r.status_code in (403, 404), (
            f"LEAK: PUT /tasks/{{id}}/status returned {r.status_code} with foreign task body: {r.text[:200]}")

    def test_task_update_cross_tenant_no_data_leak(self, demo, r39_ids):
        tid = r39_ids["task"]["id"]
        r = demo.put(f"{BASE_URL}/api/tasks/{tid}", json={"priority": "Low"}, timeout=30)
        assert r.status_code in (403, 404), (
            f"LEAK: PUT /tasks/{{id}} returned {r.status_code} with foreign task body: {r.text[:200]}")

    def test_task_comment_cross_tenant_no_data_leak(self, demo, r39, r39_ids):
        tid = r39_ids["task"]["id"]
        before = r39.get(f"{BASE_URL}/api/tasks/{tid}", timeout=30).json()
        r = demo.post(f"{BASE_URL}/api/tasks/{tid}/comments", json={"text": "TEST_leak_probe"}, timeout=30)
        after = r39.get(f"{BASE_URL}/api/tasks/{tid}", timeout=30).json()
        assert len(after.get("comments") or []) == len(before.get("comments") or []), "cross-tenant comment added!"
        assert r.status_code in (403, 404), (
            f"LEAK: POST /tasks/{{id}}/comments returned {r.status_code} with foreign task body: {r.text[:200]}")

    def test_task_checklist_add_cross_tenant_no_data_leak(self, demo, r39, r39_ids):
        tid = r39_ids["task"]["id"]
        before = r39.get(f"{BASE_URL}/api/tasks/{tid}", timeout=30).json()
        r = demo.post(f"{BASE_URL}/api/tasks/{tid}/checklist", json={"text": "TEST_leak_probe"}, timeout=30)
        after = r39.get(f"{BASE_URL}/api/tasks/{tid}", timeout=30).json()
        assert len(after.get("checklist") or []) == len(before.get("checklist") or []), "cross-tenant checklist item added!"
        assert r.status_code in (403, 404), (
            f"LEAK: POST /tasks/{{id}}/checklist returned {r.status_code} with foreign task body: {r.text[:200]}")

    def test_task_checklist_cross_tenant_noop(self, demo, r39, r39_ids):
        tid = r39_ids["task"]["id"]
        before = r39.get(f"{BASE_URL}/api/tasks/{tid}", timeout=30).json()
        items = before.get("checklist") or []
        if not items:
            pytest.skip("no checklist items on route39 task")
        item = items[0]
        r = demo.put(f"{BASE_URL}/api/tasks/{tid}/checklist",
                     json={"item_id": item["id"], "done": not item.get("done")}, timeout=30)
        after = r39.get(f"{BASE_URL}/api/tasks/{tid}", timeout=30).json()
        after_item = next(i for i in after["checklist"] if i["id"] == item["id"])
        assert after_item.get("done") == item.get("done"), "cross-tenant checklist mutated!"
        assert r.status_code in (403, 404), f"expected 404/403 (no-op leaks doc), got {r.status_code}"

    def test_task_update_cross_tenant_noop(self, demo, r39, r39_ids):
        tid = r39_ids["task"]["id"]
        demo.put(f"{BASE_URL}/api/tasks/{tid}", json={"title": "TEST_HACKED"}, timeout=30)
        after = r39.get(f"{BASE_URL}/api/tasks/{tid}", timeout=30).json()
        assert after["title"] != "TEST_HACKED", "cross-tenant task title changed!"

    def test_task_delete_cross_tenant_noop(self, demo, r39, r39_ids):
        tid = r39_ids["task"]["id"]
        demo.delete(f"{BASE_URL}/api/tasks/{tid}", timeout=30)
        assert r39.get(f"{BASE_URL}/api/tasks/{tid}", timeout=30).status_code == 200, "cross-tenant task deleted!"

    def test_attendance_edit_cross_tenant_noop(self, demo, r39, r39_ids):
        att = r39_ids["attendance"]
        if not att:
            pytest.skip("no route39 attendance")
        r = demo.put(f"{BASE_URL}/api/attendance/{att['id']}", json={"status": "Absent"}, timeout=30)
        rows = r39.get(f"{BASE_URL}/api/attendance", params={"date": att["date"]}, timeout=30).json()
        row = next((x for x in rows if x.get("attendance_id") == att["id"]), None)
        assert row and row["status"] == att["status"], "cross-tenant attendance mutated!"
        assert r.status_code in (403, 404), f"expected 404/403, got {r.status_code} {r.text[:150]}"

    def test_attendance_mark_cross_tenant_404(self, demo, r39_ids):
        r = demo.post(f"{BASE_URL}/api/attendance/mark",
                      params={"employee_id": r39_ids["employee_id"], "date": "2026-07-01", "status": "Absent"},
                      timeout=30)
        assert r.status_code == 404, r.text[:300]

    def test_employee_update_cross_tenant_no_data_leak(self, demo, r39, r39_ids):
        eid = r39_ids["employee_id"]
        before = r39.get(f"{BASE_URL}/api/employees/{eid}", timeout=30).json()
        r = demo.put(f"{BASE_URL}/api/employees/{eid}",
                     json={"name": "TEST_HACKED", "email": before["email"]}, timeout=30)
        after = r39.get(f"{BASE_URL}/api/employees/{eid}", timeout=30).json()
        assert after["name"] == before["name"], "cross-tenant employee renamed!"
        assert r.status_code in (403, 404), f"expected 404/403, got {r.status_code}"

    def test_employee_salary_cross_tenant_no_data_leak(self, demo, r39, r39_ids):
        eid = r39_ids["employee_id"]
        before = r39.get(f"{BASE_URL}/api/employees/{eid}", timeout=30).json()
        r = demo.put(f"{BASE_URL}/api/employees/{eid}/salary",
                     json={"monthly_salary": 1.0, "salary_type": "Monthly"}, timeout=30)
        after = r39.get(f"{BASE_URL}/api/employees/{eid}", timeout=30).json()
        assert after["monthly_salary"] == before["monthly_salary"], "cross-tenant salary changed!"
        assert r.status_code in (403, 404), f"expected 404/403, got {r.status_code}"

    def test_leave_approve_reject_cross_tenant_404(self, demo, r39_ids):
        lv = r39_ids["leave"]
        if not lv:
            pytest.skip("no route39 leave")
        a = demo.put(f"{BASE_URL}/api/leaves/{lv['id']}/approve", timeout=30)
        b = demo.put(f"{BASE_URL}/api/leaves/{lv['id']}/reject", timeout=30)
        assert a.status_code == 404, a.text[:200]
        assert b.status_code == 404, b.text[:200]

    def test_payroll_status_adjust_cross_tenant_404(self, demo, r39_ids):
        p = r39_ids["payroll"]
        if not p:
            pytest.skip("no route39 payroll")
        a = demo.put(f"{BASE_URL}/api/payroll/{p['id']}/status", json={"status": "Paid"}, timeout=30)
        b = demo.put(f"{BASE_URL}/api/payroll/{p['id']}/adjust", json={"incentive": 99999}, timeout=30)
        assert a.status_code == 404, a.text[:200]
        assert b.status_code == 404, b.text[:200]

    def test_task_create_with_foreign_assignee_blocked(self, demo, r39_ids):
        r = demo.post(f"{BASE_URL}/api/tasks", json={
            "title": "TEST_cross_assignee", "description": "",
            "assignee_id": r39_ids["employee_id"], "priority": "Low",
        }, timeout=30)
        if r.status_code == 200:
            tid = r.json()["id"]
            demo.delete(f"{BASE_URL}/api/tasks/{tid}", timeout=30)
            assert r.json().get("assignee_name") in (None, "", "Unassigned"), \
                "task created in Demo org resolved a Route39 assignee name"
        else:
            assert r.status_code in (400, 404)


# ---------------- tenant-aware login ----------------
class TestTenantLogin:
    def test_login_wrong_tenant_slug_403(self):
        r = login(R39["email"], R39["password"], tenant_slug="demo", raw=True)
        assert r.status_code == 403, r.text[:300]
        assert "different workspace" in r.json()["detail"].lower()

    def test_login_matching_slug_200(self):
        r = login(R39["email"], R39["password"], tenant_slug="route39", raw=True)
        assert r.status_code == 200
        assert r.json()["user"]["email"] == R39["email"]

    def test_login_no_slug_backward_compatible(self):
        r = login(DEMO["email"], DEMO["password"], raw=True)
        assert r.status_code == 200
        assert "token" in r.json()

    def test_login_unknown_slug_403(self):
        r = login(DEMO["email"], DEMO["password"], tenant_slug="no-such-workspace", raw=True)
        assert r.status_code == 403


# ---------------- tenant resolve + slug availability ----------------
class TestOnboardingChecks:
    def test_resolve_tenant(self):
        r = requests.get(f"{BASE_URL}/api/tenant/route39", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["slug"] == "route39" and d["active"] is True
        assert "_id" not in d

    def test_resolve_unknown_tenant_404(self):
        assert requests.get(f"{BASE_URL}/api/tenant/nope-nope-nope", timeout=30).status_code == 404

    @pytest.mark.parametrize("slug", ["route39", "demo", "api", "admin", "attendy"])
    def test_slug_unavailable(self, slug):
        r = requests.get(f"{BASE_URL}/api/onboarding/slug-available/{slug}", timeout=30)
        assert r.status_code == 200
        assert r.json()["available"] is False, f"{slug} reported available"

    def test_slug_available_fresh(self):
        s = f"test-qa-{uuid.uuid4().hex[:8]}"
        r = requests.get(f"{BASE_URL}/api/onboarding/slug-available/{s}", timeout=30)
        assert r.status_code == 200 and r.json()["available"] is True

    def test_slug_invalid_short(self):
        r = requests.get(f"{BASE_URL}/api/onboarding/slug-available/ab", timeout=30)
        assert r.json()["available"] is False


# ---------------- signup ----------------
class TestSignup:
    created = []

    def test_signup_creates_isolated_org(self):
        slug = f"test-qa-{uuid.uuid4().hex[:8]}"
        email = f"qa_{uuid.uuid4().hex[:8]}@testqa.local"
        r = requests.post(f"{BASE_URL}/api/onboarding/signup", json={
            "company_name": "TEST_QA Company", "slug": slug,
            "admin_name": "TEST QA Admin", "admin_email": email, "password": "qapass123",
        }, timeout=60)
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        assert d["token"] and d["user"]["role"] == "admin"
        assert d["user"]["email"] == email
        assert "password_hash" not in d["user"]
        assert d["company"]["slug"] == slug
        TestSignup.created.append((slug, email, d["token"]))

        s = requests.Session()
        s.headers.update({"Authorization": f"Bearer {d['token']}", "Content-Type": "application/json"})
        emps = s.get(f"{BASE_URL}/api/employees", timeout=30)
        assert emps.status_code == 200
        assert len(emps.json()) == 1, f"new org should have exactly 1 employee, got {len(emps.json())}"
        assert emps.json()[0]["name"] == "TEST QA Admin"
        assert s.get(f"{BASE_URL}/api/tasks", timeout=30).json() == []
        comp = s.get(f"{BASE_URL}/api/company", timeout=30).json()
        assert comp["slug"] == slug and comp["active"] is True
        # new admin can log in with tenant slug
        assert login(email, "qapass123", tenant_slug=slug, raw=True).status_code == 200

    def test_signup_duplicate_slug_rejected(self):
        r = requests.post(f"{BASE_URL}/api/onboarding/signup", json={
            "company_name": "TEST_QA Dup", "slug": "route39",
            "admin_name": "Dup", "admin_email": f"dup_{uuid.uuid4().hex[:6]}@testqa.local",
            "password": "qapass123"}, timeout=30)
        assert r.status_code == 400, r.text[:300]
        assert "slug" in r.json()["detail"].lower() or "taken" in r.json()["detail"].lower()

    def test_signup_reserved_slug_rejected(self):
        r = requests.post(f"{BASE_URL}/api/onboarding/signup", json={
            "company_name": "TEST_QA Res", "slug": "admin",
            "admin_name": "Res", "admin_email": f"res_{uuid.uuid4().hex[:6]}@testqa.local",
            "password": "qapass123"}, timeout=30)
        assert r.status_code == 400
        assert "reserved" in r.json()["detail"].lower()

    def test_signup_duplicate_email_rejected(self):
        r = requests.post(f"{BASE_URL}/api/onboarding/signup", json={
            "company_name": "TEST_QA Email", "slug": f"test-qa-{uuid.uuid4().hex[:8]}",
            "admin_name": "X", "admin_email": DEMO["email"], "password": "qapass123"}, timeout=30)
        assert r.status_code == 400
        assert "email" in r.json()["detail"].lower()

    def test_signup_invalid_slug_rejected(self):
        r = requests.post(f"{BASE_URL}/api/onboarding/signup", json={
            "company_name": "TEST_QA Bad", "slug": "Bad Slug!",
            "admin_name": "X", "admin_email": f"bad_{uuid.uuid4().hex[:6]}@testqa.local",
            "password": "qapass123"}, timeout=30)
        assert r.status_code == 400


# ---------------- platform super admin ----------------
class TestPlatform:
    def test_super_admin_lists_companies(self, sup):
        r = sup.get(f"{BASE_URL}/api/platform/companies", timeout=30)
        assert r.status_code == 200
        rows = r.json()
        slugs = {c["slug"] for c in rows}
        assert {"route39", "demo"} <= slugs
        for c in rows:
            assert "employee_count" in c and "user_count" in c
            assert "_id" not in c
        r39c = next(c for c in rows if c["slug"] == "route39")
        assert r39c["employee_count"] > 0

    def test_company_admin_forbidden(self, r39):
        assert r39.get(f"{BASE_URL}/api/platform/companies", timeout=30).status_code == 403

    def test_platform_requires_auth(self):
        assert requests.get(f"{BASE_URL}/api/platform/companies", timeout=30).status_code == 401

    def test_toggle_status_blocks_login_then_restore(self, sup):
        rows = sup.get(f"{BASE_URL}/api/platform/companies", timeout=30).json()
        demo_org = next(c for c in rows if c["slug"] == "demo")
        try:
            r = sup.put(f"{BASE_URL}/api/platform/companies/{demo_org['id']}/status",
                        json={"active": False}, timeout=30)
            assert r.status_code == 200 and r.json()["active"] is False
            bad = login(DEMO["email"], DEMO["password"], raw=True)
            assert bad.status_code == 403, f"inactive workspace login not blocked: {bad.status_code}"
            assert "inactive" in bad.json()["detail"].lower()
            assert requests.get(f"{BASE_URL}/api/tenant/demo", timeout=30).json()["active"] is False
        finally:
            back = sup.put(f"{BASE_URL}/api/platform/companies/{demo_org['id']}/status",
                           json={"active": True}, timeout=30)
            assert back.status_code == 200 and back.json()["active"] is True
        assert login(DEMO["email"], DEMO["password"], raw=True).status_code == 200

    def test_super_admin_cannot_be_toggled_off_by_admin(self, r39, sup):
        rows = sup.get(f"{BASE_URL}/api/platform/companies", timeout=30).json()
        oid = rows[0]["id"]
        r = r39.put(f"{BASE_URL}/api/platform/companies/{oid}/status", json={"active": False}, timeout=30)
        assert r.status_code == 403
        assert requests.get(f"{BASE_URL}/api/tenant/{rows[0]['slug']}", timeout=30).json()["active"] is True
