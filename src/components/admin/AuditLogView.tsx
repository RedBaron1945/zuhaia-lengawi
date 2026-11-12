import React, { useState, useEffect } from 'react';
import { repository, subscribeToDataChanges } from '../../services/storageService';
import { AuditLog } from '../../types';
import { ShieldCheck, Clock, Search, Filter, Trash2, X } from 'lucide-react';
import { formatHijriDateTime } from '../../utils/dateUtils';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { useToast } from '../../context/ToastContext';

export const AuditLogView: React.FC = () => {
  const [filterType, setFilterType] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [deleteTargetLog, setDeleteTargetLog] = useState<AuditLog | null>(null);
  const [, setTick] = useState(0);
  const { showToast } = useToast();

  useEffect(() => {
    const unsub = subscribeToDataChanges(() => {
      setTick((t) => t + 1);
    });
    return unsub;
  }, []);

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
    showToast(res.message, 'info');
    setDeleteTargetLog(null);
  };

  const handleConfirmClearAll = () => {
    const res = repository.clearAllAuditLogs();
    showToast(res.message, 'info');
    setConfirmClearAll(false);
  };

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
          className="px-3 py-2 text-xs rounded-xl bg-white border border-slate-200 text-slate-700 min-h-[40px] cursor-pointer"
        >
          <option value="all">كل الأنشطة</option>
          <option value="point">النقاط والمعاملات</option>
          <option value="student">الطلاب</option>
          <option value="reward">المكافآت</option>
          <option value="redemption">الاستردادات</option>
          <option value="settings">الإعدادات</option>
        </select>

        {/* Clear All Logs Button */}
        {logs.length > 0 && (
          <button
            type="button"
            onClick={() => setConfirmClearAll(true)}
            className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[40px] shrink-0"
            title="مسح كامل سجل العمليات"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>مسح السجل كاملاً</span>
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
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className="p-3.5 hover:bg-slate-50/70 transition-colors flex items-start justify-between gap-3 group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
                    <span className="text-xs font-black text-slate-900">{log.action}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold">
                      {log.actorName}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 tabular-nums shrink-0">
                    {formatHijriDateTime(log.timestamp)}
                  </span>
                </div>
                <p className="text-xs text-slate-600 pr-4 leading-relaxed font-medium">
                  {log.details}
                </p>
              </div>

              {/* Action: Delete this specific log record */}
              <button
                type="button"
                onClick={() => setDeleteTargetLog(log)}
                title="حذف هذا السجل"
                aria-label="حذف هذا السجل"
                className="w-7 h-7 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-all cursor-pointer shrink-0 border border-transparent hover:border-rose-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Confirmation Modal: Delete Specific Log Entry */}
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

      {/* Confirmation Modal: Clear Entire Log */}
      {confirmClearAll && (
        <ConfirmationModal
          isOpen={confirmClearAll}
          onClose={() => setConfirmClearAll(false)}
          onConfirm={handleConfirmClearAll}
          title="مسح كامل سجل العمليات"
          message={`أنت على وشك مسح جميع سجلات العمليات والأنشطة (${logs.length} سجل) نهائياً من قاعدة البيانات. لن يمكن استرجاع هذه السجلات بعد المسح.`}
          confirmText="نعم، مسح كل السجل نهائياً"
          cancelText="إلغاء"
          type="danger"
        />
      )}
    </div>
  );
};
