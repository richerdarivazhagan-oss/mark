function detectImageMonthHeader(rawText) {
  if (!rawText) return null;
  const clean = rawText.toLowerCase();

  const monthNamesMap = {
    january: { m: 1, label: 'January' }, jan: { m: 1, label: 'January' }, ஜனவரி: { m: 1, label: 'January' },
    february: { m: 2, label: 'February' }, feb: { m: 2, label: 'February' }, பிப்ரவரி: { m: 2, label: 'February' },
    march: { m: 3, label: 'March' }, mar: { m: 3, label: 'March' }, மார்ச்: { m: 3, label: 'March' },
    april: { m: 4, label: 'April' }, apr: { m: 4, label: 'April' }, ஏப்ரல்: { m: 4, label: 'April' },
    may: { m: 5, label: 'May' }, மே: { m: 5, label: 'May' },
    june: { m: 6, label: 'June' }, jun: { m: 6, label: 'June' }, ஜூன்: { m: 6, label: 'June' },
    july: { m: 7, label: 'July' }, jul: { m: 7, label: 'July' }, ஜூலை: { m: 7, label: 'July' },
    august: { m: 8, label: 'August' }, aug: { m: 8, label: 'August' }, ஆகஸ்ட்: { m: 8, label: 'August' },
    september: { m: 9, label: 'September' }, sept: { m: 9, label: 'September' }, sep: { m: 9, label: 'September' }, செப்டம்பர்: { m: 9, label: 'September' },
    october: { m: 10, label: 'October' }, oct: { m: 10, label: 'October' }, அக்டோபர்: { m: 10, label: 'October' },
    november: { m: 11, label: 'November' }, nov: { m: 11, label: 'November' }, நவம்பர்: { m: 11, label: 'November' },
    december: { m: 12, label: 'December' }, dec: { m: 12, label: 'December' }, டிசம்பர்: { m: 12, label: 'December' }
  };

  const keys = Object.keys(monthNamesMap).sort((a, b) => b.length - a.length);

  for (const key of keys) {
    const regex = new RegExp(`\\b(${key})\\b[\\s,.-]*(\\d{4})|\\b(\\d{4})\\b[\\s,.-]*\\b(${key})\\b`, 'i');
    const match = clean.match(regex);
    if (match) {
      const yearStr = match[2] || match[3] || '2026';
      const year = parseInt(yearStr, 10);
      const info = monthNamesMap[key];
      const ymStr = `${year}-${String(info.m).padStart(2, '0')}`;
      return { year, month: info.m, ymStr, label: `${info.label} ${year}` };
    }
  }

  return null;
}

console.log("Test 1:", detectImageMonthHeader("Monthly Staff Day Order - September 2026"));
console.log("Test 2:", detectImageMonthHeader("மாதாந்திர நாள் வரிசை - அக்டோபர் 2026"));
console.log("Test 3:", detectImageMonthHeader("Staff Order November 2026"));
