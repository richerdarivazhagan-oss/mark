import asyncio
import os, sys
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "../env"))
load_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text
from app.core.database import engine

async def query_events():
    async with engine.connect() as conn:
        print("--- CALENDAR_EVENTS COLUMNS ---")
        res_cols = await conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='calendar_events';"))
        for c in res_cols.fetchall():
            print(f"  {c[0]}: {c[1]}")

        print("\n--- CALENDAR_EVENTS ROWS ---")
        res = await conn.execute(text("SELECT * FROM calendar_events ORDER BY date;"))
        rows = res.fetchall()
        print(f"Total calendar_events: {len(rows)}")
        for r in rows:
            print(dict(r._mapping))

if __name__ == "__main__":
    asyncio.run(query_events())
