import React, { useState, useEffect, useRef } from 'react';
import { User, Student } from '../../types';
import { repository, subscribeToDataChanges } from '../../services/storageService';
import { SupervisorStats } from './SupervisorStats';
import { NeedsAttentionList } from './NeedsAttentionList';
import { RedemptionManager } from './RedemptionManager';
import { ExamRequestsManager } from './ExamRequestsManager';
import { BottomNav } from '../common/BottomNav';
import { useToast } from '../../context/ToastContext';
import { BarChart3, Gift, AlertTriangle, ShieldCheck, RefreshCw, Sparkles, BookOpen } from 'lucide-react';

interface SupervisorViewProps {
  currentUser: User;
}

export const SupervisorView: React.FC<SupervisorViewProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'attention' | 'exam_requests' | 'stats' | 'redemptions'>('attention');
  const [students, setStudents] = useState<Student[]>(() => repository.getStudents());
  const [, setTick] = useState(0);
  const { showToast } = useToast();

  // Pull-to-refresh state
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);

  useEffect(() => {
    const unsub = subscribeToDataChanges(() => {
      setStudents(repository.getStudents());
      setTick((t) => t + 1);
    });
    return unsub;
  }, []);

  const pendingRequests = repository.getRedemptionRequests({ status: 'pending' });
  const pendingExamNominations = repository.getExamNominations({ status: 'pending' });
  const attentionCount = students.filter((s) => {
    if (!s.active) return false;
    if (s.attentionReason || s.consecutiveAbsences >= 2 || s.daysWithoutLog >= 7) return true;
    const stats = repository.getStudentAttendanceStats(s.id);
    return stats.hasRecords && stats.attendanceRate < 70;
  }).length;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY <= 5 && !isRefreshing) {
      touchStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling.current || isRefreshing) return;
    const currentY = e.touches[0].clientY;
    const delta = currentY - touchStartY.current;
    if (delta > 0 && window.scrollY <= 5) {
      // Apply rubber-band damping
      const damped = Math.min(delta * 0.42, 80);
      setPullDistance(damped);
    } else {
      setPullDistance(0);
    }
  };

  const handleTouchEnd = async () => {
    if (!isPulling.current) return;
    isPulling.current = false;
    if (pullDistance >= 50 && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(56);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(15);
      }
      setTimeout(() => {
        setStudents(repository.getStudents());
        setTick((t) => t + 1);
        setIsRefreshing(false);
        setPullDistance(0);
        showToast('تم تحديث البيانات بنجاح', 'success');
      }, 700);
    } else {
      setPullDistance(0);
    }
  };

  return (
    <div
      className="pb-28 max-w-4xl mx-auto px-3 sm:px-4 pt-2.5 overflow-visible relative"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to refresh visual indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div
          className="flex items-center justify-center transition-all duration-150 overflow-hidden text-xs font-bold text-teal-800"
          style={{ height: `${pullDistance}px` }}
        >
          <div className="flex items-center gap-2 bg-teal-50 border border-teal-200/90 py-1.5 px-3.5 rounded-full shadow-2xs">
            <RefreshCw
              className={`w-4 h-4 text-teal-700 transition-transform ${
                isRefreshing ? 'animate-spin' : pullDistance >= 50 ? 'rotate-180' : ''
              }`}
              style={
                !isRefreshing && pullDistance < 50
                  ? { transform: `rotate(${pullDistance * 4}deg)` }
                  : undefined
              }
            />
            <span>
              {isRefreshing
                ? 'جارٍ تحديث البيانات...'
                : pullDistance >= 50
                ? 'أفلت للتحديث الآن'
                : 'اسحب للأسفل للتحديث'}
            </span>
          </div>
        </div>
      )}



      {/* Supervisor Welcome Hero Banner */}
      <div className="mb-4 relative overflow-hidden rounded-2xl bg-gradient-to-l from-[#064e45] via-[#0a6155] to-[#0f7d6e] text-white p-4 sm:p-5 shadow-lg shadow-teal-950/15 border border-teal-600/30 animate-fade-in">
        {/* Soft decorative background glows */}
        <div className="absolute -top-12 -left-12 w-44 h-44 bg-teal-300/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-[#fadb62]/10 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5">
          <div className="flex items-center gap-3.5">
            {/* Attractive Avatar & Greeting Icon */}
            <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-2xl bg-gradient-to-tr from-[#d4af37] via-[#fadb62] to-[#fef3c7] text-slate-900 flex items-center justify-center text-3xl sm:text-4xl shrink-0 shadow-md shadow-black/25 ring-2 ring-white/20 select-none">
              👋
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-black text-white tracking-normal">
                  مرحبًا بك، {currentUser.name || 'مدير المجمع'}
                </h1>
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-teal-950 bg-amber-300 px-2.5 py-0.5 rounded-full shadow-2xs">
                  <Sparkles className="w-3 h-3 text-amber-900 fill-amber-900" />
                  <span>المشرف العام</span>
                </span>
              </div>
              <p className="text-xs sm:text-sm text-teal-100/90 mt-1 font-medium leading-relaxed">
                متابعة وإشراف الحلقات القرآنية بجامع زهية لنجاوي
              </p>
            </div>
          </div>

          {/* Quick Pill: 9 Approved Quran Circles */}
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 bg-white/10 backdrop-blur-xs border border-white/15 px-3 py-1.5 rounded-xl text-xs text-white">
            <span className="text-amber-300 text-sm">🕌</span>
            <span className="font-bold text-teal-100">9 حلقات قرآنية معتمدة · {students.filter((s) => s.active).length} طالباً</span>
          </div>
        </div>
      </div>

      {/* Desktop Tab Buttons */}
      <div className="hidden md:flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200 shadow-xs mb-4">
        <button
          onClick={() => setActiveTab('attention')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'attention' ? 'bg-teal-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>صفحة المتابعة ({attentionCount})</span>
        </button>
        <button
          onClick={() => setActiveTab('exam_requests')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 relative ${
            activeTab === 'exam_requests' ? 'bg-teal-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>طلبات الاختبارات</span>
          {pendingExamNominations.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'stats' ? 'bg-teal-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>الإحصائيات الشاملة</span>
        </button>
        <button
          onClick={() => setActiveTab('redemptions')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 relative ${
            activeTab === 'redemptions' ? 'bg-teal-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Gift className="w-4 h-4" />
          <span>المطالبات</span>
          {pendingRequests.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-400" />
          )}
        </button>
      </div>

      {/* Views */}
      {activeTab === 'attention' && <NeedsAttentionList students={students} />}
      {activeTab === 'exam_requests' && (
        <ExamRequestsManager
          supervisorName={currentUser.name}
          onUpdate={() => setTick((t) => t + 1)}
        />
      )}
      {activeTab === 'stats' && <SupervisorStats students={students} />}
      {activeTab === 'redemptions' && (
        <RedemptionManager supervisorName={currentUser.name} onUpdate={() => setTick((t) => t + 1)} />
      )}

      {/* Mobile Bottom Navigation with Badges */}
      <BottomNav
        role="supervisor"
        activeTab={activeTab}
        onTabChange={(t) => setActiveTab(t as any)}
        badges={{
          redemptions: pendingRequests.length,
          exam_requests: pendingExamNominations.length,
        }}
      />
    </div>
  );
};
