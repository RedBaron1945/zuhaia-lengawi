import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogOut } from 'lucide-react';
import logoZuhaia from '../../assets/logo-zuhaia-transparent.png';

interface HeaderProps {
  onResetData?: () => void;
}

export const Header: React.FC<HeaderProps> = () => {
  const { currentUser, logout } = useAuth();

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

        {/* Zone 3: Logout button */}
        <div className="flex items-center gap-1.5 shrink-0">
          {currentUser && (
            <button
              onClick={logout}
              className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center"
              title="تسجيل الخروج"
              aria-label="تسجيل الخروج"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
