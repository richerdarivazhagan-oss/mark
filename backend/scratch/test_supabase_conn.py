import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import asyncio
from sqlalchemy import text
from app.core.database import engine

async def check_counts():
    async with engine.connect() as conn:
        tables_res = await conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;"))
        tables = [r[0] for r in tables_res.fetchall()]
        print("=== SUPABASE TABLE ROW COUNTS ===")
        for t in tables:
            try:
                cnt = (await conn.execute(text(f'SELECT COUNT(*) FROM "{t}";'))).scalar()
                print(f"{t:30s}: {cnt} rows")
            except Exception as e:
                print(f"{t:30s}: Error ({e})")

if __name__ == "__main__":
    asyncio.run(check_counts())
