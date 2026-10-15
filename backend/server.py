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
import math
from pymongo.errors import DuplicateKeyError
from datetime import datetime, timezone, timedelta, date
import certifi

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url, tlsCAFile=certifi.where())
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
        allowed = list(roles)
        if "admin" in allowed and "admin_staff" not in allowed:
            allowed.append("admin_staff")
        if user["role"] not in allowed:
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
    username: str
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
    email: str = ""
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
    work_mode: str = "Office"
    role: str = "staff"
    password: Optional[str] = None


class UserProfileUpdateIn(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    location: Optional[str] = None
    joining_date: Optional[str] = None
    salary_type: Optional[str] = None


class AnnouncementIn(BaseModel):
    title: str
    type: str
    message: str
    link_url: Optional[str] = None
    image_data: Optional[str] = None
    duration_days: int = 2
    expiry_date: Optional[str] = None
    expiry_time: Optional[str] = None

class NoticeIn(BaseModel):
    message: str
    duration_hours: int = 24
    from_date: Optional[str] = None
    to_date: Optional[str] = None
    from_time: Optional[str] = None
    to_time: Optional[str] = None



class LocationIn(BaseModel):
    name: str

class DepartmentIn(BaseModel):
    name: str


class DesignationIn(BaseModel):
    name: str


class ShiftIn(BaseModel):
    name: str
    start_time: str
    end_time: str
    grace_minutes: int = 10
    auto_checkout_hours: float = 10


class AttendanceEditIn(BaseModel):
    check_in: Optional[str] = None
    check_out: Optional[str] = None
    status: Optional[str] = None


class LeaveIn(BaseModel):
    leave_type: str
    from_date: str
    to_date: str
    reason: str = ""
    category: str = "Full Day"
    half_day_type: Optional[str] = None
    permission_hours: Optional[str] = None
class ChatMsgIn(BaseModel):
    message: str
    mentions: List[str] = []
    recipient_id: str = "group"

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
    geofence_enabled: Optional[bool] = None
    office_lat: Optional[float] = None
    office_lng: Optional[float] = None
    office_radius_m: Optional[int] = None


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


AUTO_CHECKOUT_HOURS = 11  # default: auto checkout after 10 hrs from check-in


def shift_auto_hours(shift: Optional[dict]) -> float:
    try:
        h = float((shift or {}).get("auto_checkout_hours") or AUTO_CHECKOUT_HOURS)
        return h if h > 0 else AUTO_CHECKOUT_HOURS
    except (TypeError, ValueError):
        return AUTO_CHECKOUT_HOURS


def compute_status(check_in_iso: str, shift: Optional[dict]) -> str:
    ci = datetime.fromisoformat(check_in_iso)
    if shift and shift.get("start_time"):
        sh, sm = parse_hm(shift["start_time"])
        grace = shift.get("grace_minutes", 10)
    else:
        sh, sm = 9, 30
        grace = 10
        
    start = ci.replace(hour=sh, minute=sm, second=0, microsecond=0)
    if ci.replace(second=0, microsecond=0) > start + timedelta(minutes=grace):
        return "Late"
    return "Present"


LATE_EXCUSES_PER_MONTH = 3


def is_week_off(date_str: str) -> bool:
    return date.fromisoformat(date_str).weekday() == 6


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
    await db.shifts.insert_one({"id": uid(), "org_id": org_id, "name": "Permission Shift",
                                "start_time": "10:00", "end_time": "19:00", "grace_minutes": 10})
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
        # Backfill 'id' if missing (old records may only have _id)
        if not c.get("id"):
            upd["id"] = str(c["_id"])
            c["id"] = upd["id"]
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
            await db.companies.update_one({"_id": c["_id"]}, {"$set": upd})
    async for c in db.companies.find({}):
        oid = c.get("id") or str(c["_id"])
        await db.shifts.update_one(
            {"org_id": oid, "name": "Permission Shift"},
            {"$setOnInsert": {"id": uid(), "start_time": "10:00", "end_time": "19:00", "grace_minutes": 10}},
            upsert=True)
    await db.companies.update_one({"name": "Route39 Technologies"}, {"$set": {"slug": "route39"}})
    if not await db.users.find_one({"role": "super_admin"}):
        await db.users.insert_one({"id": uid(), "org_id": None, "email": "platform@attendy.in",
                                   "password_hash": hash_password("super123"), "name": "Platform Admin",
                                   "role": "super_admin", "employee_id_ref": None, "created_at": now_utc().isoformat()})
    if not await db.companies.find_one({"slug": "demo"}):
        try:
            await create_organization("Demo Company", "demo", "Demo Admin", "demo@attendy.app", "demo123", address="Demo Street, Mumbai")
        except Exception:
            pass
    try:
        await db.companies.create_index("slug", unique=True)
    except Exception:
        pass
    # Drop legacy unique index on user_id if it exists (causes null-key conflicts)
    try:
        await db.users.drop_index("user_id_1")
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
    username = body.username.lower().strip()
    user = await db.users.find_one({"$or": [{"email": username}, {"phone": username}]})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username, email or password")
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


@api.get("/locations")
async def list_locations(user: dict = Depends(get_current_user)):
    return await db.locations.find({"org_id": user["org_id"]}, {"_id": 0}).to_list(200)

@api.post("/locations")
async def add_location(body: LocationIn, user: dict = Depends(require_roles("admin"))):
    doc = {"id": uid(), "org_id": user["org_id"], "name": body.name}
    await db.locations.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.delete("/locations/{loc_id}")
async def del_location(loc_id: str, user: dict = Depends(require_roles("admin"))):
    await db.locations.delete_one({"id": loc_id, "org_id": user["org_id"]})
    return {"ok": True}


class LocationGeoIn(BaseModel):
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    radius_m: Optional[int] = None
    hub_address: Optional[str] = None
    hub_lat: Optional[float] = None
    hub_lng: Optional[float] = None


class GeocodeIn(BaseModel):
    address: str


class ReverseGeocodeIn(BaseModel):
    lat: float
    lng: float


GEOCODER_HEADERS = {"User-Agent": "attendy-attendance/1.0 (contact: support@route39.in)"}  # use your own email


async def _nominatim_search(c, q):
    r = await c.get("https://nominatim.openstreetmap.org/search",
                    params={"q": q, "format": "jsonv2", "limit": 1})
    r.raise_for_status()
    data = r.json()
    return data[0] if isinstance(data, list) and data else None


@api.post("/locations/geocode")
async def geocode_address(body: GeocodeIn, user: dict = Depends(require_roles("admin"))):
    import httpx
    import asyncio
    addr = (body.address or "").strip()
    if len(addr) < 3:
        raise HTTPException(status_code=400, detail="Enter the office address")

    # pasted coordinates, e.g. "12.8459, 77.6599" (copied from Google Maps): used exactly as given
    m = re.match(r"^\s*(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$", addr)
    if m:
        lat, lng = float(m.group(1)), float(m.group(2))
        if -90 <= lat <= 90 and -180 <= lng <= 180:
            return {"lat": lat, "lng": lng, "display_name": "", "approximate": False}

    # Google Maps link (full or short), e.g. https://maps.app.goo.gl/xxxx
    if addr.lower().startswith("http"):
        try:
            async with httpx.AsyncClient(timeout=10, follow_redirects=True,
                                         headers={"User-Agent": "Mozilla/5.0"}) as c:
                resp = await c.get(addr)
            final = str(resp.url)
        except Exception:
            raise HTTPException(status_code=502, detail="Could not open that link. Please try again.")
        for pat in (r"!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)", r"@(-?\d+\.\d+),(-?\d+\.\d+)",
                    r"[?&](?:q|ll|query)=(-?\d+\.\d+),(-?\d+\.\d+)"):
            mm = re.search(pat, final)
            if mm:
                return {"lat": float(mm.group(1)), "lng": float(mm.group(2)), "display_name": "", "approximate": False}
        raise HTTPException(status_code=404, detail="No location found in that link. Open the place in Google Maps and copy the link again.")

    # full address first, then shorter versions (drop the leading building / street parts)
    parts = [p.strip() for p in addr.replace("\n", ",").split(",") if p.strip()]
    tries = [", ".join(parts[i:]) for i in range(0, max(1, len(parts) - 1))][:4]

    try:
        async with httpx.AsyncClient(timeout=10, headers=GEOCODER_HEADERS) as c:
            for i, q in enumerate(tries):
                if i:
                    await asyncio.sleep(1.1)   # the free service allows about 1 request per second
                hit = await _nominatim_search(c, q)
                if hit:
                    return {"lat": float(hit["lat"]), "lng": float(hit["lon"]),
                            "display_name": hit.get("display_name", ""), "approximate": i > 0}
    except Exception:
        raise HTTPException(status_code=502, detail="Could not reach the map service. Please try again.")
    raise HTTPException(status_code=404, detail="Address not found. Try 'Area, City, State, Pincode' without the building or landmark, or paste coordinates like 11.1085, 77.3411.")


@api.post("/locations/reverse")
async def reverse_geocode(body: ReverseGeocodeIn, user: dict = Depends(require_roles("admin"))):
    import httpx
    try:
        async with httpx.AsyncClient(timeout=10, headers=GEOCODER_HEADERS) as c:
            r = await c.get("https://nominatim.openstreetmap.org/reverse",
                            params={"lat": body.lat, "lon": body.lng, "format": "jsonv2"})
        data = r.json()
    except Exception:
        raise HTTPException(status_code=502, detail="Could not reach the map service. Please try again.")
    if not data or not data.get("display_name"):
        raise HTTPException(status_code=404, detail="No address found for this location")
    return {"address": data["display_name"]}


class SuggestIn(BaseModel):
    query: str


class PlaceDetailsIn(BaseModel):
    place_id: str


GOOGLE_MAPS_KEY = os.environ.get("GOOGLE_MAPS_API_KEY", "")


@api.post("/locations/suggest")
async def suggest_places(body: SuggestIn, user: dict = Depends(require_roles("admin"))):
    import httpx
    q = (body.query or "").strip()
    if len(q) < 3:
        return []
    try:
        async with httpx.AsyncClient(timeout=8, headers=GEOCODER_HEADERS) as c:
            if GOOGLE_MAPS_KEY:
                r = await c.get("https://maps.googleapis.com/maps/api/place/autocomplete/json",
                                params={"input": q, "key": GOOGLE_MAPS_KEY, "components": "country:in"})
                data = r.json()
                if data.get("status") not in ("OK", "ZERO_RESULTS"):
                    logger.error(f"Google autocomplete error: {data.get('status')} {data.get('error_message')}")
                    raise HTTPException(status_code=502, detail=data.get("error_message") or f"Google Maps error: {data.get('status')}")
                return [{"description": p["description"], "place_id": p["place_id"], "lat": None, "lng": None}
                        for p in data.get("predictions", [])[:6]]
            # fallback: free OpenStreetMap search (no key needed)
            r = await c.get("https://nominatim.openstreetmap.org/search",
                            params={"q": q, "format": "jsonv2", "limit": 6, "countrycodes": "in"})
            r.raise_for_status()
            return [{"description": h.get("display_name", ""), "place_id": None,
                     "lat": float(h["lat"]), "lng": float(h["lon"])} for h in r.json()]
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=502, detail="Could not reach the map service. Please try again.")


@api.post("/locations/place-details")
async def place_details(body: PlaceDetailsIn, user: dict = Depends(require_roles("admin"))):
    import httpx
    if not GOOGLE_MAPS_KEY:
        raise HTTPException(status_code=400, detail="Google Maps key is not configured")
    try:
        async with httpx.AsyncClient(timeout=8) as c:
            r = await c.get("https://maps.googleapis.com/maps/api/place/details/json",
                            params={"place_id": body.place_id, "key": GOOGLE_MAPS_KEY,
                                    "fields": "geometry,formatted_address"})
        data = r.json()
    except Exception:
        raise HTTPException(status_code=502, detail="Could not reach the map service. Please try again.")
    res = data.get("result") or {}
    loc = (res.get("geometry") or {}).get("location")
    if data.get("status") != "OK" or not loc:
        raise HTTPException(status_code=404, detail=data.get("error_message") or "Place not found")
    return {"lat": loc["lat"], "lng": loc["lng"], "address": res.get("formatted_address", "")}


@api.put("/locations/{loc_id}/geo")
async def set_location_geo(loc_id: str, body: LocationGeoIn, user: dict = Depends(require_roles("admin"))):
    upd = {"address": (body.address or "").strip(), "lat": body.lat, "lng": body.lng,
           "radius_m": body.radius_m or DEFAULT_OFFICE_RADIUS_M,
           "hub_address": (body.hub_address or "").strip(),
           "hub_lat": body.hub_lat, "hub_lng": body.hub_lng}
    res = await db.locations.update_one({"id": loc_id, "org_id": user["org_id"]}, {"$set": upd})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Location not found")
    return await db.locations.find_one({"id": loc_id, "org_id": user["org_id"]}, {"_id": 0})


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
    urs = await db.users.find({"org_id": user["org_id"]}, {"_id": 0, "employee_id_ref": 1, "role": 1}).to_list(1000)
    role_map = {u.get("employee_id_ref"): u.get("role") for u in urs}
    for e in emps:
        e["role"] = role_map.get(e["id"], "staff")
    return emps


@api.post("/employees")
async def create_employee(body: EmployeeIn, user: dict = Depends(require_roles("admin"))):
    email = body.email.lower().strip() if body.email else ""
    if email:
        existing = await db.users.find_one({"email": email})
        if existing:
            raise HTTPException(status_code=400, detail="Email already exists")
    if body.phone:
        existing_phone = await db.users.find_one({"phone": body.phone})
        if existing_phone:
            raise HTTPException(status_code=400, detail="Phone number already in use")
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
        "shift_id": body.shift_id, "location": body.location, 
        "work_mode": body.work_mode, "status": "Active",
    }
    if not body.password or len(body.password) < 8:
        raise HTTPException(400, "Password (min 8 characters) is required")
    await db.employees.insert_one(emp)
    await db.users.insert_one({
        "id": user_id, "org_id": user["org_id"], "email": email, "phone": body.phone,
        "password_hash": hash_password(body.password),
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
    u = await db.users.find_one({"employee_id_ref": emp_id, "org_id": user["org_id"]}, {"_id": 0, "role": 1})
    emp["role"] = (u or {}).get("role", "staff")
    return emp


@api.put("/employees/{emp_id}")
async def update_employee(emp_id: str, body: EmployeeIn, user: dict = Depends(require_roles("admin"))):
    existing = await db.employees.find_one({"id": emp_id, "org_id": user["org_id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")
    
    email = body.email.lower().strip() if body.email else ""
    upd = body.model_dump(exclude={"password", "role"})
    upd["email"] = email
    
    await db.employees.update_one({"id": emp_id, "org_id": user["org_id"]}, {"$set": upd})
    
    user_upd = {"email": email, "phone": body.phone}
    if body.password:
        user_upd["password_hash"] = hash_password(body.password)
    if "role" in body.model_fields_set and body.role:
        user_upd["role"] = body.role
        
    await db.users.update_one({"employee_id_ref": emp_id, "org_id": user["org_id"]}, {"$set": user_upd})
    return await db.employees.find_one({"id": emp_id, "org_id": user["org_id"]}, {"_id": 0})

@api.delete("/employees/{emp_id}")
async def delete_employee(emp_id: str, user: dict = Depends(require_roles("admin"))):
    existing = await db.employees.find_one({"id": emp_id, "org_id": user["org_id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")
        
    await db.employees.delete_one({"id": emp_id})
    await db.users.delete_one({"employee_id_ref": emp_id})
    await db.attendance.delete_many({"employee_id": emp_id})
    await db.leaves.delete_many({"employee_id": emp_id})
    await db.payroll.delete_many({"employee_id": emp_id})
    
    return {"message": "Staff deleted"}


@api.put("/users/me")
async def update_my_profile(body: UserProfileUpdateIn, user: dict = Depends(get_current_user)):
    updates = {}
    if body.name is not None:
        updates["name"] = body.name
    is_admin = user.get("role") in ("admin", "admin_staff")
    if body.email is not None:
        new_email = body.email.lower().strip()
        if new_email != (user.get("email") or "").lower():
            if await db.users.find_one({"email": new_email, "id": {"$ne": user["id"]}}, {"_id": 1}):
                raise HTTPException(status_code=409, detail="This email is already used by another account")
        updates["email"] = new_email
    if body.password:
        if len(body.password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
        updates["password_hash"] = hash_password(body.password)
        
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
        
    # Update employee details if an employee record exists
    if user.get("employee_id_ref"):
        emp_updates = {}
        if body.name is not None:
            emp_updates["name"] = body.name
        if body.email is not None:
            emp_updates["email"] = updates["email"]
        if body.phone is not None:
            emp_updates["phone"] = body.phone
        if body.department is not None and is_admin:
            emp_updates["department"] = body.department
        if body.designation is not None and is_admin:
            emp_updates["designation"] = body.designation
        if body.location is not None:
            emp_updates["location"] = body.location
        if body.joining_date is not None and user.get("role") in ("admin", "admin_staff"):
            emp_updates["joining_date"] = body.joining_date
        if body.salary_type is not None and is_admin:
            emp_updates["salary_type"] = body.salary_type

        if emp_updates:
            await db.employees.update_one({"id": user["employee_id_ref"]}, {"$set": emp_updates})
            
    return await db.users.find_one({"id": user["id"]}, {"_id": 0, "password": 0, "password_hash": 0})



@api.put("/employees/{emp_id}/salary")
async def set_salary(emp_id: str, body: SalaryIn, user: dict = Depends(require_roles("admin"))):
    existing = await db.employees.find_one({"id": emp_id, "org_id": user["org_id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")
    await db.employees.update_one({"id": emp_id, "org_id": user["org_id"]},
                                  {"$set": {"monthly_salary": body.monthly_salary, "salary_type": body.salary_type}})
    return await db.employees.find_one({"id": emp_id, "org_id": user["org_id"]}, {"_id": 0})


# ---------------- attendance ----------------
MAX_GPS_ACCURACY_M = 200      # reject very weak location fixes
DEFAULT_OFFICE_RADIUS_M = 150
GEOFENCED_WORK_MODES = ("Office",)   # Work from Home / Hybrid staff can check in anywhere


class CheckInIn(BaseModel):
    lat: Optional[float] = None
    lng: Optional[float] = None
    accuracy: Optional[float] = None


def haversine_m(lat1, lng1, lat2, lng2) -> float:
    R = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


@api.post("/attendance/checkin")
async def checkin(body: Optional[CheckInIn] = None, user: dict = Depends(get_current_user)):
    emp = await get_employee_for_user(user)
    if not emp:
        raise HTTPException(status_code=400, detail="No employee profile")
    today = today_str()
    existing = await db.attendance.find_one({"employee_id": emp["id"], "date": today})
    if existing and existing.get("check_in"):
        raise HTTPException(status_code=400, detail="Already checked in")

    # ---- office geofence ----
    geo = {}
    company = await db.companies.find_one({"id": user["org_id"]}, {"_id": 0}) or {}
    targets = []
    if (company.get("geofence_enabled") and (emp.get("work_mode") or "Office") in GEOFENCED_WORK_MODES
            and (emp.get("location") or "").strip().lower() != "remote"):
        city = (emp.get("location") or "").strip()
        if city:
            loc = await db.locations.find_one(
                {"org_id": user["org_id"], "name": {"$regex": f"^{re.escape(city)}$", "$options": "i"}}, {"_id": 0})
            if loc:
                rad = loc.get("radius_m") or DEFAULT_OFFICE_RADIUS_M
                if loc.get("lat") is not None and loc.get("lng") is not None:
                    targets.append({"name": loc["name"], "kind": "office",
                                    "lat": loc["lat"], "lng": loc["lng"], "radius": rad})
                if loc.get("hub_lat") is not None and loc.get("hub_lng") is not None:
                    targets.append({"name": f'{loc["name"]} (Hub)', "kind": "hub",
                                    "lat": loc["hub_lat"], "lng": loc["hub_lng"], "radius": rad})
    if targets:
        if body is None or body.lat is None or body.lng is None:
            raise HTTPException(status_code=400, detail="Location not received. Allow location access in your browser and try again.")
        if body.accuracy is not None and body.accuracy > MAX_GPS_ACCURACY_M:
            raise HTTPException(status_code=400, detail="Your location is not accurate enough. Turn on GPS / Wi-Fi and try again.")
        measured = [(haversine_m(body.lat, body.lng, t["lat"], t["lng"]), t) for t in targets]
        inside = [m for m in measured if m[0] <= m[1]["radius"]]
        if not inside:
            msg = "Mark attendance after reaching office or hub" if len(targets) > 1 else "Mark attendance after reaching office"
            raise HTTPException(status_code=403, detail=msg)
        dist, hit = min(inside, key=lambda m: m[0])
        geo = {"check_in_lat": body.lat, "check_in_lng": body.lng, "check_in_distance_m": round(dist),
               "check_in_office": hit["name"], "check_in_place": hit["kind"]}
        
    shift = await db.shifts.find_one({"id": emp.get("shift_id")}, {"_id": 0}) if emp.get("shift_id") else None
    ci = now_ist().isoformat()
    status = compute_status(ci, shift)
    
    late_checkin = False
    late_count = 0
    if is_week_off(today):
        status = "Present"
    elif status == "Late":
        late_checkin = True
        month_prefix = today[:7]
        prior_late = await db.attendance.count_documents({
            "employee_id": emp["id"], "date": {"$regex": f"^{month_prefix}", "$lt": today},
            "$or": [{"status": "Late"}, {"late_checkin": True}],
        })
        late_count = prior_late + 1
        if late_count > LATE_EXCUSES_PER_MONTH:
            status = "Half Day"

    if existing:
        new_status = status if existing.get("status") in ("Leave", "Week Off") else existing.get("status", status)
        await db.attendance.update_one({"id": existing["id"]}, {"$set": {"check_in": ci, "status": new_status, "late_checkin": late_checkin}})
        doc = await db.attendance.find_one({"id": existing["id"]}, {"_id": 0})
    else:
        doc = {"id": uid(), "org_id": user["org_id"], "employee_id": emp["id"],
               "date": today, "check_in": ci, "check_out": None, "hours": 0, "status": status,
               "late_checkin": late_checkin}
        await db.attendance.insert_one(doc)
        doc.pop("_id", None)
    if geo:
        await db.attendance.update_one({"id": doc["id"]}, {"$set": geo})
        doc.update(geo)
    doc["late_count_month"] = late_count
    doc["late_excuses_left"] = max(0, LATE_EXCUSES_PER_MONTH - late_count) if late_checkin else None

    await log_activity(user["org_id"], f"{emp['name']} checked in")
    return doc


@api.post("/attendance/checkout")
async def checkout(user: dict = Depends(get_current_user)):
    emp = await get_employee_for_user(user)
    if not emp:
        raise HTTPException(status_code=400, detail="No employee profile")
    today = today_str()
    att = await db.attendance.find_one({"employee_id": emp["id"], "date": today})
    if not att or not att.get("check_in"):
        yday = (now_ist() - timedelta(days=1)).date().isoformat()
        prev = await db.attendance.find_one({"employee_id": emp["id"], "date": yday, "check_out": None})
        if prev and prev.get("check_in"):
            att = prev
    if not att or not att.get("check_in"):
        raise HTTPException(status_code=400, detail="Not checked in")
    if att.get("check_out"):
        raise HTTPException(status_code=400, detail="Already checked out")

    shift = await db.shifts.find_one({"id": emp.get("shift_id")}, {"_id": 0}) if emp.get("shift_id") else None
    ci_dt = datetime.fromisoformat(att["check_in"])
    limit = ci_dt + timedelta(hours=shift_auto_hours(shift))
    now = now_ist()
    update = {}
    if now >= limit:  # forgot to checkout earlier -> cap at 10 hrs
        now = limit
        update["auto_checkout"] = True

    co = now.isoformat()
    hrs = hours_between(att["check_in"], co)
    update.update({"check_out": co, "hours": hrs})
    await db.attendance.update_one({"id": att["id"]}, {"$set": update})
    await log_activity(user["org_id"], f"{emp['name']} checked out")
    return await db.attendance.find_one({"id": att["id"]}, {"_id": 0})


async def auto_fix_missing_checkouts(emp_id: Optional[str] = None, org_id: Optional[str] = None):
    """Auto checkout anyone still checked-in once (check-in + shift.auto_checkout_hours) has passed (default 10 hrs)."""
    try:
        now = now_ist()
        query = {"check_out": None, "check_in": {"$ne": None}}
        if emp_id:
            query["employee_id"] = emp_id
        if org_id:
            query["org_id"] = org_id

        records = await db.attendance.find(query).to_list(5000)
        shift_cache: dict = {}
        emp_shift: dict = {}
        for r in records:
            eid = r["employee_id"]
            if eid not in emp_shift:
                emp = await db.employees.find_one({"id": eid}, {"_id": 0, "shift_id": 1})
                emp_shift[eid] = (emp or {}).get("shift_id")
            sid = emp_shift[eid]
            if sid and sid not in shift_cache:
                shift_cache[sid] = await db.shifts.find_one({"id": sid}, {"_id": 0})
            shift = shift_cache.get(sid) if sid else None

            ci_dt = datetime.fromisoformat(r["check_in"])
            co_dt = ci_dt + timedelta(hours=shift_auto_hours(shift))
            if now >= co_dt:
                co = co_dt.isoformat()
                hrs = hours_between(r["check_in"], co)
                await db.attendance.update_one(
                    {"id": r["id"]}, {"$set": {"check_out": co, "hours": hrs, "auto_checkout": True}})
    except Exception as e:
        logging.error(f"Error in auto_fix_missing_checkouts: {e}")


async def auto_checkout_loop():
    """Background job: runs every minute so auto checkout happens even if nobody opens the page."""
    import asyncio
    while True:
        await auto_fix_missing_checkouts()
        await asyncio.sleep(60)


@api.get("/attendance/missed_checkouts")
async def get_missed_checkouts(user: dict = Depends(require_roles("admin", "team_leader"))):
    await auto_fix_missing_checkouts(org_id=user["org_id"])
    records = await db.attendance.find({"org_id": user["org_id"], "auto_checkout": True}).sort("date", -1).to_list(100)
    emp_ids = list({r["employee_id"] for r in records})
    names = {e["id"]: e.get("name") async for e in db.employees.find({"id": {"$in": emp_ids}}, {"_id": 0, "id": 1, "name": 1})}
    for r in records:
        r["employee_name"] = names.get(r["employee_id"]) or "Unknown"
    return records

@api.get("/attendance/me")
async def my_attendance(range: str = "month", month: Optional[str] = None, user: dict = Depends(get_current_user)):
    emp = await get_employee_for_user(user)
    if not emp:
        return {"today": None, "history": []}
    
    await auto_fix_missing_checkouts(emp_id=emp["id"])
    
    today = now_ist().date()
    if range == "today":
        start = today
    elif range == "week":
        start = today - timedelta(days=today.weekday())
    else:
        start = today.replace(day=1)
    date_q = {"$gte": start.isoformat()}
    if month and len(month) == 7:
        date_q = {"$gte": f"{month}-01", "$lte": f"{month}-31"}
    hist = await db.attendance.find(
        {"employee_id": emp["id"], "date": date_q}, {"_id": 0}
    ).sort("date", -1).to_list(100)
    todoc = await db.attendance.find_one({"employee_id": emp["id"], "date": today.isoformat()}, {"_id": 0})
    return {"today": todoc, "history": hist}


@api.get("/attendance")
async def all_attendance(date: Optional[str] = None, department: Optional[str] = None,
                         status: Optional[str] = None, user: dict = Depends(require_roles("admin", "team_leader"))):
    await auto_fix_missing_checkouts(org_id=user["org_id"])
    
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
        elif is_week_off(d):
            st = "Week Off"
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


@api.get("/attendance/employee/{emp_id}")
async def employee_month_attendance(emp_id: str, month: Optional[str] = None,
                                    user: dict = Depends(require_roles("admin", "team_leader"))):
    allowed = {e["id"] for e in await list_employees(user)}
    if emp_id not in allowed:
        raise HTTPException(status_code=403, detail="Not allowed")
    m = month or today_str()[:7]
    try:
        y, mo = int(m[:4]), int(m[5:7])
        first = date(y, mo, 1)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid month")
    nxt = date(y + 1, 1, 1) if mo == 12 else date(y, mo + 1, 1)
    last = nxt - timedelta(days=1)
    today = date.fromisoformat(today_str())
    att = await db.attendance.find({"employee_id": emp_id, "date": {"$gte": first.isoformat(), "$lte": last.isoformat()}}, {"_id": 0}).to_list(100)
    att_map = {a["date"]: a for a in att}
    leaves = await db.leaves.find({"org_id": user["org_id"], "employee_id": emp_id, "status": "Approved",
                                   "from_date": {"$lte": last.isoformat()}, "to_date": {"$gte": first.isoformat()}}, {"_id": 0}).to_list(100)
    days, summary = [], {}
    d = first
    while d <= last:
        ds = d.isoformat()
        a = att_map.get(ds)
        if a:
            st = a.get("status")
        elif any(l.get("from_date", "") <= ds <= l.get("to_date", "") for l in leaves):
            st = "Leave"
        elif d.weekday() == 6:
            st = "Week Off"
        elif d <= today:
            st = "Absent"
        else:
            st = None
        if st:
            summary[st] = summary.get(st, 0) + 1
        days.append({"date": ds, "status": st,
                     "check_in": a.get("check_in") if a else None,
                     "check_out": a.get("check_out") if a else None,
                     "hours": a.get("hours", 0) if a else 0})
        d += timedelta(days=1)
    return {"employee_id": emp_id, "month": m, "days": days, "summary": summary}


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
           "category": body.category,
           "half_day_type": body.half_day_type,
           "permission_hours": body.permission_hours,
           "applied_at": now_utc().isoformat()}
    await db.leaves.insert_one(doc)
    # notify team leader / admins
    if emp.get("team_leader_id"):
        tl_user = await db.users.find_one({"employee_id_ref": emp["team_leader_id"]})
        if tl_user:
            await create_notification(tl_user["id"], "leave", f"{emp['name']} applied for {body.leave_type}")
    admins = await db.users.find({"org_id": user["org_id"], "role": {"$in": ["admin", "admin_staff"]}}).to_list(20)
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


def is_leave_admin(user: dict) -> bool:
    return user["role"] in ("admin", "admin_staff") or user.get("phone") == "9626573939"

def require_leave_admin():
    async def dep(user: dict = Depends(get_current_user)):
        if not is_leave_admin(user) and user["role"] != "team_leader":
            raise HTTPException(status_code=403, detail="Not allowed")
        return user
    return dep

@api.get("/leaves/pending")
async def pending_leaves(user: dict = Depends(require_leave_admin())):
    leaves = await db.leaves.find({"org_id": user["org_id"], "status": "Pending"}, {"_id": 0}).sort("applied_at", -1).to_list(100)
    return leaves

@api.get("/leaves")
async def list_leaves(user: dict = Depends(require_leave_admin())):
    emps = await list_employees(user)
    ids = [e["id"] for e in emps]
    leaves = await db.leaves.find({"employee_id": {"$in": ids}}, {"_id": 0}).sort("applied_at", -1).to_list(300)
    return leaves


@api.get("/leaves/approved")
async def list_approved_leaves(user: dict = Depends(get_current_user)):
    emps = await list_employees(user)
    ids = [e["id"] for e in emps]
    # Return approved leaves for everyone in the org so staff can plan their own leaves
    leaves = await db.leaves.find(
        {"employee_id": {"$in": ids}, "status": "Approved"}, 
        {"_id": 0, "reason": 0} # hide reason for privacy
    ).sort("applied_at", -1).to_list(300)
    return leaves


@api.put("/leaves/{leave_id}/approve")
async def approve_leave(leave_id: str, user: dict = Depends(require_leave_admin())):
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
        cat = leave.get("category")
        if cat == "Half Day":
            await mark_attendance(leave["employee_id"], d.isoformat(), "Half Day", user)
        elif cat == "Permission":
            await mark_attendance(leave["employee_id"], d.isoformat(), "Permission", user)
        else:
            status_to_mark = "Work from Home" if leave["leave_type"] == "Work from Home" else "Leave"
            await mark_attendance(leave["employee_id"], d.isoformat(), status_to_mark, user)
        d += timedelta(days=1)
    emp_user = await db.users.find_one({"employee_id_ref": leave["employee_id"]})
    if emp_user:
        await create_notification(emp_user["id"], "leave", f"Your {leave['leave_type']} was approved")
    await log_activity(user["org_id"], f"Leave approved for {leave['employee_name']}")
    return await db.leaves.find_one({"id": leave_id}, {"_id": 0})


@api.put("/leaves/{leave_id}/reject")
async def reject_leave(leave_id: str, user: dict = Depends(require_leave_admin())):
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
                              
    t = await db.tasks.find_one({"id": task_id, "org_id": user["org_id"]})
    if t and t.get("checklist"):
        done_count = sum(1 for c in t["checklist"] if c.get("done"))
        total = len(t["checklist"])
        new_status = t["status"]
        
        if done_count == total and total > 0:
            new_status = "completed"
        elif done_count > 0 and done_count < total:
            new_status = "in_progress"
        elif done_count == 0 and t["status"] != "todo":
            new_status = "todo"
            
        if new_status != t["status"]:
            await db.tasks.update_one({"id": task_id, "org_id": user["org_id"]}, {"$set": {"status": new_status}})
            t["status"] = new_status
            
    t.pop("_id", None)
    return t


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
        per_day = salary / 30
        att = await db.attendance.find({"employee_id": e["id"], "date": {"$regex": f"^{month}"}}, {"_id": 0}).to_list(200)
        present_days = 0
        overtime_hours = 0
        DAY_VALUE = {"Present": 1, "Late": 1, "Work from Home": 1, "Holiday": 1, "Half Day": 0.5}
        sun_days = 0
        for a in att:
            v = DAY_VALUE.get(a.get("status"), 0)
            if date.fromisoformat(a["date"][:10]).weekday() == 6:
                if a.get("check_in"):
                    sun_days += v
            else:
                present_days += v
            if a.get("hours", 0) > 9:
                overtime_hours += a["hours"] - 9
        # paid approved leaves
        paid_leaves = await db.leaves.find({"employee_id": e["id"], "status": "Approved",
                                       "leave_type": {"$nin": ["Unpaid Leave", "Work from Home"]}, "from_date": {"$regex": f"^{month}"}}, {"_id": 0}).to_list(50)
        paid_leave_days = sum(l["days"] for l in paid_leaves)
        
        payable_days = present_days + paid_leave_days
        lop_days = max(0, wd - payable_days)
        lop = round(per_day * lop_days, 2)
        overtime = 0  # round((per_day / 8) * overtime_hours, 2)  # overtime disabled
        prev = await db.payroll.find_one({"employee_id": e["id"], "month": month}) or {}
        incentive = prev.get("incentive", 0)
        deduction = prev.get("deduction", 0)
        extras = {k: prev.get(k, 0) for k in EXTRA_KEYS}
        extras["extra_duty_days"] = sun_days
        if not prev.get("extra_duty_manual"):
            extras["extra_duty"] = round((salary / 30) * sun_days, 2)  # Sunday duty = salary / 30
        if prev.get("att_manual"):
            wd_m = prev.get("working_days") or wd
            lop_days = max(0, wd_m - max(0, prev.get("present_days", 0) - sun_days))
            lop = round((salary / 30) * lop_days, 2)
            extras.update(att_manual=True, working_days=wd_m, present_days=prev.get("present_days", 0), weekly_off=prev.get("weekly_off", 0))
        net = calc_net(salary, lop, overtime, incentive, deduction, extras)
        existing = await db.payroll.find_one({"employee_id": e["id"], "month": month})
        doc = {"employee_id": e["id"], "employee_name": e["name"],
               "employee_code": e["employee_code"], "org_id": user["org_id"],
               "month": month, "salary": salary, "lop": lop, "lop_days": lop_days,
               "overtime": overtime, "overtime_hours": round(overtime_hours, 1),
               "incentive": incentive, "deduction": deduction, "net": net,
               "working_days": wd, "present_days": present_days, "paid_leave_days": paid_leave_days, **extras, "status": "Draft"}
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


EXTRA_KEYS = ["extra_duty", "pf", "esi", "mess", "advance"]
EMP_KEYS = ["department", "designation", "joining_date", "location", "business_unit",
            "pan_number", "bank_name", "bank_account", "ifsc", "pf_number", "esi_number"]


def calc_net(salary, lop, overtime, incentive, deduction, extras):
    earn = salary + overtime + incentive + extras.get("extra_duty", 0)
    ded = lop + deduction + sum(extras.get(k, 0) for k in ["pf", "esi", "advance"])
    return round(max(0, earn - ded), 2)


class PayrollAdjustIn(BaseModel):
    incentive: Optional[float] = None
    autos: Optional[float] = None
    deduction: Optional[float] = None
    extra_duty: Optional[float] = None
    pf: Optional[float] = None
    esi: Optional[float] = None
    mess: Optional[float] = None
    advance: Optional[float] = None
    leave_balance: Optional[float] = None
    att_manual: Optional[bool] = None
    extra_duty_manual: Optional[bool] = None
    extra_duty_days: Optional[float] = None
    lop: Optional[float] = None
    lop_days: Optional[float] = None
    working_days: Optional[float] = None
    present_days: Optional[float] = None
    weekly_off: Optional[float] = None
    employee: Optional[dict] = None


@api.put("/payroll/{pid}/adjust")
async def adjust_payroll(pid: str, body: PayrollAdjustIn, user: dict = Depends(require_roles("admin"))):
    p = await db.payroll.find_one({"id": pid, "org_id": user["org_id"]}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    upd = {k: v for k, v in body.model_dump().items() if v is not None and k != "employee"}
    mg = {**p, **upd}
    upd["net"] = calc_net(mg["salary"], mg["lop"], 0, mg.get("incentive", 0),
                          mg.get("deduction", 0), {k: mg.get(k, 0) for k in EXTRA_KEYS})
    await db.payroll.update_one({"id": pid, "org_id": user["org_id"]}, {"$set": upd})
    if body.employee:
        eu = {k: str(v) for k, v in body.employee.items() if k in EMP_KEYS}
        if eu:
            await db.employees.update_one({"id": p["employee_id"], "org_id": user["org_id"]}, {"$set": eu})
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
    att = await db.attendance.find({"employee_id": p["employee_id"], "date": {"$regex": f"^{p['month']}"}}, {"_id": 0}).to_list(62)
    DV = {"Present": 1, "Late": 1, "Work from Home": 1, "Holiday": 1, "Half Day": 0.5}
    import calendar as _cal
    _sun = lambda a: date.fromisoformat(a["date"][:10]).weekday() == 6
    p["auto_present_days"] = sum(DV.get(a.get("status"), 0) for a in att if not _sun(a))
    p["auto_extra_duty_days"] = sum(DV.get(a.get("status"), 0) for a in att if _sun(a) and a.get("check_in"))
    p["auto_working_days"] = month_working_days(p["month"])
    p["days_in_month"] = _cal.monthrange(int(p["month"][:4]), int(p["month"][5:7]))[1]
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
    is_admin = user["role"] in ("admin", "team_leader", "admin_staff")
    is_staff = user["role"] in ("staff", "admin_staff")
    
    out = {"role": user["role"]}
    tasks = await list_tasks(user)
    
    if is_admin:
        rows = await all_attendance(date=today, user=user)
        emp_count = len(rows)
        present = len([r for r in rows if r["status"] in ("Present", "Late")])
        late = len([r for r in rows if r["status"] == "Late"])
        on_leave = len([r for r in rows if r["status"] == "Leave"])
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
        out.update({
            "stats": {"employees": emp_count, "present": present, "late": late, "on_leave": on_leave},
            "attendance_today": rows, "task_counts": task_counts, "payroll_total": payroll_total,
            "activities": acts
        })
        
    if is_staff:
        emp = await get_employee_for_user(user)
        todoc = await db.attendance.find_one({"employee_id": emp["id"], "date": today}, {"_id": 0}) if emp else None
        
        if not is_admin:
            task_counts = {
                "todo": len([t for t in tasks if t["status"] == "todo"]),
                "in_progress": len([t for t in tasks if t["status"] == "in_progress"]),
                "completed": len([t for t in tasks if t["status"] == "completed"]),
            }
            out["task_counts"] = task_counts
            
        bal = await db.leave_balances.find_one({"employee_id": emp["id"]}, {"_id": 0}) if emp else None
        available = 0
        if bal:
            available = (bal["casual"] - bal["used_casual"]) + (bal["sick"] - bal["used_sick"])
            
        latest = None
        open_tasks = [t for t in tasks if t["status"] != "completed"]
        if open_tasks:
            latest = open_tasks[0]
            
        out.update({
            "employee": emp, "today": todoc,
            "leave_available": available, "latest_task": latest
        })
        # Check if they are officially on leave today (Approved leaves automatically set todoc status to Leave)
        is_on_leave = False
        if todoc and todoc.get("status") == "Leave":
            is_on_leave = True
            
        out["is_on_leave_today"] = is_on_leave
        
    return out


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
        if user["role"] in ("admin", "admin_staff"):
            return True
        return item.get("team_id") and item.get("team_id") == await my_team_id(user)
    return False


async def process_due_reminders(user: dict):
    now = now_ist()
    items = await db.myspace_items.find({"org_id": user["org_id"], "owner_id": user["id"],
                                         "type": "reminder", "bell_notification_sent": {"$ne": True}}, {"_id": 0}).to_list(200)
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
                await db.myspace_items.update_one({"id": it["id"]}, {"$set": {"reminder_date": nd.isoformat(), "bell_notification_sent": False, "reminder_sent": False}})
            else:
                await db.myspace_items.update_one({"id": it["id"]}, {"$set": {"bell_notification_sent": True}})


from datetime import timedelta

@api.get("/myspace/active_reminders")
async def get_active_reminders(user: dict = Depends(get_current_user)):
    now = now_ist()
    target = now + timedelta(minutes=5)
    items = await db.myspace_items.find({
        "owner_id": user["id"],
        "type": "reminder",
        "status": {"$ne": "completed"},
        "reminder_sent": {"$ne": True}
    }, {"_id": 0}).to_list(100)
    
    due_items = []
    for it in items:
        if not it.get("reminder_date") or not it.get("reminder_time"):
            continue
        try:
            rm_dt = datetime.strptime(f'{it["reminder_date"]} {it["reminder_time"]}', "%Y-%m-%d %H:%M").replace(tzinfo=now.tzinfo)
            snoozed_until = it.get("snoozed_until")
            if snoozed_until:
                sz_dt = datetime.fromisoformat(snoozed_until)
                if now < sz_dt:
                    continue
            if target >= rm_dt:
                due_items.append(it)
        except Exception:
            pass
    return due_items

@api.put("/myspace/{item_id}/snooze")
async def snooze_reminder(item_id: str, user: dict = Depends(get_current_user)):
    now = now_ist()
    sz_dt = now + timedelta(minutes=5)
    await db.myspace_items.update_one({"id": item_id, "owner_id": user["id"]}, {"$set": {"snoozed_until": sz_dt.isoformat()}})
    return {"ok": True}

@api.put("/myspace/{item_id}/dismiss")
async def dismiss_reminder(item_id: str, user: dict = Depends(get_current_user)):
    await db.myspace_items.update_one({"id": item_id, "owner_id": user["id"]}, {"$set": {"reminder_sent": True}})
    return {"ok": True}

@api.get("/myspace")
async def list_myspace(filter: str = "all", q: Optional[str] = None, status: Optional[str] = None, user: dict = Depends(get_current_user)):
    team = await my_team_id(user)
    conds = [{"owner_id": user["id"]}, {"visibility": "company"}]
    if user["role"] in ("admin", "admin_staff"):
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
            "data_url": f.get("data_url") or f"data:{f['content_type']};base64,{f['data']}"}


# ---------------- announcements ----------------
@api.get("/announcements")
async def get_announcements(user: dict = Depends(get_current_user)):
    now = now_ist()
    items = await db.announcements.find({"org_id": user["org_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    active = []
    for item in items:
        if item.get("expires_at") and datetime.fromisoformat(item["expires_at"]).replace(tzinfo=IST) <= now:
            await db.announcements.delete_one({"id": item["id"]})
        else:
            active.append(item)
            
    return active

@api.post("/announcements")
async def create_announcement(body: AnnouncementIn, user: dict = Depends(require_roles("admin", "team_leader"))):
    now = now_ist()
    expires_at = now + timedelta(days=body.duration_days)
    if body.expiry_date:
        try:
            if body.expiry_time:
                expires_at = datetime.fromisoformat(f"{body.expiry_date}T{body.expiry_time}").replace(tzinfo=IST)
            else:
                expires_at = datetime.fromisoformat(f"{body.expiry_date}T23:59:59").replace(tzinfo=IST)
        except:
            pass
            
    doc = {
        "id": uid(),
        "org_id": user["org_id"],
        "title": body.title,
        "type": body.type,
        "message": body.message,
        "link_url": body.link_url,
        "image_data": body.image_data,
        "created_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
        "created_by": user["name"]
    }
    await db.announcements.insert_one(doc)
    doc.pop("_id", None)
    
    # Notify all staff
    users = await db.users.find({"org_id": user["org_id"]}).to_list(None)
    for u in users:
        if u["id"] != user["id"]:
            await create_notification(u["id"], "announcement", f"New Announcement: {body.title}")
            
    return doc

@api.delete("/announcements/{ann_id}")
async def delete_announcement(ann_id: str, user: dict = Depends(require_roles("admin", "team_leader"))):
    res = await db.announcements.delete_one({"id": ann_id, "org_id": user["org_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


# ---------------- notices (admin popup) ----------------

@api.post("/notices")
async def create_notice(body: NoticeIn, user: dict = Depends(require_roles("admin"))):
    now = now_ist()
    expires_at = now + timedelta(hours=body.duration_hours)
    doc = {
        "id": uid(),
        "org_id": user["org_id"],
        "message": body.message,
        "duration_hours": body.duration_hours,
        "from_date": body.from_date,
        "to_date": body.to_date,
        "from_time": body.from_time,
        "to_time": body.to_time,
        "created_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
        "created_by": user["name"]
    }
    await db.notices.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.get("/notices/active")
async def get_active_notices(user: dict = Depends(get_current_user)):
    now = now_ist()
    notices = await db.notices.find(
        {"org_id": user["org_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    active = []
    for n in notices:
        if n.get("expires_at") and datetime.fromisoformat(n["expires_at"]).replace(tzinfo=IST) <= now:
            await db.notices.delete_one({"id": n["id"]})
        else:
            active.append(n)
            
    return active

@api.get("/notices")
async def list_all_notices(user: dict = Depends(require_roles("admin"))):
    now = now_ist()
    notices = await db.notices.find(
        {"org_id": user["org_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    active = []
    for n in notices:
        if n.get("expires_at") and datetime.fromisoformat(n["expires_at"]).replace(tzinfo=IST) <= now:
            await db.notices.delete_one({"id": n["id"]})
        else:
            active.append(n)
            
    return active

@api.delete("/notices/{notice_id}")
async def delete_notice(notice_id: str, user: dict = Depends(require_roles("admin"))):
    res = await db.notices.delete_one({"id": notice_id, "org_id": user["org_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


# ---------------- chat ----------------

class ChatGroupIn(BaseModel):
    name: str
    members: list[str]

@api.post("/chat/groups")
async def create_chat_group(body: ChatGroupIn, user: dict = Depends(require_roles("admin", "admin_staff"))):
    group_id = "grp_" + uid()
    members = body.members
    if user["id"] not in members:
        members.append(user["id"])
        
    doc = {
        "id": group_id,
        "org_id": user["org_id"],
        "name": body.name,
        "created_by": user["id"],
        "members": members,
        "created_at": now_ist().isoformat()
    }
    await db.chat_groups.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.put("/chat/groups/{group_id}")
async def update_chat_group(group_id: str, body: ChatGroupIn, user: dict = Depends(require_roles("admin", "admin_staff"))):
    group = await db.chat_groups.find_one({"id": group_id, "org_id": user["org_id"]})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
        
    members = body.members
    if user["id"] not in members:
        members.append(user["id"])
        
    await db.chat_groups.update_one(
        {"id": group_id},
        {"$set": {"name": body.name, "members": members}}
    )
    return {"ok": True}

@api.delete("/chat/groups/{group_id}")
async def delete_chat_group(group_id: str, user: dict = Depends(require_roles("admin", "admin_staff"))):
    group = await db.chat_groups.find_one({"id": group_id, "org_id": user["org_id"]})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
        
    await db.chat_groups.delete_one({"id": group_id})
    # Also delete all messages in this group
    await db.chats.delete_many({"recipient_id": group_id, "org_id": user["org_id"]})
    return {"ok": True}

@api.get("/chat/groups")
async def get_chat_groups(user: dict = Depends(get_current_user)):
    groups = await db.chat_groups.find({
        "org_id": user["org_id"],
        "members": user["id"]
    }, {"_id": 0}).sort("created_at", -1).to_list(100)
    return groups

@api.get("/chat/messages")
async def get_chat_messages(recipient_id: str, user: dict = Depends(get_current_user)):
    # Legacy fallback: some older messages might not have recipient_id, treat them as group messages if no mentions
    if recipient_id == "group":
        query = {
            "org_id": user["org_id"],
            "deleted_for": {"$ne": user["id"]},
            "$or": [
                {"recipient_id": "group"},
                {"recipient_id": {"$exists": False}, "mentions": {"$size": 0}},
                {"recipient_id": {"$exists": False}, "mentions": user["id"]},
                {"recipient_id": {"$exists": False}, "sender_id": user["id"]}
            ]
        }
    elif recipient_id.startswith("grp_"):
        # Verify user is in group
        group = await db.chat_groups.find_one({"id": recipient_id, "members": user["id"]})
        if not group:
            raise HTTPException(status_code=403, detail="Not in group")
        query = {
            "org_id": user["org_id"],
            "recipient_id": recipient_id,
            "deleted_for": {"$ne": user["id"]}
        }
    else:
        query = {
            "org_id": user["org_id"],
            "deleted_for": {"$ne": user["id"]},
            "$or": [
                {"sender_id": user["id"], "recipient_id": recipient_id},
                {"sender_id": recipient_id, "recipient_id": user["id"]}
            ]
        }
    msgs = await db.chats.find(query).sort("created_at", -1).limit(50).to_list(None)
    msgs.reverse()
    
    # Attach sender details (one query for all senders instead of one per message)
    sender_ids = list({m["sender_id"] for m in msgs})
    senders = {u["id"]: u async for u in db.users.find({"id": {"$in": sender_ids}}, {"_id": 0, "id": 1, "name": 1, "role": 1})}
    for m in msgs:
        m.pop("_id", None)
        sender = senders.get(m["sender_id"])
        if sender:
            m["sender_name"] = sender.get("name", "Unknown")
            m["sender_role"] = sender.get("role", "staff")
        else:
            m["sender_name"] = "Unknown"
            m["sender_role"] = "staff"
    return msgs

@api.post("/chat/messages")
async def send_chat_message(body: ChatMsgIn, user: dict = Depends(get_current_user)):
    if body.recipient_id and body.recipient_id.startswith("grp_"):
        group = await db.chat_groups.find_one({"id": body.recipient_id, "members": user["id"]})
        if not group:
            raise HTTPException(status_code=403, detail="Not in group")

    msg_id = uid()
    doc = {
        "id": msg_id,
        "org_id": user["org_id"],
        "sender_id": user["id"],
        "message": body.message,
        "mentions": body.mentions,
        "recipient_id": body.recipient_id,
        "deleted_for": [],
        "read_by": [user["id"]],
        "created_at": now_ist().isoformat()
    }
    await db.chats.insert_one(doc)
    
    # Create notifications for mentions
    for m_id in body.mentions:
        await create_notification(m_id, "mention", f"{user.get('name', 'Someone')} mentioned you in chat")
        
    return {"status": "ok", "id": msg_id}

@api.delete("/chat/messages/{msg_id}")
async def delete_chat_message(msg_id: str, for_everyone: str = "false", user: dict = Depends(get_current_user)):
    msg = await db.chats.find_one({"id": msg_id, "org_id": user["org_id"]})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if for_everyone == "true" and msg["sender_id"] == user["id"]:
        await db.chats.delete_one({"id": msg_id})
    else:
        await db.chats.update_one({"id": msg_id}, {"$addToSet": {"deleted_for": user["id"]}})
    return {"ok": True}

@api.get("/chat/unread_count")
async def get_unread_chat_count(user: dict = Depends(get_current_user)):
    # Get all groups user is in
    user_groups = await db.chat_groups.find({"members": user["id"]}, {"id": 1}).to_list(100)
    group_ids = [g["id"] for g in user_groups]
    
    query = {
        "org_id": user["org_id"],
        "sender_id": {"$ne": user["id"]},
        "deleted_for": {"$ne": user["id"]},
        "read_by": {"$ne": user["id"]},
        "$or": [
            {"recipient_id": "group"},
            {"recipient_id": user["id"]},
            {"recipient_id": {"$in": group_ids}}
        ]
    }
    count = await db.chats.count_documents(query)
    latest_msg = await db.chats.find_one(query, sort=[("created_at", -1)])
    latest_time = latest_msg["created_at"] if latest_msg else None
    return {"count": count, "latest_time": latest_time}

@api.put("/chat/read/{recipient_id}")
async def mark_chat_read(recipient_id: str, user: dict = Depends(get_current_user)):
    if recipient_id == "group" or recipient_id.startswith("grp_"):
        query = {"org_id": user["org_id"], "recipient_id": recipient_id, "read_by": {"$ne": user["id"]}}
    else:
        query = {"org_id": user["org_id"], "sender_id": recipient_id, "recipient_id": user["id"], "read_by": {"$ne": user["id"]}}
    await db.chats.update_many(query, {"$addToSet": {"read_by": user["id"]}})
    return {"ok": True}

@api.get("/chat/contacts")
async def chat_contacts(user: dict = Depends(get_current_user)):
    org_id = user["org_id"]
    contacts = []
    
    emps = await db.employees.find({"org_id": org_id}, {"_id": 0}).to_list(500)
    
    # Pre-fetch users to get roles
    users = await db.users.find({"org_id": org_id}, {"id": 1, "role": 1, "name": 1, "_id": 0}).to_list(500)
    user_roles = {u["id"]: u["role"] for u in users}
    user_names = {u["id"]: u.get("name", "Admin") for u in users}

    for e in emps:
        uid = e.get("user_id")
        role = user_roles.get(uid, "staff") if uid else "staff"
        contacts.append({
            "id": e["id"],
            "user_id": uid,
            "name": e["name"],
            "photo": e.get("photo"),
            "role": role,
            "designation": e.get("designation")
        })
            
    # Also add admins that might not have an employee record (like the main Admin)
    for u in users:
        if u["role"] in ("admin", "admin_staff") and not any(c.get("user_id") == u["id"] for c in contacts):
            contacts.append({
                "id": u["id"],
                "user_id": u["id"],
                "name": user_names.get(u["id"], "Admin"),
                "photo": None,
                "role": "admin"
            })
            
    return [c for c in contacts if c.get("user_id") != user["id"]]

@api.delete("/chat/clear")
async def clear_chat(recipient_id: Optional[str] = "group", user: dict = Depends(get_current_user)):
    if recipient_id == "group":
        query = {
            "org_id": user["org_id"],
            "$or": [
                {"recipient_id": "group"},
                {"recipient_id": {"$exists": False}}
            ]
        }
    else:
        query = {
            "org_id": user["org_id"],
            "$or": [
                {"sender_id": user["id"], "recipient_id": recipient_id},
                {"sender_id": recipient_id, "recipient_id": user["id"]}
            ]
        }
    await db.chats.update_many(query, {"$addToSet": {"deleted_for": user["id"]}})
    return {"ok": True}

@api.delete("/shifts/{shift_id}")
async def delete_shift(shift_id: str, user: dict = Depends(require_roles("admin"))):
    existing = await db.shifts.find_one({"id": shift_id, "org_id": user["org_id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")
    in_use = await db.employees.count_documents({"org_id": user["org_id"], "shift_id": shift_id})
    if in_use:
        raise HTTPException(status_code=400, detail=f"{in_use} staff are using this shift. Change their shift first.")
    await db.shifts.delete_one({"id": shift_id, "org_id": user["org_id"]})
    return {"ok": True}


# include router
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', 'http://localhost:3000').split(','),
    allow_origin_regex=os.environ.get('CORS_ORIGIN_REGEX', r'https://([a-z0-9-]+\.)?attendy\.in'),
    allow_methods=["*"],
    allow_headers=["*"],
)


from contextlib import asynccontextmanager


INDEXES = {
    "users": [["org_id"], ["email"], ["phone"], ["employee_id_ref"]],
    "employees": [["org_id"], ["user_id"]],
    "attendance": [["employee_id", "date"], ["org_id", "date"], ["check_out"]],
    "leaves": [["org_id", "status"], ["employee_id"]],
    "leave_balances": [["employee_id"]],
    "payroll": [["org_id", "month"], ["employee_id", "month"]],
    "tasks": [["org_id"]],
    "myspace_items": [["org_id"], ["owner_id"]],
    "chats": [["org_id", "recipient_id", "created_at"], ["org_id", "sender_id"]],
    "chat_groups": [["members"]],
    "notifications": [["user_id"]],
    "announcements": [["org_id"]],
    "notices": [["org_id"]],
    "activities": [["org_id"]],
}
for _c in ["users", "employees", "attendance", "tasks", "myspace_items", "myspace_files", "payroll", "shifts",
           "leaves", "leave_balances", "chats", "chat_groups", "notifications", "announcements", "notices",
           "activities", "departments", "designations", "locations", "companies"]:
    INDEXES.setdefault(_c, []).insert(0, ["id"])


async def ensure_indexes():
    """Create MongoDB indexes on startup. Safe to run every time (no-op if they exist)."""
    log = logging.getLogger(__name__)
    ok = failed = 0
    for c, keys in INDEXES.items():
        for k in keys:
            try:
                await db[c].create_index([(f, 1) for f in k])
                ok += 1
            except Exception as e:
                failed += 1
                log.warning(f"index {c}{k} skipped: {e}")
    log.info(f"indexes ensured: {ok} ok, {failed} skipped")


@asynccontextmanager
async def lifespan(app):
    import asyncio
    from seed import seed_all
    await seed_all(db)
    await run_migrations()
    await ensure_indexes()
    app.state.auto_checkout_task = asyncio.create_task(auto_checkout_loop())
    yield
    app.state.auto_checkout_task.cancel()
    client.close()

app.router.lifespan_context = lifespan
