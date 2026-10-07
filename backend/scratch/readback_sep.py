import asyncio
import os, sys
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "../env"))
load_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text
from app.core.database import engine

async def query_all_sep():
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT date, type, title, id FROM calendar_events WHERE date >= '2026-09-01' AND date <= '2026-09-30' ORDER BY date;"))
        rows = res.fetchall()
        print(f"==================================================")
        print(f"SUPABASE DATABASE READ-BACK: {len(rows)} RECORDS FOUND")
        print(f"==================================================")
        for r in rows:
            print(f"Date: {r[0]} | Type: {r[1]:7s} | Title: {r[2]}")

if __name__ == "__main__":
    asyncio.run(query_all_sep())
