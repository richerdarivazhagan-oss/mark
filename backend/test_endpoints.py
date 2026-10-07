import asyncio
import json
from httpx import AsyncClient, ASGITransport
from app.main import app

async def main():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Login Admin
        resp = await client.post('/api/auth/login', json={'username':'admin1','password':'password123','role':'admin'})
        print(f'Admin Login: {resp.status_code}')
        if resp.status_code != 200:
            print(f'Login error: {resp.text}')
            return

        token = resp.json()['access_token']
        headers = {
            'Authorization': f'Bearer {token}',
            'X-Markup-Key': 'MARKUP-ADMIN-2026'
        }

        # Test /me
        resp2 = await client.get('/api/auth/me', headers=headers)
        print(f'/me: {resp2.status_code}')
        if resp2.status_code != 200:
            print(f'Error: {json.dumps(resp2.json(), indent=2)[:500]}')
        else:
            data = resp2.json()
            print(f'User: {data["name"]} ({data["role"]})')

        # Test /admin/students
        resp3 = await client.get('/api/admin/students', headers=headers)
        print(f'/admin/students: {resp3.status_code}')
        if resp3.status_code == 200:
            students = resp3.json()
            print(f'Students count: {len(students)}')
            if students:
                s = students[0]
                print(f'First: {s["name"]} ({s.get("reg_no", "")})')
        else:
            print(f'Error: {json.dumps(resp3.json(), indent=2)[:500]}')

        # Test /admin/departments
        resp4 = await client.get('/api/admin/departments', headers=headers)
        print(f'/admin/departments: {resp4.status_code}')
        if resp4.status_code == 200:
            depts = resp4.json()
            print(f'Departments: {len(depts)}')
            for d in depts:
                print(f'  {d.get("code")} - {d.get("name")} - Students: {d.get("student_count")}')
        else:
            print(f'Error: {json.dumps(resp4.json(), indent=2)[:500]}')

        # Faculty Login
        resp5 = await client.post('/api/auth/login', json={'username':'FAC-102','password':'password123','role':'faculty'})
        print(f'\nFaculty Login: {resp5.status_code}')
        if resp5.status_code == 200:
            fac_token = resp5.json()['access_token']
            fac_headers = {
                'Authorization': f'Bearer {fac_token}',
                'X-Markup-Key': 'MARKUP-FACULTY-2026'
            }

            resp6 = await client.get('/api/faculty/active-periods', headers=fac_headers)
            print(f'/faculty/active-periods: {resp6.status_code}')
            if resp6.status_code != 200:
                print(f'Error: {json.dumps(resp6.json(), indent=2)[:500]}')

            # Test /faculty/dashboard
            resp7 = await client.get('/api/faculty/dashboard', headers=fac_headers)
            print(f'/faculty/dashboard: {resp7.status_code}')

            # Test /faculty/students/search
            resp8 = await client.get('/api/faculty/students/search', headers=fac_headers)
            print(f'/faculty/students/search: {resp8.status_code}')
            if resp8.status_code == 200:
                results = resp8.json()
                print(f'Students found: {len(results)}')
            # Test /api/circulars
            resp9 = await client.get('/api/circulars', headers=fac_headers)
            print(f'/api/circulars: {resp9.status_code}')
            if resp9.status_code == 200:
                circulars = resp9.json()
                print(f'Circulars count: {len(circulars)}')

if __name__ == '__main__':
    asyncio.run(main())
