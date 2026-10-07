from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password
from app.models import User, UserRole
from app.schemas import LoginResponse, UserRead


def _format_user(user: User) -> UserRead:
    dept_name = None
    if user.department:
        dept_name = user.department.name
    advising_dept_name = None
    if getattr(user, 'advising_department', None):
        advising_dept_name = user.advising_department.name
    effective_role = UserRole.hod if (getattr(user, 'is_hod', False) and user.role != UserRole.admin) else user.role
    return UserRead(
        id=str(user.id),
        username=user.username,
        name=user.name,
        email=user.email,
        avatar=user.avatar,
        role=effective_role,
        department_id=str(user.department_id) if user.department_id else None,
        department_name=dept_name,
        reg_no=user.reg_no,
        employee_id=user.employee_id,
        phone=user.phone,
        address=user.address,
        gender=user.gender,
        dob=user.dob.isoformat() if user.dob else None,
        father_name=user.father_name,
        mother_name=user.mother_name,
        parent_phone=user.parent_phone,
        guardian_name=user.guardian_name,
        is_hod=user.is_hod or False,
        active=user.is_active,
        last_login=user.last_login.isoformat() if user.last_login else None,
        password_reset_enabled=user.password_reset_enabled or False,
        has_set_password=user.has_set_password or False,
        # Student academic info
        semester=user.semester,
        section=user.section,
        batch=user.batch,
        programme=user.programme,
        year=user.year,
        shift=user.shift,
        # Class Adviser Role & Assignment
        is_class_adviser=user.is_class_adviser or False,
        advising_department_id=str(user.advising_department_id) if user.advising_department_id else None,
        advising_department_name=advising_dept_name,
        advising_year=user.advising_year,
        advising_section=user.advising_section,
        advising_programme=user.advising_programme,
        advising_shift=user.advising_shift,
    )


async def seed_admin_users(db: AsyncSession) -> None:
    """Create configured admins and repair only untouched bootstrap accounts."""
    admin_configs = [
        {"username": settings.ADMIN1_USERNAME, "password": settings.ADMIN1_PASSWORD,
         "name": settings.ADMIN1_NAME, "email": settings.ADMIN1_EMAIL},
        {"username": settings.ADMIN2_USERNAME, "password": settings.ADMIN2_PASSWORD,
         "name": settings.ADMIN2_NAME, "email": settings.ADMIN2_EMAIL},
    ]
    for cfg in admin_configs:
        if not cfg.get("username"):
            continue
        result = await db.execute(
            select(User).where(
                or_(
                    func.lower(User.username) == cfg["username"].lower(),
                    func.lower(User.email) == cfg["email"].lower(),
                )
            )
        )
        existing = result.scalar_one_or_none()
        if not existing:
            admin = User(
                username=cfg["username"],
                name=cfg["name"],
                email=cfg["email"],
                role=UserRole.admin,
                is_active=True,
                password_hash=hash_password(cfg["password"]),
                has_set_password=False,
            )
            db.add(admin)
        else:
            existing.username = cfg["username"]
            existing.role = UserRole.admin
            existing.is_active = True
            if not existing.password_hash or not existing.has_set_password:
                existing.password_hash = hash_password(cfg["password"])
    await db.commit()


async def seed_demo_passwords_and_usernames(db: AsyncSession) -> None:
    """Ensure all seeded users have a valid username and demo password."""
    result = await db.execute(select(User))
    users = result.scalars().all()
    default_pw_hash = hash_password("password123")
    role_pw_map = {
        UserRole.admin: hash_password("admin123"),
        UserRole.hod: hash_password("hod123"),
        UserRole.faculty: hash_password("faculty123"),
        UserRole.student: hash_password("student123"),
    }
    for u in users:
        # Assign login username if missing
        if not u.username:
            if u.role == UserRole.student and u.reg_no:
                u.username = u.reg_no
            elif u.role in (UserRole.faculty, UserRole.hod) and u.employee_id:
                u.username = u.employee_id
            elif u.email:
                u.username = u.email.split('@')[0]
        
        # Ensure password_hash is set
        if not u.password_hash:
            u.password_hash = role_pw_map.get(u.role, default_pw_hash)
            u.has_set_password = False
        u.is_active = True
    await db.commit()


class RoleMismatchError(ValueError):
    """Raised when credentials are valid but selected role does not match account role."""
    pass


ROLE_LABELS = {
    "admin": ("an", "Admin"),
    "faculty": ("a", "Faculty"),
    "hod": ("an", "HOD"),
    "student": ("a", "Student"),
}


from sqlalchemy.orm import joinedload

async def login_by_username(
    username: str,
    password: str,
    db: AsyncSession,
    expected_role: str | None = None,
) -> LoginResponse:
    """
    Look up the user by username, email, employee ID, or register number and verify password.
    In DEV_MODE, also supports role keyword logins ('admin', 'hod', 'faculty', 'student')
    and common demo passwords.
    Validates that user's actual role in database matches expected_role.
    """
    clean_input = username.strip()
    clean_lower = clean_input.lower()

    # 1. Primary lookup by username, email, employee_id, reg_no, or roll_no with eager loaded department relationships
    query = select(User).options(
        joinedload(User.department),
        joinedload(User.advising_department)
    ).where(
        or_(
            func.lower(User.username) == clean_lower,
            func.lower(User.email) == clean_lower,
            func.lower(User.employee_id) == clean_lower,
            func.lower(User.reg_no) == clean_lower,
            func.lower(User.roll_no) == clean_lower,
        )
    )
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    # 2. In DEV_MODE, support role keywords (e.g. 'admin', 'hod', 'faculty', 'student')
    if not user and settings.DEV_MODE and clean_lower in ("admin", "hod", "faculty", "student"):
        role_map = {
            "admin": UserRole.admin,
            "hod": UserRole.hod,
            "faculty": UserRole.faculty,
            "student": UserRole.student,
        }
        target_role = role_map[clean_lower]
        role_result = await db.execute(
            select(User).options(
                joinedload(User.department),
                joinedload(User.advising_department)
            ).where(User.role == target_role).order_by(User.id).limit(1)
        )
        user = role_result.scalar_one_or_none()

    if not user:
        raise ValueError("Invalid role or credentials.")

    if not user.is_active:
        raise ValueError("Account is deactivated. Contact administrator.")

    # 3. Verify password
    is_valid_pw = False

    # Check bcrypt hash
    if user.password_hash:
        try:
            if verify_password(password, user.password_hash):
                is_valid_pw = True
        except Exception:
            pass

    # Check environment admin credentials
    if not is_valid_pw:
        admin1_u = (settings.ADMIN1_USERNAME or "").lower()
        admin1_e = (settings.ADMIN1_EMAIL or "").lower()
        admin2_u = (settings.ADMIN2_USERNAME or "").lower()
        admin2_e = (settings.ADMIN2_EMAIL or "").lower()
        if (clean_lower in (admin1_u, admin1_e) and password == settings.ADMIN1_PASSWORD) or \
           (clean_lower in (admin2_u, admin2_e) and password == settings.ADMIN2_PASSWORD):
            is_valid_pw = True
            user.password_hash = hash_password(password)

    # In DEV_MODE, support demo passwords or set password if missing
    if not is_valid_pw and settings.DEV_MODE:
        demo_passwords = {
            "password123", "admin123", "hod123", "faculty123", "student123",
            "admin", "hod", "faculty", "student", "password", clean_input
        }
        if password in demo_passwords or not user.password_hash:
            is_valid_pw = True
            if not user.password_hash:
                user.password_hash = hash_password(password or "password123")

    if not is_valid_pw:
        raise ValueError("Invalid role or credentials.")

    # Determine user's actual role in database
    actual_role_str = user.role.value if hasattr(user.role, 'value') else str(user.role).lower()
    if getattr(user, 'is_hod', False) and actual_role_str != "admin":
        actual_role_str = "hod"

    # Enforce strict role matching against actual role in database
    if not expected_role or not expected_role.strip():
        raise RoleMismatchError("Invalid role or credentials.")

    norm_expected = expected_role.strip().lower()
    valid_roles = {"admin", "faculty", "hod", "student"}
    if norm_expected not in valid_roles or norm_expected != actual_role_str:
        raise RoleMismatchError("Invalid role or credentials.")

    # Ensure username is saved if it was missing
    if not user.username:
        user.username = user.employee_id or user.reg_no or (user.email.split('@')[0] if user.email else f"user_{user.id[:8]}")

    user.last_login = datetime.utcnow()
    await db.commit()

    role_val = actual_role_str
    token = create_access_token({
        "user_id": str(user.id),
        "role": role_val,
        "username": user.username,
    })
    return LoginResponse(access_token=token, token_type="bearer", user=_format_user(user))


async def change_password(user_id: str, old_password: str, new_password: str, db: AsyncSession) -> None:
    """Allow a user to change their own password (must know old password)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise ValueError("User not found")

    if not user.password_hash:
        raise ValueError("No password set. Contact administrator.")

    if not verify_password(old_password, user.password_hash):
        raise ValueError("Old password is incorrect")

    user.password_hash = hash_password(new_password)
    user.has_set_password = True
    user.password_reset_enabled = False  # clear reset flag after successful change
    await db.commit()


async def change_password_by_username(
    username: str, old_password: str, new_password: str, db: AsyncSession
) -> None:
    """Change a password before login after verifying the existing password."""
    result = await db.execute(select(User).where(User.username == username.strip()))
    user = result.scalar_one_or_none()
    if not user or not user.is_active or not user.password_hash:
        raise ValueError("Invalid username or password")
    if not verify_password(old_password, user.password_hash):
        raise ValueError("Old password is incorrect")
    if old_password == new_password:
        raise ValueError("New password must be different from the old password")

    user.password_hash = hash_password(new_password)
    user.has_set_password = True
    user.password_reset_enabled = False
    await db.commit()


async def reset_password(username: str, new_password: str, db: AsyncSession) -> None:
    """
    Forgot-password reset: only allowed when admin has set password_reset_enabled = True.
    After reset, the flag is cleared automatically.
    """
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        raise ValueError("User not found")

    if not user.password_reset_enabled:
        raise ValueError("Password reset not enabled. Please contact administrator.")

    user.password_hash = hash_password(new_password)
    user.has_set_password = True
    user.password_reset_enabled = False
    await db.commit()
