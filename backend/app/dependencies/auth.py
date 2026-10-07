from fastapi import Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.security import verify_access_token
from app.core.database import get_db
from app.models import User
from app.core.config import settings


import uuid

async def get_current_user(
    authorization: str = Header(None),
    x_markup_key: str = Header(None, alias="X-Markup-Key"),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")

    if not x_markup_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing X-Markup-Key header")

    token = authorization[7:]
    payload = verify_access_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    from sqlalchemy.orm import joinedload
    result = await db.execute(
        select(User)
        .options(joinedload(User.department), joinedload(User.advising_department))
        .where(User.id == str(user_id))
    )
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    # Validate role-specific API Keys
    role_str = user.role.value if hasattr(user.role, 'value') else str(user.role)
    expected_key = f"MARKUP-{role_str.upper()}-2026"
    valid_keys = {expected_key}
    if role_str == 'hod':
        valid_keys.add("MARKUP-FACULTY-2026")
        valid_keys.add("MARKUP-HOD-2026")

    if not x_markup_key or x_markup_key not in valid_keys:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid X-Markup-Key for this role")

    return user


def require_role(*roles: str):
    async def _check(
        user: User = Depends(get_current_user),
    ) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user
    return _check
