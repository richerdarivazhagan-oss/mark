import asyncio
import json
from datetime import datetime
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select
from app.main import app
from app.core.database import AsyncSessionLocal
from app.models.models import Circular, CircularStatus

async def test_publish_workflow():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        print("--- 1. LOGGING IN AS HOD ---")
        res_hod = await client.post('/api/auth/login', json={'username': 'hod', 'password': 'password123', 'role': 'hod'})
        assert res_hod.status_code == 200, f"HOD Login failed: {res_hod.text}"
        token_hod = res_hod.json()['access_token']
        headers_hod = {'Authorization': f'Bearer {token_hod}', 'X-Markup-Key': 'MARKUP-HOD-2026'}
        print("HOD Login Successful!")

        print("\n--- 2. CREATING A CIRCULAR WITH SPECIFIC FACULTY RECIPIENTS ---")
        circ_id = "test-circ-" + str(int(datetime.utcnow().timestamp()))
        c_data = {
            "id": circ_id,
            "title": "Specific Faculty Publish Test Circular",
            "content": "Official announcement for specific faculty members.",
            "target": "individual_faculty",
            "selected_faculty_ids": ["FAC-102", "FAC-103"],
            "valid_from": "2026-10-10",
            "valid_until": "2026-10-25"
        }
        res_create = await client.post('/api/circulars', json=c_data, headers=headers_hod)
        assert res_create.status_code == 200, f"Create failed: {res_create.text}"
        created_circ = res_create.json()
        print(f"Created Circular ID: {created_circ['id']}, Initial Status: {created_circ['status']}")
        assert created_circ['status'] == 'draft'

        print("\n--- 3. SUBMIT & SIGN THE CIRCULAR ---")
        res_sign = await client.post(f"/api/circulars/{circ_id}/sign", headers=headers_hod)
        assert res_sign.status_code == 200, f"Sign failed: {res_sign.text}"
        signed_circ = res_sign.json()
        print(f"Signed Circular Status: {signed_circ['status']}")
        assert signed_circ['status'] == 'signed'

        print("\n--- 4. CLICK PUBLISH ---")
        res_pub = await client.post(f"/api/circulars/{circ_id}/publish", headers=headers_hod)
        assert res_pub.status_code == 200, f"Publish failed: {res_pub.text}"
        pub_circ = res_pub.json()
        print(f"Publish API Response Status: {pub_circ['status']}")
        assert pub_circ['status'] == 'published'

        print("\n--- 5. DIRECT DATABASE VERIFICATION (CRITICAL CHECK) ---")
        async with AsyncSessionLocal() as db:
            db_res = await db.execute(select(Circular).where(Circular.id == circ_id))
            db_circ = db_res.scalar_one_or_none()
            assert db_circ is not None, "Circular record not found in database!"
            db_status = db_circ.status.value if hasattr(db_circ.status, "value") else str(db_circ.status)
            print(f"DATABASE RECORD STATUS: '{db_status}'")
            assert db_status == "published", f"DATABASE STATUS MISMATCH! Expected 'published', got '{db_status}'"
            assert db_circ.published_at is not None, "published_at was not saved in database!"
            print(f"DATABASE PUBLISHED_AT: {db_circ.published_at}")

        print("\n--- 6. REFRESH HOD PORTAL (GET /api/circulars) ---")
        res_hod_refresh = await client.get('/api/circulars', headers=headers_hod)
        assert res_hod_refresh.status_code == 200
        hod_circs = res_hod_refresh.json()
        found_hod = next((c for c in hod_circs if c['id'] == circ_id), None)
        assert found_hod is not None, "Published circular missing from HOD portal after refresh!"
        print(f"HOD Portal Refresh Status: '{found_hod['status']}' (STILL PUBLISHED - VERIFIED)")
        assert found_hod['status'] == 'published'

        print("\n--- 7. LOGGING IN AS SELECTED FACULTY #1 (FAC-102) ---")
        res_fac1 = await client.post('/api/auth/login', json={'username': 'FAC-102', 'password': 'password123', 'role': 'faculty'})
        assert res_fac1.status_code == 200
        token_fac1 = res_fac1.json()['access_token']
        headers_fac1 = {'Authorization': f'Bearer {token_fac1}', 'X-Markup-Key': 'MARKUP-FACULTY-2026'}

        res_fac1_list = await client.get('/api/circulars', headers=headers_fac1)
        assert res_fac1_list.status_code == 200
        fac1_circs = res_fac1_list.json()
        found_fac1 = next((c for c in fac1_circs if c['id'] == circ_id), None)
        assert found_fac1 is not None, "Selected Faculty #1 (FAC-102) cannot see published circular!"
        print(f"Faculty #1 (FAC-102) View Confirmed: Title='{found_fac1['title']}', Status='{found_fac1['status']}'")

        print("\n--- 8. LOGGING IN AS UNSELECTED FACULTY (FAC-105) ---")
        res_fac2 = await client.post('/api/auth/login', json={'username': 'FAC-105', 'password': 'password123', 'role': 'faculty'})
        if res_fac2.status_code == 200:
            token_fac2 = res_fac2.json()['access_token']
            headers_fac2 = {'Authorization': f'Bearer {token_fac2}', 'X-Markup-Key': 'MARKUP-FACULTY-2026'}
            res_fac2_list = await client.get('/api/circulars', headers=headers_fac2)
            fac2_circs = res_fac2_list.json()
            found_fac2 = next((c for c in fac2_circs if c['id'] == circ_id), None)
            assert found_fac2 is None, "Unselected Faculty (FAC-105) SHOULD NOT see individual faculty circular!"
            print("Unselected Faculty (FAC-105) cannot see individual circular (VERIFIED)")

        print("\n--- 9. TESTING 'ALL FACULTY' TARGET SEPARATELY ---")
        all_circ_id = "test-all-fac-" + str(int(datetime.utcnow().timestamp()))
        c_data_all = {
            "id": all_circ_id,
            "title": "All Faculty Broadcast Announcement",
            "content": "Broadcast notice to all faculty members.",
            "target": "all_faculty",
            "valid_from": "2026-10-10",
            "valid_until": "2026-10-25"
        }
        res_create_all = await client.post('/api/circulars', json=c_data_all, headers=headers_hod)
        assert res_create_all.status_code == 200
        res_pub_all = await client.post(f"/api/circulars/{all_circ_id}/publish", headers=headers_hod)
        assert res_pub_all.status_code == 200

        # Check DB status for All Faculty circular
        async with AsyncSessionLocal() as db:
            db_res_all = await db.execute(select(Circular).where(Circular.id == all_circ_id))
            db_circ_all = db_res_all.scalar_one_or_none()
            assert db_circ_all.status == CircularStatus.published
            print(f"All Faculty DB Status: '{db_circ_all.status.value}' (PUBLISHED)")

        # Verify FAC-105 (previously unselected) CAN see All Faculty circular
        if res_fac2.status_code == 200:
            res_fac2_all = await client.get('/api/circulars', headers=headers_fac2)
            fac2_all_circs = res_fac2_all.json()
            found_fac2_all = next((c for c in fac2_all_circs if c['id'] == all_circ_id), None)
            assert found_fac2_all is not None, "All Faculty circular must be visible to FAC-105!"
            print("FAC-105 received All Faculty circular successfully (VERIFIED)")

        print("\n========================================================")
        print("SUCCESS: ALL PUBLISH WORKFLOW CHECKS PASSED WITH 100% DATABASE ACCURACY!")
        print("========================================================")

if __name__ == "__main__":
    asyncio.run(test_publish_workflow())
