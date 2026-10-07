import requests
import json

BASE_URL = "http://127.0.0.1:8001/api"

def test_live_auth():
    print("Testing live backend at", BASE_URL)

    # 1. Missing role
    print("\n--- 1. Missing role ---")
    r = requests.post(f"{BASE_URL}/auth/login", json={'username': 'admin1', 'password': 'password123'})
    print(f"Status: {r.status_code}, Detail: {r.json().get('detail')}")
    assert r.status_code == 400
    assert "Role selection is required" in r.json().get('detail', '')

    # 2. Valid Admin + Role Admin (Success)
    print("\n--- 2. Valid Admin + Role Admin (Success) ---")
    r = requests.post(f"{BASE_URL}/auth/login", json={'username': 'admin1', 'password': 'password123', 'role': 'admin'})
    print(f"Status: {r.status_code}, Role: {r.json().get('user', {}).get('role')}")
    assert r.status_code == 200
    assert r.json()['user']['role'] == 'admin'

    # 3. User selects Admin + enters valid Faculty credentials (Mismatch)
    print("\n--- 3. User selects Admin + enters valid Faculty credentials (Mismatch) ---")
    r = requests.post(f"{BASE_URL}/auth/login", json={'username': 'FAC-102', 'password': 'password123', 'role': 'admin'})
    print(f"Status: {r.status_code}, Detail: {r.json().get('detail')}")
    assert r.status_code == 401
    assert r.json().get('detail') == "Invalid role or credentials."

    # 4. User selects Faculty + enters valid Student credentials (Mismatch)
    print("\n--- 4. User selects Faculty + enters valid Student credentials (Mismatch) ---")
    r = requests.post(f"{BASE_URL}/auth/login", json={'username': '2024CS1042', 'password': 'password123', 'role': 'faculty'})
    print(f"Status: {r.status_code}, Detail: {r.json().get('detail')}")
    assert r.status_code == 401
    assert r.json().get('detail') == "Invalid role or credentials."

    # 5. User selects HOD + enters valid Admin credentials (Mismatch)
    print("\n--- 5. User selects HOD + enters valid Admin credentials (Mismatch) ---")
    r = requests.post(f"{BASE_URL}/auth/login", json={'username': 'admin1', 'password': 'password123', 'role': 'hod'})
    print(f"Status: {r.status_code}, Detail: {r.json().get('detail')}")
    assert r.status_code == 401
    assert r.json().get('detail') == "Invalid role or credentials."

    # 6. User selects Student + enters valid HOD credentials (Mismatch)
    print("\n--- 6. User selects Student + enters valid HOD credentials (Mismatch) ---")
    r = requests.post(f"{BASE_URL}/auth/login", json={'username': 'FAC-HOD-01', 'password': 'password123', 'role': 'student'})
    print(f"Status: {r.status_code}, Detail: {r.json().get('detail')}")
    assert r.status_code == 401
    assert r.json().get('detail') == "Invalid role or credentials."

    # 7. Invalid password with any role
    print("\n--- 7. Invalid password ---")
    r = requests.post(f"{BASE_URL}/auth/login", json={'username': 'admin1', 'password': 'wrongpassword', 'role': 'admin'})
    print(f"Status: {r.status_code}, Detail: {r.json().get('detail')}")
    assert r.status_code == 401
    assert r.json().get('detail') == "Invalid role or credentials."

    # 8. Nonexistent user
    print("\n--- 8. Nonexistent user ---")
    r = requests.post(f"{BASE_URL}/auth/login", json={'username': 'nobody_real', 'password': 'anypassword', 'role': 'admin'})
    print(f"Status: {r.status_code}, Detail: {r.json().get('detail')}")
    assert r.status_code == 401
    assert r.json().get('detail') == "Invalid role or credentials."

    # 9. Valid HOD + Role HOD (Success)
    print("\n--- 9. Valid HOD + Role HOD (Success) ---")
    r = requests.post(f"{BASE_URL}/auth/login", json={'username': 'FAC-HOD-01', 'password': 'password123', 'role': 'hod'})
    print(f"Status: {r.status_code}, Role: {r.json().get('user', {}).get('role')}")
    assert r.status_code == 200
    assert r.json()['user']['role'] == 'hod'

    # 10. Valid Faculty + Role Faculty (Success)
    print("\n--- 10. Valid Faculty + Role Faculty (Success) ---")
    r = requests.post(f"{BASE_URL}/auth/login", json={'username': 'FAC-102', 'password': 'password123', 'role': 'faculty'})
    print(f"Status: {r.status_code}, Role: {r.json().get('user', {}).get('role')}")
    assert r.status_code == 200
    assert r.json()['user']['role'] == 'faculty'

    # 11. Valid Student + Role Student (Success)
    print("\n--- 11. Valid Student + Role Student (Success) ---")
    r = requests.post(f"{BASE_URL}/auth/login", json={'username': '2024CS1042', 'password': 'password123', 'role': 'student'})
    print(f"Status: {r.status_code}, Role: {r.json().get('user', {}).get('role')}")
    assert r.status_code == 200
    assert r.json()['user']['role'] == 'student'

    print("\n==========================================")
    print("ALL 11 AUTHENTICATION SCENARIOS PASSED PERFECTLY!")
    print("==========================================")

if __name__ == "__main__":
    test_live_auth()
