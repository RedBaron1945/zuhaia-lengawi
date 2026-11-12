import React, { useState, useMemo, useEffect } from 'react';
import { Student } from '../../types';
import { repository } from '../../services/storageService';
import { useToast } from '../../context/ToastContext';
import {
  AlertTriangle,
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
  ArrowUpDown,
  UserCheck,
  UserX,
  Trophy,
  Filter,
  Info,
  ChevronDown,
} from 'lucide-react';
import { calculateAge } from '../../utils/dateUtils';

interface NeedsAttentionListProps {
  students: Student[];
}

export const NeedsAttentionList: React.FC<NeedsAttentionListProps> = ({ students }) => {
  const [search, setSearch] = useState('');
  const [circleFilter, setCircleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'perfect' | 'has_absences'>('all');
  const [sortBy, setSortBy] = useState<'attendance' | 'absences' | 'points' | 'rate'>('attendance');
  const [visibleCount, setVisibleCount] = useState(20);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [showRubricInfo, setShowRubricInfo] = useState(false);

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showNationalId, setShowNationalId] = useState(false);
  const [editingNote, setEditingNote] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const { showToast } = useToast();

  const circles = repository.getCircles();
  const activeStudents = useMemo(() => students.filter((s) => s.active), [students]);

  // Reset pagination on filter or sort change
  useEffect(() => {
    setVisibleCount(20);
  }, [search, circleFilter, statusFilter, sortBy]);

  // Pre-calculate attendance stats for each student
  const studentStatsMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof repository.getStudentAttendanceStats>>();
    activeStudents.forEach((s) => {
      map.set(s.id, repository.getStudentAttendanceStats(s.id));
    });
    return map;
  }, [activeStudents]);

  // Helper to determine student follow-up flags
  const getStudentFlag = (student: Student) => {
    const attStats = studentStatsMap.get(student.id) || repository.getStudentAttendanceStats(student.id);

    if (student.attentionReason) {
      return {
        isFlagged: true,
        type: 'custom' as const,
        label: student.attentionReason,
        badge: 'ملاحظة خاصة',
      };
    }
    if (student.consecutiveAbsences >= 2) {
      return {
        isFlagged: true,
        type: 'absent' as const,
        label: `غياب متكرر (${student.consecutiveAbsences} أيام متتالية)`,
        badge: 'كثرة غياب',
      };
    }
    if (student.daysWithoutLog >= 7) {
      return {
        isFlagged: true,
        type: 'inactive' as const,
        label: `انقطاع عن التسميع منذ ${student.daysWithoutLog} أيام`,
        badge: 'انقطاع تسميع',
      };
    }
    if (attStats.hasRecords && attStats.attendanceRate < 70) {
      return {
        isFlagged: true,
        type: 'low_attendance' as const,
        label: `انخفاض نسبة الحضور (${attStats.attendanceRate}%)`,
        badge: 'حضور منخفض',
      };
    }
    return {
      isFlagged: false,
      type: 'regular' as const,
      label: 'منتظم وبحالة انضباط ممتازة',
      badge: 'منتظم',
    };
  };

  // Overall Center Statistics for chosen period
  const overallStats = useMemo(() => {
    let totalPresent = 0;
    let totalAbsent = 0;
    let studentsWithAbsences = 0;
    let perfectStudents = 0;
    let flaggedCount = 0;

    activeStudents.forEach((s) => {
      const stats = studentStatsMap.get(s.id);
      if (stats) {
        totalPresent += stats.presentDays;
        totalAbsent += stats.absentDays;
        if (stats.absentDays > 0) studentsWithAbsences++;
        if (stats.hasRecords && stats.attendanceRate >= 90) perfectStudents++;
      }
      if (getStudentFlag(s).isFlagged) {
        flaggedCount++;
      }
    });

    const totalDaysRecorded = totalPresent + totalAbsent;
    const overallRate = totalDaysRecorded > 0 ? Math.round((totalPresent / totalDaysRecorded) * 100) : 0;

    return {
      totalStudents: activeStudents.length,
      totalPresentDays: totalPresent,
      totalAbsentDays: totalAbsent,
      overallRate,
      studentsWithAbsences,
      perfectStudents,
      flaggedCount,
      hasRecords: totalDaysRecorded > 0,
    };
  }, [activeStudents, studentStatsMap]);

  // Filter and sort students
  const rankedStudents = useMemo(() => {
    return activeStudents
      .filter((s) => (circleFilter === 'all' ? true : s.circleId === circleFilter))
      .filter((s) => (search ? s.name.includes(search) : true))
      .filter((s) => {
        const stats = studentStatsMap.get(s.id);
        if (statusFilter === 'perfect') {
          return stats?.hasRecords && stats.attendanceRate >= 90;
        }
        if (statusFilter === 'has_absences') {
          return (stats?.absentDays || 0) > 0;
        }
        return true;
      })
      .sort((a, b) => {
        const statsA = studentStatsMap.get(a.id);
        const statsB = studentStatsMap.get(b.id);
        const presentA = statsA?.presentDays || 0;
        const presentB = statsB?.presentDays || 0;
        const absentA = statsA?.absentDays || 0;
        const absentB = statsB?.absentDays || 0;
        const rateA = statsA?.attendanceRate || 0;
        const rateB = statsB?.attendanceRate || 0;

        if (sortBy === 'attendance') {
          if (presentB !== presentA) return presentB - presentA;
          if (rateB !== rateA) return rateB - rateA;
          return b.currentPoints - a.currentPoints;
        }
        if (sortBy === 'absences') {
          if (absentB !== absentA) return absentB - absentA;
          if (rateA !== rateB) return rateA - rateB;
          return a.currentPoints - b.currentPoints;
        }
        if (sortBy === 'points') {
          if (b.currentPoints !== a.currentPoints) return b.currentPoints - a.currentPoints;
          return presentB - presentA;
        }
        if (sortBy === 'rate') {
          if (rateB !== rateA) return rateB - rateA;
          return presentB - presentA;
        }
        return 0;
      });
  }, [activeStudents, circleFilter, search, statusFilter, sortBy, studentStatsMap]);

  // Metric value display function for podium (single clean number)
  const getSingleMetricNumber = (stats: any, s: Student) => {
    switch (sortBy) {
      case 'attendance':
        return `${stats.presentDays} يوم`;
      case 'points':
        return `${s.currentPoints} نقطة`;
      case 'rate':
        return stats.hasRecords ? `${stats.attendanceRate}%` : '0%';
      case 'absences':
        return `${stats.absentDays} غياب`;
    }
  };

  // Top 3 Podium
  const showPodium = !search && rankedStudents.length >= 3;
  const podiumStudents = showPodium ? rankedStudents.slice(0, 3) : [];
  const listStudents = showPodium ? rankedStudents.slice(3) : rankedStudents;
  const paginatedStudents = listStudents.slice(0, visibleCount);
  const rankOffset = showPodium ? 4 : 1;

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
    const base = idStr || '1084920158';
    if (base.length < 6) return '10****' + base.slice(-2);
    return base.slice(0, 4) + '****' + base.slice(-2);
  };

  return (
    <div className="space-y-3 pb-28 select-text">
      {/* (5) Compact Statistics Line / 2 Cards (Shown ONLY when data exists) with ⓘ info button */}
      {overallStats.hasRecords && (
        <div className="bg-white rounded-xl p-2.5 border border-slate-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <span>إحصائيات الانضباط</span>
              <span className="text-[10px] text-slate-400 font-medium">
                (التراكمي)
              </span>
            </span>
            <button
              type="button"
              onClick={() => setShowRubricInfo((prev) => !prev)}
              className="text-slate-400 hover:text-teal-700 p-1 rounded-md transition-colors cursor-pointer"
              title="معيار الرصد"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>

          {/* ⓘ Rubric explanation popup / banner */}
          {showRubricInfo && (
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-2 text-[11px] text-teal-900 font-medium flex items-center justify-between animate-fade-in">
              <span>قاعدة الرصد التلقائي: 2 أو 1 = حاضر · 0 = غائب</span>
              <button
                type="button"
                onClick={() => setShowRubricInfo(false)}
                className="text-teal-600 hover:text-teal-800"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* 2 Compact Summary Cards */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* Presence & Rate Card */}
            <div className="bg-emerald-50/70 p-2 rounded-xl border border-emerald-200/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-emerald-800 font-bold block">مجموع الحضور</span>
                <span className="text-xs sm:text-sm font-black text-emerald-950 tabular-nums">
                  {overallStats.totalPresentDays} يوم
                </span>
              </div>
              <div className="text-left">
                <span className="text-[10px] text-emerald-700 font-bold block">الانضباط</span>
                <span className="text-xs font-black text-emerald-900 tabular-nums">
                  {overallStats.overallRate}%
                </span>
              </div>
            </div>

            {/* Absence & Flagged Card */}
            <div className="bg-rose-50/70 p-2 rounded-xl border border-rose-200/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-rose-800 font-bold block">مجموع الغياب</span>
                <span className="text-xs sm:text-sm font-black text-rose-950 tabular-nums">
                  {overallStats.totalAbsentDays} يوم
                </span>
              </div>
              <div className="text-left">
                <span className="text-[10px] text-amber-700 font-bold block">تنبيهات</span>
                <span className="text-xs font-black text-amber-900 tabular-nums">
                  {overallStats.flaggedCount}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* (6) Search + Filter Button Row & Equal-Width Segment Pills */}
      <div className="bg-white rounded-xl p-2.5 border border-slate-200/90 shadow-2xs space-y-2">
        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث باسم الطالب..."
              className="w-full pr-9 pl-8 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-hidden focus:border-teal-600 min-h-[38px] placeholder:text-slate-400 font-medium"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Sheet Trigger Button */}
          <button
            type="button"
            onClick={() => setIsFilterSheetOpen(true)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 shrink-0 min-h-[38px] transition-colors cursor-pointer ${
              circleFilter !== 'all' || sortBy !== 'attendance'
                ? 'bg-teal-700 text-white border-teal-800 shadow-2xs'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
            title="تصفية وخيارات الترتيب"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>تصفية</span>
            {(circleFilter !== 'all' || sortBy !== 'attendance') && (
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            )}
          </button>
        </div>

        {/* Equal-Width Status Segments (الكل / منتظمون / لديهم غياب) without horizontal scrollbar */}
        <div className="grid grid-cols-3 gap-1.5 w-full text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`py-2 px-1 text-center rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-teal-700 text-white border-teal-800 shadow-2xs'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            الكل ({activeStudents.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('perfect')}
            className={`py-2 px-1 text-center rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'perfect'
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                : 'bg-emerald-50/70 text-emerald-900 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            منتظمون ({overallStats.perfectStudents})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('has_absences')}
            className={`py-2 px-1 text-center rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'has_absences'
                ? 'bg-rose-600 text-white border-rose-700 shadow-2xs'
                : 'bg-rose-50/70 text-rose-900 border-rose-200 hover:bg-rose-100'
            }`}
          >
            لديهم غياب ({overallStats.studentsWithAbsences})
          </button>
        </div>
      </div>

      {/* (7) & (10) Podium: Three Equal-Width Cards (Medal + 2-line Name + Single Number) WITHOUT Text Badges */}
      {showPodium && (
        <div className="space-y-2 pt-1 pb-1">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-500" />
              <span>المراكز الثلاثة الأولى</span>
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 w-full items-stretch">
            {/* Rank 2 (Silver) */}
            {(() => {
              const student = podiumStudents[1];
              const stats = studentStatsMap.get(student.id) || repository.getStudentAttendanceStats(student.id);
              return (
                <div
                  key={student.id}
                  onClick={() => handleOpenStudentModal(student)}
                  className="bg-white rounded-xl p-2.5 border border-slate-200/90 hover:border-teal-400 text-center flex flex-col items-center justify-between shadow-2xs cursor-pointer transition-all min-h-[110px]"
                >
                  <span className="text-2xl mb-1">🥈</span>
                  <span className="text-xs font-bold text-slate-900 line-clamp-2 text-center min-h-[2.2rem] leading-snug">
                    {student.name}
                  </span>
                  <span className="text-xs font-black text-teal-800 tabular-nums mt-1">
                    {getSingleMetricNumber(stats, student)}
                  </span>
                </div>
              );
            })()}

            {/* Rank 1 (Gold) */}
            {(() => {
              const student = podiumStudents[0];
              const stats = studentStatsMap.get(student.id) || repository.getStudentAttendanceStats(student.id);
              return (
                <div
                  key={student.id}
                  onClick={() => handleOpenStudentModal(student)}
                  className="bg-gradient-to-b from-amber-50/70 to-white rounded-xl p-2.5 border-2 border-amber-300 hover:border-amber-400 text-center flex flex-col items-center justify-between shadow-2xs cursor-pointer transition-all min-h-[110px]"
                >
                  <span className="text-2xl mb-1">🥇</span>
                  <span className="text-xs font-black text-slate-900 line-clamp-2 text-center min-h-[2.2rem] leading-snug">
                    {student.name}
                  </span>
                  <span className="text-xs sm:text-sm font-black text-amber-900 tabular-nums mt-1">
                    {getSingleMetricNumber(stats, student)}
                  </span>
                </div>
              );
            })()}

            {/* Rank 3 (Bronze) */}
            {(() => {
              const student = podiumStudents[2];
              const stats = studentStatsMap.get(student.id) || repository.getStudentAttendanceStats(student.id);
              return (
                <div
                  key={student.id}
                  onClick={() => handleOpenStudentModal(student)}
                  className="bg-white rounded-xl p-2.5 border border-slate-200/90 hover:border-teal-400 text-center flex flex-col items-center justify-between shadow-2xs cursor-pointer transition-all min-h-[110px]"
                >
                  <span className="text-2xl mb-1">🥉</span>
                  <span className="text-xs font-bold text-slate-900 line-clamp-2 text-center min-h-[2.2rem] leading-snug">
                    {student.name}
                  </span>
                  <span className="text-xs font-black text-teal-800 tabular-nums mt-1">
                    {getSingleMetricNumber(stats, student)}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* (2) & (3) Student Rows: Name wraps without cut, circle underneath in gray, حضور N · غياب N (no zeroes, no (-)), color rules */}
      {rankedStudents.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 text-slate-400 text-xs font-medium space-y-1">
          <p className="font-bold text-slate-600">لا يوجد طلاب يطابقون شروط البحث أو التصفية الحالية.</p>
          <p className="text-[11px] text-slate-400">يمكنك تبديل التصفية لعرض «الكل» أو تغيير الحلقة.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {showPodium && listStudents.length > 0 && (
            <div className="px-1 pt-1 text-xs font-black text-slate-500">
              قائمة الطلاب ({listStudents.length}):
            </div>
          )}

          {paginatedStudents.map((student, index) => {
            const currentRank = rankOffset + index;
            const circle = circles.find((c) => c.id === student.circleId);
            const flag = getStudentFlag(student);
            const stats = studentStatsMap.get(student.id) || repository.getStudentAttendanceStats(student.id);

            return (
              <div
                key={student.id}
                onClick={() => handleOpenStudentModal(student)}
                className={`bg-white rounded-xl p-3 border shadow-2xs hover:shadow-xs transition-all cursor-pointer flex items-center justify-between gap-3 select-text ${
                  stats.absentDays >= 3
                    ? 'border-rose-200/80 bg-rose-50/10'
                    : flag.isFlagged
                    ? 'border-amber-200/80 bg-amber-50/10'
                    : 'border-slate-200/90 hover:border-teal-300'
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  {/* Rank Badge */}
                  <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-black text-xs tabular-nums shrink-0 mt-0.5">
                    #{currentRank}
                  </div>

                  <div className="min-w-0 flex-1">
                    {/* (2) Student name: full line non-truncated, wraps gracefully */}
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug break-words">
                      {student.name}
                    </h4>

                    {/* (2) Circle name underneath in gray */}
                    {circle?.name && (
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                        {circle.name}
                      </p>
                    )}

                    {/* (2) & (3) «حضور N · غياب N» بخط صغير، دون عرض الصفر ولا (–)، أخضر للحضور الفعلي وأحمر للغياب الفعلي */}
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] font-bold">
                      {stats.hasRecords && (stats.presentDays > 0 || stats.absentDays > 0) ? (
                        <>
                          {stats.presentDays > 0 && (
                            <span className="text-emerald-700 font-bold">حضور {stats.presentDays}</span>
                          )}
                          {stats.presentDays > 0 && stats.absentDays > 0 && (
                            <span className="text-slate-300">·</span>
                          )}
                          {stats.absentDays > 0 && (
                            <span className="text-rose-600 font-bold">غياب {stats.absentDays}</span>
                          )}
                          {stats.attendanceRate > 0 && (
                            <span className="text-slate-400 font-medium text-[10px] tabular-nums">
                              ({stats.attendanceRate}%)
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-400 text-[10px] font-medium">لا يوجد رصد مسجل</span>
                      )}
                    </div>

                    {flag.isFlagged && (
                      <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-md">
                        <span>⚠️</span>
                        <span>{flag.label}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Inspect Action */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenStudentModal(student);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-teal-700 hover:bg-slate-50 shrink-0 cursor-pointer"
                  title="عرض بيانات الطالب"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            );
          })}

          {/* (9) Pagination: Show 20 initially with «عرض المزيد» */}
          {listStudents.length > visibleCount && (
            <button
              type="button"
              onClick={() => setVisibleCount((prev) => prev + 20)}
              className="w-full py-2.5 rounded-xl bg-white border border-slate-200 text-teal-800 text-xs font-bold hover:bg-slate-50 shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors mt-2"
            >
              <span>عرض المزيد ({listStudents.length - visibleCount} طالب متبقٍ)</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* (6) Bottom Sheet for Filters: Circle, Sort Order, Status */}
      {isFilterSheetOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl p-5 space-y-4 text-right animate-slide-up">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <Filter className="w-4 h-4 text-teal-700" />
                <span>خيارات التصفية والترتيب</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsFilterSheetOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Circle Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 block">
                تصفية حسب الحلقة القرآنية:
              </label>
              <select
                value={circleFilter}
                onChange={(e) => setCircleFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-bold min-h-[38px] shadow-2xs cursor-pointer focus:bg-white focus:outline-hidden focus:border-teal-600"
              >
                <option value="all">جميع الحلقات ({circles.length})</option>
                {circles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.teacherName})
                  </option>
                ))}
              </select>
            </div>

            {/* Sort By Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 block">
                ترتيب الطلاب حسب:
              </label>
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-teal-900 font-bold min-h-[38px] shadow-2xs cursor-pointer focus:bg-white focus:outline-hidden focus:border-teal-600"
                >
                  <option value="attendance">الأكثر حضوراً</option>
                  <option value="absences">الأكثر غياباً (للمتابعة)</option>
                  <option value="rate">أعلى نسبة حضور (%)</option>
                  <option value="points">الأعلى نقاطاً</option>
                </select>
              </div>
            </div>

            {/* Status Filter Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 block">
                الحالة:
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`py-2 px-1 text-center rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    statusFilter === 'all'
                      ? 'bg-teal-700 text-white border-teal-800 shadow-2xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  الكل
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('perfect')}
                  className={`py-2 px-1 text-center rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    statusFilter === 'perfect'
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                      : 'bg-emerald-50/70 text-emerald-900 border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  منتظمون
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('has_absences')}
                  className={`py-2 px-1 text-center rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    statusFilter === 'has_absences'
                      ? 'bg-rose-600 text-white border-rose-700 shadow-2xs'
                      : 'bg-rose-50/70 text-rose-900 border-rose-200 hover:bg-rose-100'
                  }`}
                >
                  لديهم غياب
                </button>
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-2 flex items-center gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setCircleFilter('all');
                  setSortBy('attendance');
                  setStatusFilter('all');
                }}
                className="px-3 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
              >
                إعادة ضبط
              </button>
              <button
                type="button"
                onClick={() => setIsFilterSheetOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
              >
                تطبيق الفلاتر
              </button>
            </div>
          </div>
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

            {/* Attendance Summary Card (3 columns) */}
            {(() => {
              const mStats = repository.getStudentAttendanceStats(selectedStudent.id);
              const circle = circles.find((c) => c.id === selectedStudent.circleId);

              return (
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
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
                    <span className="text-sm font-black text-slate-900 block mt-0.5 tabular-nums">
                      {mStats.hasRecords ? `${mStats.attendanceRate}%` : '—'}
                    </span>
                    <span className="text-[9px] text-slate-500 font-medium block truncate">
                      {circle?.name || 'عامة'}
                    </span>
                  </div>
                </div>
              );
            })()}

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
                    <span className="text-slate-500 font-bold shrink-0">رقم الهوية / الإقامة:</span>
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
                            rel="noreferrer"
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
    </div>
  );
};
