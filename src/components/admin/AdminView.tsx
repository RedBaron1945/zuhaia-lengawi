import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { repository, subscribeToDataChanges } from '../../services/storageService';
import { StudentsManagement } from './StudentsManagement';
import { RewardsManagement } from './RewardsManagement';
import { PointRulesSettings } from './PointRulesSettings';
import { AuditLogView } from './AuditLogView';
import { SupportTicketsManager } from './SupportTicketsManager';
import { BottomNav } from '../common/BottomNav';
import { Cog, Users, Gift, Settings, ShieldCheck, Award, LifeBuoy } from 'lucide-react';

interface AdminViewProps {
  currentUser: User;
}

export const AdminView: React.FC<AdminViewProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'students' | 'points' | 'rewards_mgmt' | 'tickets' | 'settings' | 'audit'>('students');
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsub = subscribeToDataChanges(() => {
      setTick((t) => t + 1);
    });
    return unsub;
  }, []);

  const tickets = repository.getSupportTickets();

  return (
    <div className="pb-24 max-w-4xl mx-auto px-3 sm:px-4 pt-3">
      {/* Tech Support Hero Banner */}
      <div className="mb-4 relative overflow-hidden rounded-2xl bg-gradient-to-l from-slate-900 via-indigo-950 to-indigo-900 text-white p-4 sm:p-5 shadow-lg shadow-indigo-950/20 border border-indigo-700/40 animate-fade-in">
        {/* Soft decorative background ambient glows */}
        <div className="absolute -top-10 -left-10 w-44 h-44 bg-indigo-500/15 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-8 -right-8 w-36 h-36 bg-cyan-400/10 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5">
          <div className="flex items-center gap-3.5">
            {/* Attractive Avatar & Greeting Icon */}
            <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-cyan-400 text-white flex items-center justify-center text-3xl sm:text-4xl shrink-0 shadow-md shadow-black/30 ring-2 ring-white/20 select-none animate-bounce-short">
              👋
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-black text-white tracking-normal font-sans">
                  مرحبًا بك، المهندس بسيل
                </h1>
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-cyan-950 bg-cyan-300 px-2.5 py-0.5 rounded-full shadow-2xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-900" />
                  <span>الدعم الفني</span>
                </span>
              </div>
              <p className="text-xs sm:text-sm text-indigo-200/90 mt-1 font-medium leading-relaxed">
                لوحة الإدارة والتحكم التقني وإدارة بيانات الحلقات والطلاب وقواعد النقاط
              </p>
            </div>
          </div>

          {/* Quick Pill: System Control */}
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 bg-white/10 backdrop-blur-xs border border-white/15 px-3 py-1.5 rounded-xl text-xs text-white">
            <span className="text-cyan-300 text-sm">🛠️</span>
            <span className="font-bold text-indigo-100">إدارة النظام الكاملة</span>
          </div>
        </div>
      </div>

      {/* Desktop Tabs */}
      <div className="hidden md:flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200 shadow-xs mb-4">
        <button
          onClick={() => setActiveTab('students')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'students' ? 'bg-indigo-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>إدارة الطلاب والنقاط</span>
        </button>
        <button
          onClick={() => setActiveTab('rewards_mgmt')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'rewards_mgmt' ? 'bg-indigo-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Gift className="w-4 h-4" />
          <span>إدارة المكافآت</span>
        </button>
        <button
          onClick={() => setActiveTab('tickets')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
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
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'settings' ? 'bg-indigo-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>قواعد النقاط</span>
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'audit' ? 'bg-indigo-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>سجل العمليات (Audit)</span>
        </button>
      </div>

      {/* Views */}
      {(activeTab === 'students' || activeTab === 'points') && (
        <StudentsManagement adminUser={currentUser} onUpdate={() => setTick((t) => t + 1)} />
      )}
      {activeTab === 'rewards_mgmt' && (
        <RewardsManagement adminUser={currentUser} onUpdate={() => setTick((t) => t + 1)} />
      )}
      {activeTab === 'tickets' && <SupportTicketsManager />}
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
