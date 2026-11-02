import React from 'react';
import { Student, EvaluationRecord } from '../../types';
import { WeekDayInfo, shiftWeek } from '../../utils/dateUtils';
import { Award, ChevronRight, ChevronLeft } from 'lucide-react';

interface WeeklySummaryTableProps {
  students: Student[];
  weekDays: WeekDayInfo[];
  weeklyEvaluations: EvaluationRecord[];
  onSelectDay: (date: string) => void;
  currentWeekStart?: Date;
  onWeekChange?: (newWeekStart: Date) => void;
}

export const WeeklySummaryTable: React.FC<WeeklySummaryTableProps> = ({
  students,
  weekDays,
  weeklyEvaluations,
  onSelectDay,
  currentWeekStart,
  onWeekChange,
}) => {
  const handlePrevWeek = () => {
    if (currentWeekStart && onWeekChange) {
      onWeekChange(shiftWeek(currentWeekStart, -1));
    }
  };

  const handleNextWeek = () => {
    if (currentWeekStart && onWeekChange) {
      onWeekChange(shiftWeek(currentWeekStart, 1));
    }
  };

  const startDay = weekDays[0];
  const endDay = weekDays[weekDays.length - 1];

  const weekRangeText =
    startDay && endDay
      ? `الأسبوع من ${startDay.dayName} ${startDay.hijriFormatted} إلى ${endDay.dayName} ${endDay.hijriFormatted}`
      : 'السجل الأسبوعي';

  return (
    <div className="space-y-3 text-right">
      {/* (5) Large Week Navigation Bar inside "سجل الأسبوع" tab */}
      {currentWeekStart && onWeekChange && (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-3.5 shadow-sm flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handlePrevWeek}
            className="w-[52px] h-[52px] min-w-[52px] min-h-[52px] rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0 shadow-2xs"
            title="الأسبوع السابق"
            aria-label="الأسبوع السابق"
          >
            <ChevronRight className="w-6 h-6 stroke-[2.5]" />
          </button>

          <div className="text-center flex-1 min-w-0 px-1">
            <h3 className="text-[18px] font-black text-slate-900 leading-snug truncate">
              {weekRangeText}
            </h3>
            <p className="text-[14px] font-bold text-slate-500 mt-0.5">
              40 نقطة كحد أقصى للأسبوع
            </p>
          </div>

          <button
            type="button"
            onClick={handleNextWeek}
            className="w-[52px] h-[52px] min-w-[52px] min-h-[52px] rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0 shadow-2xs"
            title="الأسبوع التالي"
            aria-label="الأسبوع التالي"
          >
            <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
          </button>
        </div>
      )}

      {/* Main Table Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-[18px] font-black text-slate-900 flex items-center gap-1.5">
              <Award className="w-5 h-5 text-teal-800" />
              <span>سجل الأداء والتقييم الأسبوعي</span>
            </h3>
            <p className="text-[14px] font-bold text-slate-500 mt-0.5">
              انقر على يوم الطالب للذهاب مباشرة لرصده
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {students.length === 0 ? (
            <div className="p-8 text-center text-[16px] text-slate-500 font-bold">
              لا يوجد طلاب مسجلون في هذه الحلقة حالياً.
            </div>
          ) : (
            students.map((student) => {
              let weeklyTotalPoints = 0;
              let recordedDaysCount = 0;

              const dayScores = weekDays.map((d) => {
                const evalRec = weeklyEvaluations.find(
                  (e) => e.studentId === student.id && e.date === d.date
                );
                if (evalRec) {
                  const pts =
                    typeof evalRec.totalPoints === 'number'
                      ? evalRec.totalPoints
                      : evalRec.pointsAwarded || 0;
                  weeklyTotalPoints += pts;
                  recordedDaysCount += 1;
                  return {
                    date: d.date,
                    dayName: d.dayName,
                    hijriDayNumber: d.hijriDayNumber,
                    pts,
                    attendance: evalRec.attendance,
                    recorded: true,
                  };
                }
                return {
                  date: d.date,
                  dayName: d.dayName,
                  hijriDayNumber: d.hijriDayNumber,
                  pts: 0,
                  attendance: null,
                  recorded: false,
                };
              });

              return (
                <div key={student.id} className="p-4 hover:bg-slate-50/70 transition-colors space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-teal-100 text-teal-950 font-extrabold text-[16px] flex items-center justify-center shrink-0 border border-teal-200">
                        {student.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-[18px] font-black text-slate-900 truncate">
                          {student.name}
                        </h4>
                        <span className="text-[13px] text-slate-500 font-bold block">
                          تم رصد {recordedDaysCount} من 4 أيام
                        </span>
                      </div>
                    </div>

                    <div className="text-left shrink-0">
                      <span className="text-[15px] font-black text-teal-900 bg-teal-50 px-3 py-1.5 rounded-xl border border-teal-200 tabular-nums shadow-2xs inline-block">
                        ⭐ {weeklyTotalPoints} / 40
                      </span>
                    </div>
                  </div>

                  {/* 4 Days Pills Strip */}
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    {dayScores.map((ds) => (
                      <button
                        key={ds.date}
                        type="button"
                        onClick={() => onSelectDay(ds.date)}
                        className={`p-2.5 rounded-2xl border text-center transition-all min-h-[52px] cursor-pointer shadow-2xs ${
                          ds.recorded
                            ? ds.pts >= 9
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-extrabold'
                              : ds.pts >= 5
                              ? 'bg-amber-50 border-amber-300 text-amber-950 font-extrabold'
                              : 'bg-rose-50 border-rose-300 text-rose-950 font-extrabold'
                            : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 font-bold'
                        }`}
                      >
                        <span className="text-[13px] font-extrabold block leading-tight">{ds.dayName}</span>
                        <span className="text-[11px] text-slate-400 block tabular-nums">
                          {ds.hijriDayNumber} هـ
                        </span>
                        <span className="text-[15px] font-black tabular-nums mt-0.5 block">
                          {ds.recorded ? `${ds.pts} ن` : '—'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
