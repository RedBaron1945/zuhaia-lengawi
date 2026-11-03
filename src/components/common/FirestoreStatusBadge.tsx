import React from 'react';
import { useFirestoreSyncStatus } from '../../hooks/useFirestoreSyncStatus';

interface FirestoreStatusBadgeProps {
  compact?: boolean;
}

export const FirestoreStatusBadge: React.FC<FirestoreStatusBadgeProps> = () => {
  const { status } = useFirestoreSyncStatus();

  // Color mapping based on status
  const config = {
    connected: {
      dotBg: 'bg-emerald-500',
      pingBg: 'bg-emerald-400',
      pillBg: 'bg-emerald-50/80 text-emerald-800 border-emerald-200/90',
      label: 'متصل',
    },
    syncing: {
      dotBg: 'bg-amber-500',
      pingBg: 'bg-amber-400',
      pillBg: 'bg-amber-50/80 text-amber-800 border-amber-200/90',
      label: 'جاري المزامنة',
    },
    offline: {
      dotBg: 'bg-rose-500',
      pingBg: 'bg-rose-400',
      pillBg: 'bg-rose-50/80 text-rose-800 border-rose-200/90',
      label: 'غير متصل',
    },
    error: {
      dotBg: 'bg-rose-500',
      pingBg: 'bg-rose-400',
      pillBg: 'bg-rose-50/80 text-rose-800 border-rose-200/90',
      label: 'تنبيه اتصال',
    },
  }[status];

  return (
    <div className="relative inline-block text-right">
      {/* Clean Status Pill Indicator without technical popover */}
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border shadow-2xs select-none ${config.pillBg}`}
        title={`حالة الاتصال: ${config.label}`}
      >
        {/* Pulsing Beacon Dot */}
        <span className="relative flex h-2 w-2 shrink-0">
          {status !== 'offline' && (
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.pingBg}`}
            />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dotBg}`} />
        </span>

        {/* Status Text */}
        <span className="text-[11px] font-bold leading-tight">
          {config.label}
        </span>
      </div>
    </div>
  );
};
