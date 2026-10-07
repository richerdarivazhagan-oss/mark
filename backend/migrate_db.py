import asyncio
from sqlalchemy import text
from app.core.database import AsyncSessionLocal

async def run_migrations():
    print("Starting database schema migration...")
    async with AsyncSessionLocal() as db:
        queries = [
            "ALTER TABLE circulars ADD COLUMN IF NOT EXISTS target VARCHAR;",
            "ALTER TABLE circulars ADD COLUMN IF NOT EXISTS selected_faculty_ids JSONB DEFAULT '[]'::jsonb;",
            "ALTER TABLE circulars ADD COLUMN IF NOT EXISTS valid_from VARCHAR;",
            "ALTER TABLE circulars ADD COLUMN IF NOT EXISTS valid_until VARCHAR;",
            "ALTER TABLE circulars ADD COLUMN IF NOT EXISTS published_at TIMESTAMP;"
        ]
        for q in queries:
            try:
                await db.execute(text(q))
                print(f"Executed: {q}")
            except Exception as e:
                print(f"Error executing '{q}': {e}")
        await db.commit()
        print("Schema migration completed successfully!")

if __name__ == "__main__":
    asyncio.run(run_migrations())
