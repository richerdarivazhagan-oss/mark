import asyncio
import os, sys
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "../env"))
load_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text
from app.core.database import engine

async def check_constraints():
    async with engine.connect() as conn:
        print("--- CONSTRAINTS ON CALENDAR_EVENTS ---")
        res = await conn.execute(text("""
            SELECT conname, pg_get_constraintdef(c.oid)
            FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
            WHERE conrelid = 'calendar_events'::regclass;
        """))
        for r in res.fetchall():
            print(f"Constraint: {r[0]} -> {r[1]}")

        print("\n--- INDEXES ON CALENDAR_EVENTS ---")
        res_idx = await conn.execute(text("""
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE tablename = 'calendar_events';
        """))
        for r in res_idx.fetchall():
            print(f"Index: {r[0]} -> {r[1]}")

if __name__ == "__main__":
    asyncio.run(check_constraints())
