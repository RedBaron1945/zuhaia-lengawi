import React, { useState } from 'react';
import { Student } from '../../types';
import { repository } from '../../services/storageService';
import { useToast } from '../../context/ToastContext';
import { Check, X, Clock, Calendar, CheckCircle, AlertTriangle } from 'lucide-react';

interface AttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
  circleId: string;
  circleName: string;
  teacherName: string;
  onSuccess: () => void;
}

export const AttendanceModal: React.FC<AttendanceModalProps> = ({
  isOpen,
  onClose,
  student,
  circleId,
  circleName,
  teacherName,
  onSuccess,
}) => {
  const [session, setSession] = useState<'عصر' | 'مغرب' | 'فجر'>('عصر');
  const today = new Date().toISOString().split('T')[0];
  const { showToast, celebratePoints } = useToast();
  const rules = repository.getPointRules();

  if (!isOpen) return null;

  const handleRecord = (status: 'present' | 'absent' | 'excused') => {
    const res = repository.recordAttendance({
      studentId: student.id,
      circleId,
      status,
      date: today,
      session,
      teacherName,
    });

    if (res.success) {
      if (status === 'present' && !res.duplicate) {
        celebratePoints(res.pointsAwarded || rules.attendance || 2, `حضور ${student.name}`);
      } else {
        showToast(res.message, res.duplicate ? 'info' : 'success');
      }
      onSuccess();
      onClose();
    } else {
      showToast(res.message, 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-right animate-scale-up">
        {/* Header */}
        <div className="p-4 bg-teal-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold">
              ✓
            </span>
            <div>
              <h3 className="text-sm font-extrabold">تسجيل الحضور والغياب</h3>
              <span className="text-[11px] text-teal-200">{circleName}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/20 text-white/80"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Student Info */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-extrabold text-slate-900">{student.name}</h4>
              <span className="text-xs text-slate-500">الرصيد: ⭐ {student.currentPoints} نقطة</span>
            </div>
            <div className="text-left text-[11px] text-slate-500">
              <span className="block font-medium">{today}</span>
              <span className="text-teal-700 font-bold">{student.attendanceRate}% حضور</span>
            </div>
          </div>

          {/* Session Picker */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">فترة الحلقة</label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
              {(['عصر', 'مغرب', 'فجر'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSession(s)}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-colors ${
                    session === s ? 'bg-white text-teal-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  حلقة ال{s}
                </button>
              ))}
            </div>
          </div>

          <div className="text-[11px] text-slate-500 bg-amber-50 border border-amber-200/60 p-2.5 rounded-xl">
            💡 تسجيل الحضور يمنح الطالب تلقائياً <strong>+{rules.attendance} نقاط</strong> مع حماية تلقائية تمنع التكرار في نفس اليوم.
          </div>

          {/* Big Action Buttons - Mobile friendly */}
          <div className="space-y-2 pt-1">
            <button
              onClick={() => handleRecord('present')}
              className="w-full min-h-[48px] rounded-2xl bg-teal-700 hover:bg-teal-800 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md shadow-teal-700/20 active:scale-[0.98] transition-all"
            >
              <span className="text-lg">🟢</span>
              <span>حاضر (+{rules.attendance} نقاط)</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleRecord('excused')}
                className="min-h-[44px] rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all"
              >
                <span>🟡</span>
                <span>معتذر (عذر مقبول)</span>
              </button>

              <button
                onClick={() => handleRecord('absent')}
                className="min-h-[44px] rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all"
              >
                <span>🔴</span>
                <span>غائب (بدون عذر)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
