import React, { useMemo, useState, useCallback } from 'react';
import { Student, EvaluationRecord, Circle } from '../../types';
import {
  WeekDayInfo,
  shiftWeek,
  getWeekRangeText,
  formatISODate,
  getCircleDaysOfWeek,
  isBeforeRecordingStart,
  isDateOpenForRecording,
} from '../../utils/dateUtils';
import { Award, ChevronRight, ChevronLeft, ChevronDown, ChevronUp, Search, X, Layers, Lock } from 'lucide-react';

interface WeeklySummaryTableProps {
  students: Student[];
  weekDays: WeekDayInfo[];
  weeklyEvaluations: EvaluationRecord[];
  onSelectDay: (date: string) => void;
  currentWeekStart?: Date;
  onWeekChange?: (newWeekStart: Date) => void;
  circles?: Circle[];
}

type WeeklySortMode = 'default' | 'least_recorded';

function getDayRecordingStatus(evalRec?: EvaluationRecord): 'complete' | 'partial' | 'unrecorded' {
  if (!evalRec) return 'unrecorded';

  let recordedCriteria = 0;
  if (evalRec.attendance !== null && evalRec.attendance !== undefined) recordedCriteria++;
  if (typeof evalRec.memorizationScore === 'number') recordedCriteria++;
  if (typeof evalRec.revisionScore === 'number') recordedCriteria++;
  if (typeof evalRec.disciplineScore === 'number') recordedCriteria++;
  if (typeof evalRec.uniformScore === 'number') recordedCriteria++;

  if (recordedCriteria === 5) return 'complete';
  if (recordedCriteria > 0) return 'partial';

  // Legacy evaluation records without individual criterion fields
  const pts =
    typeof evalRec.totalPoints === 'number' ? evalRec.totalPoints : evalRec.pointsAwarded || 0;
  return pts > 0 ? 'complete' : 'unrecorded';
}

export const WeeklySummaryTable: React.FC<WeeklySummaryTableProps> = ({
  students,
  weekDays,
  weeklyEvaluations,
  onSelectDay,
  currentWeekStart,
  onWeekChange,
  circles,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<WeeklySortMode>('default');
  const [expandedStudents, setExpandedStudents] = useState<Record<string, boolean>>({});

  const todayISO = formatISODate(new Date());
  const totalCircleDays = weekDays.length; // 4 circle days (Sunday - Wednesday)
  const maxWeeklyPoints = totalCircleDays * 10; // 40 points max

  const canGoPrevWeek = useMemo(() => {
    if (!currentWeekStart) return false;
    const prevDays = getCircleDaysOfWeek(shiftWeek(currentWeekStart, -1));
    return prevDays.some((d) => isDateOpenForRecording(d.date, todayISO));
  }, [currentWeekStart, todayISO]);

  const canGoNextWeek = useMemo(() => {
    if (!currentWeekStart) return false;
    const nextDays = getCircleDaysOfWeek(shiftWeek(currentWeekStart, 1));
    return nextDays.some((d) => isDateOpenForRecording(d.date, todayISO));
  }, [currentWeekStart, todayISO]);

  const handlePrevWeek = () => {
    if (currentWeekStart && onWeekChange && canGoPrevWeek) {
      onWeekChange(shiftWeek(currentWeekStart, -1));
    }
  };

  const handleNextWeek = () => {
    if (currentWeekStart && onWeekChange && canGoNextWeek) {
      onWeekChange(shiftWeek(currentWeekStart, 1));
    }
  };

  const toggleExpandStudent = useCallback((studentId: string) => {
    setExpandedStudents((prev) => ({
      ...prev,
      [studentId]: !prev[studentId],
    }));
  }, []);

  const weekRangeText = getWeekRangeText(weekDays) || 'السجل الأسبوعي';

  const processedRows = useMemo(() => {
    const evalByStudentDate = new Map<string, EvaluationRecord>();
    weeklyEvaluations.forEach((ev) => {
      evalByStudentDate.set(`${ev.studentId}_${ev.date}`, ev);
    });

    const rows = students.map((student, originalIndex) => {
      let weeklyTotalPoints = 0;
      let recordedDaysCount = 0;

      const dayScores = weekDays.map((d) => {
        const evalRec = evalByStudentDate.get(`${student.id}_${d.date}`);
        const status = getDayRecordingStatus(evalRec);
        const pts = evalRec
          ? typeof evalRec.totalPoints === 'number'
            ? evalRec.totalPoints
            : evalRec.pointsAwarded || 0
          : 0;

        if (status !== 'unrecorded') {
          weeklyTotalPoints += pts;
          recordedDaysCount += 1;
        }

        return {
          date: d.date,
          dayName: d.dayName,
          dayShort: d.dayShort,
          hijriDayNumber: d.hijriDayNumber,
          pts,
          status,
          isToday: d.date === todayISO,
          isFuture: d.date > todayISO,
          isBeforeStart: isBeforeRecordingStart(d.date),
          isLocked: !isDateOpenForRecording(d.date, todayISO),
        };
      });

      return {
        student,
        orderNumber: originalIndex + 1,
        weeklyTotalPoints,
        recordedDaysCount,
        dayScores,
      };
    });

    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? rows.filter((r) => r.student.name.toLowerCase().includes(q))
      : rows;

    if (sortMode === 'least_recorded') {
      return [...filtered].sort((a, b) => {
        if (a.recordedDaysCount !== b.recordedDaysCount) {
          return a.recordedDaysCount - b.recordedDaysCount;
        }
        if (a.weeklyTotalPoints !== b.weeklyTotalPoints) {
          return a.weeklyTotalPoints - b.weeklyTotalPoints;
        }
        return a.orderNumber - b.orderNumber;
      });
    }

    return filtered;
  }, [students, weekDays, weeklyEvaluations, todayISO, searchQuery, sortMode]);

  return (
    <div className="space-y-3 text-right">
      {/* Compact Week Navigation Bar */}
      {currentWeekStart && onWeekChange && (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-2.5 sm:p-3.5 shadow-sm flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handlePrevWeek}
            disabled={!canGoPrevWeek}
            className={`w-10 h-10 min-w-[40px] min-h-[40px] rounded-2xl border flex items-center justify-center transition-all shrink-0 shadow-2xs ${
              canGoPrevWeek
                ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800 active:scale-95 cursor-pointer'
                : 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed opacity-60'
            }`}
            title={
              canGoPrevWeek
                ? 'الأسبوع السابق'
                : 'بداية الرصد يوم الأحد 15 نوفمبر — الأسابيع السابقة مغلقة'
            }
            aria-label="الأسبوع السابق"
          >
            <ChevronRight className="w-5 h-5 stroke-[2.5]" />
          </button>

          <div className="text-center flex-1 min-w-0 px-1">
            <h3 className="text-sm sm:text-base font-black text-slate-900 leading-snug tabular-nums truncate">
              {weekRangeText}
            </h3>
            <p className="text-[11px] sm:text-xs font-bold text-slate-500 mt-0.5 tabular-nums">
              أيام الحلقة (الأحد – الأربعاء) · الحد الأقصى {maxWeeklyPoints} نقطة
            </p>
          </div>

          <button
            type="button"
            onClick={handleNextWeek}
            disabled={!canGoNextWeek}
            className={`w-10 h-10 min-w-[40px] min-h-[40px] rounded-2xl border flex items-center justify-center transition-all shrink-0 shadow-2xs ${
              canGoNextWeek
                ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800 active:scale-95 cursor-pointer'
                : 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed opacity-60'
            }`}
            title={
              canGoNextWeek
                ? 'الأسبوع التالي'
                : 'الأسابيع القادمة مغلقة حتى يحين موعدها'
            }
            aria-label="الأسبوع التالي"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>
      )}

      {/* Main Weekly Summary Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-3.5 sm:p-4 border-b border-slate-100 space-y-3">
          <div className="flex flex-col gap-1">
            <h3 className="text-base sm:text-[18px] font-black text-slate-900 flex items-center gap-1.5">
              <Award className="w-5 h-5 text-teal-800 shrink-0" />
              <span>سجل الأداء والتقييم</span>
            </h3>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs font-bold text-slate-500">
                انقر على اليوم للرصد، أو على الاسم للتفاصيل
              </p>
              <div className="flex items-center gap-2.5 text-[11px] font-bold text-slate-600">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  مكتمل
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                  جزئي
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />
                  لم يُرصد
                </span>
              </div>
            </div>
          </div>

          {/* Search (16px+) + Sort Controls */}
          {students.length > 0 && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث باسم الطالب..."
                  className="w-full pr-9 pl-10 py-2 text-[16px] leading-snug rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-teal-600 focus:outline-hidden min-h-[42px] text-slate-900 placeholder-slate-400"
                  style={{ fontFamily: 'inherit' }}
                  aria-label="بحث باسم الطالب"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute left-0.5 top-1/2 -translate-y-1/2 w-10 h-10 min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer rounded-xl"
                    aria-label="مسح البحث"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setSortMode('default')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-extrabold transition-all min-h-[40px] cursor-pointer ${
                    sortMode === 'default'
                      ? 'bg-white text-teal-950 shadow-2xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  الافتراضي
                </button>
                <button
                  type="button"
                  onClick={() => setSortMode('least_recorded')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-extrabold transition-all min-h-[40px] cursor-pointer ${
                    sortMode === 'least_recorded'
                      ? 'bg-white text-teal-950 shadow-2xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  الأقل رصداً أولاً
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="divide-y divide-slate-100">
          {processedRows.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 font-bold">
              {searchQuery.trim()
                ? `لا توجد نتائج مطابقة لـ "${searchQuery.trim()}"`
                : 'لا يوجد طلاب مسجلون في هذه الحلقة حالياً.'}
            </div>
          ) : circles && circles.length > 1 ? (
            circles.map((circle, cIdx) => {
              const groupRows = processedRows.filter((r) => r.student.circleId === circle.id);
              if (groupRows.length === 0) return null;
              const isSecondaryCircle = cIdx > 0;

              return (
                <div
                  key={circle.id}
                  className={isSecondaryCircle ? 'border-t-4 border-slate-200/90' : ''}
                >
                  <div
                    className={`px-3.5 py-2.5 flex items-center justify-between gap-2 border-b ${
                      cIdx === 0
                        ? 'bg-teal-50/80 border-teal-200/80 text-teal-950'
                        : 'bg-indigo-50/80 border-indigo-200/80 text-indigo-950'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-white ${
                          cIdx === 0 ? 'bg-teal-700' : 'bg-indigo-700'
                        }`}
                      >
                        <Layers className="w-3.5 h-3.5" />
                      </span>
                      <span className="text-xs sm:text-sm font-black truncate">{circle.name}</span>
                    </div>
                    <span className="text-[11px] font-extrabold tabular-nums shrink-0 opacity-80">
                      {groupRows.length} {groupRows.length <= 10 && groupRows.length >= 3 ? 'طلاب' : 'طالباً'}
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {groupRows.map((row, rowIdx) => (
                      <StudentWeeklyRow
                        key={row.student.id}
                        row={{ ...row, orderNumber: rowIdx + 1 }}
                        totalCircleDays={totalCircleDays}
                        maxWeeklyPoints={maxWeeklyPoints}
                        isExpanded={!!expandedStudents[row.student.id]}
                        onToggleExpand={toggleExpandStudent}
                        onSelectDay={onSelectDay}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            processedRows.map((row) => (
              <StudentWeeklyRow
                key={row.student.id}
                row={row}
                totalCircleDays={totalCircleDays}
                maxWeeklyPoints={maxWeeklyPoints}
                isExpanded={!!expandedStudents[row.student.id]}
                onToggleExpand={toggleExpandStudent}
                onSelectDay={onSelectDay}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

interface DayScoreItem {
  date: string;
  dayName: string;
  dayShort: string;
  hijriDayNumber: number;
  pts: number;
  status: 'complete' | 'partial' | 'unrecorded';
  isToday: boolean;
  isFuture: boolean;
  isBeforeStart: boolean;
  isLocked: boolean;
}

interface ProcessedStudentRow {
  student: Student;
  orderNumber: number;
  weeklyTotalPoints: number;
  recordedDaysCount: number;
  dayScores: DayScoreItem[];
}

interface StudentWeeklyRowProps {
  row: ProcessedStudentRow;
  totalCircleDays: number;
  maxWeeklyPoints: number;
  isExpanded: boolean;
  onToggleExpand: (studentId: string) => void;
  onSelectDay: (date: string) => void;
}

const StudentWeeklyRow = React.memo<StudentWeeklyRowProps>(({
  row,
  totalCircleDays,
  maxWeeklyPoints,
  isExpanded,
  onToggleExpand,
  onSelectDay,
}) => {
  const { student, orderNumber, weeklyTotalPoints, recordedDaysCount, dayScores } = row;

  return (
    <div className="px-3 py-2 sm:px-3.5 sm:py-2.5 hover:bg-slate-50/60 transition-colors space-y-1.5">
      {/* Compact Student Header Row: Number + Full Name + "0 / 40" */}
      <button
        type="button"
        onClick={() => onToggleExpand(student.id)}
        aria-expanded={isExpanded}
        className="w-full text-right flex items-center justify-between gap-2 min-h-[40px] cursor-pointer rounded-xl px-1 -mx-1 hover:bg-slate-100/70 transition-colors"
      >
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <span className="w-6 h-6 rounded-lg bg-teal-50 text-teal-900 border border-teal-200/80 text-xs font-black flex items-center justify-center shrink-0 tabular-nums mt-0.5">
            {orderNumber}
          </span>
          <span className="text-[15px] sm:text-base font-black text-slate-900 break-words leading-snug text-right">
            {student.name}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs sm:text-sm font-black text-teal-900 bg-teal-50 px-2.5 py-1 rounded-xl border border-teal-200 tabular-nums">
            {weeklyTotalPoints} / {maxWeeklyPoints}
          </span>
          <span className="text-slate-400 flex items-center justify-center">
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 stroke-[2.5]" />
            ) : (
              <ChevronDown className="w-4 h-4 stroke-[2.5]" />
            )}
          </span>
        </div>
      </button>

      {/* Expanded Student Details: Cumulative Balance & Recording Ratio Clarification */}
      {isExpanded && (
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 flex items-center justify-between gap-2 flex-wrap text-xs font-bold animate-fade-in">
          <span className="text-slate-600 tabular-nums">
            تم رصد {recordedDaysCount} من {totalCircleDays} أيام (أيام الحلقة: الأحد – الأربعاء)
          </span>
          <span className="text-teal-900 font-black tabular-nums">
            الرصيد التراكمي: {student.currentPoints} نقطة
          </span>
        </div>
      )}

      {/* Equal-Width Day Grid (Fits 360px cleanly) */}
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${dayScores.length}, minmax(0, 1fr))` }}
      >
        {dayScores.map((ds) => {
          const dotClass =
            ds.status === 'complete'
              ? 'bg-emerald-500'
              : ds.status === 'partial'
              ? 'bg-amber-400'
              : 'bg-slate-300';

          const cardToneClass = ds.isLocked
            ? 'bg-slate-50/70 border-slate-200/70 text-slate-400 opacity-50 cursor-not-allowed pointer-events-none'
            : ds.isToday
            ? 'bg-teal-50/50 border-2 border-teal-600 ring-1 ring-teal-500/20 text-slate-900 hover:bg-teal-50 cursor-pointer'
            : ds.status === 'complete'
            ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950 hover:bg-emerald-50 cursor-pointer'
            : ds.status === 'partial'
            ? 'bg-amber-50/60 border-amber-200 text-amber-950 hover:bg-amber-50 cursor-pointer'
            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer';

          return (
            <button
              key={ds.date}
              type="button"
              disabled={ds.isLocked}
              onClick={() => {
                if (!ds.isLocked) {
                  onSelectDay(ds.date);
                }
              }}
              className={`px-1 py-1.5 rounded-xl border text-center transition-all min-h-[48px] flex flex-col items-center justify-center gap-0.5 active:scale-95 ${cardToneClass}`}
              title={
                ds.isBeforeStart
                  ? `${ds.dayName} — مغلق (يبدأ الرصد من الأحد 15 نوفمبر)`
                  : ds.isFuture
                  ? `${ds.dayName} — مغلق (يفتح في موعده)`
                  : `${ds.dayName} ${ds.hijriDayNumber} هـ — انقر للرصد`
              }
            >
              <div className="flex items-center justify-center gap-1">
                {ds.isLocked ? (
                  <Lock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                ) : (
                  <span className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} />
                )}
                <span className="text-[11px] font-extrabold leading-tight truncate">
                  {ds.dayShort}
                </span>
              </div>
              <div className="flex items-center justify-center gap-1 text-[11px] tabular-nums leading-tight">
                <span className="font-black text-xs">
                  {ds.status !== 'unrecorded' ? ds.pts : '—'}
                </span>
                <span className="text-[10px] text-slate-400 font-semibold">
                  ({ds.hijriDayNumber})
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});
