import requests

BASE_URL = "http://localhost:8002/api"

def test():
    # 1. Login as admin
    print("Testing Login...")
    res = requests.post(f"{BASE_URL}/auth/login", json={"username": "admin@route39.in", "password": "Route@39"})
    if res.status_code != 200:
        print("Login failed:", res.status_code, res.text)
        return
    token = res.json().get("token")
    headers = {"Authorization": f"Bearer {token}"}
    print("Login OK")

    # 2. Test Locations API
    print("Testing GET /locations...")
    res = requests.get(f"{BASE_URL}/locations", headers=headers)
    print("GET locations:", res.status_code, res.text[:100])
    
    print("Testing POST /locations...")
    res = requests.post(f"{BASE_URL}/locations", json={"name": "TestLoc"}, headers=headers)
    print("POST locations:", res.status_code, res.text[:100])
    if res.status_code == 200:
        loc_id = res.json().get("id")
        print("Testing DELETE /locations...")
        res = requests.delete(f"{BASE_URL}/locations/{loc_id}", headers=headers)
        print("DELETE locations:", res.status_code, res.text[:100])

    # 3. Test Employee API
    print("Testing POST /employees...")
    emp_data = {
        "name": "Check User", "phone": "9998887776", "password": "",
        "department": "", "designation": "", "monthly_salary": 0,
        "shift_id": "", "location": "Bengaluru", "role": "staff", "work_mode": "Office"
    }
    res = requests.post(f"{BASE_URL}/employees", json=emp_data, headers=headers)
    print("POST employees:", res.status_code, res.text[:100])
    
    if res.status_code == 200:
        emp_id = res.json().get("id")
        
        print("Testing PUT /employees...")
        update_data = {
            "name": "Check User Updated", "phone": "9998887776", "password": "",
            "department": "", "designation": "", "monthly_salary": 1000,
            "shift_id": "", "location": "Tirupur", "role": "staff", "work_mode": "Hybrid"
        }
        res = requests.put(f"{BASE_URL}/employees/{emp_id}", json=update_data, headers=headers)
        print("PUT employees:", res.status_code, res.text[:100])
        
        print("Testing DELETE /employees...")
        res = requests.delete(f"{BASE_URL}/employees/{emp_id}", headers=headers)
        print("DELETE employees:", res.status_code, res.text[:100])
        
        # Try logging in as the deleted user
        res = requests.post(f"{BASE_URL}/auth/login", json={"username": "9998887776", "password": "password123"})
        print("Login deleted user:", res.status_code, res.text[:100])

test()
