import asyncio
import os, sys
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "../env"))
load_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text
from app.core.database import engine

async def test_circular_crud():
    async with engine.connect() as conn:
        dept_res = await conn.execute(text("SELECT id FROM departments WHERE code = 'CSE' LIMIT 1;"))
        dept_id = dept_res.scalar()
        print("Using CSE Department ID:", dept_id)

    async with engine.begin() as conn:
        print("--- INSERTING TEST HOD CIRCULAR ---")
        sql = text("""
            INSERT INTO circulars (
                id, title, content, status, target_role, department_id,
                attachment_url, attachment_name, author_id, recipient_count, created_at, updated_at
            ) VALUES (
                :id, :title, :content, :status, :target_role, :department_id,
                :attachment_url, :attachment_name, :author_id, :recipient_count, NOW(), NOW()
            ) ON CONFLICT (id) DO UPDATE SET
                title = EXCLUDED.title, content = EXCLUDED.content, status = EXCLUDED.status, target_role = EXCLUDED.target_role;
        """)
        await conn.execute(sql, {
            "id": "circ-test-hod-01",
            "title": "Test HOD Circular for Faculty & Students",
            "content": "Official announcement regarding upcoming academic schedule and exams.",
            "status": "published",
            "target_role": None,  # None = visible to both Faculty and Students
            "department_id": dept_id,
            "attachment_url": None,
            "attachment_name": None,
            "author_id": None,
            "recipient_count": 15
        })
        print("Inserted test circular successfully!")

    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT id, title, content, status, target_role, department_id FROM circulars WHERE id = 'circ-test-hod-01';"))
        row = res.fetchone()
        print("Readback result:", dict(row._mapping) if row else "None")

if __name__ == "__main__":
    asyncio.run(test_circular_crud())
