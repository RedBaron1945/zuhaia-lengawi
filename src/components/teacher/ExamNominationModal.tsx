import React, { useState, useMemo } from 'react';
import { Student, Circle, EXAM_BRANCHES, getBranchByPartsCount } from '../../types';
import { repository } from '../../services/storageService';
import { useToast } from '../../context/ToastContext';
import {
  X,
  Award,
  Search,
  Check,
  Send,
  BookOpen,
  ChevronDown,
  Layers,
} from 'lucide-react';

interface ExamNominationModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  circle: Circle;
}

interface StudentNominationDraft {
  selected: boolean;
  partsCount: number;
  notes: string;
}

export const ExamNominationModal: React.FC<ExamNominationModalProps> = ({
  isOpen,
  onClose,
  students,
  circle,
}) => {
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [drafts, setDrafts] = useState<Record<string, StudentNominationDraft>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bulkBranchCount, setBulkBranchCount] = useState<number>(1);

  const activeStudents = useMemo(() => (students || []).filter((s) => s.active), [students]);

  const filteredStudents = useMemo(() => {
    if (!search.trim()) return activeStudents;
    return activeStudents.filter((s) => s.name.includes(search.trim()));
  }, [activeStudents, search]);

  if (!isOpen) return null;

  const handleToggleSelect = (studentId: string) => {
    setDrafts((prev) => {
      const current = prev[studentId] || {
        selected: false,
        partsCount: 1,
        notes: '',
      };
      return {
        ...prev,
        [studentId]: {
          ...current,
          selected: !current.selected,
          partsCount: current.partsCount || 1,
        },
      };
    });
  };

  const handleSelectAll = () => {
    setDrafts((prev) => {
      const next = { ...prev };
      filteredStudents.forEach((s) => {
        next[s.id] = {
          selected: true,
          partsCount: prev[s.id]?.partsCount || 1,
          notes: prev[s.id]?.notes || '',
        };
      });
      return next;
    });
  };

  const handleDeselectAll = () => {
    setDrafts((prev) => {
      const next = { ...prev };
      filteredStudents.forEach((s) => {
        if (next[s.id]) {
          next[s.id] = { ...next[s.id], selected: false };
        }
      });
      return next;
    });
  };

  const handleSetPartsCount = (studentId: string, partsCount: number) => {
    setDrafts((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { selected: true, notes: '' }),
        selected: true,
        partsCount: partsCount,
      },
    }));
  };

  const handleSetNotes = (studentId: string, notes: string) => {
    setDrafts((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { selected: true, partsCount: 1 }),
        notes: notes,
      },
    }));
  };

  // Apply a unified branch to all currently selected students
  const handleApplyBulkBranch = (partsCount: number) => {
    setBulkBranchCount(partsCount);
    setDrafts((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((sId) => {
        if (next[sId]?.selected) {
          next[sId] = {
            ...next[sId],
            partsCount: partsCount,
          };
        }
      });
      return next;
    });
    const b = getBranchByPartsCount(partsCount);
    showToast(`تم تعيين (${b.title}) لجميع الطلاب المحددين ✓`, 'info');
  };

  // Selected students list for submission
  const selectedStudents = activeStudents.filter((s) => drafts[s.id]?.selected);

  const handleSubmit = () => {
    if (selectedStudents.length === 0) {
      showToast('يرجى تحديد طالب واحد على الأقل للترشيح', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const nominations = selectedStudents.map((s) => {
        const d = drafts[s.id];
        const count = d?.partsCount && d.partsCount > 0 ? d.partsCount : 1;
        const branch = getBranchByPartsCount(count);

        return {
          studentId: s.id,
          studentName: s.name,
          circleId: circle.id,
          circleName: circle.name,
          teacherId: circle.teacherId,
          teacherName: circle.teacherName,
          partsCount: branch.partsCount,
          partsDescription: branch.title, // 'الفرع الأول - جزء واحد'
          notes: d?.notes?.trim() || undefined,
        };
      });

      const res = repository.createExamNominations(nominations);

      if (res.success) {
        showToast(
          `تم إرسال ترشيح (${selectedStudents.length}) ${
            selectedStudents.length === 1 ? 'طالب' : 'طلاب'
          } للاختبار بنجاح إلى المشرف العام 🎉`,
          'success'
        );
        onClose();
      } else {
        showToast(res.message, 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-fade-in select-none">
      <div className="bg-white rounded-3xl max-w-xl w-full max-h-[92vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden text-right">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3 bg-gradient-to-l from-amber-500/10 via-amber-50/30 to-white">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 flex items-center justify-center font-black text-lg shadow-sm">
              <Award className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900">
                ترشيح للاختبار القرآني
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                {circle.name} · المعلم: {circle.teacherName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Bulk Action Bar */}
        <div className="p-3 border-b border-slate-100 space-y-2 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث باسم الطالب..."
                className="w-full pr-8 pl-3 py-1.5 text-xs rounded-xl bg-white border border-slate-200 focus:outline-hidden focus:border-amber-500"
              />
            </div>

            <button
              type="button"
              onClick={handleSelectAll}
              className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer transition-colors shrink-0 shadow-2xs"
            >
              تحديد الكل
            </button>
            <button
              type="button"
              onClick={handleDeselectAll}
              className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer transition-colors shrink-0 shadow-2xs"
            >
              إلغاء التحديد
            </button>
          </div>

          {/* Bulk Branch Selection Toolbar (Shown when multiple students selected) */}
          {selectedStudents.length > 1 && (
            <div className="bg-amber-100/70 border border-amber-300/80 rounded-xl p-2 flex items-center justify-between gap-2 text-xs animate-fade-in">
              <span className="text-[11px] font-black text-amber-950 flex items-center gap-1 shrink-0">
                <Layers className="w-3.5 h-3.5 text-amber-800" />
                <span>تعيين فرع موحد للمحددين ({selectedStudents.length}):</span>
              </span>
              <div className="relative flex-1 max-w-[220px]">
                <select
                  value={bulkBranchCount}
                  onChange={(e) => handleApplyBulkBranch(parseInt(e.target.value, 10))}
                  className="w-full pl-7 pr-2.5 py-1 text-xs font-black rounded-lg bg-white border border-amber-300 text-amber-950 focus:outline-hidden focus:border-amber-600 cursor-pointer shadow-2xs"
                >
                  {EXAM_BRANCHES.map((b) => (
                    <option key={b.partsCount} value={b.partsCount}>
                      {b.title}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-amber-700 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          )}
        </div>

        {/* Students List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
          {filteredStudents.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400 font-medium">
              لا يوجد طلاب يطابقون البحث.
            </div>
          ) : (
            filteredStudents.map((student) => {
              const draft = drafts[student.id] || {
                selected: false,
                partsCount: 1,
                notes: '',
              };
              const isSelected = draft.selected;
              const currentBranch = getBranchByPartsCount(draft.partsCount || 1);

              return (
                <div
                  key={student.id}
                  className={`rounded-2xl border transition-all p-3 space-y-2.5 ${
                    isSelected
                      ? 'bg-amber-50/30 border-amber-300 shadow-2xs ring-1 ring-amber-300/50'
                      : 'bg-white border-slate-200/90 hover:border-slate-300'
                  }`}
                >
                  {/* Student row selection toggle */}
                  <div
                    onClick={() => handleToggleSelect(student.id)}
                    className="flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Checkbox */}
                      <div
                        className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all shrink-0 ${
                          isSelected
                            ? 'bg-amber-500 border-amber-600 text-slate-950'
                            : 'bg-white border-slate-300 text-transparent'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>

                      <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-black text-slate-900 truncate">
                          {student.name}
                        </h4>
                      </div>
                    </div>

                    <div className="shrink-0 text-left">
                      {isSelected ? (
                        <span className="text-[11px] font-black text-amber-950 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-lg shadow-2xs">
                          {currentBranch.title}
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-slate-400">
                          انقر للترشيح
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expanded Branch Selector & Notes if Student is Selected */}
                  {isSelected && (
                    <div className="pt-2.5 border-t border-amber-200/80 space-y-3 animate-fade-in text-xs">
                      {/* القائمة المنسدلة للفروع العشرة المقررة */}
                      <div>
                        <label className="text-xs font-black text-slate-800 mb-1.5 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-amber-700" />
                            <span>فرع الاختبار القرآني:</span>
                          </span>
                          <span className="text-[11px] text-amber-800 font-bold bg-amber-100/70 px-2 py-0.2 rounded-md">
                            10 فروع معتمدة
                          </span>
                        </label>

                        {/* Dropdown with all 10 branches */}
                        <div className="relative">
                          <select
                            value={draft.partsCount || 1}
                            onChange={(e) =>
                              handleSetPartsCount(student.id, parseInt(e.target.value, 10))
                            }
                            className="w-full pr-3.5 pl-8 py-2.5 text-xs sm:text-sm font-black rounded-xl bg-white border-2 border-amber-300 text-slate-900 focus:outline-hidden focus:border-amber-600 focus:ring-2 focus:ring-amber-200 cursor-pointer shadow-2xs transition-all appearance-none"
                          >
                            {EXAM_BRANCHES.map((b) => (
                              <option key={b.partsCount} value={b.partsCount}>
                                {b.title}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="w-4 h-4 text-amber-700 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </div>

                      {/* خانة ملاحظات اختيارية */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          ملاحظات إضافية (اختياري):
                        </label>
                        <input
                          type="text"
                          value={draft.notes}
                          onChange={(e) => handleSetNotes(student.id, e.target.value)}
                          placeholder="ملاحظات للمعلم أو المشرف (مثال: محدد من سورة البقرة إلى النساء)..."
                          className="w-full px-3 py-2 text-xs rounded-xl bg-white border border-slate-300 focus:outline-hidden focus:border-amber-500 focus:ring-2 focus:ring-amber-200 text-slate-800 shadow-2xs"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 sm:p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-2.5">
          <div className="text-xs">
            <span className="text-slate-500 font-bold block">إجمالي المرشحين:</span>
            <span className="text-sm font-black text-amber-950 tabular-nums">
              {selectedStudents.length} طلاب
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 cursor-pointer transition-colors"
            >
              إلغاء
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={selectedStudents.length === 0 || isSubmitting}
              className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer ${
                selectedStudents.length === 0 || isSubmitting
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-amber-500 hover:bg-amber-600 text-slate-950 active:scale-95'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>إرسال الترشيح ({selectedStudents.length})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
