import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LogIn,
  Key,
  Mail,
  Eye,
  EyeOff,
} from 'lucide-react';
import logoZuhaia from '../../assets/logo-zuhaia-transparent.png';
import logoKhyrukum from '../../assets/khyrukum-logo-transparent.png';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [zuhaiaError, setZuhaiaError] = useState(false);
  const [khyrukumError, setKhyrukumError] = useState(false);

  const handlePerformLogin = async (loginEmail: string, loginPass: string) => {
    setError('');
    setLoading(true);

    try {
      const res = await login(loginEmail, loginPass);
      if (!res.success) {
        setError(res.message || 'فشل تسجيل الدخول، يرجى التحقق من صحة البيانات');
      }
    } catch (err: any) {
      setError(err?.message || 'فشل تسجيل الدخول، يرجى التحقق من صحة البيانات');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handlePerformLogin(email, password);
  };

  return (
    <div
      className="min-h-[100dvh] relative overflow-hidden flex flex-col justify-center items-center py-3 sm:py-6 px-3.5 sm:px-4 selection:bg-[#d4af37] selection:text-[#064e45]"
      style={{
        background: 'linear-gradient(135deg, #064e45 0%, #0b6b5e 100%)',
      }}
    >
      {/* 5% Opacity Islamic Geometric Pattern Overlay */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-5 select-none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <pattern id="islamic-geo-pattern" width="80" height="80" patternUnits="userSpaceOnUse">
            <path
              d="M40 0 L48.28 11.72 L64 8 L60.28 23.72 L72 32 L60.28 40.28 L64 56 L48.28 52.28 L40 64 L31.72 52.28 L16 56 L19.72 40.28 L8 32 L19.72 23.72 L16 8 L31.72 11.72 Z"
              fill="none"
              stroke="#ffffff"
              strokeWidth="1.2"
            />
            <path
              d="M0 40 L11.72 48.28 L8 64 L23.72 60.28 L32 72 L40.28 60.28 L56 64 L52.28 48.28 L64 40 L52.28 31.72 L56 16 L40.28 19.72 L32 8 L23.72 19.72 L8 16 L11.72 31.72 Z"
              fill="none"
              stroke="#ffffff"
              strokeWidth="1.2"
            />
            <circle cx="40" cy="40" r="14" fill="none" stroke="#ffffff" strokeWidth="1" />
            <circle cx="0" cy="0" r="14" fill="none" stroke="#ffffff" strokeWidth="1" />
            <circle cx="80" cy="0" r="14" fill="none" stroke="#ffffff" strokeWidth="1" />
            <circle cx="0" cy="80" r="14" fill="none" stroke="#ffffff" strokeWidth="1" />
            <circle cx="80" cy="80" r="14" fill="none" stroke="#ffffff" strokeWidth="1" />
            <rect x="0" y="0" width="80" height="80" fill="none" stroke="#ffffff" strokeWidth="0.5" strokeDasharray="3,3" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#islamic-geo-pattern)" />
      </svg>

      {/* Main Container - Balanced vertical centering on mobile and desktop */}
      <div className="w-full max-w-md mx-auto my-auto relative z-10 flex flex-col items-center">
        {/* Top Quranic Verse: Enhanced contrast, larger 23px, radiant gold #fadb62, text-shadow */}
        <div className="text-center mb-3 sm:mb-4 select-none">
          <p
            className="font-quran tracking-normal select-none"
            style={{
              fontFamily: "'Amiri Quran', serif",
              color: '#fadb62',
              fontSize: '23px',
              lineHeight: '1.4',
              textShadow: '0 2px 6px rgba(0, 0, 0, 0.45), 0 1px 2px rgba(0, 0, 0, 0.6)',
            }}
          >
            ﴿ وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا ﴾
          </p>
        </div>

        {/* Form Card: White, 20px rounded, soft shadow, 200ms appearance animation */}
        <div className="w-full bg-white rounded-[20px] p-5 sm:p-7 shadow-2xl shadow-black/25 animate-card-appear border border-white/60">
          {/* Top Logos Row: Mosque logo enlarged to ~56px with trimmed margins */}
          <div className="flex items-center justify-center gap-5 mb-3 sm:mb-3.5">
            {/* Mosque Zahia Lanjawi Logo: 56px height */}
            {!zuhaiaError ? (
              <img
                src={logoZuhaia}
                alt="شعار جامع ومسجد زهية لنجاوي"
                className="h-[56px] w-auto object-contain select-none"
                onError={() => setZuhaiaError(true)}
                loading="eager"
              />
            ) : (
              <div
                className="h-[56px] flex items-center justify-center text-2xl font-bold"
                title="شعار جامع ومسجد زهية لنجاوي"
              >
                🕌
              </div>
            )}

            {/* Thin vertical separator */}
            <div className="w-px h-8 bg-slate-200 shrink-0" aria-hidden="true" />

            {/* Khyrukum Association Logo */}
            {!khyrukumError ? (
              <img
                src={logoKhyrukum}
                alt="شعار جمعية خيركم لتحفيظ القرآن الكريم بجدة"
                className="h-[48px] w-auto object-contain select-none"
                onError={() => setKhyrukumError(true)}
                loading="eager"
              />
            ) : (
              <div
                className="h-[48px] flex items-center justify-center text-2xl font-bold"
                title="شعار جمعية خيركم لتحفيظ القرآن الكريم بجدة"
              >
                📖
              </div>
            )}
          </div>

          {/* Title: Tajawal 800 with letter-spacing 0 to prevent Arabic text distortion */}
          <div className="text-center mb-4 sm:mb-5">
            <h1
              className="text-xl sm:text-[22px] text-slate-900 leading-tight"
              style={{
                fontFamily: "'Tajawal', -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 800,
                letterSpacing: '0px',
              }}
            >
              حلقات جامع زهية لنجاوي
            </h1>
            {/* High-contrast subtitle meeting accessibility standards */}
            <p className="text-xs text-slate-700 font-semibold mt-1.5">
              متابعة حفظ القرآن وتحفيز الطلاب
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 mb-3.5 rounded-[12px] bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 leading-relaxed flex items-center gap-2">
              <span className="shrink-0 text-sm">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Email Field */}
            <div className="pb-1">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                البريد الإلكتروني
              </label>
              <div className="relative">
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="أدخل بريدك الإلكتروني"
                  className="w-full bg-[#f4f6f6] rounded-[12px] border-2 border-transparent pr-10 pl-3.5 py-2.5 text-xs font-medium text-slate-800 placeholder-slate-400 transition-colors focus:bg-white focus:border-[#0b6b5e] focus:outline-hidden min-h-[44px]"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="pt-0.5">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                كلمة المرور
              </label>
              <div className="relative">
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <Key className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#f4f6f6] rounded-[12px] border-2 border-transparent pr-10 pl-12 py-2.5 text-xs font-medium text-slate-800 placeholder-slate-400 transition-colors focus:bg-white focus:border-[#0b6b5e] focus:outline-hidden min-h-[44px]"
                />
                {/* 44x44px touch target button for toggle eye */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-1 top-1/2 -translate-y-1/2 w-[44px] h-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Prominent Login Button: Brighter emerald tone (#0d7e6e) with soft green shadow */}
            <div className="pt-1">
              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[46px] rounded-[12px] bg-[#0d7e6e] hover:bg-[#0b6b5e] text-white font-extrabold text-xs shadow-lg shadow-teal-700/25 border border-teal-600/30 flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>جارٍ تسجيل الدخول...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>تسجيل الدخول</span>
                  </>
                )}
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
};
