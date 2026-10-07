import asyncio
import os, sys
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "../env"))
load_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text
from app.core.database import engine

async def test_full_circular_flow():
    async with engine.connect() as conn:
        dept_res = await conn.execute(text("SELECT id FROM departments WHERE code = 'CSE' LIMIT 1;"))
        dept_id = dept_res.scalar()

    async with engine.begin() as conn:
        print("--- 1. HOD CREATES & PUBLISHES CIRCULAR FOR FACULTY + STUDENTS ---")
        sql = text("""
            INSERT INTO circulars (
                id, title, content, status, target_role, department_id,
                publisher_name, published_at, recipient_count, created_at, updated_at
            ) VALUES (
                :id, :title, :content, 'published', :target_role, :department_id,
                'Dr. HOD', NOW(), 42, NOW(), NOW()
            ) ON CONFLICT (id) DO UPDATE SET
                title = EXCLUDED.title, content = EXCLUDED.content, status = 'published', published_at = NOW();
        """)
        # target_role: 'faculty' for Faculty circular
        await conn.execute(sql, {
            "id": "circ-hod-fac-01",
            "title": "HOD Notice for All CSE Faculty",
            "content": "All faculty members are requested to attend the department meeting on Monday.",
            "target_role": "faculty",
            "department_id": dept_id
        })
        # target_role: 'student' for Student circular
        await conn.execute(sql, {
            "id": "circ-hod-std-01",
            "title": "HOD Notice for All CSE Students",
            "content": "Mid-semester examination guidelines and room assignments are published.",
            "target_role": "student",
            "department_id": dept_id
        })
        print("Inserted HOD circulars successfully!")

    async with engine.connect() as conn:
        print("\n--- 2. FACULTY PORTAL READ-BACK ---")
        fac_res = await conn.execute(text("""
            SELECT id, title, status, target_role, department_id
            FROM circulars
            WHERE status = 'published' AND (target_role = 'faculty' OR target_role IS NULL);
        """))
        fac_rows = fac_res.fetchall()
        print(f"Faculty sees {len(fac_rows)} published circulars:")
        for r in fac_rows:
            print(" ", dict(r._mapping))

        print("\n--- 3. STUDENT PORTAL READ-BACK ---")
        std_res = await conn.execute(text("""
            SELECT id, title, status, target_role, department_id
            FROM circulars
            WHERE status = 'published' AND (target_role = 'student' OR target_role IS NULL);
        """))
        std_rows = std_res.fetchall()
        print(f"Students see {len(std_rows)} published circulars:")
        for r in std_rows:
            print(" ", dict(r._mapping))

if __name__ == "__main__":
    asyncio.run(test_full_circular_flow())
