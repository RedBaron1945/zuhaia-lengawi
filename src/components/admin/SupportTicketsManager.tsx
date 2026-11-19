import React, { useState, useEffect, useMemo } from 'react';
import { repository, subscribeToDataChanges } from '../../services/storageService';
import {
  SupportTicket,
  SupportTicketType,
  SupportTicketPriority,
  SupportTicketReply,
  SupportMessage,
  SupportMessageAudience,
} from '../../types';
import {
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
  Megaphone,
  Users,
  BookOpen,
  GraduationCap,
  Shield,
  UserCheck,
  Eye,
  Trash2,
} from 'lucide-react';
import {
  formatHijriDateTime,
  formatRelativeTimeArabic,
  isOlderThanHours,
} from '../../utils/dateUtils';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { useToast } from '../../context/ToastContext';
import { WhatsAppIcon } from '../common/WhatsAppIcon';
import { SendSupportMessageModal } from './SendSupportMessageModal';

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

const getSenderGroupKey = (t: SupportTicket): string => {
  if (t.senderId && t.senderId !== 'guest') {
    return `id:${t.senderId}`;
  }
  return `name:${(t.senderName || '').trim()}::role:${t.senderRole || 'guest'}`;
};

const AUDIENCE_META: Record<
  SupportMessageAudience,
  { label: string; badgeClass: string }
> = {
  all: {
    label: 'الجميع',
    badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-200',
  },
  teachers: {
    label: 'المعلمون فقط',
    badgeClass: 'bg-sky-50 text-sky-900 border-sky-200',
  },
  students: {
    label: 'الطلاب فقط',
    badgeClass: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  },
  supervisors: {
    label: 'مدير المجمع',
    badgeClass: 'bg-amber-50 text-amber-900 border-amber-200',
  },
  custom: {
    label: 'أسماء محددة',
    badgeClass: 'bg-purple-50 text-purple-900 border-purple-200',
  },
};

export const SupportTicketsManager: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'tickets' | 'sent_messages'>('tickets');
  const [search, setSearch] = useState('');
  const [sentSearch, setSentSearch] = useState('');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [closeTarget, setCloseTarget] = useState<SupportTicket | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [deleteMsgTarget, setDeleteMsgTarget] = useState<SupportMessage | null>(null);
  const [isDeletingMsg, setIsDeletingMsg] = useState(false);
  const [expandedReadersMsgId, setExpandedReadersMsgId] = useState<string | null>(null);
  const [expandedRecipientsMsgIds, setExpandedRecipientsMsgIds] = useState<Record<string, boolean>>({});
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
  const sentMessages = repository.getSupportMessages();
  const allMessageReads = repository.getSupportMessageReads();

  const readsByMessageId = useMemo(() => {
    const map = new Map<string, typeof allMessageReads>();
    allMessageReads.forEach((r) => {
      const arr = map.get(r.messageId);
      if (arr) arr.push(r);
      else map.set(r.messageId, [r]);
    });
    return map;
  }, [allMessageReads]);

  const filteredSentMessages = useMemo(() => {
    const q = sentSearch.trim().toLowerCase();
    if (!q) return sentMessages;
    return sentMessages.filter((m) => {
      const titleMatch = (m.title || '').toLowerCase().includes(q);
      const bodyMatch = m.body.toLowerCase().includes(q);
      const audienceMatch = AUDIENCE_META[m.audienceType]?.label.includes(q);
      const recipientsMatch = (m.recipientNames || []).some((n) => n.toLowerCase().includes(q));
      return titleMatch || bodyMatch || audienceMatch || recipientsMatch;
    });
  }, [sentMessages, sentSearch]);

  // Filtered and Sorted Tickets
  const filteredTickets = useMemo(() => {
    return tickets
      .filter((t) => {
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
  }, [tickets, search]);

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

  const handleConfirmDeleteMessage = async () => {
    if (!deleteMsgTarget || isDeletingMsg) return;
    const targetId = deleteMsgTarget.id;
    setIsDeletingMsg(true);
    try {
      const res = await repository.deleteSupportMessage(targetId);
      if (res.success) {
        setExpandedReadersMsgId((prev) => (prev === targetId ? null : prev));
        setDeleteMsgTarget(null);
        showToast(res.message, 'success');
        setTick((t) => t + 1);
      } else {
        showToast(res.message, 'error');
      }
    } catch {
      showToast('تعذر حذف الرسالة من الخادم، يرجى المحاولة لاحقاً', 'error');
    } finally {
      setIsDeletingMsg(false);
    }
  };

  const renderAudienceIcon = (audienceType: SupportMessageAudience) => {
    switch (audienceType) {
      case 'all':
        return <Users className="w-3.5 h-3.5" />;
      case 'teachers':
        return <BookOpen className="w-3.5 h-3.5" />;
      case 'students':
        return <GraduationCap className="w-3.5 h-3.5" />;
      case 'supervisors':
        return <Shield className="w-3.5 h-3.5" />;
      case 'custom':
        return <UserCheck className="w-3.5 h-3.5" />;
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

          {/* Actions: Segmented Status + Reply */}
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
      {/* Section Switcher & Send Message CTA */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div
          role="tablist"
          aria-label="أقسام الدعم الفني"
          className="inline-flex items-center rounded-xl border border-slate-200 bg-white p-1 text-xs font-bold shadow-2xs"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeSection === 'tickets'}
            onClick={() => setActiveSection('tickets')}
            className={`flex-1 sm:flex-none px-3.5 py-2 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 tabular-nums ${
              activeSection === 'tickets'
                ? 'bg-indigo-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>التذاكر الواردة ({tickets.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSection === 'sent_messages'}
            onClick={() => setActiveSection('sent_messages')}
            className={`flex-1 sm:flex-none px-3.5 py-2 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 tabular-nums ${
              activeSection === 'sent_messages'
                ? 'bg-indigo-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5" />
            <span>الرسائل المرسلة ({sentMessages.length})</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setIsComposeOpen(true)}
          className="min-h-[42px] px-4 py-2 rounded-xl bg-indigo-900 hover:bg-indigo-950 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
          <span>إرسال رسالة للمستخدمين</span>
        </button>
      </div>

      {activeSection === 'tickets' ? (
        <>
          {/* Search Bar */}
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
        </>
      ) : (
        <>
          {/* Sent Messages Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={sentSearch}
              onChange={(e) => setSentSearch(e.target.value)}
              placeholder="بحث في الرسائل المرسلة بالعنوان أو النص أو اسم المستلم..."
              className="w-full pr-9 pl-3 py-2 text-xs rounded-xl bg-white border border-slate-200 focus:outline-hidden focus:border-indigo-600 min-h-[40px]"
            />
          </div>

          {filteredSentMessages.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 space-y-3">
              <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center mx-auto">
                <Megaphone className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-extrabold text-slate-800">
                  {sentMessages.length === 0
                    ? 'لم يتم إرسال أي رسائل للمستخدمين بعد'
                    : 'لا توجد رسائل مطابقة لبحثك'}
                </p>
                <p className="text-xs text-slate-500">
                  يمكنك إرسال رسالة فورية تصل إلى صندوق الوارد للجميع أو للمعلمين فقط أو لأسماء محددة.
                </p>
              </div>
              {sentMessages.length === 0 && (
                <button
                  type="button"
                  onClick={() => setIsComposeOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-xl bg-indigo-900 hover:bg-indigo-950 text-white text-xs font-extrabold transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>إرسال أول رسالة</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSentMessages.map((msg) => {
                const audienceInfo = AUDIENCE_META[msg.audienceType] || AUDIENCE_META.all;
                const reads = readsByMessageId.get(msg.id) || [];
                const isReadersOpen = expandedReadersMsgId === msg.id;
                const relativeTime = formatRelativeTimeArabic(msg.createdAt);
                const customNames = msg.recipientNames || [];
                const showAllNames = Boolean(expandedRecipientsMsgIds[msg.id]);
                const displayedNames = showAllNames ? customNames : customNames.slice(0, 6);

                return (
                  <div
                    key={msg.id}
                    className="bg-white rounded-2xl p-4 border border-slate-200 hover:border-slate-300 transition-colors space-y-3 shadow-2xs"
                  >
                    {/* Header Strip */}
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-extrabold border ${audienceInfo.badgeClass}`}
                        >
                          {renderAudienceIcon(msg.audienceType)}
                          <span>
                            إلى: {audienceInfo.label}
                            {msg.recipientCount > 0 ? ` (${msg.recipientCount})` : ''}
                          </span>
                        </span>
                        <span className="text-[11px] text-slate-500 font-semibold">
                          · {msg.senderName}
                        </span>
                      </div>

                      <span className="text-[11px] text-slate-500 tabular-nums shrink-0">
                        {relativeTime ? `${relativeTime} · ` : ''}
                        {formatHijriDateTime(msg.createdAt)}
                      </span>
                    </div>

                    {/* Custom recipients list */}
                    {msg.audienceType === 'custom' && customNames.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                        <span className="font-bold text-slate-500">المستلمون:</span>
                        {displayedNames.map((name, i) => (
                          <span
                            key={`${msg.id}_rec_${i}`}
                            className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold border border-slate-200/80"
                          >
                            {name}
                          </span>
                        ))}
                        {customNames.length > 6 && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedRecipientsMsgIds((prev) => ({
                                ...prev,
                                [msg.id]: !prev[msg.id],
                              }))
                            }
                            className="text-indigo-800 hover:text-indigo-950 font-extrabold cursor-pointer px-1"
                          >
                            {showAllNames
                              ? 'عرض أقل'
                              : `+${customNames.length - 6} آخرين`}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Title & Message Body */}
                    <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-100 space-y-1">
                      {msg.title && (
                        <h4 className="text-xs sm:text-sm font-black text-slate-900">
                          {msg.title}
                        </h4>
                      )}
                      <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-medium whitespace-pre-line">
                        {msg.body}
                      </p>
                    </div>

                    {/* Footer: Read Receipts + Delete */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 flex-wrap">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedReadersMsgId(isReadersOpen ? null : msg.id)
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer tabular-nums"
                      >
                        <Eye className="w-3.5 h-3.5 text-emerald-700" />
                        <span>
                          قرأها {reads.length}
                          {msg.recipientCount > 0 ? ` من ${msg.recipientCount}` : ''}
                        </span>
                        {isReadersOpen ? (
                          <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteMsgTarget(msg)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-xl text-xs font-extrabold border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف الرسالة</span>
                      </button>
                    </div>

                    {/* Expanded Readers Drawer */}
                    {isReadersOpen && (
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                        <div className="text-[11px] font-extrabold text-slate-700">
                          سجل القراءة ({reads.length})
                        </div>
                        {reads.length === 0 ? (
                          <p className="text-xs text-slate-500">
                            لم يقرأ أي مستلم هذه الرسالة حتى الآن.
                          </p>
                        ) : (
                          <div className="max-h-44 overflow-y-auto divide-y divide-slate-200/60 bg-white rounded-lg border border-slate-200/70">
                            {reads.map((r) => (
                              <div
                                key={r.id}
                                className="px-3 py-2 flex items-center justify-between gap-2 text-xs"
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <CheckCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span className="font-bold text-slate-800 truncate">
                                    {r.userName}
                                  </span>
                                  <span className="text-[11px] text-slate-500 shrink-0">
                                    · {ROLE_LABELS[r.userRole] || 'مستخدم'}
                                  </span>
                                </div>
                                <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                                  {formatHijriDateTime(r.readAt)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Compose Support Message Modal */}
      <SendSupportMessageModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSent={() => {
          setActiveSection('sent_messages');
          setTick((t) => t + 1);
        }}
      />

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

      {/* Delete Sent Message Confirmation Modal */}
      {deleteMsgTarget && (
        <ConfirmationModal
          isOpen={!!deleteMsgTarget}
          onClose={() => {
            if (!isDeletingMsg) setDeleteMsgTarget(null);
          }}
          onConfirm={handleConfirmDeleteMessage}
          title="حذف الرسالة المرسلة"
          message={`هل أنت متأكد من حذف هذه الرسالة؟\n\nسيتم إزالتها نهائياً من سجل الرسائل المرسلة ومن صندوق الوارد لدى جميع المستلمين، ولن يمكن استعادتها بعد الحذف.`}
          confirmText="نعم، حذف الرسالة"
          cancelText="إلغاء"
          type="danger"
          loading={isDeletingMsg}
        />
      )}
    </div>
  );
};
