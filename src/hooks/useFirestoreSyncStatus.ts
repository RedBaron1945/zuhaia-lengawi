import { useState, useEffect, useCallback } from 'react';
import {
  getSyncStatus,
  subscribeToSyncStatus,
  triggerManualSync,
  SyncStatusInfo,
} from '../services/storageService';

export const useFirestoreSyncStatus = () => {
  const [syncInfo, setSyncInfo] = useState<SyncStatusInfo>(() => getSyncStatus());
  const [relativeTime, setRelativeTime] = useState<string>('الآن');
  const [isManuallySyncing, setIsManuallySyncing] = useState(false);

  // Subscribe to real-time sync state changes from storageService
  useEffect(() => {
    const unsubscribe = subscribeToSyncStatus((info) => {
      setSyncInfo({ ...info });
    });
    return unsubscribe;
  }, []);

  // Format human-readable Arabic relative time
  const formatArabicRelativeTime = useCallback((date: Date | null): string => {
    if (!date) return 'لم تتم المزامنة بعد';
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 15) return 'الآن';
    if (diffSec < 60) return `منذ ${diffSec} ثانية`;

    const diffMin = Math.floor(diffSec / 60);
    if (diffMin === 1) return 'منذ دقيقة';
    if (diffMin === 2) return 'منذ دقيقتين';
    if (diffMin <= 10) return `منذ ${diffMin} دقائق`;
    if (diffMin < 60) return `منذ ${diffMin} دقيقة`;

    const diffHours = Math.floor(diffMin / 60);
    if (diffHours === 1) return 'منذ ساعة';
    if (diffHours === 2) return 'منذ ساعتين';
    if (diffHours <= 10) return `منذ ${diffHours} ساعات`;
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;

    return date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  }, []);

  // Keep the relative time label fresh every 15 seconds
  useEffect(() => {
    setRelativeTime(formatArabicRelativeTime(syncInfo.lastUpdated));
    const timer = setInterval(() => {
      setRelativeTime(formatArabicRelativeTime(syncInfo.lastUpdated));
    }, 15000);
    return () => clearInterval(timer);
  }, [syncInfo.lastUpdated, formatArabicRelativeTime]);

  const syncNow = async () => {
    if (isManuallySyncing) return;
    setIsManuallySyncing(true);
    try {
      await triggerManualSync();
    } finally {
      setIsManuallySyncing(false);
    }
  };

  return {
    ...syncInfo,
    status: isManuallySyncing ? 'syncing' : syncInfo.status,
    relativeTime,
    syncNow,
    isManuallySyncing,
  };
};
