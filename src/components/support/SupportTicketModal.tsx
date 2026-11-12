import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { repository } from '../../services/storageService';
import { SupportTicketType, SupportTicketPriority } from '../../types';
import {
  LifeBuoy,
  X,
  Send,
  CheckCircle2,
  MessageCircle,
  HelpCircle,
  User,
  AlertCircle,
} from 'lucide-react';
import { WhatsAppIcon } from '../common/WhatsAppIcon';

interface SupportTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupportTicketModal: React.FC<SupportTicketModalProps> = ({ isOpen, onClose }) => {
  const { currentUser } = useAuth();
  const [ticketType, setTicketType] = useState<SupportTicketType>('مشكلة');
  const [message, setMessage] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  // Automatic Priority Classification:
  // أولوية عالية: مدير المجمع (supervisor) أو المعلمين (teacher) أو الإدارة (admin)
  // أولوية متوسطة/منخفضة: الطلاب (student)
  // زائر من صفحة تسجيل الدخول: أولوية متوسطة
  const isHighPriority =
    currentUser?.role === 'supervisor' ||
    currentUser?.role === 'teacher' ||
    currentUser?.role === 'admin';

  const automaticPriority: SupportTicketPriority = currentUser
    ? isHighPriority
      ? 'high'
      : ticketType === 'مشكلة'
      ? 'medium'
      : 'low'
    : 'medium';

  // Retrieve student / teacher registered phone if available
  let registeredPhone = '';
  if (currentUser) {
    if (currentUser.role === 'student' && currentUser.studentId) {
      const st = repository.getStudentById(currentUser.studentId);
      registeredPhone = st?.phone || st?.parentPhone || st?.guardianPhone || '';
    } else if (currentUser.role === 'teacher') {
      const teachers = repository.getTeachers();
      const tc = teachers.find((t) => t.id === currentUser.id || t.email === currentUser.email);
      registeredPhone = tc?.phone || '';
    }
  }

  const effectivePhone = currentUser ? registeredPhone : guestPhone.trim();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!currentUser) {
      if (!guestName.trim()) {
        setErrorMessage('الرجاء إدخال اسمك الكريم للتواصل');
        return;
      }
      if (!guestPhone.trim()) {
        setErrorMessage('الرجاء إدخال رقم الواتس آب للتواصل');
        return;
      }
    }

    if (!message.trim()) {
      setErrorMessage('الرجاء كتابة تفاصيل طلبك أو استفسارك');
      return;
    }

    setIsSubmitting(true);

    try {
      const finalSenderName = currentUser?.name || guestName.trim() || 'زائر (صفحة الدخول)';
      const finalSenderPhone = currentUser ? registeredPhone : guestPhone.trim();

      repository.createSupportTicket({
        ticketType,
        priority: automaticPriority,
        message: message.trim(),
        senderName: finalSenderName,
        senderRole: currentUser?.role || 'guest',
        senderEmail: currentUser?.email || '',
        senderId: currentUser?.id || 'guest',
        senderPhone: finalSenderPhone || undefined,
      });

      setIsSubmitting(false);
      setIsSuccess(true);
    } catch (err) {
      console.error('Failed to submit ticket:', err);
      setErrorMessage('حدث خطأ أثناء إرسال التذكرة، يرجى المحاولة مرة أخرى');
      setIsSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setIsSuccess(false);
    setMessage('');
    setGuestName('');
    setGuestPhone('');
    setErrorMessage('');
    setTicketType('مشكلة');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in select-none">
      <div
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-right flex flex-col max-h-[92vh] animate-scale-up"
        role="dialog"
        aria-modal="true"
      >
        {/* Header Strip */}
        <div className="bg-gradient-to-r from-teal-800 via-teal-700 to-emerald-800 text-white p-4 sm:p-5 flex items-center justify-between relative shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-white text-xl shrink-0">
              <LifeBuoy className="w-5 h-5 text-teal-200" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white">تذكرة الدعم الفني</h3>
              <p className="text-[11px] text-teal-100/90 font-medium mt-0.5">
                مسؤول قسم تقنية المعلومات في خدمتك
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetAndClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          {isSuccess ? (
            /* Success State Window */
            <div className="text-center py-4 space-y-4 animate-scale-up">
              <div className="w-16 h-16 rounded-full bg-emerald-100 border-2 border-emerald-300 text-emerald-700 flex items-center justify-center mx-auto shadow-inner text-3xl">
                <CheckCircle2 className="w-9 h-9 text-emerald-600" />
              </div>

              <div className="space-y-2">
                <h4 className="text-base sm:text-lg font-black text-slate-900">
                  شكرًا! تم إرسال طلبك لمسؤول قسم تقنية المعلومات
                </h4>
                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200/80 text-emerald-900 text-xs sm:text-sm font-bold leading-relaxed flex items-center gap-2 justify-center">
                  <MessageCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>في حالة الحاجة سيتم التواصل معك بالواتس آب حسب الرقم المسجل بالمنصة</span>
                </div>
              </div>

              {effectivePhone && (
                <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs font-bold">
                  <div className="w-5 h-5 rounded-md bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <WhatsAppIcon className="w-3.5 h-3.5 fill-white" />
                  </div>
                  <span className="text-slate-600 font-medium text-[11px]">رقم الواتساب للتواصل:</span>
                  <span className="font-black font-mono tabular-nums text-emerald-950">{effectivePhone}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleResetAndClose}
                className="w-full py-3 rounded-2xl bg-teal-800 hover:bg-teal-900 text-white font-extrabold text-xs sm:text-sm shadow-md transition-all cursor-pointer mt-2"
              >
                حسنًا، تم
              </button>
            </div>
          ) : (
            /* Submission Form */
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Error Banner */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Guest Information Section (When user is not logged in) */}
              {!currentUser && (
                <div className="space-y-3 p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 text-right">
                  <div className="flex items-center gap-1.5 text-xs font-black text-amber-900 border-b border-amber-200 pb-1.5">
                    <User className="w-3.5 h-3.5 text-amber-700" />
                    <span>بيانات مقدم التذكرة (صفحة تسجيل الدخول)</span>
                  </div>

                  {/* 1. Name Field */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      الاسم الكريم <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="اكتب اسمك الكريم هنا..."
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white border border-slate-200 focus:bg-white focus:outline-hidden focus:border-teal-700 font-medium text-slate-800"
                    />
                  </div>

                  {/* 2. WhatsApp Mobile Phone Field */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded-md bg-[#25D366] text-white flex items-center justify-center shrink-0">
                        <WhatsAppIcon className="w-2.5 h-2.5 fill-white" />
                      </div>
                      <span>رقم الواتس آب للتواصل <span className="text-rose-500">*</span></span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      placeholder="مثال: 0501234567"
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white border border-slate-200 focus:bg-white focus:outline-hidden focus:border-teal-700 font-bold font-mono text-slate-800 tabular-nums"
                      dir="ltr"
                    />
                    <span className="text-[10px] text-amber-900/80 mt-1 block">
                      سيقوم مسؤول تقنية المعلومات بالتواصل معك عبر الواتس آب على الرقم (عند الحاجة)
                    </span>
                  </div>
                </div>
              )}

              {/* Dropdown: نوع الاستفسار */}
              <div>
                <label className="block text-xs font-black text-slate-800 mb-1.5 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-teal-700" />
                  <span>حدد نوع الاستفسار</span>
                  <span className="text-rose-500">*</span>
                </label>
                <select
                  value={ticketType}
                  onChange={(e) => setTicketType(e.target.value as SupportTicketType)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-hidden focus:border-teal-700 font-bold text-slate-800 cursor-pointer transition-colors"
                >
                  <option value="مشكلة">مشكلة</option>
                  <option value="اقتراح">اقتراح</option>
                  <option value="استفسار">استفسار</option>
                  <option value="أخرى..">أخرى..</option>
                </select>
              </div>

              {/* Textarea: مربع النص */}
              <div>
                <label className="block text-xs font-black text-slate-800 mb-1.5">
                  <span>اكتب تفاصيل طلبك أو رسالتك</span>
                  <span className="text-rose-500 mr-1">*</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="اكتب هنا ما تود إخباره لمسؤول تقنية المعلومات بالتفصيل..."
                  rows={4}
                  required
                  className="w-full p-3 text-xs sm:text-sm rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-hidden focus:border-teal-700 text-slate-800 placeholder:text-slate-400 font-medium leading-relaxed resize-none transition-colors"
                />
              </div>

              {/* Informational WhatsApp Notice for Logged in user */}
              {currentUser && (
                <div className="bg-teal-50/80 p-3 rounded-xl border border-teal-200/70 text-teal-900 text-[11px] leading-relaxed flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                    <WhatsAppIcon className="w-3.5 h-3.5 fill-white" />
                  </div>
                  <div>
                    <p className="font-bold">في حالة الحاجة سيتم التواصل معك بالواتس آب حسب الرقم المسجل بالمنصة.</p>
                    {registeredPhone && (
                      <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                        <span className="text-teal-800 font-medium">الرقم المعتمد بحسابك:</span>
                        <span className="font-black font-mono text-emerald-950 tabular-nums bg-white px-2 py-0.5 rounded-md border border-teal-200/80 inline-flex items-center gap-1">
                          <WhatsAppIcon className="w-3 h-3 text-[#25D366] fill-[#25D366]" />
                          <span>{registeredPhone}</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={!message.trim() || isSubmitting}
                  className="flex-1 py-3 px-4 rounded-xl bg-teal-800 hover:bg-teal-900 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmitting ? 'جارٍ الإرسال...' : 'إرسال التذكرة'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="py-3 px-4 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
