import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { User, SupportTicket, SupportTicketReply } from '../../types';
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
} from 'lucide-react';

interface SupportInboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onOpenNewTicket?: () => void;
}

const STATUS_LABELS: Record<SupportTicket['status'], { label: string; colorClass: string }> = {
  new: { label: 'جديدة', colorClass: 'text-slate-600' },
  in_progress: { label: 'قيد المتابعة', colorClass: 'text-teal-800' },
  resolved: { label: 'تم الحل', colorClass: 'text-emerald-700' },
};

export const SupportInboxModal: React.FC<SupportInboxModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onOpenNewTicket,
}) => {
  const { showToast } = useToast();
  const [, setTick] = useState(0);
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    const unsub = subscribeToDataChanges(() => {
      setTick((t) => t + 1);
    });
    return unsub;
  }, [isOpen]);

  // Re-fetch synchronously on render when tick updates
  const liveTickets = isOpen ? repository.getSupportTicketsForUser(currentUser) : [];
  const unreadCount = liveTickets.filter((t) => t.unreadByUser).length;

  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  // Auto-open the first unread ticket (or most recent ticket if only 1) when opening inbox
  useEffect(() => {
    if (!isOpen) {
      setExpandedTicketId(null);
      return;
    }
    const currentList = repository.getSupportTicketsForUser(currentUserRef.current);
    if (currentList.length === 0) return;

    const firstUnread = currentList.find((t) => t.unreadByUser);
    const initialTarget = firstUnread || (currentList.length === 1 ? currentList[0] : null);
    if (initialTarget) {
      setExpandedTicketId(initialTarget.id);
      if (initialTarget.unreadByUser) {
        repository.markSupportTicketAsRead(initialTarget.id);
      }
    }
  }, [isOpen]);

  // Clear expandedTicketId & stale drafts if a ticket is closed/deleted from server while inbox is open
  const liveTicketIdsKey = liveTickets.map((t) => t.id).join(',');
  useEffect(() => {
    if (!isOpen) return;
    const activeIds = new Set(liveTicketIdsKey ? liveTicketIdsKey.split(',') : []);
    if (expandedTicketId && !activeIds.has(expandedTicketId)) {
      setExpandedTicketId(null);
    }
    setReplyDrafts((prev) => {
      const keys = Object.keys(prev);
      const stale = keys.filter((k) => !activeIds.has(k));
      if (stale.length === 0) return prev;
      const next = { ...prev };
      stale.forEach((k) => delete next[k]);
      return next;
    });
  }, [isOpen, liveTicketIdsKey, expandedTicketId]);

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

  const handleToggleTicket = (ticket: SupportTicket) => {
    if (expandedTicketId === ticket.id) {
      setExpandedTicketId(null);
      return;
    }
    setExpandedTicketId(ticket.id);
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
                ردود الدعم الفني ومتابعة التذاكر المرسلة
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

        {/* Body */}
        <div className="p-3.5 sm:p-4 overflow-y-auto space-y-2.5 flex-1 bg-white">
          {liveTickets.length === 0 ? (
            <div className="py-10 px-4 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-extrabold text-slate-800">
                  لا توجد رسائل في صندوق الوارد حالياً
                </p>
                <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                  عند إرسال أي استفسار أو مشكلة للدعم الفني، سيصلك الرد هنا مباشرة ويمكنك متابعته في أي وقت.
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
            liveTickets.map((ticket) => {
              const isExpanded = expandedTicketId === ticket.id;
              const thread = getTicketThread(ticket);
              const statusMeta = STATUS_LABELS[ticket.status] || STATUS_LABELS.new;
              const hasSupportReply = thread.some((r) => r.senderRole === 'admin');
              const isUnread = Boolean(ticket.unreadByUser);
              const draft = replyDrafts[ticket.id] || '';

              return (
                <div
                  key={ticket.id}
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

                      <p className={`text-xs sm:text-sm text-slate-800 leading-relaxed ${isExpanded ? '' : 'line-clamp-2 font-medium'}`}>
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
                                  <span className={`font-black flex items-center gap-1 ${isFromSupport ? 'text-teal-900' : 'text-slate-700'}`}>
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
