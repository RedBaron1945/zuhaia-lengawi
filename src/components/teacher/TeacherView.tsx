import React, { useState, useEffect } from 'react';
import { User, Circle, Student, Teacher } from '../../types';
import { repository, subscribeToDataChanges } from '../../services/storageService';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { DateNavigator } from './DateNavigator';
import { WeeklySummaryTable } from './WeeklySummaryTable';
import {
  getSundayOfWeek,
  getCircleDaysOfWeek,
  formatISODate,
  getArabicDayName,
  formatHijriShortDate,
  WeekDayInfo,
} from '../../utils/dateUtils';
import {
  Search,
  Sparkles,
  CheckCheck,
  Check,
  MoreVertical,
  LogOut,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Undo2,
  UserX,
} from 'lucide-react';
import logoZuhaia from '../../assets/logo-zuhaia-transparent.png';

interface TeacherViewProps {
  currentUser: User;
}

type CriterionType = 'attendance' | 'memorization' | 'revision' | 'discipline' | 'uniform';

type StudentCriterionDraft = {
  attendance: 'early' | 'late' | 'absent' | null;
  memorization: number | null;
  revision: number | null;
  discipline: number | null;
  uniform: number | null;
};

interface CriterionRowDef {
  key: CriterionType;
  label: string;
  fullVal: any; // 'early' or 2
  partialVal: any; // 'late' or 1
  zeroVal: any; // 'absent' or 0
}

const CRITERIA_ROWS: CriterionRowDef[] = [
  { key: 'attendance', label: 'الحضور', fullVal: 'early', partialVal: 'late', zeroVal: 'absent' },
  { key: 'memorization', label: 'الحفظ', fullVal: 2, partialVal: 1, zeroVal: 0 },
  { key: 'revision', label: 'المراجعة', fullVal: 2, partialVal: 1, zeroVal: 0 },
  { key: 'discipline', label: 'الانضباط', fullVal: 2, partialVal: 1, zeroVal: 0 },
  { key: 'uniform', label: 'الزي', fullVal: 2, partialVal: 1, zeroVal: 0 },
];

export const TeacherView: React.FC<TeacherViewProps> = ({ currentUser }) => {
  const { logout, switchTeacherCircle, switchUser } = useAuth();
  const { showToast } = useToast();
  const [circles, setCircles] = useState<Circle[]>(() => repository.getCircles());
  const [, setTeachers] = useState<Teacher[]>(() => repository.getTeachers());

  // Selected Circle
  const [selectedCircleId, setSelectedCircleId] = useState<string>(
    currentUser.circleId || 'circle_othman'
  );

  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const isPrivileged = currentUser?.role === 'supervisor' || currentUser?.role === 'admin';

  // Date and Week Navigation
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() =>
    getSundayOfWeek(new Date())
  );
  const weekDays = getCircleDaysOfWeek(currentWeekStart);

  // Selected Circle object
  const selectedCircle =
    circles.find((c) => c.id === selectedCircleId) ||
    circles[0] || {
      id: 'circle_othman',
      name: 'حلقة عثمان بن عفّان',
      teacherName: 'سيد نقيب الله',
      teacherId: 'rJeGonuG4IW2tPIOREi8E6dR6mq1',
      schedule: 'الأحد إلى الأربعاء (بعد العصر)',
      studentCount: 23,
      room: 'جامع زهية لنجاوي - ركن عثمان بن عفان',
    };

  const allCircleStudents: Student[] = repository.getStudents().filter((s: Student) => s.circleId === selectedCircle.id);

  // Auto-open target date on load
  const getInitialDate = (days: WeekDayInfo[], circleId: string, students: Student[]) => {
    const todayStr = formatISODate(new Date());
    const todayMatch = days.find((d) => d.date === todayStr);

    if (todayMatch) {
      return todayMatch.date;
    }

    for (const d of days) {
      const evals = repository.getEvaluationsForCircleAndDate(circleId, d.date);
      const recordedCount = new Set(evals.filter((e) => students.some((s) => s.id === e.studentId)).map((e) => e.studentId)).size;
      if (students.length > 0 && recordedCount < students.length) {
        return d.date;
      }
    }

    return days[0]?.date || todayStr;
  };

  const [selectedDate, setSelectedDate] = useState<string>(() =>
    getInitialDate(weekDays, selectedCircle.id, allCircleStudents)
  );

  const [activeTab, setActiveTab] = useState<'daily' | 'weekly_summary' | 'students_list'>('daily');
  const [searchQuery, setSearchQuery] = useState('');
  const [, setTick] = useState(0);

  // Cards are collapsed (null) by default. The selected student card can be folded anytime by tapping it again.
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);


  // Sync circle if currentUser changes
  useEffect(() => {
    if (currentUser.circleId && currentUser.circleId !== selectedCircleId) {
      setSelectedCircleId(currentUser.circleId);
    }
  }, [currentUser.circleId]);

  useEffect(() => {
    const unsub = subscribeToDataChanges(() => {
      setCircles(repository.getCircles());
      setTeachers(repository.getTeachers());
      setTick((t) => t + 1);
    });
    return unsub;
  }, []);

  const handleWeekChange = (newWeekStart: Date) => {
    setCurrentWeekStart(newWeekStart);
    const newDays = getCircleDaysOfWeek(newWeekStart);
    const initialDate = getInitialDate(newDays, selectedCircle.id, allCircleStudents);
    setSelectedDate(initialDate);
  };

  // Filter students by search
  const circleStudents: Student[] = searchQuery.trim()
    ? allCircleStudents.filter((s: Student) => s.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : allCircleStudents;

  const currentStudentIds = new Set(allCircleStudents.map((s: Student) => s.id));

  // Date evaluations
  const weekDatesList = weekDays.map((d) => d.date);
  const weeklyEvaluations = selectedCircle
    ? repository.getEvaluationsForCircleAndWeek(selectedCircle.id, weekDatesList)
    : [];

  // Accurate day evaluation counts
  const dayEvaluationCounts: Record<string, { recorded: number; total: number }> = {};
  weekDays.forEach((wd) => {
    const evalsForDay = selectedCircle
      ? repository.getEvaluationsForCircleAndDate(selectedCircle.id, wd.date)
      : [];
    const recordedIds = new Set(
      evalsForDay.filter((e) => currentStudentIds.has(e.studentId)).map((e) => e.studentId)
    );
    dayEvaluationCounts[wd.date] = {
      recorded: Math.min(recordedIds.size, allCircleStudents.length),
      total: allCircleStudents.length,
    };
  });

  // Draft evaluations state per student
  // Draft evaluations state per student
  const getInitialDrafts = (date: string, students: Student[], circleId: string = selectedCircle.id): Record<string, StudentCriterionDraft> => {
    // Check localStorage draft first for unsaved work
    try {
      const saved = localStorage.getItem(`teacher_daily_draft_${circleId}_${date}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      }
    } catch {
      // ignore JSON parse or storage errors
    }

    const result: Record<string, StudentCriterionDraft> = {};
    students.forEach((s) => {
      const existing = repository.getEvaluationForStudentAndDate(s.id, date);
      result[s.id] = {
        attendance: existing?.attendance ?? null,
        memorization: typeof existing?.memorizationScore === 'number' ? existing.memorizationScore : null,
        revision: typeof existing?.revisionScore === 'number' ? existing.revisionScore : null,
        discipline: typeof existing?.disciplineScore === 'number' ? existing.disciplineScore : null,
        uniform: typeof existing?.uniformScore === 'number' ? existing.uniformScore : null,
      };
    });
    return result;
  };

  const [draftEvaluations, setDraftEvaluations] = useState<Record<string, StudentCriterionDraft>>(() =>
    getInitialDrafts(selectedDate, allCircleStudents, selectedCircle.id)
  );

  // Previous Drafts state for Undo (تراجع)
  const [previousDrafts, setPreviousDrafts] = useState<Record<string, StudentCriterionDraft> | null>(null);

  // Re-sync drafts and fold cards by default when selectedDate or circle changes
  useEffect(() => {
    const freshStudents = repository.getStudents().filter((s: Student) => s.circleId === selectedCircle.id);
    setDraftEvaluations(getInitialDrafts(selectedDate, freshStudents, selectedCircle.id));
    setExpandedStudentId(null);
  }, [selectedDate, selectedCircle.id]);

  // Helper: check if a student has all 5 criteria recorded
  const isStudentFullyRecorded = (studentId: string, drafts: Record<string, StudentCriterionDraft> = draftEvaluations) => {
    const d = drafts[studentId];
    if (!d) return false;
    return (
      d.attendance !== null && d.attendance !== undefined &&
      d.memorization !== null && d.memorization !== undefined &&
      d.revision !== null && d.revision !== undefined &&
      d.discipline !== null && d.discipline !== undefined &&
      d.uniform !== null && d.uniform !== undefined
    );
  };

  // Helper: count recorded criteria for a student
  const getStudentRecordedCount = (studentId: string, drafts: Record<string, StudentCriterionDraft> = draftEvaluations) => {
    const d = drafts[studentId];
    if (!d) return 0;
    let count = 0;
    if (d.attendance !== null && d.attendance !== undefined) count++;
    if (d.memorization !== null && d.memorization !== undefined) count++;
    if (d.revision !== null && d.revision !== undefined) count++;
    if (d.discipline !== null && d.discipline !== undefined) count++;
    if (d.uniform !== null && d.uniform !== undefined) count++;
    return count;
  };

  // Auto-sync function to persist evaluations in repository and localStorage immediately
  const autoSyncToStorage = (updatedDrafts: Record<string, StudentCriterionDraft>) => {
    try {
      localStorage.setItem(`teacher_daily_draft_${selectedCircle.id}_${selectedDate}`, JSON.stringify(updatedDrafts));
    } catch {
      // ignore
    }

    const accurateDayName = getArabicDayName(selectedDate);

    allCircleStudents.forEach((student) => {
      const d = updatedDrafts[student.id];
      if (!d) return;

      const hasAny =
        d.attendance !== null ||
        d.memorization !== null ||
        d.revision !== null ||
        d.discipline !== null ||
        d.uniform !== null;

      if (hasAny) {
        repository.saveDailyEvaluation({
          studentId: student.id,
          circleId: selectedCircle.id,
          date: selectedDate,
          dayName: accurateDayName,
          attendance: d.attendance || 'early',
          disciplineScore: typeof d.discipline === 'number' ? d.discipline : 0,
          uniformScore: typeof d.uniform === 'number' ? d.uniform : 0,
          memorizationScore: typeof d.memorization === 'number' ? d.memorization : 0,
          revisionScore: typeof d.revision === 'number' ? d.revision : 0,
          teacherName: selectedCircle.teacherName,
          teacherId: selectedCircle.teacherId,
        });
      } else {
        const existing = repository.getEvaluationForStudentAndDate(student.id, selectedDate);
        if (existing) {
          repository.deleteDailyEvaluation({
            studentId: student.id,
            date: selectedDate,
            teacherName: selectedCircle.teacherName,
          });
        }
      }
    });

    setTick((t) => t + 1);
  };

  // Button «الجميع بالدرجة الكاملة» at the top (All 2s)
  const handleFillAllFullScore = () => {
    setPreviousDrafts(JSON.parse(JSON.stringify(draftEvaluations)));

    const updated: Record<string, StudentCriterionDraft> = { ...draftEvaluations };
    allCircleStudents.forEach((s) => {
      updated[s.id] = {
        attendance: 'early',
        memorization: 2,
        revision: 2,
        discipline: 2,
        uniform: 2,
      };
    });

    setDraftEvaluations(updated);
    autoSyncToStorage(updated);
    showToast('تم تعيين الدرجة الكاملة (2) لجميع الطلاب ولكل البنود ✓', 'success');
  };

  // Direct selection of 2 / 1 / 0 buttons with toggle-to-unselect capability
  // Note: Student card STAYS OPEN and will NOT auto-collapse so teachers can review & grade peacefully.
  const handleSelectCriterionValue = (
    studentId: string,
    key: CriterionType,
    targetVal: any
  ) => {
    setPreviousDrafts(JSON.parse(JSON.stringify(draftEvaluations)));

    const current = draftEvaluations[studentId] || {
      attendance: null,
      memorization: null,
      revision: null,
      discipline: null,
      uniform: null,
    };

    const isAlreadySelected = current[key] === targetVal;
    // Clicking the selected button again resets it to null!
    const nextVal = isAlreadySelected ? null : targetVal;

    const updatedStudent: StudentCriterionDraft = {
      ...current,
      [key]: nextVal,
    };

    const updated: Record<string, StudentCriterionDraft> = {
      ...draftEvaluations,
      [studentId]: updatedStudent,
    };

    setDraftEvaluations(updated);
    autoSyncToStorage(updated);
  };

  // Text button «غائب» sets all 5 items to 0 (absent / 0 / 0 / 0 / 0)
  const handleMarkStudentAbsent = (studentId: string, studentName: string) => {
    setPreviousDrafts(JSON.parse(JSON.stringify(draftEvaluations)));

    const updated: Record<string, StudentCriterionDraft> = {
      ...draftEvaluations,
      [studentId]: {
        attendance: 'absent',
        memorization: 0,
        revision: 0,
        discipline: 0,
        uniform: 0,
      },
    };

    setDraftEvaluations(updated);
    autoSyncToStorage(updated);
    showToast(`تم تسجيل ${studentName} غائباً (0 لكافة البنود)`, 'info');
  };

  // Quick button inside card: set student full score (2 for all)
  const handleSetStudentAllTop = (studentId: string, studentName: string) => {
    setPreviousDrafts(JSON.parse(JSON.stringify(draftEvaluations)));

    const updated: Record<string, StudentCriterionDraft> = {
      ...draftEvaluations,
      [studentId]: {
        attendance: 'early',
        memorization: 2,
        revision: 2,
        discipline: 2,
        uniform: 2,
      },
    };

    setDraftEvaluations(updated);
    autoSyncToStorage(updated);
    showToast(`تم تسجيل الدرجة الكاملة لـ ${studentName} (2 لكافة البنود)`, 'success');
  };

  // Undo action
  const handleUndo = () => {
    if (!previousDrafts) return;
    setDraftEvaluations(previousDrafts);
    autoSyncToStorage(previousDrafts);
    setPreviousDrafts(null);
    showToast('تم التراجع عن التعديل بنجاح ↩️', 'info');
  };

  // Non-current day line logic
  const todayISO = formatISODate(new Date());
  const isSelectedDateToday = selectedDate === todayISO;
  const dayMatch = weekDays.find((d) => d.date === selectedDate);
  const selectedDayInfo = {
    dayName: dayMatch?.dayName || getArabicDayName(selectedDate),
    hijriFormatted: dayMatch?.hijriFormatted || formatHijriShortDate(selectedDate),
  };

  const handleResetToToday = () => {
    const now = new Date();
    const sunday = getSundayOfWeek(now);
    setCurrentWeekStart(sunday);
    setSelectedDate(todayISO);
  };

  return (
    <div className="pb-10 max-w-3xl mx-auto px-3 sm:px-4 pt-2.5 space-y-3 text-right overflow-visible">
      {/* Merged Card containing Circle Info AND Date Controls */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-3.5 shadow-xs space-y-3">
        {/* Top: Circle Info + Teacher Name + Menu */}
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={logoZuhaia}
              alt="شعار المسجد"
              className="h-8 w-auto object-contain shrink-0"
              loading="eager"
            />
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-base text-slate-900 truncate">
                  {selectedCircle.name}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-bold tabular-nums bg-teal-50 text-teal-800 border border-teal-200 shrink-0">
                  {allCircleStudents.length} طلاب
                </span>
              </div>
              <span className="text-xs font-bold text-slate-500 truncate mt-0.5">
                المعلم: {selectedCircle.teacherName}
              </span>
            </div>
          </div>

          {/* Menu button */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowHeaderMenu(!showHeaderMenu)}
              className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 flex items-center justify-center border border-slate-200 transition-colors cursor-pointer"
              title="القائمة"
              aria-label="القائمة"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showHeaderMenu && (
              <div className="absolute left-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 animate-fade-in text-xs space-y-1">
                {isPrivileged && (
                  <div className="pb-1 mb-1 border-b border-slate-100">
                    <span className="px-2.5 py-1 text-[11px] font-extrabold text-slate-400 block">تبديل الحلقة</span>
                    {circles.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedCircleId(c.id);
                          switchTeacherCircle(c.id);
                          setShowHeaderMenu(false);
                          showToast(`تم التبديل إلى ${c.name}`, 'info');
                        }}
                        className={`w-full text-right px-2.5 py-2 rounded-xl font-bold text-xs flex items-center justify-between cursor-pointer min-h-[38px] ${
                          c.id === selectedCircleId ? 'bg-teal-50 text-teal-950 font-black' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span>{c.name}</span>
                        {c.id === selectedCircleId && <Check className="w-4 h-4 text-teal-800" />}
                      </button>
                    ))}
                    <div className="pt-1 mt-1 border-t border-slate-100 flex gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowHeaderMenu(false);
                          switchUser('supervisor');
                        }}
                        className="flex-1 text-center py-1 bg-slate-100 hover:bg-slate-200 rounded-xl text-[11px] font-extrabold text-slate-800 min-h-[34px]"
                      >
                        واجهة المشرف
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowHeaderMenu(false);
                          switchUser('admin');
                        }}
                        className="flex-1 text-center py-1 bg-slate-100 hover:bg-slate-200 rounded-xl text-[11px] font-extrabold text-slate-800 min-h-[34px]"
                      >
                        الإدارة
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setShowHeaderMenu(false);
                    logout();
                  }}
                  className="w-full text-right px-3 py-2 rounded-xl text-rose-800 hover:bg-rose-50 font-extrabold text-xs flex items-center gap-2 cursor-pointer transition-colors min-h-[38px]"
                >
                  <LogOut className="w-4 h-4 text-rose-700" />
                  <span>تسجيل خروج</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Date Controls merged inside card */}
        <DateNavigator
          currentWeekStart={currentWeekStart}
          selectedDate={selectedDate}
          weekDays={weekDays}
          onSelectDate={setSelectedDate}
          onWeekChange={handleWeekChange}
          dayEvaluationCounts={dayEvaluationCounts}
        />
      </div>

      {/* Non-current day line: «تعرض الآن يوم X · العودة لليوم» */}
      {!isSelectedDateToday && (
        <div className="bg-amber-100 border border-amber-300 text-amber-950 px-3.5 py-2.5 rounded-2xl flex items-center justify-between text-xs sm:text-sm font-extrabold shadow-2xs animate-fade-in">
          <div className="flex items-center gap-1.5 truncate">
            <AlertTriangle className="w-4 h-4 text-amber-800 shrink-0" />
            <span className="truncate">
              تعرض الآن يوم {selectedDayInfo.dayName} ({selectedDayInfo.hijriFormatted})
            </span>
          </div>
          <button
            type="button"
            onClick={handleResetToToday}
            className="bg-amber-800 hover:bg-amber-900 text-white px-3 py-1 rounded-xl text-xs font-black transition-colors cursor-pointer shrink-0 underline"
          >
            العودة لليوم
          </button>
        </div>
      )}

      {/* Main Navigation Tabs: «رصد اليوم» · «سجل الأسبوع» · «الطلاب» */}
      <div className="bg-slate-200/90 p-1 rounded-2xl flex items-center gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('daily')}
          className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all min-h-[40px] flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'daily'
              ? 'bg-white text-teal-950 shadow-2xs font-black'
              : 'text-slate-700 hover:text-slate-900'
          }`}
        >
          <CheckCheck className="w-4 h-4 text-teal-800" />
          <span>رصد اليوم</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('weekly_summary')}
          className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all min-h-[40px] cursor-pointer flex items-center justify-center ${
            activeTab === 'weekly_summary'
              ? 'bg-white text-teal-950 shadow-2xs font-black'
              : 'text-slate-700 hover:text-slate-900'
          }`}
        >
          <span>سجل الأسبوع</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('students_list')}
          className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all min-h-[40px] cursor-pointer flex items-center justify-center ${
            activeTab === 'students_list'
              ? 'bg-white text-teal-950 shadow-2xs font-black'
              : 'text-slate-700 hover:text-slate-900'
          }`}
        >
          <span>الطلاب ({allCircleStudents.length})</span>
        </button>
      </div>

      {/* Content View 1: رصد اليوم — مطوية بشكل افتراضي مع أزرار 2 · 1 · 0 */}
      {activeTab === 'daily' && (
        <div className="space-y-2.5 pb-6">
          {/* Top Bar: زر «الجميع بالدرجة الكاملة» + زر «تراجع» + شارة «حفظ تلقائي ✓» */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleFillAllFullScore}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-2xl bg-teal-800 hover:bg-teal-900 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-98 transition-all min-h-[42px]"
              title="تعبئة الدرجة الكاملة (2) لكافة الطلاب في جميع البنود"
            >
              <Sparkles className="w-4 h-4 text-amber-300 fill-amber-300" />
              <span>الجميع بالدرجة الكاملة (2)</span>
            </button>

            <div className="flex items-center gap-2">
              {previousDrafts && (
                <button
                  type="button"
                  onClick={handleUndo}
                  className="px-3 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer border border-slate-200 min-h-[42px]"
                  title="تراجع عن آخر تعديل"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>تراجع</span>
                </button>
              )}

              <div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-black min-h-[42px]">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                <span>حفظ تلقائي ✓</span>
              </div>
            </div>
          </div>


          {/* Search if students >= 10 */}
          {allCircleStudents.length >= 10 && (
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث باسم الطالب..."
                className="w-full pr-8 pl-2 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-hidden min-h-[36px]"
              />
            </div>
          )}

          {/* قائمة بطاقات الطلاب: مطوية بشكل افتراضي مع إمكانية طي الطالب المحدد بنقرة عليه */}
          <div className="space-y-2">
            {circleStudents.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 text-center border border-slate-200 text-xs text-slate-500 font-bold">
                {searchQuery ? `لا توجد نتائج مطابقة لـ "${searchQuery}"` : 'لا يوجد طلاب مسجلون بالحلقة حالياً'}
              </div>
            ) : (
              circleStudents.map((student: Student, idx: number) => {
                const isExpanded = expandedStudentId === student.id;
                const studentDraft = draftEvaluations[student.id];
                const recordedCount = getStudentRecordedCount(student.id);
                const isComplete = recordedCount === 5;
                const remainingCount = 5 - recordedCount;

                return (
                  <div
                    key={student.id}
                    className={`bg-white rounded-2xl border transition-all shadow-2xs overflow-hidden ${
                      isExpanded
                        ? 'border-teal-600 ring-2 ring-teal-600/10'
                        : 'border-slate-200/90 hover:border-slate-300'
                    }`}
                  >
                    {/* رأس البطاقة: سطر واحد (الاسم + «اكتمل 5/5» أو «بقي N» + زر «غائب» نصي + سهم الفتح/الطي) */}
                    <div
                      onClick={() => setExpandedStudentId(isExpanded ? null : student.id)}
                      className="p-3 sm:p-3.5 flex items-center justify-between gap-2 cursor-pointer select-none bg-white hover:bg-slate-50/70 transition-colors"
                      title={isExpanded ? 'انقر لطي البطاقة' : 'انقر لفتح بطاقة الطالب'}
                    >
                      {/* Name and index */}
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-black flex items-center justify-center shrink-0 border border-slate-200">
                          {idx + 1}
                        </span>
                        <span className="font-extrabold text-sm sm:text-base text-slate-900 truncate">
                          {student.name}
                        </span>
                      </div>

                      {/* Status + Text Absence Button + Chevron */}
                      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        {/* الحالة المكتوبة: «اكتمل 5/5» أو «بقي N» */}
                        {isComplete ? (
                          <span className="text-[11px] font-black px-2.5 py-0.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-300">
                            اكتمل 5/5 ✓
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-300">
                            بقي {remainingCount}
                          </span>
                        )}

                        {/* زر «غائب» نصياً يضبط كل البنود على 0 */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkStudentAbsent(student.id, student.name);
                          }}
                          className="px-2.5 py-1 rounded-xl text-xs font-black text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                          title="تسجيل الطالب غائباً (ضبط كافة البنود على 0)"
                        >
                          <UserX className="w-3.5 h-3.5 text-rose-600" />
                          <span>غائب</span>
                        </button>

                        {/* السهم للإشارة لفتح/طي البطاقة */}
                        <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 stroke-[2.5]" />
                          ) : (
                            <ChevronDown className="w-4 h-4 stroke-[2.5]" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* محتوى البطاقة المفتوحة: خمسة أسطر للبنود، وكل سطر بثلاثة أزرار واضحة: 2   1   0 */}
                    {isExpanded && (
                      <div className="p-3 sm:p-3.5 border-t border-slate-100 bg-slate-50/40 space-y-2 animate-fade-in">
                        {CRITERIA_ROWS.map((row) => {
                          const currentVal = studentDraft ? studentDraft[row.key] : null;

                          return (
                            <div
                              key={row.key}
                              className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-200/60 last:border-b-0"
                            >
                              {/* اسم البند كاملاً */}
                              <span className="font-extrabold text-xs sm:text-sm text-slate-800 shrink-0 min-w-[60px] sm:min-w-[70px]">
                                {row.label}
                              </span>

                              {/* أزرار 2  1  0 مباشرة */}
                              <div className="grid grid-cols-3 gap-2 flex-1 max-w-[210px] sm:max-w-[240px]">
                                {/* 1. القيمة 2 */}
                                <button
                                  type="button"
                                  style={{ touchAction: 'manipulation' }}
                                  onClick={() => handleSelectCriterionValue(student.id, row.key, row.fullVal)}
                                  className={`h-[38px] rounded-xl text-sm font-black border transition-all flex items-center justify-center cursor-pointer select-none active:scale-95 ${
                                    currentVal === row.fullVal
                                      ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                                      : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 border-slate-200'
                                  }`}
                                  title="2 (كاملة) — انقر مرة أخرى للإلغاء"
                                >
                                  2
                                </button>

                                {/* 2. القيمة 1 */}
                                <button
                                  type="button"
                                  style={{ touchAction: 'manipulation' }}
                                  onClick={() => handleSelectCriterionValue(student.id, row.key, row.partialVal)}
                                  className={`h-[38px] rounded-xl text-sm font-black border transition-all flex items-center justify-center cursor-pointer select-none active:scale-95 ${
                                    currentVal === row.partialVal
                                      ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                                      : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 border-slate-200'
                                  }`}
                                  title="1 (جزئية) — انقر مرة أخرى للإلغاء"
                                >
                                  1
                                </button>

                                {/* 3. القيمة 0 */}
                                <button
                                  type="button"
                                  style={{ touchAction: 'manipulation' }}
                                  onClick={() => handleSelectCriterionValue(student.id, row.key, row.zeroVal)}
                                  className={`h-[38px] rounded-xl text-sm font-black border transition-all flex items-center justify-center cursor-pointer select-none active:scale-95 ${
                                    currentVal === row.zeroVal
                                      ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                                      : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 border-slate-200'
                                  }`}
                                  title="0 (لا شيء) — انقر مرة أخرى للإلغاء"
                                >
                                  0
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        {/* شريط الإجراءات السريعة أسفل البطاقة المفتوحة */}
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/80">
                          <button
                            type="button"
                            onClick={() => handleSetStudentAllTop(student.id, student.name)}
                            className="px-3 py-1.5 rounded-xl text-xs font-black bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-300 flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95 transition-all"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-teal-700" />
                            <span>الدرجة الكاملة (2 للكل)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleMarkStudentAbsent(student.id, student.name)}
                            className="px-3 py-1.5 rounded-xl text-xs font-black text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-300 flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95 transition-all"
                          >
                            <UserX className="w-3.5 h-3.5 text-rose-600" />
                            <span>تسجيل غائب (0 للكل)</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

        </div>
      )}

      {/* Content View 2: سجل الأسبوع */}
      {activeTab === 'weekly_summary' && (
        <WeeklySummaryTable
          students={allCircleStudents}
          weekDays={weekDays}
          weeklyEvaluations={weeklyEvaluations}
          onSelectDay={setSelectedDate}
          currentWeekStart={currentWeekStart}
          onWeekChange={handleWeekChange}
        />
      )}

      {/* Content View 3: قائمة الطلاب */}
      {activeTab === 'students_list' && (
        <div className="bg-white rounded-3xl p-4 border border-slate-200/90 shadow-xs space-y-3">
          <h3 className="text-sm font-extrabold text-slate-900">
            طلاب {selectedCircle.name} ({allCircleStudents.length} طلاب)
          </h3>
          <div className="space-y-2">
            {allCircleStudents.map((s: Student, idx: number) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-teal-100 text-teal-950 font-bold flex items-center justify-center text-[11px]">
                    {idx + 1}
                  </span>
                  <div>
                    <span className="font-bold text-slate-800 block">{s.name}</span>
                  </div>
                </div>
                <div className="text-left font-black text-teal-900">
                  {s.currentPoints} نقطة
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
