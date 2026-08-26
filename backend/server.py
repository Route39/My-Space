from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, File, UploadFile
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import logging
import base64
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import uuid
import bcrypt
import jwt
import re
from pymongo.errors import DuplicateKeyError
from datetime import datetime, timezone, timedelta, date

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALG = "HS256"

app = FastAPI()
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("attendy")


# ---------------- helpers ----------------
def uid() -> str:
    return str(uuid.uuid4())


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


IST = timezone(timedelta(hours=5, minutes=30))


def now_ist() -> datetime:
    return datetime.now(IST)


def today_str() -> str:
    return now_ist().date().isoformat()


def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def verify_password(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode(), h.encode())
    except Exception:
        return False


def create_token(user_id: str, email: str, role: str, org_id: Optional[str] = None) -> str:
    payload = {"sub": user_id, "email": email, "role": role, "org_id": org_id,
               "exp": now_utc() + timedelta(days=7)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def get_current_user(request: Request) -> dict:
    token = None
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    user.pop("password_hash", None)
    return user


def require_roles(*roles):
    async def dep(user: dict = Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Not allowed")
        return user
    return dep


async def create_notification(user_id: str, ntype: str, message: str):
    await db.notifications.insert_one({
        "id": uid(), "user_id": user_id, "type": ntype,
        "message": message, "read": False,
        "created_at": now_utc().isoformat(),
    })


async def log_activity(org_id: str, message: str):
    await db.activities.insert_one({
        "id": uid(), "org_id": org_id, "message": message,
        "created_at": now_utc().isoformat(),
    })


# ---------------- models ----------------
class LoginIn(BaseModel):
    email: str
    password: str
    tenant_slug: Optional[str] = None


class SignupIn(BaseModel):
    company_name: str
    slug: str
    admin_name: str
    admin_email: str
    password: str


class PlatformStatusIn(BaseModel):
    active: bool


class EmployeeIn(BaseModel):
    name: str
    email: str
    phone: str = ""
    department: str = ""
    designation: str = ""
    joining_date: str = ""
    team_leader_id: Optional[str] = None
    photo: str = ""
    monthly_salary: float = 0
    salary_type: str = "Monthly"
    shift_id: Optional[str] = None
    location: str = ""
    role: str = "staff"
    password: Optional[str] = None


class DepartmentIn(BaseModel):
    name: str


class DesignationIn(BaseModel):
    name: str


class ShiftIn(BaseModel):
    name: str
    start_time: str
    end_time: str
    grace_minutes: int = 10


class AttendanceEditIn(BaseModel):
    check_in: Optional[str] = None
    check_out: Optional[str] = None
    status: Optional[str] = None


class LeaveIn(BaseModel):
    leave_type: str
    from_date: str
    to_date: str
    reason: str = ""


class TaskIn(BaseModel):
    title: str
    description: str = ""
    assignee_id: Optional[str] = None
    due_date: Optional[str] = None
    priority: str = "Medium"
    checklist: List[str] = []
    status: str = "todo"


class TaskUpdateIn(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assignee_id: Optional[str] = None
    due_date: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None


class StatusIn(BaseModel):
    status: str


class ChecklistToggleIn(BaseModel):
    item_id: str
    done: bool


class ChecklistAddIn(BaseModel):
    text: str


class CommentIn(BaseModel):
    text: str


class CompanyIn(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    logo: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    brand_color: Optional[str] = None


class PayrollStatusIn(BaseModel):
    status: str


class SalaryIn(BaseModel):
    monthly_salary: float
    salary_type: str = "Monthly"


# ---------------- shift/attendance logic ----------------
def parse_hm(t: str):
    h, m = t.split(":")
    return int(h), int(m)


async def get_employee_for_user(user: dict) -> Optional[dict]:
    if user.get("employee_id_ref"):
        return await db.employees.find_one({"id": user["employee_id_ref"]}, {"_id": 0})
    return await db.employees.find_one({"user_id": user["id"]}, {"_id": 0})


def compute_status(check_in_iso: str, shift: Optional[dict]) -> str:
    if not shift:
        return "Present"
    ci = datetime.fromisoformat(check_in_iso)
    sh, sm = parse_hm(shift["start_time"])
    grace = shift.get("grace_minutes", 10)
    start = ci.replace(hour=sh, minute=sm, second=0, microsecond=0)
    if ci > start + timedelta(minutes=grace):
        return "Late"
    return "Present"


def hours_between(ci: str, co: str) -> float:
    a = datetime.fromisoformat(ci)
    b = datetime.fromisoformat(co)
    return round(max(0.0, (b - a).total_seconds() / 3600), 2)


# ---------------- multi-tenant helpers ----------------
RESERVED_SLUGS = {"www", "app", "admin", "api", "support", "billing", "help", "status",
                  "mail", "assets", "cdn", "static", "platform", "dashboard", "login",
                  "signup", "register", "onboarding", "super", "root", "system", "attendy"}
SLUG_RE = re.compile(r'^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$')


def validate_slug(slug: str) -> str:
    s = (slug or "").lower().strip()
    if not SLUG_RE.match(s):
        raise HTTPException(status_code=400, detail="Slug must be 3-32 chars: lowercase letters, numbers or hyphens")
    if s in RESERVED_SLUGS:
        raise HTTPException(status_code=400, detail="This workspace name is reserved")
    return s


async def create_organization(name, slug, admin_name, admin_email, password,
                              brand_color="#059669", email="", phone="", address=""):
    admin_email = (admin_email or "").lower().strip()
    if await db.users.find_one({"email": admin_email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    if await db.companies.find_one({"slug": slug}):
        raise HTTPException(status_code=400, detail="Workspace slug already taken")
    org_id = uid()
    try:
        await db.companies.insert_one({
            "id": org_id, "name": name, "slug": slug, "logo": "",
            "email": email or admin_email, "phone": phone, "address": address,
            "brand_color": brand_color, "active": True, "created_at": now_utc().isoformat(),
        })
    except DuplicateKeyError:
        raise HTTPException(status_code=400, detail="Workspace slug already taken")
    for d in ["Sales", "Support", "Engineering", "Operations", "HR"]:
        await db.departments.insert_one({"id": uid(), "org_id": org_id, "name": d})
    for d in ["Executive", "Senior Executive", "Team Lead", "Manager", "Associate"]:
        await db.designations.insert_one({"id": uid(), "org_id": org_id, "name": d})
    shift_id = uid()
    await db.shifts.insert_one({"id": shift_id, "org_id": org_id, "name": "General Shift",
                                "start_time": "09:30", "end_time": "18:30", "grace_minutes": 10})
    emp_id, user_id = uid(), uid()
    await db.employees.insert_one({
        "id": emp_id, "org_id": org_id, "user_id": user_id, "employee_code": "EMP1000",
        "name": admin_name, "email": admin_email, "phone": phone, "department": "HR",
        "designation": "Manager", "joining_date": now_utc().date().isoformat(),
        "team_leader_id": None, "photo": "", "monthly_salary": 0, "salary_type": "Monthly",
        "shift_id": shift_id, "location": "", "status": "Active",
    })
    await db.users.insert_one({
        "id": user_id, "org_id": org_id, "email": admin_email, "password_hash": hash_password(password),
        "name": admin_name, "role": "admin", "employee_id_ref": emp_id, "created_at": now_utc().isoformat(),
    })
    await db.leave_balances.insert_one({"id": uid(), "org_id": org_id, "employee_id": emp_id,
                                        "casual": 12, "sick": 8, "used_casual": 0, "used_sick": 0})
    return org_id, user_id


async def run_migrations():
    """Idempotent: backfill tenant fields, super admin, and a 2nd demo org."""
    async for c in db.companies.find({}):
        upd = {}
        if not c.get("slug"):
            base = re.sub(r'[^a-z0-9]', '', (c.get("name", "org").lower().split() or ["org"])[0])[:20] or "org"
            slug, i = base, 1
            while await db.companies.find_one({"slug": slug, "id": {"$ne": c["id"]}}):
                i += 1
                slug = f"{base}{i}"
            upd["slug"] = slug
        for k, v in {"brand_color": "#059669", "active": True, "email": "", "phone": "",
                     "logo": c.get("logo", ""), "created_at": now_utc().isoformat()}.items():
            if k not in c:
                upd[k] = v
        if upd:
            await db.companies.update_one({"id": c["id"]}, {"$set": upd})
    await db.companies.update_one({"name": "Route39 Technologies"}, {"$set": {"slug": "route39"}})
    if not await db.users.find_one({"role": "super_admin"}):
        await db.users.insert_one({"id": uid(), "org_id": None, "email": "platform@attendy.in",
                                   "password_hash": hash_password("super123"), "name": "Platform Admin",
                                   "role": "super_admin", "employee_id_ref": None, "created_at": now_utc().isoformat()})
    if not await db.companies.find_one({"slug": "demo"}):
        try:
            await create_organization("Demo Company", "demo", "Demo Admin", "demo@attendy.app", "demo123", address="Demo Street, Mumbai")
        except HTTPException:
            pass
    try:
        await db.companies.create_index("slug", unique=True)
    except Exception:
        pass
    await db.myspace_items.update_many({"status": {"$exists": False}}, {"$set": {"status": "new"}})


# ---------------- tenant (public) routes ----------------
@api.get("/tenant/{slug}")
async def resolve_tenant(slug: str):
    c = await db.companies.find_one({"slug": slug.lower().strip()},
                                    {"_id": 0, "id": 1, "name": 1, "slug": 1, "logo": 1, "brand_color": 1, "active": 1})
    if not c:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return c


@api.get("/onboarding/slug-available/{slug}")
async def slug_available(slug: str):
    s = (slug or "").lower().strip()
    try:
        validate_slug(s)
    except HTTPException as e:
        return {"available": False, "reason": e.detail}
    exists = await db.companies.find_one({"slug": s})
    return {"available": not bool(exists), "reason": "Already taken" if exists else "Available"}


@api.post("/onboarding/signup")
async def signup(body: SignupIn):
    slug = validate_slug(body.slug)
    org_id, user_id = await create_organization(body.company_name, slug, body.admin_name, body.admin_email, body.password)
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    user.pop("password_hash", None)
    token = create_token(user_id, user["email"], "admin", org_id)
    return {"token": token, "user": user, "company": {"slug": slug, "name": body.company_name}}


# ---------------- platform (super admin) routes ----------------
@api.get("/platform/companies")
async def platform_companies(user: dict = Depends(require_roles("super_admin"))):
    out = []
    async for c in db.companies.find({}, {"_id": 0}):
        c["employee_count"] = await db.employees.count_documents({"org_id": c["id"]})
        c["user_count"] = await db.users.count_documents({"org_id": c["id"]})
        out.append(c)
    return out


@api.put("/platform/companies/{org_id}/status")
async def platform_set_status(org_id: str, body: PlatformStatusIn, user: dict = Depends(require_roles("super_admin"))):
    existing = await db.companies.find_one({"id": org_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Company not found")
    await db.companies.update_one({"id": org_id}, {"$set": {"active": body.active}})
    return await db.companies.find_one({"id": org_id}, {"_id": 0})


# ---------------- auth routes ----------------
@api.post("/auth/login")
async def login(body: LoginIn):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user["role"] != "super_admin":
        company = await db.companies.find_one({"id": user.get("org_id")})
        if not company:
            raise HTTPException(status_code=403, detail="Workspace not found")
        if not company.get("active", True):
            raise HTTPException(status_code=403, detail="This workspace is inactive. Please contact support.")
        if body.tenant_slug and company.get("slug") != body.tenant_slug.lower().strip():
            raise HTTPException(status_code=403, detail="This account belongs to a different workspace")
    token = create_token(user["id"], user["email"], user["role"], user.get("org_id"))
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"token": token, "user": user}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    emp = await get_employee_for_user(user)
    return {"user": user, "employee": emp}


@api.post("/auth/logout")
async def logout(user: dict = Depends(get_current_user)):
    return {"ok": True}


# ---------------- company / settings ----------------
async def get_org(user: dict) -> str:
    return user["org_id"]


@api.get("/company")
async def get_company(user: dict = Depends(get_current_user)):
    return await db.companies.find_one({"id": user["org_id"]}, {"_id": 0})


@api.put("/company")
async def update_company(body: CompanyIn, user: dict = Depends(require_roles("admin"))):
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    await db.companies.update_one({"id": user["org_id"]}, {"$set": upd})
    return await db.companies.find_one({"id": user["org_id"]}, {"_id": 0})


@api.get("/departments")
async def list_departments(user: dict = Depends(get_current_user)):
    return await db.departments.find({"org_id": user["org_id"]}, {"_id": 0}).to_list(200)


@api.post("/departments")
async def add_department(body: DepartmentIn, user: dict = Depends(require_roles("admin"))):
    doc = {"id": uid(), "org_id": user["org_id"], "name": body.name}
    await db.departments.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.delete("/departments/{dep_id}")
async def del_department(dep_id: str, user: dict = Depends(require_roles("admin"))):
    await db.departments.delete_one({"id": dep_id, "org_id": user["org_id"]})
    return {"ok": True}


@api.get("/designations")
async def list_designations(user: dict = Depends(get_current_user)):
    return await db.designations.find({"org_id": user["org_id"]}, {"_id": 0}).to_list(200)


@api.post("/designations")
async def add_designation(body: DesignationIn, user: dict = Depends(require_roles("admin"))):
    doc = {"id": uid(), "org_id": user["org_id"], "name": body.name}
    await db.designations.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.delete("/designations/{des_id}")
async def del_designation(des_id: str, user: dict = Depends(require_roles("admin"))):
    await db.designations.delete_one({"id": des_id, "org_id": user["org_id"]})
    return {"ok": True}


@api.get("/shifts")
async def list_shifts(user: dict = Depends(get_current_user)):
    return await db.shifts.find({"org_id": user["org_id"]}, {"_id": 0}).to_list(200)


@api.post("/shifts")
async def add_shift(body: ShiftIn, user: dict = Depends(require_roles("admin"))):
    doc = {"id": uid(), "org_id": user["org_id"], **body.model_dump()}
    await db.shifts.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/shifts/{shift_id}")
async def update_shift(shift_id: str, body: ShiftIn, user: dict = Depends(require_roles("admin"))):
    existing = await db.shifts.find_one({"id": shift_id, "org_id": user["org_id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")
    await db.shifts.update_one({"id": shift_id, "org_id": user["org_id"]}, {"$set": body.model_dump()})
    return await db.shifts.find_one({"id": shift_id, "org_id": user["org_id"]}, {"_id": 0})


# ---------------- employees ----------------
async def next_emp_code(org_id: str) -> str:
    count = await db.employees.count_documents({"org_id": org_id})
    return f"EMP{1001 + count}"


@api.get("/employees")
async def list_employees(user: dict = Depends(get_current_user)):
    if user["role"] == "staff":
        emp = await get_employee_for_user(user)
        return [emp] if emp else []
    q = {"org_id": user["org_id"]}
    if user["role"] == "team_leader":
        emp = await get_employee_for_user(user)
        q = {"org_id": user["org_id"], "$or": [
            {"team_leader_id": emp["id"] if emp else None},
            {"id": emp["id"] if emp else None},
        ]}
    emps = await db.employees.find(q, {"_id": 0}).to_list(500)
    return emps


@api.post("/employees")
async def create_employee(body: EmployeeIn, user: dict = Depends(require_roles("admin"))):
    email = body.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    emp_id = uid()
    user_id = uid()
    code = await next_emp_code(user["org_id"])
    emp = {
        "id": emp_id, "org_id": user["org_id"], "user_id": user_id,
        "employee_code": code, "name": body.name, "email": email,
        "phone": body.phone, "department": body.department,
        "designation": body.designation, "joining_date": body.joining_date or now_utc().date().isoformat(),
        "team_leader_id": body.team_leader_id, "photo": body.photo,
        "monthly_salary": body.monthly_salary, "salary_type": body.salary_type,
        "shift_id": body.shift_id, "location": body.location, "status": "Active",
    }
    await db.employees.insert_one(emp)
    await db.users.insert_one({
        "id": user_id, "org_id": user["org_id"], "email": email,
        "password_hash": hash_password(body.password or "password123"),
        "name": body.name, "role": body.role, "employee_id_ref": emp_id,
        "created_at": now_utc().isoformat(),
    })
    await db.leave_balances.insert_one({
        "id": uid(), "org_id": user["org_id"], "employee_id": emp_id,
        "casual": 12, "sick": 8, "used_casual": 0, "used_sick": 0,
    })
    await log_activity(user["org_id"], f"New staff added: {body.name}")
    emp.pop("_id", None)
    return emp


@api.get("/employees/{emp_id}")
async def get_employee(emp_id: str, user: dict = Depends(get_current_user)):
    emp = await db.employees.find_one({"id": emp_id, "org_id": user["org_id"]}, {"_id": 0})
    if not emp:
        raise HTTPException(status_code=404, detail="Not found")
    if user["role"] == "staff":
        self_emp = await get_employee_for_user(user)
        if not self_emp or self_emp["id"] != emp_id:
            raise HTTPException(status_code=403, detail="Not allowed")
    return emp


@api.put("/employees/{emp_id}")
async def update_employee(emp_id: str, body: EmployeeIn, user: dict = Depends(require_roles("admin"))):
    existing = await db.employees.find_one({"id": emp_id, "org_id": user["org_id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")
    upd = body.model_dump(exclude={"password", "role", "email"})
    await db.employees.update_one({"id": emp_id, "org_id": user["org_id"]}, {"$set": upd})
    return await db.employees.find_one({"id": emp_id, "org_id": user["org_id"]}, {"_id": 0})


@api.put("/employees/{emp_id}/salary")
async def set_salary(emp_id: str, body: SalaryIn, user: dict = Depends(require_roles("admin"))):
    existing = await db.employees.find_one({"id": emp_id, "org_id": user["org_id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")
    await db.employees.update_one({"id": emp_id, "org_id": user["org_id"]},
                                  {"$set": {"monthly_salary": body.monthly_salary, "salary_type": body.salary_type}})
    return await db.employees.find_one({"id": emp_id, "org_id": user["org_id"]}, {"_id": 0})


# ---------------- attendance ----------------
@api.post("/attendance/checkin")
async def checkin(user: dict = Depends(get_current_user)):
    emp = await get_employee_for_user(user)
    if not emp:
        raise HTTPException(status_code=400, detail="No employee profile")
    today = today_str()
    existing = await db.attendance.find_one({"employee_id": emp["id"], "date": today})
    if existing and existing.get("check_in"):
        raise HTTPException(status_code=400, detail="Already checked in")
    shift = await db.shifts.find_one({"id": emp.get("shift_id")}, {"_id": 0}) if emp.get("shift_id") else None
    ci = now_ist().isoformat()
    status = compute_status(ci, shift)
    doc = {"id": uid(), "org_id": user["org_id"], "employee_id": emp["id"],
           "date": today, "check_in": ci, "check_out": None, "hours": 0, "status": status}
    await db.attendance.insert_one(doc)
    await log_activity(user["org_id"], f"{emp['name']} checked in")
    doc.pop("_id", None)
    return doc


@api.post("/attendance/checkout")
async def checkout(user: dict = Depends(get_current_user)):
    emp = await get_employee_for_user(user)
    if not emp:
        raise HTTPException(status_code=400, detail="No employee profile")
    today = today_str()
    att = await db.attendance.find_one({"employee_id": emp["id"], "date": today})
    if not att or not att.get("check_in"):
        raise HTTPException(status_code=400, detail="Not checked in")
    if att.get("check_out"):
        raise HTTPException(status_code=400, detail="Already checked out")
    co = now_ist().isoformat()
    hrs = hours_between(att["check_in"], co)
    await db.attendance.update_one({"id": att["id"]}, {"$set": {"check_out": co, "hours": hrs}})
    await log_activity(user["org_id"], f"{emp['name']} checked out")
    return await db.attendance.find_one({"id": att["id"]}, {"_id": 0})


@api.get("/attendance/me")
async def my_attendance(range: str = "month", user: dict = Depends(get_current_user)):
    emp = await get_employee_for_user(user)
    if not emp:
        return {"today": None, "history": []}
    today = now_ist().date()
    if range == "today":
        start = today
    elif range == "week":
        start = today - timedelta(days=today.weekday())
    else:
        start = today.replace(day=1)
    hist = await db.attendance.find(
        {"employee_id": emp["id"], "date": {"$gte": start.isoformat()}}, {"_id": 0}
    ).sort("date", -1).to_list(100)
    todoc = await db.attendance.find_one({"employee_id": emp["id"], "date": today.isoformat()}, {"_id": 0})
    return {"today": todoc, "history": hist}


@api.get("/attendance")
async def all_attendance(date: Optional[str] = None, department: Optional[str] = None,
                         status: Optional[str] = None, user: dict = Depends(require_roles("admin", "team_leader"))):
    d = date or today_str()
    emps = await list_employees(user)
    emp_ids = [e["id"] for e in emps]
    if department:
        emps = [e for e in emps if e["department"] == department]
        emp_ids = [e["id"] for e in emps]
    att = await db.attendance.find({"date": d, "employee_id": {"$in": emp_ids}}, {"_id": 0}).to_list(500)
    att_map = {a["employee_id"]: a for a in att}
    # who is on leave today
    on_leave = await db.leaves.find({"org_id": user["org_id"], "status": "Approved", "from_date": {"$lte": d}, "to_date": {"$gte": d}}, {"_id": 0}).to_list(500)
    leave_ids = {l["employee_id"] for l in on_leave}
    rows = []
    for e in emps:
        a = att_map.get(e["id"])
        if a:
            st = a["status"]
        elif e["id"] in leave_ids:
            st = "Leave"
        else:
            st = "Absent"
        rows.append({
            "employee_id": e["id"], "name": e["name"], "employee_code": e["employee_code"],
            "department": e["department"], "photo": e.get("photo", ""),
            "attendance_id": a["id"] if a else None,
            "check_in": a["check_in"] if a else None,
            "check_out": a["check_out"] if a else None,
            "hours": a["hours"] if a else 0, "status": st,
        })
    if status:
        rows = [r for r in rows if r["status"] == status]
    return rows


@api.put("/attendance/{att_id}")
async def edit_attendance(att_id: str, body: AttendanceEditIn, user: dict = Depends(require_roles("admin"))):
    existing = await db.attendance.find_one({"id": att_id, "org_id": user["org_id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    if "check_in" in upd and "check_out" in upd:
        upd["hours"] = hours_between(upd["check_in"], upd["check_out"])
    await db.attendance.update_one({"id": att_id, "org_id": user["org_id"]}, {"$set": upd})
    return await db.attendance.find_one({"id": att_id, "org_id": user["org_id"]}, {"_id": 0})


@api.post("/attendance/mark")
async def mark_attendance(employee_id: str, date: str, status: str,
                          user: dict = Depends(require_roles("admin"))):
    emp = await db.employees.find_one({"id": employee_id, "org_id": user["org_id"]}, {"_id": 0})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    existing = await db.attendance.find_one({"employee_id": employee_id, "date": date, "org_id": user["org_id"]})
    if existing:
        await db.attendance.update_one({"id": existing["id"]}, {"$set": {"status": status}})
        return await db.attendance.find_one({"id": existing["id"]}, {"_id": 0})
    doc = {"id": uid(), "org_id": user["org_id"], "employee_id": employee_id,
           "date": date, "check_in": None, "check_out": None, "hours": 0, "status": status}
    await db.attendance.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ---------------- leave ----------------
def days_between(a: str, b: str) -> int:
    d1 = date.fromisoformat(a)
    d2 = date.fromisoformat(b)
    return (d2 - d1).days + 1


@api.post("/leaves")
async def apply_leave(body: LeaveIn, user: dict = Depends(get_current_user)):
    emp = await get_employee_for_user(user)
    if not emp:
        raise HTTPException(status_code=400, detail="No employee profile")
    if body.to_date < body.from_date:
        raise HTTPException(status_code=400, detail="To date must be after from date")
    doc = {"id": uid(), "org_id": user["org_id"], "employee_id": emp["id"],
           "employee_name": emp["name"], "leave_type": body.leave_type,
           "from_date": body.from_date, "to_date": body.to_date,
           "days": days_between(body.from_date, body.to_date),
           "reason": body.reason, "status": "Pending",
           "applied_at": now_utc().isoformat()}
    await db.leaves.insert_one(doc)
    # notify team leader / admins
    if emp.get("team_leader_id"):
        tl_user = await db.users.find_one({"employee_id_ref": emp["team_leader_id"]})
        if tl_user:
            await create_notification(tl_user["id"], "leave", f"{emp['name']} applied for {body.leave_type}")
    admins = await db.users.find({"org_id": user["org_id"], "role": "admin"}).to_list(20)
    for a in admins:
        await create_notification(a["id"], "leave", f"{emp['name']} applied for {body.leave_type}")
    await log_activity(user["org_id"], f"{emp['name']} applied for leave")
    doc.pop("_id", None)
    return doc


@api.get("/leaves/me")
async def my_leaves(user: dict = Depends(get_current_user)):
    emp = await get_employee_for_user(user)
    if not emp:
        return {"balance": None, "leaves": []}
    bal = await db.leave_balances.find_one({"employee_id": emp["id"]}, {"_id": 0})
    leaves = await db.leaves.find({"employee_id": emp["id"]}, {"_id": 0}).sort("applied_at", -1).to_list(100)
    return {"balance": bal, "leaves": leaves}


@api.get("/leaves")
async def list_leaves(user: dict = Depends(require_roles("admin", "team_leader"))):
    emps = await list_employees(user)
    ids = [e["id"] for e in emps]
    leaves = await db.leaves.find({"employee_id": {"$in": ids}}, {"_id": 0}).sort("applied_at", -1).to_list(300)
    return leaves


@api.put("/leaves/{leave_id}/approve")
async def approve_leave(leave_id: str, user: dict = Depends(require_roles("admin", "team_leader"))):
    leave = await db.leaves.find_one({"id": leave_id, "org_id": user["org_id"]}, {"_id": 0})
    if not leave:
        raise HTTPException(status_code=404, detail="Not found")
    await db.leaves.update_one({"id": leave_id, "org_id": user["org_id"]}, {"$set": {"status": "Approved"}})
    # deduct balance & mark attendance leave
    if leave["leave_type"] == "Casual Leave":
        await db.leave_balances.update_one({"employee_id": leave["employee_id"]}, {"$inc": {"used_casual": leave["days"]}})
    elif leave["leave_type"] == "Sick Leave":
        await db.leave_balances.update_one({"employee_id": leave["employee_id"]}, {"$inc": {"used_sick": leave["days"]}})
    d = date.fromisoformat(leave["from_date"])
    end = date.fromisoformat(leave["to_date"])
    while d <= end:
        await mark_attendance(leave["employee_id"], d.isoformat(), "Leave", user)
        d += timedelta(days=1)
    emp_user = await db.users.find_one({"employee_id_ref": leave["employee_id"]})
    if emp_user:
        await create_notification(emp_user["id"], "leave", f"Your {leave['leave_type']} was approved")
    await log_activity(user["org_id"], f"Leave approved for {leave['employee_name']}")
    return await db.leaves.find_one({"id": leave_id}, {"_id": 0})


@api.put("/leaves/{leave_id}/reject")
async def reject_leave(leave_id: str, user: dict = Depends(require_roles("admin", "team_leader"))):
    leave = await db.leaves.find_one({"id": leave_id, "org_id": user["org_id"]}, {"_id": 0})
    if not leave:
        raise HTTPException(status_code=404, detail="Not found")
    await db.leaves.update_one({"id": leave_id, "org_id": user["org_id"]}, {"$set": {"status": "Rejected"}})
    emp_user = await db.users.find_one({"employee_id_ref": leave["employee_id"]})
    if emp_user:
        await create_notification(emp_user["id"], "leave", f"Your {leave['leave_type']} was rejected")
    return await db.leaves.find_one({"id": leave_id}, {"_id": 0})


# ---------------- tasks ----------------
def serialize_task(t: dict) -> dict:
    t.pop("_id", None)
    return t


async def ensure_task(task_id: str, user: dict) -> dict:
    t = await db.tasks.find_one({"id": task_id, "org_id": user["org_id"]}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Not found")
    return t


@api.get("/tasks")
async def list_tasks(user: dict = Depends(get_current_user)):
    if user["role"] == "staff":
        emp = await get_employee_for_user(user)
        q = {"org_id": user["org_id"], "assignee_id": emp["id"] if emp else "none"}
    elif user["role"] == "team_leader":
        emps = await list_employees(user)
        ids = [e["id"] for e in emps]
        q = {"org_id": user["org_id"], "$or": [{"assignee_id": {"$in": ids}}, {"assignee_id": None}]}
    else:
        q = {"org_id": user["org_id"]}
    tasks = await db.tasks.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return tasks


@api.post("/tasks")
async def create_task(body: TaskIn, user: dict = Depends(require_roles("admin", "team_leader"))):
    checklist = [{"id": uid(), "text": c, "done": False} for c in body.checklist if c.strip()]
    assignee_name = ""
    if body.assignee_id:
        ae = await db.employees.find_one({"id": body.assignee_id, "org_id": user["org_id"]}, {"_id": 0})
        assignee_name = ae["name"] if ae else ""
    doc = {"id": uid(), "org_id": user["org_id"], "title": body.title,
           "description": body.description, "assignee_id": body.assignee_id,
           "assignee_name": assignee_name, "due_date": body.due_date,
           "priority": body.priority, "status": body.status,
           "checklist": checklist, "comments": [],
           "created_by": user["id"], "created_at": now_utc().isoformat()}
    await db.tasks.insert_one(doc)
    if body.assignee_id:
        au = await db.users.find_one({"employee_id_ref": body.assignee_id})
        if au:
            await create_notification(au["id"], "task", f"New task assigned: {body.title}")
    await log_activity(user["org_id"], f"Task created: {body.title}")
    return serialize_task(doc)


@api.get("/tasks/{task_id}")
async def get_task(task_id: str, user: dict = Depends(get_current_user)):
    t = await db.tasks.find_one({"id": task_id, "org_id": user["org_id"]}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Not found")
    return t


@api.put("/tasks/{task_id}")
async def update_task(task_id: str, body: TaskUpdateIn, user: dict = Depends(get_current_user)):
    await ensure_task(task_id, user)
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    if "assignee_id" in upd:
        ae = await db.employees.find_one({"id": upd["assignee_id"], "org_id": user["org_id"]}, {"_id": 0})
        upd["assignee_name"] = ae["name"] if ae else ""
    await db.tasks.update_one({"id": task_id, "org_id": user["org_id"]}, {"$set": upd})
    return await db.tasks.find_one({"id": task_id, "org_id": user["org_id"]}, {"_id": 0})


@api.put("/tasks/{task_id}/status")
async def update_task_status(task_id: str, body: StatusIn, user: dict = Depends(get_current_user)):
    await ensure_task(task_id, user)
    await db.tasks.update_one({"id": task_id, "org_id": user["org_id"]}, {"$set": {"status": body.status}})
    return await db.tasks.find_one({"id": task_id, "org_id": user["org_id"]}, {"_id": 0})


@api.post("/tasks/{task_id}/checklist")
async def add_checklist(task_id: str, body: ChecklistAddIn, user: dict = Depends(get_current_user)):
    await ensure_task(task_id, user)
    item = {"id": uid(), "text": body.text, "done": False}
    await db.tasks.update_one({"id": task_id, "org_id": user["org_id"]}, {"$push": {"checklist": item}})
    return await db.tasks.find_one({"id": task_id, "org_id": user["org_id"]}, {"_id": 0})


@api.put("/tasks/{task_id}/checklist")
async def toggle_checklist(task_id: str, body: ChecklistToggleIn, user: dict = Depends(get_current_user)):
    await ensure_task(task_id, user)
    await db.tasks.update_one({"id": task_id, "org_id": user["org_id"], "checklist.id": body.item_id},
                              {"$set": {"checklist.$.done": body.done}})
    return await db.tasks.find_one({"id": task_id, "org_id": user["org_id"]}, {"_id": 0})


@api.post("/tasks/{task_id}/comments")
async def add_comment(task_id: str, body: CommentIn, user: dict = Depends(get_current_user)):
    await ensure_task(task_id, user)
    comment = {"id": uid(), "text": body.text, "author": user["name"],
               "created_at": now_utc().isoformat()}
    await db.tasks.update_one({"id": task_id, "org_id": user["org_id"]}, {"$push": {"comments": comment}})
    return await db.tasks.find_one({"id": task_id, "org_id": user["org_id"]}, {"_id": 0})


@api.delete("/tasks/{task_id}")
async def delete_task(task_id: str, user: dict = Depends(require_roles("admin", "team_leader"))):
    await db.tasks.delete_one({"id": task_id, "org_id": user["org_id"]})
    return {"ok": True}


# ---------------- payroll ----------------
def month_working_days(month: str) -> int:
    y, m = int(month[:4]), int(month[5:7])
    if m == 12:
        nxt = date(y + 1, 1, 1)
    else:
        nxt = date(y, m + 1, 1)
    first = date(y, m, 1)
    total = (nxt - first).days
    wd = 0
    d = first
    while d < nxt:
        if d.weekday() != 6:  # exclude Sundays
            wd += 1
        d += timedelta(days=1)
    return wd


@api.post("/payroll/generate")
async def generate_payroll(month: str, user: dict = Depends(require_roles("admin"))):
    emps = await db.employees.find({"org_id": user["org_id"], "status": "Active"}, {"_id": 0}).to_list(500)
    wd = month_working_days(month)
    results = []
    for e in emps:
        salary = e.get("monthly_salary", 0)
        per_day = salary / wd if wd else 0
        att = await db.attendance.find({"employee_id": e["id"], "date": {"$regex": f"^{month}"}}, {"_id": 0}).to_list(200)
        lop_days = 0
        overtime_hours = 0
        for a in att:
            if a["status"] == "Absent":
                lop_days += 1
            if a.get("hours", 0) > 9:
                overtime_hours += a["hours"] - 9
        # unpaid approved leaves
        unpaid = await db.leaves.find({"employee_id": e["id"], "status": "Approved",
                                       "leave_type": "Unpaid Leave", "from_date": {"$regex": f"^{month}"}}, {"_id": 0}).to_list(50)
        for l in unpaid:
            lop_days += l["days"]
        lop = round(per_day * lop_days, 2)
        overtime = round((per_day / 8) * overtime_hours, 2)
        incentive = 0
        deduction = 0
        net = round(salary - lop + overtime + incentive - deduction, 2)
        existing = await db.payroll.find_one({"employee_id": e["id"], "month": month})
        doc = {"employee_id": e["id"], "employee_name": e["name"],
               "employee_code": e["employee_code"], "org_id": user["org_id"],
               "month": month, "salary": salary, "lop": lop, "lop_days": lop_days,
               "overtime": overtime, "overtime_hours": round(overtime_hours, 1),
               "incentive": incentive, "deduction": deduction, "net": net,
               "working_days": wd, "status": "Draft"}
        if existing:
            doc["id"] = existing["id"]
            doc["status"] = existing.get("status", "Draft")
            await db.payroll.update_one({"id": existing["id"]}, {"$set": doc})
        else:
            doc["id"] = uid()
            await db.payroll.insert_one(dict(doc))
        doc.pop("_id", None)
        results.append(doc)
    await log_activity(user["org_id"], f"Payroll generated for {month}")
    return results


@api.get("/payroll")
async def list_payroll(month: str, user: dict = Depends(require_roles("admin", "team_leader"))):
    rows = await db.payroll.find({"org_id": user["org_id"], "month": month}, {"_id": 0}).to_list(500)
    return rows


class PayrollAdjustIn(BaseModel):
    incentive: Optional[float] = None
    deduction: Optional[float] = None


@api.put("/payroll/{pid}/adjust")
async def adjust_payroll(pid: str, body: PayrollAdjustIn, user: dict = Depends(require_roles("admin"))):
    p = await db.payroll.find_one({"id": pid, "org_id": user["org_id"]}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    inc = body.incentive if body.incentive is not None else p["incentive"]
    ded = body.deduction if body.deduction is not None else p["deduction"]
    net = round(p["salary"] - p["lop"] + p["overtime"] + inc - ded, 2)
    await db.payroll.update_one({"id": pid, "org_id": user["org_id"]}, {"$set": {"incentive": inc, "deduction": ded, "net": net}})
    return await db.payroll.find_one({"id": pid, "org_id": user["org_id"]}, {"_id": 0})


@api.put("/payroll/{pid}/status")
async def payroll_status(pid: str, body: PayrollStatusIn, user: dict = Depends(require_roles("admin"))):
    p = await db.payroll.find_one({"id": pid, "org_id": user["org_id"]}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    await db.payroll.update_one({"id": pid, "org_id": user["org_id"]}, {"$set": {"status": body.status}})
    if body.status == "Paid" and p:
        eu = await db.users.find_one({"employee_id_ref": p["employee_id"], "org_id": user["org_id"]})
        if eu:
            await create_notification(eu["id"], "payroll", f"Payslip for {p['month']} is ready")
    return await db.payroll.find_one({"id": pid, "org_id": user["org_id"]}, {"_id": 0})


@api.get("/payroll/me")
async def my_payslips(user: dict = Depends(get_current_user)):
    emp = await get_employee_for_user(user)
    if not emp:
        return []
    rows = await db.payroll.find({"employee_id": emp["id"], "status": {"$in": ["Approved", "Paid"]}}, {"_id": 0}).sort("month", -1).to_list(50)
    return rows


@api.get("/payslip/{pid}")
async def get_payslip(pid: str, user: dict = Depends(get_current_user)):
    p = await db.payroll.find_one({"id": pid}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    if p.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=403, detail="Not allowed")
    if user["role"] == "staff":
        self_emp = await get_employee_for_user(user)
        if not self_emp or p["employee_id"] != self_emp["id"]:
            raise HTTPException(status_code=403, detail="Not allowed")
    emp = await db.employees.find_one({"id": p["employee_id"]}, {"_id": 0})
    company = await db.companies.find_one({"id": p["org_id"]}, {"_id": 0})
    return {"payroll": p, "employee": emp, "company": company}


# ---------------- notifications ----------------
@api.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    await process_due_reminders(user)
    rows = await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return rows


@api.put("/notifications/{nid}/read")
async def read_notification(nid: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one({"id": nid, "user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}


@api.put("/notifications/read-all")
async def read_all(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}


# ---------------- dashboard ----------------
@api.get("/dashboard")
async def dashboard(user: dict = Depends(get_current_user)):
    today = today_str()
    if user["role"] in ("admin", "team_leader"):
        rows = await all_attendance(date=today, user=user)
        emp_count = len(rows)
        present = len([r for r in rows if r["status"] in ("Present", "Late")])
        late = len([r for r in rows if r["status"] == "Late"])
        on_leave = len([r for r in rows if r["status"] == "Leave"])
        tasks = await list_tasks(user)
        task_counts = {
            "todo": len([t for t in tasks if t["status"] == "todo"]),
            "in_progress": len([t for t in tasks if t["status"] == "in_progress"]),
            "completed": len([t for t in tasks if t["status"] == "completed"]),
            "overdue": len([t for t in tasks if t.get("due_date") and t["due_date"] < today and t["status"] != "completed"]),
        }
        month = today[:7]
        payroll = await db.payroll.find({"org_id": user["org_id"], "month": month}, {"_id": 0}).to_list(500)
        payroll_total = round(sum(p["net"] for p in payroll), 2)
        acts = await db.activities.find({"org_id": user["org_id"]}, {"_id": 0}).sort("created_at", -1).to_list(5)
        return {"role": user["role"], "stats": {"employees": emp_count, "present": present, "late": late, "on_leave": on_leave},
                "attendance_today": rows, "task_counts": task_counts, "payroll_total": payroll_total,
                "activities": acts}
    else:
        emp = await get_employee_for_user(user)
        todoc = await db.attendance.find_one({"employee_id": emp["id"], "date": today}, {"_id": 0}) if emp else None
        tasks = await list_tasks(user)
        task_counts = {
            "todo": len([t for t in tasks if t["status"] == "todo"]),
            "in_progress": len([t for t in tasks if t["status"] == "in_progress"]),
            "completed": len([t for t in tasks if t["status"] == "completed"]),
        }
        bal = await db.leave_balances.find_one({"employee_id": emp["id"]}, {"_id": 0}) if emp else None
        available = 0
        if bal:
            available = (bal["casual"] - bal["used_casual"]) + (bal["sick"] - bal["used_sick"])
        latest = None
        open_tasks = [t for t in tasks if t["status"] != "completed"]
        if open_tasks:
            latest = open_tasks[0]
        return {"role": "staff", "employee": emp, "today": todoc,
                "task_counts": task_counts, "leave_available": available, "latest_task": latest}


# ---------------- My Space ----------------
class MySpaceIn(BaseModel):
    type: Literal["note", "reminder", "checklist", "table", "file"]
    title: str = "Untitled"
    content: Optional[str] = ""
    visibility: Literal["private", "team", "company"] = "private"
    status: Literal["new", "in_progress", "completed"] = "new"
    pinned: bool = False
    reminder_date: Optional[str] = None
    reminder_time: Optional[str] = None
    repeat: Optional[str] = "none"
    checklist: Optional[list] = None
    table_data: Optional[dict] = None
    attachments: Optional[list] = None


class MySpaceUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    visibility: Optional[Literal["private", "team", "company"]] = None
    status: Optional[Literal["new", "in_progress", "completed"]] = None
    pinned: Optional[bool] = None
    reminder_date: Optional[str] = None
    reminder_time: Optional[str] = None
    repeat: Optional[str] = None
    checklist: Optional[list] = None
    table_data: Optional[dict] = None
    attachments: Optional[list] = None


async def my_team_id(user: dict) -> Optional[str]:
    emp = await get_employee_for_user(user)
    if not emp:
        return None
    if user["role"] == "team_leader":
        return emp["id"]
    return emp.get("team_leader_id")


async def can_view_item(item: dict, user: dict) -> bool:
    if item.get("org_id") != user["org_id"]:
        return False
    if item.get("owner_id") == user["id"]:
        return True
    vis = item.get("visibility", "private")
    if vis == "company":
        return True
    if vis == "team":
        if user["role"] == "admin":
            return True
        return item.get("team_id") and item.get("team_id") == await my_team_id(user)
    return False


async def process_due_reminders(user: dict):
    now = now_ist()
    items = await db.myspace_items.find({"org_id": user["org_id"], "owner_id": user["id"],
                                         "type": "reminder", "reminder_sent": {"$ne": True}}, {"_id": 0}).to_list(200)
    for it in items:
        if not it.get("reminder_date"):
            continue
        dt_str = f'{it["reminder_date"]}T{(it.get("reminder_time") or "09:00")}:00'
        try:
            due = datetime.fromisoformat(dt_str).replace(tzinfo=IST)
        except Exception:
            continue
        if due <= now:
            await create_notification(user["id"], "reminder", f"Reminder: {it['title']}")
            rep = it.get("repeat", "none")
            if rep and rep != "none":
                nd = date.fromisoformat(it["reminder_date"]) + (timedelta(days=1) if rep == "daily" else timedelta(days=7) if rep == "weekly" else timedelta(days=30))
                await db.myspace_items.update_one({"id": it["id"]}, {"$set": {"reminder_date": nd.isoformat(), "reminder_sent": False}})
            else:
                await db.myspace_items.update_one({"id": it["id"]}, {"$set": {"reminder_sent": True}})


@api.get("/myspace")
async def list_myspace(filter: str = "all", q: Optional[str] = None, status: Optional[str] = None, user: dict = Depends(get_current_user)):
    team = await my_team_id(user)
    conds = [{"owner_id": user["id"]}, {"visibility": "company"}]
    if user["role"] == "admin":
        conds.append({"visibility": "team"})
    elif team:
        conds.append({"visibility": "team", "team_id": team})
    query = {"org_id": user["org_id"], "$or": conds}
    if filter and filter not in ("all", "pinned"):
        query["type"] = filter
    if filter == "pinned":
        query["pinned"] = True
    if status:
        if status not in ("new", "in_progress", "completed"):
            raise HTTPException(status_code=422, detail="Invalid status")
        query["status"] = status
    if q:
        qesc = re.escape(q)
        query["$and"] = [{"$or": [{"title": {"$regex": qesc, "$options": "i"}}, {"content": {"$regex": qesc, "$options": "i"}}]}]
    items = await db.myspace_items.find(query, {"_id": 0}).sort("updated_at", -1).to_list(500)
    return items


@api.post("/myspace")
async def create_myspace(body: MySpaceIn, user: dict = Depends(get_current_user)):
    now = now_utc().isoformat()
    doc = {"id": uid(), "org_id": user["org_id"], "owner_id": user["id"], "owner_name": user["name"],
           "team_id": await my_team_id(user), "type": body.type, "title": body.title or "Untitled",
           "content": body.content or "", "visibility": body.visibility or "private", "status": body.status or "new",
           "pinned": body.pinned,
           "reminder_date": body.reminder_date, "reminder_time": body.reminder_time, "repeat": body.repeat or "none",
           "reminder_sent": False, "checklist": body.checklist or [], "table_data": body.table_data or {"columns": [], "rows": []},
           "attachments": body.attachments or [], "created_at": now, "updated_at": now}
    await db.myspace_items.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/myspace/{item_id}")
async def get_myspace(item_id: str, user: dict = Depends(get_current_user)):
    it = await db.myspace_items.find_one({"id": item_id, "org_id": user["org_id"]}, {"_id": 0})
    if not it or not await can_view_item(it, user):
        raise HTTPException(status_code=404, detail="Not found")
    return it


@api.put("/myspace/{item_id}")
async def update_myspace(item_id: str, body: MySpaceUpdate, user: dict = Depends(get_current_user)):
    it = await db.myspace_items.find_one({"id": item_id, "org_id": user["org_id"]}, {"_id": 0})
    if not it:
        raise HTTPException(status_code=404, detail="Not found")
    if it["owner_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only the owner can edit this")
    upd = {k: v for k, v in body.model_dump(exclude_unset=True).items()}
    if not upd:
        return it
    if "reminder_date" in upd or "reminder_time" in upd:
        upd["reminder_sent"] = False
    upd["updated_at"] = now_utc().isoformat()
    await db.myspace_items.update_one({"id": item_id, "org_id": user["org_id"]}, {"$set": upd})
    return await db.myspace_items.find_one({"id": item_id, "org_id": user["org_id"]}, {"_id": 0})


@api.put("/myspace/{item_id}/pin")
async def pin_myspace(item_id: str, user: dict = Depends(get_current_user)):
    it = await db.myspace_items.find_one({"id": item_id, "org_id": user["org_id"]}, {"_id": 0})
    if not it or it["owner_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Not found")
    await db.myspace_items.update_one({"id": item_id, "org_id": user["org_id"]}, {"$set": {"pinned": not it.get("pinned", False)}})
    return await db.myspace_items.find_one({"id": item_id, "org_id": user["org_id"]}, {"_id": 0})


@api.delete("/myspace/{item_id}")
async def delete_myspace(item_id: str, user: dict = Depends(get_current_user)):
    it = await db.myspace_items.find_one({"id": item_id, "org_id": user["org_id"]}, {"_id": 0})
    if not it:
        raise HTTPException(status_code=404, detail="Not found")
    if it["owner_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only the owner can delete this")
    await db.myspace_items.delete_one({"id": item_id, "org_id": user["org_id"]})
    return {"ok": True}


@api.post("/myspace/upload")
async def myspace_upload(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")
    ctype = file.content_type or "application/octet-stream"
    b64 = base64.b64encode(data).decode()
    fid = uid()
    await db.myspace_files.insert_one({"id": fid, "org_id": user["org_id"], "owner_id": user["id"],
                                       "name": file.filename, "content_type": ctype, "size": len(data),
                                       "data": b64, "created_at": now_utc().isoformat()})
    return {"file_id": fid, "name": file.filename, "type": ctype, "size": len(data),
            "data_url": f"data:{ctype};base64,{b64}"}


@api.get("/myspace/file/{fid}")
async def myspace_get_file(fid: str, user: dict = Depends(get_current_user)):
    f = await db.myspace_files.find_one({"id": fid, "org_id": user["org_id"]}, {"_id": 0})
    if not f:
        raise HTTPException(status_code=404, detail="Not found")
    if f["owner_id"] != user["id"]:
        item = await db.myspace_items.find_one({"org_id": user["org_id"], "attachments.file_id": fid}, {"_id": 0})
        if not item or not await can_view_item(item, user):
            raise HTTPException(status_code=403, detail="Not allowed")
    return {"name": f["name"], "type": f["content_type"], "size": f["size"],
            "data_url": f"data:{f['content_type']};base64,{f['data']}"}


# include router
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    from seed import seed_all
    await seed_all(db)
    await run_migrations()


@app.on_event("shutdown")
async def shutdown():
    client.close()
