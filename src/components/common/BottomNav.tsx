import React from 'react';
import { Home, Gift, Clock, Award, Users, BookOpen, BarChart3, Settings, ShieldCheck } from 'lucide-react';
import { Role } from '../../types';

interface BottomNavProps {
  role: Role;
  activeTab: string;
  onTabChange: (tabId: string) => void;
  badges?: Record<string, number | boolean>;
}

export const BottomNav: React.FC<BottomNavProps> = ({ role, activeTab, onTabChange, badges }) => {
  // Navigation tabs config based on active Role
  const getTabs = () => {
    switch (role) {
      case 'student':
        return [
          { id: 'home', label: 'الرئيسية', icon: Home },
          { id: 'rewards', label: 'المكافآت', icon: Gift },
          { id: 'history', label: 'سجلي', icon: Clock },
          { id: 'achievements', label: 'إنجازاتي', icon: Award },
        ];
      case 'teacher':
        return [
          { id: 'circles', label: 'الحلقات', icon: BookOpen },
          { id: 'attendance_log', label: 'سجل الحضور', icon: Clock },
          { id: 'evaluations', label: 'التقييمات', icon: Award },
        ];
      case 'supervisor':
        return [
          { id: 'leaderboard', label: 'الترتيب', icon: Award },
          { id: 'stats', label: 'الإحصائيات', icon: BarChart3 },
          { id: 'redemptions', label: 'المطالبات', icon: Gift },
          { id: 'attention', label: 'المتابعة', icon: ShieldCheck },
        ];
      case 'admin':
        return [
          { id: 'students', label: 'الطلاب', icon: Users },
          { id: 'points', label: 'النقاط', icon: Award },
          { id: 'rewards_mgmt', label: 'المكافآت', icon: Gift },
          { id: 'settings', label: 'القواعد', icon: Settings },
          { id: 'audit', label: 'السجل', icon: Clock },
        ];
      default:
        return [];
    }
  };

  const tabs = getTabs();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-lg px-2 pb-safe md:hidden">
      <div
        className="grid items-center h-16 max-w-md mx-auto"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors relative ${
                isActive ? 'text-teal-700 font-bold' : 'text-slate-500 hover:text-slate-800 font-medium'
              }`}
              aria-label={tab.label}
            >
              <div
                className={`p-1 rounded-xl transition-all relative ${
                  isActive ? 'bg-teal-50 text-teal-700 scale-105' : ''
                }`}
              >
                <Icon className="w-5 h-5 stroke-[2.2]" />
                {badges && badges[tab.id] ? (
                  typeof badges[tab.id] === 'number' && (badges[tab.id] as number) > 0 ? (
                    <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[9px] font-black rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center border-2 border-white shadow-xs">
                      {badges[tab.id]}
                    </span>
                  ) : (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-white" />
                  )
                ) : null}
              </div>
              <span className={`text-[10px] mt-0.5 tracking-tight ${isActive ? 'font-bold text-teal-800' : ''}`}>
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-teal-600" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
