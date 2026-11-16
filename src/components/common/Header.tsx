import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogOut, ChevronDown, ShieldCheck, User as UserIcon } from 'lucide-react';
import logoZuhaia from '../../assets/logo-zuhaia-transparent.png';
import { SupportInboxButton } from '../support/SupportInboxButton';

interface HeaderProps {
  onResetData?: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'الدعم الفني',
  supervisor: 'المشرف العام',
  teacher: 'معلم حلقة',
  student: 'طالب',
};

export const Header: React.FC<HeaderProps> = () => {
  const { currentUser, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-3.5 py-2.5 shadow-xs transition-colors">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
        {/* Zone 1: Single Logo (32px) & One-line Title without truncation */}
        <div className="flex items-center gap-2 shrink-0">
          <img
            src={logoZuhaia}
            alt="شعار جامع ومسجد زهية لنجاوي"
            className="h-8 w-auto object-contain shrink-0"
            loading="eager"
          />
          <span className="font-extrabold text-sm sm:text-base text-slate-900 whitespace-nowrap">
            حلقات زهية لنجاوي
          </span>
        </div>

        {/* Zone 3: Support Inbox & Account Menu */}
        <div className="flex items-center gap-1.5 shrink-0">
          {currentUser && <SupportInboxButton />}
          {currentUser && (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                className="min-h-[40px] px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-label="قائمة الحساب"
              >
                <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                  {currentUser.role === 'admin' ? (
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-700" />
                  ) : (
                    <UserIcon className="w-3.5 h-3.5" />
                  )}
                </span>
                <span className="hidden sm:inline max-w-[130px] truncate">{currentUser.name}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute left-0 mt-2 w-72 bg-white rounded-2xl border border-slate-200 shadow-xl p-3 text-right z-50 space-y-2.5 animate-fade-in"
                >
                  <div className="pb-2 border-b border-slate-100">
                    <p className="text-xs font-extrabold text-slate-900">{currentUser.name}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {ROLE_LABELS[currentUser.role] || currentUser.role} · {currentUser.email}
                    </p>
                  </div>

                  {currentUser.role === 'admin' && (
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-extrabold text-indigo-900">
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
                        <span>صلاحية: إدارة النظام الكاملة</span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        تشمل إدارة بيانات الطلاب والحلقات، التعديل الإداري للنقاط (IT)، المكافآت، قواعد النقاط، معالجة تذاكر الدعم، ومراجعة سجل التدقيق.
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                    }}
                    className="w-full min-h-[40px] px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>تسجيل الخروج</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
