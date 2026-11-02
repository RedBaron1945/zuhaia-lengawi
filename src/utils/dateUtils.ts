export interface WeekDayInfo {
  date: string; // YYYY-MM-DD
  dayName: ArabicDayName;
  dayShort: string;
  dayNumber: number; // 1-30 (Hijri)
  isToday: boolean;
  hijriDayNumber: number; // 1-30 (Hijri)
  hijriMonthName: string; // e.g. "ربيع الآخر" or "جمادى الأولى"
  hijriFormatted: string; // e.g. "30 ربيع الآخر"
  hijriFullDate: string; // e.g. "30 ربيع الآخر 1448 هـ"
}

export const HIJRI_MONTHS = [
  'محرم',
  'صفر',
  'ربيع الأول',
  'ربيع الآخر',
  'جمادى الأولى',
  'جمادى الآخرة',
  'رجب',
  'شعبان',
  'رمضان',
  'شوال',
  'ذو القعدة',
  'ذو الحجة',
];

export const ARABIC_WEEKDAYS = [
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
] as const;

export type ArabicDayName = (typeof ARABIC_WEEKDAYS)[number];

export const CIRCLE_DAYS: ArabicDayName[] = [
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
];

/**
 * Returns the exact Arabic day name for any Date or ISO date string (YYYY-MM-DD).
 * Safely parses ISO dates to avoid UTC offset timezone bugs.
 */
export function getArabicDayName(dateInput?: Date | string | null): ArabicDayName {
  if (!dateInput) return 'الأحد';
  try {
    const d =
      typeof dateInput === 'string'
        ? dateInput.includes('T')
          ? new Date(dateInput)
          : parseISODate(dateInput)
        : dateInput;
    const dayIdx = d.getDay();
    return ARABIC_WEEKDAYS[dayIdx] || 'الأحد';
  } catch {
    return 'الأحد';
  }
}

// Helper to get structured Hijri date components
export function getHijriParts(date: Date): {
  day: number;
  month: string;
  year: number;
  formatted: string;
  full: string;
} {
  try {
    const formatter = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const parts = formatter.formatToParts(date);
    let day = 1;
    let month = 'جمادى الأولى';
    let year = 1448;

    for (const p of parts) {
      if (p.type === 'day') day = parseInt(p.value, 10) || 1;
      if (p.type === 'month') month = p.value;
      if (p.type === 'year') year = parseInt(p.value, 10) || 1448;
    }

    return {
      day,
      month,
      year,
      formatted: `${day} ${month}`,
      full: `${day} ${month} ${year} هـ`,
    };
  } catch {
    return {
      day: 1,
      month: 'جمادى الأولى',
      year: 1448,
      formatted: `1 جمادى الأولى`,
      full: `1 جمادى الأولى 1448 هـ`,
    };
  }
}

// Format Hijri date string (e.g. "30 ربيع الآخر 1448 هـ")
export function formatHijriDate(date: Date): string {
  return getHijriParts(date).full;
}

// Format ISO or date string to full Hijri date
export function formatHijriDateString(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = dateStr.includes('T') ? new Date(dateStr) : parseISODate(dateStr);
    return getHijriParts(d).full;
  } catch {
    return dateStr;
  }
}

// Format date to short Hijri string (e.g. "30 ربيع الآخر")
export function formatHijriShortDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = dateStr.includes('T') ? new Date(dateStr) : parseISODate(dateStr);
    return getHijriParts(d).formatted;
  } catch {
    return dateStr;
  }
}

// Format date and time to Hijri
export function formatHijriDateTime(dateInput: Date | string): string {
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    const hijri = getHijriParts(d);
    const timeStr = d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    return `${hijri.formatted} ${hijri.year} هـ · ${timeStr}`;
  } catch {
    return String(dateInput);
  }
}

// Dual or Gregorian backwards compatibility: always returns purely Hijri date
export function formatDualDate(date: Date): string {
  return getHijriParts(date).full;
}

// Formatted Hijri month and year (e.g. "ربيع الآخر 1448 هـ")
export function getArabicMonthYear(date: Date): string {
  const hijri = getHijriParts(date);
  return `${hijri.month} ${hijri.year} هـ`;
}

// Format Date to YYYY-MM-DD for internal keys
export function formatISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Parse YYYY-MM-DD safely
export function parseISODate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Get the Sunday of the week for any given date (Sunday is day 0)
export function getSundayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 is Sunday
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Get the active circle days (Sunday to Thursday) for a given week start date
export function getCircleDaysOfWeek(weekStartDate: Date): WeekDayInfo[] {
  const sunday = getSundayOfWeek(weekStartDate);
  const todayStr = formatISODate(new Date());

  const daysMapping: { name: ArabicDayName; offset: number }[] = [
    { name: 'الأحد', offset: 0 },
    { name: 'الإثنين', offset: 1 },
    { name: 'الثلاثاء', offset: 2 },
    { name: 'الأربعاء', offset: 3 },
    { name: 'الخميس', offset: 4 },
  ];

  return daysMapping.map((item) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + item.offset);
    const iso = formatISODate(d);
    const hijri = getHijriParts(d);

    return {
      date: iso,
      dayName: item.name,
      dayShort: item.name,
      dayNumber: hijri.day, // Purely Hijri day number
      isToday: iso === todayStr,
      hijriDayNumber: hijri.day,
      hijriMonthName: hijri.month,
      hijriFormatted: hijri.formatted,
      hijriFullDate: hijri.full,
    };
  });
}

// Shift week by offset (-1 for previous week, +1 for next week)
export function shiftWeek(currentWeekStart: Date, weekOffset: number): Date {
  const d = new Date(currentWeekStart);
  d.setDate(d.getDate() + weekOffset * 7);
  return d;
}

// Shift month by offset (~4 weeks in Islamic calendar)
export function shiftMonth(currentDate: Date, monthOffset: number): Date {
  const d = new Date(currentDate);
  d.setDate(d.getDate() + monthOffset * 29);
  return getSundayOfWeek(d);
}

// Format week range text purely in Hijri (e.g. "27 - 30 ربيع الآخر 1448 هـ")
export function getWeekRangeText(weekDays: WeekDayInfo[]): string {
  if (!weekDays || weekDays.length === 0) return '';
  const first = parseISODate(weekDays[0].date);
  const last = parseISODate(weekDays[weekDays.length - 1].date);
  const hFirst = getHijriParts(first);
  const hLast = getHijriParts(last);

  if (hFirst.month === hLast.month) {
    return `${hFirst.day} - ${hLast.day} ${hFirst.month} ${hLast.year} هـ`;
  }
  return `${hFirst.day} ${hFirst.month} - ${hLast.day} ${hLast.month} ${hLast.year} هـ`;
}

// Check if a day is today
export function isTodayDate(dateStr: string): boolean {
  return dateStr === formatISODate(new Date());
}


// Format Gregorian date in Arabic (e.g. '18 أكتوبر 2026')
export function formatGregorianArabicDate(dateInput: Date | string): string {
  try {
    const d =
      typeof dateInput === 'string'
        ? dateInput.includes('T')
          ? new Date(dateInput)
          : parseISODate(dateInput)
        : dateInput;
    return d.toLocaleDateString('ar-EG-u-nu-latn', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return String(dateInput);
  }
}

// Get the previous circle day (Sunday through Thursday, skipping Friday & Saturday)
export function getPreviousCircleDate(dateStr: string): string {
  const d = parseISODate(dateStr);
  do {
    d.setDate(d.getDate() - 1);
  } while (d.getDay() === 5 || d.getDay() === 6); // 5=Friday, 6=Saturday
  return formatISODate(d);
}

// Get the next circle day (Sunday through Thursday, skipping Friday & Saturday)
export function getNextCircleDate(dateStr: string): string {
  const d = parseISODate(dateStr);
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() === 5 || d.getDay() === 6); // 5=Friday, 6=Saturday
  return formatISODate(d);
}

// Calculate age from ISO date string (YYYY-MM-DD)
export function calculateAge(birthDate?: string | null): number | null {
  if (!birthDate) return null;
  try {
    const parts = birthDate.split('T')[0].split('-').map(Number);
    if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
      return null;
    }
    const [y, m, d] = parts;
    const today = new Date();
    let age = today.getFullYear() - y;
    const currentMonth = today.getMonth() + 1; // 1-12
    const currentDay = today.getDate();
    if (currentMonth < m || (currentMonth === m && currentDay < d)) {
      age--;
    }
    return age >= 0 && age < 120 ? age : null;
  } catch {
    return null;
  }
}
