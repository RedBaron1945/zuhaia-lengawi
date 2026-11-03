import React, { useState, useEffect } from 'react';
import { Student, EvaluationRecord, AttendanceType } from '../../types';
import { repository } from '../../services/storageService';
import { useToast } from '../../context/ToastContext';
import {
  Check,
  ChevronDown,
  Sparkles,
  BookOpen,
  RotateCcw,
  ShieldCheck,
  Shirt,
  UserCheck,
} from 'lucide-react';

interface StudentDailyEvaluationCardProps {
  student: Student;
  circleId: string;
  selectedDate: string;
  dayName: string;
  teacherName: string;
  teacherId?: string;
  existingEvaluation?: EvaluationRecord;
  isOpen: boolean;
  onToggle: () => void;
  onEvaluationSaved: () => void;
}

export const StudentDailyEvaluationCard: React.FC<StudentDailyEvaluationCardProps> = ({
  student,
  circleId,
  selectedDate,
  dayName,
  teacherName,
  teacherId,
  existingEvaluation,
  isOpen,
  onToggle,
  onEvaluationSaved,
}) => {
  const { showToast, celebratePoints } = useToast();

  // Local state for the 5 evaluation criteria
  const [attendance, setAttendance] = useState<AttendanceType>(
    existingEvaluation?.attendance || 'early'
  );
  const [disciplineScore, setDisciplineScore] = useState<number>(
    existingEvaluation?.disciplineScore ?? 2
  );
  const [uniformScore, setUniformScore] = useState<number>(
    existingEvaluation?.uniformScore ?? 2
  );
  const [memorizationScore, setMemorizationScore] = useState<number>(
    existingEvaluation?.memorizationScore ?? 2
  );
  const [revisionScore, setRevisionScore] = useState<number>(
    existingEvaluation?.revisionScore ?? 2
  );
  const [notes, setNotes] = useState<string>(existingEvaluation?.notes || '');
  const [showNotes, setShowNotes] = useState(Boolean(existingEvaluation?.notes));

  // Sync state if existingEvaluation or date changes
  useEffect(() => {
    if (existingEvaluation) {
      setAttendance(existingEvaluation.attendance || 'early');
      setDisciplineScore(existingEvaluation.disciplineScore ?? 2);
      setUniformScore(existingEvaluation.uniformScore ?? 2);
      setMemorizationScore(existingEvaluation.memorizationScore ?? 2);
      setRevisionScore(existingEvaluation.revisionScore ?? 2);
      setNotes(existingEvaluation.notes || '');
      setShowNotes(Boolean(existingEvaluation.notes));
    } else {
      // Default initial state
      setAttendance('early');
      setDisciplineScore(2);
      setUniformScore(2);
      setMemorizationScore(2);
      setRevisionScore(2);
      setNotes('');
      setShowNotes(false);
    }
  }, [existingEvaluation, selectedDate]);

  // Points calculation (each criterion is out of 2 points, max 10 points total)
  const attendancePts = attendance === 'early' ? 2 : attendance === 'late' ? 1 : 0;
  const currentTotal =
    attendancePts + disciplineScore + uniformScore + memorizationScore + revisionScore;

  const isSaved = Boolean(existingEvaluation);

  // A student is marked as modified (an exception from perfect 10/10) if saved and has any deduction or customized note
  const isModified =
    isSaved &&
    (attendance !== 'early' ||
      disciplineScore !== 2 ||
      uniformScore !== 2 ||
      memorizationScore !== 2 ||
      revisionScore !== 2 ||
      Boolean(notes));

  // Quick 1-tap "Full Perfect 10/10" button
  const handleSetPerfect = () => {
    setAttendance('early');
    setDisciplineScore(2);
    setUniformScore(2);
    setMemorizationScore(2);
    setRevisionScore(2);
  };

  // Quick 1-tap "Mark Absent" button
  const handleSetAbsent = () => {
    setAttendance('absent');
    setDisciplineScore(0);
    setUniformScore(0);
    setMemorizationScore(0);
    setRevisionScore(0);
  };

  const handleSave = () => {
    const res = repository.saveDailyEvaluation({
      studentId: student.id,
      circleId,
      date: selectedDate,
      dayName,
      attendance,
      disciplineScore,
      uniformScore,
      memorizationScore,
      revisionScore,
      notes: notes.trim() || undefined,
      teacherName,
      teacherId,
    });

    if (res.success) {
      if (res.deltaPoints > 0) {
        celebratePoints(res.deltaPoints, `تقييم ${student.name}`);
      } else {
        showToast(res.message, 'success');
      }
      onEvaluationSaved();
    } else {
      showToast(res.message, 'error');
    }
  };

  // Helper for option button styles: Green for highest (2), Yellow/Amber for medium (1), Red for lowest (0)
  // NO purple / indigo!
  const getOptionClass = (isSelected: boolean, valueLevel: 2 | 1 | 0) => {
    if (!isSelected) {
      return 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 font-bold';
    }
    if (valueLevel === 2) {
      return 'bg-emerald-600 text-white border-emerald-600 font-black shadow-xs';
    }
    if (valueLevel === 1) {
      return 'bg-amber-500 text-white border-amber-500 font-black shadow-xs';
    }
    return 'bg-rose-600 text-white border-rose-600 font-black shadow-xs';
  };

  // Helper for dots color in the collapsed line
  const getDotClass = (score: number) => {
    if (!isSaved) return 'bg-slate-200 border border-slate-300';
    if (score === 2) return 'bg-emerald-500';
    if (score === 1) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div
      className={`bg-white rounded-2xl border transition-all shadow-2xs overflow-hidden ${
        isOpen
          ? 'border-teal-500 ring-2 ring-teal-500/20 shadow-xs'
          : isModified
          ? 'border-amber-300/90 hover:border-amber-400'
          : isSaved
          ? 'border-slate-200/90 hover:border-teal-300'
          : 'border-slate-200/90 hover:border-slate-300'
      }`}
    >
      {/* 1. Collapsed Single-line Row (Always Visible) */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 p-2.5 sm:p-3 text-right hover:bg-slate-50/80 transition-colors select-none"
        aria-expanded={isOpen}
      >
        {/* Right side in RTL: Initial Letter + Name + Modified Indicator Dot */}
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center shrink-0 border shadow-2xs ${
              isSaved
                ? 'bg-teal-50 border-teal-200 text-teal-800'
                : 'bg-slate-100 border-slate-200 text-slate-600'
            }`}
          >
            {student.name.charAt(0)}
          </div>

          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
              {student.name}
            </span>
            <span
              className="text-[10px] font-bold text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded-md border border-teal-200/70 tabular-nums shrink-0"
              title="الرصيد التراكمي الإجمالي للطالب لجميع الأيام"
            >
              ⭐ {student.currentPoints} ن
            </span>

            {/* Distinct dot if modified (exception) */}
            {isModified && (
              <span
                className="w-2 h-2 rounded-full bg-amber-500 ring-2 ring-amber-200 shrink-0"
                title="طالب معدّل (استثناء عن الدرجة الكاملة)"
              />
            )}
          </div>
        </div>

        {/* Left side in RTL: 5 Colored Dots for Criteria + Score "10/10" + Arrow */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Five colored dots representing the 5 criteria: 1.الحضور 2.الانضباط 3.الزي 4.الحفظ 5.المراجعة */}
          <div
            className="flex items-center gap-1 px-1.5 py-1 bg-slate-50 rounded-lg border border-slate-100 shrink-0"
            title="حالة المعايير الخمسة: حضور · انضباط · زي · حفظ · مراجعة"
          >
            <span
              className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shrink-0 ${getDotClass(attendancePts)}`}
              title={`1. الحضور: ${attendance === 'early' ? 'مبكر (2ن)' : attendance === 'late' ? 'متأخر (1ن)' : 'غائب (0ن)'}`}
            />
            <span
              className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shrink-0 ${getDotClass(disciplineScore)}`}
              title={`2. الانضباط: ${disciplineScore === 2 ? 'منضبط (2ن)' : disciplineScore === 1 ? 'متوسط (1ن)' : 'غير منضبط (0ن)'}`}
            />
            <span
              className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shrink-0 ${getDotClass(uniformScore)}`}
              title={`3. الزي: ${uniformScore === 2 ? 'ملتزم (2ن)' : uniformScore === 1 ? 'ملاحظة (1ن)' : 'غير ملتزم (0ن)'}`}
            />
            <span
              className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shrink-0 ${getDotClass(memorizationScore)}`}
              title={`4. الحفظ: ${memorizationScore === 2 ? 'متقن (2ن)' : memorizationScore === 1 ? 'جزئي (1ن)' : 'لم يحفظ (0ن)'}`}
            />
            <span
              className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shrink-0 ${getDotClass(revisionScore)}`}
              title={`5. المراجعة: ${revisionScore === 2 ? 'متقنة (2ن)' : revisionScore === 1 ? 'جزئية (1ن)' : 'لم يراجع (0ن)'}`}
            />
          </div>

          {/* Score Badge «10/10» */}
          <span
            className={`text-xs font-black px-2 py-0.5 rounded-lg border tabular-nums shrink-0 ${
              !isSaved
                ? 'bg-slate-100 text-slate-500 border-slate-200'
                : currentTotal >= 9
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : currentTotal >= 6
                ? 'bg-amber-50 text-amber-800 border-amber-300'
                : 'bg-rose-50 text-rose-800 border-rose-300'
            }`}
          >
            {isSaved ? `${currentTotal}/10` : '—/10'}
          </span>

          {/* Arrow / Chevron */}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${
              isOpen ? 'rotate-180 text-teal-700' : ''
            }`}
          />
        </div>
      </button>

      {/* 2. Expanded Card Body (Reveals the 5 criteria when clicked) */}
      {isOpen && (
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50/40 space-y-3 animate-fade-in">
          {/* Rule note & Cumulative Points */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[11px] font-bold text-slate-700 bg-white px-3 py-2 rounded-xl border border-slate-200/80">
            <div className="flex items-center gap-2">
              <span>5 معايير تقييم (كل معيار من درجتين)</span>
              <span className="text-teal-800 font-extrabold">· تقييم اليوم: {currentTotal} من 10</span>
            </div>
            <div className="text-teal-900 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-200/80 shrink-0 self-start sm:self-auto font-black tabular-nums">
              الرصيد التراكمي الكلي: ⭐ {student.currentPoints} نقطة
            </div>
          </div>

          {/* 5 Criteria: Short text buttons without bullet dots in name, unified colors (green/yellow/red) */}
          <div className="space-y-2.5">
            {/* 1. الحضور */}
            <div className="bg-white p-2.5 rounded-xl border border-slate-200/80">
              <div className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-teal-700" />
                <span>1. الحضور</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setAttendance('early')}
                  className={`min-h-[38px] px-2 rounded-xl text-xs transition-all flex items-center justify-center border ${getOptionClass(
                    attendance === 'early',
                    2
                  )}`}
                >
                  <span>مبكر (+2)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAttendance('late')}
                  className={`min-h-[38px] px-2 rounded-xl text-xs transition-all flex items-center justify-center border ${getOptionClass(
                    attendance === 'late',
                    1
                  )}`}
                >
                  <span>متأخر (+1)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAttendance('absent');
                    setDisciplineScore(0);
                    setUniformScore(0);
                    setMemorizationScore(0);
                    setRevisionScore(0);
                  }}
                  className={`min-h-[38px] px-2 rounded-xl text-xs transition-all flex items-center justify-center border ${getOptionClass(
                    attendance === 'absent',
                    0
                  )}`}
                >
                  <span>غائب (0)</span>
                </button>
              </div>
            </div>

            {/* 2. الانضباط والسلوك */}
            <div className="bg-white p-2.5 rounded-xl border border-slate-200/80">
              <div className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
                <span>2. الانضباط والسلوك</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { val: 2, label: 'منضبط (+2)', level: 2 as const },
                  { val: 1, label: 'متوسط (+1)', level: 1 as const },
                  { val: 0, label: 'غير منضبط (0)', level: 0 as const },
                ].map((opt) => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => setDisciplineScore(opt.val)}
                    className={`min-h-[38px] px-1 rounded-xl text-xs transition-all border flex items-center justify-center ${getOptionClass(
                      disciplineScore === opt.val,
                      opt.level
                    )}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. الزي والمظهر */}
            <div className="bg-white p-2.5 rounded-xl border border-slate-200/80">
              <div className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Shirt className="w-3.5 h-3.5 text-teal-700" />
                <span>3. الزي والمظهر</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { val: 2, label: 'ملتزم (+2)', level: 2 as const },
                  { val: 1, label: 'ملاحظة (+1)', level: 1 as const },
                  { val: 0, label: 'غير ملتزم (0)', level: 0 as const },
                ].map((opt) => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => setUniformScore(opt.val)}
                    className={`min-h-[38px] px-1 rounded-xl text-xs transition-all border flex items-center justify-center ${getOptionClass(
                      uniformScore === opt.val,
                      opt.level
                    )}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. الحفظ اليومي المقرر */}
            <div className="bg-white p-2.5 rounded-xl border border-slate-200/80">
              <div className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-teal-700" />
                <span>4. الحفظ اليومي المقرر</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { val: 2, label: 'متقن (+2)', level: 2 as const },
                  { val: 1, label: 'جزئي (+1)', level: 1 as const },
                  { val: 0, label: 'لم يحفظ (0)', level: 0 as const },
                ].map((opt) => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => setMemorizationScore(opt.val)}
                    className={`min-h-[38px] px-1 rounded-xl text-xs transition-all border flex items-center justify-center ${getOptionClass(
                      memorizationScore === opt.val,
                      opt.level
                    )}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 5. مراجعة المحفوظات */}
            <div className="bg-white p-2.5 rounded-xl border border-slate-200/80">
              <div className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5 text-teal-700" />
                <span>5. مراجعة المحفوظات</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { val: 2, label: 'متقنة (+2)', level: 2 as const },
                  { val: 1, label: 'جزئية (+1)', level: 1 as const },
                  { val: 0, label: 'لم يراجع (0)', level: 0 as const },
                ].map((opt) => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => setRevisionScore(opt.val)}
                    className={`min-h-[38px] px-1 rounded-xl text-xs transition-all border flex items-center justify-center ${getOptionClass(
                      revisionScore === opt.val,
                      opt.level
                    )}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional Notes Toggle */}
            <div>
              {!showNotes ? (
                <button
                  type="button"
                  onClick={() => setShowNotes(true)}
                  className="text-[11px] font-bold text-teal-700 hover:underline"
                >
                  + إضافة ملاحظة تربوية خاصة بالطالب
                </button>
              ) : (
                <div className="pt-1">
                  <div className="flex items-center justify-between mb-1 text-[11px] font-bold text-slate-600">
                    <span>ملاحظة المعلم:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNotes(false);
                        setNotes('');
                      }}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      إلغاء
                    </button>
                  </div>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="مثال: بحاجة لتثبيت المدود والغنن أو ملاحظات الأداء..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-teal-600 bg-white"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons Bar */}
          <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSetPerfect}
                className="text-xs font-extrabold px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 transition-colors min-h-[38px]"
                title="منح الدرجة الكاملة 10/10 بنقرة واحدة"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>كاملة (10/10)</span>
              </button>

              <button
                type="button"
                onClick={handleSetAbsent}
                className="text-xs font-bold px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 transition-colors min-h-[38px]"
                title="تسجيل غائب وتصفير البنود"
              >
                غائب (0)
              </button>
            </div>

            <button
              type="button"
              onClick={handleSave}
              className="flex-1 sm:flex-initial min-h-[40px] px-5 rounded-xl bg-teal-800 hover:bg-teal-900 text-white font-extrabold text-xs shadow-xs flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all"
            >
              <Check className="w-4 h-4" />
              <span>حفظ تقييم {student.name.split(' ')[0]} ({currentTotal}ن)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
