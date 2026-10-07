import requests

BASE = 'http://127.0.0.1:8001/api/auth/login'

tests = [
    # (username, password, role, expected_status, expected_detail_or_role)
    ('admin1', 'password123', 'admin', 200, 'admin'),
    ('admin1', 'password123', 'faculty', 401, 'Invalid role or credentials.'),
    ('admin1', 'password123', 'hod', 401, 'Invalid role or credentials.'),
    ('admin1', 'password123', 'student', 401, 'Invalid role or credentials.'),
    ('FAC-102', 'password123', 'faculty', 200, 'faculty'),
    ('FAC-102', 'password123', 'admin', 401, 'Invalid role or credentials.'),
    ('FAC-102', 'password123', 'hod', 401, 'Invalid role or credentials.'),
    ('FAC-102', 'password123', 'student', 401, 'Invalid role or credentials.'),
    ('FAC-HOD-01', 'password123', 'hod', 200, 'hod'),
    ('FAC-HOD-01', 'password123', 'faculty', 401, 'Invalid role or credentials.'),
    ('FAC-HOD-01', 'password123', 'admin', 401, 'Invalid role or credentials.'),
    ('FAC-HOD-01', 'password123', 'student', 401, 'Invalid role or credentials.'),
    ('2024CS1042', 'password123', 'student', 200, 'student'),
    ('2024CS1042', 'password123', 'faculty', 401, 'Invalid role or credentials.'),
    ('2024CS1042', 'password123', 'admin', 401, 'Invalid role or credentials.'),
    ('2024CS1042', 'password123', 'hod', 401, 'Invalid role or credentials.'),
    ('admin1', 'wrongpassword', 'admin', 401, 'Invalid role or credentials.'),
    ('unknownuser', 'anypassword', 'student', 401, 'Invalid role or credentials.'),
]

all_passed = True
for u, p, r, exp_st, exp_val in tests:
    resp = requests.post(BASE, json={'username': u, 'password': p, 'role': r})
    if resp.status_code != exp_st:
        print(f'FAIL: user={u}, role={r} -> got status {resp.status_code}, expected {exp_st}')
        all_passed = False
    elif exp_st == 200:
        actual_role = resp.json()['user']['role']
        if actual_role != exp_val:
            print(f'FAIL: user={u}, role={r} -> got role {actual_role}, expected {exp_val}')
            all_passed = False
        else:
            print(f'PASS [SUCCESS]: user={u}, role={r} -> authenticated as {actual_role}')
    else:
        detail = resp.json().get('detail')
        if detail != exp_val:
            print(f'FAIL: user={u}, role={r} -> got detail {detail}, expected {exp_val}')
            all_passed = False
        else:
            print(f'PASS [REJECTED]: user={u}, role={r} -> rejected with: "{detail}"')

if all_passed:
    print('\n>>> ALL 18 TESTS PASSED WITH 100% SUCCESS! <<<')
else:
    exit(1)
