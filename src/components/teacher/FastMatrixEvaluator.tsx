import React, { useState, useEffect, useMemo } from 'react';
import { Student, EvaluationRecord, AttendanceType } from '../../types';
import { repository } from '../../services/storageService';
import { useToast } from '../../context/ToastContext';
import {
  Save,
  Check,
  Search,
  Sparkles,
  RotateCcw,
} from 'lucide-react';

export type CriterionKey =
  | 'attendance'
  | 'discipline'
  | 'uniform'
  | 'memorization'
  | 'revision'
  | 'family_meeting';

interface CriterionOption {
  label: string;
  value: any;
  tier: 'high' | 'medium' | 'low';
}

interface CriterionConfig {
  key: CriterionKey;
  label: string;
  highestLabel: string;
  highestValue: any;
  options: CriterionOption[];
}

const CRITERIA_CONFIG: CriterionConfig[] = [
  {
    key: 'attendance',
    label: 'حضور',
    highestLabel: 'مبكر (+2)',
    highestValue: 'early',
    options: [
      { label: 'مبكر +2', value: 'early', tier: 'high' },
      { label: 'متأخر +1', value: 'late', tier: 'medium' },
      { label: 'غائب 0', value: 'absent', tier: 'low' },
    ],
  },
  {
    key: 'discipline',
    label: 'انضباط',
    highestLabel: 'منضبط (+2)',
    highestValue: 2,
    options: [
      { label: 'منضبط +2', value: 2, tier: 'high' },
      { label: 'وسط +1', value: 1, tier: 'medium' },
      { label: 'مخالف 0', value: 0, tier: 'low' },
    ],
  },
  {
    key: 'uniform',
    label: 'زي',
    highestLabel: 'ملتزم (+2)',
    highestValue: 2,
    options: [
      { label: 'ملتزم +2', value: 2, tier: 'high' },
      { label: 'تنبيه +1', value: 1, tier: 'medium' },
      { label: 'مخالف 0', value: 0, tier: 'low' },
    ],
  },
  {
    key: 'memorization',
    label: 'حفظ',
    highestLabel: 'متقن (+2)',
    highestValue: 2,
    options: [
      { label: 'متقن +2', value: 2, tier: 'high' },
      { label: 'جزئي +1', value: 1, tier: 'medium' },
      { label: 'لم يحفظ 0', value: 0, tier: 'low' },
    ],
  },
  {
    key: 'revision',
    label: 'مراجعة',
    highestLabel: 'متقنة (+2)',
    highestValue: 2,
    options: [
      { label: 'متقنة +2', value: 2, tier: 'high' },
      { label: 'جزئية +1', value: 1, tier: 'medium' },
      { label: 'لم يراجع 0', value: 0, tier: 'low' },
    ],
  },
  {
    key: 'family_meeting',
    label: 'اجتماع أسري',
    highestLabel: 'حاضر (+2)',
    highestValue: 2,
    options: [
      { label: 'حاضر +2', value: 2, tier: 'high' },
      { label: 'بعذر +1', value: 1, tier: 'medium' },
      { label: 'غائب 0', value: 0, tier: 'low' },
    ],
  },
];

interface FastMatrixEvaluatorProps {
  students: Student[];
  circleId: string;
  circleName?: string;
  selectedDate: string;
  dayName: string;
  teacherName: string;
  teacherId?: string;
  existingEvaluations: EvaluationRecord[];
  onEvaluationsSaved: () => void;
  hideOuterHeader?: boolean;
}

interface RowState {
  attendance: AttendanceType;
  disciplineScore: number;
  uniformScore: number;
  memorizationScore: number;
  revisionScore: number;
  familyMeetingScore: number;
  notes?: string;
  isSaved: boolean;
}

export const FastMatrixEvaluator: React.FC<FastMatrixEvaluatorProps> = ({
  students,
  circleId,
  circleName,
  selectedDate,
  dayName,
  teacherName,
  teacherId,
  existingEvaluations,
  onEvaluationsSaved,
  hideOuterHeader = false,
}) => {
  const { showToast, celebratePoints } = useToast();

  // Active Criterion Tab
  const [activeCriterion, setActiveCriterion] = useState<CriterionKey>('attendance');

  // Search filter query
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Row states
  const [rows, setRows] = useState<Record<string, RowState>>(() => {
    const initial: Record<string, RowState> = {};
    students.forEach((s) => {
      const existing = existingEvaluations.find((e) => e.studentId === s.id);
      if (existing) {
        initial[s.id] = {
          attendance: existing.attendance || 'early',
          disciplineScore: existing.disciplineScore ?? 2,
          uniformScore: existing.uniformScore ?? 2,
          memorizationScore: existing.memorizationScore ?? 2,
          revisionScore: existing.revisionScore ?? 2,
          familyMeetingScore: existing.familyMeetingScore ?? 2,
          notes: existing.notes || '',
          isSaved: true,
        };
      } else {
        initial[s.id] = {
          attendance: 'early',
          disciplineScore: 2,
          uniformScore: 2,
          memorizationScore: 2,
          revisionScore: 2,
          familyMeetingScore: 2,
          notes: '',
          isSaved: false,
        };
      }
    });
    return initial;
  });

  // Re-sync when selectedDate or existingEvaluations change
  useEffect(() => {
    const updated: Record<string, RowState> = {};
    students.forEach((s) => {
      const existing = existingEvaluations.find((e) => e.studentId === s.id);
      if (existing) {
        updated[s.id] = {
          attendance: existing.attendance || 'early',
          disciplineScore: existing.disciplineScore ?? 2,
          uniformScore: existing.uniformScore ?? 2,
          memorizationScore: existing.memorizationScore ?? 2,
          revisionScore: existing.revisionScore ?? 2,
          familyMeetingScore: existing.familyMeetingScore ?? 2,
          notes: existing.notes || '',
          isSaved: true,
        };
      } else {
        updated[s.id] = {
          attendance: 'early',
          disciplineScore: 2,
          uniformScore: 2,
          memorizationScore: 2,
          revisionScore: 2,
          familyMeetingScore: 2,
          notes: '',
          isSaved: false,
        };
      }
    });
    setRows(updated);
  }, [selectedDate, existingEvaluations, students]);

  // Active Criterion Configuration
  const currentCriterionConfig = useMemo(() => {
    return (
      CRITERIA_CONFIG.find((c) => c.key === activeCriterion) || CRITERIA_CONFIG[0]
    );
  }, [activeCriterion]);

  // Filter students by search
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase().trim();
    return students.filter((s) => s.name.toLowerCase().includes(q));
  }, [students, searchQuery]);

  // Progress metrics
  const savedCount = useMemo(() => {
    return students.filter((s) => rows[s.id]?.isSaved).length;
  }, [students, rows]);

  const totalCount = students.length;
  const progressPercent = totalCount > 0 ? Math.round((savedCount / totalCount) * 100) : 0;

  // Row updates
  const setStudentCriterionValue = (
    studentId: string,
    criterion: CriterionKey,
    val: any
  ) => {
    setRows((prev) => {
      const current = prev[studentId] || {
        attendance: 'early',
        disciplineScore: 2,
        uniformScore: 2,
        memorizationScore: 2,
        revisionScore: 2,
        familyMeetingScore: 2,
        isSaved: false,
      };

      const nextRow = { ...current, isSaved: false };
      switch (criterion) {
        case 'attendance':
          nextRow.attendance = val;
          break;
        case 'discipline':
          nextRow.disciplineScore = val;
          break;
        case 'uniform':
          nextRow.uniformScore = val;
          break;
        case 'memorization':
          nextRow.memorizationScore = val;
          break;
        case 'revision':
          nextRow.revisionScore = val;
          break;
        case 'family_meeting':
          nextRow.familyMeetingScore = val;
          break;
      }

      return {
        ...prev,
        [studentId]: nextRow,
      };
    });
  };

  const getStudentCriterionValue = (row: RowState, criterion: CriterionKey) => {
    switch (criterion) {
      case 'attendance':
        return row.attendance;
      case 'discipline':
        return row.disciplineScore;
      case 'uniform':
        return row.uniformScore;
      case 'memorization':
        return row.memorizationScore;
      case 'revision':
        return row.revisionScore;
      case 'family_meeting':
        return row.familyMeetingScore;
      default:
        return undefined;
    }
  };

  const calculateTotal = (row: RowState): number => {
    const attPts = row.attendance === 'early' ? 2 : row.attendance === 'late' ? 1 : 0;
    return (
      attPts +
      row.disciplineScore +
      row.uniformScore +
      row.memorizationScore +
      row.revisionScore
    );
  };

  // Set all students to highest value for active criterion
  const handleSetAllHighest = () => {
    const highestVal = currentCriterionConfig.highestValue;
    setRows((prev) => {
      const next = { ...prev };
      students.forEach((s) => {
        const current = next[s.id] || {
          attendance: 'early',
          disciplineScore: 2,
          uniformScore: 2,
          memorizationScore: 2,
          revisionScore: 2,
          familyMeetingScore: 2,
          isSaved: false,
        };
        const nextRow = { ...current, isSaved: false };

        switch (activeCriterion) {
          case 'attendance':
            nextRow.attendance = highestVal;
            break;
          case 'discipline':
            nextRow.disciplineScore = highestVal;
            break;
          case 'uniform':
            nextRow.uniformScore = highestVal;
            break;
          case 'memorization':
            nextRow.memorizationScore = highestVal;
            break;
          case 'revision':
            nextRow.revisionScore = highestVal;
            break;
          case 'family_meeting':
            nextRow.familyMeetingScore = highestVal;
            break;
        }

        next[s.id] = nextRow;
      });
      return next;
    });

    showToast(`تم تعيين «${currentCriterionConfig.highestLabel}» لجميع الطلاب بنجاح`, 'success');
  };

  // Secondary Clear/Reset button
  const handleResetToDefault = () => {
    setRows((prev) => {
      const next = { ...prev };
      students.forEach((s) => {
        next[s.id] = {
          attendance: 'early',
          disciplineScore: 2,
          uniformScore: 2,
          memorizationScore: 2,
          revisionScore: 2,
          familyMeetingScore: 2,
          notes: '',
          isSaved: false,
        };
      });
      return next;
    });
    showToast('تمت إعادة تعيين القيم إلى الوضع الافتراضي', 'info');
  };

  // Save single student row
  const handleSaveSingle = (student: Student) => {
    const row = rows[student.id];
    if (!row) return;

    const res = repository.saveDailyEvaluation({
      studentId: student.id,
      circleId,
      date: selectedDate,
      dayName,
      attendance: row.attendance,
      disciplineScore: row.disciplineScore,
      uniformScore: row.uniformScore,
      memorizationScore: row.memorizationScore,
      revisionScore: row.revisionScore,
      familyMeetingScore: row.familyMeetingScore,
      notes: row.notes?.trim() || undefined,
      teacherName,
      teacherId,
    });

    if (res.success) {
      setRows((prev) => ({
        ...prev,
        [student.id]: { ...prev[student.id], isSaved: true },
      }));
      if (res.deltaPoints > 0) {
        celebratePoints(res.deltaPoints, `تقييم ${student.name}`);
      } else {
        showToast(res.message, 'success');
      }
      onEvaluationsSaved();
    } else {
      showToast(res.message, 'error');
    }
  };

  // Save all students
  const handleSaveAll = () => {
    let savedTotal = 0;
    let totalPointsAwarded = 0;

    students.forEach((student) => {
      const row = rows[student.id];
      if (!row) return;

      const res = repository.saveDailyEvaluation({
        studentId: student.id,
        circleId,
        date: selectedDate,
        dayName,
        attendance: row.attendance,
        disciplineScore: row.disciplineScore,
        uniformScore: row.uniformScore,
        memorizationScore: row.memorizationScore,
        revisionScore: row.revisionScore,
        familyMeetingScore: row.familyMeetingScore,
        notes: row.notes?.trim() || undefined,
        teacherName,
        teacherId,
      });

      if (res.success) {
        savedTotal++;
        totalPointsAwarded += Math.max(0, res.deltaPoints);
      }
    });

    // Mark all as saved
    setRows((prev) => {
      const next = { ...prev };
      students.forEach((s) => {
        if (next[s.id]) {
          next[s.id] = { ...next[s.id], isSaved: true };
        }
      });
      return next;
    });

    if (totalPointsAwarded > 0) {
      celebratePoints(
        totalPointsAwarded,
        `تم حفظ تقييم ${savedTotal} طلاب لحلقة ${teacherName}`
      );
    } else {
      showToast(`تم حفظ تقييم ${savedTotal} طلاب بنجاح`, 'success');
    }
    onEvaluationsSaved();
  };

  if (students.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 text-center border border-slate-200/90 shadow-2xs space-y-2">
        <h4 className="text-sm font-bold text-slate-800">
          لا يوجد طلاب في هذه الحلقة حالياً
        </h4>
        <p className="text-xs text-slate-500">
          يمكنك اختيار حلقة أخرى من قائمة تبديل المعلم بالأعلى للبدء بالرصد السريع.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {/* 1. Criteria Selector + Action Bar (Outer header hidden when embedded in merged section) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-3.5 shadow-2xs space-y-2.5">
        {!hideOuterHeader && (
          <div className="flex items-center justify-between gap-3 flex-wrap pb-2 border-b border-slate-100">
            {/* Title and Group Badge */}
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                الرصد السريع للجميع
              </h3>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {circleName || 'حلقة القرآن الكريم'}
              </span>
            </div>

            {/* Progress Bar «N / 46» */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-500 font-medium">المرصود:</span>
                <span className="font-extrabold text-slate-800 tabular-nums">
                  {savedCount} / {totalCount}
                </span>
              </div>
              <div className="w-20 sm:w-28 bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/60">
                <div
                  className="bg-teal-700 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-[11px] font-bold text-slate-400 tabular-nums">
                {progressPercent}%
              </span>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 sm:flex-initial min-w-[170px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث في الطلاب..."
                className="w-full pr-8 pl-6 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-hidden focus:border-teal-600 min-h-[34px] transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                  title="إلغاء البحث"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        )}

        {/* 2. Criteria Selector: Small Tabs (حضور · انضباط · زي · حفظ · مراجعة · اجتماع أسري) */}
        <div>
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl overflow-x-auto border border-slate-200/70">
            {CRITERIA_CONFIG.map((crit) => {
              const isActive = activeCriterion === crit.key;
              return (
                <button
                  key={crit.key}
                  type="button"
                  onClick={() => setActiveCriterion(crit.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap min-h-[32px] flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-teal-800 text-white shadow-xs font-black'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <span>{crit.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Underneath Criteria: Button «تعيين الكل: [القيمة الأعلى]» + Secondary Clear Button + Primary Save */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Button «تعيين الكل: [القيمة الأعلى]» */}
            <button
              type="button"
              onClick={handleSetAllHighest}
              className="px-3.5 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-extrabold transition-all inline-flex items-center gap-1.5 active:scale-[0.98] min-h-[36px]"
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              <span>تعيين الكل: {currentCriterionConfig.highestLabel}</span>
            </button>

            {/* Secondary Clear / Reset Button */}
            <button
              type="button"
              onClick={handleResetToDefault}
              className="text-xs font-medium text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200/80 px-3 py-1.5 rounded-xl transition-colors border border-slate-200/70 inline-flex items-center gap-1.5 min-h-[36px]"
              title="إعادة تعيين خيارات الرصد إلى الوضع الافتراضي"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>مسح الرصد</span>
            </button>
          </div>

          {/* Primary Save All Button */}
          <button
            type="button"
            onClick={handleSaveAll}
            className="px-4 py-2 rounded-xl bg-teal-800 hover:bg-teal-900 text-white font-extrabold text-xs shadow-xs flex items-center gap-1.5 min-h-[38px] active:scale-[0.98] transition-all mr-auto sm:mr-0"
          >
            <Save className="w-4 h-4" />
            <span>حفظ تقييم جميع الطلاب</span>
          </button>
        </div>
      </div>

      {/* 4. Students List Under the Criteria Selector */}
      {/* Clean white rows, no yellow border, no symbols ✕/⏳/⚠, no colored header icons */}
      <div className="space-y-2.5">
        {filteredStudents.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center border border-slate-200/90 shadow-2xs text-xs text-slate-500">
            لا يوجد طالب يطابق البحث «{searchQuery}».
          </div>
        ) : (
          filteredStudents.map((student, index) => {
            const row = rows[student.id] || {
              attendance: 'early',
              disciplineScore: 2,
              uniformScore: 2,
              memorizationScore: 2,
              revisionScore: 2,
              familyMeetingScore: 2,
              isSaved: false,
            };
            const total = calculateTotal(row);
            const currentVal = getStudentCriterionValue(row, activeCriterion);

            return (
              <div
                key={student.id}
                className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-3.5 shadow-2xs hover:border-slate-300 transition-colors flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap"
              >
                {/* 1. Number + Student Name */}
                <div className="flex items-center gap-2.5 min-w-[170px]">
                  <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 text-xs font-bold flex items-center justify-center shrink-0 border border-slate-200/60 tabular-nums">
                    {index + 1}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-extrabold text-slate-900">
                        {student.name}
                      </h4>
                      {row.isSaved && (
                        <span className="text-[10px] font-bold text-teal-800 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded-md inline-flex items-center gap-1">
                          <Check className="w-2.5 h-2.5 text-teal-600" />
                          تم الرصد
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. Text Option Buttons for the Active Criterion */}
                <div className="flex items-center gap-1.5 sm:gap-2 mr-auto sm:mr-0 flex-wrap">
                  {currentCriterionConfig.options.map((opt) => {
                    const isSelected = currentVal === opt.value;

                    // Unselected: White with grey border
                    // Selected: Colored according to tier (Green for high, Yellow for medium, Red for low)
                    let btnStyle = '';
                    if (isSelected) {
                      if (opt.tier === 'high') {
                        btnStyle =
                          'bg-emerald-600 text-white border-emerald-600 shadow-xs font-bold';
                      } else if (opt.tier === 'medium') {
                        btnStyle =
                          'bg-amber-500 text-white border-amber-500 shadow-xs font-bold';
                      } else {
                        btnStyle =
                          'bg-rose-600 text-white border-rose-600 shadow-xs font-bold';
                      }
                    } else {
                      btnStyle =
                        'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 font-medium';
                    }

                    return (
                      <button
                        key={String(opt.value)}
                        type="button"
                        onClick={() =>
                          setStudentCriterionValue(student.id, activeCriterion, opt.value)
                        }
                        className={`px-3 py-1.5 rounded-xl text-xs border transition-all min-h-[36px] active:scale-95 ${btnStyle}`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}

                  {/* Score total + Single row save button */}
                  <div className="hidden sm:flex items-center gap-1.5 mr-2">
                    <span
                      className="text-xs font-bold text-slate-400 tabular-nums"
                      title="مجموع نقاط اليوم"
                    >
                      {total} / 10ن
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSaveSingle(student)}
                      className={`p-1.5 rounded-xl transition-all ${
                        row.isSaved
                          ? 'text-teal-700 bg-teal-50 border border-teal-200 hover:bg-teal-100'
                          : 'text-slate-400 hover:text-teal-700 hover:bg-slate-100'
                      }`}
                      title="حفظ تقييم هذا الطالب"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
