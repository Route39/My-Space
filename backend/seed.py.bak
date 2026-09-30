import uuid
import bcrypt
from datetime import datetime, timezone, timedelta, date
import random

IST = timezone(timedelta(hours=5, minutes=30))

AV_F = "https://images.unsplash.com/photo-1630939687530-241d630735df?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MjJ8MHwxfHNlYXJjaHw0fHxwcm9mZXNzaW9uYWwlMjBlbXBsb3llZSUyMHBvcnRyYWl0JTIwc21pbGluZ3xlbnwwfHx8fDE3ODc2MzcwNjN8MA&ixlib=rb-4.1.0&q=85&w=200&h=200&fit=crop"
AV_M = "https://images.unsplash.com/photo-1675869940341-d495d49010b5?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MjJ8MHwxfHNlYXJjaHwyfHxwcm9mZXNzaW9uYWwlMjBlbXBsb3llZSUyMHBvcnRyYWl0JTIwc21pbGluZ3xlbnwwfHx8fDE3ODc2MzcwNjN8MA&ixlib=rb-4.1.0&q=85&w=200&h=200&fit=crop"


def uid():
    return str(uuid.uuid4())


def hp(p):
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def now():
    return datetime.now(timezone.utc)


async def seed_all(db):
    if await db.companies.count_documents({}) > 0:
        return

    import os
    org_id = uid()
    await db.companies.insert_one({
        "id": org_id, "name": "Route39 Technologies",
        "address": "4th Floor, WeWork, Prestige Central, Tirupur 641601",
        "logo": "",
    })

    dept_names = ["Sales", "Support", "Engineering", "Operations", "HR"]
    departments = []
    for d in dept_names:
        doc = {"id": uid(), "org_id": org_id, "name": d}
        departments.append(doc)
    await db.departments.insert_many([dict(x) for x in departments])

    desig_names = ["Executive", "Senior Executive", "Team Lead", "Manager", "Associate"]
    await db.designations.insert_many([{"id": uid(), "org_id": org_id, "name": d} for d in desig_names])

    shift = {"id": uid(), "org_id": org_id, "name": "General Shift",
             "start_time": "09:30", "end_time": "18:30", "grace_minutes": 10}
    night = {"id": uid(), "org_id": org_id, "name": "Evening Shift",
             "start_time": "14:00", "end_time": "23:00", "grace_minutes": 10}
    await db.shifts.insert_many([shift, night])

    admin_email = os.environ.get("ADMIN_EMAIL", "support@route39.in")
    admin_pw = os.environ.get("ADMIN_PASSWORD", "admin123")

    # admin employee + user
    admin_emp_id = uid()
    admin_user_id = uid()
    await db.employees.insert_one({
        "id": admin_emp_id, "org_id": org_id, "user_id": admin_user_id,
        "employee_code": "EMP1000", "name": "Priya Nair", "email": admin_email,
        "phone": "+91 98450 10000", "department": "HR", "designation": "Manager",
        "joining_date": "2021-04-01", "team_leader_id": None, "photo": AV_F,
        "monthly_salary": 120000, "salary_type": "Monthly",
        "shift_id": shift["id"], "location": "Tirupur", "status": "Active",
    })
    await db.users.insert_one({
        "id": admin_user_id, "org_id": org_id, "email": admin_email,
        "password_hash": hp(admin_pw), "name": "Priya Nair", "role": "admin",
        "employee_id_ref": admin_emp_id, "created_at": now().isoformat(),
    })

    # team leaders
    tls = [
        ("Arjun Mehta", "arjun.mehta@attendy.app", "Sales", AV_M),
        ("Kavya Reddy", "kavya.reddy@attendy.app", "Support", AV_F),
    ]
    tl_ids = []
    code = 1001
    for name, email, dept, av in tls:
        emp_id = uid()
        user_id = uid()
        await db.employees.insert_one({
            "id": emp_id, "org_id": org_id, "user_id": user_id,
            "employee_code": f"EMP{code}", "name": name, "email": email,
            "phone": f"+91 98450 1{code}", "department": dept, "designation": "Team Lead",
            "joining_date": "2022-06-15", "team_leader_id": None, "photo": av,
            "monthly_salary": 85000, "salary_type": "Monthly",
            "shift_id": shift["id"], "location": "Tirupur", "status": "Active",
        })
        await db.users.insert_one({
            "id": user_id, "org_id": org_id, "email": email,
            "password_hash": hp("password123"), "name": name, "role": "team_leader",
            "employee_id_ref": emp_id, "created_at": now().isoformat(),
        })
        await db.leave_balances.insert_one({"id": uid(), "org_id": org_id, "employee_id": emp_id,
                                            "casual": 12, "sick": 8, "used_casual": 2, "used_sick": 1})
        tl_ids.append((emp_id, dept))
        code += 1

    # staff
    staff = [
        ("Dhanusha R", "dhanusha.r@attendy.app", "Sales", "Executive", AV_F, 42000),
        ("Rahul Verma", "rahul.verma@attendy.app", "Sales", "Senior Executive", AV_M, 48000),
        ("Sneha Iyer", "sneha.iyer@attendy.app", "Support", "Associate", AV_F, 38000),
        ("Vikram Singh", "vikram.singh@attendy.app", "Support", "Executive", AV_M, 40000),
        ("Ananya Das", "ananya.das@attendy.app", "Engineering", "Senior Executive", AV_F, 72000),
        ("Karthik Rao", "karthik.rao@attendy.app", "Engineering", "Executive", AV_M, 65000),
        ("Meera Joshi", "meera.joshi@attendy.app", "Operations", "Associate", AV_F, 36000),
        ("Aditya Kumar", "aditya.kumar@attendy.app", "Operations", "Executive", AV_M, 39000),
    ]
    staff_ids = []
    for name, email, dept, desig, av, sal in staff:
        emp_id = uid()
        user_id = uid()
        tl = next((t[0] for t in tl_ids if t[1] == dept), None)
        await db.employees.insert_one({
            "id": emp_id, "org_id": org_id, "user_id": user_id,
            "employee_code": f"EMP{code}", "name": name, "email": email,
            "phone": f"+91 98450 1{code}", "department": dept, "designation": desig,
            "joining_date": "2023-01-10", "team_leader_id": tl, "photo": av,
            "monthly_salary": sal, "salary_type": "Monthly",
            "shift_id": shift["id"], "location": "Tirupur", "status": "Active",
        })
        await db.users.insert_one({
            "id": user_id, "org_id": org_id, "email": email,
            "password_hash": hp("password123"), "name": name, "role": "staff",
            "employee_id_ref": emp_id, "created_at": now().isoformat(),
        })
        await db.leave_balances.insert_one({"id": uid(), "org_id": org_id, "employee_id": emp_id,
                                            "casual": 12, "sick": 8,
                                            "used_casual": random.randint(0, 4), "used_sick": random.randint(0, 3)})
        staff_ids.append((emp_id, name, dept, sal))
        code += 1

    all_emps = [(admin_emp_id, "Priya Nair", "HR", 120000)] + \
               [(tl_ids[0][0], "Arjun Mehta", "Sales", 85000), (tl_ids[1][0], "Kavya Reddy", "Support", 85000)] + \
               staff_ids

    # attendance for last 20 days
    today = now().astimezone(IST).date()
    for emp_id, name, dept, sal in all_emps:
        for i in range(20):
            d = today - timedelta(days=i)
            if d.weekday() == 6:  # Sunday off
                continue
            r = random.random()
            if r < 0.08:
                await db.attendance.insert_one({"id": uid(), "org_id": org_id, "employee_id": emp_id,
                                                "date": d.isoformat(), "check_in": None, "check_out": None,
                                                "hours": 0, "status": "Absent"})
                continue
            late = r < 0.22
            ci_h, ci_m = (9, random.randint(45, 59)) if late else (9, random.randint(15, 29))
            ci = datetime(d.year, d.month, d.day, ci_h, ci_m, tzinfo=IST)
            work_h = random.uniform(8, 9.5)
            co = ci + timedelta(hours=work_h)
            # today: only check-in, no checkout for some
            if i == 0 and emp_id != admin_emp_id:
                await db.attendance.insert_one({"id": uid(), "org_id": org_id, "employee_id": emp_id,
                                                "date": d.isoformat(), "check_in": ci.isoformat(),
                                                "check_out": None, "hours": 0,
                                                "status": "Late" if late else "Present"})
            else:
                await db.attendance.insert_one({"id": uid(), "org_id": org_id, "employee_id": emp_id,
                                                "date": d.isoformat(), "check_in": ci.isoformat(),
                                                "check_out": co.isoformat(), "hours": round(work_h, 2),
                                                "status": "Late" if late else "Present"})

    # leaves
    dhanusha = staff_ids[0][0]
    await db.leaves.insert_one({"id": uid(), "org_id": org_id, "employee_id": dhanusha,
                                "employee_name": "Dhanusha R", "leave_type": "Casual Leave",
                                "from_date": (today + timedelta(days=3)).isoformat(),
                                "to_date": (today + timedelta(days=4)).isoformat(), "days": 2,
                                "reason": "Family function", "status": "Pending",
                                "applied_at": now().isoformat()})
    await db.leaves.insert_one({"id": uid(), "org_id": org_id, "employee_id": staff_ids[2][0],
                                "employee_name": "Sneha Iyer", "leave_type": "Sick Leave",
                                "from_date": (today - timedelta(days=2)).isoformat(),
                                "to_date": (today - timedelta(days=2)).isoformat(), "days": 1,
                                "reason": "Fever", "status": "Approved",
                                "applied_at": (now() - timedelta(days=3)).isoformat()})
    await db.leaves.insert_one({"id": uid(), "org_id": org_id, "employee_id": staff_ids[4][0],
                                "employee_name": "Ananya Das", "leave_type": "Casual Leave",
                                "from_date": today.isoformat(), "to_date": today.isoformat(), "days": 1,
                                "reason": "Personal work", "status": "Approved",
                                "applied_at": (now() - timedelta(days=2)).isoformat()})
    # mark ananya on leave today
    await db.attendance.delete_many({"employee_id": staff_ids[4][0], "date": today.isoformat()})
    await db.attendance.insert_one({"id": uid(), "org_id": org_id, "employee_id": staff_ids[4][0],
                                    "date": today.isoformat(), "check_in": None, "check_out": None,
                                    "hours": 0, "status": "Leave"})

    # tasks
    task_defs = [
        ("Call 20 new customers", "Reach out to the leads from last week's campaign.", staff_ids[0][0], 0, "High", "todo",
         ["Prepare call list", "Make calls", "Log outcomes"]),
        ("Follow up with customer", "Follow up on the pending renewal.", staff_ids[0][0], 0, "Medium", "in_progress",
         ["Send email", "Schedule call"]),
        ("Resolve support ticket #4521", "Customer reported login issue.", staff_ids[2][0], 1, "High", "in_progress",
         ["Reproduce issue", "Fix", "Verify with customer"]),
        ("Prepare monthly sales report", "Compile numbers for the review.", tl_ids[0][0], 2, "Medium", "todo",
         ["Gather data", "Build deck"]),
        ("Deploy release v2.3", "Ship the new attendance module.", staff_ids[4][0], 1, "High", "in_progress",
         ["Run tests", "Deploy staging", "Deploy prod"]),
        ("Update onboarding docs", "Refresh the new-hire handbook.", staff_ids[6][0], 3, "Low", "completed",
         ["Draft", "Review", "Publish"]),
        ("Fix payroll rounding bug", "Net salary rounding off by a rupee.", staff_ids[5][0], -1, "Medium", "completed",
         ["Locate bug", "Patch"]),
        ("Onboard 3 new interns", "Set up accounts and desks.", tl_ids[1][0], 5, "Low", "todo",
         ["Create accounts", "Assign mentors"]),
        ("Weekly team standup notes", "Share the summary with the team.", staff_ids[3][0], 0, "Low", "todo", []),
        ("Audit attendance records", "Verify last month's anomalies.", staff_ids[7][0], 2, "Medium", "in_progress",
         ["Pull records", "Flag issues"]),
    ]
    emp_name_map = {e[0]: e[1] for e in all_emps}
    for title, desc, assignee, due_offset, prio, status, checklist in task_defs:
        cl = [{"id": uid(), "text": c, "done": (status == "completed")} for c in checklist]
        await db.tasks.insert_one({
            "id": uid(), "org_id": org_id, "title": title, "description": desc,
            "assignee_id": assignee, "assignee_name": emp_name_map.get(assignee, ""),
            "due_date": (today + timedelta(days=due_offset)).isoformat(),
            "priority": prio, "status": status, "checklist": cl,
            "comments": [{"id": uid(), "text": "On it!", "author": emp_name_map.get(assignee, "Staff"),
                          "created_at": now().isoformat()}] if status == "in_progress" else [],
            "created_by": admin_user_id, "created_at": now().isoformat(),
        })

    # payroll for previous month + current month
    from server import month_working_days
    for month_offset in [0, 1]:
        m = (today.replace(day=1) - timedelta(days=month_offset * 30)).strftime("%Y-%m")
        wd = month_working_days(m)
        for emp_id, name, dept, sal in all_emps:
            code2 = next((e for e in all_emps if e[0] == emp_id), None)
            per_day = sal / wd if wd else 0
            lop_days = random.randint(0, 2) if month_offset == 1 else 0
            ot_hours = random.randint(0, 8)
            lop = round(per_day * lop_days, 2)
            overtime = round((per_day / 8) * ot_hours, 2)
            incentive = random.choice([0, 0, 2000, 5000])
            deduction = random.choice([0, 0, 1000])
            net = round(sal - lop + overtime + incentive - deduction, 2)
            emp_doc = await db.employees.find_one({"id": emp_id}, {"_id": 0})
            await db.payroll.insert_one({
                "id": uid(), "employee_id": emp_id, "employee_name": name,
                "employee_code": emp_doc["employee_code"], "org_id": org_id, "month": m,
                "salary": sal, "lop": lop, "lop_days": lop_days, "overtime": overtime,
                "overtime_hours": ot_hours, "incentive": incentive, "deduction": deduction,
                "net": net, "working_days": wd,
                "status": "Paid" if month_offset == 1 else "Draft",
            })

    # notifications + activities
    admin_notifs = [
        ("leave", "Dhanusha R applied for Casual Leave"),
        ("task", "Task 'Deploy release v2.3' is in progress"),
        ("payroll", "Payroll generated for last month"),
    ]
    for t, m in admin_notifs:
        await db.notifications.insert_one({"id": uid(), "user_id": admin_user_id, "type": t,
                                           "message": m, "read": False, "created_at": now().isoformat()})
    activities = ["Priya Nair generated payroll", "Sneha Iyer's Sick Leave approved",
                  "New staff added: Aditya Kumar", "Ananya Das checked in", "Task created: Deploy release v2.3"]
    for i, a in enumerate(activities):
        await db.activities.insert_one({"id": uid(), "org_id": org_id, "message": a,
                                        "created_at": (now() - timedelta(hours=i)).isoformat()})
