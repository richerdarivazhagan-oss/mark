from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, or_, and_, func
from sqlalchemy.orm import joinedload
from app.core.database import get_db
from app.dependencies.auth import require_role
from app.models.models import Circular, CircularStatus, UserRole, User, Department
from app.services.audit import create_audit_log
from pydantic import BaseModel

router = APIRouter()



class CircularCreate(BaseModel):
    id: Optional[str] = None
    title: str
    content: str
    target: Optional[str] = None
    target_role: Optional[str] = None
    department_id: Optional[str] = None
    target_year: Optional[int] = None
    target_semester: Optional[int] = None
    target_section: Optional[str] = None
    target_programme: Optional[str] = None
    target_shift: Optional[str] = None
    attachment_url: Optional[str] = None
    attachment_name: Optional[str] = None
    selected_faculty_ids: Optional[list[str]] = None
    valid_from: Optional[str] = None
    valid_until: Optional[str] = None
    status: Optional[str] = None


class ClassAdvisorCircularCreate(BaseModel):
    title: str
    content: str
    attachment_url: Optional[str] = None
    attachment_name: Optional[str] = None
    department_id: Optional[str] = None
    target_year: Optional[int] = None
    target_section: Optional[str] = None
    target_semester: Optional[int] = None
    target_programme: Optional[str] = None
    target_shift: Optional[str] = None
    valid_from: Optional[str] = None
    valid_until: Optional[str] = None


class CircularRead(BaseModel):
    id: str
    title: str
    content: str
    description: Optional[str] = None
    status: str
    target_role: Optional[str] = None
    target: Optional[str] = None
    department_id: Optional[str] = None
    department_name: Optional[str] = None
    target_year: Optional[int] = None
    target_semester: Optional[int] = None
    target_section: Optional[str] = None
    target_programme: Optional[str] = None
    target_shift: Optional[str] = None
    attachment_url: Optional[str] = None
    attachment_name: Optional[str] = None
    attachmentUrl: Optional[str] = None
    attachmentName: Optional[str] = None
    author_id: Optional[str] = None
    author_name: Optional[str] = None
    createdBy: Optional[str] = None
    createdByName: Optional[str] = None
    createdByRole: Optional[str] = None
    signer_name: Optional[str] = None
    publisher_name: Optional[str] = None
    published_at: Optional[str] = None
    publishedAt: Optional[str] = None
    validFrom: Optional[str] = None
    validUntil: Optional[str] = None
    selected_faculty_ids: Optional[list[str]] = None
    selectedFacultyIds: Optional[list[str]] = None
    recipient_count: int = 0
    targetClass: Optional[dict] = None
    created_at: str
    createdAt: str
    updated_at: str

    class Config:
        from_attributes = True


def _fmt(c: Circular) -> CircularRead:
    author_name = c.author.name if c.author else (c.publisher_name or "Faculty")
    author_role = (
        c.author.role.value
        if c.author and hasattr(c.author.role, "value")
        else (c.author.role if c.author else "faculty")
    )
    dept_name = c.department.name if c.department else None

    import json
    sel_fac_list = None
    if c.selected_faculty_ids:
        try:
            sel_fac_list = json.loads(c.selected_faculty_ids) if isinstance(c.selected_faculty_ids, str) else c.selected_faculty_ids
        except Exception:
            sel_fac_list = None

    if c.target:
        target_val = c.target
    elif c.target_role and (c.target_role.value if hasattr(c.target_role, "value") else str(c.target_role)) == "faculty":
        target_val = "all_faculty"
    elif c.target_section or c.target_year:
        target_val = "tutor_class"
    else:
        target_val = "all_students"

    target_class_obj = None
    if c.target_section or c.target_semester or c.target_year:
        sem = c.target_semester or ((c.target_year * 2) if c.target_year else 1)
        target_class_obj = {"semester": sem, "section": c.target_section or "A"}

    created_iso = c.created_at.isoformat() if c.created_at else ""
    pub_at = getattr(c, 'published_at', None)
    published_iso = pub_at.isoformat() if pub_at else None
    pub_date = (pub_at or c.created_at or datetime.utcnow()).strftime("%Y-%m-%d")

    v_from = c.valid_from or pub_date
    v_until = c.valid_until or pub_date

    return CircularRead(
        id=str(c.id),
        title=c.title,
        content=c.content,
        description=c.content,
        status=c.status.value if hasattr(c.status, "value") else str(c.status),
        target_role=c.target_role.value if c.target_role and hasattr(c.target_role, "value") else (str(c.target_role) if c.target_role else None),
        target=target_val,
        department_id=str(c.department_id) if c.department_id else None,
        department_name=dept_name,
        target_year=c.target_year,
        target_semester=c.target_semester,
        target_section=c.target_section,
        target_programme=c.target_programme,
        target_shift=c.target_shift,
        attachment_url=c.attachment_url,
        attachment_name=c.attachment_name,
        attachmentUrl=c.attachment_url,
        attachmentName=c.attachment_name,
        author_id=str(c.author_id) if c.author_id else None,
        author_name=author_name,
        createdBy=author_name,
        createdByName=author_name,
        createdByRole=author_role,
        signer_name=c.signer_name,
        publisher_name=c.publisher_name,
        published_at=published_iso,
        publishedAt=published_iso,
        validFrom=v_from,
        validUntil=v_until,
        selected_faculty_ids=sel_fac_list,
        selectedFacultyIds=sel_fac_list,
        recipient_count=getattr(c, 'recipient_count', len(sel_fac_list) if sel_fac_list else 0),
        targetClass=target_class_obj,
        created_at=created_iso,
        createdAt=created_iso,
        updated_at=c.updated_at.isoformat() if c.updated_at else "",
    )


@router.get("/my-advising-class")
async def get_my_advising_class(
    current_user: User = Depends(require_role("faculty")),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns Class Advisor status and assigned class details for the currently logged-in faculty.
    If faculty is not a Class Advisor, returns is_class_adviser = False.
    """
    if not current_user.is_class_adviser:
        return {
            "is_class_adviser": False,
            "message": "You are not designated as a Class Advisor for any class.",
        }

    dept_id = current_user.advising_department_id or current_user.department_id
    dept = None
    if dept_id:
        res = await db.execute(select(Department).where(Department.id == dept_id))
        dept = res.scalar_one_or_none()

    dept_code = dept.code if dept else "DEPT"
    dept_name = dept.name if dept else "Department"

    # Count active students belonging to this advisor's class
    count_stmt = select(func.count(User.id)).where(
        User.role == UserRole.student,
        User.is_active == True,
    )
    if dept_id:
        count_stmt = count_stmt.where(User.department_id == dept_id)
    if current_user.advising_year:
        count_stmt = count_stmt.where(
            or_(
                User.year == current_user.advising_year,
                User.semester.in_([current_user.advising_year * 2 - 1, current_user.advising_year * 2]),
            )
        )
    if current_user.advising_section:
        count_stmt = count_stmt.where(func.upper(User.section) == current_user.advising_section.upper())
    if current_user.advising_programme:
        count_stmt = count_stmt.where(func.upper(User.programme) == current_user.advising_programme.upper())

    student_count = (await db.execute(count_stmt)).scalar() or 0

    class_parts = [dept_code]
    if current_user.advising_year:
        class_parts.append(f"Year {current_user.advising_year}")
    if current_user.advising_section:
        class_parts.append(f"Sec {current_user.advising_section}")

    return {
        "is_class_adviser": True,
        "department_id": str(dept_id) if dept_id else None,
        "department_code": dept_code,
        "department_name": dept_name,
        "year": current_user.advising_year,
        "section": current_user.advising_section,
        "programme": current_user.advising_programme or "UG",
        "shift": current_user.advising_shift or "Shift 1",
        "class_label": " - ".join(class_parts),
        "student_count": student_count,
    }


@router.post("/class-advisor", response_model=CircularRead)
async def send_class_advisor_circular(
    data: ClassAdvisorCircularCreate,
    current_user: User = Depends(require_role("faculty")),
    db: AsyncSession = Depends(get_db),
):
    """
    Create and immediately send/publish a circular to the students of the Class Advisor's assigned class.
    STRICT BACKEND SECURITY:
    1. Only designated Class Advisors can send circulars.
    2. Rejects any attempt to target a class other than their assigned class.
    3. The circular's class target is strictly bound to the faculty member's assignment in the database.
    """
    # 1. Authorize Class Advisor status
    if not current_user.is_class_adviser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Only designated Class Advisors can create and send class circulars.",
        )

    assigned_dept_id = str(current_user.advising_department_id or current_user.department_id or "")
    if not assigned_dept_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No class/department assignment found for your Class Advisor role.",
        )

    # 2. Strict Backend Anti-Tampering Check:
    # If the request payload contains target parameters, ensure they EXACTLY match the advisor's class assignment.
    if data.department_id and str(data.department_id).strip() != assigned_dept_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You cannot send circulars to a department other than your assigned class department.",
        )

    if data.target_year is not None and current_user.advising_year is not None:
        if int(data.target_year) != int(current_user.advising_year):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: You cannot send circulars to Year {data.target_year}. You are only assigned to Year {current_user.advising_year}.",
            )

    if data.target_section and current_user.advising_section:
        if data.target_section.strip().upper() != current_user.advising_section.strip().upper():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: You cannot send circulars to Section {data.target_section}. You are only assigned to Section {current_user.advising_section}.",
            )

    if not data.title.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Circular title cannot be empty.")
    if not data.content.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Circular content cannot be empty.")

    # 3. Always bind target class strictly to the database advisor assignment
    target_sem = data.target_semester or (current_user.advising_year * 2 if current_user.advising_year else None)

    # Count recipients in the assigned class
    count_stmt = select(func.count(User.id)).where(
        User.role == UserRole.student,
        User.is_active == True,
        User.department_id == assigned_dept_id,
    )
    if current_user.advising_year:
        count_stmt = count_stmt.where(
            or_(
                User.year == current_user.advising_year,
                User.semester.in_([current_user.advising_year * 2 - 1, current_user.advising_year * 2]),
            )
        )
    if current_user.advising_section:
        count_stmt = count_stmt.where(func.upper(User.section) == current_user.advising_section.upper())
    recipients = (await db.execute(count_stmt)).scalar() or 0

    now = datetime.utcnow()
    circ = Circular(
        title=data.title.strip(),
        content=data.content.strip(),
        status=CircularStatus.published,  # Published immediately for assigned class
        target_role=UserRole.student,
        department_id=assigned_dept_id,
        target_year=current_user.advising_year,
        target_semester=target_sem,
        target_section=current_user.advising_section,
        target_programme=current_user.advising_programme or "UG",
        target_shift=current_user.advising_shift or "Shift 1",
        attachment_url=data.attachment_url,
        attachment_name=data.attachment_name,
        author_id=str(current_user.id),
        signer_id=str(current_user.id),
        signer_name=f"{current_user.name} (Class Advisor)",
        publisher_id=str(current_user.id),
        publisher_name=current_user.name,
        published_at=now,
        recipient_count=recipients,
    )
    db.add(circ)
    await db.commit()
    await db.refresh(circ)

    await create_audit_log(
        db,
        str(current_user.id),
        "SEND_CLASS_CIRCULAR",
        "Circulars",
        f"Class Advisor {current_user.name} sent circular '{circ.title}' to class (Dept: {assigned_dept_id}, Yr: {circ.target_year}, Sec: {circ.target_section})",
        "127.0.0.1",
    )
    return _fmt(circ)


@router.get("", response_model=list[CircularRead])
@router.get("/", response_model=list[CircularRead])
async def list_circulars(
    current_user: User = Depends(require_role("admin", "hod", "faculty", "student")),
    db: AsyncSession = Depends(get_db),
):
    """
    Return circulars visible to the requesting user based on role and strict class-isolation:
    - Students: ONLY receive circulars strictly targeting their assigned class (matching department, year, semester, section).
    - Faculty: Class Advisors see circulars they created + circulars targeting faculty. Regular faculty see only faculty-targeted circulars.
    - HOD: See department circulars + college-wide circulars.
    - Admin: Full access.
    """
    stmt = select(Circular).options(joinedload(Circular.author), joinedload(Circular.department)).order_by(Circular.created_at.desc())
    role = current_user.role

    if role == UserRole.student:
        # Strict student class isolation:
        # Students ONLY see circulars explicitly targeted at students (all_students, specific_students, tutor_class).
        # Students MUST NEVER see circulars targeting faculty (all_faculty, individual_faculty).
        conditions = [
            Circular.status == CircularStatus.published,
            or_(
                Circular.target.in_(["all_students", "specific_students", "tutor_class"]),
                and_(Circular.target_role == UserRole.student, Circular.target.is_(None))
            ),
            or_(Circular.target.is_(None), Circular.target.notin_(["all_faculty", "individual_faculty"])),
            or_(Circular.target_role.is_(None), Circular.target_role == UserRole.student),
        ]
        if current_user.department_id:
            conditions.append(or_(Circular.department_id == current_user.department_id, Circular.department_id.is_(None)))

        if current_user.year is not None:
            conditions.append(or_(Circular.target_year == current_user.year, Circular.target_year.is_(None)))
        elif current_user.semester is not None:
            inferred_yr = (current_user.semester + 1) // 2
            conditions.append(or_(Circular.target_year == inferred_yr, Circular.target_year.is_(None)))

        if current_user.semester is not None:
            conditions.append(or_(Circular.target_semester == current_user.semester, Circular.target_semester.is_(None)))

        if current_user.section:
            conditions.append(or_(func.upper(Circular.target_section) == current_user.section.upper(), Circular.target_section.is_(None)))

        if current_user.programme:
            conditions.append(or_(func.upper(Circular.target_programme) == current_user.programme.upper(), Circular.target_programme.is_(None)))

        if current_user.shift:
            conditions.append(or_(func.upper(Circular.target_shift) == current_user.shift.upper(), Circular.target_shift.is_(None)))

        stmt = stmt.where(and_(*conditions))

    elif role == UserRole.faculty:
        # Faculty see:
        # 1. Circulars authored by themselves (e.g. Class Advisor sent class circulars)
        # 2. Published circulars intended for faculty members (all_faculty or individual_faculty)
        faculty_published = and_(
            Circular.status == CircularStatus.published,
            or_(
                Circular.target_role == UserRole.faculty,
                Circular.target == "all_faculty",
                Circular.target == "individual_faculty",
            ),
            or_(Circular.target.is_(None), Circular.target.notin_(["all_students", "specific_students", "tutor_class"])),
        )
        stmt = stmt.where(or_(Circular.author_id == str(current_user.id), faculty_published))

    elif role == UserRole.hod:
        # HOD sees circulars created by themselves, department circulars, or college-wide circulars
        if current_user.department_id:
            stmt = stmt.where(
                or_(
                    Circular.author_id == str(current_user.id),
                    Circular.department_id == current_user.department_id,
                    Circular.department_id.is_(None)
                )
            )

    result = await db.execute(stmt)
    all_circs = result.scalars().unique().all()
    today_str = datetime.utcnow().strftime("%Y-%m-%d")

    filtered = []
    import json
    for c in all_circs:
        is_author = str(c.author_id) == str(current_user.id) if c.author_id else False

        if role == UserRole.faculty and not is_author:
            # Faculty readers can ONLY view Published circulars
            if c.status != CircularStatus.published:
                continue

            # Strict isolation: exclude student circulars for non-author faculty
            if c.target in ("all_students", "specific_students", "tutor_class") or c.target_role == UserRole.student:
                continue

            # Check validity period for faculty readers (expired if valid_until < today_str)
            if c.valid_until and c.valid_until < today_str:
                continue

            # Check recipient targeting for individual faculty
            if c.target == "individual_faculty":
                if not c.selected_faculty_ids:
                    continue
                try:
                    selected_ids = json.loads(c.selected_faculty_ids) if isinstance(c.selected_faculty_ids, str) else c.selected_faculty_ids
                    if isinstance(selected_ids, list):
                        selected_ids_lower = [str(x).strip().lower() for x in selected_ids if x]
                        user_identifiers = [
                            str(current_user.id),
                            str(getattr(current_user, "employee_id", "") or ""),
                            str(getattr(current_user, "username", "") or ""),
                            str(getattr(current_user, "name", "") or ""),
                            str(getattr(current_user, "email", "") or "")
                        ]
                        user_identifiers_lower = [u.strip().lower() for u in user_identifiers if u]
                        if not any(uid in selected_ids_lower for uid in user_identifiers_lower):
                            continue
                    else:
                        continue
                except Exception:
                    continue

        filtered.append(c)

    return [_fmt(c) for c in filtered]


@router.post("", response_model=CircularRead)
async def create_circular(
    data: CircularCreate,
    current_user: User = Depends(require_role("admin", "hod", "faculty")),
    db: AsyncSession = Depends(get_db),
):
    """Admin / HOD / Class Advisor circular creation endpoint."""
    print(f"[DEBUG CREATE_CIRCULAR] payload data.target={data.target!r}, data.target_role={data.target_role!r}")
    if data.target in ("all_faculty", "individual_faculty"):
        target_role_val = UserRole.faculty
    elif data.target in ("all_students", "specific_students", "tutor_class"):
        target_role_val = UserRole.student
    else:
        target_role_val = UserRole.faculty if data.target_role == "faculty" else (UserRole.student if data.target_role == "student" else None)

    init_status = CircularStatus.draft
    if data.status and data.status in CircularStatus.__members__:
        init_status = CircularStatus(data.status)

    from app.models.models import _gen_uuid
    circ_id = data.id if data.id else _gen_uuid()

    circ = Circular(
        id=circ_id,
        title=data.title,
        content=data.content,
        target=data.target or ("all_faculty" if target_role_val == UserRole.faculty else "all_students"),
        target_role=target_role_val,
        department_id=data.department_id or current_user.department_id,
        target_year=data.target_year,
        target_semester=data.target_semester,
        target_section=data.target_section,
        target_programme=data.target_programme,
        target_shift=data.target_shift,
        attachment_url=data.attachment_url,
        attachment_name=data.attachment_name,
        author_id=str(current_user.id),
        selected_faculty_ids=data.selected_faculty_ids,
        valid_from=data.valid_from,
        valid_until=data.valid_until,
        status=init_status,
    )
    if init_status == CircularStatus.published:
        circ.publisher_id = str(current_user.id)
        circ.publisher_name = current_user.name
        circ.published_at = datetime.utcnow()
    elif init_status == CircularStatus.signed:
        circ.signer_id = str(current_user.id)
        circ.signer_name = current_user.name

    db.add(circ)
    await db.commit()
    await db.refresh(circ)
    await create_audit_log(
        db, str(current_user.id), "CREATE_CIRCULAR", "Circulars",
        f"Created circular: {data.title}", "127.0.0.1"
    )
    return _fmt(circ)


@router.put("/{circular_id}", response_model=CircularRead)
async def update_circular(
    circular_id: str,
    data: CircularCreate,
    current_user: User = Depends(require_role("admin", "hod", "faculty")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Circular).where(Circular.id == circular_id))
    circ = result.scalar_one_or_none()
    if not circ:
        raise HTTPException(status_code=404, detail="Circular not found")

    # Faculty can only edit circulars they created
    if current_user.role == UserRole.faculty and str(circ.author_id) != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden: You can only edit circulars created by you.")

    circ.title = data.title
    circ.content = data.content
    if data.status and data.status in CircularStatus.__members__:
        circ.status = CircularStatus(data.status)
        if data.status == "published":
            circ.publisher_id = str(current_user.id)
            circ.publisher_name = current_user.name
            if not circ.published_at:
                circ.published_at = datetime.utcnow()
        elif data.status == "signed":
            circ.signer_id = str(current_user.id)
            circ.signer_name = current_user.name

    if current_user.role in (UserRole.admin, UserRole.hod):
        if data.target:
            circ.target = data.target
            if data.target in ("all_faculty", "individual_faculty"):
                circ.target_role = UserRole.faculty
            elif data.target in ("all_students", "specific_students", "tutor_class"):
                circ.target_role = UserRole.student
        if data.target_role:
            if data.target_role == "faculty":
                circ.target_role = UserRole.faculty
            elif data.target_role == "student":
                circ.target_role = UserRole.student
        if data.department_id:
            circ.department_id = data.department_id
        circ.target_year = data.target_year
        circ.target_semester = data.target_semester
        circ.target_section = data.target_section
        circ.target_programme = data.target_programme
        circ.target_shift = data.target_shift
        if data.selected_faculty_ids is not None:
            circ.selected_faculty_ids = data.selected_faculty_ids
        if data.valid_from:
            circ.valid_from = data.valid_from
        if data.valid_until:
            circ.valid_until = data.valid_until
    if data.attachment_url:
        circ.attachment_url = data.attachment_url
    if data.attachment_name:
        circ.attachment_name = data.attachment_name

    await db.commit()
    await db.refresh(circ)
    return _fmt(circ)


@router.post("/{circular_id}/sign", response_model=CircularRead)
async def sign_circular(
    circular_id: str,
    current_user: User = Depends(require_role("admin", "hod")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Circular).where(Circular.id == circular_id))
    circ = result.scalar_one_or_none()
    if not circ:
        raise HTTPException(status_code=404, detail="Circular not found")
    circ.status = CircularStatus.signed
    circ.signer_id = str(current_user.id)
    circ.signer_name = current_user.name
    await db.commit()
    await db.refresh(circ)
    return _fmt(circ)


@router.post("/{circular_id}/publish", response_model=CircularRead)
async def publish_circular(
    circular_id: str,
    current_user: User = Depends(require_role("admin", "hod")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Circular).where(Circular.id == circular_id))
    circ = result.scalar_one_or_none()
    if not circ:
        raise HTTPException(status_code=404, detail="Circular not found")
    circ.status = CircularStatus.published
    circ.publisher_id = str(current_user.id)
    circ.publisher_name = current_user.name
    circ.published_at = datetime.utcnow()

    if circ.target in ("all_faculty", "individual_faculty"):
        circ.target_role = UserRole.faculty
    elif circ.target in ("all_students", "specific_students", "tutor_class"):
        circ.target_role = UserRole.student

    await db.commit()
    await db.refresh(circ)
    await create_audit_log(
        db, str(current_user.id), "PUBLISH_CIRCULAR", "Circulars",
        f"Published: {circ.title}", "127.0.0.1"
    )
    return _fmt(circ)


@router.post("/{circular_id}/archive", response_model=CircularRead)
async def archive_circular(
    circular_id: str,
    current_user: User = Depends(require_role("admin", "hod")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Circular).where(Circular.id == circular_id))
    circ = result.scalar_one_or_none()
    if not circ:
        raise HTTPException(status_code=404, detail="Circular not found")
    circ.status = CircularStatus.archived
    await db.commit()
    await db.refresh(circ)
    return _fmt(circ)


@router.delete("/{circular_id}")
async def delete_circular(
    circular_id: str,
    current_user: User = Depends(require_role("admin", "hod", "faculty")),
    db: AsyncSession = Depends(get_db),
):
    """
    Delete circular endpoint with role-based access control.
    Class Advisors can delete circulars they created; admins/HOD can delete department/global circulars.
    """
    result = await db.execute(select(Circular).where(Circular.id == circular_id))
    circ = result.scalar_one_or_none()
    if not circ:
        raise HTTPException(status_code=404, detail="Circular not found")

    if current_user.role == UserRole.faculty:
        if str(circ.author_id) != str(current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: You can only delete circulars created by you.",
            )
    elif current_user.role == UserRole.hod:
        if circ.department_id and str(circ.department_id) != str(current_user.department_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: You can only delete circulars for your department.",
            )

    await db.execute(delete(Circular).where(Circular.id == circular_id))
    await db.commit()
    await create_audit_log(
        db, str(current_user.id), "DELETE_CIRCULAR", "Circulars",
        f"Deleted circular: {circ.title}", "127.0.0.1"
    )
    return {"message": "Circular deleted", "id": circular_id}
