import React, { useState } from 'react';
import logoZuhaia from '../../assets/logo-zuhaia-transparent.png';
import logoKhyrukum from '../../assets/khyrukum-logo-transparent.png';

interface MosqueLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  subtitle?: string;
  variant?: 'dual' | 'zuhaia' | 'khyrukum';
}

export const MosqueLogo: React.FC<MosqueLogoProps> = ({
  className = '',
  size = 'md',
  showText = true,
  subtitle,
  variant = 'dual',
}) => {
  const [zuhaiaError, setZuhaiaError] = useState(false);
  const [khyrukumError, setKhyrukumError] = useState(false);

  const sizeMap = {
    xs: {
      box: 'w-6 h-6',
      img: 'w-6 h-6',
      title: 'text-[11px] font-bold',
      sub: 'text-[8px]',
      gap: 'gap-1.5',
    },
    sm: {
      box: 'w-8 h-8',
      img: 'w-8 h-8',
      title: 'text-xs sm:text-sm font-black',
      sub: 'text-[10px]',
      gap: 'gap-2',
    },
    md: {
      box: 'w-10 h-10',
      img: 'w-10 h-10',
      title: 'text-sm sm:text-base font-black',
      sub: 'text-xs',
      gap: 'gap-2.5',
    },
    lg: {
      box: 'w-14 h-14',
      img: 'w-14 h-14',
      title: 'text-lg font-black',
      sub: 'text-xs',
      gap: 'gap-3',
    },
    xl: {
      box: 'w-20 h-20',
      img: 'w-20 h-20',
      title: 'text-2xl font-black',
      sub: 'text-sm',
      gap: 'gap-4',
    },
  };

  const currentSize = sizeMap[size];

  return (
    <div className={`flex items-center ${currentSize.gap} select-none ${className}`}>
      {/* Logos Container */}
      <div className="flex items-center -space-x-1 sm:space-x-1.5 rtl:space-x-reverse shrink-0">
        {/* 1. Mosque Zahia Lanjawi Logo */}
        {(variant === 'dual' || variant === 'zuhaia') && (
          <div
            title="جامع ومسجد زهية لنجاوي"
            className={`relative ${currentSize.box} rounded-2xl bg-white p-0.5 shadow-xs border border-teal-600/20 ring-1 ring-teal-700/10 flex items-center justify-center shrink-0 overflow-hidden hover:scale-105 transition-transform`}
          >
            {!zuhaiaError ? (
              <img
                src={logoZuhaia}
                alt="شعار جامع ومسجد زهية لنجاوي"
                className={`${currentSize.img} object-contain rounded-xl`}
                onError={() => setZuhaiaError(true)}
                loading="eager"
              />
            ) : (
              <div className="w-full h-full rounded-xl bg-teal-900 text-amber-400 flex items-center justify-center font-bold text-xs">
                🕌
              </div>
            )}
          </div>
        )}

        {/* 2. Khyrukum Quran Association Logo */}
        {(variant === 'dual' || variant === 'khyrukum') && (
          <div
            title="جمعية خيركم لتحفيظ القرآن الكريم بجدة"
            className={`relative ${currentSize.box} rounded-2xl bg-white p-0.5 shadow-xs border border-amber-500/25 ring-1 ring-amber-500/15 flex items-center justify-center shrink-0 overflow-hidden hover:scale-105 transition-transform`}
          >
            {!khyrukumError ? (
              <img
                src={logoKhyrukum}
                alt="شعار جمعية خيركم لتحفيظ القرآن الكريم"
                className={`${currentSize.img} object-contain rounded-xl`}
                onError={() => setKhyrukumError(true)}
                loading="eager"
              />
            ) : (
              <div className="w-full h-full rounded-xl bg-amber-800 text-white flex items-center justify-center font-bold text-xs">
                📖
              </div>
            )}
          </div>
        )}
      </div>

      {/* Typography / Branding Titles */}
      {showText && (
        <div className="flex flex-col text-right leading-tight">
          <div className="flex items-center gap-1.5 flex-nowrap">
            <span className={`${currentSize.title} text-teal-950 tracking-tight truncate max-w-[130px] sm:max-w-none`}>
              حلقات جامع زهية لنجاوي
            </span>
            <span className="hidden md:inline-flex text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300/60 shrink-0">
              إشراف جمعية خيركم
            </span>
          </div>
          <span className={`${currentSize.sub} text-slate-500 font-medium mt-0.5 truncate max-w-[140px] sm:max-w-none`}>
            {subtitle || 'جمعية خيركم لتحفيظ القرآن الكريم بجدة'}
          </span>
        </div>
      )}
    </div>
  );
};
