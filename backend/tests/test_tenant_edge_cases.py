"""Edge cases: super_admin (org_id=None) hitting tenant endpoints, unauth access, signup abuse."""
import pytest
import requests

from conftest import BASE_URL
from test_tenant_isolation import SUPER, client


@pytest.fixture(scope="module")
def sup():
    return client(SUPER["email"], SUPER["password"])


TENANT_GETS = ["/api/company", "/api/employees", "/api/tasks", "/api/departments",
               "/api/designations", "/api/shifts", "/api/dashboard", "/api/notifications",
               "/api/attendance/me", "/api/leaves/me", "/api/payroll/me"]


@pytest.mark.parametrize("path", TENANT_GETS)
def test_super_admin_tenant_endpoints_no_500(sup, path):
    r = sup.get(f"{BASE_URL}{path}", timeout=30)
    assert r.status_code < 500, f"{path} -> {r.status_code} {r.text[:200]}"
    if r.status_code == 200 and isinstance(r.json(), list):
        assert r.json() == [], f"{path} leaked rows to org-less super_admin: {r.text[:200]}"


UNAUTH = [("get", "/api/employees"), ("get", "/api/tasks"), ("get", "/api/dashboard"),
          ("get", "/api/company"), ("get", "/api/platform/companies")]


@pytest.mark.parametrize("method,path", UNAUTH)
def test_unauthenticated_blocked(method, path):
    r = getattr(requests, method)(f"{BASE_URL}{path}", timeout=30)
    assert r.status_code == 401, f"{path} -> {r.status_code}"


def test_no_lockout_after_repeated_failures():
    """Documents absence of brute-force protection (informational)."""
    codes = [requests.post(f"{BASE_URL}/api/auth/login",
                           json={"email": "support@route39.in", "password": f"wrong{i}"},
                           timeout=30).status_code for i in range(6)]
    assert all(c == 401 for c in codes), codes
    ok = requests.post(f"{BASE_URL}/api/auth/login",
                       json={"email": "support@route39.in", "password": "admin123"}, timeout=30)
    assert ok.status_code == 200, "valid login blocked after failed attempts"
    assert 429 not in codes, f"NOTE: rate limiting present ({codes})"
