import React, { useState, useEffect, useMemo } from 'react';
import { repository, subscribeToDataChanges } from '../../services/storageService';
import { SupportTicket, SupportTicketType, SupportTicketPriority } from '../../types';
import {
  LifeBuoy,
  Search,
  MessageCircle,
  Phone,
  Calendar,
  X,
  Trash2,
  CheckCircle2,
  Clock,
  ExternalLink,
  HelpCircle,
  AlertCircle,
  Flame,
  Zap,
  Filter,
  Check,
  ShieldAlert,
} from 'lucide-react';
import { formatHijriDateTime } from '../../utils/dateUtils';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { useToast } from '../../context/ToastContext';
import { WhatsAppIcon } from '../common/WhatsAppIcon';

export const SupportTicketsManager: React.FC = () => {
  const [filterType, setFilterType] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<SupportTicket | null>(null);
  const [, setTick] = useState(0);
  const { showToast } = useToast();

  useEffect(() => {
    const unsub = subscribeToDataChanges(() => {
      setTick((t) => t + 1);
    });
    return unsub;
  }, []);

  const tickets = repository.getSupportTickets();

  // Statistics
  const highPriorityCount = useMemo(
    () => tickets.filter((t) => t.priority === 'high').length,
    [tickets]
  );
  const studentPriorityCount = useMemo(
    () => tickets.filter((t) => t.priority === 'medium' || t.priority === 'low').length,
    [tickets]
  );
  const newTicketsCount = useMemo(
    () => tickets.filter((t) => t.status === 'new').length,
    [tickets]
  );

  // Filtered and Sorted Tickets
  const filteredTickets = useMemo(() => {
    return tickets
      .filter((t) => {
        if (filterType !== 'all' && t.ticketType !== filterType) return false;
        if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
        if (filterStatus !== 'all' && t.status !== filterStatus) return false;
        if (search.trim()) {
          const q = search.trim();
          if (
            !t.message.includes(q) &&
            !t.senderName.includes(q) &&
            !(t.senderPhone && t.senderPhone.includes(q))
          ) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        // Priority Score: high = 3, medium = 2, low = 1
        const priorityWeights: Record<SupportTicketPriority, number> = {
          high: 3,
          medium: 2,
          low: 1,
        };
        const weightA = priorityWeights[a.priority] || 2;
        const weightB = priorityWeights[b.priority] || 2;

        if (weightB !== weightA) {
          return weightB - weightA; // High priority first
        }

        // Secondary sort: newest first
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [tickets, filterType, filterPriority, filterStatus, search]);

  const handleStatusChange = (ticketId: string, newStatus: 'new' | 'in_progress' | 'resolved') => {
    const res = repository.updateSupportTicket(ticketId, { status: newStatus });
    if (res.success) {
      showToast('تم تحديث حالة التذكرة', 'info');
      setTick((t) => t + 1);
    }
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    const res = repository.deleteSupportTicket(deleteTarget.id);
    showToast(res.message, 'info');
    setDeleteTarget(null);
  };

  const getTypeBadgeClass = (type: SupportTicketType) => {
    switch (type) {
      case 'مشكلة':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'اقتراح':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'استفسار':
        return 'bg-sky-100 text-sky-800 border-sky-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getCleanWhatsappUrl = (phone?: string) => {
    if (!phone) return null;
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('05')) {
      clean = '966' + clean.slice(1);
    } else if (clean.startsWith('5')) {
      clean = '966' + clean;
    }
    return `https://wa.me/${clean}`;
  };

  return (
    <div className="space-y-3">
      {/* Top Priority Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {/* High Priority Card (مدير المجمع / المعلمين) */}
        <div className="bg-rose-50/80 border border-rose-200/90 rounded-2xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-rose-900">أولوية عالية</p>
              <p className="text-[10px] text-rose-700">مدير المجمع أو المعلمين</p>
            </div>
          </div>
          <span className="text-xl font-black text-rose-700 tabular-nums font-mono">
            {highPriorityCount}
          </span>
        </div>

        {/* Medium/Low Priority Card (الطلاب) */}
        <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-amber-900">أولوية متوسطة / منخفضة</p>
              <p className="text-[10px] text-amber-700">تذاكر الطلاب</p>
            </div>
          </div>
          <span className="text-xl font-black text-amber-700 tabular-nums font-mono">
            {studentPriorityCount}
          </span>
        </div>

        {/* Total & Pending Card */}
        <div className="bg-indigo-50/80 border border-indigo-200/90 rounded-2xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-900 text-white flex items-center justify-center shadow-xs">
              <LifeBuoy className="w-5 h-5 text-indigo-200" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-indigo-950">إجمالي التذاكر</p>
              <p className="text-[10px] text-indigo-700">
                {newTicketsCount > 0 ? `${newTicketsCount} تذكرة جديدة` : 'تمت المراجعة'}
              </p>
            </div>
          </div>
          <span className="text-xl font-black text-indigo-950 tabular-nums font-mono">
            {tickets.length}
          </span>
        </div>
      </div>

      {/* Header, Search & Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث في تذاكر الدعم بالاسم أو الرسالة أو الجوال..."
            className="w-full pr-9 pl-3 py-2 text-xs rounded-xl bg-white border border-slate-200 focus:outline-hidden focus:border-indigo-600 min-h-[40px]"
          />
        </div>

        {/* Priority Filter */}
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl bg-white border border-slate-200 text-slate-800 font-bold min-h-[40px] cursor-pointer"
        >
          <option value="all">كل الأولويات</option>
          <option value="high">🔥 أولوية عالية فقط (مدير/معلم)</option>
          <option value="medium">⚡ أولوية متوسطة (طالب)</option>
          <option value="low">🌱 أولوية منخفضة (طالب)</option>
        </select>

        {/* Type Filter */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl bg-white border border-slate-200 text-slate-700 min-h-[40px] cursor-pointer"
        >
          <option value="all">كل الأنواع</option>
          <option value="مشكلة">مشاكل فقط</option>
          <option value="اقتراح">مقترحات فقط</option>
          <option value="استفسار">استفسارات فقط</option>
          <option value="أخرى..">أخرى..</option>
        </select>

        {/* Status Filter */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl bg-white border border-slate-200 text-slate-700 min-h-[40px] cursor-pointer"
        >
          <option value="all">كل الحالات</option>
          <option value="new">جديدة</option>
          <option value="in_progress">قيد المتابعة</option>
          <option value="resolved">تم الحل</option>
        </select>
      </div>

      {/* Tickets List */}
      {filteredTickets.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 text-slate-500 text-xs">
          لا توجد تذاكر دعم فني تطابق التصفية المحددة.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map((ticket) => {
            const waUrl = getCleanWhatsappUrl(ticket.senderPhone);
            const isHigh = ticket.priority === 'high';
            const isMedium = ticket.priority === 'medium';

            return (
              <div
                key={ticket.id}
                className={`bg-white rounded-2xl p-4 border transition-all space-y-3 shadow-2xs ${
                  isHigh
                    ? 'border-rose-300 ring-1 ring-rose-200/70 bg-gradient-to-r from-rose-50/20 via-white to-white'
                    : 'border-slate-200 hover:border-indigo-300'
                }`}
              >
                {/* Header Strip */}
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Priority Badge */}
                    {isHigh ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-black bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs animate-pulse">
                        <Flame className="w-3.5 h-3.5 text-rose-600" />
                        <span>أولوية عالية</span>
                      </span>
                    ) : isMedium ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        <Zap className="w-3.5 h-3.5 text-amber-600" />
                        <span>أولوية متوسطة</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        <span>أولوية منخفضة</span>
                      </span>
                    )}

                    {/* Type Badge */}
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-black border ${getTypeBadgeClass(
                        ticket.ticketType
                      )}`}
                    >
                      {ticket.ticketType}
                    </span>

                    {/* Sender Name & Role */}
                    <span className="text-xs sm:text-sm font-black text-slate-900">
                      {ticket.senderName}
                    </span>

                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                        ticket.senderRole === 'supervisor'
                          ? 'bg-purple-100 text-purple-900 border border-purple-200'
                          : ticket.senderRole === 'teacher'
                          ? 'bg-blue-100 text-blue-900 border border-blue-200'
                          : ticket.senderRole === 'student'
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                          : ticket.senderRole === 'guest'
                          ? 'bg-amber-100 text-amber-950 border border-amber-300'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {ticket.senderRole === 'supervisor'
                        ? 'مدير المجمع'
                        : ticket.senderRole === 'teacher'
                        ? 'معلم'
                        : ticket.senderRole === 'student'
                        ? 'طالب'
                        : ticket.senderRole === 'admin'
                        ? 'إدارة'
                        : 'زائر (صفحة الدخول)'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      {formatHijriDateTime(ticket.createdAt)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(ticket)}
                      title="حذف التذكرة"
                      className="w-7 h-7 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-all cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Message Body */}
                <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-100 text-xs sm:text-sm text-slate-800 leading-relaxed font-medium">
                  {ticket.message}
                </div>

                {/* Controls & Contact details */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 flex-wrap">
                  {/* Phone with WhatsApp Icon */}
                  <div className="flex items-center gap-2 text-xs text-slate-700">
                    <div className="w-5 h-5 rounded-md bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <WhatsAppIcon className="w-3.5 h-3.5 fill-white" />
                    </div>
                    <span className="font-medium text-slate-500">رقم الجوال (واتساب):</span>
                    <span className="font-black text-slate-900 tabular-nums font-mono">
                      {ticket.senderPhone || 'غير مسجل'}
                    </span>
                  </div>

                  {/* Actions: Status + WhatsApp link */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Status Selector */}
                    <div className="flex items-center gap-1 text-[11px]">
                      <span className="text-slate-400 font-medium">الحالة:</span>
                      <select
                        value={ticket.status}
                        onChange={(e) => handleStatusChange(ticket.id, e.target.value as any)}
                        className={`text-[11px] px-2 py-1 rounded-lg border font-bold cursor-pointer min-h-[30px] ${
                          ticket.status === 'resolved'
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                            : ticket.status === 'in_progress'
                            ? 'bg-blue-50 border-blue-300 text-blue-800'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        <option value="new">جديدة</option>
                        <option value="in_progress">قيد المعالجة</option>
                        <option value="resolved">تم الحل ✓</option>
                      </select>
                    </div>

                    {/* WhatsApp Action Button */}
                    {waUrl && (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-black shadow-xs transition-colors cursor-pointer"
                      >
                        <WhatsAppIcon className="w-3.5 h-3.5 fill-white" />
                        <span>مراسلة واتساب</span>
                        <ExternalLink className="w-3 h-3 opacity-80" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <ConfirmationModal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
          title="تأكيد حذف تذكرة الدعم"
          message={`هل أنت متأكد من حذف تذكرة "${deleteTarget.ticketType}" المقدمة من (${deleteTarget.senderName}) نهائياً؟`}
          confirmText="نعم، حذف التذكرة"
          cancelText="إلغاء"
          type="danger"
        />
      )}
    </div>
  );
};
