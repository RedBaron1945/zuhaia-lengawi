import React from 'react';
import { HelpCircle, Sparkles, MessageCircle } from 'lucide-react';

interface FooterProps {
  onOpenSupport: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenSupport }) => {
  return (
    <footer className="w-full mt-auto py-5 px-4 text-center select-none pb-24 sm:pb-8">
      <div className="max-w-md mx-auto">
        <button
          type="button"
          onClick={onOpenSupport}
          className="group inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white hover:bg-teal-50/80 border border-slate-200/90 hover:border-teal-300 text-slate-600 hover:text-teal-900 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
        >
          <div className="w-6 h-6 rounded-lg bg-teal-100/70 text-teal-800 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
            <HelpCircle className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs sm:text-sm font-extrabold tracking-tight">
            لديك مشكلة؟ اقتراح؟ استفسار؟
          </span>
          <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200/60 group-hover:bg-teal-100 transition-colors">
            تواصل معنا
          </span>
        </button>

        <p className="text-[11px] text-slate-400 mt-2.5 font-medium tabular-nums">
          منصة حلقات زهية لنجاوي © 2026
        </p>
      </div>
    </footer>
  );
};
