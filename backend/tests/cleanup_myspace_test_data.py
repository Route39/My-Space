"""Delete My Space items created by UI/API tests (titles starting with TEST_)."""
import os
import requests
from dotenv import dotenv_values

BASE = (os.environ.get("REACT_APP_BACKEND_URL") or dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"]).rstrip("/")
USERS = [("support@route39.in", "admin123"), ("arjun.mehta@attendy.app", "password123"),
         ("dhanusha.r@attendy.app", "password123"), ("demo@attendy.app", "demo123")]

for email, pwd in USERS:
    s = requests.Session()
    r = s.post(f"{BASE}/api/auth/login", json={"email": email, "password": pwd}, timeout=30)
    if r.status_code != 200:
        print("login failed", email, r.status_code)
        continue
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    items = s.get(f"{BASE}/api/myspace", timeout=30).json()
    for it in items:
        if str(it.get("title", "")).startswith("TEST_"):
            d = s.delete(f"{BASE}/api/myspace/{it['id']}", timeout=30)
            print(email, it["title"], d.status_code)
