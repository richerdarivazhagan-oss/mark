import asyncio
import os, sys, datetime
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "../env"))
load_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text
from app.core.database import engine

sep_entries = [
    ("2026-09-01", "working", "Day Order III"),
    ("2026-09-02", "working", "Day Order IV"),
    ("2026-09-03", "working", "Day Order V"),
    ("2026-09-04", "holiday", "விடுமுறை"),
    ("2026-09-05", "working", "Day Order IV"),
    ("2026-09-06", "working", "Day Order V"),
    ("2026-09-07", "working", "Day Order VI"),
    ("2026-09-08", "working", "Day Order I"),
    ("2026-09-09", "working", "Day Order II"),
    ("2026-09-10", "working", "Day Order III"),
    ("2026-09-11", "working", "Day Order IV"),
    ("2026-09-12", "working", "Day Order II"),
    ("2026-09-13", "working", "Day Order III"),
    ("2026-09-14", "working", "Day Order IV"),
    ("2026-09-15", "working", "Model Exam Commencement (Day Order V)"),
    ("2026-09-16", "working", "Day Order VI"),
    ("2026-09-17", "working", "Day Order I"),
    ("2026-09-18", "working", "Day Order II"),
    ("2026-09-19", "working", "Day Order III"),
    ("2026-09-20", "working", "Day Order IV"),
    ("2026-09-21", "working", "Day Order I"),
    ("2026-09-22", "working", "Day Order II"),
    ("2026-09-23", "working", "Day Order III"),
    ("2026-09-24", "working", "Day Order IV"),
    ("2026-09-25", "working", "Day Order V"),
    ("2026-09-26", "working", "Day Order IV"),
    ("2026-09-27", "working", "Day Order V"),
    ("2026-09-28", "working", "Day Order VI"),
    ("2026-09-29", "working", "Day Order I"),
    ("2026-09-30", "working", "Day Order II")
]

async def seed_sep():
    async with engine.begin() as conn:
        for dt_str, ev_type, title in sep_entries:
            dt = datetime.date.fromisoformat(dt_str)
            ev_id = f"cal-{dt_str}-{ev_type}"
            sql = text("""
                INSERT INTO calendar_events (id, date, type, title, description)
                VALUES (:id, :date, :type, :title, 'Synced from Monthly Staff Order')
                ON CONFLICT (id) DO UPDATE
                SET title = EXCLUDED.title, type = EXCLUDED.type;
            """)
            await conn.execute(sql, {"id": ev_id, "date": dt, "type": ev_type, "title": title})

    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT count(*) FROM calendar_events WHERE date >= '2026-09-01' AND date <= '2026-09-30';"))
        cnt = res.scalar()
        print(f"SUCCESS! Total September 2026 records in Supabase: {cnt}")

if __name__ == "__main__":
    asyncio.run(seed_sep())
