import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  User,
  SupportTicket,
  SupportTicketReply,
  SupportMessage,
  SupportMessageAudience,
} from '../../types';
import { repository, subscribeToDataChanges } from '../../services/storageService';
import { formatHijriDateTime } from '../../utils/dateUtils';
import { useToast } from '../../context/ToastContext';
import {
  Inbox,
  X,
  Send,
  ChevronDown,
  ChevronUp,
  Plus,
  MessageSquare,
  CheckCheck,
  Megaphone,
  Reply,
} from 'lucide-react';

interface SupportInboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onOpenNewTicket?: () => void;
}

type InboxFilterTab = 'all' | 'messages' | 'tickets';

type UnifiedInboxItem =
  | {
      kind: 'message';
      key: string;
      isUnread: boolean;
      sortTime: number;
      message: SupportMessage;
    }
  | {
      kind: 'ticket';
      key: string;
      isUnread: boolean;
      sortTime: number;
      ticket: SupportTicket;
    };

const STATUS_LABELS: Record<SupportTicket['status'], { label: string; colorClass: string }> = {
  new: { label: 'جديدة', colorClass: 'text-slate-600' },
  in_progress: { label: 'قيد المتابعة', colorClass: 'text-teal-800' },
  resolved: { label: 'تم الحل', colorClass: 'text-emerald-700' },
};

const AUDIENCE_INBOX_LABELS: Record<SupportMessageAudience, string> = {
  all: 'إعلان للجميع',
  teachers: 'رسالة للمعلمين',
  students: 'رسالة للطلاب',
  supervisors: 'رسالة لمدير المجمع',
  custom: 'رسالة مخصصة لك',
};

export const SupportInboxModal: React.FC<SupportInboxModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onOpenNewTicket,
}) => {
  const { showToast } = useToast();
  const [, setTick] = useState(0);
  const [activeFilter, setActiveFilter] = useState<InboxFilterTab>('all');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [msgReplyOpenId, setMsgReplyOpenId] = useState<string | null>(null);
  const [msgReplyDrafts, setMsgReplyDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    const unsub = subscribeToDataChanges(() => {
      setTick((t) => t + 1);
    });
    return unsub;
  }, [isOpen]);

  // Re-fetch synchronously on render when tick updates
  const liveTickets = isOpen ? repository.getSupportTicketsForUser(currentUser) : [];
  const liveMessages = isOpen ? repository.getSupportMessagesForUser(currentUser) : [];

  const unifiedItems = useMemo<UnifiedInboxItem[]>(() => {
    if (!isOpen) return [];
    const items: UnifiedInboxItem[] = [];

    liveMessages.forEach((msg) => {
      const isUnread = !repository.isSupportMessageReadByUser(msg.id, currentUser);
      items.push({
        kind: 'message',
        key: `msg:${msg.id}`,
        isUnread,
        sortTime: new Date(msg.createdAt).getTime(),
        message: msg,
      });
    });

    liveTickets.forEach((ticket) => {
      const isUnread = Boolean(ticket.unreadByUser);
      items.push({
        kind: 'ticket',
        key: `ticket:${ticket.id}`,
        isUnread,
        sortTime: new Date(ticket.adminReplyAt || ticket.createdAt).getTime(),
        ticket,
      });
    });

    return items.sort((a, b) => {
      if (a.isUnread !== b.isUnread) {
        return b.isUnread ? 1 : -1;
      }
      return b.sortTime - a.sortTime;
    });
  }, [isOpen, liveMessages, liveTickets, currentUser]);

  const unreadCount = unifiedItems.filter((item) => item.isUnread).length;
  const unreadMessagesCount = unifiedItems.filter(
    (item) => item.kind === 'message' && item.isUnread
  ).length;
  const unreadTicketsCount = unifiedItems.filter(
    (item) => item.kind === 'ticket' && item.isUnread
  ).length;

  const visibleItems = useMemo(() => {
    if (activeFilter === 'messages') {
      return unifiedItems.filter((i) => i.kind === 'message');
    }
    if (activeFilter === 'tickets') {
      return unifiedItems.filter((i) => i.kind === 'ticket');
    }
    return unifiedItems;
  }, [unifiedItems, activeFilter]);

  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  // Auto-open the first unread item (or only item) when opening inbox
  useEffect(() => {
    if (!isOpen) {
      setExpandedKey(null);
      setActiveFilter('all');
      setMsgReplyOpenId(null);
      return;
    }

    const user = currentUserRef.current;
    const msgs = repository.getSupportMessagesForUser(user);
    const tks = repository.getSupportTicketsForUser(user);

    const firstUnreadMsg = msgs.find((m) => !repository.isSupportMessageReadByUser(m.id, user));
    const firstUnreadTicket = tks.find((t) => t.unreadByUser);

    if (firstUnreadMsg && firstUnreadTicket) {
      const msgTime = new Date(firstUnreadMsg.createdAt).getTime();
      const tkTime = new Date(firstUnreadTicket.adminReplyAt || firstUnreadTicket.createdAt).getTime();
      if (msgTime >= tkTime) {
        setExpandedKey(`msg:${firstUnreadMsg.id}`);
        repository.markSupportMessageAsRead(firstUnreadMsg.id, user);
      } else {
        setExpandedKey(`ticket:${firstUnreadTicket.id}`);
        repository.markSupportTicketAsRead(firstUnreadTicket.id);
      }
      return;
    }

    if (firstUnreadMsg) {
      setExpandedKey(`msg:${firstUnreadMsg.id}`);
      repository.markSupportMessageAsRead(firstUnreadMsg.id, user);
      return;
    }

    if (firstUnreadTicket) {
      setExpandedKey(`ticket:${firstUnreadTicket.id}`);
      repository.markSupportTicketAsRead(firstUnreadTicket.id);
      return;
    }

    if (msgs.length + tks.length === 1) {
      if (msgs.length === 1) {
        setExpandedKey(`msg:${msgs[0].id}`);
      } else {
        setExpandedKey(`ticket:${tks[0].id}`);
      }
    }
  }, [isOpen]);

  // Clear expandedKey & stale drafts if an item is deleted while inbox is open
  const liveItemKeysSignature = unifiedItems.map((i) => i.key).join(',');
  useEffect(() => {
    if (!isOpen) return;
    const activeKeys = new Set(liveItemKeysSignature ? liveItemKeysSignature.split(',') : []);
    if (expandedKey && !activeKeys.has(expandedKey)) {
      setExpandedKey(null);
    }
    const activeTicketIds = new Set(liveTickets.map((t) => t.id));
    setReplyDrafts((prev) => {
      const keys = Object.keys(prev);
      const stale = keys.filter((k) => !activeTicketIds.has(k));
      if (stale.length === 0) return prev;
      const next = { ...prev };
      stale.forEach((k) => delete next[k]);
      return next;
    });
  }, [isOpen, liveItemKeysSignature, expandedKey, liveTickets]);

  // Lock background scroll & support Escape key when open
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  const getTicketThread = (ticket: SupportTicket): SupportTicketReply[] => {
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

  const handleToggleMessage = (msg: SupportMessage, isUnread: boolean) => {
    const key = `msg:${msg.id}`;
    if (expandedKey === key) {
      setExpandedKey(null);
      return;
    }
    setExpandedKey(key);
    if (isUnread) {
      repository.markSupportMessageAsRead(msg.id, currentUser);
    }
  };

  const handleToggleTicket = (ticket: SupportTicket) => {
    const key = `ticket:${ticket.id}`;
    if (expandedKey === key) {
      setExpandedKey(null);
      return;
    }
    setExpandedKey(key);
    if (ticket.unreadByUser) {
      repository.markSupportTicketAsRead(ticket.id);
    }
  };

  const handleSendFollowUp = (e: React.FormEvent, ticket: SupportTicket) => {
    e.preventDefault();
    const draft = (replyDrafts[ticket.id] || '').trim();
    if (!draft) return;

    const res = repository.replyToSupportTicket({
      ticketId: ticket.id,
      message: draft,
      senderName: currentUser.name,
      senderRole: currentUser.role,
    });

    if (res.success) {
      setReplyDrafts((prev) => ({ ...prev, [ticket.id]: '' }));
      showToast('تم إرسال ردك للدعم الفني', 'success');
      setTick((t) => t + 1);
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleSendPrivateReplyToMessage = (e: React.FormEvent, msg: SupportMessage) => {
    e.preventDefault();
    const draft = (msgReplyDrafts[msg.id] || '').trim();
    if (!draft) return;

    const referenceLabel = msg.title?.trim() || msg.body.slice(0, 45);
    const composedMessage = `رد على رسالة الدعم الفني ("${referenceLabel}"):\n${draft}`;

    const res = repository.createSupportTicket({
      ticketType: 'استفسار',
      message: composedMessage,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      senderEmail: currentUser.email || undefined,
      senderId: currentUser.studentId || currentUser.id,
    });

    if (res.success) {
      setMsgReplyDrafts((prev) => ({ ...prev, [msg.id]: '' }));
      setMsgReplyOpenId(null);
      showToast('تم إرسال ردك الخاص إلى الدعم الفني بنجاح', 'success');
      setTick((t) => t + 1);
    } else {
      showToast(res.message, 'error');
    }
  };

  const showFilterTabs = liveMessages.length > 0 && liveTickets.length > 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/55 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-right flex flex-col max-h-[85dvh]"
        role="dialog"
        aria-modal="true"
        aria-label="صندوق الوارد للدعم الفني"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Clean Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200/80 bg-slate-50/70 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200/80 text-teal-800 flex items-center justify-center shrink-0">
              <Inbox className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-slate-900 truncate">
                  صندوق الوارد
                </h3>
                {unreadCount > 0 && (
                  <span className="text-[11px] font-extrabold text-rose-600 tabular-nums">
                    ({unreadCount} جديد)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-medium truncate">
                رسائل وتنبيهات الدعم الفني ومتابعة تذاكرك
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 min-w-[38px] min-h-[38px] rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="إغلاق"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        {/* Optional Filter Tabs when both messages and tickets exist */}
        {showFilterTabs && (
          <div className="px-3.5 sm:px-4 pt-3 pb-0.5 bg-white shrink-0">
            <div
              role="tablist"
              aria-label="تصفية صندوق الوارد"
              className="inline-flex w-full items-center rounded-xl border border-slate-200 bg-slate-100/90 p-0.5 text-xs font-bold"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeFilter === 'all'}
                onClick={() => setActiveFilter('all')}
                className={`flex-1 py-1.5 rounded-lg transition-colors cursor-pointer tabular-nums ${
                  activeFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                الكل ({unifiedItems.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeFilter === 'messages'}
                onClick={() => setActiveFilter('messages')}
                className={`flex-1 py-1.5 rounded-lg transition-colors cursor-pointer tabular-nums ${
                  activeFilter === 'messages'
                    ? 'bg-white text-indigo-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                رسائل الدعم ({liveMessages.length}
                {unreadMessagesCount > 0 ? ` · ${unreadMessagesCount} جديد` : ''})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeFilter === 'tickets'}
                onClick={() => setActiveFilter('tickets')}
                className={`flex-1 py-1.5 rounded-lg transition-colors cursor-pointer tabular-nums ${
                  activeFilter === 'tickets'
                    ? 'bg-white text-teal-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                تذاكري ({liveTickets.length}
                {unreadTicketsCount > 0 ? ` · ${unreadTicketsCount} جديد` : ''})
              </button>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="p-3.5 sm:p-4 overflow-y-auto space-y-2.5 flex-1 bg-white">
          {visibleItems.length === 0 ? (
            <div className="py-10 px-4 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-extrabold text-slate-800">
                  لا توجد رسائل في صندوق الوارد حالياً
                </p>
                <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                  ستظهر هنا جميع الرسائل المرسلة من الدعم الفني وردود تذاكرك مباشرة.
                </p>
              </div>
              {onOpenNewTicket && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenNewTicket();
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[42px] rounded-xl bg-teal-800 hover:bg-teal-900 text-white text-xs font-extrabold transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>إرسال تذكرة جديدة</span>
                </button>
              )}
            </div>
          ) : (
            visibleItems.map((item) => {
              if (item.kind === 'message') {
                const { message: msg, isUnread, key } = item;
                const isExpanded = expandedKey === key;
                const isReplyFormOpen = msgReplyOpenId === msg.id;
                const replyDraft = msgReplyDrafts[msg.id] || '';
                const scopeLabel = AUDIENCE_INBOX_LABELS[msg.audienceType] || 'رسالة من الدعم الفني';

                return (
                  <div
                    key={key}
                    className={`rounded-2xl border transition-colors overflow-hidden ${
                      isUnread
                        ? 'border-indigo-300 bg-indigo-50/45'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    {/* Message Header Row */}
                    <button
                      type="button"
                      onClick={() => handleToggleMessage(msg, isUnread)}
                      className="w-full text-right p-3.5 min-h-[56px] flex items-start justify-between gap-2.5 cursor-pointer hover:bg-slate-50/70 transition-colors"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold flex-wrap">
                          {isUnread && (
                            <>
                              <span className="text-indigo-800 font-black">رسالة جديدة</span>
                              <span className="text-slate-300" aria-hidden="true">·</span>
                            </>
                          )}
                          <span className="inline-flex items-center gap-1 text-indigo-900 font-extrabold">
                            <Megaphone className="w-3 h-3 text-indigo-700" />
                            <span>الدعم الفني</span>
                          </span>
                          <span className="text-slate-300" aria-hidden="true">·</span>
                          <span className="text-slate-600">{scopeLabel}</span>
                          <span className="text-slate-300" aria-hidden="true">·</span>
                          <span className="text-slate-400 font-medium tabular-nums">
                            {formatHijriDateTime(msg.createdAt)}
                          </span>
                        </div>

                        {msg.title && (
                          <p className="text-xs sm:text-sm font-black text-slate-900 leading-snug">
                            {msg.title}
                          </p>
                        )}

                        <p
                          className={`text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line ${
                            isExpanded ? '' : 'line-clamp-2 font-medium'
                          }`}
                        >
                          {msg.body}
                        </p>
                      </div>

                      <span className="w-8 h-8 rounded-lg text-slate-400 flex items-center justify-center shrink-0 mt-0.5">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </span>
                    </button>

                    {/* Expanded Message Actions */}
                    {isExpanded && (
                      <div className="px-3.5 pb-3.5 pt-2.5 border-t border-slate-100 bg-white space-y-2.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
                            <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>تمت القراءة · المرسل: {msg.senderName}</span>
                          </span>

                          <button
                            type="button"
                            onClick={() => setMsgReplyOpenId(isReplyFormOpen ? null : msg.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-extrabold transition-colors cursor-pointer"
                          >
                            <Reply className="w-3.5 h-3.5 text-teal-700" />
                            <span>{isReplyFormOpen ? 'إغلاق الرد' : 'رد خاص للدعم الفني'}</span>
                          </button>
                        </div>

                        {isReplyFormOpen && (
                          <form
                            onSubmit={(e) => handleSendPrivateReplyToMessage(e, msg)}
                            className="space-y-2 pt-1"
                          >
                            <p className="text-[11px] text-slate-500">
                              سيُرسل ردك بشكل خاص إلى الدعم الفني فقط ولن يظهر لبقية المستخدمين.
                            </p>
                            <div className="flex items-end gap-2">
                              <textarea
                                value={replyDraft}
                                onChange={(e) =>
                                  setMsgReplyDrafts((prev) => ({ ...prev, [msg.id]: e.target.value }))
                                }
                                placeholder="اكتب ردك الخاص للدعم الفني..."
                                rows={2}
                                className="flex-1 px-3 py-2 text-base sm:text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-hidden focus:border-teal-700 text-slate-800 placeholder:text-slate-400 font-[inherit] resize-none"
                              />
                              <button
                                type="submit"
                                disabled={!replyDraft.trim()}
                                className="min-h-[42px] px-3.5 py-2 rounded-xl bg-teal-800 hover:bg-teal-900 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>إرسال</span>
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    )}
                  </div>
                );
              }

              // Support Ticket item
              const { ticket, isUnread, key } = item;
              const isExpanded = expandedKey === key;
              const thread = getTicketThread(ticket);
              const statusMeta = STATUS_LABELS[ticket.status] || STATUS_LABELS.new;
              const hasSupportReply = thread.some((r) => r.senderRole === 'admin');
              const draft = replyDrafts[ticket.id] || '';

              return (
                <div
                  key={key}
                  className={`rounded-2xl border transition-colors overflow-hidden ${
                    isUnread
                      ? 'border-teal-300 bg-teal-50/35'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  {/* Ticket Row Header */}
                  <button
                    type="button"
                    onClick={() => handleToggleTicket(ticket)}
                    className="w-full text-right p-3.5 min-h-[56px] flex items-start justify-between gap-2.5 cursor-pointer hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold flex-wrap">
                        {isUnread && (
                          <span className="text-teal-800 font-black">رد جديد</span>
                        )}
                        {isUnread && <span className="text-slate-300" aria-hidden="true">·</span>}
                        <span className="text-slate-800 font-extrabold">{ticket.ticketType}</span>
                        <span className="text-slate-300" aria-hidden="true">·</span>
                        <span className={statusMeta.colorClass}>{statusMeta.label}</span>
                        <span className="text-slate-300" aria-hidden="true">·</span>
                        <span className="text-slate-400 font-medium tabular-nums">
                          {formatHijriDateTime(ticket.adminReplyAt || ticket.createdAt)}
                        </span>
                      </div>

                      <p
                        className={`text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-line ${
                          isExpanded ? '' : 'line-clamp-2 font-medium'
                        }`}
                      >
                        {ticket.message}
                      </p>

                      {!isExpanded && hasSupportReply && (
                        <p className="text-xs text-teal-800 font-bold line-clamp-1 pt-0.5">
                          رد الدعم: {thread.filter((r) => r.senderRole === 'admin').slice(-1)[0]?.message}
                        </p>
                      )}
                    </div>

                    <span className="w-8 h-8 rounded-lg text-slate-400 flex items-center justify-center shrink-0 mt-0.5">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </span>
                  </button>

                  {/* Expanded Thread */}
                  {isExpanded && (
                    <div className="px-3.5 pb-3.5 pt-2 border-t border-slate-100 space-y-2.5 bg-white">
                      {/* Replies List */}
                      {thread.length === 0 ? (
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs text-slate-500 font-medium">
                          تم استلام تذكرتك، وبانتظار رد فريق الدعم الفني.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {thread.map((reply) => {
                            const isFromSupport = reply.senderRole === 'admin';
                            return (
                              <div
                                key={reply.id}
                                className={`p-3 rounded-xl border text-xs sm:text-sm leading-relaxed space-y-1 ${
                                  isFromSupport
                                    ? 'bg-teal-50/75 border-teal-200/90 text-slate-900'
                                    : 'bg-slate-50 border-slate-200/80 text-slate-800'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2 text-[11px]">
                                  <span
                                    className={`font-black flex items-center gap-1 ${
                                      isFromSupport ? 'text-teal-900' : 'text-slate-700'
                                    }`}
                                  >
                                    {isFromSupport && <CheckCheck className="w-3.5 h-3.5 text-teal-700" />}
                                    <span>{isFromSupport ? 'رد الدعم الفني' : `أنت (${reply.senderName})`}</span>
                                  </span>
                                  <span className="text-slate-400 tabular-nums">
                                    {formatHijriDateTime(reply.createdAt)}
                                  </span>
                                </div>
                                <p className="whitespace-pre-line font-medium">{reply.message}</p>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Follow-up Reply Form */}
                      <form onSubmit={(e) => handleSendFollowUp(e, ticket)} className="flex items-end gap-2 pt-1">
                        <textarea
                          value={draft}
                          onChange={(e) =>
                            setReplyDrafts((prev) => ({ ...prev, [ticket.id]: e.target.value }))
                          }
                          placeholder="أضف متابعة أو توضيحاً..."
                          rows={2}
                          className="flex-1 px-3 py-2 text-base sm:text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-hidden focus:border-teal-700 text-slate-800 placeholder:text-slate-400 font-[inherit] resize-none"
                        />
                        <button
                          type="submit"
                          disabled={!draft.trim()}
                          className="min-h-[42px] px-3.5 py-2 rounded-xl bg-teal-800 hover:bg-teal-900 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>إرسال</span>
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
