import React, { useState } from 'react';
import { repository } from '../../services/storageService';
import { AuditLog } from '../../types';
import { ShieldCheck, Clock, Search, Filter } from 'lucide-react';
import { formatHijriDateTime } from '../../utils/dateUtils';

export const AuditLogView: React.FC = () => {
  const [filterType, setFilterType] = useState<string>('all');
  const [search, setSearch] = useState('');
  const logs = repository.getAuditLogs();

  const filteredLogs = logs.filter((log) => {
    if (filterType !== 'all' && log.targetType !== filterType) return false;
    if (search && !log.details.includes(search) && !log.action.includes(search) && !log.actorName.includes(search)) {
      return false;
    }
    return true;
  });

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
          className="px-3 py-2 text-xs rounded-xl bg-white border border-slate-200 text-slate-700 min-h-[40px]"
        >
          <option value="all">كل الأنشطة</option>
          <option value="point">النقاط والمعاملات</option>
          <option value="student">الطلاب</option>
          <option value="reward">المكافآت</option>
          <option value="redemption">الاستردادات</option>
          <option value="settings">الإعدادات</option>
        </select>
      </div>

      {/* Logs Table / List */}
      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-xs">
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            لا توجد سجلات تطابق البحث.
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className="p-3.5 hover:bg-slate-50/70 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
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
          ))
        )}
      </div>
    </div>
  );
};
