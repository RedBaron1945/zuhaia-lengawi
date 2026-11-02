import React from 'react';
import { AlertTriangle, Gift, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'primary' | 'danger' | 'reward';
  iconEmoji?: string;
  loading?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'تأكيد',
  cancelText = 'إلغاء',
  type = 'primary',
  iconEmoji,
  loading = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden transform transition-all animate-scale-up"
        role="dialog"
        aria-modal="true"
      >
        {/* Header accent strip */}
        <div
          className={`h-2 w-full ${
            type === 'reward'
              ? 'bg-gradient-to-r from-teal-500 via-amber-400 to-amber-500'
              : type === 'danger'
              ? 'bg-gradient-to-r from-rose-500 to-red-600'
              : 'bg-gradient-to-r from-teal-600 to-teal-800'
          }`}
        />

        <div className="p-6 text-center">
          {/* Icon / Emoji badge */}
          <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center shadow-inner text-3xl">
            {iconEmoji ? (
              <span>{iconEmoji}</span>
            ) : type === 'reward' ? (
              <Gift className="w-8 h-8 text-amber-600" />
            ) : type === 'danger' ? (
              <AlertTriangle className="w-8 h-8 text-rose-600" />
            ) : (
              <span className="text-2xl">✨</span>
            )}
          </div>

          <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
          <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed mb-6">
            {message}
          </p>

          {/* Action buttons (big touch-friendly targets min 44px) */}
          <div className="flex flex-col gap-2.5">
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`w-full min-h-[48px] rounded-xl font-bold text-sm transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 ${
                type === 'danger'
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
                  : 'bg-teal-700 hover:bg-teal-800 text-white shadow-teal-700/20'
              } disabled:opacity-50`}
            >
              {loading ? 'جارٍ التنفيذ...' : confirmText}
            </button>
            <button
              onClick={onClose}
              disabled={loading}
              className="w-full min-h-[44px] rounded-xl font-medium text-sm text-slate-600 hover:bg-slate-100 transition-colors border border-slate-200"
            >
              {cancelText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
