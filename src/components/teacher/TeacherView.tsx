import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  isCircleDay,
  WeekDayInfo,
} from '../../utils/dateUtils';
import {
  Search,
  CheckCheck,
  Check,
  MoreVertical,
  LogOut,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  UserX,
  Award,
} from 'lucide-react';
import logoZuhaia from '../../assets/logo-zuhaia-transparent.png';
import { FirestoreStatusBadge } from '../common/FirestoreStatusBadge';
import { ExamNominationModal } from './ExamNominationModal';

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

  const [tick, setTick] = useState(0);

  // Selected Circle object
  const selectedCircle = useMemo(() => {
    return (
      circles.find((c) => c.id === selectedCircleId) ||
      circles[0] || {
        id: 'circle_othman',
        name: 'حلقة عثمان بن عفّان',
        teacherName: 'سيد نقيب الله',
        teacherId: 'rJeGonuG4IW2tPIOREi8E6dR6mq1',
        schedule: 'الأحد إلى الأربعاء (بعد العصر)',
        studentCount: 23,
        room: 'جامع زهية لنجاوي - ركن عثمان بن عفان',
      }
    );
  }, [circles, selectedCircleId]);

  const allCircleStudents: Student[] = useMemo(() => {
    return repository.getStudents().filter((s: Student) => s.circleId === selectedCircle.id && s.active !== false);
  }, [selectedCircle.id, tick]);

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
    getInitialDate(weekDays, selectedCircle.id, repository.getStudents().filter((s: Student) => s.circleId === selectedCircle.id && s.active !== false))
  );

  const [activeTab, setActiveTab] = useState<'daily' | 'weekly_summary' | 'students_list'>('daily');
  const [searchQuery, setSearchQuery] = useState('');

  // Cards are collapsed (null) by default. The selected student card can be folded anytime by tapping it again.
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [showNominationModal, setShowNominationModal] = useState(false);


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
  const getInitialDrafts = (
    date: string,
    students: Student[],
    circleId: string = selectedCircle.id
  ): Record<string, StudentCriterionDraft> => {
    // Clean up any stale draft keys from localStorage to prevent resurrection
    try {
      localStorage.removeItem(`teacher_daily_draft_${circleId}_${date}`);
    } catch {
      // ignore
    }

    const result: Record<string, StudentCriterionDraft> = {};
    students.forEach((s) => {
      const existing = repository.getEvaluationForStudentAndDate(s.id, date);
      if (existing) {
        result[s.id] = {
          attendance: existing.attendance ?? null,
          memorization: typeof existing.memorizationScore === 'number' ? existing.memorizationScore : null,
          revision: typeof existing.revisionScore === 'number' ? existing.revisionScore : null,
          discipline: typeof existing.disciplineScore === 'number' ? existing.disciplineScore : null,
          uniform: typeof existing.uniformScore === 'number' ? existing.uniformScore : null,
        };
      } else {
        result[s.id] = {
          attendance: null,
          memorization: null,
          revision: null,
          discipline: null,
          uniform: null,
        };
      }
    });
    return result;
  };

  const [draftEvaluations, setDraftEvaluations] = useState<Record<string, StudentCriterionDraft>>(() =>
    getInitialDrafts(selectedDate, allCircleStudents, selectedCircle.id)
  );

  // Track selection key so cards collapse only when date or circle changes, not on reactive tick
  const prevSelectionKey = useRef(`${selectedCircle.id}_${selectedDate}`);
  const isLocalActionRef = useRef(false);

  // Re-sync drafts and fold cards by default when selectedDate, circle, or database tick changes
  useEffect(() => {
    const currentKey = `${selectedCircle.id}_${selectedDate}`;
    const dateOrCircleChanged = prevSelectionKey.current !== currentKey;

    if (dateOrCircleChanged) {
      prevSelectionKey.current = currentKey;
      const freshStudents = repository.getStudents().filter((s: Student) => s.circleId === selectedCircle.id && s.active !== false);
      setDraftEvaluations(getInitialDrafts(selectedDate, freshStudents, selectedCircle.id));
      setExpandedStudentId(null);
    } else if (!isLocalActionRef.current) {
      // Re-sync from external change (e.g. Firestore remote snapshot)
      const freshStudents = repository.getStudents().filter((s: Student) => s.circleId === selectedCircle.id && s.active !== false);
      setDraftEvaluations(getInitialDrafts(selectedDate, freshStudents, selectedCircle.id));
    }
    isLocalActionRef.current = false;
  }, [selectedDate, selectedCircle.id, tick]);

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

  // Auto-sync function to persist evaluations in repository immediately
  const autoSyncToStorage = (
    updatedDrafts: Record<string, StudentCriterionDraft>,
    targetStudentId?: string
  ) => {
    isLocalActionRef.current = true;

    // Remove any legacy draft key so it never resurrects
    try {
      localStorage.removeItem(`teacher_daily_draft_${selectedCircle.id}_${selectedDate}`);
    } catch {
      // ignore
    }

    const accurateDayName = getArabicDayName(selectedDate);
    const studentsToProcess = targetStudentId
      ? allCircleStudents.filter((s) => s.id === targetStudentId)
      : allCircleStudents;

    studentsToProcess.forEach((student) => {
      const d = updatedDrafts[student.id];
      if (!d) return;

      const hasAny =
        (d.attendance !== null && d.attendance !== undefined) ||
        (d.memorization !== null && d.memorization !== undefined) ||
        (d.revision !== null && d.revision !== undefined) ||
        (d.discipline !== null && d.discipline !== undefined) ||
        (d.uniform !== null && d.uniform !== undefined);

      if (hasAny) {
        repository.saveDailyEvaluation({
          studentId: student.id,
          circleId: selectedCircle.id,
          date: selectedDate,
          dayName: accurateDayName,
          attendance: d.attendance ?? null,
          disciplineScore: typeof d.discipline === 'number' ? d.discipline : null,
          uniformScore: typeof d.uniform === 'number' ? d.uniform : null,
          memorizationScore: typeof d.memorization === 'number' ? d.memorization : null,
          revisionScore: typeof d.revision === 'number' ? d.revision : null,
          teacherName: selectedCircle.teacherName,
          teacherId: selectedCircle.teacherId,
        });
      } else {
        // Completely purge evaluation and transactions from storage and Firestore
        repository.deleteDailyEvaluation({
          studentId: student.id,
          date: selectedDate,
          teacherName: selectedCircle.teacherName,
        });
      }
    });

    setTick((t) => t + 1);
  };

  // Action to reset/clear evaluation for a student completely
  const handleClearStudentEvaluation = (studentId: string, studentName: string) => {
    if (!isSelectedDateCircleDay) {
      showToast('الرصد متاح فقط لأيام الحلقات من الأحد إلى الأربعاء', 'error');
      return;
    }

    setDraftEvaluations((prev) => {
      const updated: Record<string, StudentCriterionDraft> = {
        ...prev,
        [studentId]: {
          attendance: null,
          memorization: null,
          revision: null,
          discipline: null,
          uniform: null,
        },
      };

      autoSyncToStorage(updated, studentId);
      return updated;
    });
  };

  // Dedicated double-click handler on any criterion button: unconditionally resets that item to null
  const handleDoubleClickCriterion = (studentId: string, key: CriterionType) => {
    if (!isSelectedDateCircleDay) return;

    setDraftEvaluations((prev) => {
      const current = prev[studentId] || {
        attendance: null,
        memorization: null,
        revision: null,
        discipline: null,
        uniform: null,
      };

      const updatedStudent: StudentCriterionDraft = {
        ...current,
        [key]: null,
      };

      const updated: Record<string, StudentCriterionDraft> = {
        ...prev,
        [studentId]: updatedStudent,
      };

      autoSyncToStorage(updated, studentId);
      return updated;
    });
  };

  // Button «الكل كامل ✅» at the top - with two clicks/second click, it undoes/resets for all!
  const handleFillAllFullScore = () => {
    if (!isSelectedDateCircleDay) {
      showToast('الرصد متاح فقط لأيام الحلقات من الأحد إلى الأربعاء', 'error');
      return;
    }

    // Check if already all students are full score: if so, second click resets / undoes!
    const allAreFull = allCircleStudents.length > 0 && allCircleStudents.every((s) => {
      const d = draftEvaluations[s.id];
      return (
        d &&
        d.attendance === 'early' &&
        d.memorization === 2 &&
        d.revision === 2 &&
        d.discipline === 2 &&
        d.uniform === 2
      );
    });

    if (allAreFull) {
      const updated: Record<string, StudentCriterionDraft> = { ...draftEvaluations };
      allCircleStudents.forEach((s) => {
        updated[s.id] = {
          attendance: null,
          memorization: null,
          revision: null,
          discipline: null,
          uniform: null,
        };
      });
      setDraftEvaluations(updated);
      autoSyncToStorage(updated);
      return;
    }

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
  };

  // Direct selection of 2 / 1 / 0 buttons with toggle-to-unselect capability
  // Clicking the selected button a second time (نقرتين) unselects it and resets to null!
  const handleSelectCriterionValue = (
    studentId: string,
    key: CriterionType,
    targetVal: any
  ) => {
    if (!isSelectedDateCircleDay) {
      showToast('الرصد متاح فقط لأيام الحلقات من الأحد إلى الأربعاء', 'error');
      return;
    }

    setDraftEvaluations((prev) => {
      const current = prev[studentId] || {
        attendance: null,
        memorization: null,
        revision: null,
        discipline: null,
        uniform: null,
      };

      const isAlreadySelected = current[key] === targetVal;
      // With two clicks / clicking the selected button again, it resets it to null!
      const nextVal = isAlreadySelected ? null : targetVal;

      const updatedStudent: StudentCriterionDraft = {
        ...current,
        [key]: nextVal,
      };

      const updated: Record<string, StudentCriterionDraft> = {
        ...prev,
        [studentId]: updatedStudent,
      };

      autoSyncToStorage(updated, studentId);

      return updated;
    });
  };

  // Text button «غائب» sets all 5 items to 0 (absent / 0 / 0 / 0 / 0)
  // If already absent, clicking it again (second click) undoes the absence!
  const handleMarkStudentAbsent = (studentId: string, studentName: string) => {
    if (!isSelectedDateCircleDay) {
      showToast('الرصد متاح فقط لأيام الحلقات من الأحد إلى الأربعاء', 'error');
      return;
    }

    const current = draftEvaluations[studentId];
    const isAlreadyAbsent =
      current?.attendance === 'absent' &&
      current?.memorization === 0 &&
      current?.revision === 0 &&
      current?.discipline === 0 &&
      current?.uniform === 0;

    if (isAlreadyAbsent) {
      // Second click: UNDO absence!
      handleClearStudentEvaluation(studentId, studentName);
      return;
    }

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
    autoSyncToStorage(updated, studentId);
  };

  // Quick button inside card: set student full score (2 for all)
  // If already full score, clicking it again (second click) undoes full score!
  const handleSetStudentAllTop = (studentId: string, studentName: string) => {
    if (!isSelectedDateCircleDay) {
      showToast('الرصد متاح فقط لأيام الحلقات من الأحد إلى الأربعاء', 'error');
      return;
    }

    const current = draftEvaluations[studentId];
    const isAlreadyFull =
      current?.attendance === 'early' &&
      current?.memorization === 2 &&
      current?.revision === 2 &&
      current?.discipline === 2 &&
      current?.uniform === 2;

    if (isAlreadyFull) {
      // Second click: UNDO full score!
      handleClearStudentEvaluation(studentId, studentName);
      return;
    }

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
    autoSyncToStorage(updated, studentId);
  };

  // Non-current day line logic
  const todayISO = formatISODate(new Date());
  const isSelectedDateToday = selectedDate === todayISO;
  const isSelectedDateCircleDay = isCircleDay(selectedDate);
  const dayMatch = weekDays.find((d) => d.date === selectedDate);
  const selectedDayInfo = {
    dayName: dayMatch?.dayName || getArabicDayName(selectedDate),
    hijriFormatted: dayMatch?.hijriFormatted || formatHijriShortDate(selectedDate),
  };

  const handleResetToToday = () => {
    const now = new Date();
    const sunday = getSundayOfWeek(now);
    const days = getCircleDaysOfWeek(sunday);
    setCurrentWeekStart(sunday);
    const todayMatch = days.find((d) => d.date === todayISO);
    if (todayMatch) {
      setSelectedDate(todayISO);
    } else {
      // If today is Thursday, Friday, or Saturday (non-circle days), snap to Wednesday (last circle day of this week)
      const targetDate = now.getDay() >= 4 ? days[days.length - 1]?.date : days[0]?.date;
      setSelectedDate(targetDate || days[0]?.date || todayISO);
    }
  };

  const allAreFull = useMemo(() => {
    return (
      allCircleStudents.length > 0 &&
      allCircleStudents.every((s) => {
        const d = draftEvaluations[s.id];
        return (
          d &&
          d.attendance === 'early' &&
          d.memorization === 2 &&
          d.revision === 2 &&
          d.discipline === 2 &&
          d.uniform === 2
        );
      })
    );
  }, [allCircleStudents, draftEvaluations]);

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

          {/* Top Actions: Live Firestore Status Badge + Menu */}
          <div className="flex items-center gap-1.5 shrink-0">
            <FirestoreStatusBadge compact />

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

      {/* Main Navigation Tabs: «رصد اليوم» · «سجل الأسبوع» · «الطلاب» + «ترشيح للإختبار» */}
      <div className="bg-slate-200/90 p-1 rounded-2xl flex items-center gap-1 flex-wrap sm:flex-nowrap">
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

        {/* زر ترشيح للإختبار في الشريط الرئيسي */}
        <button
          type="button"
          onClick={() => setShowNominationModal(true)}
          className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-black transition-all min-h-[40px] cursor-pointer flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-2xs shrink-0 active:scale-95"
          title="ترشيح الطلاب لاختبار الأجزاء القرآنية"
        >
          <Award className="w-4 h-4 text-slate-950 shrink-0" />
          <span>ترشيح للإختبار</span>
        </button>
      </div>

      {/* Content View 1: رصد اليوم — مطوية بشكل افتراضي مع أزرار 2 · 1 · 0 */}
      {activeTab === 'daily' && (
        <div className="space-y-2.5 pb-6">
          {/* تنبيه في حال اختيار يوم خارج جدول الحلقات (الأحد - الأربعاء) */}
          {!isSelectedDateCircleDay && (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3 sm:p-3.5 text-xs text-amber-950 font-bold flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                <span className="truncate">
                  يوم ({selectedDayInfo.dayName}) خارج أيام الحلقات المقررة. الرصد متاح فقط من الأحد إلى الأربعاء.
                </span>
              </div>
              <button
                type="button"
                onClick={handleResetToToday}
                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shrink-0 cursor-pointer shadow-2xs transition-all active:scale-95"
              >
                الانتقال ليوم الحلقة
              </button>
            </div>
          )}

          {/* Top Bar: زر «الكل كامل ✅» */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleFillAllFullScore}
              disabled={!isSelectedDateCircleDay}
              className={`px-4 py-2.5 rounded-2xl bg-teal-800 hover:bg-teal-900 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs active:scale-98 transition-all min-h-[42px] ${
                !isSelectedDateCircleDay ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              }`}
              title={
                isSelectedDateCircleDay
                  ? allAreFull
                    ? 'انقر مرة ثانية للتراجع عن رصد جميع الطلاب وإفراغ السجل'
                    : 'تعبئة الدرجة الكاملة (2) لكافة الطلاب — انقر مرة أخرى للتراجع'
                  : 'الرصد متاح فقط من الأحد إلى الأربعاء'
              }
            >
              <span>الكل كامل ✅</span>
            </button>
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
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleClearStudentEvaluation(student.id, student.name);
                      }}
                      className="p-3 sm:p-3.5 flex items-center justify-between gap-2 cursor-pointer select-none bg-white hover:bg-slate-50/70 transition-colors"
                      title={isExpanded ? 'انقر لطي البطاقة (نقرتين للتراجع عن الرصد)' : 'انقر لفتح بطاقة الطالب (نقرتين للتراجع عن الرصد)'}
                    >
                      {/* Name and index */}
                      <div className="flex items-start sm:items-center gap-2 min-w-0 flex-1">
                        <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-black flex items-center justify-center shrink-0 border border-slate-200 mt-0.5 sm:mt-0">
                          {idx + 1}
                        </span>
                        <span className="font-extrabold text-sm sm:text-base text-slate-900 break-words leading-tight sm:leading-snug">
                          {student.name}
                        </span>
                      </div>

                      {/* Status + Quick Undo + Text Absence Button + Chevron */}
                      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        {/* الحالة المكتوبة: «اكتمل 5/5» أو «بقي N» */}
                        {isComplete ? (
                          <span className="text-[11px] font-black px-2.5 py-0.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-300">
                            اكتمل 5/5 ✓
                          </span>
                        ) : recordedCount > 0 ? (
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-300">
                            رُصد {recordedCount}/5
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-xl bg-slate-100 text-slate-600 border border-slate-200">
                            لم يُرصد
                          </span>
                        )}

                        {/* زر «غائب» نصياً يضبط كل البنود على 0 أو يتراجع إذا كان غائباً بالفعل */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkStudentAbsent(student.id, student.name);
                          }}
                          className={`px-2.5 py-1 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer transition-all active:scale-95 ${
                            studentDraft?.attendance === 'absent' && studentDraft?.memorization === 0
                              ? 'text-white bg-rose-600 hover:bg-rose-700 border border-rose-600 shadow-xs'
                              : 'text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200'
                          }`}
                          title="تسجيل الطالب غائباً (أو انقر نقرتين للتراجع)"
                        >
                          <UserX className="w-3.5 h-3.5" />
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
                                  onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    handleDoubleClickCriterion(student.id, row.key);
                                  }}
                                  className={`h-[38px] rounded-xl text-sm font-black border transition-all flex items-center justify-center cursor-pointer select-none active:scale-95 ${
                                    currentVal === row.fullVal
                                      ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs ring-2 ring-emerald-500/30'
                                      : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 border-slate-200'
                                  }`}
                                  title="2 (كاملة) — انقر مرة ثانية أو نقرتين للتراجع عن الرصد"
                                >
                                  2
                                </button>

                                {/* 2. القيمة 1 */}
                                <button
                                  type="button"
                                  style={{ touchAction: 'manipulation' }}
                                  onClick={() => handleSelectCriterionValue(student.id, row.key, row.partialVal)}
                                  onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    handleDoubleClickCriterion(student.id, row.key);
                                  }}
                                  className={`h-[38px] rounded-xl text-sm font-black border transition-all flex items-center justify-center cursor-pointer select-none active:scale-95 ${
                                    currentVal === row.partialVal
                                      ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs ring-2 ring-amber-400/30'
                                      : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 border-slate-200'
                                  }`}
                                  title="1 (جزئية) — انقر مرة ثانية أو نقرتين للتراجع عن الرصد"
                                >
                                  1
                                </button>

                                {/* 3. القيمة 0 */}
                                <button
                                  type="button"
                                  style={{ touchAction: 'manipulation' }}
                                  onClick={() => handleSelectCriterionValue(student.id, row.key, row.zeroVal)}
                                  onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    handleDoubleClickCriterion(student.id, row.key);
                                  }}
                                  className={`h-[38px] rounded-xl text-sm font-black border transition-all flex items-center justify-center cursor-pointer select-none active:scale-95 ${
                                    currentVal === row.zeroVal
                                      ? 'bg-rose-600 text-white border-rose-600 shadow-xs ring-2 ring-rose-500/30'
                                      : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 border-slate-200'
                                  }`}
                                  title="0 (لا شيء) — انقر مرة ثانية أو نقرتين للتراجع عن الرصد"
                                >
                                  0
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        {/* شريط الإجراءات السريعة أسفل البطاقة المفتوحة */}
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/80 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleSetStudentAllTop(student.id, student.name)}
                              className="px-3 py-1.5 rounded-xl text-xs font-black bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-300 flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95 transition-all"
                              title="تعيين الدرجة الكاملة لكافة البنود (انقر مرة ثانية للتراجع)"
                            >
                              <span>الدرجة الكاملة (2 للكل)</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleMarkStudentAbsent(student.id, student.name)}
                              className="px-3 py-1.5 rounded-xl text-xs font-black text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-300 flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95 transition-all"
                              title="تسجيل غائب لجميع البنود (انقر مرة ثانية للتراجع)"
                            >
                              <UserX className="w-3.5 h-3.5" />
                              <span>تسجيل غائب (0 للكل)</span>
                            </button>
                          </div>
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
                <div className="flex items-start sm:items-center gap-2 min-w-0 flex-1">
                  <span className="w-6 h-6 rounded-lg bg-teal-100 text-teal-950 font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5 sm:mt-0">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-slate-800 block break-words leading-snug">{s.name}</span>
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

      {/* مودال ترشيح الطلاب للاختبارات */}
      {showNominationModal && (
        <ExamNominationModal
          isOpen={showNominationModal}
          onClose={() => setShowNominationModal(false)}
          students={allCircleStudents}
          circle={selectedCircle}
        />
      )}
    </div>
  );
};
