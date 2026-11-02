import React, { useState } from 'react';
import { PointTransaction, RedemptionRequest } from '../../types';
import { repository } from '../../services/storageService';
import {
  Clock,
  Gift,
  CheckCircle2,
  Clock3,
  XCircle,
  PackageCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { formatHijriDate } from '../../utils/dateUtils';
import { groupTransactionsByDay, DailyPointsGroup } from '../../utils/pointUtils';

interface StudentHistoryProps {
  studentId: string;
}

export const StudentHistory: React.FC<StudentHistoryProps> = ({ studentId }) => {
  const [activeTab, setActiveTab] = useState<'points' | 'rewards'>('points');
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  const transactions = repository.getTransactions({ studentId });
  const redemptionRequests = repository.getRedemptionRequests({ studentId });
  const dailyGroups = groupTransactionsByDay(transactions);

  const toggleDayExpanded = (dateKey: string) => {
    setExpandedDays((prev) => ({
      ...prev,
      [dateKey]: !prev[dateKey],
    }));
  };

  const getStatusBadge = (status: RedemptionRequest['status']) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <Clock3 className="w-3.5 h-3.5 text-amber-600" />
            قيد المراجعة
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
            تمت الموافقة
          </span>
        );
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
            تم التسليم
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            مرفوض
          </span>
        );
    }
  };

  // Helper colors and formatters
  const getPointsColor = (points: number) => {
    if (points > 0) return 'text-emerald-600';
    if (points < 0) return 'text-rose-600';
    return 'text-slate-400';
  };

  const formatPoints = (points: number) => {
    if (points > 0) return `+${points}`;
    return `${points}`;
  };

  const getCriteriaStatusColor = (points: number) => {
    if (points === 2) return 'text-emerald-600';
    if (points === 1) return 'text-amber-600';
    return 'text-slate-400';
  };

  return (
    <div className="space-y-4">
      {/* Sub tabs: سجل النقاط / سجل المكافآت */}
      <div className="flex bg-slate-200/80 p-1 rounded-2xl">
        <button
          onClick={() => setActiveTab('points')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'points'
              ? 'bg-white text-teal-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Clock className="w-4 h-4 text-teal-700" />
          <span>
            سجل النقاط ({dailyGroups.length}{' '}
            {dailyGroups.length === 1 ? 'يوم' : dailyGroups.length > 10 ? 'يوماً' : 'أيام'})
          </span>
        </button>
        <button
          onClick={() => setActiveTab('rewards')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'rewards'
              ? 'bg-white text-teal-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Gift className="w-4 h-4 text-amber-600" />
          <span>سجل المكافآت ({redemptionRequests.length})</span>
        </button>
      </div>

      {/* Content */}
      {activeTab === 'points' ? (
        <div className="space-y-3">
          {dailyGroups.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
              لا توجد نقاط مسجلة حتى الآن.
            </div>
          ) : (
            dailyGroups.map((group: DailyPointsGroup) => {
              const isExpanded = !!expandedDays[group.dateKey];

              // Lookup evaluation authoritative record if available
              const evalRecord = repository.getEvaluationForStudentAndDate(studentId, group.dateKey);

              let criteriaList: Array<{
                key: string;
                label: string;
                level: string;
                points: number;
              }> = [];

              if (evalRecord) {
                const attPoints =
                  evalRecord.attendancePoints ??
                  (evalRecord.attendance === 'early' ? 2 : evalRecord.attendance === 'late' ? 1 : 0);
                const attLevel =
                  evalRecord.attendance === 'early'
                    ? 'حضور مبكر'
                    : evalRecord.attendance === 'late'
                    ? 'حضور متأخر'
                    : 'غائب';

                const memPoints = evalRecord.memorizationScore ?? 0;
                const memLevel = memPoints === 2 ? 'متقن' : memPoints === 1 ? 'جزئي' : 'لم يحفظ';

                const revPoints = evalRecord.revisionScore ?? 0;
                const revLevel = revPoints === 2 ? 'متقنة' : revPoints === 1 ? 'جزئية' : 'لم يراجع';

                const disPoints = evalRecord.disciplineScore ?? 0;
                const disLevel = disPoints === 2 ? 'منضبط' : disPoints === 1 ? 'وسط' : 'مخالف';

                const uniPoints = evalRecord.uniformScore ?? 0;
                const uniLevel = uniPoints === 2 ? 'ملتزم' : uniPoints === 1 ? 'تنبيه' : 'مخالف';

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
                (criteriaList.length > 0 ? criteriaList.reduce((sum, c) => sum + c.points, 0) : null);

              const additionalTxs = group.additionalTransactions || [];
              const additionalTotal = additionalTxs.reduce(
                (sum, tx) => sum + (Number(tx.amount) || 0),
                0
              );

              // Concise summary line under the header: «التقييم 5/10 · عمليات إضافية +10»
              const summaryParts: string[] = [];
              if (criteriaList.length > 0 && evalScore !== null) {
                summaryParts.push(`التقييم ${evalScore}/10`);
              }
              if (additionalTxs.length > 0) {
                summaryParts.push(
                  `عمليات إضافية ${additionalTotal >= 0 ? `+${additionalTotal}` : additionalTotal}`
                );
              }
              if (summaryParts.length === 0) {
                summaryParts.push(
                  group.conciseSummary ||
                    (group.totalPoints > 0 ? `+${group.totalPoints}` : `${group.totalPoints}`)
                );
              }
              const summaryLine = summaryParts.join(' · ');

              const dayTitle =
                group.dayLabel === 'اليوم'
                  ? `اليوم (${group.arabicDayName})`
                  : group.dayLabel === 'أمس'
                  ? `أمس (${group.arabicDayName})`
                  : group.arabicDayName;

              return (
                <div
                  key={group.dateKey}
                  onClick={() => toggleDayExpanded(group.dateKey)}
                  className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs hover:border-teal-200 transition-all cursor-pointer select-none"
                >
                  {/* (2) Collapsed State Header: Day name + relative, Hijri date in gray below, Total points + chevron */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-slate-900">
                        {dayTitle}
                      </div>
                      <div className="text-[11px] text-slate-400 font-medium tabular-nums mt-0.5">
                        {group.hijriDate}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        dir="ltr"
                        className={`text-base sm:text-lg font-black tabular-nums ${getPointsColor(
                          group.totalPoints
                        )}`}
                      >
                        {formatPoints(group.totalPoints)}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                    </div>
                  </div>

                  {/* Summary Line: «التقييم 5/10 · عمليات إضافية +10» */}
                  <div className="text-xs text-slate-500 font-medium mt-1.5">
                    {summaryLine}
                  </div>

                  {/* (3) Expanded State: Two clean sections without nested box frames */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      {/* Section 1: Daily evaluation out of 10 with 5 criteria rows */}
                      {criteriaList.length > 0 && evalScore !== null && (
                        <div>
                          <div className="text-xs font-bold text-slate-700 mb-1.5">
                            التقييم اليومي {evalScore} من 10
                          </div>
                          <div className="divide-y divide-slate-100">
                            {criteriaList.map((item) => (
                              <div
                                key={item.key}
                                className="flex items-center justify-between py-2 text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-800">{item.label}</span>
                                  <span
                                    className={`text-[11px] font-semibold ${getCriteriaStatusColor(
                                      item.points
                                    )}`}
                                  >
                                    {item.level}
                                  </span>
                                </div>
                                <span
                                  dir="ltr"
                                  className={`font-black tabular-nums text-xs ${getPointsColor(
                                    item.points
                                  )}`}
                                >
                                  {item.points > 0 ? `+${item.points}` : item.points}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Section 2: Additional operations (if any) */}
                      {additionalTxs.length > 0 && (
                        <div
                          className={
                            criteriaList.length > 0 ? 'mt-3.5 pt-3 border-t border-slate-100' : ''
                          }
                        >
                          <div className="text-xs font-bold text-slate-700 mb-1.5">
                            عمليات إضافية{' '}
                            {additionalTotal >= 0 ? `+${additionalTotal}` : additionalTotal}
                          </div>
                          <div className="divide-y divide-slate-100">
                            {additionalTxs.map((tx) => (
                              <div
                                key={tx.id}
                                className="flex items-center justify-between py-2 text-xs"
                              >
                                <span className="font-medium text-slate-700 line-clamp-1">
                                  {tx.reason}
                                </span>
                                <span
                                  dir="ltr"
                                  className={`font-black tabular-nums text-xs shrink-0 ${getPointsColor(
                                    tx.amount
                                  )}`}
                                >
                                  {formatPoints(tx.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Fallback if no criteria list but raw transactions exist */}
                      {criteriaList.length === 0 &&
                        additionalTxs.length === 0 &&
                        group.transactions.length > 0 && (
                          <div className="divide-y divide-slate-100">
                            {group.transactions.map((tx) => (
                              <div
                                key={tx.id}
                                className="flex items-center justify-between py-2 text-xs"
                              >
                                <span className="font-medium text-slate-700 line-clamp-1">
                                  {tx.reason}
                                </span>
                                <span
                                  dir="ltr"
                                  className={`font-black tabular-nums text-xs shrink-0 ${getPointsColor(
                                    tx.amount
                                  )}`}
                                >
                                  {formatPoints(tx.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                    </div>
                  )}

                  {/* (6) Teacher attribution moved to a small muted gray line at bottom */}
                  {group.teachers.length > 0 && (
                    <div className="text-[11px] text-slate-400 pt-2.5 mt-2.5 border-t border-slate-100">
                      بواسطة: {group.teachers.join('، ')}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {redemptionRequests.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
              لم تقم بطلب أي مكافأة بعد. استكشف قسم المكافآت واستبدل نقاطك! 🎁
            </div>
          ) : (
            redemptionRequests.map((req) => (
              <div
                key={req.id}
                className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col gap-2 hover:border-amber-200 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-2xl shrink-0">
                      <span>{req.rewardEmoji}</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{req.rewardTitle}</h4>
                      <p className="text-xs font-semibold text-teal-800 mt-0.5 tabular-nums">
                        ⭐ {req.rewardCost} نقطة
                      </p>
                    </div>
                  </div>
                  <div>{getStatusBadge(req.status)}</div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                  <span className="tabular-nums">
                    تاريخ الطلب: {formatHijriDate(new Date(req.requestDate))}
                  </span>
                  {req.handledBy && <span>المشرف: {req.handledBy}</span>}
                </div>

                {req.rejectionReason && (
                  <div className="text-xs bg-rose-50 text-rose-700 p-2.5 rounded-xl border border-rose-100">
                    سبب الرفض: {req.rejectionReason}
                    {req.refunded && ' (تمت إعادة النقاط إلى رصيدك)'}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
