import React, { useState } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  Calendar,
} from 'lucide-react';
import {
  WeekDayInfo,
  formatISODate,
  parseISODate,
  getHijriParts,
  getPreviousCircleDate,
  getNextCircleDate,
  getSundayOfWeek,
  shiftMonth,
  formatGregorianArabicDate,
} from '../../utils/dateUtils';

interface DateNavigatorProps {
  currentWeekStart: Date;
  selectedDate: string; // YYYY-MM-DD
  weekDays: WeekDayInfo[];
  onSelectDate: (date: string) => void;
  onWeekChange: (newWeekStart: Date) => void;
  dayEvaluationCounts?: Record<string, { recorded: number; total: number }>;
}

export const DateNavigator: React.FC<DateNavigatorProps> = ({
  selectedDate,
  onSelectDate,
  onWeekChange,
  dayEvaluationCounts = {},
}) => {
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [viewMonthAnchor, setViewMonthAnchor] = useState<Date>(() => parseISODate(selectedDate));

  // Find info for currently selected date
  const selectedDateObj = parseISODate(selectedDate);
  const hijriParts = getHijriParts(selectedDateObj);

  // Requirement 3: Gregorian Day Name + Day + Month in 1 single non-truncated line
  const dayName = selectedDateObj.toLocaleDateString('ar-SA', { weekday: 'long' });
  const gregorianShort = selectedDateObj.toLocaleDateString('ar-EG-u-nu-latn', {
    day: 'numeric',
    month: 'long',
  });
  const gregorianMainLine = `${dayName} ${gregorianShort}`; // e.g., "الأحد 18 أكتوبر"
  const hijriSmallLine = `${hijriParts.day} ${hijriParts.month} ${hijriParts.year} هـ`; // e.g., "٧ جمادى الأولى 1448 هـ"

  // Status info for selected date
  const currentEvalInfo = dayEvaluationCounts[selectedDate] || { recorded: 0, total: 0 };
  const { recorded, total } = currentEvalInfo;

  let statusText = 'لم تُرصد بعد';
  let statusBadgeClass = 'bg-slate-100 text-slate-800 border-slate-300';

  if (recorded > 0 && recorded === total && total > 0) {
    statusText = 'تم الرصد ✓';
    statusBadgeClass = 'bg-emerald-100 text-emerald-950 border-emerald-400';
  } else if (recorded > 0 && recorded < total) {
    statusText = 'مرصود جزئياً';
    statusBadgeClass = 'bg-amber-100 text-amber-950 border-amber-400';
  }

  // Navigate only between circle days (Sun, Mon, Tue, Wed)
  const handlePrevCircleDay = () => {
    const prevDate = getPreviousCircleDate(selectedDate);
    const newSun = getSundayOfWeek(parseISODate(prevDate));
    onWeekChange(newSun);
    onSelectDate(prevDate);
  };

  const handleNextCircleDay = () => {
    const nextDate = getNextCircleDate(selectedDate);
    const newSun = getSundayOfWeek(parseISODate(nextDate));
    onWeekChange(newSun);
    onSelectDate(nextDate);
  };

  // Calendar month grid generator
  const generateMonthGrid = () => {
    const firstOfMonth = new Date(viewMonthAnchor.getFullYear(), viewMonthAnchor.getMonth(), 1);
    const gridStart = getSundayOfWeek(firstOfMonth);

    const days = [];
    for (let i = 0; i < 35; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      const iso = formatISODate(d);
      const h = getHijriParts(d);
      const dayOfWeek = d.getDay();
      const isCircleDay = dayOfWeek <= 3; // 0=Sun, 1=Mon, 2=Tue, 3=Wed
      const evalInfo = dayEvaluationCounts[iso];
      const isRecorded = evalInfo && evalInfo.recorded > 0;
      const isUnrecordedCircleDay = isCircleDay && (!evalInfo || evalInfo.recorded === 0);

      days.push({
        date: iso,
        dateObj: d,
        dayNumber: d.getDate(),
        hijriDay: h.day,
        isCircleDay,
        isRecorded,
        isUnrecordedCircleDay,
        isSelected: iso === selectedDate,
        isCurrentMonth: d.getMonth() === viewMonthAnchor.getMonth(),
      });
    }
    return days;
  };

  const monthGridDays = generateMonthGrid();
  const monthHijriParts = getHijriParts(viewMonthAnchor);

  return (
    <div className="space-y-2 text-right">
      {/* Date Row: 40px Arrows + "الأحد 18 أكتوبر" (Single Line) + Hijri Small + Status Badge */}
      <div className="flex items-center justify-between gap-2 text-center py-1">
        {/* Right Arrow (40px) */}
        <button
          type="button"
          onClick={handlePrevCircleDay}
          className="w-[40px] h-[40px] min-w-[40px] min-h-[40px] rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0 shadow-2xs"
          title="يوم الحلقة السابق"
          aria-label="يوم الحلقة السابق"
        >
          <ChevronRight className="w-5 h-5 stroke-[2.5]" />
        </button>

        {/* Center Info: Gregorian Single Line + Small Hijri + Status Badge */}
        <div className="flex flex-col items-center justify-center text-center min-w-0 flex-1 px-1">
          <span className="text-base font-extrabold text-slate-900 leading-tight whitespace-nowrap truncate w-full text-center">
            {gregorianMainLine}
          </span>
          <span className="text-xs font-semibold text-slate-500 mt-0.5 whitespace-nowrap truncate w-full text-center">
            {hijriSmallLine}
          </span>
          <div className="flex items-center gap-2 mt-1 flex-wrap justify-center">
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-black border inline-block shadow-2xs ${statusBadgeClass}`}
            >
              {statusText}
            </span>
            <button
              type="button"
              onClick={() => {
                setViewMonthAnchor(parseISODate(selectedDate));
                setIsBottomSheetOpen(true);
              }}
              className="text-xs font-extrabold text-teal-800 hover:text-teal-950 underline cursor-pointer inline-flex items-center gap-1 transition-colors"
            >
              <Calendar className="w-3.5 h-3.5 text-teal-700" />
              <span>يوم آخر</span>
            </button>
          </div>
        </div>

        {/* Left Arrow (40px) */}
        <button
          type="button"
          onClick={handleNextCircleDay}
          className="w-[40px] h-[40px] min-w-[40px] min-h-[40px] rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0 shadow-2xs"
          title="يوم الحلقة التالي"
          aria-label="يوم الحلقة التالي"
        >
          <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
        </button>
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
                onClick={() => setViewMonthAnchor((d) => shiftMonth(d, -1))}
                className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer border border-slate-200"
                title="الشهر السابق"
              >
                <ChevronRight className="w-5 h-5 stroke-[2.5]" />
              </button>

              <div className="text-center">
                <h3 className="text-base font-black text-slate-900">
                  {monthHijriParts.month} {monthHijriParts.year} هـ
                </h3>
                <span className="text-xs font-bold text-slate-500">
                  {formatGregorianArabicDate(viewMonthAnchor)}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setViewMonthAnchor((d) => shiftMonth(d, 1))}
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
                if (!dItem.isCircleDay) {
                  return (
                    <div
                      key={dItem.date}
                      className="w-[42px] h-[42px] min-w-[42px] min-h-[42px] rounded-xl bg-slate-100 text-slate-400 border border-slate-200/60 opacity-40 flex items-center justify-center font-bold text-xs mx-auto pointer-events-none cursor-not-allowed"
                      title="غير شامل لجدول الحلقة"
                    >
                      {dItem.hijriDay}
                    </div>
                  );
                }

                return (
                  <button
                    key={dItem.date}
                    type="button"
                    onClick={() => {
                      const newSun = getSundayOfWeek(parseISODate(dItem.date));
                      onWeekChange(newSun);
                      onSelectDate(dItem.date);
                      setIsBottomSheetOpen(false);
                    }}
                    className={`w-[42px] h-[42px] min-w-[42px] min-h-[42px] rounded-xl flex items-center justify-center font-extrabold text-sm relative transition-all mx-auto cursor-pointer border shadow-2xs ${
                      dItem.isSelected
                        ? 'bg-teal-800 text-white border-teal-800 font-black scale-105 shadow-md'
                        : 'bg-teal-50 hover:bg-teal-100 text-teal-950 border-teal-300'
                    }`}
                  >
                    <span>{dItem.hijriDay}</span>

                    {/* Dot on unrecorded circle days */}
                    {dItem.isUnrecordedCircleDay && !dItem.isSelected && (
                      <span
                        className="w-2 h-2 rounded-full bg-amber-500 absolute top-1 right-1 border border-white"
                        title="لم تُرصد بعد"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsBottomSheetOpen(false)}
              className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm transition-colors cursor-pointer min-h-[44px] mt-2"
            >
              إغلاق التقويم
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
