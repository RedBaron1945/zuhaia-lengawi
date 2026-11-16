import React, { useState, useEffect, useMemo } from 'react';
import { repository, subscribeToDataChanges } from '../../services/storageService';
import {
  SupportTicket,
  SupportTicketType,
  SupportTicketPriority,
  SupportTicketReply,
} from '../../types';
import {
  LifeBuoy,
  Search,
  ArchiveX,
  Flame,
  Zap,
  Send,
  MessageSquare,
  CheckCheck,
  Copy,
  Check,
  Clock,
  ChevronDown,
  ChevronUp,
  Play,
} from 'lucide-react';
import {
  formatHijriDateTime,
  formatRelativeTimeArabic,
  isOlderThanHours,
} from '../../utils/dateUtils';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { useToast } from '../../context/ToastContext';
import { WhatsAppIcon } from '../common/WhatsAppIcon';
import { PendingTicketStudentAction } from './StudentsManagement';

interface SupportTicketsManagerProps {
  onExecuteStudentAction?: (action: PendingTicketStudentAction) => void;
}

interface TicketGroup {
  groupKey: string;
  senderName: string;
  senderRole?: SupportTicket['senderRole'];
  tickets: SupportTicket[];
}

const ROLE_LABELS: Record<string, string> = {
  supervisor: 'مدير المجمع',
  teacher: 'معلم',
  student: 'طالب',
  admin: 'إدارة',
  guest: 'زائر (صفحة الدخول)',
};

const cleanExtractedStudentName = (raw: string): string => {
  let name = raw
    .split(/\r?\n/)[0]
    .replace(/^[:"'«»()\[\]\-–—\s]+/, '')
    .replace(/^(?:جديد|باسم|اسمه|اسمها|يدعى|تدعى|وهو|وهي|التالي|الآتي)\s+/, '')
    .replace(/\s+(?:من|في|إلى|الى|ل|ب)\s*حلقة[\s\S]*$/i, '')
    .replace(/\s+(?:برقم|جوال|رقم|هوية|وشكرا|شكراً|شكرا|جزاكم)[\s\S]*$/i, '')
    .replace(/[:"'«»()\[\].,،!؟\-–—\s]+$/g, '')
    .trim();

  const words = name.split(/\s+/).filter(Boolean);
  if (words.length > 5) {
    name = words.slice(0, 4).join(' ');
  }
  return name;
};

const detectStudentTicketAction = (
  message: string
): { type: 'add' | 'delete'; studentName: string } | null => {
  const text = (message || '').trim();
  if (!text) return null;

  const deleteMatch = text.match(
    /(?:حذف|احذف|إزالة|ازالة|مسح|شطب)\s+(?:ال)?طالب(?:\s+(?:باسم|اسمه|يدعى))?\s*[:\-–—]?\s*([^\n\r]+)/i
  );
  if (deleteMatch?.[1]) {
    const studentName = cleanExtractedStudentName(deleteMatch[1]);
    if (studentName.length >= 2) {
      return { type: 'delete', studentName };
    }
  }

  const addMatch = text.match(
    /(?:(?:إضافة|اضافة|أضف|اضف|تسجيل|إدخال|ادخال)\s+(?:ال)?طالب(?:\s+جديد)?|طالب\s+جديد)(?:\s+(?:باسم|اسمه|يدعى))?\s*[:\-–—]?\s*([^\n\r]+)/i
  );
  if (addMatch?.[1]) {
    const studentName = cleanExtractedStudentName(addMatch[1]);
    if (studentName.length >= 2) {
      return { type: 'add', studentName };
    }
  }

  return null;
};

const getSenderGroupKey = (t: SupportTicket): string => {
  if (t.senderId && t.senderId !== 'guest') {
    return `id:${t.senderId}`;
  }
  return `name:${(t.senderName || '').trim()}::role:${t.senderRole || 'guest'}`;
};

export const SupportTicketsManager: React.FC<SupportTicketsManagerProps> = ({
  onExecuteStudentAction,
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | 'high' | 'other'>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [closeTarget, setCloseTarget] = useState<SupportTicket | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [replyOpenId, setReplyOpenId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
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
  const otherPriorityCount = useMemo(
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
        if (filterPriority === 'high' && t.priority !== 'high') return false;
        if (filterPriority === 'other' && t.priority === 'high') return false;
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
        const priorityWeights: Record<SupportTicketPriority, number> = {
          high: 3,
          medium: 2,
          low: 1,
        };
        const weightA = priorityWeights[a.priority] || 2;
        const weightB = priorityWeights[b.priority] || 2;

        if (weightB !== weightA) {
          return weightB - weightA;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [tickets, filterType, filterPriority, filterStatus, search]);

  // Group consecutive tickets from the same sender
  const groupedTickets = useMemo<TicketGroup[]>(() => {
    const groups: TicketGroup[] = [];
    filteredTickets.forEach((ticket, idx) => {
      const senderKey = getSenderGroupKey(ticket);
      const prev = groups[groups.length - 1];
      if (prev && prev.groupKey.startsWith(`${senderKey}__run_`) && getSenderGroupKey(prev.tickets[0]) === senderKey) {
        prev.tickets.push(ticket);
      } else {
        groups.push({
          groupKey: `${senderKey}__run_${idx}_${ticket.id}`,
          senderName: ticket.senderName,
          senderRole: ticket.senderRole,
          tickets: [ticket],
        });
      }
    });
    return groups;
  }, [filteredTickets]);

  const handleStatusChange = (ticketId: string, newStatus: 'new' | 'in_progress' | 'resolved') => {
    const res = repository.updateSupportTicket(ticketId, { status: newStatus });
    if (res.success) {
      showToast('تم تحديث حالة التذكرة', 'info');
      setTick((t) => t + 1);
    }
  };

  const handleConfirmCloseTicket = async () => {
    if (!closeTarget || isClosing) return;
    const targetId = closeTarget.id;
    setIsClosing(true);
    try {
      const res = await repository.closeSupportTicket(targetId);
      if (res.success) {
        setReplyDrafts((prev) => {
          if (!(targetId in prev)) return prev;
          const next = { ...prev };
          delete next[targetId];
          return next;
        });
        setReplyOpenId((prev) => (prev === targetId ? null : prev));
        setCloseTarget(null);
        showToast(res.message, 'success');
        setTick((t) => t + 1);
      } else {
        showToast(res.message, 'error');
      }
    } catch {
      showToast('تعذر إغلاق التذكرة من الخادم، يرجى المحاولة لاحقاً', 'error');
    } finally {
      setIsClosing(false);
    }
  };

  const handleCopyPhone = async (ticketId: string, phone: string) => {
    try {
      await navigator.clipboard.writeText(phone);
      setCopiedPhoneId(ticketId);
      showToast('تم نسخ رقم الجوال', 'info');
      window.setTimeout(() => {
        setCopiedPhoneId((prev) => (prev === ticketId ? null : prev));
      }, 1800);
    } catch {
      showToast('تعذر نسخ الرقم تلقائياً', 'error');
    }
  };

  const getTicketReplies = (ticket: SupportTicket): SupportTicketReply[] => {
    if (Array.isArray(ticket.replies) && ticket.replies.length > 0) {
      return ticket.replies;
    }
    if (ticket.adminReply) {
      return [
        {
          id: `legacy_${ticket.id}`,
          message: ticket.adminReply,
          senderName: 'الدعم الفني',
          senderRole: 'admin',
          createdAt: ticket.adminReplyAt || ticket.createdAt,
        },
      ];
    }
    return [];
  };

  const handleSendReply = (ticketId: string, markResolved: boolean) => {
    const draft = (replyDrafts[ticketId] || '').trim();
    if (!draft) {
      showToast('الرجاء كتابة نص الرد أولاً', 'error');
      return;
    }

    const res = repository.replyToSupportTicket({
      ticketId,
      message: draft,
      senderName: 'الدعم الفني',
      senderRole: 'admin',
      markResolved,
    });

    if (res.success) {
      setReplyDrafts((prev) => ({ ...prev, [ticketId]: '' }));
      setReplyOpenId(null);
      showToast(res.message, 'success');
      setTick((t) => t + 1);
    } else {
      showToast(res.message, 'error');
    }
  };

  const getTypeBadgeClass = (type: SupportTicketType) => {
    switch (type) {
      case 'مشكلة':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      case 'اقتراح':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'استفسار':
        return 'bg-sky-50 text-sky-800 border-sky-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getCleanWhatsappUrl = (phone?: string) => {
    if (!phone) return null;
    let clean = phone.replace(/[^0-9]/g, '');
    if (!clean) return null;
    if (clean.startsWith('05')) {
      clean = '966' + clean.slice(1);
    } else if (clean.startsWith('5')) {
      clean = '966' + clean;
    }
    return `https://wa.me/${clean}`;
  };

  const renderTicketCard = (ticket: SupportTicket) => {
    const cleanPhone = (ticket.senderPhone || '').trim();
    const waUrl = getCleanWhatsappUrl(cleanPhone);
    const isHigh = ticket.priority === 'high';
    const isMedium = ticket.priority === 'medium';
    const replies = getTicketReplies(ticket);
    const hasAdminReply = replies.some((r) => r.senderRole === 'admin');
    const isReplyOpen = replyOpenId === ticket.id;
    const draft = replyDrafts[ticket.id] || '';
    const isGuest = ticket.senderRole === 'guest' || ticket.senderId === 'guest';
    const relativeTime = formatRelativeTimeArabic(ticket.createdAt);
    const isOverdue = ticket.status !== 'resolved' && isOlderThanHours(ticket.createdAt, 24);
    const quickAction = ticket.status !== 'resolved' ? detectStudentTicketAction(ticket.message) : null;

    return (
      <div
        key={ticket.id}
        className="bg-white rounded-2xl p-4 border border-slate-200 hover:border-slate-300 transition-colors space-y-3 shadow-2xs"
      >
        {/* Header Strip */}
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Priority Badge (Color restricted to badge only, no pulse) */}
            {isHigh ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-black bg-rose-100 text-rose-800 border border-rose-200">
                <Flame className="w-3.5 h-3.5 text-rose-600" />
                <span>أولوية عالية</span>
              </span>
            ) : isMedium ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
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
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold border ${getTypeBadgeClass(
                ticket.ticketType
              )}`}
            >
              {ticket.ticketType}
            </span>

            {/* Overdue >24h Flag */}
            {isOverdue && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                <Clock className="w-3 h-3 text-rose-600" />
                <span>متأخرة +24 ساعة</span>
              </span>
            )}

            {/* Sender Name & Role */}
            <span className="text-xs sm:text-sm font-black text-slate-900">
              {ticket.senderName}
            </span>

            <span className="text-[11px] text-slate-500 font-semibold">
              · {ROLE_LABELS[ticket.senderRole || 'guest'] || 'مستخدم'}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-slate-500 tabular-nums">
              {relativeTime ? `${relativeTime} · ` : ''}
              {formatHijriDateTime(ticket.createdAt)}
            </span>
          </div>
        </div>

        {/* Message Body */}
        <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-100 text-xs sm:text-sm text-slate-800 leading-relaxed font-medium whitespace-pre-line">
          {ticket.message}
        </div>

        {/* Conversation Thread (Replies) */}
        {replies.length > 0 && (
          <div className="space-y-2 pt-1">
            {replies.map((reply) => {
              const isFromSupport = reply.senderRole === 'admin';
              return (
                <div
                  key={reply.id}
                  className={`p-3 rounded-xl border text-xs sm:text-sm leading-relaxed space-y-1 ${
                    isFromSupport
                      ? 'bg-indigo-50/60 border-indigo-200/80 text-slate-900'
                      : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] flex-wrap">
                    <span
                      className={`font-black flex items-center gap-1 ${
                        isFromSupport ? 'text-indigo-900' : 'text-slate-700'
                      }`}
                    >
                      <CheckCheck className="w-3.5 h-3.5 text-indigo-700" />
                      <span>
                        {isFromSupport
                          ? 'رد الدعم الفني'
                          : `تعقيب المرسل (${reply.senderName})`}
                      </span>
                    </span>
                    <span className="text-slate-400 tabular-nums">
                      {formatHijriDateTime(reply.createdAt)}
                    </span>
                  </div>
                  <p className="whitespace-pre-line font-medium">{reply.message}</p>
                </div>
              );
            })}

            {hasAdminReply && !isGuest && (
              <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5 px-1">
                <span className={ticket.unreadByUser ? 'text-amber-700' : 'text-emerald-700'}>
                  {ticket.unreadByUser
                    ? 'بانتظار قراءة المرسل في صندوق الوارد'
                    : 'تمت قراءة الرد من قِبل المرسل'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Inline Reply Composer */}
        {isReplyOpen && (
          <div className="p-3 rounded-xl bg-slate-50 border border-indigo-200/80 space-y-2.5">
            {isGuest && (
              <p className="text-[11px] text-amber-800 font-bold">
                ملاحظة: هذه تذكرة زائر من صفحة الدخول ولا يملك صندوق وارد؛ يفضّل التواصل معه عبر الواتساب.
              </p>
            )}
            <textarea
              value={draft}
              onChange={(e) =>
                setReplyDrafts((prev) => ({ ...prev, [ticket.id]: e.target.value }))
              }
              placeholder="اكتب ردك هنا ليصل مباشرة إلى صندوق وارد المرسل..."
              rows={3}
              className="w-full p-3 text-base sm:text-xs rounded-xl bg-white border border-slate-200 focus:outline-hidden focus:border-indigo-600 text-slate-800 placeholder:text-slate-400 font-[inherit] resize-none"
            />
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleSendReply(ticket.id, false)}
                disabled={!draft.trim()}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-indigo-900 hover:bg-indigo-950 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>إرسال الرد</span>
              </button>
              <button
                type="button"
                onClick={() => handleSendReply(ticket.id, true)}
                disabled={!draft.trim()}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>إرسال وتم الحل</span>
              </button>
              <button
                type="button"
                onClick={() => setReplyOpenId(null)}
                className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 text-xs font-bold transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}

        {/* Controls & Optional Contact Details */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 flex-wrap">
          {/* Phone Bar: Hidden completely if no phone */}
          {cleanPhone ? (
            <div className="flex items-center gap-2 text-xs text-slate-700">
              {waUrl && (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="فتح محادثة واتساب"
                  aria-label={`مراسلة ${cleanPhone} عبر واتساب`}
                  className="min-h-[34px] min-w-[34px] px-2 rounded-lg bg-[#25D366] hover:bg-[#20ba59] text-white inline-flex items-center justify-center shadow-2xs transition-colors cursor-pointer"
                >
                  <WhatsAppIcon className="w-4 h-4 fill-white" />
                </a>
              )}
              <span className="font-bold text-slate-900 tabular-nums font-mono" dir="ltr">
                {cleanPhone}
              </span>
              <button
                type="button"
                onClick={() => handleCopyPhone(ticket.id, cleanPhone)}
                className="min-h-[34px] px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                {copiedPhoneId === ticket.id ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span>تم النسخ</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-slate-500" />
                    <span>نسخ</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div />
          )}

          {/* Actions: Segmented Status + Execute + Reply */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Segmented Status Buttons: جديدة · قيد المعالجة · تمت */}
            <div
              role="group"
              aria-label="حالة التذكرة"
              className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-100 p-0.5 text-[11px] font-bold"
            >
              <button
                type="button"
                onClick={() => handleStatusChange(ticket.id, 'new')}
                className={`px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  ticket.status === 'new'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                جديدة
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange(ticket.id, 'in_progress')}
                className={`px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  ticket.status === 'in_progress'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                قيد المعالجة
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange(ticket.id, 'resolved')}
                className={`px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  ticket.status === 'resolved'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                تمت
              </button>
            </div>

            {/* Quick "تنفيذ" Button for Add/Delete Student Requests */}
            {quickAction && onExecuteStudentAction && (
              <button
                type="button"
                onClick={() =>
                  onExecuteStudentAction({
                    ticketId: ticket.id,
                    type: quickAction.type,
                    studentName: quickAction.studentName,
                  })
                }
                title={
                  quickAction.type === 'add'
                    ? `تنفيذ إضافة الطالب: ${quickAction.studentName}`
                    : `تنفيذ حذف الطالب: ${quickAction.studentName}`
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[40px] rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-extrabold shadow-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>تنفيذ</span>
              </button>
            )}

            {/* In-Site Reply Toggle Button */}
            <button
              type="button"
              onClick={() => setReplyOpenId(isReplyOpen ? null : ticket.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[40px] rounded-xl text-xs font-extrabold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                isReplyOpen
                  ? 'bg-indigo-100 border-indigo-300 text-indigo-950'
                  : 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-900'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{hasAdminReply ? 'إضافة رد' : 'رد داخل الموقع'}</span>
            </button>

            {/* Close Ticket (Permanent Deletion Everywhere) Button */}
            <button
              type="button"
              onClick={() => setCloseTarget(ticket)}
              title="إغلاق التذكرة وحذفها نهائياً من السجلات والخادم"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[40px] rounded-xl text-xs font-extrabold border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <ArchiveX className="w-3.5 h-3.5" />
              <span>إغلاق التذكرة</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Clickable Summary Stat Filters (الكل · عالية · أخرى) */}
      <div className="grid grid-cols-3 gap-2.5">
        {/* الكل */}
        <button
          type="button"
          onClick={() => setFilterPriority('all')}
          className={`rounded-2xl p-3 border text-right flex items-center justify-between transition-all cursor-pointer ${
            filterPriority === 'all'
              ? 'bg-indigo-50/80 border-indigo-600 ring-2 ring-indigo-600/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-900 text-white flex items-center justify-center shrink-0">
              <LifeBuoy className="w-5 h-5 text-indigo-200" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-slate-900">الكل</p>
              <p className="text-[10px] text-slate-500 truncate">
                {newTicketsCount > 0 ? `${newTicketsCount} جديدة` : 'جميع التذاكر'}
              </p>
            </div>
          </div>
          <span className="text-xl font-black text-indigo-950 tabular-nums font-mono">
            {tickets.length}
          </span>
        </button>

        {/* عالية */}
        <button
          type="button"
          onClick={() => setFilterPriority((prev) => (prev === 'high' ? 'all' : 'high'))}
          className={`rounded-2xl p-3 border text-right flex items-center justify-between transition-all cursor-pointer ${
            filterPriority === 'high'
              ? 'bg-rose-50/80 border-rose-600 ring-2 ring-rose-600/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
              <Flame className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-slate-900">عالية</p>
              <p className="text-[10px] text-slate-500 truncate">مدير أو معلم</p>
            </div>
          </div>
          <span className="text-xl font-black text-rose-700 tabular-nums font-mono">
            {highPriorityCount}
          </span>
        </button>

        {/* أخرى */}
        <button
          type="button"
          onClick={() => setFilterPriority((prev) => (prev === 'other' ? 'all' : 'other'))}
          className={`rounded-2xl p-3 border text-right flex items-center justify-between transition-all cursor-pointer ${
            filterPriority === 'other'
              ? 'bg-amber-50/80 border-amber-500 ring-2 ring-amber-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-slate-900">أخرى</p>
              <p className="text-[10px] text-slate-500 truncate">متوسطة ومنخفضة</p>
            </div>
          </div>
          <span className="text-xl font-black text-amber-700 tabular-nums font-mono">
            {otherPriorityCount}
          </span>
        </button>
      </div>

      {/* Search & Type/Status Filters (No Priority Dropdown) */}
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

        {/* Type Filter */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          aria-label="تصفية حسب نوع التذكرة"
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
          aria-label="تصفية حسب حالة التذكرة"
          className="px-3 py-2 text-xs rounded-xl bg-white border border-slate-200 text-slate-700 min-h-[40px] cursor-pointer"
        >
          <option value="all">كل الحالات</option>
          <option value="new">جديدة</option>
          <option value="in_progress">قيد المعالجة</option>
          <option value="resolved">تمت</option>
        </select>
      </div>

      {/* Tickets List (Grouped by consecutive same-sender) */}
      {groupedTickets.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 text-slate-500 text-xs">
          لا توجد تذاكر دعم فني تطابق التصفية المحددة.
        </div>
      ) : (
        <div className="space-y-3">
          {groupedTickets.map((group) => {
            if (group.tickets.length === 1) {
              return renderTicketCard(group.tickets[0]);
            }

            const isExpanded = Boolean(expandedGroups[group.groupKey]);
            const extraCount = group.tickets.length - 1;

            return (
              <div
                key={group.groupKey}
                className="rounded-2xl border border-slate-200 bg-slate-50/70 p-2 space-y-2"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedGroups((prev) => ({
                      ...prev,
                      [group.groupKey]: !prev[group.groupKey],
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-extrabold text-slate-900 truncate">
                      {group.senderName}
                    </span>
                    <span className="text-[11px] text-slate-500 font-semibold shrink-0">
                      · {ROLE_LABELS[group.senderRole || 'guest'] || 'مستخدم'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-indigo-800 font-extrabold shrink-0 tabular-nums">
                    <span>
                      {isExpanded
                        ? `إخفاء (${group.tickets.length} تذاكر)`
                        : `${group.tickets.length} تذاكر متتالية (+${extraCount})`}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </button>

                {/* Always show the top/first ticket in the consecutive run */}
                {renderTicketCard(group.tickets[0])}

                {/* Show remaining consecutive tickets when expanded */}
                {isExpanded && (
                  <div className="space-y-2 pt-0.5">
                    {group.tickets.slice(1).map((t) => renderTicketCard(t))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Close Ticket Confirmation Modal */}
      {closeTarget && (
        <ConfirmationModal
          isOpen={!!closeTarget}
          onClose={() => {
            if (!isClosing) setCloseTarget(null);
          }}
          onConfirm={handleConfirmCloseTicket}
          title="إغلاق التذكرة وحذفها نهائياً"
          message={`هل أنت متأكد من إغلاق تذكرة "${closeTarget.ticketType}" المقدمة من (${closeTarget.senderName})؟\n\nسيتم حذف التذكرة وكافة ردودها وسجلاتها نهائياً من حسابك، ومن صندوق وارد صاحب التذكرة، ومن الخادم لتوفير المساحة، ولا يمكن استعادتها بعد الإغلاق.`}
          confirmText="نعم، إغلاق وحذف نهائياً"
          cancelText="إلغاء"
          type="danger"
          loading={isClosing}
        />
      )}
    </div>
  );
};
