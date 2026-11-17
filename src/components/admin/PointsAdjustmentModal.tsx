import React, { useState, useRef, useEffect } from 'react';
import { Student, User } from '../../types';
import { repository } from '../../services/storageService';
import { useToast } from '../../context/ToastContext';
import { ConfirmationModal } from '../common/ConfirmationModal';
import {
  X,
  Plus,
  Minus,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ArrowUpLeft,
  RotateCcw,
} from 'lucide-react';

interface PointsAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
  adminUser: User;
  onSuccess: () => void;
  onNavigateToAuditLog?: () => void;
}

const PRESET_AMOUNTS = [10, 20, 50, 100] as const;

const ADD_REASON_SUGGESTIONS = [
  'مكافأة تفوق وتميز',
  'مسابقة حفظ سريعة',
  'انضباط وحضور تام',
  'تعويض عن خطأ تقني سابق',
  'أخرى',
] as const;

const DEDUCT_REASON_SUGGESTIONS = [
  'تصحيح نقاط مسجلة بالخطأ',
  'مخالفة انضباطية',
  'تعديل رصيد مكرر',
  'أخرى',
] as const;

/** Convert Arabic-Indic / Eastern Arabic digits to Latin ASCII digits and strip non-digits (integers only). */
const normalizeNumericInput = (raw: string): string => {
  const converted = raw
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[^0-9]/g, '');
  if (!converted) return '';
  return converted.replace(/^0+(?=\d)/, '');
};

/** Proper Arabic singular/dual/plural phrasing with Latin numerals (e.g., "6 نقاط", "50 نقطة"). */
const formatPointsLabel = (count: number): string => {
  const abs = Math.abs(Math.trunc(count));
  if (abs === 1) return '1 نقطة';
  if (abs === 2) return '2 نقطتان';
  if (abs >= 3 && abs <= 10) return `${abs} نقاط`;
  return `${abs} نقطة`;
};

export const PointsAdjustmentModal: React.FC<PointsAdjustmentModalProps> = ({
  isOpen,
  onClose,
  student,
  adminUser,
  onSuccess,
  onNavigateToAuditLog,
}) => {
  const [actionType, setActionType] = useState<'add' | 'deduct'>('add');
  const [amountStr, setAmountStr] = useState<string>('50');
  const [isCustomAmountMode, setIsCustomAmountMode] = useState<boolean>(false);
  const [reason, setReason] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [pendingConfirm, setPendingConfirm] = useState<{
    numericAmount: number;
    signedAmount: number;
    rawReason: string;
    studentVisibleReason: string;
    noteText: string;
  } | null>(null);
  const [successResult, setSuccessResult] = useState<{
    actionType: 'add' | 'deduct';
    amount: number;
    newBalance: number;
  } | null>(null);

  const amountInputRef = useRef<HTMLInputElement>(null);
  const reasonInputRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);
  const submitLockRef = useRef<boolean>(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setActionType('add');
      setAmountStr('50');
      setIsCustomAmountMode(false);
      setReason('');
      setNote('');
      setValidationError(null);
      setIsSubmitting(false);
      setPendingConfirm(null);
      setSuccessResult(null);
      submitLockRef.current = false;
    }
  }, [isOpen, student.id]);

  if (!isOpen) return null;

  const currentStudent = repository.getStudentById(student.id) || student;
  const parsedAmount = amountStr.trim() === '' ? 0 : parseInt(amountStr, 10) || 0;
  const signedAmount = actionType === 'add' ? parsedAmount : -parsedAmount;
  const resultingBalance = currentStudent.currentPoints + signedAmount;
  const isNegativeBalance = resultingBalance < 0;
  const isOtherReason = reason.trim() === 'أخرى';

  const quickReasons =
    actionType === 'add' ? ADD_REASON_SUGGESTIONS : DEDUCT_REASON_SUGGESTIONS;

  const isPresetMatched =
    !isCustomAmountMode &&
    PRESET_AMOUNTS.some((v) => String(v) === amountStr);

  const isSubmitDisabled =
    isSubmitting || parsedAmount < 1 || isNegativeBalance;

  const executeAdjustment = (payload: {
    numericAmount: number;
    signedAmount: number;
    studentVisibleReason: string;
    noteText: string;
  }) => {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setIsSubmitting(true);

    // Yield one frame so the loading spinner paints and prevents rapid double clicks
    window.setTimeout(() => {
      try {
        const result = repository.addPointTransaction({
          studentId: student.id,
          amount: payload.signedAmount,
          type: payload.signedAmount >= 0 ? 'admin_bonus' : 'admin_correction',
          reason: payload.studentVisibleReason,
          note: payload.noteText || undefined,
          actorId: adminUser.id,
          createdBy: adminUser.name,
          createdByRole: adminUser.role || 'admin',
        });

        setPendingConfirm(null);

        if (result.success) {
          const updatedStudent = repository.getStudentById(student.id);
          const updatedBalance =
            updatedStudent?.currentPoints ??
            Math.max(0, currentStudent.currentPoints + payload.signedAmount);
          const opType: 'add' | 'deduct' = payload.signedAmount >= 0 ? 'add' : 'deduct';
          const opVerb = opType === 'add' ? 'إضافة' : 'خصم';

          showToast(
            `تم ${opVerb} ${formatPointsLabel(payload.numericAmount)}. الرصيد الآن ${updatedBalance} ✓`,
            opType === 'add' ? 'success' : 'info'
          );

          setSuccessResult({
            actionType: opType,
            amount: payload.numericAmount,
            newBalance: updatedBalance,
          });
          onSuccess();
        } else {
          setValidationError(result.message);
          showToast(result.message, 'error');
        }
      } finally {
        submitLockRef.current = false;
        setIsSubmitting(false);
      }
    }, 120);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || submitLockRef.current) return;

    setValidationError(null);

    if (parsedAmount < 1) {
      setValidationError('يجب إدخال عدد نقاط صحيح لا يقل عن 1.');
      amountInputRef.current?.focus();
      return;
    }

    if (isNegativeBalance) {
      setValidationError(
        `لا يمكن خصم ${formatPointsLabel(parsedAmount)} لأن الرصيد المتاح ${formatPointsLabel(currentStudent.currentPoints)} فقط.`
      );
      amountInputRef.current?.focus();
      return;
    }

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setValidationError('يرجى كتابة سبب إضافة النقاط أو خصمها ليظهر للطالب وفي سجل العمليات.');
      reasonInputRef.current?.focus();
      return;
    }

    const trimmedNote = note.trim();
    if (trimmedReason === 'أخرى' && !trimmedNote) {
      setValidationError('حقل الملاحظة إلزامي عند اختيار السبب «أخرى».');
      noteInputRef.current?.focus();
      return;
    }

    const studentVisibleReason =
      trimmedReason === 'أخرى'
        ? trimmedNote
        : trimmedNote
        ? `${trimmedReason} — ${trimmedNote}`
        : trimmedReason;

    const payload = {
      numericAmount: parsedAmount,
      signedAmount,
      rawReason: trimmedReason,
      studentVisibleReason,
      noteText: trimmedNote,
    };

    // Deductions (any amount) and additions above 100 require explicit confirmation modal
    if (actionType === 'deduct' || parsedAmount > 100) {
      setPendingConfirm(payload);
      return;
    }

    executeAdjustment(payload);
  };

  const handleSelectCustomAmount = () => {
    setIsCustomAmountMode(true);
    setValidationError(null);
    window.setTimeout(() => {
      amountInputRef.current?.focus();
      amountInputRef.current?.select();
    }, 0);
  };

  const handleResetForAnother = () => {
    setAmountStr('50');
    setIsCustomAmountMode(false);
    setReason('');
    setNote('');
    setValidationError(null);
    setSuccessResult(null);
  };

  const handleGoToAuditLog = () => {
    onClose();
    onNavigateToAuditLog?.();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="points-adjust-modal-title"
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 max-h-[92dvh] flex flex-col overflow-hidden text-right animate-scale-up"
      >
        {/* Mobile sheet drag indicator */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center bg-indigo-900 shrink-0">
          <span className="w-10 h-1 rounded-full bg-white/35" />
        </div>

        {/* Header */}
        <div className="px-4 py-3.5 sm:p-4 bg-indigo-900 text-white flex items-center justify-between shrink-0">
          <div>
            <h3 id="points-adjust-modal-title" className="text-sm font-extrabold">
              تعديل النقاط الإداري
            </h3>
            <p className="text-[11px] text-indigo-200 mt-0.5 truncate max-w-[260px]">
              {student.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 rounded-xl hover:bg-white/15 text-white/85 transition-colors cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center disabled:opacity-50"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success View */}
        {successResult ? (
          <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
            <div
              className={`rounded-2xl p-4 border text-center space-y-2 ${
                successResult.actionType === 'add'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : 'bg-rose-50 border-rose-200 text-rose-950'
              }`}
            >
              <div
                className={`w-12 h-12 rounded-2xl mx-auto flex items-center justify-center ${
                  successResult.actionType === 'add'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-rose-600 text-white'
                }`}
              >
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p className="text-sm font-black tabular-nums">
                تم {successResult.actionType === 'add' ? 'إضافة' : 'خصم'}{' '}
                {formatPointsLabel(successResult.amount)}. الرصيد الآن {successResult.newBalance} ✓
              </p>
              <p className="text-xs text-slate-600">
                سُجِّلت العملية باسم <span className="font-bold">{adminUser.name}</span> في سجل العمليات وظهرت في سجل الطالب.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              {onNavigateToAuditLog && (
                <button
                  type="button"
                  onClick={handleGoToAuditLog}
                  className="w-full min-h-[44px] rounded-xl bg-indigo-900 hover:bg-indigo-950 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>الانتقال إلى سجل العمليات</span>
                  <ArrowUpLeft className="w-4 h-4" />
                </button>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleResetForAnother}
                  className="min-h-[42px] rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>تعديل آخر</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[42px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-4">
              {/* Target Student Info (Clean, without 'معاملة موثقة' badge) */}
              <div className="bg-slate-50 px-3.5 py-2.5 rounded-2xl border border-slate-200 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="text-xs font-extrabold text-slate-900 truncate">
                    {student.name}
                  </h4>
                  <span className="text-[11px] text-slate-500 font-medium tabular-nums">
                    الرصيد الحالي: <strong className="text-slate-900 font-mono">{currentStudent.currentPoints}</strong> نقطة
                  </span>
                </div>
              </div>

              {/* Add / Deduct Toggle */}
              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-2xl text-xs font-bold">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    setActionType('add');
                    setValidationError(null);
                  }}
                  className={`min-h-[40px] py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    actionType === 'add'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة نقاط</span>
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    setActionType('deduct');
                    setValidationError(null);
                  }}
                  className={`min-h-[40px] py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    actionType === 'deduct'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Minus className="w-3.5 h-3.5" />
                  <span>خصم نقاط</span>
                </button>
              </div>

              {/* Amount Field */}
              <div>
                <label
                  htmlFor="points-amount-input"
                  className="block text-xs font-bold text-slate-800 mb-1.5"
                >
                  <span>عدد النقاط</span>{' '}
                  <span className="text-rose-600" aria-hidden="true">*</span>
                </label>

                <input
                  id="points-amount-input"
                  ref={amountInputRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  dir="ltr"
                  disabled={isSubmitting}
                  value={amountStr}
                  placeholder="0"
                  onChange={(e) => {
                    const clean = normalizeNumericInput(e.target.value);
                    setAmountStr(clean);
                    setIsCustomAmountMode(
                      clean !== '' && !PRESET_AMOUNTS.some((v) => String(v) === clean)
                    );
                    setValidationError(null);
                  }}
                  className={`w-full px-3.5 py-2.5 min-h-[44px] text-base font-black text-center rounded-xl border tabular-nums font-mono focus:outline-hidden transition-colors ${
                    isNegativeBalance
                      ? 'border-rose-400 bg-rose-50/40 text-rose-800 focus:border-rose-600'
                      : 'border-slate-200 bg-white text-slate-900 focus:border-indigo-600'
                  }`}
                />

                {/* Preset Amount Buttons (Latin digits) + مخصص */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {PRESET_AMOUNTS.map((val) => {
                    const isSelected = isPresetMatched && amountStr === String(val);
                    return (
                      <button
                        type="button"
                        key={val}
                        disabled={isSubmitting}
                        onClick={() => {
                          setAmountStr(String(val));
                          setIsCustomAmountMode(false);
                          setValidationError(null);
                        }}
                        className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-bold border tabular-nums font-mono transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50 border-indigo-400 text-indigo-900'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {formatPointsLabel(val)}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleSelectCustomAmount}
                    className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      isCustomAmountMode || (!isPresetMatched && amountStr !== '')
                        ? 'bg-indigo-50 border-indigo-400 text-indigo-900'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    مخصص
                  </button>
                </div>

                {/* Live Balance Preview */}
                <div
                  aria-live="polite"
                  className={`mt-2.5 px-3 py-2 rounded-xl border text-xs flex items-center justify-between gap-2 flex-wrap ${
                    isNegativeBalance
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <span className="font-bold">الرصيد بعد التعديل:</span>
                  <span className="font-black tabular-nums font-mono" dir="rtl">
                    {currentStudent.currentPoints} ← {resultingBalance}
                  </span>
                  {isNegativeBalance && (
                    <span className="w-full text-[11px] font-bold text-rose-700 flex items-center gap-1 mt-0.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        تحذير: الرصيد الناتج سالب — لا يمكن خصم أكثر من الرصيد المتاح ({currentStudent.currentPoints}).
                      </span>
                    </span>
                  )}
                </div>
              </div>

              {/* Reason Field (Writable input visible to student + quick picks including أخرى) */}
              <div>
                <label
                  htmlFor="points-reason-input"
                  className="block text-xs font-bold text-slate-800 mb-1.5"
                >
                  <span>سبب التعديل</span>{' '}
                  <span className="text-rose-600" aria-hidden="true">*</span>
                </label>

                <input
                  id="points-reason-input"
                  ref={reasonInputRef}
                  type="text"
                  disabled={isSubmitting}
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    setValidationError(null);
                  }}
                  placeholder={
                    actionType === 'add'
                      ? 'اكتب سبب إضافة النقاط (يظهر للطالب)...'
                      : 'اكتب سبب خصم النقاط (يظهر للطالب)...'
                  }
                  maxLength={250}
                  className="w-full px-3 py-2.5 min-h-[42px] text-xs rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-indigo-600"
                />

                {/* Quick Reason Suggestions */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {quickReasons.map((suggestion) => {
                    const active = reason.trim() === suggestion;
                    return (
                      <button
                        type="button"
                        key={suggestion}
                        disabled={isSubmitting}
                        onClick={() => {
                          setReason(suggestion);
                          setValidationError(null);
                          if (suggestion === 'أخرى') {
                            window.setTimeout(() => noteInputRef.current?.focus(), 0);
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                          active
                            ? 'bg-indigo-50 border-indigo-400 text-indigo-900'
                            : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                        }`}
                      >
                        {suggestion}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  يظهر السبب للطالب في سجل نقاطه اليومي.
                </p>
              </div>

              {/* Note Field (Optional, Mandatory if Reason === 'أخرى') */}
              <div>
                <label
                  htmlFor="points-note-input"
                  className="block text-xs font-bold text-slate-800 mb-1.5"
                >
                  <span>ملاحظة</span>{' '}
                  {isOtherReason ? (
                    <span className="text-rose-600" aria-hidden="true">*</span>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-normal">(اختياري)</span>
                  )}
                </label>
                <textarea
                  id="points-note-input"
                  ref={noteInputRef}
                  rows={2}
                  disabled={isSubmitting}
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value);
                    setValidationError(null);
                  }}
                  placeholder={
                    isOtherReason
                      ? 'اكتب تفاصيل السبب والملاحظة (إلزامي عند اختيار أخرى)...'
                      : 'أضف ملاحظة إضافية توضيحية (اختياري)...'
                  }
                  maxLength={220}
                  className={`w-full px-3 py-2 text-xs rounded-xl border bg-white text-slate-900 placeholder:text-slate-400 focus:outline-hidden resize-none ${
                    isOtherReason && !note.trim()
                      ? 'border-amber-300 focus:border-indigo-600'
                      : 'border-slate-200 focus:border-indigo-600'
                  }`}
                />
              </div>

              {/* Validation Error */}
              {validationError && (
                <div
                  role="alert"
                  className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* Audit Trail Notice */}
              <div className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>سيُسجَّل هذا التعديل في سجل العمليات باسمك</span>
              </div>
            </div>

            {/* Sticky Bottom Submit Footer (Mobile Bottom Sheet Fixed CTA + Desktop Footer) */}
            <div className="shrink-0 border-t border-slate-200 bg-white px-4 sm:px-5 py-3 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
              <button
                type="submit"
                disabled={isSubmitDisabled}
                className={`w-full min-h-[46px] rounded-xl text-white font-extrabold text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed active:scale-[0.99] ${
                  actionType === 'add'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جارٍ الاعتماد...</span>
                  </>
                ) : (
                  <span className="tabular-nums">
                    {actionType === 'add' ? 'إضافة' : 'خصم'} {formatPointsLabel(parsedAmount)}
                  </span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Explicit Confirmation Modal for Deductions or Additions > 100 */}
      {pendingConfirm && (
        <ConfirmationModal
          isOpen={!!pendingConfirm}
          onClose={() => {
            if (!isSubmitting) setPendingConfirm(null);
          }}
          onConfirm={() => executeAdjustment(pendingConfirm)}
          loading={isSubmitting}
          title={
            pendingConfirm.signedAmount < 0
              ? 'تأكيد خصم النقاط'
              : 'تأكيد إضافة مبلغ كبير'
          }
          message={`${
            pendingConfirm.signedAmount < 0
              ? `سيُخصم ${formatPointsLabel(pendingConfirm.numericAmount)} من ${student.name}، هل أنت متأكد؟`
              : `سيُضاف ${formatPointsLabel(pendingConfirm.numericAmount)} إلى ${student.name}، هل أنت متأكد؟`
          }\n\nالرصيد بعد التعديل: ${currentStudent.currentPoints} ← ${Math.max(0, currentStudent.currentPoints + pendingConfirm.signedAmount)}\nالسبب: ${pendingConfirm.rawReason}${pendingConfirm.noteText ? `\nملاحظة: ${pendingConfirm.noteText}` : ''}`}
          confirmText={
            pendingConfirm.signedAmount < 0
              ? `تأكيد خصم ${formatPointsLabel(pendingConfirm.numericAmount)}`
              : `تأكيد إضافة ${formatPointsLabel(pendingConfirm.numericAmount)}`
          }
          cancelText="مراجعة"
          type={pendingConfirm.signedAmount < 0 ? 'danger' : 'primary'}
          zIndexClass="z-[70]"
        />
      )}
    </div>
  );
};
