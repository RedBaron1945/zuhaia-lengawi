import React, { useState } from 'react';
import { Student, User } from '../../types';
import { repository } from '../../services/storageService';
import { useToast } from '../../context/ToastContext';
import { X, Award, Plus, Minus, AlertCircle } from 'lucide-react';

interface PointsAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
  adminUser: User;
  onSuccess: () => void;
}

export const PointsAdjustmentModal: React.FC<PointsAdjustmentModalProps> = ({
  isOpen,
  onClose,
  student,
  adminUser,
  onSuccess,
}) => {
  const [actionType, setActionType] = useState<'add' | 'deduct'>('add');
  const [amount, setAmount] = useState<number>(50);
  const [reason, setReason] = useState<string>('مكافأة إدارية لتفوق متميز');
  const [customReason, setCustomReason] = useState<string>('');
  const { showToast, celebratePoints } = useToast();

  if (!isOpen) return null;

  const quickReasons =
    actionType === 'add'
      ? ['مكافأة إدارية لتفوق متميز', 'مكافأة مسابقة حفظ سريعة', 'مكافأة انضباط وحضور تام', 'تعويض عن خطأ تقني سابق']
      : ['تصحيح إداري لنقاط مسجلة بالخطأ', 'خصم بسبب مخالفة انضباطية', 'تعديل رصيد مكرر'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const finalReason = customReason.trim() ? customReason.trim() : reason;
    if (!finalReason) {
      showToast('يجب إدخال سبب التعديل الإداري (إلزامي للرقابة والتوثيق).', 'error');
      return;
    }

    if (amount <= 0) {
      showToast('يجب تحديد عدد نقاط أكبر من صفر.', 'error');
      return;
    }

    const finalAmount = actionType === 'add' ? amount : -amount;

    // Requirement 20: IT cannot edit the final balance directly.
    // It creates an atomic PointTransaction with actor and mandatory reason!
    const result = repository.addPointTransaction({
      studentId: student.id,
      amount: finalAmount,
      type: actionType === 'add' ? 'admin_bonus' : 'admin_correction',
      reason: finalReason,
      createdBy: adminUser.name,
      createdByRole: 'admin',
    });

    if (result.success) {
      if (actionType === 'add') {
        celebratePoints(amount, `إضافة إدارية للطالب ${student.name}`);
      } else {
        showToast(`تم خصم ${amount} نقطة بنجاح مع توثيق العملية في السجل الإداري.`, 'info');
      }
      onSuccess();
      onClose();
    } else {
      showToast(result.message, 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-right animate-scale-up">
        {/* Header */}
        <div className="p-4 bg-indigo-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold">
              ⚙️
            </span>
            <div>
              <h3 className="text-sm font-extrabold">تعديل النقاط الإداري</h3>
              <span className="text-[11px] text-indigo-200">الرقابة والعمليات - IT</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/20 text-white/80" aria-label="إغلاق">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Target Student Info */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-extrabold text-slate-900">{student.name}</h4>
              <span className="text-[11px] text-slate-500">الرصيد الحالي: {student.currentPoints} نقطة</span>
            </div>
            <span className="text-[10px] font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
              معاملة موثقة
            </span>
          </div>

          {/* Add / Deduct toggle */}
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setActionType('add');
                setReason('مكافأة إدارية لتفوق متميز');
              }}
              className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                actionType === 'add' ? 'bg-teal-700 text-white shadow-xs' : 'text-slate-600'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة نقاط (+)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActionType('deduct');
                setReason('تصحيح إداري لنقاط مسجلة بالخطأ');
              }}
              className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                actionType === 'deduct' ? 'bg-rose-700 text-white shadow-xs' : 'text-slate-600'
              }`}
            >
              <Minus className="w-3.5 h-3.5" />
              <span>خصم نقاط (-)</span>
            </button>
          </div>

          {/* Points Amount input & Quick Chips */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              عدد النقاط ({actionType === 'add' ? 'الإضافة' : 'الخصم'}):
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="500"
                value={amount}
                onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 0))}
                className="w-full px-3 py-2 text-sm font-black text-center rounded-xl border border-slate-200 tabular-nums focus:outline-hidden focus:border-indigo-600"
              />
            </div>
            <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-1 no-scrollbar">
              {[10, 20, 50, 100].map((val) => (
                <button
                  type="button"
                  key={val}
                  onClick={() => setAmount(val)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                    amount === val ? 'bg-indigo-50 border-indigo-300 text-indigo-900' : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  {val} ن
                </button>
              ))}
            </div>
          </div>

          {/* Reason selection (Mandatory) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span>سبب التعديل (إلزامي للتوثيق):</span>
              <span className="text-[10px] text-rose-600">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white mb-2"
            >
              {quickReasons.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
              <option value="custom">سبب مخصص آخر...</option>
            </select>

            {reason === 'custom' && (
              <input
                type="text"
                placeholder="اكتب سبب التعديل بالتفصيل..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-indigo-600"
              />
            )}
          </div>

          <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-start gap-1.5">
            <AlertCircle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.2" />
            <span>
              لا يتم تغيير الرصيد مباشرة، بل يتم توليد عملية Transaction مسجلة باسمك في سجل الرقابة والعمليات.
            </span>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            className="w-full min-h-[44px] rounded-xl bg-indigo-900 hover:bg-indigo-950 text-white font-bold text-xs shadow-md transition-all active:scale-[0.98]"
          >
            اعتماد العملية وتوثيقها
          </button>
        </form>
      </div>
    </div>
  );
};
