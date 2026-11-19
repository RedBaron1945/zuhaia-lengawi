import React, { useState } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  Calendar,
  Check,
  Lock,
} from 'lucide-react';
import {
  WeekDayInfo,
  formatISODate,
  parseISODate,
  getHijriParts,
  getPreviousCircleDate,
  getNextCircleDate,
  getSundayOfWeek,
  RECORDING_START_DATE,
  getLatestOpenCircleDate,
  getRecordingDateLockReason,
  isDateOpenForRecording,
} from '../../utils/dateUtils';

export interface DayEvaluationCount {
  completed: number;
  recorded: number;
  total: number;
}

interface DateNavigatorProps {
  currentWeekStart: Date;
  selectedDate: string; // YYYY-MM-DD
  weekDays: WeekDayInfo[];
  onSelectDate: (date: string) => void;
  onWeekChange: (newWeekStart: Date, targetDate?: string) => void;
  onResetToToday?: () => void;
  dayEvaluationCounts?: Record<string, DayEvaluationCount>;
  totalStudentsCount?: number;
}

export const DateNavigator: React.FC<DateNavigatorProps> = ({
  selectedDate,
  onSelectDate,
  onWeekChange,
  onResetToToday,
  dayEvaluationCounts = {},
  totalStudentsCount = 0,
}) => {
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [viewMonthAnchor, setViewMonthAnchor] = useState<Date>(() => {
    const parsed = parseISODate(selectedDate);
    return new Date(parsed.getFullYear(), parsed.getMonth(), 1);
  });

  // Find info for currently selected date
  const selectedDateObj = parseISODate(selectedDate);
  const hijriParts = getHijriParts(selectedDateObj);

  const dayName = selectedDateObj.toLocaleDateString('ar-SA', { weekday: 'long' });
  const gregorianShort = selectedDateObj.toLocaleDateString('ar-EG-u-nu-latn', {
    day: 'numeric',
    month: 'long',
  });
  const gregorianMainLine = `${dayName} ${gregorianShort}`;
  const hijriSmallLine = `${hijriParts.day} ${hijriParts.month} ${hijriParts.year} هـ`;

  // Status info for selected date
  const todayISO = formatISODate(new Date());
  const isSelectedToday = selectedDate === todayISO;
  const todayCircleTarget = getLatestOpenCircleDate(todayISO);
  const showTodayButton =
    selectedDate !== todayCircleTarget && isDateOpenForRecording(todayCircleTarget, todayISO);

  const currentEvalInfo = dayEvaluationCounts[selectedDate] || {
    completed: 0,
    recorded: 0,
    total: totalStudentsCount,
  };
  const { completed, recorded, total } = currentEvalInfo;

  const studentLabel =
    total === 0
      ? 'طلاب'
      : total === 1
      ? 'طالب'
      : total === 2
      ? 'طالبين'
      : total <= 10
      ? 'طلاب'
      : 'طالباً';

  const isSelectedComplete = total > 0 && completed === total;
  const hasPartialOrMissing = total > 0 && completed < total;

  const statusText = isSelectedComplete
    ? isSelectedToday
      ? `اكتمل رصد ${completed} من ${total} ${studentLabel} اليوم`
      : `اكتمل رصد ${completed} من ${total} ${studentLabel}`
    : isSelectedToday
    ? `رُصد ${completed} من ${total} ${studentLabel} اليوم`
    : `رُصد ${completed} من ${total} ${studentLabel}`;

  let statusBadgeClass = 'bg-slate-100 text-slate-800 border-slate-300';
  if (isSelectedComplete) {
    statusBadgeClass = 'bg-emerald-100 text-emerald-950 border-emerald-400';
  } else if (hasPartialOrMissing && (recorded > 0 || isDateOpenForRecording(selectedDate, todayISO))) {
    statusBadgeClass =
      recorded > 0
        ? 'bg-orange-50 text-orange-950 border-orange-300'
        : 'bg-slate-100 text-slate-800 border-slate-300';
  }

  // Navigate only between OPEN circle days within [RECORDING_START_DATE, todayISO]
  const prevCircleDate = getPreviousCircleDate(selectedDate);
  const nextCircleDate = getNextCircleDate(selectedDate);
  const canGoPrev = isDateOpenForRecording(prevCircleDate, todayISO);
  const canGoNext = isDateOpenForRecording(nextCircleDate, todayISO);

  const handlePrevCircleDay = () => {
    if (!canGoPrev) return;
    const newSun = getSundayOfWeek(parseISODate(prevCircleDate));
    onWeekChange(newSun, prevCircleDate);
  };

  const handleNextCircleDay = () => {
    if (!canGoNext) return;
    const newSun = getSundayOfWeek(parseISODate(nextCircleDate));
    onWeekChange(newSun, nextCircleDate);
  };

  // Month bounds in the bottom sheet calendar
  const startMonthDate = parseISODate(RECORDING_START_DATE);
  const canShiftPrevMonth =
    viewMonthAnchor.getFullYear() > startMonthDate.getFullYear() ||
    (viewMonthAnchor.getFullYear() === startMonthDate.getFullYear() &&
      viewMonthAnchor.getMonth() > startMonthDate.getMonth());

  const handleShiftCalendarMonth = (monthOffset: number) => {
    if (monthOffset < 0 && !canShiftPrevMonth) return;
    setViewMonthAnchor(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + monthOffset, 1)
    );
  };

  // Calendar month grid generator (full Gregorian month with dynamic 5 or 6 rows)
  const generateMonthGrid = () => {
    const year = viewMonthAnchor.getFullYear();
    const month = viewMonthAnchor.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const lastOfMonth = new Date(year, month + 1, 0);
    const gridStart = getSundayOfWeek(firstOfMonth);
    const totalCells =
      Math.ceil((firstOfMonth.getDay() + lastOfMonth.getDate()) / 7) * 7;

    const days = [];
    for (let i = 0; i < totalCells; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      const iso = formatISODate(d);
      const h = getHijriParts(d);
      const lockReason = getRecordingDateLockReason(iso, todayISO);
      const isOpen = lockReason === 'open';

      const evalInfo = dayEvaluationCounts[iso] || {
        completed: 0,
        recorded: 0,
        total: totalStudentsCount,
      };
      const isComplete = isOpen && evalInfo.total > 0 && evalInfo.completed === evalInfo.total;
      const isIncomplete = isOpen && evalInfo.total > 0 && evalInfo.completed < evalInfo.total;

      const gregorianLabel = d.toLocaleDateString('ar-EG-u-nu-latn', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });

      days.push({
        date: iso,
        dayNumber: d.getDate(),
        hijriDay: h.day,
        gregorianLabel,
        lockReason,
        isOpen,
        isComplete,
        isIncomplete,
        completedCount: evalInfo.completed,
        totalCount: evalInfo.total,
        isToday: iso === todayISO,
        isSelected: iso === selectedDate,
        isCurrentMonth: d.getMonth() === month,
      });
    }
    return days;
  };

  const monthGridDays = generateMonthGrid();
  const monthGregorianTitle = viewMonthAnchor.toLocaleDateString('ar-EG-u-nu-latn', {
    month: 'long',
    year: 'numeric',
  });
  const midMonthDate = new Date(
    viewMonthAnchor.getFullYear(),
    viewMonthAnchor.getMonth(),
    15
  );
  const monthHijriParts = getHijriParts(midMonthDate);

  return (
    <div className="space-y-2 text-right">
      {/* Date Row: 40px Arrows + Gregorian Single Line + Hijri Small */}
      <div className="flex items-center justify-between gap-2 text-center pt-0.5">
        {/* Right Arrow: Previous Open Circle Day */}
        <button
          type="button"
          onClick={handlePrevCircleDay}
          disabled={!canGoPrev}
          className={`w-[40px] h-[40px] min-w-[40px] min-h-[40px] rounded-xl border flex items-center justify-center transition-all shrink-0 shadow-2xs ${
            canGoPrev
              ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800 active:scale-95 cursor-pointer'
              : 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed opacity-60'
          }`}
          title={
            canGoPrev
              ? 'يوم الحلقة السابق'
              : 'بداية الرصد يوم الأحد 15 نوفمبر — الأيام السابقة مغلقة'
          }
          aria-label="يوم الحلقة السابق"
        >
          <ChevronRight className="w-5 h-5 stroke-[2.5]" />
        </button>

        {/* Center Info: Gregorian Single Line + Small Hijri */}
        <div className="flex flex-col items-center justify-center text-center min-w-0 flex-1 px-1">
          <span className="text-base font-extrabold text-slate-900 leading-tight whitespace-nowrap truncate w-full text-center">
            {gregorianMainLine}
          </span>
          <span className="text-xs font-semibold text-slate-500 mt-0.5 whitespace-nowrap truncate w-full text-center">
            {hijriSmallLine}
          </span>
        </div>

        {/* Left Arrow: Next Open Circle Day */}
        <button
          type="button"
          onClick={handleNextCircleDay}
          disabled={!canGoNext}
          className={`w-[40px] h-[40px] min-w-[40px] min-h-[40px] rounded-xl border flex items-center justify-center transition-all shrink-0 shadow-2xs ${
            canGoNext
              ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800 active:scale-95 cursor-pointer'
              : 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed opacity-60'
          }`}
          title={
            canGoNext
              ? 'يوم الحلقة التالي'
              : 'الأيام القادمة مغلقة حتى يحين موعدها'
          }
          aria-label="يوم الحلقة التالي"
        >
          <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>

      {/* Status & Quick Actions Row */}
      <div className="flex items-center justify-center gap-1.5 flex-wrap">
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-black border inline-flex items-center gap-1.5 shadow-2xs tabular-nums ${statusBadgeClass}`}
        >
          {isSelectedComplete && (
            <Check className="w-3.5 h-3.5 text-emerald-700 stroke-[3] shrink-0" />
          )}
          {!isSelectedComplete && hasPartialOrMissing && isDateOpenForRecording(selectedDate, todayISO) && (
            <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
          )}
          <span>{statusText}</span>
        </span>
        <button
          type="button"
          onClick={() => {
            const parsed = parseISODate(selectedDate);
            setViewMonthAnchor(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
            setIsBottomSheetOpen(true);
          }}
          className="text-xs font-extrabold text-teal-800 hover:text-teal-950 underline cursor-pointer inline-flex items-center gap-1 transition-colors min-h-[40px] px-1.5"
        >
          <Calendar className="w-3.5 h-3.5 text-teal-700" />
          <span>يوم آخر</span>
        </button>
        {showTodayButton && onResetToToday && (
          <button
            type="button"
            onClick={onResetToToday}
            className="px-2.5 py-1 rounded-xl text-xs font-extrabold text-amber-900 bg-amber-50/90 hover:bg-amber-100 border border-amber-200/90 cursor-pointer inline-flex items-center justify-center transition-colors min-h-[40px] shrink-0 active:scale-95"
            title="العودة إلى اليوم"
          >
            <span>اليوم</span>
          </button>
        )}
      </div>

      {/* Monthly Calendar Bottom Sheet */}
      {isBottomSheetOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="absolute inset-0" onClick={() => setIsBottomSheetOpen(false)} />

          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4 text-right relative z-10 animate-slide-up max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto sm:hidden mb-1" />

            {/* Header with Month Nav */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <button
                type="button"
                onClick={() => handleShiftCalendarMonth(-1)}
                disabled={!canShiftPrevMonth}
                className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                  canShiftPrevMonth
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 cursor-pointer'
                    : 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed opacity-60'
                }`}
                title={canShiftPrevMonth ? 'الشهر السابق' : 'بداية الرصد في نوفمبر 2026'}
              >
                <ChevronRight className="w-5 h-5 stroke-[2.5]" />
              </button>

              <div className="text-center">
                <h3 className="text-base font-black text-slate-900">
                  {monthGregorianTitle}
                </h3>
                <span className="text-xs font-bold text-slate-500">
                  {monthHijriParts.month} {monthHijriParts.year} هـ
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleShiftCalendarMonth(1)}
                className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer border border-slate-200"
                title="الشهر القادم"
              >
                <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
              </button>
            </div>

            {/* Days of Week Header */}
            <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-slate-500 pb-1">
              <span>أحد</span>
              <span>إثن</span>
              <span>ثلا</span>
              <span>أرب</span>
              <span>خمي</span>
              <span>جمع</span>
              <span>سبت</span>
            </div>

            {/* Grid of Days */}
            <div className="grid grid-cols-7 gap-1.5 text-center">
              {monthGridDays.map((dItem) => {
                // Non-circle days (Thu, Fri, Sat)
                if (dItem.lockReason === 'not_circle_day') {
                  return (
                    <div
                      key={dItem.date}
                      className={`w-[44px] h-[44px] min-w-[44px] min-h-[44px] rounded-xl bg-slate-50 text-slate-300 border border-slate-100 flex flex-col items-center justify-center font-bold mx-auto pointer-events-none cursor-not-allowed tabular-nums ${
                        dItem.isCurrentMonth ? 'opacity-60' : 'opacity-30'
                      }`}
                      title={`${dItem.gregorianLabel} — خارج أيام الحلقات`}
                    >
                      <span className="text-xs leading-none">{dItem.dayNumber}</span>
                    </div>
                  );
                }

                // Locked circle days (before Sunday Nov 15 OR future days > today)
                if (!dItem.isOpen) {
                  const lockTooltip =
                    dItem.lockReason === 'before_start'
                      ? `${dItem.gregorianLabel} — مغلق (يبدأ الرصد من الأحد 15 نوفمبر)`
                      : `${dItem.gregorianLabel} — مغلق (يفتح الرصد في موعده)`;

                  return (
                    <button
                      key={dItem.date}
                      type="button"
                      disabled
                      className={`w-[44px] h-[44px] min-w-[44px] min-h-[44px] rounded-xl bg-slate-100/90 text-slate-400 border border-slate-200/80 flex flex-col items-center justify-center font-bold relative mx-auto cursor-not-allowed tabular-nums ${
                        dItem.isCurrentMonth ? 'opacity-70' : 'opacity-35'
                      }`}
                      title={lockTooltip}
                      aria-label={lockTooltip}
                    >
                      <span className="text-xs leading-none">{dItem.dayNumber}</span>
                      <Lock className="w-2.5 h-2.5 text-slate-400 absolute top-1 left-1" />
                    </button>
                  );
                }

                // Open circle day: Completed (green check) vs Incomplete/Missing (orange dot)
                const openTooltip = dItem.isComplete
                  ? `${dItem.gregorianLabel} — مكتمل الرصد (${dItem.completedCount}/${dItem.totalCount})`
                  : `${dItem.gregorianLabel} — يوجد نقص في الرصد (${dItem.completedCount}/${dItem.totalCount})`;

                return (
                  <button
                    key={dItem.date}
                    type="button"
                    onClick={() => {
                      const newSun = getSundayOfWeek(parseISODate(dItem.date));
                      const currentSun = getSundayOfWeek(parseISODate(selectedDate));
                      if (formatISODate(newSun) === formatISODate(currentSun)) {
                        onSelectDate(dItem.date);
                      } else {
                        onWeekChange(newSun, dItem.date);
                      }
                      setIsBottomSheetOpen(false);
                    }}
                    title={openTooltip}
                    aria-label={openTooltip}
                    className={`w-[44px] h-[44px] min-w-[44px] min-h-[44px] rounded-xl flex flex-col items-center justify-center font-extrabold relative transition-all mx-auto cursor-pointer border shadow-2xs tabular-nums ${
                      dItem.isSelected
                        ? 'bg-teal-800 text-white border-teal-800 font-black scale-105 shadow-md'
                        : dItem.isComplete
                        ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border-emerald-300'
                        : 'bg-white hover:bg-teal-50 text-slate-900 border-teal-300'
                    } ${!dItem.isCurrentMonth && !dItem.isSelected ? 'opacity-55' : ''}`}
                  >
                    <span className="text-sm leading-none">{dItem.dayNumber}</span>
                    <span
                      className={`text-[9px] leading-none mt-0.5 font-semibold ${
                        dItem.isSelected ? 'text-teal-100' : 'text-slate-400'
                      }`}
                    >
                      {dItem.hijriDay}هـ
                    </span>

                    {/* Green checkmark when the day's recording is 100% complete */}
                    {dItem.isComplete && (
                      <span
                        className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center absolute -top-1 -right-1 border border-white shadow-2xs"
                        aria-hidden="true"
                      >
                        <Check className="w-2.5 h-2.5 stroke-[3.2]" />
                      </span>
                    )}

                    {/* Orange dot when the day has missing / incomplete recording */}
                    {dItem.isIncomplete && (
                      <span
                        className="w-2.5 h-2.5 rounded-full bg-orange-500 absolute top-1 right-1 border border-white shadow-2xs"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Compact Calendar Legend */}
            <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] font-bold text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-emerald-600 text-white inline-flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 stroke-[3.2]" />
                </span>
                <span>مكتمل الرصد</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" />
                <span>يوجد نقص</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-slate-400" />
                <span>مغلق</span>
              </span>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsBottomSheetOpen(false)}
              className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm transition-colors cursor-pointer min-h-[44px]"
            >
              إغلاق التقويم
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
