import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Student, Circle, getStudentIdFieldLabel } from '../../types';
import { repository } from '../../services/storageService';
import { useToast } from '../../context/ToastContext';
import {
  Search,
  X,
  User,
  CreditCard,
  PhoneCall,
  Save,
  MessageSquare,
  Check,
  Eye,
  GraduationCap,
  Users as UsersIcon,
  Trophy,
  ChevronDown,
  AlertTriangle,
  RotateCcw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CalendarDays,
} from 'lucide-react';
import { StudentPointsLogModal } from '../common/StudentPointsLogModal';
import { calculateAge } from '../../utils/dateUtils';
import {
  ATTENDANCE_THRESHOLDS,
  getAttendanceStatusMeta,
} from '../../utils/attendanceThresholds';

interface NeedsAttentionListProps {
  students: Student[];
}

type SortBy = 'points' | 'attendance' | 'absences';
type SortDir = 'desc' | 'asc';

const PAGE_SIZE = 25;

const VALID_SORTS: SortBy[] = ['points', 'attendance', 'absences'];

export const NeedsAttentionList: React.FC<NeedsAttentionListProps> = ({ students }) => {
  const circles = repository.getCircles();
  const teachers = repository.getTeachers();
  const validCircleIds = useMemo(() => new Set(repository.getCircles().map((c) => c.id)), []);

  const getCircleTeacherName = (circle?: Circle): string => {
    if (!circle) return '';
    if (circle.teacherName?.trim()) return circle.teacherName.trim();
    const matchedTeacher = teachers.find(
      (t) => t.id === circle.teacherId || (Array.isArray(t.circleIds) && t.circleIds.includes(circle.id))
    );
    return matchedTeacher?.name?.trim() || '';
  };

  // Read initial filters/sort from URL query string
  const readInitialState = () => {
    if (typeof window === 'undefined') {
      return {
        search: '',
        circleFilter: 'all',
        sortBy: 'points' as SortBy,
        sortDir: 'desc' as SortDir,
      };
    }
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q') || '';
    const rawCircle = params.get('circle') || 'all';
    const circleFilter = rawCircle !== 'all' && validCircleIds.has(rawCircle) ? rawCircle : 'all';
    const rawSort = params.get('sort') as SortBy | null;
    const sortBy: SortBy = rawSort && VALID_SORTS.includes(rawSort) ? rawSort : 'points';
    const rawDir = params.get('dir');
    const sortDir: SortDir = rawDir === 'asc' ? 'asc' : 'desc';

    return {
      search: q,
      circleFilter,
      sortBy,
      sortDir,
    };
  };

  const initial = useMemo(readInitialState, [validCircleIds]);

  const [search, setSearch] = useState<string>(initial.search);
  const [circleFilter, setCircleFilter] = useState<string>(initial.circleFilter);
  const [sortBy, setSortBy] = useState<SortBy>(initial.sortBy);
  const [sortDir, setSortDir] = useState<SortDir>(initial.sortDir);
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [pointsLogStudent, setPointsLogStudent] = useState<Student | null>(null);
  const [showNationalId, setShowNationalId] = useState(false);
  const [editingNote, setEditingNote] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const { showToast } = useToast();

  const activeStudents = useMemo(() => students.filter((s) => s.active), [students]);

  // Sync filters & sort to URL without disturbing unrelated params
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);

    if (search.trim()) params.set('q', search.trim());
    else params.delete('q');

    if (circleFilter !== 'all') params.set('circle', circleFilter);
    else params.delete('circle');

    if (sortBy !== 'points') params.set('sort', sortBy);
    else params.delete('sort');

    if (sortDir !== 'desc') params.set('dir', sortDir);
    else params.delete('dir');

    // Clean up obsolete filter params if present in older links
    params.delete('circles');
    params.delete('status');
    params.delete('flagged');
    params.delete('period');

    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState(null, '', nextUrl);
    }
  }, [search, circleFilter, sortBy, sortDir]);

  // Reset pagination whenever filters/sort change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, circleFilter, sortBy, sortDir]);

  // Pre-calculate attendance stats for each active student
  const studentStatsMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof repository.getStudentAttendanceStats>>();
    activeStudents.forEach((s) => {
      map.set(s.id, repository.getStudentAttendanceStats(s.id));
    });
    return map;
  }, [activeStudents]);

  const getStudentFlag = useCallback(
    (student: Student) => {
      const attStats =
        studentStatsMap.get(student.id) || repository.getStudentAttendanceStats(student.id);

      if (student.attentionReason) {
        return {
          isFlagged: true,
          type: 'custom' as const,
          label: student.attentionReason,
          badge: 'ملاحظة خاصة',
        };
      }
      if (student.consecutiveAbsences >= ATTENDANCE_THRESHOLDS.CONSECUTIVE_ABSENCES_ALERT) {
        return {
          isFlagged: true,
          type: 'absent' as const,
          label: `غياب متكرر (${student.consecutiveAbsences} أيام متتالية)`,
          badge: 'كثرة غياب',
        };
      }
      if (student.daysWithoutLog >= ATTENDANCE_THRESHOLDS.DAYS_WITHOUT_LOG_ALERT) {
        return {
          isFlagged: true,
          type: 'inactive' as const,
          label: `انقطاع عن التسميع منذ ${student.daysWithoutLog} أيام`,
          badge: 'انقطاع تسميع',
        };
      }
      if (attStats.hasRecords && attStats.attendanceRate < ATTENDANCE_THRESHOLDS.FOLLOW_UP_MIN) {
        return {
          isFlagged: true,
          type: 'low_attendance' as const,
          label: `انخفاض نسبة الحضور (${attStats.attendanceRate}%)`,
          badge: 'يحتاج تدخلاً',
        };
      }
      return {
        isFlagged: false,
        type: 'regular' as const,
        label: 'منتظم وبحالة انضباط ممتازة',
        badge: 'منتظم',
      };
    },
    [studentStatsMap]
  );

  // Filter and sort students with directional toggle (desc / asc)
  const rankedStudents = useMemo(() => {
    const q = search.trim();
    const filtered = activeStudents.filter((s) => {
      if (circleFilter !== 'all' && s.circleId !== circleFilter) return false;
      if (q && !s.name.includes(q)) return false;
      return true;
    });

    const dirFactor = sortDir === 'desc' ? 1 : -1;

    return [...filtered].sort((a, b) => {
      const statsA = studentStatsMap.get(a.id);
      const statsB = studentStatsMap.get(b.id);
      const presentA = statsA?.presentDays || 0;
      const presentB = statsB?.presentDays || 0;
      const absentA = statsA?.absentDays || 0;
      const absentB = statsB?.absentDays || 0;
      const rateA = statsA?.hasRecords ? statsA.attendanceRate : 0;
      const rateB = statsB?.hasRecords ? statsB.attendanceRate : 0;

      if (sortBy === 'points') {
        if (b.currentPoints !== a.currentPoints) {
          return (b.currentPoints - a.currentPoints) * dirFactor;
        }
        if (rateB !== rateA) return rateB - rateA;
        if (presentB !== presentA) return presentB - presentA;
        return a.name.localeCompare(b.name, 'ar');
      }

      if (sortBy === 'attendance') {
        if (presentB !== presentA) {
          return (presentB - presentA) * dirFactor;
        }
        if (rateB !== rateA) return rateB - rateA;
        if (b.currentPoints !== a.currentPoints) return b.currentPoints - a.currentPoints;
        return a.name.localeCompare(b.name, 'ar');
      }

      // absences
      if (absentB !== absentA) {
        return (absentB - absentA) * dirFactor;
      }
      if (rateA !== rateB) return rateA - rateB;
      if (a.currentPoints !== b.currentPoints) return a.currentPoints - b.currentPoints;
      return a.name.localeCompare(b.name, 'ar');
    });
  }, [activeStudents, circleFilter, search, sortBy, sortDir, studentStatsMap]);

  // Podium Logic:
  // Shown only for descending merit sorts (points / attendance) when not searching and data is strong & non-tied.
  const podiumAnalysis = useMemo(() => {
    const isMeritSort = sortDir === 'desc' && (sortBy === 'points' || sortBy === 'attendance');
    if (search.trim() || !isMeritSort || rankedStudents.length < 3) {
      return { showPodium: false, entries: [] as { student: Student; isTied: boolean }[] };
    }

    const top3 = rankedStudents.slice(0, 3);
    const tuples = top3.map((s) => {
      const st = studentStatsMap.get(s.id) || repository.getStudentAttendanceStats(s.id);
      if (sortBy === 'points') {
        return {
          primary: s.currentPoints,
          secondary: st.hasRecords ? st.attendanceRate : 0,
          tertiary: st.presentDays,
          hasData: s.currentPoints > 0,
        };
      }
      return {
        primary: st.presentDays,
        secondary: st.hasRecords ? st.attendanceRate : 0,
        tertiary: s.currentPoints,
        hasData: st.hasRecords && st.presentDays > 0,
      };
    });

    if (tuples.some((t) => !t.hasData)) {
      return { showPodium: false, entries: [] };
    }

    const allThreeCompletelyTied =
      tuples[0].primary === tuples[1].primary &&
      tuples[1].primary === tuples[2].primary &&
      tuples[0].secondary === tuples[1].secondary &&
      tuples[1].secondary === tuples[2].secondary &&
      tuples[0].tertiary === tuples[1].tertiary &&
      tuples[1].tertiary === tuples[2].tertiary;

    if (allThreeCompletelyTied) {
      return { showPodium: false, entries: [] };
    }

    const entries = top3.map((student, idx) => {
      const p = tuples[idx].primary;
      const primaryTieCount = tuples.filter((t) => t.primary === p).length;
      return {
        student,
        isTied: primaryTieCount > 1,
      };
    });

    return { showPodium: true, entries };
  }, [search, sortBy, sortDir, rankedStudents, studentStatsMap]);

  const showPodium = podiumAnalysis.showPodium;
  const listStudents = showPodium ? rankedStudents.slice(3) : rankedStudents;
  const paginatedStudents = listStudents.slice(0, visibleCount);
  const rankOffset = showPodium ? 4 : 1;

  const getPodiumMetricLabel = (s: Student) => {
    const stats = studentStatsMap.get(s.id) || repository.getStudentAttendanceStats(s.id);
    if (sortBy === 'attendance') {
      return `${stats.presentDays} يوم حضور · ${s.currentPoints} ن`;
    }
    return `${s.currentPoints} نقطة · حضور ${stats.presentDays}`;
  };

  const hasAnyActiveFilter = search.trim().length > 0 || circleFilter !== 'all';

  const clearAllFilters = () => {
    setSearch('');
    setCircleFilter('all');
  };

  const handleSortColumn = (field: SortBy) => {
    if (sortBy === field) {
      setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  const renderSortIcon = (field: SortBy) => {
    if (sortBy !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
    }
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-teal-700 shrink-0" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-teal-700 shrink-0" />
    );
  };

  const handleOpenStudentModal = (student: Student) => {
    setSelectedStudent(student);
    setEditingNote(student.attentionReason || '');
    setShowNationalId(false);
    setShowClearConfirm(false);
  };

  const handleShowIdWithAudit = () => {
    if (!selectedStudent) return;
    setShowNationalId(true);
    repository.addAuditLog({
      actorId: 'supervisor',
      actorName: 'المشرف العام',
      actorRole: 'supervisor',
      action: 'عرض بيانات حساسة',
      details: `تمت معاينة رقم الهوية الوطنية للطالب (${selectedStudent.name})`,
      targetType: 'student',
      targetId: selectedStudent.id,
    });
    showToast('تم إظهار الهوية وتسجيل إجراء المعاينة في سجل التدقيق ✓', 'info');
  };

  const handleSaveNote = () => {
    if (!selectedStudent) return;
    const updated: Student = {
      ...selectedStudent,
      attentionReason: editingNote.trim() || undefined,
    };

    const res = repository.saveStudent(updated, {
      id: 'supervisor',
      name: 'المشرف العام',
      role: 'supervisor',
    });

    if (res.success) {
      showToast('تم حفظ ملاحظات الطالب بنجاح ✓', 'success');
      setSelectedStudent(updated);
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleClearNoteConfirm = () => {
    if (!selectedStudent) return;
    const updated: Student = {
      ...selectedStudent,
      attentionReason: undefined,
      consecutiveAbsences: 0,
      daysWithoutLog: 0,
    };

    const res = repository.saveStudent(updated, {
      id: 'supervisor',
      name: 'المشرف العام',
      role: 'supervisor',
    });

    if (res.success) {
      showToast('تمت إزالة حالة المتابعة وتحديث السجل بنجاح ✓', 'info');
      setEditingNote('');
      setShowClearConfirm(false);
      setSelectedStudent(updated);
    }
  };

  const maskNationalId = (idStr?: string) => {
    const base = (idStr || '').trim();
    if (!base) return '—';
    if (base.length <= 4) return '****';
    const prefixLen = Math.min(4, Math.max(2, base.length - 4));
    return base.slice(0, prefixLen) + '****' + base.slice(-2);
  };

  const selectedCircle = circles.find((c) => c.id === circleFilter);
  const selectedCircleTeacher = getCircleTeacherName(selectedCircle);
  const selectedCircleLabel = selectedCircle
    ? selectedCircleTeacher
      ? `${selectedCircleTeacher} · ${selectedCircle.name}`
      : selectedCircle.name
    : '';

  return (
    <div className="space-y-3 pb-28 select-text">
      {/* Simple Search + Circle Name Dropdown Filter Bar */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200/90 shadow-2xs space-y-2.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث باسم الطالب..."
              className="w-full pr-9 pl-8 py-2 text-xs sm:text-[13px] rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-hidden focus:border-teal-600 min-h-[40px] placeholder:text-slate-400 font-medium"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="مسح البحث"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <select
            value={circleFilter}
            onChange={(e) => setCircleFilter(e.target.value)}
            aria-label="تصفية حسب المعلم والحلقة"
            className="sm:w-80 md:w-[340px] px-3 py-2 text-xs sm:text-[13px] rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-bold min-h-[40px] cursor-pointer focus:bg-white focus:outline-hidden focus:border-teal-600 shrink-0"
          >
            <option value="all">جميع الحلقات</option>
            {circles.map((c) => {
              const teacherName = getCircleTeacherName(c);
              return (
                <option key={c.id} value={c.id}>
                  {teacherName ? `${teacherName} · ${c.name}` : c.name}
                </option>
              );
            })}
          </select>
        </div>

        {/* Active Filter Summary when searching or selecting a circle */}
        {hasAnyActiveFilter && (
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {search.trim() && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 text-teal-900 border border-teal-200 text-[11px] font-bold hover:bg-teal-100 cursor-pointer"
                >
                  <span>بحث: {search.trim()}</span>
                  <X className="w-3 h-3" />
                </button>
              )}

              {circleFilter !== 'all' && selectedCircleLabel && (
                <button
                  type="button"
                  onClick={() => setCircleFilter('all')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 text-teal-900 border border-teal-200 text-[11px] font-bold hover:bg-teal-100 cursor-pointer"
                >
                  <span>{selectedCircleLabel}</span>
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5 mr-auto">
              <span className="text-[11px] font-bold text-slate-600 tabular-nums">
                عرض {rankedStudents.length} من {activeStudents.length}
              </span>
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-[11px] font-extrabold text-rose-700 hover:text-rose-900 underline cursor-pointer"
              >
                مسح الكل
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Top 3 Podium */}
      {showPodium && (
        <div className="space-y-2 pt-0.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-500" />
              <span>المراكز الثلاثة الأولى</span>
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 w-full items-stretch">
            {[1, 0, 2].map((podiumIdx) => {
              const entry = podiumAnalysis.entries[podiumIdx];
              const student = entry.student;
              const circle = circles.find((c) => c.id === student.circleId);
              const teacherName = getCircleTeacherName(circle);
              const isGold = podiumIdx === 0;
              const medal = podiumIdx === 0 ? '🥇' : podiumIdx === 1 ? '🥈' : '🥉';

              return (
                <div
                  key={student.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleOpenStudentModal(student)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleOpenStudentModal(student);
                    }
                  }}
                  className={`rounded-xl p-2.5 text-center flex flex-col items-center justify-between cursor-pointer transition-all min-h-[124px] ${
                    isGold
                      ? 'bg-gradient-to-b from-amber-50/80 to-white border-2 border-amber-300 hover:border-amber-400 shadow-2xs'
                      : 'bg-white border border-slate-200/90 hover:border-teal-400 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <span className="text-xl leading-none">{medal}</span>
                    {entry.isTied && (
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-black leading-none">
                        تعادل
                      </span>
                    )}
                  </div>

                  <span className="text-xs font-extrabold text-slate-900 line-clamp-2 text-center leading-snug w-full">
                    {student.name}
                  </span>

                  {teacherName && (
                    <span className="text-[11px] text-slate-700 font-bold truncate w-full mt-0.5">
                      {teacherName}
                    </span>
                  )}
                  <span
                    className={`text-[10px] text-slate-400 font-medium truncate w-full ${
                      !teacherName ? 'mt-0.5' : ''
                    }`}
                  >
                    {circle?.name || 'عامة'}
                  </span>

                  <span
                    className={`text-[11px] font-black tabular-nums mt-1.5 ${
                      isGold ? 'text-amber-900' : 'text-teal-800'
                    }`}
                  >
                    {getPodiumMetricLabel(student)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Student List: Empty State, Desktop Table with Sort Arrows, Mobile 2-Line Cards + Sort Bar */}
      {rankedStudents.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 space-y-3">
          <p className="text-sm font-black text-slate-800">لا نتائج مطابقة للتصفية الحالية</p>
          <p className="text-xs text-slate-500 font-medium">
            جرّب تغيير البحث أو اختيار حلقة أخرى لعرض الطلاب.
          </p>
          {hasAnyActiveFilter && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>مسح الكل</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {/* Header with Total Count + Mobile Quick Sort Arrows */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="text-xs sm:text-[13px] font-black text-slate-700 tabular-nums">
                قائمة الطلاب ({rankedStudents.length})
              </span>
            </div>

            {showPodium && (
              <span className="hidden md:inline text-[11px] text-slate-500 font-medium">
                {listStudents.length > 0
                  ? 'المراكز 1–3 معروضة في المنصة أعلاه'
                  : 'الطلاب الثلاثة معروضون في المنصة أعلاه'}
              </span>
            )}

            {/* Mobile Quick Sort Bar (mirrors desktop clickable table column arrows) */}
            {listStudents.length > 0 && (
              <div className="flex md:hidden items-center gap-1.5">
                {(
                  [
                    { field: 'attendance' as SortBy, label: 'حضور' },
                    { field: 'absences' as SortBy, label: 'غياب' },
                    { field: 'points' as SortBy, label: 'نقاط' },
                  ] as const
                ).map(({ field, label }) => {
                  const active = sortBy === field;
                  return (
                    <button
                      key={field}
                      type="button"
                      onClick={() => handleSortColumn(field)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-colors cursor-pointer ${
                        active
                          ? 'bg-teal-50 text-teal-900 border-teal-300'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span>{label}</span>
                      {renderSortIcon(field)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {listStudents.length > 0 && (
            <>
              {/* Desktop Data Table with Clickable Sort Arrows on حضور، غياب، نقاط */}
              <div className="hidden md:block bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-600">
                      <th className="py-2.5 px-3 w-16 text-center">الترتيب</th>
                      <th className="py-2.5 px-3">الطالب</th>
                      <th className="py-2.5 px-3">المعلم والحلقة</th>
                      <th className="py-2 px-3 w-24 text-center">
                        <button
                          type="button"
                          onClick={() => handleSortColumn('attendance')}
                          className={`inline-flex items-center justify-center gap-1 px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                            sortBy === 'attendance'
                              ? 'text-teal-800 bg-teal-50/90'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                          }`}
                          title="ترتيب حسب الحضور"
                        >
                          <span>حضور</span>
                          {renderSortIcon('attendance')}
                        </button>
                      </th>
                      <th className="py-2 px-3 w-24 text-center">
                        <button
                          type="button"
                          onClick={() => handleSortColumn('absences')}
                          className={`inline-flex items-center justify-center gap-1 px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                            sortBy === 'absences'
                              ? 'text-teal-800 bg-teal-50/90'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                          }`}
                          title="ترتيب حسب الغياب"
                        >
                          <span>غياب</span>
                          {renderSortIcon('absences')}
                        </button>
                      </th>
                      <th className="py-2 px-3 w-24 text-left">
                        <button
                          type="button"
                          onClick={() => handleSortColumn('points')}
                          className={`inline-flex items-center justify-end gap-1 px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                            sortBy === 'points'
                              ? 'text-teal-800 bg-teal-50/90'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                          }`}
                          title="ترتيب حسب النقاط"
                        >
                          <span>نقاط</span>
                          {renderSortIcon('points')}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {paginatedStudents.map((student, index) => {
                      const currentRank = rankOffset + index;
                      const circle = circles.find((c) => c.id === student.circleId);
                      const teacherName = getCircleTeacherName(circle);
                      const flag = getStudentFlag(student);
                      const stats =
                        studentStatsMap.get(student.id) ||
                        repository.getStudentAttendanceStats(student.id);

                      return (
                        <tr
                          key={student.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleOpenStudentModal(student)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleOpenStudentModal(student);
                            }
                          }}
                          className={`cursor-pointer transition-colors hover:bg-teal-50/50 ${
                            stats.absentDays >= 3
                              ? 'bg-rose-50/25'
                              : flag.isFlagged
                              ? 'bg-amber-50/20'
                              : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center font-black text-slate-600 tabular-nums">
                            #{currentRank}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900">{student.name}</span>
                              {flag.isFlagged && (
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold"
                                  title={flag.label}
                                >
                                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                                  <span>{flag.badge}</span>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            {teacherName && (
                              <div className="text-xs font-bold text-slate-800 leading-snug">
                                {teacherName}
                              </div>
                            )}
                            <div
                              className={
                                teacherName
                                  ? 'text-[10px] text-slate-500 font-medium mt-0.5'
                                  : 'text-xs font-semibold text-slate-700 leading-snug'
                              }
                            >
                              {circle?.name || 'عامة'}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold tabular-nums">
                            {stats.hasRecords ? (
                              <span className="text-emerald-700">{stats.presentDays}</span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold tabular-nums">
                            {stats.hasRecords ? (
                              <span className={stats.absentDays > 0 ? 'text-rose-600' : 'text-slate-500'}>
                                {stats.absentDays}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-left font-black text-teal-800 tabular-nums">
                            {student.currentPoints}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile 2-Line Cards (shown below md) */}
              <div className="md:hidden space-y-2">
                {paginatedStudents.map((student, index) => {
                  const currentRank = rankOffset + index;
                  const circle = circles.find((c) => c.id === student.circleId);
                  const teacherName = getCircleTeacherName(circle);
                  const flag = getStudentFlag(student);
                  const stats =
                    studentStatsMap.get(student.id) ||
                    repository.getStudentAttendanceStats(student.id);

                  return (
                    <div
                      key={student.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleOpenStudentModal(student)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleOpenStudentModal(student);
                        }
                      }}
                      className={`bg-white rounded-xl px-3 py-2.5 border shadow-2xs transition-colors cursor-pointer space-y-1 select-text ${
                        stats.absentDays >= 3
                          ? 'border-rose-200/80 bg-rose-50/15'
                          : flag.isFlagged
                          ? 'border-amber-200/80 bg-amber-50/15'
                          : 'border-slate-200/90 hover:border-teal-300'
                      }`}
                    >
                      {/* Line 1: Rank + Student Name + Optional Alert Pill */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[11px] font-black text-slate-500 tabular-nums shrink-0">
                            #{currentRank}
                          </span>
                          <h4 className="text-xs sm:text-[13px] font-bold text-slate-900 truncate">
                            {student.name}
                          </h4>
                        </div>
                        {flag.isFlagged && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded-md shrink-0">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            <span>{flag.badge}</span>
                          </span>
                        )}
                      </div>

                      {/* Line 2: Teacher (primary) & Circle (smaller) + Attendance/Absence + Points */}
                      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                        <div className="flex flex-wrap items-baseline gap-x-1">
                          {teacherName && (
                            <span className="text-[11px] text-slate-800 font-bold">
                              {teacherName}
                            </span>
                          )}
                          <span
                            className={
                              teacherName
                                ? 'text-[10px] text-slate-500 font-medium'
                                : 'text-[11px] text-slate-600 font-medium'
                            }
                          >
                            {teacherName ? `· ${circle?.name || 'عامة'}` : circle?.name || 'عامة'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 text-[11px] font-bold tabular-nums mr-auto">
                          {stats.hasRecords ? (
                            <>
                              <span className="text-emerald-700">حضور {stats.presentDays}</span>
                              <span className="text-slate-300">·</span>
                              <span className={stats.absentDays > 0 ? 'text-rose-600' : 'text-slate-500'}>
                                غياب {stats.absentDays}
                              </span>
                            </>
                          ) : (
                            <span className="text-slate-400 font-medium">بلا رصد</span>
                          )}
                          <span className="text-slate-300">·</span>
                          <span className="text-teal-800 font-black">{student.currentPoints} ن</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination: 25 rows initially with «عرض المزيد» */}
              {listStudents.length > visibleCount && (
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                  className="w-full py-2.5 rounded-xl bg-white border border-slate-200 text-teal-800 text-xs font-bold hover:bg-slate-50 shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors tabular-nums"
                >
                  <span>عرض المزيد ({listStudents.length - visibleCount} طالب متبقٍ)</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Student Detail Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[88vh] overflow-y-auto border border-slate-200 shadow-2xl p-5 space-y-4 text-right relative select-text">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center font-black text-base shadow-2xs">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900">
                    بطاقة الطالب وسجل المتابعة
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {selectedStudent.name} · كود الطالب: {selectedStudent.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Attendance & Points Summary Card (4 columns) */}
            {(() => {
              const mStats = repository.getStudentAttendanceStats(selectedStudent.id);
              const circle = circles.find((c) => c.id === selectedStudent.circleId);
              const teacherName = getCircleTeacherName(circle);

              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-bold">
                  {/* عدد أيام الحضور */}
                  <div className="bg-emerald-50/80 p-2.5 rounded-2xl border border-emerald-200/90">
                    <span className="text-[10px] text-emerald-800 block font-bold">أيام الحضور</span>
                    <span className="text-sm font-black text-emerald-950 block mt-0.5 tabular-nums">
                      {mStats.presentDays > 0 ? `${mStats.presentDays} يوم` : '0'}
                    </span>
                    <span className="text-[9px] text-emerald-700 font-medium block">
                      رصد (2 أو 1)
                    </span>
                  </div>

                  {/* النقاط الحالية */}
                  <div className="bg-amber-50/80 p-2.5 rounded-2xl border border-amber-200/90">
                    <span className="text-[10px] text-amber-800 block font-bold">رصيد النقاط</span>
                    <span className="text-sm font-black text-amber-950 block mt-0.5 tabular-nums">
                      {selectedStudent.currentPoints} نقطة
                    </span>
                    <span className="text-[9px] text-amber-700 font-medium block">
                      إجمالي الرصيد
                    </span>
                  </div>

                  {/* عدد أيام الغياب */}
                  <div className="bg-rose-50/80 p-2.5 rounded-2xl border border-rose-200/90">
                    <span className="text-[10px] text-rose-800 block font-bold">أيام الغياب</span>
                    <span className="text-sm font-black text-rose-950 block mt-0.5 tabular-nums">
                      {mStats.absentDays > 0 ? `${mStats.absentDays} يوم` : '0'}
                    </span>
                    <span className="text-[9px] text-rose-700 font-medium block">
                      رصد (0)
                    </span>
                  </div>

                  {/* نسبة الحضور */}
                  <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
                    <span className="text-[10px] text-slate-500 block font-bold">نسبة الانضباط</span>
                    <span
                      className={`text-sm font-black block mt-0.5 tabular-nums ${
                        mStats.hasRecords
                          ? getAttendanceStatusMeta(mStats.attendanceRate, mStats.hasRecords).textClass
                          : 'text-slate-400'
                      }`}
                    >
                      {mStats.hasRecords ? `${mStats.attendanceRate}%` : '—'}
                    </span>
                    <span className="text-[9px] text-slate-500 font-bold block">
                      {getAttendanceStatusMeta(mStats.attendanceRate, mStats.hasRecords).label}
                    </span>
                    {teacherName && (
                      <span className="text-[10px] text-slate-700 font-bold block truncate mt-0.5">
                        {teacherName}
                      </span>
                    )}
                    <span
                      className={`text-[9px] text-slate-400 font-medium block truncate ${
                        !teacherName ? 'mt-0.5' : ''
                      }`}
                    >
                      {circle?.name || 'عامة'}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Student Daily Points Log Trigger */}
            <button
              type="button"
              onClick={() => setPointsLogStudent(selectedStudent)}
              className="w-full py-2.5 px-3.5 rounded-2xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-2xs cursor-pointer"
            >
              <CalendarDays className="w-4 h-4 text-teal-100 shrink-0" />
              <span>سجل النقاط</span>
            </button>

            {/* Official Demographic Information List */}
            <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-200/90 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-teal-700" />
                  <span>البيانات الشخصية ومعلومات الاتصال</span>
                </h4>
                {selectedStudent.profileCompleted ? (
                  <span className="text-[10px] font-black text-emerald-800 bg-emerald-100/90 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-700" />
                    <span>مكتملة البيانات</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                    فارغة
                  </span>
                )}
              </div>

              {/* 1. قسم البيانات الشخصية والهوية */}
              <div>
                <div className="text-[11px] font-black text-teal-900 mb-1 flex items-center gap-1">
                  <User className="w-3 h-3 text-teal-700" />
                  <span>البيانات الشخصية والهوية:</span>
                </div>
                <div className="divide-y divide-slate-200/70 flex flex-col text-xs font-medium bg-white rounded-xl p-2.5 border border-slate-200/70">
                  <div className="py-1.5 flex items-center justify-between gap-2">
                    <span className="text-slate-500 font-bold shrink-0">اسم الطالب الرباعي:</span>
                    <span className={`text-left ${selectedStudent.fullNameQuad ? 'font-extrabold text-slate-900' : 'text-slate-400'}`}>
                      {selectedStudent.fullNameQuad || '—'}
                    </span>
                  </div>

                  <div className="py-1.5 flex items-center justify-between gap-2">
                    <span className="text-slate-500 font-bold shrink-0">
                      {getStudentIdFieldLabel(selectedStudent.idType)}:
                    </span>
                    {selectedStudent.nationalId ? (
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900 tabular-nums">
                          {showNationalId
                            ? selectedStudent.nationalId
                            : maskNationalId(selectedStudent.nationalId)}
                        </span>
                        {!showNationalId && (
                          <button
                            type="button"
                            onClick={handleShowIdWithAudit}
                            className="px-2 py-0.5 rounded-md bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Eye className="w-3 h-3 text-teal-700" />
                            <span>إظهار</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </div>

                  <div className="py-1.5 flex items-center justify-between gap-2">
                    <span className="text-slate-500 font-bold shrink-0">الجنسية:</span>
                    <span className={selectedStudent.nationality ? 'font-bold text-slate-900' : 'text-slate-400'}>
                      {selectedStudent.nationality || '—'}
                    </span>
                  </div>

                  <div className="py-1.5 flex items-center justify-between gap-2">
                    <span className="text-slate-500 font-bold shrink-0">تاريخ الميلاد:</span>
                    <span className={selectedStudent.birthDate ? 'font-bold text-slate-900 tabular-nums' : 'text-slate-400'}>
                      {selectedStudent.birthDate || '—'}
                    </span>
                  </div>

                  <div className="py-1.5 flex items-center justify-between gap-2">
                    <span className="text-slate-500 font-bold shrink-0">عمر الطالب:</span>
                    <span className={selectedStudent.birthDate || selectedStudent.age ? 'font-black text-teal-900 tabular-nums' : 'text-slate-400'}>
                      {selectedStudent.birthDate && calculateAge(selectedStudent.birthDate) !== null
                        ? `${calculateAge(selectedStudent.birthDate)} سنة`
                        : selectedStudent.age
                        ? `${selectedStudent.age} سنة`
                        : '—'}
                    </span>
                  </div>

                  <div className="py-1.5 flex items-center justify-between gap-2">
                    <span className="text-slate-500 font-bold shrink-0">مكان الميلاد:</span>
                    <span className={selectedStudent.birthPlace ? 'font-bold text-slate-900' : 'text-slate-400'}>
                      {selectedStudent.birthPlace || '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. قسم البيانات الدراسية والسكن */}
              <div>
                <div className="text-[11px] font-black text-teal-900 mb-1 flex items-center gap-1">
                  <GraduationCap className="w-3 h-3 text-teal-700" />
                  <span>البيانات الدراسية والسكن:</span>
                </div>
                <div className="divide-y divide-slate-200/70 flex flex-col text-xs font-medium bg-white rounded-xl p-2.5 border border-slate-200/70">
                  <div className="py-1.5 flex items-center justify-between gap-2">
                    <span className="text-slate-500 font-bold shrink-0">المدرسة التي يدرس بها:</span>
                    <span className={selectedStudent.schoolName ? 'font-bold text-slate-900 text-left' : 'text-slate-400'}>
                      {selectedStudent.schoolName || '—'}
                    </span>
                  </div>

                  <div className="py-1.5 flex items-center justify-between gap-2">
                    <span className="text-slate-500 font-bold shrink-0">المرحلة الدراسية:</span>
                    <span className={selectedStudent.educationalLevel ? 'font-bold text-slate-900' : 'text-slate-400'}>
                      {selectedStudent.educationalLevel || '—'}
                    </span>
                  </div>

                  <div className="py-1.5 flex items-center justify-between gap-2">
                    <span className="text-slate-500 font-bold shrink-0">عنوان الطالب:</span>
                    <span className={selectedStudent.address ? 'font-bold text-slate-900 text-left' : 'text-slate-400'}>
                      {selectedStudent.address || '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. قسم بيانات ولي الأمر والتواصل */}
              <div>
                <div className="text-[11px] font-black text-teal-900 mb-1 flex items-center gap-1">
                  <UsersIcon className="w-3 h-3 text-teal-700" />
                  <span>بيانات ولي الأمر والتواصل:</span>
                </div>
                <div className="divide-y divide-slate-200/70 flex flex-col text-xs font-medium bg-white rounded-xl p-2.5 border border-slate-200/70">
                  <div className="py-1.5 flex items-center justify-between gap-2">
                    <span className="text-slate-500 font-bold shrink-0">اسم ولي الأمر:</span>
                    <span className={selectedStudent.guardianName ? 'font-extrabold text-slate-900' : 'text-slate-400'}>
                      {selectedStudent.guardianName || '—'}
                    </span>
                  </div>

                  <div className="py-1.5 flex items-center justify-between gap-2">
                    <span className="text-slate-500 font-bold shrink-0">صلة القرابة:</span>
                    <span className={selectedStudent.guardianRelation ? 'font-bold text-slate-900' : 'text-slate-400'}>
                      {selectedStudent.guardianRelation || '—'}
                    </span>
                  </div>

                  <div className="py-1.5 flex items-center justify-between gap-2">
                    <span className="text-slate-500 font-bold shrink-0">جوال ولي الأمر:</span>
                    {selectedStudent.guardianPhone || selectedStudent.parentPhone ? (
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-teal-900 tabular-nums">
                          {selectedStudent.guardianPhone || selectedStudent.parentPhone}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <a
                            href={`tel:${selectedStudent.guardianPhone || selectedStudent.parentPhone}`}
                            className="p-1 rounded-lg bg-teal-700 text-white text-[10px] font-bold flex items-center gap-1 shadow-2xs"
                            title="اتصال تلفوني"
                          >
                            <PhoneCall className="w-3 h-3" />
                          </a>
                          <a
                            href={`https://wa.me/966${(selectedStudent.guardianPhone || selectedStudent.parentPhone)!.replace(/^0/, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-1.5 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-bold"
                            title="واتساب"
                          >
                            واتساب
                          </a>
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </div>

                  <div className="py-1.5 flex items-center justify-between gap-2">
                    <span className="text-slate-500 font-bold shrink-0">جوال الطالب:</span>
                    <span className={selectedStudent.phone ? 'font-bold text-slate-800 tabular-nums' : 'text-slate-400'}>
                      {selectedStudent.phone || '—'}
                    </span>
                  </div>

                  <div className="py-1.5 flex items-center justify-between gap-2">
                    <span className="text-slate-500 font-bold shrink-0">البريد الإلكتروني:</span>
                    <span className="font-bold text-slate-800 truncate max-w-[180px]">
                      {selectedStudent.email}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Follow-up Note Section */}
            <div className="space-y-2 pt-1 border-t border-slate-100">
              <label className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-amber-600" />
                <span>سجل ملاحظات المتابعة والتدخل التربوي:</span>
              </label>

              <textarea
                value={editingNote}
                onChange={(e) => setEditingNote(e.target.value)}
                placeholder="اكتب ملاحظة خاصة بالطالب..."
                className="w-full p-2.5 text-xs rounded-2xl bg-white border border-slate-200 focus:outline-hidden focus:border-teal-600 min-h-[70px] shadow-2xs text-slate-800"
              />

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSaveNote}
                  className="px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>حفظ الملاحظة</span>
                </button>

                {(selectedStudent.attentionReason ||
                  selectedStudent.consecutiveAbsences > 0 ||
                  selectedStudent.daysWithoutLog > 0) && (
                  <div>
                    {!showClearConfirm ? (
                      <button
                        type="button"
                        onClick={() => setShowClearConfirm(true)}
                        className="text-slate-500 hover:text-rose-600 underline text-xs font-bold cursor-pointer transition-colors"
                      >
                        إزالة حالة المتابعة
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-rose-700 font-bold">تأكيد الإزالة؟</span>
                        <button
                          type="button"
                          onClick={handleClearNoteConfirm}
                          className="px-2 py-1 bg-rose-600 text-white rounded-lg text-[10px] font-bold"
                        >
                          نعم
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowClearConfirm(false)}
                          className="px-2 py-1 bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold"
                        >
                          إلغاء
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Sticky Fixed Bottom Close Button */}
            <div className="pt-2 border-t border-slate-100 sticky bottom-0 bg-white">
              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                className="w-full py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Daily Student Points Log Modal (Day Cards) */}
      <StudentPointsLogModal
        student={pointsLogStudent}
        onClose={() => setPointsLogStudent(null)}
      />
    </div>
  );
};
