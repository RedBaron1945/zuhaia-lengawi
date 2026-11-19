import {
  AttendanceRecord,
  EvaluationRecord,
  Student,
  StudentAttendanceStats,
} from '../types';
import { RECORDING_START_DATE } from './dateUtils';

/**
 * Shared attendance status thresholds used across all supervisor, student, and tracking views.
 * - منتظم: ≥ 85%
 * - قيد المتابعة: 70% – 84%
 * - يحتاج تدخلاً: < 70%
 */
export const ATTENDANCE_THRESHOLDS = {
  REGULAR_MIN: 85,
  FOLLOW_UP_MIN: 70,
  CONSECUTIVE_ABSENCES_ALERT: 2,
  DAYS_WITHOUT_LOG_ALERT: 7,
} as const;

export type AttendanceStatusTier =
  | 'regular'
  | 'follow_up'
  | 'needs_intervention'
  | 'unrecorded';

export interface AttendanceStatusMeta {
  tier: AttendanceStatusTier;
  label: string;
  rangeLabel: string;
  gaugeColor: string;
  barClass: string;
  textClass: string;
  chipClass: string;
  dotClass: string;
}

export function getAttendanceStatusTier(
  attendanceRate: number,
  hasRecords: boolean
): AttendanceStatusTier {
  if (!hasRecords) return 'unrecorded';
  if (attendanceRate >= ATTENDANCE_THRESHOLDS.REGULAR_MIN) return 'regular';
  if (attendanceRate >= ATTENDANCE_THRESHOLDS.FOLLOW_UP_MIN) return 'follow_up';
  return 'needs_intervention';
}

export function getAttendanceStatusMeta(
  attendanceRate: number,
  hasRecords: boolean
): AttendanceStatusMeta {
  const tier = getAttendanceStatusTier(attendanceRate, hasRecords);
  switch (tier) {
    case 'regular':
      return {
        tier,
        label: 'منتظم',
        rangeLabel: `≥ ${ATTENDANCE_THRESHOLDS.REGULAR_MIN}%`,
        gaugeColor: '#059669',
        barClass: 'bg-emerald-600',
        textClass: 'text-emerald-700',
        chipClass: 'text-emerald-800 bg-emerald-50 border-emerald-200',
        dotClass: 'bg-emerald-600',
      };
    case 'follow_up':
      return {
        tier,
        label: 'قيد المتابعة',
        rangeLabel: `${ATTENDANCE_THRESHOLDS.FOLLOW_UP_MIN}–${ATTENDANCE_THRESHOLDS.REGULAR_MIN - 1}%`,
        gaugeColor: '#d97706',
        barClass: 'bg-amber-500',
        textClass: 'text-amber-700',
        chipClass: 'text-amber-800 bg-amber-50 border-amber-200',
        dotClass: 'bg-amber-500',
      };
    case 'needs_intervention':
      return {
        tier,
        label: 'يحتاج تدخلاً',
        rangeLabel: `< ${ATTENDANCE_THRESHOLDS.FOLLOW_UP_MIN}%`,
        gaugeColor: '#e11d48',
        barClass: 'bg-rose-600',
        textClass: 'text-rose-700',
        chipClass: 'text-rose-800 bg-rose-50 border-rose-200',
        dotClass: 'bg-rose-600',
      };
    case 'unrecorded':
    default:
      return {
        tier: 'unrecorded',
        label: 'لم يبدأ الرصد',
        rangeLabel: '—',
        gaugeColor: '#cbd5e1',
        barClass: 'bg-slate-200',
        textClass: 'text-slate-400',
        chipClass: 'text-slate-500 bg-slate-100 border-slate-200',
        dotClass: 'bg-slate-300',
      };
  }
}

export function isStudentRegular(stats: StudentAttendanceStats): boolean {
  return (
    getAttendanceStatusTier(stats.attendanceRate, stats.hasRecords) === 'regular'
  );
}

export function isStudentFollowUp(stats: StudentAttendanceStats): boolean {
  return (
    getAttendanceStatusTier(stats.attendanceRate, stats.hasRecords) === 'follow_up'
  );
}

export function isStudentIntervention(stats: StudentAttendanceStats): boolean {
  return (
    getAttendanceStatusTier(stats.attendanceRate, stats.hasRecords) ===
    'needs_intervention'
  );
}

export function hasStudentAbsences(stats: StudentAttendanceStats): boolean {
  return stats.hasRecords && stats.absentDays > 0;
}

/**
 * Matches the exact attention definition used in NeedsAttentionList and SupervisorView tabs.
 */
export function isStudentNeedingAttention(
  student: Student,
  attStats: StudentAttendanceStats
): boolean {
  if (!student.active) return false;
  if (student.attentionReason) return true;
  if (student.consecutiveAbsences >= ATTENDANCE_THRESHOLDS.CONSECUTIVE_ABSENCES_ALERT) {
    return true;
  }
  if (student.daysWithoutLog >= ATTENDANCE_THRESHOLDS.DAYS_WITHOUT_LOG_ALERT) {
    return true;
  }
  return isStudentIntervention(attStats);
}

/**
 * Students needing follow-up or direct intervention (used in the SupervisorStats alert banner).
 */
export function isStudentFollowUpOrAttention(
  student: Student,
  attStats: StudentAttendanceStats
): boolean {
  return (
    isStudentNeedingAttention(student, attStats) || isStudentFollowUp(attStats)
  );
}

/**
 * Computes attendance summary for a student over an explicit [minDate, maxDate] range (inclusive YYYY-MM-DD).
 * Mirrors storageService.getStudentAttendanceStats deduplication logic so period & previous-period metrics align.
 */
export function computeAttendanceStatsInRange(
  studentId: string,
  evals: EvaluationRecord[],
  attendance: AttendanceRecord[],
  minDate?: string,
  maxDate?: string
): { presentDays: number; absentDays: number; totalSessions: number; hasRecords: boolean; attendanceRate: number } {
  const dateStatusMap = new Map<string, 'present' | 'absent' | 'excused'>();

  const effectiveMin =
    minDate && minDate > RECORDING_START_DATE ? minDate : RECORDING_START_DATE;

  const inRange = (dateStr?: string) => {
    if (!dateStr) return false;
    const d = dateStr.split('T')[0];
    if (d < effectiveMin) return false;
    if (maxDate && d > maxDate) return false;
    return true;
  };

  evals.forEach((e) => {
    if (e.studentId !== studentId || !inRange(e.date)) return;
    const dateKey = e.date.split('T')[0];
    const att = e.attendance;
    const attPts = typeof e.attendancePoints === 'number' ? e.attendancePoints : undefined;
    const rawAtt = att as unknown;
    const isPresent =
      att === 'early' ||
      att === 'late' ||
      attPts === 2 ||
      attPts === 1 ||
      rawAtt === 2 ||
      rawAtt === 1 ||
      rawAtt === '2' ||
      rawAtt === '1';
    const isAbsent =
      att === 'absent' || attPts === 0 || rawAtt === 0 || rawAtt === '0';

    if (isPresent) {
      dateStatusMap.set(dateKey, 'present');
    } else if (isAbsent) {
      dateStatusMap.set(dateKey, 'absent');
    }
  });

  attendance.forEach((a) => {
    if (a.studentId !== studentId || !inRange(a.date)) return;
    const dateKey = a.date.split('T')[0];
    if (!dateStatusMap.has(dateKey)) {
      dateStatusMap.set(dateKey, a.status);
    }
  });

  let presentDays = 0;
  let absentDays = 0;

  dateStatusMap.forEach((status) => {
    if (status === 'present') presentDays++;
    else if (status === 'absent') absentDays++;
  });

  const totalSessions = presentDays + absentDays;
  const hasRecords = totalSessions > 0;
  const attendanceRate = hasRecords
    ? Math.round((presentDays / totalSessions) * 100)
    : 0;

  return {
    presentDays,
    absentDays,
    totalSessions,
    hasRecords,
    attendanceRate,
  };
}

interface ArabicNounForms {
  zero: string;
  one: string;
  two: string;
  few: string; // 3..10
  many: string; // 11..99
  hundred: string; // 100, 101, 102, 200...
}

function formatArabicCountedNoun(count: number, forms: ArabicNounForms): string {
  const n = Math.max(0, Math.round(count));
  if (n === 0) return `0 ${forms.zero}`;
  if (n === 1) return `1 ${forms.one}`;
  if (n === 2) return forms.two;

  const rem100 = n % 100;
  if (rem100 >= 3 && rem100 <= 10) return `${n} ${forms.few}`;
  if (rem100 >= 11 && rem100 <= 99) return `${n} ${forms.many}`;
  return `${n} ${forms.hundred}`;
}

export function formatArabicStudents(count: number): string {
  return formatArabicCountedNoun(count, {
    zero: 'طلاب',
    one: 'طالب',
    two: 'طالبان',
    few: 'طلاب',
    many: 'طالباً',
    hundred: 'طالب',
  });
}

export function formatArabicPoints(count: number): string {
  return formatArabicCountedNoun(count, {
    zero: 'نقاط',
    one: 'نقطة',
    two: 'نقطتان',
    few: 'نقاط',
    many: 'نقطة',
    hundred: 'نقطة',
  });
}

export function formatArabicCircles(count: number): string {
  return formatArabicCountedNoun(count, {
    zero: 'حلقات',
    one: 'حلقة',
    two: 'حلقتان',
    few: 'حلقات',
    many: 'حلقة',
    hundred: 'حلقة',
  });
}

export function formatArabicSessions(count: number): string {
  return formatArabicCountedNoun(count, {
    zero: 'جلسات',
    one: 'جلسة',
    two: 'جلستان',
    few: 'جلسات',
    many: 'جلسة',
    hundred: 'جلسة',
  });
}
