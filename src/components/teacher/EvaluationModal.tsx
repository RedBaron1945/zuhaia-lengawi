import React, { useState } from 'react';
import { Student } from '../../types';
import { repository } from '../../services/storageService';
import { useToast } from '../../context/ToastContext';
import { X, Award, BookOpen, RotateCcw, ThumbsUp } from 'lucide-react';

interface EvaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
  circleId: string;
  teacherName: string;
  onSuccess: () => void;
}

export const EvaluationModal: React.FC<EvaluationModalProps> = ({
  isOpen,
  onClose,
  student,
  circleId,
  teacherName,
  onSuccess,
}) => {
  const rules = repository.getPointRules();
  const [memorization, setMemorization] = useState<'full' | 'partial' | 'none'>('full');
  const [revision, setRevision] = useState<'full' | 'partial' | 'none'>('full');
  const [behavior, setBehavior] = useState<'excellent' | 'good' | 'average'>('excellent');
  const [notes, setNotes] = useState('');
  const { showToast, celebratePoints } = useToast();

  if (!isOpen) return null;

  // Calculate projected points dynamically from rules
  const memPts = (memorization === 'full' ? rules.memorizationFull : memorization === 'partial' ? rules.memorizationPartial : 0) || 0;
  const revPts = (revision === 'full' ? rules.revisionFull : revision === 'partial' ? rules.revisionPartial : 0) || 0;
  const behPts = (behavior === 'excellent' ? rules.excellenceBonus : 0) || 0;
  const totalEarned = memPts + revPts + behPts;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const res = repository.recordEvaluation({
      studentId: student.id,
      circleId,
      date: new Date().toISOString().split('T')[0],
      memorizationScore: memorization,
      revisionScore: revision,
      behaviorScore: behavior,
      notes: notes.trim() || undefined,
      teacherName,
    });

    if (res.success) {
      celebratePoints(totalEarned, `تقييم الطالب ${student.name}`);
      onSuccess();
      onClose();
    } else {
      showToast(res.message, 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-right animate-scale-up max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 bg-teal-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold">
              ★
            </span>
            <div>
              <h3 className="text-sm font-extrabold">تقييم الحفظ والمراجعة</h3>
              <span className="text-[11px] text-teal-200">{student.name}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/20 text-white/80" aria-label="إغلاق">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {/* Live Points Counter preview */}
          <div className="bg-gradient-to-r from-amber-50 to-teal-50 p-3.5 rounded-2xl border border-amber-200/80 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">مجموع النقاط المستحقة:</span>
            <span className="text-lg font-black text-teal-900 tabular-nums">
              +{totalEarned} نقطة
            </span>
          </div>

          {/* Memorization */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-teal-700" />
              تسميع الحفظ الجديد
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setMemorization('full')}
                className={`py-2 px-1 rounded-lg transition-colors ${
                  memorization === 'full'
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                كامل (+{rules.memorizationFull})
              </button>
              <button
                type="button"
                onClick={() => setMemorization('partial')}
                className={`py-2 px-1 rounded-lg transition-colors ${
                  memorization === 'partial'
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                جزئي (+{rules.memorizationPartial})
              </button>
              <button
                type="button"
                onClick={() => setMemorization('none')}
                className={`py-2 px-1 rounded-lg transition-colors ${
                  memorization === 'none'
                    ? 'bg-rose-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                لم ينجز (0)
              </button>
            </div>
          </div>

          {/* Revision */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
              المراجعة والتثبيت
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setRevision('full')}
                className={`py-2 px-1 rounded-lg transition-colors ${
                  revision === 'full'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                كاملة (+{rules.revisionFull})
              </button>
              <button
                type="button"
                onClick={() => setRevision('partial')}
                className={`py-2 px-1 rounded-lg transition-colors ${
                  revision === 'partial'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                جزئية (+{rules.revisionPartial})
              </button>
              <button
                type="button"
                onClick={() => setRevision('none')}
                className={`py-2 px-1 rounded-lg transition-colors ${
                  revision === 'none'
                    ? 'bg-rose-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                لم ينجز (0)
              </button>
            </div>
          </div>

          {/* Behavior / Excellence */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
              <ThumbsUp className="w-3.5 h-3.5 text-emerald-600" />
              السمت القرآني والأدب
            </label>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setBehavior('excellent')}
                className={`py-2 px-2 rounded-lg transition-colors ${
                  behavior === 'excellent'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                ممتاز (+{rules.excellenceBonus}ن)
              </button>
              <button
                type="button"
                onClick={() => setBehavior('good')}
                className={`py-2 px-2 rounded-lg transition-colors ${
                  behavior === 'good' ? 'bg-slate-700 text-white shadow-xs' : 'text-slate-600'
                }`}
              >
                اعتيادي (0)
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات المعلم (اختياري)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: أتقن مخارج الحروف، يحتاج تثبيت الآية 12"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-teal-600"
            />
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full min-h-[48px] rounded-2xl bg-teal-700 hover:bg-teal-800 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md shadow-teal-700/20 active:scale-[0.98] transition-all"
            >
              <span>اعتماد التقييم وإضافة النقاط</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
