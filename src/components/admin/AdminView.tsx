import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { repository, subscribeToDataChanges } from '../../services/storageService';
import { StudentsManagement, PendingTicketStudentAction } from './StudentsManagement';
import { RewardsManagement } from './RewardsManagement';
import { PointRulesSettings } from './PointRulesSettings';
import { AuditLogView } from './AuditLogView';
import { SupportTicketsManager } from './SupportTicketsManager';
import { BottomNav } from '../common/BottomNav';
import { useToast } from '../../context/ToastContext';
import { Users, Gift, Settings, ShieldCheck, LifeBuoy, Terminal } from 'lucide-react';

interface AdminViewProps {
  currentUser: User;
}

export const AdminView: React.FC<AdminViewProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'students' | 'points' | 'rewards_mgmt' | 'tickets' | 'settings' | 'audit'>('students');
  const [pendingTicketAction, setPendingTicketAction] = useState<PendingTicketStudentAction | null>(null);
  const [, setTick] = useState(0);
  const { showToast } = useToast();

  useEffect(() => {
    const unsub = subscribeToDataChanges(() => {
      setTick((t) => t + 1);
    });
    return unsub;
  }, []);

  const tickets = repository.getSupportTickets();
  const students = repository.getStudents();
  const activeStudentsCount = students.filter((s) => s.active).length;
  const openTicketsCount = tickets.filter((t) => t.status !== 'resolved').length;
  const pendingRedemptionsCount = repository.getRedemptionRequests({ status: 'pending' }).length;

  const handleExecuteTicketAction = (action: PendingTicketStudentAction) => {
    setPendingTicketAction(action);
    setActiveTab('students');
  };

  const handleCompleteTicketAction = (ticketId: string) => {
    repository.updateSupportTicket(ticketId, { status: 'resolved' });
    setPendingTicketAction(null);
    showToast('تم تنفيذ الطلب وتحديث حالة التذكرة إلى «تمت» ✓', 'success');
    setTick((t) => t + 1);
  };

  return (
    <div className="pb-24 max-w-5xl mx-auto px-3 sm:px-4 pt-3">
      {/* Technical Support Hero Banner */}
      <section
        aria-label="ترحيب الدعم الفني"
        className="mb-3.5 relative overflow-hidden rounded-2xl bg-gradient-to-l from-slate-900 via-slate-900 to-indigo-950 text-white border border-slate-800 shadow-sm px-4 py-3.5 sm:px-5 sm:py-4"
      >
        {/* Subtle technical grid texture */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Identity & Role */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-indigo-500/15 border border-indigo-400/25 text-indigo-300 flex items-center justify-center shrink-0">
              <Terminal className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-black text-white tracking-tight truncate">
                مرحباً، {currentUser.name} <span className="text-indigo-300 font-bold">· الدعم الفني</span>
              </h1>
              <p className="text-xs text-slate-300 mt-0.5 truncate">
                إدارة شؤون الطلاب والنقاط وتذاكر الدعم الفني وإعدادات النظام
              </p>
            </div>
          </div>

          {/* Live Operational Counters */}
          <div className="flex items-center divide-x divide-x-reverse divide-slate-700/80 rounded-xl bg-slate-950/50 border border-slate-800 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('students')}
              className="px-3.5 py-2 text-right hover:bg-white/5 transition-colors cursor-pointer rounded-r-xl"
            >
              <span className="block text-[10px] font-medium text-slate-400">الطلاب النشطون</span>
              <span className="block text-sm font-black text-white tabular-nums font-mono">
                {activeStudentsCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tickets')}
              className="px-3.5 py-2 text-right hover:bg-white/5 transition-colors cursor-pointer"
            >
              <span className="block text-[10px] font-medium text-slate-400">تذاكر مفتوحة</span>
              <span
                className={`block text-sm font-black tabular-nums font-mono ${
                  openTicketsCount > 0 ? 'text-amber-300' : 'text-emerald-300'
                }`}
              >
                {openTicketsCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('rewards_mgmt')}
              className="px-3.5 py-2 text-right hover:bg-white/5 transition-colors cursor-pointer rounded-l-xl"
            >
              <span className="block text-[10px] font-medium text-slate-400">طلبات مكافآت</span>
              <span className="block text-sm font-black text-indigo-200 tabular-nums font-mono">
                {pendingRedemptionsCount}
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Desktop Tabs */}
      <div className="hidden md:flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200 shadow-xs mb-4">
        <button
          onClick={() => setActiveTab('students')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'students' ? 'bg-indigo-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>إدارة الطلاب والنقاط</span>
        </button>
        <button
          onClick={() => setActiveTab('rewards_mgmt')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'rewards_mgmt' ? 'bg-indigo-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Gift className="w-4 h-4" />
          <span>إدارة المكافآت</span>
        </button>
        <button
          onClick={() => setActiveTab('tickets')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'tickets' ? 'bg-indigo-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <LifeBuoy className="w-4 h-4" />
          <span>تذاكر الدعم</span>
          {tickets.length > 0 && (
            <span className="bg-amber-400 text-amber-950 text-[10px] px-1.5 py-0.2 rounded-full font-black tabular-nums">
              {tickets.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'settings' ? 'bg-indigo-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>قواعد النقاط</span>
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'audit' ? 'bg-indigo-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>سجل العمليات (Audit)</span>
        </button>
      </div>

      {/* Views */}
      {(activeTab === 'students' || activeTab === 'points') && (
        <StudentsManagement
          adminUser={currentUser}
          onUpdate={() => setTick((t) => t + 1)}
          pendingTicketAction={pendingTicketAction}
          onTicketActionComplete={handleCompleteTicketAction}
          onCancelTicketAction={() => setPendingTicketAction(null)}
        />
      )}
      {activeTab === 'rewards_mgmt' && (
        <RewardsManagement adminUser={currentUser} onUpdate={() => setTick((t) => t + 1)} />
      )}
      {activeTab === 'tickets' && (
        <SupportTicketsManager onExecuteStudentAction={handleExecuteTicketAction} />
      )}
      {activeTab === 'settings' && (
        <PointRulesSettings adminUser={currentUser} onUpdate={() => setTick((t) => t + 1)} />
      )}
      {activeTab === 'audit' && <AuditLogView />}

      {/* Mobile Bottom Navigation */}
      <BottomNav
        role="admin"
        activeTab={activeTab}
        onTabChange={(t) => setActiveTab(t as any)}
        badges={{ tickets: tickets.length }}
      />
    </div>
  );
};
