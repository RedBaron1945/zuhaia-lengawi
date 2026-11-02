import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, Sparkles, X } from 'lucide-react';

interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'points';
  points?: number;
}

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'points', points?: number) => void;
  celebratePoints: (points: number, reason: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' | 'points' = 'success', points?: number) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
      setToasts((prev) => [...prev, { id, message, type, points }]);

      setTimeout(() => {
        removeToast(id);
      }, 4000);
    },
    [removeToast]
  );

  const celebratePoints = useCallback(
    (points: number, reason: string) => {
      showToast(`+${points} نقاط! ${reason}`, 'points', points);
    },
    [showToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, celebratePoints }}>
      {children}
      {/* Toast container floating at top or bottom (RTL adjusted) */}
      <div className="fixed top-4 left-4 right-4 z-50 flex flex-col items-center gap-2 pointer-events-none max-w-md mx-auto">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-2xl shadow-xl border w-full transition-all animate-bounce-short text-sm font-medium ${
              toast.type === 'points'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white border-amber-400 shadow-amber-500/20'
                : toast.type === 'success'
                ? 'bg-teal-800 text-white border-teal-700 shadow-teal-900/20'
                : toast.type === 'error'
                ? 'bg-rose-700 text-white border-rose-600 shadow-rose-900/20'
                : 'bg-slate-800 text-white border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {toast.type === 'points' && (
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-amber-200 animate-pulse" />
                </div>
              )}
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-teal-300 shrink-0" />}
              {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-300 shrink-0" />}
              {toast.type === 'info' && <Info className="w-5 h-5 text-slate-300 shrink-0" />}
              <span className="leading-snug">{toast.message}</span>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 rounded-lg hover:bg-white/20 transition-colors text-white/80 shrink-0"
              aria-label="إغلاق التنبيه"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
