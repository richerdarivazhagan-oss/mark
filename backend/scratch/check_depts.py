import asyncio
import os, sys
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "../env"))
load_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text
from app.core.database import engine

async def check_depts():
    async with engine.connect() as conn:
        print("--- DEPARTMENTS TABLE ---")
        res = await conn.execute(text("SELECT id, name, code FROM departments;"))
        rows = res.fetchall()
        for r in rows:
            print(dict(r._mapping))

if __name__ == "__main__":
    asyncio.run(check_depts())
