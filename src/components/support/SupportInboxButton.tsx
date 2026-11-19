import React, { useState, useEffect } from 'react';
import { Inbox } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { repository, subscribeToDataChanges } from '../../services/storageService';
import { SupportInboxModal } from './SupportInboxModal';
import { SupportTicketModal } from './SupportTicketModal';

interface SupportInboxButtonProps {
  className?: string;
}

export const SupportInboxButton: React.FC<SupportInboxButtonProps> = ({ className = '' }) => {
  const { currentUser } = useAuth();
  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsub = subscribeToDataChanges(() => {
      setTick((t) => t + 1);
    });
    return unsub;
  }, []);

  if (!currentUser || currentUser.role === 'admin') {
    return null;
  }

  const userTickets = repository.getSupportTicketsForUser(currentUser);
  const userMessages = repository.getSupportMessagesForUser(currentUser);
  const unreadTicketsCount = userTickets.filter((t) => t.unreadByUser).length;
  const unreadMessagesCount = userMessages.filter(
    (m) => !repository.isSupportMessageReadByUser(m.id, currentUser)
  ).length;
  const unreadCount = unreadTicketsCount + unreadMessagesCount;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsInboxOpen(true)}
        className={`relative min-w-[40px] min-h-[40px] w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
          unreadCount > 0
            ? 'bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100/80'
            : 'text-slate-500 hover:text-teal-800 hover:bg-slate-100 border border-transparent'
        } ${className}`}
        title={unreadCount > 0 ? `صندوق الوارد (${unreadCount} جديد)` : 'صندوق الوارد (الدعم الفني)'}
        aria-label={unreadCount > 0 ? `صندوق الوارد، لديك ${unreadCount} رسالة جديدة` : 'صندوق الوارد'}
      >
        <Inbox className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-black tabular-nums flex items-center justify-center border-2 border-white shadow-2xs">
            {unreadCount}
          </span>
        )}
      </button>

      <SupportInboxModal
        isOpen={isInboxOpen}
        onClose={() => setIsInboxOpen(false)}
        currentUser={currentUser}
        onOpenNewTicket={() => setIsNewTicketOpen(true)}
      />

      <SupportTicketModal
        isOpen={isNewTicketOpen}
        onClose={() => setIsNewTicketOpen(false)}
      />
    </>
  );
};
