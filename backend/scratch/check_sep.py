import asyncio
import os, sys
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "../env"))
load_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text
from app.core.database import engine

async def query_sep_events():
    async with engine.connect() as conn:
        print("--- SEPTEMBER 2026 CALENDAR_EVENTS ---")
        res = await conn.execute(text("SELECT id, date, type, title, description FROM calendar_events WHERE date >= '2026-09-01' AND date <= '2026-09-30' ORDER BY date;"))
        rows = res.fetchall()
        print(f"Total September 2026 calendar_events: {len(rows)}")
        for r in rows:
            print(f"Date: {r[1]} | Type: {r[2]} | Title: {r[3]} | ID: {r[0]}")

if __name__ == "__main__":
    asyncio.run(query_sep_events())
