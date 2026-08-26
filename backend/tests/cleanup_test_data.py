"""One-off cleanup of QA test data created during UI/API testing."""
import asyncio
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    emps = await db.employees.find({"name": {"$regex": "^TEST "}}, {"_id": 0}).to_list(50)
    ids = [e["id"] for e in emps]
    for e in emps:
        await db.users.delete_many({"employee_id_ref": e["id"]})
        await db.attendance.delete_many({"employee_id": e["id"]})
        await db.leave_balances.delete_many({"employee_id": e["id"]})
        await db.payroll.delete_many({"employee_id": e["id"]})
    await db.employees.delete_many({"id": {"$in": ids}})
    print(f"removed {len(ids)} TEST employees")

    r = await db.tasks.delete_many({"title": {"$regex": "^TEST "}})
    print(f"removed {r.deleted_count} TEST tasks")

    r = await db.leaves.delete_many({"reason": {"$regex": "QA"}})
    print(f"removed {r.deleted_count} QA leave rows")

    await db.employees.update_one({"employee_code": "EMP1003"}, {"$set": {"monthly_salary": 42000}})
    print("restored EMP1003 salary to 42000")
    client.close()


asyncio.run(main())
