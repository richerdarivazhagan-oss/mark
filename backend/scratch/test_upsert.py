import asyncio
import os, sys
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "../env"))
load_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text
from app.core.database import engine

async def test_upsert():
    async with engine.begin() as conn:
        print("--- TESTING UPSERT FOR 2026-09-01 & 2026-09-04 ---")
        sql = text("""
            INSERT INTO calendar_events (id, date, type, title, description)
            VALUES 
                ('cal-2026-09-01-working', '2026-09-01', 'working', 'Day Order III', 'Synced from Monthly Staff Order'),
                ('cal-2026-09-04-holiday', '2026-09-04', 'holiday', 'விடுமுறை', 'Synced from Monthly Staff Order')
            ON CONFLICT (id) DO UPDATE 
            SET title = EXCLUDED.title, description = EXCLUDED.description;
        """)
        await conn.execute(sql)
        print("Upsert executed cleanly!")

    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT id, date, type, title, description FROM calendar_events WHERE date IN ('2026-09-01', '2026-09-04');"))
        for r in res.fetchall():
            print("Query result:", dict(r._mapping))

if __name__ == "__main__":
    asyncio.run(test_upsert())
