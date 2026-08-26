"""Remove QA-created tenant orgs (slug prefix test-qa-/testqa-) and stray TEST_ data."""
import asyncio
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

COLLECTIONS = ["employees", "users", "departments", "designations", "shifts", "attendance",
               "leaves", "leave_balances", "tasks", "payroll", "activities", "notifications"]


async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    orgs = await db.companies.find({"slug": {"$regex": "^(test-qa-|testqa-)"}}, {"_id": 0}).to_list(100)
    for o in orgs:
        for c in COLLECTIONS:
            await db[c].delete_many({"org_id": o["id"]})
        await db.companies.delete_one({"id": o["id"]})
        print(f"removed QA org {o['slug']} ({o['name']})")
    r = await db.users.delete_many({"email": {"$regex": "@testqa.local$"}})
    print(f"removed {r.deleted_count} stray testqa.local users")
    r = await db.tasks.delete_many({"title": {"$regex": "^TEST"}})
    print(f"removed {r.deleted_count} TEST tasks")
    emps = await db.employees.find({"name": {"$regex": "^TEST"}}, {"_id": 0}).to_list(50)
    for e in emps:
        await db.users.delete_many({"employee_id_ref": e["id"]})
        await db.attendance.delete_many({"employee_id": e["id"]})
        await db.leave_balances.delete_many({"employee_id": e["id"]})
        await db.payroll.delete_many({"employee_id": e["id"]})
    await db.employees.delete_many({"id": {"$in": [e["id"] for e in emps]}})
    print(f"removed {len(emps)} TEST employees")
    r = await db.leaves.delete_many({"reason": {"$regex": "QA|TEST"}})
    print(f"removed {r.deleted_count} QA leaves")
    for c in await db.companies.find({}, {"_id": 0, "slug": 1, "active": 1, "name": 1}).to_list(100):
        print("company:", c)
    client.close()


asyncio.run(main())
