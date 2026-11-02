import React from 'react';
import { Circle, Student } from '../../types';
import { BookOpen, Users, Check, X, Sparkles, MapPin, Clock } from 'lucide-react';

interface TeacherSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  circles: Circle[];
  selectedCircleId: string;
  onSelectCircle: (circleId: string) => void;
  allStudents: Student[];
}

export const TeacherSelectorModal: React.FC<TeacherSelectorModalProps> = ({
  isOpen,
  onClose,
  circles,
  selectedCircleId,
  onSelectCircle,
  allStudents,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative bg-white rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 text-right z-10 overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-teal-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="text-base font-black">
                اختر المعلم والحلقة القرآنية
              </h3>
              <p className="text-xs text-teal-200 mt-0.5 font-medium">
                9 حلقات معتمدة بمسجد زهية لنجاوي
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 9 Teachers Grid / List */}
        <div className="p-3 sm:p-4 overflow-y-auto space-y-2 flex-1 divide-y divide-slate-100">
          {circles.map((c, idx) => {
            const isSelected = c.id === selectedCircleId;
            const students = allStudents.filter(
              (s) => s.circleId === c.id && s.active
            );

            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onSelectCircle(c.id);
                  onClose();
                }}
                className={`w-full p-3 sm:p-3.5 rounded-2xl text-right transition-all flex items-start justify-between gap-3 ${
                  isSelected
                    ? 'bg-teal-50 border-2 border-teal-700 shadow-sm'
                    : 'hover:bg-slate-50 border border-transparent hover:border-slate-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Number Badge */}
                  <div
                    className={`w-10 h-10 rounded-2xl font-black text-sm flex items-center justify-center shrink-0 mt-0.5 ${
                      isSelected
                        ? 'bg-teal-800 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {idx + 1}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm sm:text-base font-black text-slate-900">
                        {c.teacherName}
                      </h4>
                      {isSelected && (
                        <span className="text-[10px] font-black text-teal-900 bg-amber-200 px-2 py-0.5 rounded-full">
                          الحلقة النشطة
                        </span>
                      )}
                    </div>

                    <div className="text-xs font-bold text-teal-800 mt-0.5">
                      {c.name}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {c.schedule}
                      </span>
                      {c.room && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {c.room.replace('جامع زهية لنجاوي - ', '')}
                        </span>
                      )}
                    </div>

                    {/* Student Names Preview */}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <span className="text-[10px] text-slate-400 font-bold">
                        الطلاب:
                      </span>
                      {students.map((st) => (
                        <span
                          key={st.id}
                          className="text-[10px] font-medium bg-white border border-slate-200/90 text-slate-700 px-1.5 py-0.5 rounded-md"
                        >
                          {st.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="text-left shrink-0">
                  <span className="text-xs font-black text-teal-900 bg-teal-100/80 px-2.5 py-1 rounded-xl block tabular-nums">
                    {students.length} طلاب
                  </span>
                  {isSelected && (
                    <div className="w-6 h-6 rounded-full bg-teal-800 text-white flex items-center justify-center mt-2 mr-auto">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-500">
            انقر على أي معلم للانتقال الفوري لواجهته الخاصة ورصد تقييم طلابه
          </p>
        </div>
      </div>
    </div>
  );
};
