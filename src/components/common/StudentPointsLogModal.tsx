import React, { useEffect, useMemo, useState } from 'react';
import { Student } from '../../types';
import { repository, subscribeToDataChanges } from '../../services/storageService';
import { groupTransactionsByDay, DailyPointsGroup } from '../../utils/pointUtils';
import { formatGregorianArabicDate } from '../../utils/dateUtils';
import {
  X,
  CalendarDays,
  ArrowUpDown,
  FileText,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface StudentPointsLogModalProps {
  student: Student | null;
  onClose: () => void;
}

type SortOrder = 'newest' | 'oldest';

const formatPointsArabicUnit = (absVal: number): string => {
  if (absVal === 1) return 'نقطة';
  if (absVal === 2) return 'نقطتان';
  if (absVal >= 3 && absVal <= 10) return 'نقاط';
  return 'نقطة';
};

const formatDaysArabic = (count: number): string => {
  if (count === 0) return '0 يوم';
  if (count === 1) return 'يوم واحد';
  if (count === 2) return 'يومان';
  if (count >= 3 && count <= 10) return `${count} أيام`;
  return `${count} يوماً`;
};

const formatSignedPoints = (points: number): string => {
  if (points > 0) return `+${points}`;
  return `${points}`;
};

const getTxCategoryLabel = (type: string, amount: number): string => {
  switch (type) {
    case 'admin_bonus':
      return 'إضافة إدارية';
    case 'admin_correction':
      return amount >= 0 ? 'تصحيح / إضافة إدارية' : 'خصم إداري';
    case 'reward_redemption':
      return 'استبدال مكافأة';
    case 'refund':
      return 'استرداد نقاط';
    case 'attendance':
      return 'رصد حضور';
    case 'memorization':
      return 'حفظ وتسميع';
    case 'revision':
      return 'مراجعة';
    case 'bonus':
      return 'مكافأة تشجيعية';
    case 'deduction':
      return 'خصم نقاط';
    default:
      return amount >= 0 ? 'إضافة نقاط' : 'خصم نقاط';
  }
};

export const StudentPointsLogModal: React.FC<StudentPointsLogModalProps> = ({
  student,
  onClose,
}) => {
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const [syncTick, setSyncTick] = useState(0);

  useEffect(() => {
    if (!student) return;
    setSortOrder('newest');
    setExpandedDays({});
  }, [student?.id]);

  useEffect(() => {
    if (!student) return;
    const unsub = subscribeToDataChanges(() => {
      setSyncTick((t) => t + 1);
    });
    return unsub;
  }, [student]);

  useEffect(() => {
    if (!student) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [student, onClose]);

  const liveStudent = student
    ? repository.getStudentById(student.id) || student
    : null;

  const circleName = useMemo(() => {
    if (!liveStudent) return '';
    const circle = repository
      .getCircles()
      .find((c) => c.id === liveStudent.circleId);
    return circle?.name || 'غير محددة';
  }, [liveStudent]);

  const dailyGroups = useMemo(() => {
    void syncTick;
    if (!liveStudent) return [];
    const transactions = repository.getTransactions({ studentId: liveStudent.id });
    const evaluations = repository.getEvaluationsHistory(liveStudent.id);
    return groupTransactionsByDay(transactions, evaluations);
  }, [liveStudent, syncTick]);

  const dayEntries = useMemo(() => {
    if (!liveStudent) return [];
    return dailyGroups.map((group: DailyPointsGroup) => {
      const evalRecord = repository.getEvaluationForStudentAndDate(
        liveStudent.id,
        group.dateKey
      );

      let criteriaList: Array<{
        key: string;
        label: string;
        level: string;
        points: number;
      }> = [];

      if (evalRecord) {
        const attPoints =
          evalRecord.attendancePoints ??
          (evalRecord.attendance === 'early'
            ? 2
            : evalRecord.attendance === 'late'
            ? 1
            : 0);
        const attLevel =
          evalRecord.attendance === 'early'
            ? 'حضور مبكر'
            : evalRecord.attendance === 'late'
            ? 'حضور متأخر'
            : 'غائب';

        const memPoints = evalRecord.memorizationScore ?? 0;
        const memLevel =
          memPoints === 2 ? 'متقن' : memPoints === 1 ? 'جزئي' : 'لم يحفظ';

        const revPoints = evalRecord.revisionScore ?? 0;
        const revLevel =
          revPoints === 2 ? 'متقنة' : revPoints === 1 ? 'جزئية' : 'لم يراجع';

        const disPoints = evalRecord.disciplineScore ?? 0;
        const disLevel =
          disPoints === 2 ? 'منضبط' : disPoints === 1 ? 'وسط' : 'مخالف';

        const uniPoints = evalRecord.uniformScore ?? 0;
        const uniLevel =
          uniPoints === 2 ? 'ملتزم' : uniPoints === 1 ? 'تنبيه' : 'مخالف';

        criteriaList = [
          { key: 'attendance', label: 'الحضور', level: attLevel, points: attPoints },
          { key: 'memorization', label: 'الحفظ', level: memLevel, points: memPoints },
          { key: 'revision', label: 'المراجعة', level: revLevel, points: revPoints },
          { key: 'discipline', label: 'الانضباط', level: disLevel, points: disPoints },
          { key: 'uniform', label: 'الزي', level: uniLevel, points: uniPoints },
        ];
      } else if (group.evaluationBreakdown && group.evaluationBreakdown.length > 0) {
        criteriaList = group.evaluationBreakdown.map((item) => ({
          key: item.key,
          label: item.label,
          level: item.level,
          points: item.points,
        }));
      }

      const evalScore =
        evalRecord?.totalPoints ??
        group.evaluationTotal ??
        (criteriaList.length > 0
          ? criteriaList.reduce((sum, c) => sum + c.points, 0)
          : null);

      const additionalTxs = group.additionalTransactions || [];
      const fallbackTxs =
        criteriaList.length === 0 && additionalTxs.length === 0
          ? group.transactions
          : [];

      return {
        group,
        evalRecord,
        criteriaList,
        evalScore,
        additionalTxs,
        fallbackTxs,
      };
    });
  }, [liveStudent, dailyGroups]);

  const filteredEntries = useMemo(() => {
    if (sortOrder === 'oldest') {
      return [...dayEntries].reverse();
    }
    return dayEntries;
  }, [dayEntries, sortOrder]);

  const toggleDay = (dateKey: string) => {
    setExpandedDays((prev) => ({
      ...prev,
      [dateKey]: !prev[dateKey],
    }));
  };

  const allFilteredExpanded =
    filteredEntries.length > 0 &&
    filteredEntries.every((entry) => Boolean(expandedDays[entry.group.dateKey]));

  const toggleAllFiltered = () => {
    if (filteredEntries.length === 0) return;
    if (allFilteredExpanded) {
      setExpandedDays({});
      return;
    }
    const next: Record<string, boolean> = {};
    filteredEntries.forEach((entry) => {
      next[entry.group.dateKey] = true;
    });
    setExpandedDays(next);
  };

  if (!liveStudent) return null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-points-log-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-3xl bg-white rounded-t-3xl sm:rounded-3xl border border-slate-200 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden text-right select-text"
      >
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center shrink-0">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3
                id="student-points-log-title"
                className="text-sm sm:text-base font-black text-slate-900 truncate"
              >
                سجل النقاط بالأيام
              </h3>
              <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-500 font-medium truncate">
                <span className="font-bold text-slate-700 truncate">{liveStudent.name}</span>
                <span aria-hidden="true">·</span>
                <span className="truncate">{circleName}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق سجل النقاط"
            className="w-10 h-10 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary KPI Strip + Sort/Expand Bar */}
        <div className="px-4 sm:px-6 py-3 bg-slate-50/90 border-b border-slate-200 space-y-2.5 shrink-0">
          {/* 2-Column Metric Summary (Single Elevation, Tabular Numerals) */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="bg-white rounded-xl border border-slate-200 px-3 py-2">
              <span className="text-[11px] text-slate-500 font-bold block">الرصيد الحالي</span>
              <div className="text-base sm:text-lg font-black text-teal-800 tabular-nums mt-0.5">
                {liveStudent.currentPoints}{' '}
                <span className="text-[11px] font-bold text-slate-500">
                  {formatPointsArabicUnit(Math.abs(liveStudent.currentPoints))}
                </span>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 px-3 py-2">
              <span className="text-[11px] text-slate-500 font-bold block">الأيام المرصودة</span>
              <div className="text-base sm:text-lg font-black text-slate-900 tabular-nums mt-0.5">
                {formatDaysArabic(dailyGroups.length)}
              </div>
            </div>
          </div>

          {/* Expand/Collapse + Sort Toggle */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex items-center gap-2 shrink-0">
              {filteredEntries.length > 0 && (
                <button
                  type="button"
                  onClick={toggleAllFiltered}
                  className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                >
                  {allFilteredExpanded ? (
                    <>
                      <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                      <span>طي الكل</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3.5 h-3.5 text-teal-700" />
                      <span>توسيع الكل</span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() =>
                  setSortOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'))
                }
                className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-teal-700" />
                <span>{sortOrder === 'newest' ? 'الأحدث أولاً' : 'الأقدم أولاً'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Days Cards Grid Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
          {filteredEntries.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
              <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <CalendarDays className="w-5 h-5" />
              </div>
              <p className="text-sm font-black text-slate-800">
                لا توجد أيام أو نقاط مرصودة لهذا الطالب حتى الآن
              </p>
              <p className="text-xs text-slate-500">
                ستظهر بطاقات الأيام هنا تلقائياً فور رصد تقييم الحلقة أو أي عملية نقاط.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
              {filteredEntries.map((entry) => {
                const {
                  group,
                  evalRecord,
                  criteriaList,
                  evalScore,
                  additionalTxs,
                  fallbackTxs,
                } = entry;

                const isExpanded = Boolean(expandedDays[group.dateKey]);
                const dayTitle = group.isToday
                  ? `اليوم · ${group.arabicDayName}`
                  : group.isYesterday
                  ? `أمس · ${group.arabicDayName}`
                  : group.arabicDayName;

                const gregorianDate = formatGregorianArabicDate(group.dateKey);
                const pointsColor =
                  group.totalPoints > 0
                    ? 'text-emerald-700'
                    : group.totalPoints < 0
                    ? 'text-rose-600'
                    : 'text-slate-500';

                const extraItems =
                  additionalTxs.length > 0 ? additionalTxs : fallbackTxs;

                const additionalTotal = additionalTxs.reduce(
                  (sum, tx) => sum + (Number(tx.amount) || 0),
                  0
                );
                const previewParts: string[] = [];
                if (criteriaList.length > 0 && evalScore !== null) {
                  previewParts.push(`التقييم ${evalScore}/10`);
                }
                if (additionalTxs.length > 0) {
                  previewParts.push(
                    `عمليات إضافية ${additionalTotal >= 0 ? `+${additionalTotal}` : additionalTotal}`
                  );
                }
                if (previewParts.length === 0) {
                  previewParts.push(
                    group.conciseSummary ||
                      `${formatSignedPoints(group.totalPoints)} ${formatPointsArabicUnit(
                        Math.abs(group.totalPoints)
                      )}`
                  );
                }
                const summaryLine = previewParts.join(' · ');

                return (
                  <button
                    key={group.dateKey}
                    type="button"
                    onClick={() => toggleDay(group.dateKey)}
                    aria-expanded={isExpanded}
                    className={`w-full text-right bg-white rounded-2xl border p-4 flex flex-col gap-2.5 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 ${
                      isExpanded
                        ? 'border-teal-400 ring-1 ring-teal-200/70 shadow-xs'
                        : 'border-slate-200 hover:border-teal-300'
                    }`}
                  >
                    {/* Card Preview Header (Always Visible) */}
                    <div className="flex items-start justify-between gap-3 w-full">
                      <div className="min-w-0">
                        <h4 className="text-sm font-black text-slate-900">
                          {dayTitle}
                        </h4>
                        <div className="text-[11px] text-slate-500 font-medium tabular-nums mt-0.5 leading-relaxed">
                          <span>{group.hijriDate}</span>
                          <span aria-hidden="true" className="mx-1 text-slate-300">
                            ·
                          </span>
                          <span>{gregorianDate}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-left">
                          <div className={`text-base sm:text-lg font-black tabular-nums leading-none ${pointsColor}`}>
                            <span dir="ltr">{formatSignedPoints(group.totalPoints)}</span>{' '}
                            <span className="text-[11px] font-bold">
                              {formatPointsArabicUnit(Math.abs(group.totalPoints))}
                            </span>
                          </div>
                          <div className="text-[11px] font-bold text-slate-500 tabular-nums mt-1">
                            التراكمي: {group.cumulativePointsSoFar} ن
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-teal-700 shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                      </div>
                    </div>

                    {/* Concise Preview Line */}
                    <div className="text-xs text-slate-600 font-medium w-full truncate">
                      {summaryLine}
                    </div>

                    {/* Expanded Card Body (Revealed on Click) */}
                    {isExpanded && (
                      <div className="w-full pt-3 mt-0.5 border-t border-slate-100 space-y-3">
                        {/* Section 1: Daily Rubric Criteria */}
                        {criteriaList.length > 0 && evalScore !== null && (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-extrabold text-slate-800">
                                بنود التقييم اليومي
                              </span>
                              <span className="font-black text-teal-800 tabular-nums">
                                {evalScore} / 10
                              </span>
                            </div>

                            <div className="divide-y divide-slate-100">
                              {criteriaList.map((item) => {
                                const itemColor =
                                  item.points === 2
                                    ? 'text-emerald-700'
                                    : item.points === 1
                                    ? 'text-amber-700'
                                    : 'text-slate-400';

                                return (
                                  <div
                                    key={item.key}
                                    className="flex items-center justify-between py-1.5 text-xs gap-2"
                                  >
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className="font-bold text-slate-800">
                                        {item.label}
                                      </span>
                                      <span aria-hidden="true" className="text-slate-300">
                                        ·
                                      </span>
                                      <span
                                        className={`font-semibold truncate ${
                                          item.points === 0 ? 'text-slate-500' : itemColor
                                        }`}
                                      >
                                        {item.level}
                                      </span>
                                    </div>
                                    <span
                                      dir="ltr"
                                      className={`font-black tabular-nums shrink-0 ${itemColor}`}
                                    >
                                      {formatSignedPoints(item.points)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>

                            {evalRecord?.notes && evalRecord.notes.trim() && (
                              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600 flex items-start gap-1.5 leading-relaxed">
                                <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                <span>ملاحظة: {evalRecord.notes}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Section 2: Additional / Admin / Reward Transactions */}
                        {extraItems.length > 0 && (
                          <div
                            className={
                              criteriaList.length > 0
                                ? 'pt-2.5 border-t border-slate-100 space-y-1.5'
                                : 'space-y-1.5'
                            }
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-extrabold text-slate-800 inline-flex items-center gap-1">
                                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                                <span>
                                  {criteriaList.length > 0 ? 'عمليات إضافية' : 'البنود المرصودة'}
                                </span>
                              </span>
                            </div>

                            <div className="divide-y divide-slate-100">
                              {extraItems.map((tx) => {
                                const amt = Number(tx.amount) || 0;
                                const txColor =
                                  amt > 0
                                    ? 'text-emerald-700'
                                    : amt < 0
                                    ? 'text-rose-600'
                                    : 'text-slate-500';
                                const categoryLabel = getTxCategoryLabel(tx.type, amt);

                                return (
                                  <div
                                    key={tx.id}
                                    className="flex items-start justify-between gap-2 py-1.5 text-xs"
                                  >
                                    <div className="min-w-0 space-y-0.5">
                                      <div className="text-[11px] font-bold text-slate-500">
                                        {categoryLabel}
                                        {tx.createdBy ? ` · ${tx.createdBy}` : ''}
                                      </div>
                                      <div className="font-semibold text-slate-800 leading-relaxed break-words">
                                        {tx.reason}
                                      </div>
                                    </div>
                                    <span
                                      dir="ltr"
                                      className={`font-black tabular-nums shrink-0 ${txColor}`}
                                    >
                                      {formatSignedPoints(amt)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Card Footer: Recorded By */}
                        {group.teachers.length > 0 && (
                          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 font-medium">
                            بواسطة: {group.teachers.join('، ')}
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Sticky Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-200 bg-white shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
