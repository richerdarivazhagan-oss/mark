const TAMIL_ENGLISH_DAYS = [
  'ஞாயிறு', 'திங்கள்', 'செவ்வாய்', 'புதன்', 'வியாழன்', 'வெள்ளி', 'சனி',
  'ஞாயி', 'திங்', 'செவ்', 'புத', 'வியா', 'வெள்',
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
  'sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'
];

const HOLIDAY_KEYWORDS_RE = /விடுமுறை|விடுமுறையும்|அரசு\s*விடுமுறை|வார\s*விடுமுறை|உள்ளூர்\s*விடுமுறை|மிலாடி|காந்தி|விநாயகர்|பூஜை|தீபாவளி|பொங்கல்|திருவள்ளுவர்|உழவர்|குடியரசு|சுதந்திர|புத்தாண்டு|கிறிஸ்துமஸ்|ரம்ஜான்|பக்ரீத்|ஈகை|மஹாவீர்|புனித\s*வெள்ளி|holiday|leave|weekly\s*off|compensatory|vacation|closed|public\s*holiday|government/i;

function parseRomanOrder(text) {
  if (!text) return null;
  const clean = text.trim().toUpperCase().replace(/[^IVX\d\-—–_]/g, '');
  if (/^[-—–_]+$/.test(clean) || clean === 'NIL' || clean === 'NONE' || clean === '') {
    return null;
  }
  const romanMap = {
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

function classifyTableParts(parts) {
  let dateNum = null;
  let dayName = undefined;
  let dayOrder = undefined;
  let workingDayCount = undefined;
  let remark = undefined;
  let isHoliday = false;
  let holidayTitle = undefined;

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
      if (new RegExp(`\\b${dName}\\b`, 'i').test(remaining[0]) || remaining[0].toLowerCase().includes(dName.toLowerCase())) {
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

  // 4. Remaining parts for Day Order / Remarks
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

// Test with 4-part and 5-part rows
const testRows = [
  ["01", "திங்கள்", "-", "III", "57"],
  ["05", "வெள்ளி", "IV", "60"],
  ["06", "சனி", "V", "61"],
  ["07", "ஞாயிறு", "VI", "62"],
  ["08", "திங்கள்", "I", "63"],
  ["09", "செவ்வாய்", "II", "64"],
  ["12", "வெள்ளி", "II", "67"],
  ["13", "சனி", "III", "68"],
  ["14", "ஞாயிறு", "IV", "69"],
  ["15", "திங்கள்", "Model Exam Commencement", "V", "70"],
  ["16", "செவ்வாய்", "VI", "71"],
  ["21", "ஞாயிறு", "I", "76"],
  ["22", "திங்கள்", "II", "77"],
  ["23", "செவ்வாய்", "III", "78"],
  ["26", "வெள்ளி", "IV", "81"],
  ["27", "சனி", "V", "82"],
  ["28", "ஞாயிறு", "VI", "83"],
  ["29", "திங்கள்", "I", "84"],
];

console.log("CLASSIFICATION RESULTS:");
for (const r of testRows) {
  console.log(r.join(" | "), "-->", classifyTableParts(r));
}
