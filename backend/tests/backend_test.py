"""ATTENDY backend API regression suite."""
import datetime as dt

import pytest

from conftest import BASE_URL


def today_iso():
    return dt.datetime.now(dt.timezone.utc).date().isoformat()


def this_month():
    return today_iso()[:7]


# ---------------- auth module ----------------
class TestAuth:
    def test_login_admin(self, admin):
        r = admin.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        d = r.json()
        assert d["user"]["role"] == "admin"
        assert "password_hash" not in d["user"]
        assert "_id" not in d["user"]

    def test_login_invalid_password(self, anon, credentials):
        r = anon.post(f"{BASE_URL}/api/auth/login",
                      json={"email": credentials["admin"]["email"], "password": "wrong-pass-xyz"})
        assert r.status_code == 401
        assert "detail" in r.json()

    def test_login_unknown_email(self, anon):
        r = anon.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "nobody_TEST@nowhere.test", "password": "x"})
        assert r.status_code == 401

    def test_me_requires_auth(self, anon):
        assert anon.get(f"{BASE_URL}/api/auth/me").status_code == 401

    def test_bad_token_rejected(self, anon):
        r = anon.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": "Bearer garbage.token.value"})
        assert r.status_code == 401

    def test_staff_login_has_employee(self, staff):
        r = staff.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        d = r.json()
        assert d["user"]["role"] == "staff"
        assert d["employee"] is not None
        assert d["employee"]["monthly_salary"] >= 0

    def test_logout(self, staff):
        assert staff.post(f"{BASE_URL}/api/auth/logout").status_code == 200


# ---------------- dashboard module ----------------
class TestDashboard:
    def test_admin_dashboard(self, admin):
        r = admin.get(f"{BASE_URL}/api/dashboard")
        assert r.status_code == 200
        d = r.json()
        for k in ("employees", "present", "late", "on_leave"):
            assert k in d["stats"], f"missing stat {k}"
        assert d["stats"]["employees"] > 0
        assert isinstance(d["attendance_today"], list)
        assert set(d["task_counts"]) >= {"todo", "in_progress", "completed"}
        assert isinstance(d["payroll_total"], (int, float))
        assert isinstance(d["activities"], list)

    def test_leader_dashboard_scoped(self, leader, admin):
        rl = leader.get(f"{BASE_URL}/api/dashboard")
        ra = admin.get(f"{BASE_URL}/api/dashboard")
        assert rl.status_code == 200
        assert rl.json()["stats"]["employees"] <= ra.json()["stats"]["employees"]

    def test_staff_dashboard(self, staff):
        r = staff.get(f"{BASE_URL}/api/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert d["role"] == "staff"
        assert d["employee"] is not None
        assert isinstance(d["leave_available"], (int, float))
        assert set(d["task_counts"]) >= {"todo", "in_progress", "completed"}


# ---------------- employees module ----------------
class TestEmployees:
    created = []

    def test_list_employees_admin(self, admin):
        r = admin.get(f"{BASE_URL}/api/employees")
        assert r.status_code == 200
        emps = r.json()
        assert len(emps) >= 5
        assert all("_id" not in e for e in emps)
        assert all(e.get("employee_code") for e in emps)

    def test_list_employees_leader_scoped(self, leader, admin):
        le = leader.get(f"{BASE_URL}/api/employees").json()
        ae = admin.get(f"{BASE_URL}/api/employees").json()
        assert 0 < len(le) < len(ae)

    def test_create_employee_and_persist(self, admin):
        payload = {
            "name": "TEST QA Person", "email": "test_qa_person@attendy.test",
            "department": "Engineering", "designation": "QA Engineer",
            "monthly_salary": 45000, "role": "staff", "password": "password123",
        }
        r = admin.post(f"{BASE_URL}/api/employees", json=payload)
        assert r.status_code == 200, r.text[:300]
        emp = r.json()
        assert emp["name"] == payload["name"]
        assert emp["email"] == payload["email"]
        assert emp["monthly_salary"] == 45000
        assert emp["status"] == "Active"
        TestEmployees.created.append(emp["id"])
        g = admin.get(f"{BASE_URL}/api/employees/{emp['id']}")
        assert g.status_code == 200
        assert g.json()["designation"] == "QA Engineer"

    def test_created_employee_can_login(self, anon):
        r = anon.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "test_qa_person@attendy.test", "password": "password123"})
        assert r.status_code == 200, r.text[:200]
        assert r.json()["user"]["role"] == "staff"

    def test_duplicate_email_rejected(self, admin):
        r = admin.post(f"{BASE_URL}/api/employees", json={
            "name": "TEST Dup", "email": "test_qa_person@attendy.test", "role": "staff"})
        assert r.status_code == 400

    def test_update_salary(self, admin):
        assert TestEmployees.created, "no created employee"
        eid = TestEmployees.created[0]
        r = admin.put(f"{BASE_URL}/api/employees/{eid}/salary",
                      json={"monthly_salary": 61000, "salary_type": "Monthly"})
        assert r.status_code == 200
        assert r.json()["monthly_salary"] == 61000
        g = admin.get(f"{BASE_URL}/api/employees/{eid}")
        assert g.json()["monthly_salary"] == 61000

    def test_employee_not_found(self, admin):
        r = admin.get(f"{BASE_URL}/api/employees/does-not-exist")
        assert r.status_code == 404

    def test_staff_cannot_create_employee(self, staff):
        r = staff.post(f"{BASE_URL}/api/employees", json={"name": "TEST X", "email": "x_TEST@a.test"})
        assert r.status_code == 403

    def test_staff_cannot_set_salary(self, staff, admin):
        eid = admin.get(f"{BASE_URL}/api/employees").json()[0]["id"]
        r = staff.put(f"{BASE_URL}/api/employees/{eid}/salary", json={"monthly_salary": 999999})
        assert r.status_code == 403


# ---------------- attendance module ----------------
class TestAttendance:
    def test_admin_attendance_list(self, admin):
        r = admin.get(f"{BASE_URL}/api/attendance", params={"date": today_iso()})
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) > 0
        row = rows[0]
        for k in ("employee_id", "name", "employee_code", "status", "department"):
            assert k in row
        assert all(x["status"] in ("Present", "Late", "Absent", "Leave", "Half Day") for x in rows)

    def test_attendance_status_filter(self, admin):
        r = admin.get(f"{BASE_URL}/api/attendance", params={"date": today_iso(), "status": "Absent"})
        assert r.status_code == 200
        assert all(x["status"] == "Absent" for x in r.json())

    def test_attendance_department_filter(self, admin):
        emps = admin.get(f"{BASE_URL}/api/employees").json()
        dept = next(e["department"] for e in emps if e.get("department"))
        r = admin.get(f"{BASE_URL}/api/attendance", params={"date": today_iso(), "department": dept})
        assert r.status_code == 200
        assert all(x["department"] == dept for x in r.json())

    def test_staff_cannot_list_all_attendance(self, staff):
        assert staff.get(f"{BASE_URL}/api/attendance").status_code == 403

    def test_mark_attendance_admin(self, admin):
        eid = admin.get(f"{BASE_URL}/api/employees").json()[0]["id"]
        d = (dt.date.today() - dt.timedelta(days=3)).isoformat()
        r = admin.post(f"{BASE_URL}/api/attendance/mark",
                       params={"employee_id": eid, "date": d, "status": "Half Day"})
        assert r.status_code == 200, r.text[:200]
        assert r.json()["status"] == "Half Day"
        rows = admin.get(f"{BASE_URL}/api/attendance", params={"date": d}).json()
        match = [x for x in rows if x["employee_id"] == eid]
        assert match and match[0]["status"] == "Half Day"
        # restore
        admin.post(f"{BASE_URL}/api/attendance/mark",
                   params={"employee_id": eid, "date": d, "status": "Present"})

    def test_edit_attendance(self, admin):
        rows = admin.get(f"{BASE_URL}/api/attendance", params={"date": today_iso()}).json()
        withatt = [x for x in rows if x["attendance_id"]]
        if not withatt:
            pytest.skip("no attendance record today")
        aid = withatt[0]["attendance_id"]
        orig = withatt[0]["status"]
        r = admin.put(f"{BASE_URL}/api/attendance/{aid}", json={"status": "Late"})
        assert r.status_code == 200
        assert r.json()["status"] == "Late"
        admin.put(f"{BASE_URL}/api/attendance/{aid}", json={"status": orig})

    def test_staff_my_attendance(self, staff):
        r = staff.get(f"{BASE_URL}/api/attendance/me", params={"range": "month"})
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d["history"], list)
        assert len(d["history"]) > 0
        for rng in ("today", "week", "month"):
            rr = staff.get(f"{BASE_URL}/api/attendance/me", params={"range": rng})
            assert rr.status_code == 200

    def test_checkin_checkout_flow(self, staff):
        me = staff.get(f"{BASE_URL}/api/attendance/me", params={"range": "today"}).json()
        tod = me.get("today")
        if not tod:
            r = staff.post(f"{BASE_URL}/api/attendance/checkin")
            assert r.status_code == 200, r.text[:200]
            assert r.json()["check_in"]
            tod = r.json()
        else:
            # duplicate check-in must be rejected
            r = staff.post(f"{BASE_URL}/api/attendance/checkin")
            assert r.status_code == 400
        if not tod.get("check_out"):
            r = staff.post(f"{BASE_URL}/api/attendance/checkout")
            assert r.status_code == 200, r.text[:200]
            d = r.json()
            assert d["check_out"] is not None
            assert d["hours"] >= 0
        # double checkout rejected
        r2 = staff.post(f"{BASE_URL}/api/attendance/checkout")
        assert r2.status_code == 400


# ---------------- tasks module ----------------
class TestTasks:
    created = []

    def test_list_tasks_admin(self, admin):
        r = admin.get(f"{BASE_URL}/api/tasks")
        assert r.status_code == 200
        tasks = r.json()
        assert len(tasks) > 0
        assert all(t["status"] in ("todo", "in_progress", "completed") for t in tasks)

    def test_create_task_with_checklist(self, admin):
        emps = admin.get(f"{BASE_URL}/api/employees").json()
        assignee = emps[0]
        r = admin.post(f"{BASE_URL}/api/tasks", json={
            "title": "TEST Kanban task", "description": "created by QA",
            "assignee_id": assignee["id"], "due_date": today_iso(),
            "priority": "High", "checklist": ["step one", "step two"], "status": "todo"})
        assert r.status_code == 200, r.text[:300]
        t = r.json()
        assert t["title"] == "TEST Kanban task"
        assert t["assignee_name"] == assignee["name"]
        assert len(t["checklist"]) == 2
        assert t["checklist"][0]["done"] is False
        assert t["priority"] == "High"
        TestTasks.created.append(t["id"])
        g = admin.get(f"{BASE_URL}/api/tasks/{t['id']}")
        assert g.status_code == 200
        assert g.json()["title"] == "TEST Kanban task"

    def test_status_change_persists(self, admin):
        tid = TestTasks.created[0]
        r = admin.put(f"{BASE_URL}/api/tasks/{tid}/status", json={"status": "in_progress"})
        assert r.status_code == 200
        assert r.json()["status"] == "in_progress"
        assert admin.get(f"{BASE_URL}/api/tasks/{tid}").json()["status"] == "in_progress"

    def test_checklist_toggle_and_add(self, admin):
        tid = TestTasks.created[0]
        t = admin.get(f"{BASE_URL}/api/tasks/{tid}").json()
        item_id = t["checklist"][0]["id"]
        r = admin.put(f"{BASE_URL}/api/tasks/{tid}/checklist", json={"item_id": item_id, "done": True})
        assert r.status_code == 200
        assert any(c["id"] == item_id and c["done"] for c in r.json()["checklist"])
        r2 = admin.post(f"{BASE_URL}/api/tasks/{tid}/checklist", json={"text": "TEST extra step"})
        assert r2.status_code == 200
        assert len(r2.json()["checklist"]) == 3

    def test_comments(self, admin):
        tid = TestTasks.created[0]
        r = admin.post(f"{BASE_URL}/api/tasks/{tid}/comments", json={"text": "TEST comment body"})
        assert r.status_code == 200
        cs = r.json()["comments"]
        assert cs[-1]["text"] == "TEST comment body"
        assert cs[-1]["author"]

    def test_staff_only_sees_own_tasks(self, staff):
        me = staff.get(f"{BASE_URL}/api/auth/me").json()
        eid = me["employee"]["id"]
        tasks = staff.get(f"{BASE_URL}/api/tasks").json()
        assert all(t["assignee_id"] == eid for t in tasks), "staff sees others' tasks"

    def test_staff_cannot_create_task(self, staff):
        r = staff.post(f"{BASE_URL}/api/tasks", json={"title": "TEST staff task"})
        assert r.status_code == 403

    def test_leader_can_create_task(self, leader):
        emps = leader.get(f"{BASE_URL}/api/employees").json()
        r = leader.post(f"{BASE_URL}/api/tasks", json={
            "title": "TEST leader task", "assignee_id": emps[0]["id"], "priority": "Low"})
        assert r.status_code == 200, r.text[:200]
        TestTasks.created.append(r.json()["id"])

    def test_task_not_found(self, admin):
        assert admin.get(f"{BASE_URL}/api/tasks/nope-nope").status_code == 404

    @classmethod
    def teardown_class(cls):
        pass


@pytest.fixture(scope="module", autouse=True)
def cleanup_tasks(request):
    yield


# ---------------- leave module ----------------
class TestLeave:
    def test_staff_apply_leave(self, staff):
        start = (dt.date.today() + dt.timedelta(days=20)).isoformat()
        end = (dt.date.today() + dt.timedelta(days=21)).isoformat()
        r = staff.post(f"{BASE_URL}/api/leaves", json={
            "leave_type": "Casual Leave", "from_date": start, "to_date": end,
            "reason": "TEST QA leave"})
        assert r.status_code == 200, r.text[:300]
        lv = r.json()
        assert lv["status"] == "Pending"
        assert lv["days"] == 2
        mine = staff.get(f"{BASE_URL}/api/leaves/me").json()
        assert any(x["id"] == lv["id"] for x in mine["leaves"])
        assert mine["balance"] is not None
        TestLeave.leave_id = lv["id"]
        TestLeave.dates = (start, end)

    def test_leave_balance_shape(self, staff):
        b = staff.get(f"{BASE_URL}/api/leaves/me").json()["balance"]
        for k in ("casual", "sick", "used_casual", "used_sick"):
            assert k in b

    def test_staff_cannot_list_all_leaves(self, staff):
        assert staff.get(f"{BASE_URL}/api/leaves").status_code == 403

    def test_admin_lists_leaves(self, admin):
        r = admin.get(f"{BASE_URL}/api/leaves")
        assert r.status_code == 200
        assert len(r.json()) > 0

    def test_approve_leave_side_effects(self, admin, staff):
        lid = getattr(TestLeave, "leave_id", None)
        if not lid:
            pytest.skip("no leave created")
        before = staff.get(f"{BASE_URL}/api/leaves/me").json()["balance"]["used_casual"]
        r = admin.put(f"{BASE_URL}/api/leaves/{lid}/approve")
        assert r.status_code == 200, r.text[:300]
        assert r.json()["status"] == "Approved"
        after = staff.get(f"{BASE_URL}/api/leaves/me").json()["balance"]["used_casual"]
        assert after == before + 2, f"balance not deducted: {before} -> {after}"
        start, end = TestLeave.dates
        rows = admin.get(f"{BASE_URL}/api/attendance", params={"date": start}).json()
        me = staff.get(f"{BASE_URL}/api/auth/me").json()["employee"]["id"]
        mine = [x for x in rows if x["employee_id"] == me]
        assert mine and mine[0]["status"] == "Leave", "attendance not marked Leave"

    def test_reject_flow(self, staff, leader, admin):
        start = (dt.date.today() + dt.timedelta(days=30)).isoformat()
        r = staff.post(f"{BASE_URL}/api/leaves", json={
            "leave_type": "Sick Leave", "from_date": start, "to_date": start, "reason": "TEST reject"})
        lid = r.json()["id"]
        rr = leader.put(f"{BASE_URL}/api/leaves/{lid}/reject")
        assert rr.status_code == 200, rr.text[:200]
        assert rr.json()["status"] == "Rejected"

    def test_approve_missing_leave(self, admin):
        assert admin.put(f"{BASE_URL}/api/leaves/no-such-leave/approve").status_code == 404


# ---------------- payroll module ----------------
class TestPayroll:
    def test_generate_payroll(self, admin):
        m = this_month()
        r = admin.post(f"{BASE_URL}/api/payroll/generate", params={"month": m})
        assert r.status_code == 200, r.text[:300]
        rows = r.json()
        assert len(rows) > 0
        row = rows[0]
        for k in ("salary", "lop", "overtime", "incentive", "deduction", "net", "status", "working_days"):
            assert k in row
        assert row["net"] == round(row["salary"] - row["lop"] + row["overtime"] + row["incentive"] - row["deduction"], 2)
        TestPayroll.pid = row["id"]
        TestPayroll.month = m

    def test_list_payroll(self, admin):
        r = admin.get(f"{BASE_URL}/api/payroll", params={"month": this_month()})
        assert r.status_code == 200
        assert len(r.json()) > 0

    def test_adjust_payroll_recalculates(self, admin):
        pid = getattr(TestPayroll, "pid", None)
        if not pid:
            pytest.skip("no payroll")
        r = admin.put(f"{BASE_URL}/api/payroll/{pid}/adjust", json={"incentive": 1000, "deduction": 200})
        assert r.status_code == 200
        p = r.json()
        assert p["incentive"] == 1000 and p["deduction"] == 200
        assert p["net"] == round(p["salary"] - p["lop"] + p["overtime"] + 1000 - 200, 2)

    def test_status_change_and_staff_visibility(self, admin, staff):
        m = this_month()
        me = staff.get(f"{BASE_URL}/api/auth/me").json()["employee"]["id"]
        rows = admin.get(f"{BASE_URL}/api/payroll", params={"month": m}).json()
        mine = [p for p in rows if p["employee_id"] == me]
        assert mine, "staff has no payroll row"
        pid = mine[0]["id"]
        r = admin.put(f"{BASE_URL}/api/payroll/{pid}/status", json={"status": "Paid"})
        assert r.status_code == 200
        assert r.json()["status"] == "Paid"
        slips = staff.get(f"{BASE_URL}/api/payroll/me").json()
        assert any(p["id"] == pid for p in slips), "paid payslip not visible to staff"
        # draft should hide it
        admin.put(f"{BASE_URL}/api/payroll/{pid}/status", json={"status": "Draft"})
        slips2 = staff.get(f"{BASE_URL}/api/payroll/me").json()
        assert not any(p["id"] == pid for p in slips2), "Draft payslip still visible to staff"
        admin.put(f"{BASE_URL}/api/payroll/{pid}/status", json={"status": "Paid"})

    def test_payslip_detail(self, staff):
        slips = staff.get(f"{BASE_URL}/api/payroll/me").json()
        if not slips:
            pytest.skip("no payslips")
        r = staff.get(f"{BASE_URL}/api/payslip/{slips[0]['id']}")
        assert r.status_code == 200
        d = r.json()
        assert d["payroll"]["id"] == slips[0]["id"]
        assert d["employee"]["name"]
        assert d["company"]["name"]

    def test_staff_cannot_list_payroll(self, staff):
        assert staff.get(f"{BASE_URL}/api/payroll", params={"month": this_month()}).status_code == 403

    def test_staff_cannot_generate_payroll(self, staff):
        assert staff.post(f"{BASE_URL}/api/payroll/generate", params={"month": this_month()}).status_code == 403

    def test_payslip_idor(self, staff, admin):
        """A staff user must not be able to read another employee's payslip."""
        me = staff.get(f"{BASE_URL}/api/auth/me").json()["employee"]["id"]
        rows = admin.get(f"{BASE_URL}/api/payroll", params={"month": this_month()}).json()
        other = [p for p in rows if p["employee_id"] != me]
        if not other:
            pytest.skip("no other payroll rows")
        r = staff.get(f"{BASE_URL}/api/payslip/{other[0]['id']}")
        assert r.status_code in (403, 404), f"IDOR: staff read another payslip ({r.status_code})"

    def test_payslip_not_found(self, admin):
        assert admin.get(f"{BASE_URL}/api/payslip/nope").status_code == 404


# ---------------- notifications module ----------------
class TestNotifications:
    def test_list_and_read_all(self, admin):
        r = admin.get(f"{BASE_URL}/api/notifications")
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        if rows:
            nid = rows[0]["id"]
            assert admin.put(f"{BASE_URL}/api/notifications/{nid}/read").status_code == 200
        r2 = admin.put(f"{BASE_URL}/api/notifications/read-all")
        assert r2.status_code == 200, r2.text[:200]
        after = admin.get(f"{BASE_URL}/api/notifications").json()
        assert all(n["read"] for n in after), "read-all did not mark all read"

    def test_notifications_require_auth(self, anon):
        assert anon.get(f"{BASE_URL}/api/notifications").status_code == 401


# ---------------- settings / masters ----------------
class TestSettings:
    def test_company_get(self, admin):
        r = admin.get(f"{BASE_URL}/api/company")
        assert r.status_code == 200
        assert r.json()["name"]

    def test_masters_lists(self, admin):
        for ep in ("departments", "designations", "shifts"):
            r = admin.get(f"{BASE_URL}/api/{ep}")
            assert r.status_code == 200, ep
            assert isinstance(r.json(), list)

    def test_add_delete_department(self, admin):
        r = admin.post(f"{BASE_URL}/api/departments", json={"name": "TEST Dept QA"})
        assert r.status_code == 200
        did = r.json()["id"]
        assert any(d["id"] == did for d in admin.get(f"{BASE_URL}/api/departments").json())
        assert admin.delete(f"{BASE_URL}/api/departments/{did}").status_code == 200
        assert not any(d["id"] == did for d in admin.get(f"{BASE_URL}/api/departments").json())

    def test_staff_cannot_update_company(self, staff):
        assert staff.put(f"{BASE_URL}/api/company", json={"name": "hacked"}).status_code == 403

    def test_staff_cannot_add_department(self, staff):
        assert staff.post(f"{BASE_URL}/api/departments", json={"name": "TEST hack"}).status_code == 403

    def test_leader_cannot_add_department(self, leader):
        assert leader.post(f"{BASE_URL}/api/departments", json={"name": "TEST hack2"}).status_code == 403


# ---------------- cleanup ----------------
class TestZZCleanup:
    def test_cleanup(self, admin):
        for tid in TestTasks.created:
            admin.delete(f"{BASE_URL}/api/tasks/{tid}")
        remaining = [t for t in admin.get(f"{BASE_URL}/api/tasks").json()
                     if t["title"].startswith("TEST ")]
        assert not remaining, f"leftover test tasks: {len(remaining)}"
