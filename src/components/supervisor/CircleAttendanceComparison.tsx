import React, { useState } from 'react';
import { Circle, Student } from '../../types';
import { repository } from '../../services/storageService';
import {
  PieChart,
  BarChart3,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  Trophy,
  Award,
  Sparkles,
  Users,
} from 'lucide-react';

interface CircleAttendanceComparisonProps {
  circles: Circle[];
  students: Student[];
}

export const CircleAttendanceComparison: React.FC<CircleAttendanceComparisonProps> = ({
  circles,
  students,
}) => {
  const [viewMode, setViewMode] = useState<'circles' | 'arrows'>('circles');

  // Overall average attendance based on students with actual records
  const activeStudents = students.filter((s) => s.active);
  const studentsWithRecords = activeStudents
    .map((s) => repository.getStudentAttendanceStats(s.id))
    .filter((st) => st.hasRecords);

  const hasAnyRecords = studentsWithRecords.length > 0;
  const avgAttendance =
    hasAnyRecords
      ? Math.round(
          studentsWithRecords.reduce((acc, st) => acc + st.attendanceRate, 0) /
            studentsWithRecords.length
        )
      : 0;

  // Compute stats per circle
  const circleStats = circles
    .map((circle) => {
      const cStudents = activeStudents.filter((s) => s.circleId === circle.id);
      const cWithRecords = cStudents
        .map((s) => repository.getStudentAttendanceStats(s.id))
        .filter((st) => st.hasRecords);

      const avgAtt =
        cWithRecords.length > 0
          ? Math.round(
              cWithRecords.reduce((acc, st) => acc + st.attendanceRate, 0) /
                cWithRecords.length
            )
          : 0;
      const totalPoints = cStudents.reduce((acc, s) => acc + s.currentPoints, 0);

      const diffFromAvg = cWithRecords.length > 0 && hasAnyRecords ? avgAtt - avgAttendance : 0;

      return {
        circle,
        studentCount: cStudents.length,
        hasRecords: cWithRecords.length > 0,
        avgAttendance: avgAtt,
        totalPoints,
        diffFromAvg,
      };
    })
    .sort((a, b) => {
      if (b.hasRecords !== a.hasRecords) return b.hasRecords ? 1 : -1;
      return b.avgAttendance - a.avgAttendance;
    });

  const topCircle =
    hasAnyRecords && circleStats[0]?.hasRecords && circleStats[0]?.avgAttendance > 0
      ? circleStats[0]
      : null;

  // SVG Circular Gauge Component
  const renderCircleRing = (percentage: number, hasRecords = true, size = 68, strokeWidth = 6.5) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const clamped = Math.min(100, Math.max(0, percentage));
    const offset = hasRecords ? circumference - (clamped / 100) * circumference : circumference;

    // Distinct vibrant color based on performance
    let strokeColor = '#0d9488'; // teal-600
    if (!hasRecords) strokeColor = '#e2e8f0';
    else if (percentage >= 95) strokeColor = '#059669'; // emerald-600
    else if (percentage >= 85) strokeColor = '#0d9488'; // teal-600
    else if (percentage >= 75) strokeColor = '#d97706'; // amber-600
    else strokeColor = '#e11d48'; // rose-600

    return (
      <div
        className="relative inline-flex items-center justify-center shrink-0"
        style={{ width: size, height: size }}
      >
        <svg className="w-full h-full -rotate-90 transform" viewBox={`0 0 ${size} ${size}`}>
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Animated Progress ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            fill="none"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className={`text-xs sm:text-sm font-black tabular-nums leading-none ${hasRecords ? 'text-slate-800' : 'text-slate-400'}`}>
            {hasRecords ? `${percentage}%` : '—'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs space-y-4">
      {/* Header with View Toggle (دوائر بيانية / أسهم بيانية) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-100">
        <div>
          <h3 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
            <PieChart className="w-4 h-4 text-teal-700" />
            <span>مقارنة نسبة الحضور بين الحلقات</span>
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            متوسط حضور الحلقات العام:{' '}
            <strong className="text-teal-800 font-extrabold">
              {hasAnyRecords ? `${avgAttendance}%` : 'بانتظار رصد الحضور من المعلمين'}
            </strong>
          </p>
        </div>

        {/* View Switcher: دوائر / أسهم بيانية */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/80 shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('circles')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
              viewMode === 'circles'
                ? 'bg-white text-teal-800 shadow-2xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PieChart className="w-3.5 h-3.5" />
            <span>دوائر نسبية</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('arrows')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
              viewMode === 'arrows'
                ? 'bg-white text-teal-800 shadow-2xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>أسهم وأعمدة</span>
          </button>
        </div>
      </div>

      {/* Top Banner: Top Discipline Circle */}
      {topCircle && (
        <div className="bg-gradient-to-l from-teal-50/70 via-emerald-50/50 to-white rounded-xl p-3 border border-teal-200/80 flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center shrink-0 shadow-2xs">
              <Trophy className="w-5 h-5 text-amber-700" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-extrabold text-teal-900 bg-teal-100/70 px-2 py-0.5 rounded-md inline-block">
                الحلقة الأكثر انضباطاً
              </span>
              <h4 className="text-xs sm:text-sm font-black text-slate-900 break-words whitespace-normal leading-snug mt-0.5">
                {topCircle.circle.name} · {topCircle.circle.teacherName}
              </h4>
            </div>
          </div>
          <div className="shrink-0 text-left">
            <span className="text-base sm:text-lg font-black text-emerald-800 tabular-nums block">
              {topCircle.avgAttendance}%
            </span>
            <span className="text-[10px] text-slate-500 font-semibold">حضور قياسي</span>
          </div>
        </div>
      )}

      {/* MODE 1: CIRCULAR GAUGES (دوائر بيانية) */}
      {viewMode === 'circles' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
          {circleStats.map((item, idx) => {
            const isTop = idx === 0;
            const isAbove = item.diffFromAvg > 0;
            const isBelow = item.diffFromAvg < 0;

            return (
              <div
                key={item.circle.id}
                className={`bg-white rounded-2xl p-3.5 border transition-all shadow-2xs hover:shadow-xs flex items-center justify-between gap-3 ${
                  isTop ? 'border-amber-300 bg-gradient-to-b from-amber-50/30 to-white' : 'border-slate-200/90'
                }`}
              >
                {/* Circle details & Arrow Indicator */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {isTop && (
                      <span className="text-xs" title="المركز الأول في الحضور">
                        🥇
                      </span>
                    )}
                    <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                      {item.circle.name}
                    </h4>
                  </div>

                  <p className="text-[11px] text-slate-500 truncate mb-2">
                    {item.circle.teacherName} · <span className="font-semibold text-slate-700">{item.studentCount} طلاب</span>
                  </p>

                  {/* Trend Arrow Indicator vs Average */}
                  {!item.hasRecords ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg shadow-2xs">
                      <span>لم يبدأ الرصد بعد</span>
                    </span>
                  ) : isAbove ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-lg shadow-2xs">
                      <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                      <span>+{item.diffFromAvg}% فوق المتوسط</span>
                    </span>
                  ) : isBelow ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-800 bg-rose-50 border border-rose-200/80 px-2 py-0.5 rounded-lg shadow-2xs">
                      <ArrowDownRight className="w-3.5 h-3.5 text-rose-600 stroke-[2.5]" />
                      <span>{item.diffFromAvg}% دون المتوسط</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg shadow-2xs">
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 stroke-[2.5]" />
                      <span>يماثل المتوسط</span>
                    </span>
                  )}
                </div>

                {/* Circular Gauge Meter */}
                <div className="shrink-0 flex flex-col items-center">
                  {renderCircleRing(item.avgAttendance, item.hasRecords, 66, 6)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODE 2: BAR & ARROW CHART (أسهم وأعمدة بيانية) */}
      {viewMode === 'arrows' && (
        <div className="space-y-4 pt-1">
          {/* Mosque Benchmark Line Legend */}
          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
            <span className="flex items-center gap-1.5 font-bold">
              <span className="w-3 h-0.5 bg-teal-600 border-t-2 border-dashed border-teal-600 inline-block" />
              <span>خط متوسط الحضور ({hasAnyRecords ? `${avgAttendance}%` : 'بانتظار الرصد'})</span>
            </span>
            <span>الهدف الموصى به: 90%+</span>
          </div>

          {/* Vertical Bar Columns with Arrows Container */}
          <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 pt-8">
            <div className="relative">
              {/* Benchmark dashed line across the chart */}
              <div
                className="absolute left-0 right-0 border-b-2 border-dashed border-teal-500/60 z-10 pointer-events-none"
                style={{ bottom: `${Math.min(100, Math.max(0, hasAnyRecords ? avgAttendance : 0))}%` }}
              >
                <span className="absolute -top-4 left-0 text-[10px] font-black text-teal-800 bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200 shadow-2xs">
                  {hasAnyRecords ? `المتوسط ${avgAttendance}%` : 'بانتظار الرصد'}
                </span>
              </div>

              {/* Columns Grid */}
              <div
                className="grid gap-2 sm:gap-3 items-end h-52 pb-1"
                style={{
                  gridTemplateColumns: `repeat(${circleStats.length}, minmax(0, 1fr))`,
                }}
              >
                {circleStats.map((item, idx) => {
                  const isTop = hasAnyRecords && idx === 0 && item.avgAttendance > 0;
                  const isAbove = item.hasRecords && item.diffFromAvg > 0;
                  const isBelow = item.hasRecords && item.diffFromAvg < 0;

                  return (
                    <div
                      key={item.circle.id}
                      className="flex flex-col items-center h-full justify-end group cursor-pointer"
                    >
                      {/* Floating Arrow & Percentage on Top of Column */}
                      <div className="flex flex-col items-center mb-1 transition-transform group-hover:-translate-y-1">
                        {!item.hasRecords ? (
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1 py-0.5 rounded shadow-2xs">
                            —
                          </span>
                        ) : isAbove ? (
                          <span className="flex items-center text-[10px] font-black text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded shadow-2xs">
                            <ArrowUpRight className="w-3 h-3 text-emerald-600 stroke-[3]" />
                            <span>{item.avgAttendance}%</span>
                          </span>
                        ) : isBelow ? (
                          <span className="flex items-center text-[10px] font-black text-rose-700 bg-rose-50 px-1 py-0.5 rounded shadow-2xs">
                            <ArrowDownRight className="w-3 h-3 text-rose-600 stroke-[3]" />
                            <span>{item.avgAttendance}%</span>
                          </span>
                        ) : (
                          <span className="flex items-center text-[10px] font-black text-slate-700 bg-slate-100 px-1 py-0.5 rounded shadow-2xs">
                            <span>{item.avgAttendance}%</span>
                          </span>
                        )}
                      </div>

                      {/* Bar Column */}
                      <div className="w-full max-w-[42px] bg-slate-200/80 rounded-t-xl overflow-hidden flex flex-col justify-end h-36">
                        <div
                          className={`w-full rounded-t-xl transition-all duration-700 relative shadow-xs ${
                            !item.hasRecords
                              ? 'bg-slate-200'
                              : isTop
                              ? 'bg-gradient-to-t from-amber-500 to-amber-300'
                              : item.avgAttendance >= 90
                              ? 'bg-gradient-to-t from-emerald-600 to-emerald-400'
                              : item.avgAttendance >= 80
                              ? 'bg-gradient-to-t from-teal-700 to-teal-500'
                              : 'bg-gradient-to-t from-rose-600 to-rose-400'
                          }`}
                          style={{ height: item.hasRecords ? `${item.avgAttendance}%` : '4%' }}
                        >
                          {isTop && (
                            <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px]">
                              👑
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Circle Name below column */}
                      <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-700 truncate w-full text-center mt-2 group-hover:text-teal-800 transition-colors">
                        {item.circle.name.replace('حلقة ', '')}
                      </span>
                      <span className="text-[9px] text-slate-400 font-medium truncate w-full text-center">
                        {item.studentCount} طلاب
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
