import express from 'express';
import cors from 'cors';
import {
  allRows,
  getRow,
  upsertRow,
  deleteRow,
  replaceCollection,
  insertMany,
  sha256,
  uid,
  nowTs,
  getAccount,
  createSession,
  deleteSession,
  getSessionUserId,
  setLastLogin,
  enrichUser,
  syncAccountFor,
  unsyncAccountFor
} from './db.ts';
import type { User, BonafideRequest } from '../src/types/index.ts';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = Number(process.env.PORT || 4000);

const COLLECTIONS = [
  'periodTimes',
  'users',
  'departments',
  'subjects',
  'faculty',
  'students',
  'timetable',
  'attendanceRecords',
  'leaveRequests',
  'correctionRequests',
  'substitutionRequests',
  'calendarEvents',
  'auditLogs',
  'backups',
  'notifications',
  'circulars',
  'bonafideRequests'
];

function logAudit(user: User | undefined, action: string, module: string, details: string) {
  const entry = {
    id: uid('log-'),
    timestamp: nowTs(),
    userId: user?.id || 'system',
    userName: user?.name || 'System',
    role: user?.role || ('admin' as const),
    action,
    module,
    details,
    ipAddress: '127.0.0.1'
  };
  upsertRow('auditLogs', entry);
}

function handleAudit(user: User | undefined, body: any) {
  if (body?.audit?.action) {
    logAudit(user, body.audit.action, body.audit.module || 'Database', body.audit.details || 'Data updated');
  }
}

function auth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const userId = token ? getSessionUserId(token) : undefined;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  (req as any).userId = userId;
  next();
}

function currentUser(req: express.Request): User | undefined {
  const uidValue = (req as any).userId as string;
  return uidValue ? getRow<User>('users', uidValue) : undefined;
}

// ---------- Auth ----------
app.post('/api/auth/login', (req, res) => {
  const { role, identifier, password } = req.body || {};
  if (!role || !identifier || !password) {
    res.status(400).json({ error: 'Missing credentials' });
    return;
  }
  const account = getAccount(role, String(identifier));
  if (!account || account.password_hash !== sha256(String(password))) {
    res.status(401).json({ error: 'Invalid username / register number or password' });
    return;
  }
  const user = getRow<User>('users', account.user_id);
  if (!user) {
    res.status(401).json({ error: 'Account not found' });
    return;
  }
  if (!user.active) {
    res.status(403).json({ error: 'This account has been disabled. Contact the administrator.' });
    return;
  }
  const token = createSession(user.id);
  setLastLogin(user.id);
  res.json({ token, user: enrichUser(getRow<User>('users', user.id)!) });
});

app.post('/api/auth/logout', auth, (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) deleteSession(token);
  res.json({ ok: true });
});

app.get('/api/auth/me', auth, (req, res) => {
  const user = currentUser(req);
  if (!user) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }
  res.json(enrichUser(user));
});

// ---------- Bootstrap ----------
app.get('/api/bootstrap', auth, (req, res) => {
  const payload: Record<string, unknown> = {};
  for (const key of COLLECTIONS) payload[key] = allRows(key);
  res.json(payload);
});

// ---------- Generic data API ----------

// Programme -> Department -> Year -> Shift master rules, enforced server-side for
// student records so invalid combinations (UG+IT, PG+III YEAR, PG+Second Shift)
// are rejected regardless of the client. Returns an error string or null.
function masterStructureErrorFor(item: any): string | null {
  if (!item || (Array.isArray(item) && item.length === 0)) return null;
  const rows = Array.isArray(item) ? item : [item];
  for (const s of rows) {
    if (!s || typeof s !== 'object') continue;
    const prog = s.programme;
    const dept = s.departmentId;
    const year = s.year;
    const shift = s.shift;
    if (!prog) continue; // legacy records without explicit fields are allowed

    if (prog === 'UG' && dept === 'dept-it') {
      return 'Invalid combination: UG programme does not allow INFORMATION & TECHNOLOGY (IT) department.';
    }
    if (prog === 'PG' && year === 'III YEAR') {
      return 'Invalid combination: PG programme does not allow III YEAR.';
    }
    if (prog === 'PG' && shift === 'Second Shift') {
      return 'Invalid combination: PG programme only allows First Shift.';
    }
  }
  return null;
}

app.post('/api/data/:key/upsert', auth, (req, res) => {
  const { key } = req.params;
  if (!COLLECTIONS.includes(key)) {
    res.status(400).json({ error: `Unknown collection: ${key}` });
    return;
  }
  const { item, match } = req.body || {};
  if (!item || !item.id) {
    res.status(400).json({ error: 'Body must include an item with an id' });
    return;
  }
  if (key === 'students') {
    const err = masterStructureErrorFor(item);
    if (err) {
      res.status(422).json({ error: err });
      return;
    }
  }
  let existingId = getRow(key, item.id) ? item.id : undefined;
  if (!existingId) {
    const matchKeys: string[] = Array.isArray(match) ? match : [];
    if (matchKeys.length > 0) {
      const rows = allRows<any>(key);
      existingId = rows.find((r) => matchKeys.every((k) => r[k] === item[k]))?.id;
    }
  }
  if (existingId) {
    upsertRow(key, { ...item, id: existingId });
  } else {
    upsertRow(key, item);
  }
  syncAccountFor(key, item);
  handleAudit(currentUser(req), req.body || {});
  res.json({ item: getRow(key, existingId || item.id) });
});

app.post('/api/data/:key/import', auth, (req, res) => {
  const { key } = req.params;
  if (!COLLECTIONS.includes(key)) {
    res.status(400).json({ error: `Unknown collection: ${key}` });
    return;
  }
  const { items } = req.body || {};
  if (!Array.isArray(items)) {
    res.status(400).json({ error: 'Body must include items array' });
    return;
  }
  if (key === 'students') {
    const err = masterStructureErrorFor(items);
    if (err) {
      res.status(422).json({ error: err });
      return;
    }
  }
  insertMany(key, items);
  for (const item of items) syncAccountFor(key, item);
  handleAudit(currentUser(req), req.body || {});
  res.json({ count: items.length });
});

app.delete('/api/data/:key/:id', auth, (req, res) => {
  const { key, id } = req.params;
  if (!COLLECTIONS.includes(key)) {
    res.status(400).json({ error: `Unknown collection: ${key}` });
    return;
  }
  // Bonafide deletions must go through the dedicated, permission-checked endpoint
  // so that the "pending faculty review" deletion rule is enforced server-side.
  if (key === 'bonafideRequests') {
    const user = currentUser(req);
    const request = getRow(key, id) as BonafideRequest | undefined;
    if (!request) {
      res.status(404).json({ error: 'Bonafide request not found' });
      return;
    }
    const canDelete = request.status === 'submitted' && request.facultyReviewed !== true;
    const isOwner = user && (user.role === 'admin' || (user.role === 'student' && user.id === request.studentId));
    if (!isOwner) {
      res.status(403).json({ error: 'Forbidden: you do not own this bonafide request' });
      return;
    }
    if (!canDelete) {
      res.status(409).json({ error: 'This bonafide request can no longer be deleted (already reviewed under Faculty review)' });
      return;
    }
    deleteRow(key, id);
    handleAudit(currentUser(req), req.body || {});
    res.json({ ok: true });
    return;
  }
  deleteRow(key, id);
  unsyncAccountFor(key, id);
  handleAudit(currentUser(req), req.body || {});
  res.json({ ok: true });
});

app.put('/api/data/:key/bulk', auth, (req, res) => {
  const { key } = req.params;
  if (!COLLECTIONS.includes(key)) {
    res.status(400).json({ error: `Unknown collection: ${key}` });
    return;
  }
  const { items } = req.body || {};
  if (!Array.isArray(items)) {
    res.status(400).json({ error: 'Body must include items array' });
    return;
  }
  replaceCollection(key, items);
  handleAudit(currentUser(req), req.body || {});
  res.json({ count: items.length });
});

// ---------- Statistics ----------
app.get('/api/statistics', auth, (req, res) => {
  const students = allRows<any>('students');
  const faculty = allRows<any>('faculty');
  const departments = allRows<any>('departments');
  const subjects = allRows<any>('subjects');
  const records = allRows<any>('attendanceRecords');

  const totalClasses = records.reduce((sum, r) => sum + r.totalStudents, 0);
  const presentClasses = records.reduce((sum, r) => sum + r.presentCount, 0);
  const overallPct = totalClasses > 0 ? Math.round((presentClasses / totalClasses) * 1000) / 10 : 0;

  res.json({
    students: students.length,
    faculty: faculty.length,
    departments: departments.length,
    subjects: subjects.length,
    attendanceRecords: records.length,
    overallAttendancePct: overallPct,
    lowAttendanceCount: students.filter((s) => s.overallAttendancePct < 75).length,
    activeFaculty: faculty.filter((f) => f.active).length,
    activeStudents: students.filter((s) => s.active).length
  });
});

// ---------- Reports ----------
function lowAttendanceRows() {
  const students = allRows<any>('students');
  const depts = allRows<any>('departments');
  const deptName = (id: string) => depts.find((d) => d.id === id)?.name || id;
  return students
    .filter((s) => s.overallAttendancePct < 75)
    .map((s) => ({
      name: s.name,
      rollNo: s.rollNo,
      className: `${deptName(s.departmentId)} Sem ${s.semester} Sec ${s.section}`,
      semester: s.semester,
      attendancePct: s.overallAttendancePct,
      status: 'Low'
    }))
    .sort((a, b) => a.attendancePct - b.attendancePct);
}

app.get('/api/reports/low-attendance', auth, (req, res) => {
  res.json(lowAttendanceRows());
});

app.get('/api/reports/low-attendance.csv', auth, (req, res) => {
  const rows = lowAttendanceRows();
  const header = 'Name,Roll No,Class,Semester,Attendance %,Status';
  const lines = rows.map((r) =>
    [r.name, r.rollNo, `"${r.className}"`, r.semester, `${r.attendancePct.toFixed(2)}%`, r.status].join(',')
  );
  const csv = [header, ...lines].join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="low_attendance_students.csv"');
  res.send(csv);
});

// ---------- Health ----------
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'smartattendance-backend', collections: COLLECTIONS.length });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[SmartAttendance] Backend running on http://localhost:${PORT}`);
  console.log('Demo accounts:');
  console.log('  Admin   -> username: admin         password: admin123');
  console.log('  HOD     -> employeeId: FAC-HOD-01  password: hod123');
  console.log('  Faculty -> employeeId: FAC-102     password: faculty123');
  console.log('  Student -> registerNo: 2024CS1042  password: student123');
});