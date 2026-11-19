import React, { useMemo, useState } from 'react';
import { Student, StudentAttendanceStats } from '../../types';
import { repository } from '../../services/storageService';
import { useToast } from '../../context/ToastContext';
import { formatISODate, getSundayOfWeek, RECORDING_START_DATE } from '../../utils/dateUtils';
import {
  ATTENDANCE_THRESHOLDS,
  computeAttendanceStatsInRange,
  formatArabicCircles,
  formatArabicPoints,
  formatArabicSessions,
  formatArabicStudents,
  getAttendanceStatusMeta,
  hasStudentAbsences,
  isStudentFollowUp,
  isStudentFollowUpOrAttention,
  isStudentIntervention,
  isStudentRegular,
} from '../../utils/attendanceThresholds';
import {
  Users,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  BookOpen,
  Award,
  AlertCircle,
  Download,
  ArrowLeft,
  Minus,
} from 'lucide-react';
import { CircleAttendanceComparison } from './CircleAttendanceComparison';

export type StatsPeriod = 'week' | 'month' | 'all';

interface SupervisorStatsProps {
  students: Student[];
  onNavigateToAttention?: () => void;
}

const PERIOD_OPTIONS: { id: StatsPeriod; label: string }[] = [
  { id: 'week', label: 'الأسبوع' },
  { id: 'month', label: 'الشهر' },
  { id: 'all', label: 'الكل' },
];

export const SupervisorStats: React.FC<SupervisorStatsProps> = ({
  students,
  onNavigateToAttention,
}) => {
  const [period, setPeriod] = useState<StatsPeriod>('all');
  const { showToast } = useToast();

  const circles = repository.getCircles();
  const transactions = repository.getTransactions();
  const evaluations = repository.getEvaluationsHistory();
  const attendanceRecords = repository.getAttendanceHistory();

  const activeStudents = useMemo(
    () => students.filter((s) => s.active),
    [students]
  );
  const inactiveStudentsCount = Math.max(0, students.length - activeStudents.length);

  // Compute exact current & previous date ranges for period filtering and trend deltas
  const dateRanges = useMemo(() => {
    const now = new Date();
    const todayISO = formatISODate(now);

    if (period === 'week') {
      const curSun = getSundayOfWeek(now);
      const curSunISO = formatISODate(curSun);
      const effectiveCurMin = curSunISO > RECORDING_START_DATE ? curSunISO : RECORDING_START_DATE;
      const prevSun = new Date(curSun);
      prevSun.setDate(prevSun.getDate() - 7);
      const prevSat = new Date(curSun);
      prevSat.setDate(prevSat.getDate() - 1);

      return {
        currentMin: effectiveCurMin,
        currentMax: todayISO,
        trendCurMin: effectiveCurMin,
        trendCurMax: todayISO,
        trendPrevMin: formatISODate(prevSun),
        trendPrevMax: formatISODate(prevSat),
        trendLabel: 'عن الأسبوع السابق',
        periodLabel: 'هذا الأسبوع',
      };
    }

    if (period === 'month') {
      const curMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const curMonthISO = formatISODate(curMonthStart);
      const effectiveCurMin = curMonthISO > RECORDING_START_DATE ? curMonthISO : RECORDING_START_DATE;
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      return {
        currentMin: effectiveCurMin,
        currentMax: todayISO,
        trendCurMin: effectiveCurMin,
        trendCurMax: todayISO,
        trendPrevMin: formatISODate(prevMonthStart),
        trendPrevMax: formatISODate(prevMonthEnd),
        trendLabel: 'عن الشهر السابق',
        periodLabel: 'هذا الشهر',
      };
    }

    // 'all': strictly from RECORDING_START_DATE (2026-11-15) onward
    const recentStart = new Date(now);
    recentStart.setDate(recentStart.getDate() - 6);
    const prevEnd = new Date(recentStart);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - 6);

    return {
      currentMin: RECORDING_START_DATE,
      currentMax: undefined as string | undefined,
      trendCurMin:
        formatISODate(recentStart) > RECORDING_START_DATE
          ? formatISODate(recentStart)
          : RECORDING_START_DATE,
      trendCurMax: todayISO,
      trendPrevMin: formatISODate(prevStart),
      trendPrevMax: formatISODate(prevEnd),
      trendLabel: 'آخر 7 أيام',
      periodLabel: 'من 15 نوفمبر',
    };
  }, [period]);

  // Student attendance stats map for the active period
  // Uses repository.getStudentAttendanceStats(id, period) directly so 'all' matches NeedsAttentionList 1-to-1
  const studentStatsMap = useMemo(() => {
    const map = new Map<string, StudentAttendanceStats>();
    activeStudents.forEach((s) => {
      map.set(s.id, repository.getStudentAttendanceStats(s.id, period));
    });
    return map;
  }, [activeStudents, period]);

  const studentsWithRecords = useMemo(
    () =>
      activeStudents
        .map((s) => ({
          student: s,
          stats: studentStatsMap.get(s.id)!,
        }))
        .filter((item) => item.stats?.hasRecords),
    [activeStudents, studentStatsMap]
  );

  const avgAttendance =
    studentsWithRecords.length > 0
      ? Math.round(
          studentsWithRecords.reduce(
            (acc, item) => acc + item.stats.attendanceRate,
            0
          ) / studentsWithRecords.length
        )
      : 0;

  // Previous-period attendance trend delta
  const attendanceTrend = useMemo(() => {
    let curSum = 0;
    let curCount = 0;
    let prevSum = 0;
    let prevCount = 0;

    activeStudents.forEach((s) => {
      const cur = computeAttendanceStatsInRange(
        s.id,
        evaluations,
        attendanceRecords,
        dateRanges.trendCurMin,
        dateRanges.trendCurMax
      );
      if (cur.hasRecords) {
        curSum += cur.attendanceRate;
        curCount++;
      }
      const prev = computeAttendanceStatsInRange(
        s.id,
        evaluations,
        attendanceRecords,
        dateRanges.trendPrevMin,
        dateRanges.trendPrevMax
      );
      if (prev.hasRecords) {
        prevSum += prev.attendanceRate;
        prevCount++;
      }
    });

    if (curCount === 0 || prevCount === 0) {
      return { hasComparison: false, delta: 0 };
    }
    const curAvg = Math.round(curSum / curCount);
    const prevAvg = Math.round(prevSum / prevCount);
    return { hasComparison: true, delta: curAvg - prevAvg };
  }, [activeStudents, evaluations, attendanceRecords, dateRanges]);

  // Filter transactions by date range
  const filterTxInRange = (min?: string, max?: string) =>
    transactions.filter((t) => {
      const d = (t.date || '').split('T')[0];
      if (!d) return !min && !max;
      if (min && d < min) return false;
      if (max && d > max) return false;
      return true;
    });

  const periodTransactions = useMemo(
    () => filterTxInRange(dateRanges.currentMin, dateRanges.currentMax),
    [transactions, dateRanges]
  );

  const memorizationTxCount = useMemo(
    () => periodTransactions.filter((t) => t.type === 'memorization').length,
    [periodTransactions]
  );
  const revisionTxCount = useMemo(
    () => periodTransactions.filter((t) => t.type === 'revision').length,
    [periodTransactions]
  );

  // Previous-period transaction count trend deltas
  const { memorizationTrend, revisionTrend } = useMemo(() => {
    const curTxs = filterTxInRange(dateRanges.trendCurMin, dateRanges.trendCurMax);
    const prevTxs = filterTxInRange(dateRanges.trendPrevMin, dateRanges.trendPrevMax);

    const curMem = curTxs.filter((t) => t.type === 'memorization').length;
    const prevMem = prevTxs.filter((t) => t.type === 'memorization').length;

    const curRev = curTxs.filter((t) => t.type === 'revision').length;
    const prevRev = prevTxs.filter((t) => t.type === 'revision').length;

    return {
      memorizationTrend:
        prevMem > 0
          ? { hasComparison: true, delta: curMem - prevMem }
          : { hasComparison: false, delta: 0 },
      revisionTrend:
        prevRev > 0
          ? { hasComparison: true, delta: curRev - prevRev }
          : { hasComparison: false, delta: 0 },
    };
  }, [transactions, dateRanges]);

  // Period points per student (used when period !== 'all')
  const periodPointsMap = useMemo(() => {
    const map = new Map<string, number>();
    if (period === 'all') {
      activeStudents.forEach((s) => map.set(s.id, s.currentPoints));
      return map;
    }
    activeStudents.forEach((s) => map.set(s.id, 0));
    periodTransactions.forEach((tx) => {
      if (!map.has(tx.studentId)) return;
      const amt = Number(tx.amount) || 0;
      if (amt > 0) {
        map.set(tx.studentId, (map.get(tx.studentId) || 0) + amt);
      }
    });
    return map;
  }, [activeStudents, period, periodTransactions]);

  // Top 3 students strictly sorted descending by points (with tie-breakers)
  const top3Students = useMemo(() => {
    return [...activeStudents]
      .sort((a, b) => {
        const ptsA =
          period === 'all' ? a.currentPoints : periodPointsMap.get(a.id) ?? 0;
        const ptsB =
          period === 'all' ? b.currentPoints : periodPointsMap.get(b.id) ?? 0;
        if (ptsB !== ptsA) return ptsB - ptsA;
        const rateA = studentStatsMap.get(a.id)?.attendanceRate ?? 0;
        const rateB = studentStatsMap.get(b.id)?.attendanceRate ?? 0;
        if (rateB !== rateA) return rateB - rateA;
        return a.name.localeCompare(b.name, 'ar');
      })
      .slice(0, 3);
  }, [activeStudents, period, periodPointsMap, studentStatsMap]);

  // Shared-threshold discipline summary counts (exact parity with NeedsAttentionList)
  const disciplineCounts = useMemo(() => {
    let regular = 0;
    let followUp = 0;
    let intervention = 0;
    let withAbsences = 0;
    let followUpOrAttention = 0;

    activeStudents.forEach((s) => {
      const st = studentStatsMap.get(s.id);
      if (!st) return;
      if (isStudentRegular(st)) regular++;
      if (isStudentFollowUp(st)) followUp++;
      if (isStudentIntervention(st)) intervention++;
      if (hasStudentAbsences(st)) withAbsences++;
      if (isStudentFollowUpOrAttention(s, st)) followUpOrAttention++;
    });

    return {
      regular,
      followUp,
      intervention,
      withAbsences,
      followUpOrAttention,
    };
  }, [activeStudents, studentStatsMap]);

  const unstartedCirclesCount = useMemo(() => {
    return circles.filter((c) => {
      const cStudents = activeStudents.filter((s) => s.circleId === c.id);
      return !cStudents.some((s) => studentStatsMap.get(s.id)?.hasRecords);
    }).length;
  }, [circles, activeStudents, studentStatsMap]);

  // Export CSV report (with UTF-8 BOM for clean Arabic Excel rendering)
  const handleExportReport = () => {
    const csvEscape = (val: string | number) => {
      const str = String(val ?? '').replace(/"/g, '""');
      return `"${str}"`;
    };

    const lines: string[] = [];
    const todayStr = formatISODate(new Date());

    lines.push([csvEscape('تقرير الإحصائيات الشاملة'), csvEscape(dateRanges.periodLabel), csvEscape(todayStr)].join(','));
    lines.push([csvEscape('إجمالي الطلاب النشطين'), csvEscape(activeStudents.length)].join(','));
    lines.push([csvEscape('متوسط الحضور العام'), csvEscape(studentsWithRecords.length > 0 ? `${avgAttendance}%` : 'لم يبدأ الرصد')].join(','));
    lines.push([csvEscape('جلسات التسميع'), csvEscape(memorizationTxCount)].join(','));
    lines.push([csvEscape('جلسات المراجعة'), csvEscape(revisionTxCount)].join(','));
    lines.push([csvEscape(`منتظمون (≥ ${ATTENDANCE_THRESHOLDS.REGULAR_MIN}%)`), csvEscape(disciplineCounts.regular)].join(','));
    lines.push([csvEscape(`قيد المتابعة (${ATTENDANCE_THRESHOLDS.FOLLOW_UP_MIN}–${ATTENDANCE_THRESHOLDS.REGULAR_MIN - 1}%)`), csvEscape(disciplineCounts.followUp)].join(','));
    lines.push([csvEscape(`يحتاجون تدخلاً (< ${ATTENDANCE_THRESHOLDS.FOLLOW_UP_MIN}%)`), csvEscape(disciplineCounts.intervention)].join(','));
    lines.push([csvEscape('لديهم غياب مسجّل'), csvEscape(disciplineCounts.withAbsences)].join(','));
    lines.push('');

    lines.push(
      [
        'الطالب',
        'الحلقة',
        'المعلم',
        'النقاط',
        'أيام الحضور',
        'أيام الغياب',
        'نسبة الحضور',
        'الحالة',
      ]
        .map(csvEscape)
        .join(',')
    );

    activeStudents.forEach((s) => {
      const c = circles.find((cir) => cir.id === s.circleId);
      const st = studentStatsMap.get(s.id);
      const meta = getAttendanceStatusMeta(
        st?.attendanceRate ?? 0,
        Boolean(st?.hasRecords)
      );
      const pts =
        period === 'all' ? s.currentPoints : periodPointsMap.get(s.id) ?? 0;

      lines.push(
        [
          s.name,
          c?.name || 'عامة',
          c?.teacherName || 'غير محدد',
          pts,
          st?.presentDays ?? 0,
          st?.absentDays ?? 0,
          st?.hasRecords ? `${st.attendanceRate}%` : '—',
          meta.label,
        ]
          .map(csvEscape)
          .join(',')
      );
    });

    const csvContent = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `supervisor-report-${period}-${todayStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('تم تصدير تقرير الإحصائيات بنجاح ✓', 'success');
  };

  const renderTrendBadge = (
    trend: { hasComparison: boolean; delta: number },
    unit: '%' | 'tx'
  ) => {
    if (!trend.hasComparison) {
      return (
        <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
          لا توجد بيانات سابقة للمقارنة
        </span>
      );
    }
    if (trend.delta > 0) {
      return (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 mt-0.5 tabular-nums">
          <TrendingUp className="w-3 h-3 shrink-0" />
          <span>
            +{trend.delta}
            {unit === '%' ? '%' : ''} {dateRanges.trendLabel}
          </span>
        </span>
      );
    }
    if (trend.delta < 0) {
      return (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-700 mt-0.5 tabular-nums">
          <TrendingDown className="w-3 h-3 shrink-0" />
          <span>
            {trend.delta}
            {unit === '%' ? '%' : ''} {dateRanges.trendLabel}
          </span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-slate-500 mt-0.5">
        <Minus className="w-3 h-3 shrink-0" />
        <span>مستقر {dateRanges.trendLabel}</span>
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Toolbar: Period Switcher (الأسبوع / الشهر / الكل) + Export Report */}
      <div className="bg-white rounded-2xl p-2.5 border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-2">
        <div
          className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/70"
          role="group"
          aria-label="تحديد الفترة الزمنية"
        >
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setPeriod(opt.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                period === opt.id
                  ? 'bg-white text-teal-800 shadow-2xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleExportReport}
          className="px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-2xs"
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span>تصدير تقرير</span>
        </button>
      </div>

      {/* Section 1: 4 Summary KPI Cards (Unified Icon Color: text-teal-700, Gray Zeros) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-slate-500">
              إجمالي الطلاب
            </span>
            <Users className="w-4 h-4 text-teal-700 shrink-0" />
          </div>
          <span
            className={`text-xl font-black tabular-nums block ${
              activeStudents.length === 0 ? 'text-slate-400' : 'text-slate-900'
            }`}
          >
            {activeStudents.length}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5 font-medium tabular-nums">
            {formatArabicStudents(activeStudents.length)} نشط
            {inactiveStudentsCount > 0
              ? ` · ${inactiveStudentsCount} غير نشط`
              : ''}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-slate-500">
              متوسط الحضور
            </span>
            <CheckCircle className="w-4 h-4 text-teal-700 shrink-0" />
          </div>
          <span
            className={`text-xl font-black tabular-nums block ${
              studentsWithRecords.length === 0 || avgAttendance === 0
                ? 'text-slate-400'
                : 'text-slate-900'
            }`}
          >
            {studentsWithRecords.length > 0 ? `${avgAttendance}%` : '—'}
          </span>
          {renderTrendBadge(attendanceTrend, '%')}
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-slate-500">
              جلسات التسميع
            </span>
            <BookOpen className="w-4 h-4 text-teal-700 shrink-0" />
          </div>
          <span
            className={`text-xl font-black tabular-nums block ${
              memorizationTxCount === 0 ? 'text-slate-400' : 'text-slate-900'
            }`}
          >
            {memorizationTxCount}
          </span>
          {memorizationTxCount === 0 ? (
            <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">
              {formatArabicSessions(0)} مسجلة
            </span>
          ) : (
            renderTrendBadge(memorizationTrend, 'tx')
          )}
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-slate-500">
              جلسات المراجعة
            </span>
            <Award className="w-4 h-4 text-teal-700 shrink-0" />
          </div>
          <span
            className={`text-xl font-black tabular-nums block ${
              revisionTxCount === 0 ? 'text-slate-400' : 'text-slate-900'
            }`}
          >
            {revisionTxCount}
          </span>
          {revisionTxCount === 0 ? (
            <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">
              {formatArabicSessions(0)} مسجلة
            </span>
          ) : (
            renderTrendBadge(revisionTrend, 'tx')
          )}
        </div>
      </div>

      {/* Section 2: Alert Bar («N طالباً قيد المتابعة · N حلقة لم تبدأ» + View button) */}
      <div
        className={`rounded-2xl px-4 py-3 border flex flex-wrap items-center justify-between gap-2.5 shadow-2xs ${
          disciplineCounts.followUpOrAttention > 0 || unstartedCirclesCount > 0
            ? 'bg-amber-50/70 border-amber-200 text-amber-950'
            : 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <AlertCircle
            className={`w-4 h-4 shrink-0 ${
              disciplineCounts.followUpOrAttention > 0 ||
              unstartedCirclesCount > 0
                ? 'text-amber-700'
                : 'text-emerald-700'
            }`}
          />
          <p className="text-xs sm:text-[13px] font-bold tabular-nums">
            {formatArabicStudents(disciplineCounts.followUpOrAttention)} قيد
            المتابعة · {formatArabicCircles(unstartedCirclesCount)} لم تبدأ
          </p>
        </div>

        {onNavigateToAttention && (
          <button
            type="button"
            onClick={onNavigateToAttention}
            className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-teal-800 text-xs font-extrabold inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-2xs"
          >
            <span>عرض</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Section 3: Circle Attendance Comparison (Horizontal Bars default + Circular Gauges second) */}
      <CircleAttendanceComparison
        circles={circles}
        students={activeStudents}
        studentStatsMap={studentStatsMap}
        periodPointsMap={period === 'all' ? undefined : periodPointsMap}
        periodLabel={dateRanges.periodLabel}
      />

      {/* Section 4: Top 3 Students (sorted desc by points, criterion in title) & Discipline Summary side-by-side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch">
        {/* Top 3 Students by Points */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-extrabold text-slate-900 mb-3 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-teal-700 shrink-0" />
              <span>
                {period === 'all'
                  ? 'أعلى 3 طلاب تميزاً (حسب النقاط)'
                  : period === 'week'
                  ? 'أعلى 3 طلاب تميزاً (حسب نقاط الأسبوع)'
                  : 'أعلى 3 طلاب تميزاً (حسب نقاط الشهر)'}
              </span>
            </h4>

            {top3Students.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                لا يوجد طلاب نشطون حالياً.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {top3Students.map((s, idx) => {
                  const pts =
                    period === 'all'
                      ? s.currentPoints
                      : periodPointsMap.get(s.id) ?? 0;
                  const circle = circles.find((c) => c.id === s.circleId);

                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-2 text-xs py-2.5 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-slate-800 block truncate">
                          {idx + 1}. {s.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium block truncate">
                          {circle?.name || 'عامة'}
                        </span>
                      </div>
                      <span
                        className={`font-black tabular-nums shrink-0 ${
                          pts === 0 ? 'text-slate-400' : 'text-teal-800'
                        }`}
                      >
                        {formatArabicPoints(pts)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Discipline Summary Card with Shared Thresholds & Compact Legend */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between space-y-3">
          <div>
            <h4 className="text-xs font-extrabold text-slate-900 mb-2.5 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-teal-700 shrink-0" />
              <span>موجز الانضباط</span>
            </h4>

            <div className="divide-y divide-slate-100 text-xs text-slate-600 tabular-nums">
              <div className="flex justify-between py-1.5">
                <span>إجمالي الطلاب النشطين:</span>
                <span
                  className={`font-bold ${
                    activeStudents.length === 0
                      ? 'text-slate-400'
                      : 'text-slate-900'
                  }`}
                >
                  {formatArabicStudents(activeStudents.length)}
                </span>
              </div>

              <div className="flex justify-between py-1.5">
                <span>
                  منتظمون (≥ {ATTENDANCE_THRESHOLDS.REGULAR_MIN}%):
                </span>
                <span
                  className={`font-bold ${
                    disciplineCounts.regular === 0
                      ? 'text-slate-400'
                      : 'text-emerald-700'
                  }`}
                >
                  {formatArabicStudents(disciplineCounts.regular)}
                </span>
              </div>

              <div className="flex justify-between py-1.5">
                <span>
                  قيد المتابعة ({ATTENDANCE_THRESHOLDS.FOLLOW_UP_MIN}–
                  {ATTENDANCE_THRESHOLDS.REGULAR_MIN - 1}%):
                </span>
                <span
                  className={`font-bold ${
                    disciplineCounts.followUp === 0
                      ? 'text-slate-400'
                      : 'text-amber-700'
                  }`}
                >
                  {formatArabicStudents(disciplineCounts.followUp)}
                </span>
              </div>

              <div className="flex justify-between py-1.5">
                <span>
                  يحتاجون تدخلاً (&lt; {ATTENDANCE_THRESHOLDS.FOLLOW_UP_MIN}%):
                </span>
                <span
                  className={`font-bold ${
                    disciplineCounts.intervention === 0
                      ? 'text-slate-400'
                      : 'text-rose-700'
                  }`}
                >
                  {formatArabicStudents(disciplineCounts.intervention)}
                </span>
              </div>

              <div className="flex justify-between py-1.5">
                <span>لديهم غياب مسجّل:</span>
                <span
                  className={`font-bold ${
                    disciplineCounts.withAbsences === 0
                      ? 'text-slate-400'
                      : 'text-rose-700'
                  }`}
                >
                  {formatArabicStudents(disciplineCounts.withAbsences)}
                </span>
              </div>
            </div>
          </div>

          {/* Small Legend Key */}
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500 font-medium">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-1.5 rounded-sm bg-emerald-600 inline-block" />
              <span>منتظم ≥ {ATTENDANCE_THRESHOLDS.REGULAR_MIN}%</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-1.5 rounded-sm bg-amber-500 inline-block" />
              <span>
                قيد المتابعة {ATTENDANCE_THRESHOLDS.FOLLOW_UP_MIN}–
                {ATTENDANCE_THRESHOLDS.REGULAR_MIN - 1}%
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-1.5 rounded-sm bg-rose-600 inline-block" />
              <span>يحتاج تدخلاً &lt; {ATTENDANCE_THRESHOLDS.FOLLOW_UP_MIN}%</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
