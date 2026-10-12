import os, sys
from dotenv import load_dotenv
from pymongo import MongoClient
load_dotenv(".env")
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
DRY = "--apply" not in sys.argv
print("DB:", os.environ["DB_NAME"], "| DRY" if DRY else "| APPLY")
for oid in db.shifts.distinct("org_id"):
    sh = sorted(db.shifts.find({"org_id": oid}), key=lambda s: s["name"] == "Permission Shift 2")
    keep = {}
    for s in sh:
        name = "Permission Shift" if s["name"] == "Permission Shift 2" else s["name"]
        if name not in keep:
            keep[name] = s
            continue
        k = keep[name]
        print(f"[{oid[:8]}] remove '{s['name']}' -> '{k['name']}'")
        if not DRY:
            for c in ("employees", "attendance"):
                db[c].update_many({"org_id": oid, "shift_id": s["id"]}, {"$set": {"shift_id": k["id"]}})
            db.shifts.delete_one({"_id": s["_id"]})
    if "Evening Shift" in keep:
        print(f"[{oid[:8]}] rename Evening -> Second Shift")
        if not DRY:
            db.shifts.update_one({"_id": keep["Evening Shift"]["_id"]}, {"$set": {"name": "Second Shift"}})
if not DRY:
    db.shifts.create_index([("org_id", 1), ("name", 1)], unique=True)
    print("Unique index created")
