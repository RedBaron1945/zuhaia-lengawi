import React, { useState, useMemo } from 'react';
import { Circle, Student, StudentAttendanceStats } from '../../types';
import { repository } from '../../services/storageService';
import {
  PieChart,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Users,
  Award,
  X,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import {
  formatArabicPoints,
  formatArabicStudents,
  getAttendanceStatusMeta,
} from '../../utils/attendanceThresholds';

export interface CircleComparisonItem {
  circle: Circle;
  teacherName: string;
  students: Student[];
  studentCount: number;
  recordedStudentCount: number;
  hasRecords: boolean;
  avgAttendance: number;
  totalPoints: number;
  diffFromAvg: number;
}

interface CircleAttendanceComparisonProps {
  circles: Circle[];
  students: Student[];
  studentStatsMap: Map<string, StudentAttendanceStats>;
  periodPointsMap?: Map<string, number>;
  periodLabel: string;
}

export const CircleAttendanceComparison: React.FC<CircleAttendanceComparisonProps> = ({
  circles,
  students,
  studentStatsMap,
  periodPointsMap,
  periodLabel,
}) => {
  const [viewMode, setViewMode] = useState<'arrows' | 'circles'>('arrows');
  const [selectedCircleItem, setSelectedCircleItem] =
    useState<CircleComparisonItem | null>(null);

  const teachers = repository.getTeachers();

  const getTeacherName = (circle: Circle): string => {
    if (circle.teacherName?.trim()) return circle.teacherName.trim();
    const matched = teachers.find(
      (t) =>
        t.id === circle.teacherId ||
        (Array.isArray(t.circleIds) && t.circleIds.includes(circle.id))
    );
    return matched?.name?.trim() || 'غير محدد';
  };

  const activeStudents = useMemo(() => students.filter((s) => s.active), [students]);

  // Overall average strictly over started circles / recorded students (unstarted circles excluded)
  const { startedCircles, unstartedCircles, avgAttendance, hasAnyRecords } =
    useMemo(() => {
      const prelim = circles.map((circle) => {
        const cStudents = activeStudents.filter((s) => s.circleId === circle.id);
        const cWithRecords = cStudents
          .map((s) => studentStatsMap.get(s.id))
          .filter((st): st is StudentAttendanceStats => Boolean(st && st.hasRecords));

        const circleAvg =
          cWithRecords.length > 0
            ? Math.round(
                cWithRecords.reduce((acc, st) => acc + st.attendanceRate, 0) /
                  cWithRecords.length
              )
            : 0;

        const totalPoints = cStudents.reduce((acc, s) => {
          const pts = periodPointsMap
            ? periodPointsMap.get(s.id) ?? 0
            : s.currentPoints;
          return acc + pts;
        }, 0);

        return {
          circle,
          teacherName: getTeacherName(circle),
          students: cStudents,
          studentCount: cStudents.length,
          recordedStudentCount: cWithRecords.length,
          hasRecords: cWithRecords.length > 0,
          avgAttendance: circleAvg,
          totalPoints,
        };
      });

      const recordedStudentsAcrossCircles = prelim
        .filter((item) => item.hasRecords)
        .flatMap((item) =>
          item.students
            .map((s) => studentStatsMap.get(s.id))
            .filter((st): st is StudentAttendanceStats => Boolean(st && st.hasRecords))
        );

      const hasAny = recordedStudentsAcrossCircles.length > 0;
      const overallAvg = hasAny
        ? Math.round(
            recordedStudentsAcrossCircles.reduce(
              (acc, st) => acc + st.attendanceRate,
              0
            ) / recordedStudentsAcrossCircles.length
          )
        : 0;

      const withDiff: CircleComparisonItem[] = prelim.map((item) => ({
        ...item,
        diffFromAvg: item.hasRecords && hasAny ? item.avgAttendance - overallAvg : 0,
      }));

      const started = withDiff
        .filter((c) => c.hasRecords)
        .sort(
          (a, b) =>
            b.avgAttendance - a.avgAttendance || b.totalPoints - a.totalPoints
        );
      const unstarted = withDiff.filter((c) => !c.hasRecords);

      return {
        startedCircles: started,
        unstartedCircles: unstarted,
        avgAttendance: overallAvg,
        hasAnyRecords: hasAny,
      };
    }, [circles, activeStudents, studentStatsMap, periodPointsMap, teachers]);

  const showHighestLowest =
    startedCircles.length >= 2 &&
    startedCircles[0].avgAttendance !==
      startedCircles[startedCircles.length - 1].avgAttendance;
  const highestCircle = showHighestLowest ? startedCircles[0] : null;
  const lowestCircle = showHighestLowest
    ? startedCircles[startedCircles.length - 1]
    : null;

  // Unified difference formatter (no "%-", uses points wording e.g. "17 نقطة فوق المتوسط")
  const renderDiffIndicator = (diff: number, hasRecords: boolean) => {
    if (!hasRecords) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
          <Minus className="w-3 h-3 text-slate-300 shrink-0" />
          <span>لم يبدأ الرصد</span>
        </span>
      );
    }

    if (diff > 0) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 tabular-nums">
          <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>{formatArabicPoints(diff)} فوق المتوسط</span>
        </span>
      );
    }

    if (diff < 0) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 tabular-nums">
          <ArrowDownRight className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          <span>{formatArabicPoints(Math.abs(diff))} دون المتوسط</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 tabular-nums">
        <Minus className="w-3 h-3 text-slate-400 shrink-0" />
        <span>يماثل المتوسط</span>
      </span>
    );
  };

  // SVG Circular Gauge colored strictly by shared status thresholds
  const renderCircleRing = (
    percentage: number,
    hasRecords = true,
    size = 64,
    strokeWidth = 6
  ) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const clamped = Math.min(100, Math.max(0, percentage));
    const offset = hasRecords
      ? circumference - (clamped / 100) * circumference
      : circumference;

    const meta = getAttendanceStatusMeta(percentage, hasRecords);

    return (
      <div
        className="relative inline-flex items-center justify-center shrink-0"
        style={{ width: size, height: size }}
      >
        <svg
          className="w-full h-full -rotate-90 transform"
          viewBox={`0 0 ${size} ${size}`}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={meta.gaugeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            fill="none"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span
            className={`text-xs sm:text-sm font-black tabular-nums leading-none ${
              hasRecords ? 'text-slate-800' : 'text-slate-400'
            }`}
          >
            {hasRecords ? `${percentage}%` : '—'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs space-y-4">
      {/* Header + View Switcher (أسهم وأعمدة default first, دوائر نسبية second) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
        <div>
          <h3 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-teal-700 shrink-0" />
            <span>مقارنة نسبة الحضور بين الحلقات</span>
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
            متوسط الحلقات المبدوءة ({periodLabel}):{' '}
            <strong
              className={`font-extrabold ${
                hasAnyRecords ? 'text-teal-800' : 'text-slate-400'
              }`}
            >
              {hasAnyRecords ? `${avgAttendance}%` : 'بانتظار الرصد'}
            </strong>
          </p>
        </div>

        <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/80 shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('arrows')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
              viewMode === 'arrows'
                ? 'bg-white text-teal-800 shadow-2xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>أسهم وأعمدة</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('circles')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
              viewMode === 'circles'
                ? 'bg-white text-teal-800 shadow-2xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PieChart className="w-3.5 h-3.5" />
            <span>دوائر نسبية</span>
          </button>
        </div>
      </div>

      {/* Highest & Lowest Circles (replaces duplicate top card) */}
      {highestCircle && lowestCircle && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => setSelectedCircleItem(highestCircle)}
            className="text-right bg-emerald-50/50 hover:bg-emerald-50 border border-emerald-200/80 rounded-xl p-3 transition-colors cursor-pointer flex items-center justify-between gap-2"
          >
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-emerald-800 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span>الأعلى انضباطاً</span>
              </span>
              <div className="text-xs sm:text-[13px] font-extrabold text-slate-900 break-words whitespace-normal leading-snug mt-0.5">
                {highestCircle.circle.name} · {highestCircle.teacherName}
              </div>
            </div>
            <span className="text-base font-black text-emerald-700 tabular-nums shrink-0">
              {highestCircle.avgAttendance}%
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCircleItem(lowestCircle)}
            className="text-right bg-rose-50/40 hover:bg-rose-50/80 border border-rose-200/80 rounded-xl p-3 transition-colors cursor-pointer flex items-center justify-between gap-2"
          >
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-rose-800 flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5 text-rose-700 shrink-0" />
                <span>الأدنى انضباطاً</span>
              </span>
              <div className="text-xs sm:text-[13px] font-extrabold text-slate-900 break-words whitespace-normal leading-snug mt-0.5">
                {lowestCircle.circle.name} · {lowestCircle.teacherName}
              </div>
            </div>
            <span className="text-base font-black text-rose-700 tabular-nums shrink-0">
              {lowestCircle.avgAttendance}%
            </span>
          </button>
        </div>
      )}

      {/* Empty State when no circle has started recording yet */}
      {startedCircles.length === 0 ? (
        <div className="py-6 px-4 text-center rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
          <p className="text-xs font-bold text-slate-700">
            لا توجد حلقات مرصودة خلال هذه الفترة
          </p>
          <p className="text-[11px] text-slate-500">
            ستظهر مقارنة الحلقات فور قيام المعلمين برصد الحضور.
          </p>
        </div>
      ) : viewMode === 'arrows' ? (
        /* MODE 1 (DEFAULT): Horizontal Bars sorted descending + vertical benchmark line */
        <div className="space-y-2">
          {/* Scale Header with Average Marker */}
          <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold px-1 tabular-nums">
            <span>0%</span>
            <span className="text-teal-800 font-bold">
              خط المتوسط: {avgAttendance}%
            </span>
            <span>100%</span>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden bg-white">
            {startedCircles.map((item) => {
              const meta = getAttendanceStatusMeta(
                item.avgAttendance,
                item.hasRecords
              );
              const clampedWidth = Math.min(
                100,
                Math.max(2, item.avgAttendance)
              );

              return (
                <div
                  key={item.circle.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedCircleItem(item)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedCircleItem(item);
                    }
                  }}
                  className="p-3 hover:bg-slate-50/80 transition-colors cursor-pointer space-y-2"
                >
                  {/* Line 1: Circle Name & Teacher (wraps cleanly, never truncated) */}
                  <div className="text-xs sm:text-[13px] font-extrabold text-slate-900 break-words whitespace-normal leading-snug">
                    {item.circle.name}
                    <span className="text-slate-500 font-medium">
                      {' '}
                      · {item.teacherName}
                    </span>
                  </div>

                  {/* Line 2: Rate & Unified Diff + Horizontal Bar with Vertical Avg Benchmark */}
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span
                        className={`font-black tabular-nums ${meta.textClass}`}
                      >
                        {item.avgAttendance}%
                        <span className="text-[10px] font-semibold text-slate-400 mr-1.5">
                          ({meta.label})
                        </span>
                      </span>
                      {renderDiffIndicator(item.diffFromAvg, item.hasRecords)}
                    </div>

                    {/* Horizontal Bar Track (RTL right-to-left fill) with Vertical Benchmark Line */}
                    <div className="relative h-2.5 w-full bg-slate-100 rounded-full overflow-visible">
                      <div
                        className={`absolute top-0 right-0 h-full rounded-full transition-all duration-500 ${meta.barClass}`}
                        style={{ width: `${clampedWidth}%` }}
                      />
                      {/* Vertical benchmark line at overall average */}
                      <div
                        className="absolute -top-1 -bottom-1 w-0.5 border-r-2 border-dashed border-slate-700/70 z-10 pointer-events-none"
                        style={{
                          right: `${Math.min(100, Math.max(0, avgAttendance))}%`,
                        }}
                        title={`المتوسط العام: ${avgAttendance}%`}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* MODE 2: Circular Gauges (2-line card: Name & Teacher, then Rate & Diff) */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
          {startedCircles.map((item) => {
            const meta = getAttendanceStatusMeta(
              item.avgAttendance,
              item.hasRecords
            );

            return (
              <div
                key={item.circle.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedCircleItem(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedCircleItem(item);
                  }
                }}
                className="bg-white rounded-2xl p-3.5 border border-slate-200/90 hover:border-teal-400 transition-colors cursor-pointer flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  {/* Line 1: Circle Name & Teacher (wraps freely) */}
                  <h4 className="text-xs sm:text-[13px] font-extrabold text-slate-900 break-words whitespace-normal leading-snug">
                    {item.circle.name}
                    <span className="text-slate-500 font-medium block text-[11px]">
                      {item.teacherName}
                    </span>
                  </h4>

                  {/* Line 2: Rate Status & Diff */}
                  <div className="flex flex-col gap-0.5">
                    <span className={`text-[11px] font-bold ${meta.textClass}`}>
                      {meta.label}
                    </span>
                    {renderDiffIndicator(item.diffFromAvg, item.hasRecords)}
                  </div>
                </div>

                {/* Circular Gauge Meter colored by shared threshold */}
                <div className="shrink-0">
                  {renderCircleRing(item.avgAttendance, item.hasRecords, 62, 6)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Unstarted Circles Separate Line */}
      {unstartedCircles.length > 0 && (
        <div className="pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-bold text-slate-600 shrink-0 tabular-nums">
            لم يبدأ رصدها ({unstartedCircles.length}):
          </span>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            {unstartedCircles.map((item, idx) => (
              <React.Fragment key={item.circle.id}>
                <button
                  type="button"
                  onClick={() => setSelectedCircleItem(item)}
                  className="text-slate-600 hover:text-teal-800 hover:underline font-medium cursor-pointer"
                >
                  {item.circle.name} ({item.teacherName})
                </button>
                {idx < unstartedCircles.length - 1 && (
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Circle Details Modal (Student count, total points, and roster) */}
      {selectedCircleItem && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 animate-fade-in"
          onClick={() => setSelectedCircleItem(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-lg w-full max-h-[85vh] overflow-y-auto border border-slate-200 shadow-2xl p-5 space-y-4 text-right"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 break-words whitespace-normal">
                  {selectedCircleItem.circle.name}
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  المعلم: {selectedCircleItem.teacherName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCircleItem(null)}
                aria-label="إغلاق تفاصيل الحلقة"
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 3 Summary Blocks: Student Count, Total Points, Avg Attendance */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200/80">
                <span className="text-[10px] font-bold text-slate-500 flex items-center justify-center gap-1">
                  <Users className="w-3.5 h-3.5 text-teal-700" />
                  <span>عدد الطلاب</span>
                </span>
                <span
                  className={`text-xs sm:text-sm font-black block mt-1 tabular-nums ${
                    selectedCircleItem.studentCount === 0
                      ? 'text-slate-400'
                      : 'text-slate-900'
                  }`}
                >
                  {formatArabicStudents(selectedCircleItem.studentCount)}
                </span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200/80">
                <span className="text-[10px] font-bold text-slate-500 flex items-center justify-center gap-1">
                  <Award className="w-3.5 h-3.5 text-teal-700" />
                  <span>إجمالي النقاط</span>
                </span>
                <span
                  className={`text-xs sm:text-sm font-black block mt-1 tabular-nums ${
                    selectedCircleItem.totalPoints === 0
                      ? 'text-slate-400'
                      : 'text-teal-800'
                  }`}
                >
                  {formatArabicPoints(selectedCircleItem.totalPoints)}
                </span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200/80">
                <span className="text-[10px] font-bold text-slate-500 block">
                  متوسط الحضور
                </span>
                <span
                  className={`text-xs sm:text-sm font-black block mt-1 tabular-nums ${
                    selectedCircleItem.hasRecords
                      ? getAttendanceStatusMeta(
                          selectedCircleItem.avgAttendance,
                          true
                        ).textClass
                      : 'text-slate-400'
                  }`}
                >
                  {selectedCircleItem.hasRecords
                    ? `${selectedCircleItem.avgAttendance}%`
                    : '—'}
                </span>
              </div>
            </div>

            {selectedCircleItem.hasRecords && (
              <div className="flex items-center justify-between text-xs bg-slate-50/70 px-3 py-2 rounded-xl border border-slate-200/70">
                <span className="text-slate-600 font-bold">
                  الحالة:{' '}
                  <span
                    className={
                      getAttendanceStatusMeta(
                        selectedCircleItem.avgAttendance,
                        true
                      ).textClass
                    }
                  >
                    {
                      getAttendanceStatusMeta(
                        selectedCircleItem.avgAttendance,
                        true
                      ).label
                    }
                  </span>
                </span>
                {renderDiffIndicator(
                  selectedCircleItem.diffFromAvg,
                  selectedCircleItem.hasRecords
                )}
              </div>
            )}

            {/* Circle Student Roster */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-extrabold text-slate-700">
                طلاب الحلقة ({selectedCircleItem.studentCount})
              </h4>
              {selectedCircleItem.students.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">
                  لا يوجد طلاب نشطون مسجلون في هذه الحلقة.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden">
                  {[...selectedCircleItem.students]
                    .sort((a, b) => {
                      const ptsA = periodPointsMap
                        ? periodPointsMap.get(a.id) ?? 0
                        : a.currentPoints;
                      const ptsB = periodPointsMap
                        ? periodPointsMap.get(b.id) ?? 0
                        : b.currentPoints;
                      return ptsB - ptsA || a.name.localeCompare(b.name, 'ar');
                    })
                    .map((s) => {
                      const st = studentStatsMap.get(s.id);
                      const pts = periodPointsMap
                        ? periodPointsMap.get(s.id) ?? 0
                        : s.currentPoints;
                      const meta = getAttendanceStatusMeta(
                        st?.attendanceRate || 0,
                        Boolean(st?.hasRecords)
                      );

                      return (
                        <div
                          key={s.id}
                          className="px-3 py-2 flex items-center justify-between gap-2 text-xs bg-white"
                        >
                          <span className="font-bold text-slate-800">
                            {s.name}
                          </span>
                          <div className="flex items-center gap-2 shrink-0 tabular-nums">
                            <span className={`text-[11px] font-bold ${meta.textClass}`}>
                              {st?.hasRecords ? `${st.attendanceRate}%` : '—'}
                            </span>
                            <span className="text-slate-300">·</span>
                            <span
                              className={`font-black ${
                                pts === 0 ? 'text-slate-400' : 'text-teal-800'
                              }`}
                            >
                              {formatArabicPoints(pts)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
