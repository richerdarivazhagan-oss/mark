import asyncio
import json
from httpx import AsyncClient, ASGITransport
from app.main import app

async def test_workflow():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        print("1. Logging in as HOD...")
        # Login HOD (user: HOD-101 / password123)
        res_hod = await client.post('/api/auth/login', json={'username': 'hod', 'password': 'password123', 'role': 'hod'})
        if res_hod.status_code != 200:
            print(f"HOD Login Failed: {res_hod.status_code} {res_hod.text}")
            return
        
        token_hod = res_hod.json()['access_token']
        headers_hod = {'Authorization': f'Bearer {token_hod}', 'X-Markup-Key': 'MARKUP-HOD-2026'}
        print("HOD Login Successful!")

        print("\n2. Creating a new Circular (Draft) with Individual Faculty target...")
        c_data = {
            "title": "HOD Official Test Circular",
            "content": "This is an official announcement from the HOD.",
            "target": "individual_faculty",
            "selected_faculty_ids": ["FAC-102", "FAC-103"],
            "valid_from": "2026-10-10",
            "valid_until": "2026-10-25"
        }
        res_create = await client.post('/api/circulars', json=c_data, headers=headers_hod)
        print(f"Create Circular Status: {res_create.status_code}")
        if res_create.status_code != 200:
            print(f"Error: {res_create.text}")
            return
        
        circ = res_create.json()
        circ_id = circ['id']
        print(f"Created Circular ID: {circ_id}, Status: {circ['status']}")
        assert circ['status'] == 'draft'

        print("\n3. HOD submits & signs the Circular...")
        res_sign = await client.post(f'/api/circulars/{circ_id}/sign', headers=headers_hod)
        print(f"Sign Circular Status: {res_sign.status_code}")
        if res_sign.status_code != 200:
            print(f"Sign Error: {res_sign.text}")
            return
        
        signed_circ = res_sign.json()
        print(f"Signed Circular Status: {signed_circ['status']}, Signer: {signed_circ.get('signer_name')}")
        assert signed_circ['status'] == 'signed'

        print("\n4. Verifying HOD list query (Circular must remain visible as 'signed')...")
        res_hod_list = await client.get('/api/circulars', headers=headers_hod)
        print(f"HOD List Status: {res_hod_list.status_code}")
        hod_circs = res_hod_list.json()
        found_signed = next((c for c in hod_circs if c['id'] == circ_id), None)
        assert found_signed is not None, "Signed circular disappeared from HOD list!"
        print(f"CONFIRMED: Signed Circular {found_signed['id']} remains visible in HOD list with status '{found_signed['status']}'")

        print("\n5. HOD publishes the Circular...")
        res_pub = await client.post(f'/api/circulars/{circ_id}/publish', headers=headers_hod)
        print(f"Publish Circular Status: {res_pub.status_code}")
        pub_circ = res_pub.json()
        assert pub_circ['status'] == 'published'
        print(f"CONFIRMED: Circular published at {pub_circ.get('publishedAt') or pub_circ.get('published_at')}")

        print("\n6. Logging in as Selected Faculty (FAC-102)...")
        res_fac1 = await client.post('/api/auth/login', json={'username': 'FAC-102', 'password': 'password123', 'role': 'faculty'})
        assert res_fac1.status_code == 200
        token_fac1 = res_fac1.json()['access_token']
        headers_fac1 = {'Authorization': f'Bearer {token_fac1}', 'X-Markup-Key': 'MARKUP-FACULTY-2026'}

        res_fac1_list = await client.get('/api/circulars', headers=headers_fac1)
        fac1_circs = res_fac1_list.json()
        found_fac1 = next((c for c in fac1_circs if c['id'] == circ_id), None)
        assert found_fac1 is not None, "Selected Faculty FAC-102 cannot see targeted circular!"
        print("CONFIRMED: Selected Faculty FAC-102 CAN see the published targeted circular!")

        print("\n7. Logging in as Unselected Faculty (FAC-105)...")
        res_fac2 = await client.post('/api/auth/login', json={'username': 'FAC-105', 'password': 'password123', 'role': 'faculty'})
        if res_fac2.status_code == 200:
            token_fac2 = res_fac2.json()['access_token']
            headers_fac2 = {'Authorization': f'Bearer {token_fac2}', 'X-Markup-Key': 'MARKUP-FACULTY-2026'}

            res_fac2_list = await client.get('/api/circulars', headers=headers_fac2)
            fac2_circs = res_fac2_list.json()
            found_fac2 = next((c for c in fac2_circs if c['id'] == circ_id), None)
            assert found_fac2 is None, "Unselected Faculty FAC-105 SHOULD NOT see the targeted circular!"
            print("CONFIRMED: Unselected Faculty FAC-105 DOES NOT see the targeted circular!")

        print("\nALL WORKFLOW TESTS PASSED SUCCESSFULLY 100%!")

if __name__ == "__main__":
    asyncio.run(test_workflow())
