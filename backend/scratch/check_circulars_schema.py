import asyncio
import os, sys
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "../env"))
load_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text
from app.core.database import engine

async def check_schema():
    async with engine.connect() as conn:
        print("--- CIRCULARS TABLE COLUMNS ---")
        res = await conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='circulars' ORDER BY ordinal_position;"))
        for r in res.fetchall():
            print(f"  {r[0]}: {r[1]}")

        print("\n--- CIRCULARS TABLE ROWS ---")
        res_rows = await conn.execute(text("SELECT * FROM circulars;"))
        rows = res_rows.fetchall()
        print(f"Total circulars: {len(rows)}")
        for r in rows:
            print(dict(r._mapping))

if __name__ == "__main__":
    asyncio.run(check_schema())
