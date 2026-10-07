/**
 * Robust OCR Processing & Date/Order Parsing Pipeline
 * Handles English + Tamil text, preprocessing, multi-format date extraction,
 * table grid parsing, multi-line order mapping, and confidence scoring.
 */

export interface ParsedOcrEntry {
  date: string;               // Normalized YYYY-MM-DD format
  rawDateStr: string;          // Original date string in OCR
  dayName?: string;            // Monday, திங்கள், etc.
  dayOrder?: number;           // 1..6 (Day Order I..VI)
  workingDayCount?: number;    // 75, 76, 77...
  remark?: string;             // Event or notes
  isHoliday: boolean;
  holidayTitle?: string;
  confidence: 'high' | 'medium' | 'low';
  needsVerification: boolean;
}

export interface OcrPipelineResult {
  rawText: string;
  cleanedText: string;
  detectedDates: string[];
  entries: ParsedOcrEntry[];
  diagnostics: {
    lineCount: number;
    datesFound: number;
    tableColumnsDetected: boolean;
    languageUsed: string;
  };
}

const MONTH_NAMES_MAP: Record<string, number> = {
  jan: 1, january: 1, ஜனவரி: 1,
  feb: 2, february: 2, பிப்ரவரி: 2,
  mar: 3, march: 3, மார்ச்: 3,
  apr: 4, april: 4, ஏப்ரல்: 4,
  may: 5, மே: 5,
  jun: 6, june: 6, ஜூன்: 6,
  jul: 7, july: 7, ஜூலை: 7,
  aug: 8, august: 8, ஆகஸ்ட்: 8,
  sep: 9, sept: 9, september: 9, செப்டம்பர்: 9,
  oct: 10, october: 10, அக்டோபர்: 10,
  nov: 11, november: 11, நவம்பர்: 11,
  dec: 12, december: 12, டிசம்பர்: 12,
};

export interface DetectedMonthHeader {
  month: number;
  year?: number;
  label: string;
  ymStr?: string;
}

/** Detects if the OCR raw text contains a month/year header (e.g., "September 2026", "அக்டோபர் 2026") */
export function detectImageMonthHeader(rawText: string): DetectedMonthHeader | null {
  if (!rawText) return null;
  const clean = rawText.replace(/\r/g, '');
  const topLines = clean.split('\n').slice(0, 10).join(' ');

  const monthKeys = Object.keys(MONTH_NAMES_MAP).join('|');
  const monthYearRegex = new RegExp(`(?:^|[^\\w\\u0B80-\\u0BFF])(${monthKeys})[\\s,.-]+(20\\d{2})(?:[^\\w\\u0B80-\\u0BFF]|$)|(?:^|[^\\w\\u0B80-\\u0BFF])(20\\d{2})[\\s,.-]+(${monthKeys})(?:[^\\w\\u0B80-\\u0BFF]|$)`, 'i');
  const match = topLines.match(monthYearRegex);

  if (match) {
    const mName = (match[1] || match[4]).toLowerCase();
    const yr = Number(match[2] || match[3]);
    const mNum = MONTH_NAMES_MAP[mName];
    if (mNum && yr >= 2020 && yr <= 2035) {
      const fullMonthNames: Record<number, string> = {
        1: 'January', 2: 'February', 3: 'March', 4: 'April', 5: 'May', 6: 'June',
        7: 'July', 8: 'August', 9: 'September', 10: 'October', 11: 'November', 12: 'December'
      };
      const monthLabel = fullMonthNames[mNum] || mName;
      return {
        month: mNum,
        year: yr,
        label: `${monthLabel} ${yr}`,
        ymStr: `${yr}-${String(mNum).padStart(2, '0')}`
      };
    }
  }

  const monthOnlyRegex = new RegExp(`(?:^|[^\\w\\u0B80-\\u0BFF])(${monthKeys})(?:[^\\w\\u0B80-\\u0BFF]|$)`, 'i');
  const matchOnly = topLines.match(monthOnlyRegex);
  if (matchOnly) {
    const mName = matchOnly[1].toLowerCase();
    const mNum = MONTH_NAMES_MAP[mName];
    if (mNum) {
      const fullMonthNames: Record<number, string> = {
        1: 'January', 2: 'February', 3: 'March', 4: 'April', 5: 'May', 6: 'June',
        7: 'July', 8: 'August', 9: 'September', 10: 'October', 11: 'November', 12: 'December'
      };
      const monthLabel = fullMonthNames[mNum] || mName;
      return {
        month: mNum,
        label: monthLabel
      };
    }
  }

  return null;
}


export const HOLIDAY_KEYWORDS_RE = /விடுமுறை|விடுமுறையும்|அரசு\s*விடுமுறை|வார\s*விடுமுறை|உள்ளூர்\s*விடுமுறை|மிலாடி|காந்தி|விநாயகர்|பூஜை|தீபாவளி|பொங்கல்|திருவள்ளுவர்|உழவர்|குடியரசு|சுதந்திர|புத்தாண்டு|கிறிஸ்துமஸ்|ரம்ஜான்|பக்ரீத்|ஈகை|மஹாவீர்|புனித\s*வெள்ளி|holiday|leave|weekly\s*off|compensatory|vacation|closed|public\s*holiday|government/i;

export const TAMIL_ENGLISH_DAYS = [
  'ஞாயிறு', 'திங்கள்', 'செவ்வாய்', 'புதன்', 'வியாழன்', 'வெள்ளி', 'சனி',
  'ஞாயி', 'திங்', 'செவ்', 'புத', 'வியா', 'வெள்',
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
  'sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'
];

/** Preprocess image on HTML Canvas (scaling, grayscale, contrast) */
export async function preprocessImageForOcr(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(dataUrl);

      // Scale canvas if low resolution for sharper OCR
      const scale = img.width < 1200 ? 2 : 1;
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      // Moderate grayscale & contrast enhancement (preserving Tamil script curves)
      const contrast = 1.2;
      const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

      for (let i = 0; i < data.length; i += 4) {
        // Luminance grayscale
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const adjusted = factor * (gray - 128) + 128;
        const finalVal = Math.min(255, Math.max(0, adjusted));

        data[i] = finalVal;
        data[i + 1] = finalVal;
        data[i + 2] = finalVal;
      }

      ctx.putImageData(imgData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/** Clean OCR text: remove random OCR artifacts while preserving Tamil Unicode & digits */
export function cleanOcrText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\r/g, '')
    // Replace OCR pipe-like noise but preserve genuine delimiters
    .replace(/[§~`^]/g, ' ')
    .replace(/[\t]+/g, ' | ')
    .replace(/ +/g, ' ')
    .trim();
}

/** Robust Date Normalizer: Converts any recognized date into YYYY-MM-DD */
export function normalizeOcrDate(text: string, defaultMonthStr: string): { dateStr: string; raw: string } | null {
  if (!text) return null;
  const clean = text.trim();
  const [defY, defM] = defaultMonthStr.split('-').map(Number);

  // 1. Full Numeric ISO or Standard Dates: 2026-10-01, 01/10/2026, 01.10.2026, 01-10-2026, 1/10/26
  const numDateMatch = clean.match(/\b(\d{1,4})[\/\.\-\|\s]+(\d{1,2})[\/\.\-\|\s]+(\d{2,4})\b/);
  if (numDateMatch) {
    let [, part1, part2, part3] = numDateMatch;
    let y = Number(part3);
    let m = Number(part2);
    let d = Number(part1);

    if (part1.length === 4) {
      // YYYY-MM-DD
      y = Number(part1);
      m = Number(part2);
      d = Number(part3);
    } else if (y < 100) {
      y += 2000;
    }

    if (m > 12 && d <= 12) {
      // Swapped D/M
      const tmp = m;
      m = d;
      d = tmp;
    }

    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 2020 && y <= 2035) {
      return {
        dateStr: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        raw: numDateMatch[0]
      };
    }
  }

  const monthNameKeys = Object.keys(MONTH_NAMES_MAP).join('|');

  // 2. Named Months: Day Month Year (e.g. "1 January 2026", "1 Jan 2026", "1st Jan 2026", "1 அக்டோபர் 2026")
  const dayFirstRegex = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?[\\s/\\.\\-]+(${monthNameKeys})[\\s/\\.\\-]*(\\d{2,4})?\\b`, 'i');
  const dayFirstMatch = clean.match(dayFirstRegex);
  if (dayFirstMatch) {
    const d = Number(dayFirstMatch[1]);
    const mName = dayFirstMatch[2].toLowerCase();
    const m = MONTH_NAMES_MAP[mName];
    let y = dayFirstMatch[3] ? Number(dayFirstMatch[3]) : defY;
    if (y < 100) y += 2000;

    if (m && d >= 1 && d <= 31) {
      return {
        dateStr: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        raw: dayFirstMatch[0]
      };
    }
  }

  // 3. Named Months: Month Day Year (e.g. "January 1, 2026", "Jan 1 2026", "October 1 2026", "அக்டோபர் 1, 2026")
  const monthFirstRegex = new RegExp(`\\b(${monthNameKeys})[\\s/\\.\\-]+(\\d{1,2})(?:st|nd|rd|th)?[,\\s/\\.\-]*(\\d{2,4})?\\b`, 'i');
  const monthFirstMatch = clean.match(monthFirstRegex);
  if (monthFirstMatch) {
    const mName = monthFirstMatch[1].toLowerCase();
    const m = MONTH_NAMES_MAP[mName];
    const d = Number(monthFirstMatch[2]);
    let y = monthFirstMatch[3] ? Number(monthFirstMatch[3]) : defY;
    if (y < 100) y += 2000;

    if (m && d >= 1 && d <= 31) {
      return {
        dateStr: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        raw: monthFirstMatch[0]
      };
    }
  }

  // 4. Standalone Day Number relative to target month (e.g., "1", "02", "31" at start of table line)
  const standaloneDayMatch = clean.match(/^\|?\s*(\d{1,2})\s*(?:\||\b)/);
  if (standaloneDayMatch) {
    const d = Number(standaloneDayMatch[1]);
    if (d >= 1 && d <= 31) {
      return {
        dateStr: `${defY}-${String(defM).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        raw: standaloneDayMatch[1]
      };
    }
  }

  return null;
}

/** Parse Roman Numerals I..VI into number 1..6 with OCR artifact tolerance */
export function parseRomanOrder(text: string): number | null {
  if (!text) return null;
  const clean = text.trim().toUpperCase().replace(/[^IVX\d\-—–_]/g, '');
  if (/^[-—–_]+$/.test(clean) || clean === 'NIL' || clean === 'NONE' || clean === '') {
    return null;
  }
  const romanMap: Record<string, number> = {
    'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6,
    '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6,
    'L': 1, 'LL': 2, 'LLL': 3,
    'IL': 2, 'LI': 2, 'ILL': 3, 'LIL': 3, 'LLI': 3,
    '11': 2, '111': 3, '1111': 4,
    '1V': 4, 'LV': 4, '|V': 4, '!V': 4,
    'V1': 6, 'VL': 6, 'V|': 6, 'V!': 6,
  };
  if (romanMap[clean] != null) return romanMap[clean];

  const converted = clean.replace(/[L1|!]/g, 'I');
  if (romanMap[converted] != null) return romanMap[converted];

  const num = parseInt(clean, 10);
  if (num >= 1 && num <= 6) return num;
  return null;
}

export function isDayName(token: string): boolean {
  if (!token) return false;
  const clean = token.toLowerCase().replace(/[^a-z\u0B80-\u0BFF]/g, '');
  return TAMIL_ENGLISH_DAYS.some((d) => clean.startsWith(d) || d.startsWith(clean));
}

export function classifyTableParts(parts: string[]): {
  dateNum: number | null;
  dayName?: string;
  dayOrder?: number;
  workingDayCount?: number;
  remark?: string;
  isHoliday: boolean;
  holidayTitle?: string;
} {
  let dateNum: number | null = null;
  let dayName: string | undefined = undefined;
  let dayOrder: number | undefined = undefined;
  let workingDayCount: number | undefined = undefined;
  let remark: string | undefined = undefined;
  let isHoliday = false;
  let holidayTitle: string | undefined = undefined;

  if (parts.length === 0) return { dateNum: null, isHoliday: false };

  const remaining = [...parts];

  // 1. First column: Date number (1..31)
  const dMatch = remaining[0].match(/\b(\d{1,2})\b/);
  if (dMatch) {
    const d = parseInt(dMatch[1], 10);
    if (d >= 1 && d <= 31) {
      dateNum = d;
      remaining.shift();
    }
  }
  if (!dateNum) return { dateNum: null, isHoliday: false };

  // 2. Day Name column (if next part matches day name)
  if (remaining.length > 0) {
    for (const dName of TAMIL_ENGLISH_DAYS) {
      if (new RegExp(`\\b${dName}\\b`, 'i').test(remaining[0]) || isDayName(remaining[0])) {
        dayName = remaining[0];
        remaining.shift();
        break;
      }
    }
  }

  // 3. Working Day Count (from last remaining part if numeric >= 7)
  if (remaining.length > 0) {
    const lastPart = remaining[remaining.length - 1].replace(/[^\d]/g, '');
    const wdc = parseInt(lastPart, 10);
    if (!isNaN(wdc) && wdc >= 7) {
      workingDayCount = wdc;
      remaining.pop();
    } else if (/^[-—–_]+$/.test(remaining[remaining.length - 1])) {
      remaining.pop();
    }
  }

  // 4. Inspect remaining parts for Day Order / Remarks
  for (const part of remaining) {
    const trimmed = part.trim();
    if (!trimmed || /^[-—–_]+$/.test(trimmed) || trimmed.toUpperCase() === 'NIL') {
      continue;
    }

    const roman = parseRomanOrder(trimmed);
    if (roman != null && dayOrder === undefined) {
      dayOrder = roman;
    } else {
      remark = remark ? `${remark} ${trimmed}` : trimmed;
      if (HOLIDAY_KEYWORDS_RE.test(trimmed) || /விடுமுறை/i.test(trimmed)) {
        isHoliday = true;
        holidayTitle = trimmed;
      }
    }
  }

  if (isHoliday && !holidayTitle) {
    holidayTitle = remark || 'விடுமுறை';
  }

  return {
    dateNum,
    dayName,
    dayOrder,
    workingDayCount,
    remark: remark || (isHoliday ? holidayTitle : undefined),
    isHoliday,
    holidayTitle,
  };
}

/** Main OCR Parser Pipeline */
export function runOcrParsingPipeline(rawText: string, targetMonth: string): OcrPipelineResult {
  const cleanedText = cleanOcrText(rawText);
  const lines = cleanedText.split('\n').map((l) => l.trim()).filter(Boolean);

  const [fy, fm] = targetMonth.split('-').map(Number);
  const detectedDates: string[] = [];
  const entries: ParsedOcrEntry[] = [];
  const seenDates = new Set<string>();

  let hasTableColumns = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip headers
    if (/^(தேதி|நாள்|வரிσει|வரிசை|பணி|date|day|order|working|total|மொத்த)/i.test(line)) {
      continue;
    }

    if (line.includes('|')) {
      hasTableColumns = true;
    }

    let parts: string[] = [];
    if (line.includes('|')) {
      parts = line.split('|').map((p) => p.trim()).filter(Boolean);
    } else {
      const tokens = line.replace(/^[|.\s-]+|[|.\s-]+$/g, '').split(/\s+/).filter(Boolean);
      parts = tokens;
    }

    const parsed = classifyTableParts(parts);
    if (!parsed.dateNum) continue;

    const dateKey = `${fy}-${String(fm).padStart(2, '0')}-${String(parsed.dateNum).padStart(2, '0')}`;
    if (seenDates.has(dateKey)) continue;
    seenDates.add(dateKey);
    detectedDates.push(dateKey);

    entries.push({
      date: dateKey,
      rawDateStr: String(parsed.dateNum),
      dayName: parsed.dayName,
      dayOrder: parsed.dayOrder,
      workingDayCount: parsed.workingDayCount,
      remark: parsed.remark,
      isHoliday: parsed.isHoliday,
      holidayTitle: parsed.isHoliday ? (parsed.holidayTitle || parsed.remark || 'விடுமுறை') : (parsed.holidayTitle || undefined),
      confidence: 'high',
      needsVerification: false,
    });
  }

  entries.sort((a, b) => (a.date < b.date ? -1 : 1));

  return {
    rawText,
    cleanedText,
    detectedDates,
    entries,
    diagnostics: {
      lineCount: lines.length,
      datesFound: detectedDates.length,
      tableColumnsDetected: hasTableColumns,
      languageUsed: 'eng+tam',
    },
  };
}
