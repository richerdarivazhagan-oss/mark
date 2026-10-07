import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { StaffDayOrder, DayOrderEntry } from '../../types';
import { Modal } from '../common/Modal';
import { BackButton } from '../common/BackButton';
import { preprocessImageForOcr, runOcrParsingPipeline, parseRomanOrder, classifyTableParts, detectImageMonthHeader, OcrPipelineResult } from '../../lib/ocrPipeline';
import {
  Plus,
  Trash2,
  Upload,
  ScanLine,
  ImageIcon,
  Save,
  Loader2,
  CalendarDays,
  RotateCcw,
  FileText,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Info
} from 'lucide-react';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// ---------- Day Order OCR parsing helpers ----------

export const ROMAN_DAY_ORDERS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];

export const HOLIDAY_RE = /விடுமுறை|விடுமுறையும்|அரசு\s*விடுமுறை|வார\s*விடுமுறை|உள்ளூர்\s*விடுமுறை|மிலாடி|காந்தி|விநாயகர்|பூஜை|தீபாவளி|பொங்கல்|திருவள்ளுவர்|உழவர்|குடியரசு|சுதந்திர|புத்தாண்டு|கிறிஸ்துமஸ்|ரம்ஜான்|பக்ரீத்|ஈகை|மஹாவீர்|புனித\s*வெள்ளி|holiday|leave|weekly\s*off|compensatory|vacation|closed|public\s*holiday|government/i;

export const TAMIL_DAYS = [
  'ஞாயிறு', 'திங்கள்', 'செவ்வாய்', 'புதன்', 'வியாழன்', 'வெள்ளி', 'சனி',
  'ஞாயி', 'திங்', 'செவ்', 'புத', 'வியா', 'வெள்',
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
  'sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'
];

export function isDayName(token: string): boolean {
  if (!token) return false;
  const clean = token.toLowerCase().replace(/[^a-z\u0B80-\u0BFF]/g, '');
  return TAMIL_DAYS.some(d => clean.startsWith(d) || d.startsWith(clean));
}

export function parseRomanDayOrder(token: string): number | null {
  return parseRomanOrder(token);
}

function parseDayOrderText(rawText: string, month: string): DayOrderEntry[] {
  const [fy, fm] = month.split('-').map(Number);
  const lines = rawText.split(/\r?\n/);
  const entries: DayOrderEntry[] = [];
  const seen = new Set<string>();

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Skip table header rows or summary lines
    if (/^(தேதி|நாள்|வரிசை|பணி|date|day|order|working|மொத்த|total)/i.test(line)) continue;

    let parts: string[] = [];
    if (line.includes('|')) {
      parts = line.split('|').map((p) => p.trim()).filter(Boolean);
    } else {
      parts = line.replace(/^[|.\s-]+|[|.\s-]+$/g, '').split(/\s+/).filter(Boolean);
    }

    const parsed = classifyTableParts(parts);
    if (!parsed.dateNum) continue;

    const dateKey = `${fy}-${String(fm).padStart(2, '0')}-${String(parsed.dateNum).padStart(2, '0')}`;
    if (seen.has(dateKey)) continue;
    seen.add(dateKey);

    entries.push({
      date: dateKey,
      dayName: parsed.dayName || undefined,
      dayOrder: parsed.dayOrder != null ? parsed.dayOrder : undefined,
      workingDayCount: parsed.workingDayCount != null ? parsed.workingDayCount : undefined,
      remark: parsed.remark || undefined,
      isHoliday: parsed.isHoliday,
      holidayTitle: parsed.isHoliday ? (parsed.holidayTitle || 'Holiday') : (parsed.holidayTitle || undefined),
    });
  }

  return entries.sort((a, b) => (a.date < b.date ? -1 : 1));
}

// ---------- Component ----------

export const DayOrderOCR: React.FC = () => {
  const {
    staffDayOrders,
    saveStaffDayOrder,
    updateStaffDayOrder,
    setActiveScreen,
    addToast,
    selectedCalendarMonth,
    setSelectedCalendarMonth,
    t,
    language
  } = useApp();

  const [editingSchedule, setEditingSchedule] = useState<StaffDayOrder | null>(null);
  const [dayMonth, setDayMonth] = useState(selectedCalendarMonth || '2026-09');
  const [dayTitle, setDayTitle] = useState(() => {
    const [y, m] = (selectedCalendarMonth || '2026-09').split('-').map(Number);
    const mName = MONTHS[(m ?? 1) - 1] || 'September';
    return `${mName} ${y || 2026} Monthly Staff Order`;
  });

  React.useEffect(() => {
    if (selectedCalendarMonth) {
      setDayMonth(selectedCalendarMonth);
      const [y, m] = selectedCalendarMonth.split('-').map(Number);
      const mName = MONTHS[(m ?? 1) - 1] || 'September';
      setDayTitle(`${mName} ${y || 2026} Monthly Staff Order`);
    }
  }, [selectedCalendarMonth]);

  const [imageUrl, setImageUrl] = useState('');
  const [rawText, setRawText] = useState('');
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [entries, setEntries] = useState<DayOrderEntry[]>([]);
  const [viewingSchedule, setViewingSchedule] = useState<StaffDayOrder | null>(null);

  const monthLabel = (ym: string) => {
    const [y, m] = ym.split('-').map(Number);
    return `${MONTHS[(m ?? 1) - 1]} ${y}`;
  };

  const sortedSchedules = useMemo(
    () => [...staffDayOrders].sort((a, b) => (a.month < b.month ? 1 : -1)),
    [staffDayOrders]
  );

  const handleFile = (file: File) => {
    if (!file || !file.type.startsWith('image/')) {
      addToast('Invalid File', 'Please upload an image (PNG/JPG) of the day order schedule.', 'danger');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageUrl(String(reader.result));
      setRawText('');
      setEntries([]);
    };
    reader.readAsDataURL(file);
  };

  const [showDebug, setShowDebug] = useState(false);
  const [ocrDiagnostics, setOcrDiagnostics] = useState<OcrPipelineResult['diagnostics'] | null>(null);

  const runOCR = async () => {
    if (!imageUrl) {
      addToast('No Image', 'Upload a schedule image first.', 'danger');
      return;
    }
    setOcrBusy(true);
    setOcrProgress(0);
    setRawText('');
    setOcrDiagnostics(null);
    try {
      // 1. Preprocess image on HTML canvas
      const preprocessedUrl = await preprocessImageForOcr(imageUrl);

      // 2. Run Tesseract with English + Tamil language model
      const Tesseract = await import('tesseract.js');
      let worker;
      try {
        worker = await Tesseract.createWorker(['eng', 'tam'], 1, {
          logger: (m: { status: string; progress: number }) => {
            if (m.status === 'recognizing text') {
              setOcrProgress(Math.round(m.progress * 100));
            }
          }
        });
      } catch {
        worker = await Tesseract.createWorker('eng', 1, {
          logger: (m: { status: string; progress: number }) => {
            if (m.status === 'recognizing text') {
              setOcrProgress(Math.round(m.progress * 100));
            }
          }
        });
      }

      const { data } = await worker.recognize(preprocessedUrl);
      await worker.terminate();

      const raw = data.text || '';

      // 3. Validate image month header against selected Academic Calendar month/year
      const detectedHeader = detectImageMonthHeader(raw);
      if (detectedHeader) {
        const [selYStr, selMStr] = dayMonth.split('-');
        const selY = Number(selYStr);
        const selM = Number(selMStr);
        const selMonthName = MONTHS[(selM ?? 1) - 1] || 'September';
        const selLabel = `${selMonthName} ${selY}`;

        let isMismatch = false;
        if (detectedHeader.ymStr && detectedHeader.ymStr !== dayMonth) {
          isMismatch = true;
        } else if (!detectedHeader.ymStr && detectedHeader.month && detectedHeader.month !== selM) {
          isMismatch = true;
        }

        if (isMismatch) {
          addToast(
            'Month Mismatch Error',
            `Selected month is ${selLabel}, but the uploaded Staff Order is for ${detectedHeader.label}. Please select the correct month or upload the correct image.`,
            'danger'
          );
          setOcrBusy(false);
          return;
        }
      }

      // 4. Run robust OCR text cleaning, date detection, and row mapping pipeline using target dayMonth
      const result = runOcrParsingPipeline(raw, dayMonth);
      setRawText(result.cleanedText || raw);
      setEntries(result.entries);
      setOcrDiagnostics(result.diagnostics);

      if (result.entries.length === 0) {
        addToast(
          'OCR Extraction Complete',
          'Extracted text successfully. Please review or manually add date rows below.',
          'info'
        );
      } else {
        // Filter validated vs unverified entries
        const validEntries = result.entries.filter(
          (e) => !e.needsVerification && e.date && /^\d{4}-\d{2}-\d{2}$/.test(e.date)
        );
        const needsReviewCount = result.entries.length - validEntries.length;
        const title = dayTitle.trim() || `Monthly Day Order (${dayMonth})`;

        // Auto-save validated entries to database & Academy Calendar
        if (validEntries.length > 0) {
          const trimmedValidated: DayOrderEntry[] = validEntries
            .map((e) => ({
              date: e.date,
              dayName: e.dayName,
              dayOrder: typeof e.dayOrder === 'number' && e.dayOrder >= 1 && e.dayOrder <= 6 ? e.dayOrder : undefined,
              workingDayCount: typeof e.workingDayCount === 'number' ? e.workingDayCount : undefined,
              remark: e.remark,
              isHoliday: !!e.isHoliday,
              holidayTitle: e.isHoliday ? (e.holidayTitle || e.remark || 'Holiday') : undefined,
            }))
            .sort((a, b) => (a.date < b.date ? -1 : 1));

          await saveStaffDayOrder({ month: dayMonth, title, imageUrl, entries: trimmedValidated });
        }

        if (needsReviewCount === 0) {
          addToast('Calendar Updated', 'OCR completed successfully. Calendar updated.', 'success');
          setTimeout(() => {
            setActiveScreen('academic_calendar');
          }, 700);
        } else {
          addToast(
            'OCR Complete with Warnings',
            `OCR processed. ${validEntries.length} validated entries saved to Academy Calendar. ${needsReviewCount} entries require verification below.`,
            'warning'
          );
        }
      }
    } catch (err) {
      console.error('OCR pipeline error:', err);
      addToast('OCR Failed', 'Could not process image text. Please try again.', 'danger');
    } finally {
      setOcrBusy(false);
    }
  };

  const resetDayOrder = () => {
    setImageUrl('');
    setRawText('');
    setEntries([]);
    setDayTitle('');
    setDayMonth(selectedCalendarMonth || '2026-09');
    setEditingSchedule(null);
  };

  const editEntry = (i: number, patch: Partial<DayOrderEntry>) => {
    setEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  };

  const removeEntry = (i: number) => setEntries((prev) => prev.filter((_, idx) => idx !== i));

  const addEntryRow = () => {
    const date = editingSchedule
      ? editingSchedule.entries[editingSchedule.entries.length - 1]?.date || dayMonth + '-01'
      : entries[entries.length - 1]?.date || dayMonth + '-01';
    const lastDate = date.split('-').map(Number);
    const d = new Date(lastDate[0], lastDate[1] - 1, lastDate[2]);
    d.setDate(d.getDate() + 1);
    setEntries((prev) => [
      ...prev,
      { date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, dayOrder: 1, isHoliday: false }
    ]);
  };

  const saveDayOrder = async () => {
    if (entries.length === 0) {
      addToast('No Entries', 'Add at least one date → day order row before saving.', 'danger');
      return;
    }
    const dupe = entries.filter((e, i) => entries.findIndex((x) => x.date === e.date) !== i);
    if (dupe.length > 0) {
      addToast('Duplicate Dates', 'Each date can appear only once in the schedule.', 'danger');
      return;
    }
    const trimmed: DayOrderEntry[] = entries
      .map((e) => ({
        date: e.date,
        dayName: e.dayName,
        dayOrder: typeof e.dayOrder === 'number' && e.dayOrder >= 1 && e.dayOrder <= 6 ? e.dayOrder : undefined,
        workingDayCount: typeof e.workingDayCount === 'number' ? e.workingDayCount : undefined,
        remark: e.remark,
        isHoliday: !!e.isHoliday,
        holidayTitle: e.isHoliday ? (e.holidayTitle || e.remark || 'Holiday') : undefined,
      }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    const title = dayTitle.trim() || `Monthly Day Order`;
    if (editingSchedule) {
      await updateStaffDayOrder({ ...editingSchedule, month: dayMonth, title, imageUrl, entries: trimmed });
      setEditingSchedule(null);
    } else {
      await saveStaffDayOrder({ month: dayMonth, title, imageUrl, entries: trimmed });
    }
    setImageUrl('');
    setRawText('');
    setEntries([]);
    setDayTitle('');

    addToast('Calendar Updated', 'OCR completed successfully. Calendar updated.', 'success');
    setTimeout(() => {
      setActiveScreen('academic_calendar');
    }, 600);
  };

  const loadForEdit = (s: StaffDayOrder) => {
    setEditingSchedule(s);
    setDayMonth(s.month);
    setDayTitle(s.title);
    setImageUrl(s.imageUrl || '');
    setRawText('');
    setEntries(s.entries.map((e) => ({ ...e })));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const todayOrder = entries.find((e) => e.date === todayKey)?.dayOrder;

  return (
    <div className="space-y-6">
      <BackButton />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E2E8F0] dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-[#2563EB]/10 text-[#2563EB] dark:bg-[#2563EB]/50 dark:text-[#3B82F6] text-[10px] font-bold uppercase rounded-md">
              Academic Engine
            </span>
            <span className="text-xs text-[#000000] dark:text-[#64748B] font-semibold">• Day Order OCR</span>
          </div>
          <h2 className="text-xl font-bold text-[#0F172A] dark:text-zinc-100 tracking-tight mt-1">
            Day Order OCR
          </h2>
          <p className="text-xs text-[#000000] dark:text-[#64748B] dark:text-zinc-400 mt-0.5">
            Upload the monthly day order schedule image. The system OCR-extracts date → day order, which you can verify and correct before saving.
          </p>
        </div>
      </div>

      {/* Existing schedules quick edit */}
      {sortedSchedules.length > 0 && (
        <div className="bg-white dark:bg-[#0A0A0A] border border-[#E2E8F0]/80 dark:border-[#232326] rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-2 text-xs font-semibold text-[#000000] dark:text-[#64748B]">
          <span className="flex items-center gap-1">
            <FileText className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#3B82F6]" /> Edit an existing schedule
          </span>
          <select
            value={editingSchedule?.id || ''}
            onChange={(e) => {
              const s = sortedSchedules.find((x) => x.id === e.target.value);
              if (s) loadForEdit(s);
            }}
            className="p-2 text-xs font-semibold bg-[#F7F9FC] dark:bg-zinc-800 border border-[#E2E8F0] dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          >
            <option value="">— Select —</option>
            {sortedSchedules.map((s) => (
              <option key={s.id} value={s.id}>{monthLabel(s.month)} · {s.title}</option>
            ))}
          </select>
          {editingSchedule && (
            <button
              onClick={resetDayOrder}
              className="px-2.5 py-1.5 flex items-center gap-1 text-[10px] font-bold text-[#000000] dark:text-[#64748B] hover:text-rose-500"
            >
              <RotateCcw className="w-3 h-3" /> Cancel Edit
            </button>
          )}
        </div>
      )}

      {/* OCR panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload + OCR */}
        <div className="bg-white dark:bg-[#0A0A0A] border border-[#E2E8F0]/80 dark:border-[#232326] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#0F172A] dark:text-zinc-100 flex items-center gap-2">
              <Upload className="w-4 h-4 text-[#2563EB] dark:text-[#3B82F6]" />
              {editingSchedule ? 'Edit Existing Schedule' : 'Upload Schedule Image'}
            </h3>
            {(imageUrl || editingSchedule) && (
              <button
                onClick={resetDayOrder}
                className="flex items-center gap-1 text-[10px] font-bold text-[#000000] dark:text-[#64748B] hover:text-rose-500"
              >
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#1E293B] dark:text-zinc-300 mb-1">Month</label>
              <input
                type="month"
                value={dayMonth}
                onChange={(e) => {
                  setDayMonth(e.target.value);
                  setSelectedCalendarMonth(e.target.value);
                }}
                className="w-full p-2.5 text-xs bg-[#F7F9FC] dark:bg-zinc-800 border border-[#E2E8F0] dark:border-zinc-700 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1E293B] dark:text-zinc-300 mb-1">Title</label>
              <input
                type="text"
                value={dayTitle}
                onChange={(e) => setDayTitle(e.target.value)}
                placeholder="e.g. September 2026 Day Order"
                className="w-full p-2.5 text-xs bg-[#F7F9FC] dark:bg-zinc-800 border border-[#E2E8F0] dark:border-zinc-700 rounded-xl"
              />
            </div>
          </div>

          <label className="block cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl p-6 text-center hover:border-[#2563EB] dark:hover:border-[#3B82F6] transition-colors">
              {imageUrl ? (
                <div className="space-y-3">
                  <img
                    src={imageUrl}
                    alt="Day order schedule"
                    className="max-h-52 mx-auto rounded-xl border border-[#E2E8F0] dark:border-zinc-700 object-contain bg-[#F7F9FC] dark:bg-zinc-900"
                  />
                  <p className="text-[10px] font-bold text-[#2563EB] dark:text-[#3B82F6] uppercase tracking-wider">
                    <ImageIcon className="inline w-3 h-3 mr-1" /> Image ready — click here to replace
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <ImageIcon className="w-10 h-10 text-zinc-300 dark:text-zinc-600 mx-auto" />
                  <p className="text-xs font-bold text-[#1E293B] dark:text-zinc-300">Drop or click to upload the day order image</p>
                  <p className="text-[10px] text-[#000000] dark:text-[#64748B]">PNG / JPG · Dates and day order numbers should be readable</p>
                </div>
              )}
            </div>
          </label>

          <button
            onClick={runOCR}
            disabled={!imageUrl || ocrBusy}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#2563EB] hover:bg-white text-white hover:text-[#2563EB] dark:bg-[#2563EB] dark:hover:bg-white dark:text-white dark:hover:text-[#2563EB] disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold rounded-xl transition-colors shadow-md"
          >
            {ocrBusy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Extracting day order… {ocrProgress}%
              </>
            ) : (
              <>
                <ScanLine className="w-4 h-4" />
                Extract Date → Day Order with OCR
              </>
            )}
          </button>

          {ocrBusy && (
            <div className="h-1.5 bg-[#F7F9FC] dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#2563EB] dark:bg-[#3B82F6] rounded-full transition-all"
                style={{ width: `${ocrProgress}%` }}
              />
            </div>
          )}

          {rawText && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-[#1E293B] dark:text-zinc-300">
                  Cleaned OCR Text (for reference)
                </label>
                {ocrDiagnostics && (
                  <button
                    type="button"
                    onClick={() => setShowDebug(!showDebug)}
                    className="text-[10px] font-bold text-[#2563EB] dark:text-[#3B82F6] hover:underline"
                  >
                    {showDebug ? 'Hide Diagnostics' : 'Show OCR Diagnostics'}
                  </button>
                )}
              </div>
              <pre className="max-h-36 overflow-auto p-2.5 text-[10px] leading-relaxed text-[#000000] dark:text-[#64748B] bg-[#F7F9FC] dark:bg-zinc-900 border border-[#E2E8F0] dark:border-zinc-800 rounded-xl whitespace-pre-wrap font-mono">
                {rawText}
              </pre>

              {showDebug && ocrDiagnostics && (
                <div className="p-3 bg-zinc-900 text-zinc-100 rounded-xl text-[10px] space-y-1 font-mono border border-zinc-700">
                  <p className="font-bold text-amber-400">OCR Processing Diagnostics:</p>
                  <p>• Lines Processed: {ocrDiagnostics.lineCount}</p>
                  <p>• Dates Detected: {ocrDiagnostics.datesFound}</p>
                  <p>• Table Grid Detected: {ocrDiagnostics.tableColumnsDetected ? 'Yes (| separated)' : 'No (space-aligned)'}</p>
                  <p>• Languages Engine: {ocrDiagnostics.languageUsed}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Extracted entries + save */}
        <div className="bg-white dark:bg-[#0A0A0A] border border-[#E2E8F0]/80 dark:border-[#232326] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#0F172A] dark:text-zinc-100 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-[#2563EB] dark:text-[#3B82F6]" />
              Date → Day Order ({entries.length} entries)
            </h3>
            <button
              onClick={addEntryRow}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-[#F7F9FC] dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-[10px] font-bold rounded-lg text-[#1E293B] dark:text-zinc-200"
            >
              <Plus className="w-3 h-3" /> Add Row
            </button>
          </div>

          {entries.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-[#F7F9FC] dark:bg-zinc-900 border border-dashed border-[#E2E8F0] dark:border-zinc-700">
              <ScanLine className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
              <p className="text-xs font-bold text-[#000000] dark:text-[#64748B] dark:text-zinc-400">No entries yet</p>
              <p className="text-[10px] text-[#000000] dark:text-[#64748B] mt-1">
                Run OCR above, or press “Add Row” to build the schedule manually. Every row can be edited.
              </p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto rounded-xl border border-[#E2E8F0] dark:border-zinc-700">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[#F7F9FC] dark:bg-zinc-900 border-b border-[#E2E8F0] dark:border-zinc-700 uppercase tracking-wider text-[10px] text-[#000000] dark:text-[#64748B] dark:text-zinc-400">
                  <tr>
                    <th className="p-2.5 pl-3 font-bold">{t('calendar.date', 'Date')}</th>
                    <th className="p-2.5 font-bold w-28">{t('calendar.dayOrder', 'Day Order')}</th>
                    <th className="p-2.5 font-bold w-32">{t('common.type', 'Type')}</th>
                    <th className="p-2.5 pr-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {entries.map((e, i) => (
                    <tr key={i} className={e.date === todayKey ? 'bg-[#2563EB]/5 dark:bg-[#2563EB]/20' : ''}>
                      <td className="p-2 pl-3">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="date"
                            value={e.date}
                            onChange={(ev) => editEntry(i, { date: ev.target.value })}
                            className="w-full px-2 py-1.5 text-xs bg-transparent outline-none border border-transparent focus:border-[#2563EB] rounded-lg"
                          />
                          {e.dayName && (
                            <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded">
                              {e.dayName}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-2">
                        {e.isHoliday && e.dayOrder == null ? (
                          <input
                            type="text"
                            value={e.holidayTitle || e.remark || 'Holiday'}
                            onChange={(ev) => editEntry(i, { holidayTitle: ev.target.value, remark: ev.target.value })}
                            className="w-full px-2 py-1.5 text-xs font-bold bg-transparent outline-none border border-transparent focus:border-rose-400 rounded-lg text-rose-600"
                            placeholder="Holiday title"
                          />
                        ) : e.isHoliday && e.dayOrder != null ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={1}
                              max={6}
                              value={e.dayOrder ?? ''}
                              onChange={(ev) => editEntry(i, { dayOrder: parseInt(ev.target.value, 10) || undefined })}
                              className="w-14 px-1.5 py-1 text-xs font-bold bg-transparent outline-none border border-zinc-200 dark:border-zinc-700 focus:border-[#2563EB] rounded-lg text-center"
                              placeholder="DO"
                              title={e.workingDayCount != null ? `Day Order (1-6) · Working Day #${e.workingDayCount}` : 'Day Order (1-6)'}
                            />
                            <input
                              type="text"
                              value={e.holidayTitle || e.remark || 'Holiday'}
                              onChange={(ev) => editEntry(i, { holidayTitle: ev.target.value, remark: ev.target.value })}
                              className="w-full px-2 py-1 text-xs font-bold bg-transparent outline-none border border-transparent focus:border-rose-400 rounded-lg text-rose-600"
                              placeholder="Holiday title"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={1}
                              max={6}
                              value={e.dayOrder ?? ''}
                              onChange={(ev) => editEntry(i, { dayOrder: parseInt(ev.target.value, 10) || undefined })}
                              className="w-20 px-2 py-1.5 text-xs font-bold bg-transparent outline-none border border-transparent focus:border-[#2563EB] rounded-lg"
                              placeholder="—"
                              title={e.workingDayCount != null ? `Working Day #${e.workingDayCount}` : undefined}
                            />
                            {e.workingDayCount != null && (
                              <span className="shrink-0 text-[10px] text-zinc-400 font-semibold" title={`Working Day #${e.workingDayCount}`}>
                                #{e.workingDayCount}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-2">
                        <select
                          value={e.isHoliday ? (e.dayOrder != null ? 'both' : 'holiday') : 'working'}
                          onChange={(ev) => {
                            const val = ev.target.value;
                            if (val === 'holiday') {
                              editEntry(i, { isHoliday: true, holidayTitle: e.holidayTitle || 'Holiday', dayOrder: undefined });
                            } else if (val === 'both') {
                              editEntry(i, { isHoliday: true, holidayTitle: e.holidayTitle || 'Holiday', dayOrder: e.dayOrder || 1 });
                            } else {
                              editEntry(i, { isHoliday: false, holidayTitle: undefined, dayOrder: e.dayOrder || 1 });
                            }
                          }}
                          className="w-full px-2 py-1.5 text-xs font-semibold bg-transparent border border-transparent focus:border-zinc-300 rounded-lg"
                        >
                          <option value="working">Day Order</option>
                          <option value="holiday">Holiday / Leave</option>
                          <option value="both">Both (Day Order &amp; Leave)</option>
                        </select>
                      </td>
                      <td className="p-2 pr-3 text-right">
                        <button
                          onClick={() => removeEntry(i)}
                          className="p-1 text-[#000000] dark:text-[#64748B] hover:text-rose-500"
                          title="Remove"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {todayOrder !== undefined && (
            <div className="p-3 rounded-xl bg-[#2563EB]/10 dark:bg-[#2563EB]/40 text-[11px] font-bold text-[#2563EB] dark:text-[#3B82F6]">
              Today ({todayKey}) has day order <span className="font-extrabold">{todayOrder}</span>
              {entries.length && imageUrl ? ' — will be applied automatically for students & faculty.' : ''}
            </div>
          )}

          <button
            onClick={saveDayOrder}
            disabled={entries.length === 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold rounded-xl transition-colors shadow-md"
          >
            <Save className="w-4 h-4" />
            {editingSchedule ? 'Save Changes' : 'Save Day Order Schedule'}
          </button>
        </div>
      </div>

      {/* View day order schedule modal */}
      <Modal
        isOpen={!!viewingSchedule}
        onClose={() => setViewingSchedule(null)}
        title="Day Order Schedule Details"
        subtitle={viewingSchedule ? monthLabel(viewingSchedule.month) : ''}
      >
        {viewingSchedule && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-[#000000] dark:text-[#64748B] font-bold uppercase tracking-wider text-[10px]">Title</p>
                <p className="font-semibold text-[#0F172A] dark:text-zinc-100 mt-0.5">{viewingSchedule.title}</p>
              </div>
              <div>
                <p className="text-[#000000] dark:text-[#64748B] font-bold uppercase tracking-wider text-[10px]">Entries</p>
                <p className="font-semibold text-[#0F172A] dark:text-zinc-100 mt-0.5">{viewingSchedule.entries.length} days mapped</p>
              </div>
            </div>

            {viewingSchedule.imageUrl && (
              <img
                src={viewingSchedule.imageUrl}
                alt="Schedule"
                className="max-h-40 mx-auto rounded-xl border border-[#E2E8F0] dark:border-zinc-700 object-contain"
              />
            )}

            <div className="max-h-64 overflow-y-auto rounded-xl border border-[#E2E8F0] dark:border-zinc-700">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[#F7F9FC] dark:bg-zinc-900 border-b border-[#E2E8F0] dark:border-zinc-700 uppercase tracking-wider text-[10px] text-[#000000] dark:text-[#64748B] dark:text-zinc-400">
                  <tr>
                    <th className="p-2 pl-3 font-bold">Date</th>
                    <th className="p-2 font-bold">Day Order</th>
                    <th className="p-2 font-bold">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {viewingSchedule.entries.map((e) => (
                    <tr key={e.date}>
                      <td className="p-2 pl-3 font-mono text-[#1E293B] dark:text-zinc-300">
                        {e.date} {e.dayName ? `(${e.dayName})` : ''}
                      </td>
                      <td className="p-2">
                        {e.dayOrder != null ? (
                          <span className="px-2.5 py-0.5 rounded-md bg-[#2563EB]/10 dark:bg-[#2563EB]/40 text-[#2563EB] dark:text-[#3B82F6] font-extrabold">
                            {ROMAN_DAY_ORDERS[e.dayOrder] || e.dayOrder}
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-extrabold">
                            —
                          </span>
                        )}
                        {e.workingDayCount != null && (
                          <span className="ml-1.5 text-[10px] text-zinc-400 font-semibold">
                            (Day #{e.workingDayCount})
                          </span>
                        )}
                      </td>
                      <td className="p-2">
                        {e.isHoliday && e.dayOrder != null ? (
                          <span className="px-2.5 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 font-bold">
                            {e.holidayTitle || e.remark || 'Holiday'} (DO {ROMAN_DAY_ORDERS[e.dayOrder] || e.dayOrder})
                          </span>
                        ) : e.isHoliday || e.remark ? (
                          <span className="px-2.5 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 font-bold">
                            {e.holidayTitle || e.remark || 'Holiday'}
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold">
                            Working
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
