import ssl

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

if not settings.SUPABASE_DB_URL.startswith("postgresql+asyncpg://"):
    raise RuntimeError("SUPABASE_DB_URL must use the PostgreSQL asyncpg Supabase connection URL")

# SSL context — Supabase pooler requires SSL but no hostname verification
_ssl_ctx = ssl.create_default_context()
_ssl_ctx.check_hostname = False
_ssl_ctx.verify_mode = ssl.CERT_NONE

_engine_kwargs = {
    "pool_size": 30,        # keep 30 warm connections ready
    "max_overflow": 20,     # allow burst to 50 total
    "pool_recycle": 300,    # recycle connections every 5 minutes
    "pool_timeout": 30,     # 30-second timeout for pool checkout
    "connect_args": {
        "ssl": _ssl_ctx,
        "timeout": 15,              # connection handshake timeout
        "command_timeout": 45,      # per-statement timeout
        "statement_cache_size": 0,  # required for pgbouncer transaction-mode pooler
    },
}

engine = create_async_engine(
    settings.SUPABASE_DB_URL,
    echo=False,
    **_engine_kwargs,
)

AsyncSessionLocal = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)

Base = declarative_base()


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            try:
                await session.rollback()
            except Exception:
                pass
            raise
        finally:
            try:
                await session.close()
            except Exception:
                pass
