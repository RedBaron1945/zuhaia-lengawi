import React, { useState, useEffect } from 'react';
import { repository, subscribeToDataChanges } from '../../services/storageService';
import { AuditLog, User } from '../../types';
import { Search, Trash2, X, RefreshCw, RotateCcw, Lock } from 'lucide-react';
import { formatHijriDateTime } from '../../utils/dateUtils';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { useToast } from '../../context/ToastContext';

interface AuditLogViewProps {
  currentUser?: User;
}

const parseSignedPointsFromAuditDetails = (details: string): number | null => {
  const structuredMatch = details.match(/التعديل:\s*([+-]?\d+)/);
  if (structuredMatch?.[1]) {
    const num = parseInt(structuredMatch[1], 10);
    return Number.isFinite(num) && num !== 0 ? num : null;
  }
  const legacyMatch = details.match(/([+-]\d+)\s*نقطة/);
  if (legacyMatch?.[1]) {
    const num = parseInt(legacyMatch[1], 10);
    return Number.isFinite(num) && num !== 0 ? num : null;
  }
  return null;
};

export const AuditLogView: React.FC<AuditLogViewProps> = ({ currentUser }) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [deleteTargetLog, setDeleteTargetLog] = useState<AuditLog | null>(null);
  const [reverseTarget, setReverseTarget] = useState<{
    log: AuditLog;
    studentId: string;
    studentName: string;
    reverseAmount: number;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [, setTick] = useState(0);
  const { showToast } = useToast();

  useEffect(() => {
    void repository.refreshAuditLogs(false);
    const unsub = subscribeToDataChanges(() => {
      setTick((t) => t + 1);
    });
    return unsub;
  }, []);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await repository.refreshAuditLogs(true);
    setTick((t) => t + 1);
    setRefreshing(false);
  };

  const logs = repository.getAuditLogs();

  const filteredLogs = logs.filter((log) => {
    if (filterType !== 'all' && log.targetType !== filterType) return false;
    if (search && !log.details.includes(search) && !log.action.includes(search) && !log.actorName.includes(search)) {
      return false;
    }
    return true;
  });

  const handleConfirmDeleteSingle = () => {
    if (!deleteTargetLog) return;
    const res = repository.deleteAuditLog(deleteTargetLog.id);
    showToast(res.message, res.success ? 'info' : 'error');
    setDeleteTargetLog(null);
  };

  const handleConfirmClearAll = () => {
    const res = repository.clearAllAuditLogs();
    showToast(res.message, 'info');
    setConfirmClearAll(false);
  };

  const handleConfirmReverse = () => {
    if (!reverseTarget) return;
    const { log, studentId, studentName, reverseAmount } = reverseTarget;
    const actorName = currentUser?.name || 'الدعم الفني';
    const actorRole = currentUser?.role || 'admin';
    const actorId = currentUser?.id || actorName;

    const res = repository.addPointTransaction({
      studentId,
      amount: reverseAmount,
      type: 'admin_correction',
      reason: `تصحيح عكسي لعملية سابقة (${reverseAmount >= 0 ? `+${reverseAmount}` : reverseAmount})`,
      note: `عكس سجل: ${log.action} (${log.actorName})`,
      actorId,
      createdBy: actorName,
      createdByRole: actorRole,
    });

    if (res.success) {
      const updated = repository.getStudentById(studentId);
      showToast(
        `تم تنفيذ عملية عكسية للطالب ${studentName}. الرصيد الآن ${updated?.currentPoints ?? 0} ✓`,
        'success'
      );
      setReverseTarget(null);
    } else {
      showToast(res.message, 'error');
    }
  };

  const deletableLogsCount = logs.filter((l) => l.targetType !== 'point').length;

  return (
    <div className="space-y-3">
      {/* Header and filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث في سجل العمليات..."
            className="w-full pr-9 pl-3 py-2 text-xs rounded-xl bg-white border border-slate-200 focus:outline-hidden focus:border-indigo-600 min-h-[40px]"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          aria-label="تصفية حسب نوع النشاط"
          className="px-3 py-2 text-xs rounded-xl bg-white border border-slate-200 text-slate-700 min-h-[40px] cursor-pointer"
        >
          <option value="all">كل الأنشطة</option>
          <option value="point">النقاط والمعاملات</option>
          <option value="student">الطلاب</option>
          <option value="reward">المكافآت</option>
          <option value="redemption">الاستردادات</option>
          <option value="settings">الإعدادات</option>
        </select>

        <button
          type="button"
          onClick={() => void handleManualRefresh()}
          disabled={refreshing}
          className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[40px] shrink-0"
          title="تحديث السجل من قاعدة البيانات"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>تحديث</span>
        </button>

        {/* Clear Non-Point Logs Button */}
        {deletableLogsCount > 0 && (
          <button
            type="button"
            onClick={() => setConfirmClearAll(true)}
            className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[40px] shrink-0"
            title="مسح السجلات الإدارية (تبقى سجلات النقاط محمية)"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>مسح السجلات الأخرى</span>
          </button>
        )}
      </div>

      {/* Logs Table / List */}
      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-xs">
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            لا توجد سجلات تطابق البحث.
          </div>
        ) : (
          filteredLogs.map((log) => {
            const isPointLog = log.targetType === 'point';
            const parsedDelta = isPointLog ? parseSignedPointsFromAuditDetails(log.details) : null;
            const targetStudent =
              isPointLog && log.targetId ? repository.getStudentById(log.targetId) : undefined;
            const canReverse = Boolean(
              isPointLog &&
                targetStudent &&
                parsedDelta !== null &&
                !log.action.includes('عكسي')
            );

            return (
              <div
                key={log.id}
                className="p-3.5 hover:bg-slate-50/70 transition-colors flex items-start justify-between gap-3 group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-slate-900">{log.action}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold">
                        {log.actorName}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 tabular-nums shrink-0">
                      {formatHijriDateTime(log.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium break-words">
                    {log.details}
                  </p>
                </div>

                {/* Action: Point logs use reverse operation (never deleted); non-point logs allow delete */}
                {isPointLog ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {canReverse && targetStudent && parsedDelta !== null ? (
                      <button
                        type="button"
                        onClick={() =>
                          setReverseTarget({
                            log,
                            studentId: targetStudent.id,
                            studentName: targetStudent.name,
                            reverseAmount: -parsedDelta,
                          })
                        }
                        title="تصحيح بعملية عكسية جديدة دون حذف السجل"
                        className="min-h-[32px] px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-amber-50 hover:border-amber-300 text-slate-700 hover:text-amber-900 text-[11px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>عملية عكسية</span>
                      </button>
                    ) : (
                      <span
                        title="سجل نقاط موثق غير قابل للحذف"
                        className="w-7 h-7 rounded-lg text-slate-400 bg-slate-50 border border-slate-200 flex items-center justify-center"
                      >
                        <Lock className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDeleteTargetLog(log)}
                    title="حذف هذا السجل"
                    aria-label="حذف هذا السجل"
                    className="w-7 h-7 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-all cursor-pointer shrink-0 border border-transparent hover:border-rose-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Confirmation Modal: Reverse Point Operation */}
      {reverseTarget && (
        <ConfirmationModal
          isOpen={!!reverseTarget}
          onClose={() => setReverseTarget(null)}
          onConfirm={handleConfirmReverse}
          title="تأكيد التصحيح بعملية عكسية"
          message={`سيتم تسجيل عملية عكسية جديدة للطالب ${reverseTarget.studentName} بمقدار (${reverseTarget.reverseAmount >= 0 ? `+${reverseTarget.reverseAmount}` : reverseTarget.reverseAmount}) نقطة دون حذف السجل الأصلي.\n\nهل أنت متأكد من المتابعة؟`}
          confirmText="تنفيذ العملية العكسية"
          cancelText="إلغاء"
          type={reverseTarget.reverseAmount < 0 ? 'danger' : 'primary'}
        />
      )}

      {/* Confirmation Modal: Delete Specific Non-Point Log Entry */}
      {deleteTargetLog && (
        <ConfirmationModal
          isOpen={!!deleteTargetLog}
          onClose={() => setDeleteTargetLog(null)}
          onConfirm={handleConfirmDeleteSingle}
          title="تأكيد حذف السجل"
          message={`هل أنت متأكد من حذف سجل "${deleteTargetLog.action}" (${deleteTargetLog.details}) الذي تم بواسطة (${deleteTargetLog.actorName}) نهائياً؟`}
          confirmText="نعم، حذف السجل"
          cancelText="إلغاء"
          type="danger"
        />
      )}

      {/* Confirmation Modal: Clear Non-Point Logs */}
      {confirmClearAll && (
        <ConfirmationModal
          isOpen={confirmClearAll}
          onClose={() => setConfirmClearAll(false)}
          onConfirm={handleConfirmClearAll}
          title="مسح السجلات غير المرتبطة بالنقاط"
          message={`سيتم مسح السجلات الإدارية الأخرى (${deletableLogsCount} سجل)، مع الاحتفاظ بجميع سجلات تعديل النقاط محمية في سجل التدقيق.`}
          confirmText="نعم، مسح السجلات الأخرى"
          cancelText="إلغاء"
          type="danger"
        />
      )}
    </div>
  );
};
