import os
import re
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")


def _creds():
    p = Path("/app/memory/test_credentials.md")
    txt = p.read_text(encoding="utf-8") if p.exists() else ""
    pairs = re.findall(r"Email:\s*([^\s]+)\s*\n-\s*Password:\s*([^\s]+)", txt)
    if len(pairs) < 3:
        # newer format: "- Admin (owner): support@route39.in / admin123"
        pairs = re.findall(r"^-\s*[^:]*:\s*([^\s@]+@[^\s]+)\s*/\s*(\S+)", txt, re.MULTILINE)
    return pairs


CRED_PAIRS = _creds()


@pytest.fixture(scope="session")
def credentials():
    if len(CRED_PAIRS) < 3:
        pytest.skip("credentials file missing entries")
    return {
        "admin": {"email": CRED_PAIRS[0][0], "password": CRED_PAIRS[0][1]},
        "team_leader": {"email": CRED_PAIRS[1][0], "password": CRED_PAIRS[1][1]},
        "staff": {"email": CRED_PAIRS[2][0], "password": CRED_PAIRS[2][1]},
    }


def _client(email, password):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"login failed for {email}: {r.status_code} {r.text[:300]}")
    tok = r.json().get("token")
    if not tok:
        pytest.fail("no token in login response")
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="session")
def admin(credentials):
    return _client(credentials["admin"]["email"], credentials["admin"]["password"])


@pytest.fixture(scope="session")
def leader(credentials):
    return _client(credentials["team_leader"]["email"], credentials["team_leader"]["password"])


@pytest.fixture(scope="session")
def staff(credentials):
    return _client(credentials["staff"]["email"], credentials["staff"]["password"])


@pytest.fixture(scope="session")
def anon():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s
