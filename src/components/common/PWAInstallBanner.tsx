import React, { useState } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Download, Smartphone, Share2, PlusSquare, X } from 'lucide-react';
import logoZuhaia from '../../assets/logo-zuhaia-transparent.png';

export const PWAInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  // Suppress banner if already running as installed app or dismissed in session
  if (isInstalled || dismissed) {
    return null;
  }

  // Only show if installable on Android/Chrome or if user is on iOS Safari
  if (!isInstallable && !isIOS) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
    } else {
      await install();
    }
  };

  return (
    <>
      {/* Sleek, Non-intrusive Floating Banner at bottom of mobile view */}
      <div className="fixed bottom-3 right-3 left-3 sm:bottom-4 sm:right-4 sm:left-auto sm:max-w-md z-40 animate-fade-in">
        <div className="bg-gradient-to-r from-teal-900 to-emerald-950 text-white p-3 sm:p-3.5 rounded-2xl shadow-2xl border border-teal-500/30 flex items-center justify-between gap-3 backdrop-blur-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/10 p-1 shrink-0 flex items-center justify-center border border-white/20">
              <img
                src={logoZuhaia}
                alt="شعار الحلقات"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="min-w-0 text-right">
              <h4 className="text-xs font-black text-white truncate">تثبيت تطبيق الحلقات</h4>
              <p className="text-[11px] text-teal-200 truncate">
                وصول فوري وسريع من شاشة هاتفك
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleInstallClick}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-teal-950 text-xs font-black flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تثبيت</span>
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="p-1.5 text-teal-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* iOS Safari Guided Install Sheet */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm text-right space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center">
                  <Smartphone className="w-4 h-4 text-teal-800" />
                </div>
                <h3 className="text-sm font-black text-slate-900">تثبيت التطبيق على آيفون (iOS)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-teal-800 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <p className="leading-relaxed">
                  اضغط على زر المشاركة <Share2 className="w-3.5 h-3.5 inline mx-1 text-teal-700" /> أسفل شاشة المتصفح (سفاري).
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-teal-800 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <p className="leading-relaxed">
                  مرر القائمة لأسفل ثم اختر <span className="font-bold text-slate-900">«إضافة إلى الصفحة الرئيسية»</span> <PlusSquare className="w-3.5 h-3.5 inline mx-1 text-teal-700" />.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-teal-800 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <p className="leading-relaxed">
                  اضغط على <span className="font-bold text-slate-900">«إضافة»</span> بالأعلى ليظهر التطبيق في شاشتك الرئيسية كأي تطبيق رسمي!
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2.5 rounded-xl bg-teal-800 text-white text-xs font-bold hover:bg-teal-900 transition-colors"
            >
              فهمت ذلك
            </button>
          </div>
        </div>
      )}
    </>
  );
};
