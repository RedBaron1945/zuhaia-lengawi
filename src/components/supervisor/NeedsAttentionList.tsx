import React, { useState, useMemo } from 'react';
import { Student } from '../../types';
import { repository } from '../../services/storageService';
import { useToast } from '../../context/ToastContext';
import {
  AlertTriangle,
  Search,
  CheckCircle2,
  X,
  User,
  CreditCard,
  PhoneCall,
  Save,
  MessageSquare,
  Award,
  Check,
  Eye,
  GraduationCap,
  Users as UsersIcon,
  Sparkles,
  ArrowUpDown,
  UserCheck,
  UserX,
  Trophy,
  Filter,
  TrendingUp,
} from 'lucide-react';
import { calculateAge } from '../../utils/dateUtils';
import { groupTransactionsByDay } from '../../utils/pointUtils';

interface NeedsAttentionListProps {
  students: Student[];
}

export const NeedsAttentionList: React.FC<NeedsAttentionListProps> = ({ students }) => {
  const [search, setSearch] = useState('');
  const [circleFilter, setCircleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'perfect' | 'has_absences' | 'flagged'>('all');
  const [sortBy, setSortBy] = useState<'attendance' | 'absences' | 'points' | 'rate'>('attendance');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showNationalId, setShowNationalId] = useState(false);
  const [editingNote, setEditingNote] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const { showToast } = useToast();

  const circles = repository.getCircles();
  const activeStudents = useMemo(() => students.filter((s) => s.active), [students]);

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

  // Overall Center Statistics (Cumulative across all active students)
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

  // Filter and sort students into a clear leaderboard / ranking
  const rankedStudents = useMemo(() => {
    return activeStudents
      .filter((s) => (circleFilter === 'all' ? true : s.circleId === circleFilter))
      .filter((s) => (search ? s.name.includes(search) : true))
      .filter((s) => {
        const stats = studentStatsMap.get(s.id);
        const flag = getStudentFlag(s);

        if (statusFilter === 'perfect') {
          return stats?.hasRecords && stats.attendanceRate >= 90;
        }
        if (statusFilter === 'has_absences') {
          return (stats?.absentDays || 0) > 0;
        }
        if (statusFilter === 'flagged') {
          return flag.isFlagged;
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
          // Sort by most attendance days descending, then by rate, then points
          if (presentB !== presentA) return presentB - presentA;
          if (rateB !== rateA) return rateB - rateA;
          return b.currentPoints - a.currentPoints;
        }
        if (sortBy === 'absences') {
          // Sort by most absent days descending (to prioritize follow-up)
          if (absentB !== absentA) return absentB - absentA;
          if (rateA !== rateB) return rateA - rateB;
          return a.currentPoints - b.currentPoints;
        }
        if (sortBy === 'points') {
          // Sort by cumulative points descending
          if (b.currentPoints !== a.currentPoints) return b.currentPoints - a.currentPoints;
          return presentB - presentA;
        }
        if (sortBy === 'rate') {
          // Sort by attendance rate % descending
          if (rateB !== rateA) return rateB - rateA;
          return presentB - presentA;
        }
        return 0;
      });
  }, [activeStudents, circleFilter, search, statusFilter, sortBy, studentStatsMap]);

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

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <div
          className="w-8 h-8 rounded-full bg-amber-100 border-2 border-amber-400 text-amber-800 flex items-center justify-center font-black text-sm shadow-2xs shrink-0"
          title="المركز الأول"
        >
          🥇
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div
          className="w-8 h-8 rounded-full bg-slate-100 border-2 border-slate-300 text-slate-700 flex items-center justify-center font-black text-sm shadow-2xs shrink-0"
          title="المركز الثاني"
        >
          🥈
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div
          className="w-8 h-8 rounded-full bg-amber-50 border-2 border-amber-600/40 text-amber-900 flex items-center justify-center font-black text-sm shadow-2xs shrink-0"
          title="المركز الثالث"
        >
          🥉
        </div>
      );
    }
    return (
      <div
        className="w-8 h-8 rounded-full bg-slate-50 border border-slate-200 text-slate-700 flex items-center justify-center font-black text-xs tabular-nums shrink-0"
        title={`المركز ${rank}`}
      >
        #{rank}
      </div>
    );
  };

  return (
    <div className="space-y-3.5">
      {/* 1. Header & Summary Stats Cards for the General Supervisor */}
      <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div>
            <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-teal-700" />
              <span>قسم المتابعة وترتيب الطلاب</span>
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
              ترتيب الطلاب مع رصيد أيام الحضور والغياب التراكمي (معيار الرصد: 2 أو 1 = حاضر · 0 = غائب)
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <span className="text-[11px] font-black text-teal-900 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-xl shadow-2xs">
              إجمالي الطلاب: {overallStats.totalStudents}
            </span>
          </div>
        </div>

        {/* 4 Cumulative KPI Metric Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
          {/* إجمالي أيام الحضور */}
          <div className="bg-gradient-to-b from-emerald-50/80 to-emerald-50/30 p-2.5 rounded-2xl border border-emerald-200/90 flex flex-col items-center justify-center shadow-2xs">
            <span className="text-[10px] text-emerald-800 font-extrabold flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>مجموع أيام الحضور</span>
            </span>
            <span className="text-base sm:text-lg font-black text-emerald-900 tabular-nums mt-0.5">
              {overallStats.totalPresentDays} يوم
            </span>
            <span className="text-[9px] text-emerald-700 font-bold mt-0.5">
              رصد المعلمين (2 أو 1)
            </span>
          </div>

          {/* إجمالي أيام الغياب */}
          <div className="bg-gradient-to-b from-rose-50/80 to-rose-50/30 p-2.5 rounded-2xl border border-rose-200/90 flex flex-col items-center justify-center shadow-2xs">
            <span className="text-[10px] text-rose-800 font-extrabold flex items-center gap-1">
              <UserX className="w-3.5 h-3.5 text-rose-600" />
              <span>مجموع أيام الغياب</span>
            </span>
            <span className="text-base sm:text-lg font-black text-rose-900 tabular-nums mt-0.5">
              {overallStats.totalAbsentDays} يوم
            </span>
            <span className="text-[9px] text-rose-700 font-bold mt-0.5">
              رصد المعلمين (0)
            </span>
          </div>

          {/* نسبة الحضور العامة */}
          <div className="bg-gradient-to-b from-teal-50/80 to-teal-50/30 p-2.5 rounded-2xl border border-teal-200/90 flex flex-col items-center justify-center shadow-2xs">
            <span className="text-[10px] text-teal-800 font-extrabold flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-teal-600" />
              <span>متوسط نسبة الانضباط</span>
            </span>
            <span className="text-base sm:text-lg font-black text-teal-950 tabular-nums mt-0.5">
              {overallStats.hasRecords ? `${overallStats.overallRate}%` : '—'}
            </span>
            <span className="text-[9px] text-teal-700 font-bold mt-0.5">
              لجميع الحلقات القرآنية
            </span>
          </div>

          {/* يحتاجون متابعة */}
          <div className="bg-gradient-to-b from-amber-50/80 to-amber-50/30 p-2.5 rounded-2xl border border-amber-200/90 flex flex-col items-center justify-center shadow-2xs">
            <span className="text-[10px] text-amber-800 font-extrabold flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>تنبيهات وملاحظات</span>
            </span>
            <span className="text-base sm:text-lg font-black text-amber-950 tabular-nums mt-0.5">
              {overallStats.flaggedCount} طالب
            </span>
            <span className="text-[9px] text-amber-700 font-bold mt-0.5">
              تستدعي التدخل التربوي
            </span>
          </div>
        </div>
      </div>

      {/* 2. Filter & Sorting Bar */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200/90 shadow-2xs space-y-2.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Search by student name */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث باسم الطالب..."
              className="w-full pr-9 pl-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200/90 focus:bg-white focus:outline-hidden focus:border-teal-600 min-h-[38px] shadow-2xs placeholder:text-slate-400 font-medium"
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

          {/* Circle Filter */}
          <select
            value={circleFilter}
            onChange={(e) => setCircleFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200/90 text-slate-800 font-bold min-h-[38px] shadow-2xs cursor-pointer focus:bg-white focus:outline-hidden focus:border-teal-600"
          >
            <option value="all">جميع الحلقات ({circles.length})</option>
            {circles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.teacherName})
              </option>
            ))}
          </select>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/90 rounded-xl px-2.5 py-1.5 min-h-[38px]">
            <ArrowUpDown className="w-3.5 h-3.5 text-teal-700 shrink-0" />
            <span className="text-[11px] text-slate-500 font-bold shrink-0">الترتيب:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs text-teal-900 font-black cursor-pointer focus:outline-hidden"
            >
              <option value="attendance">الأكثر حضوراً</option>
              <option value="absences">الأكثر غياباً (للمتابعة)</option>
              <option value="rate">أعلى نسبة حضور (%)</option>
              <option value="points">الأعلى نقاطاً (⭐)</option>
            </select>
          </div>
        </div>

        {/* Filter Quick Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 pt-1 text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === 'all'
                ? 'bg-teal-700 text-white border-teal-800 shadow-2xs'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            جميع الطلاب ({activeStudents.length})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('perfect')}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
              statusFilter === 'perfect'
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                : 'bg-emerald-50/70 text-emerald-900 border-emerald-200 hover:bg-emerald-100/70'
            }`}
          >
            <span>منتظمون (90%+)</span>
            <span className="tabular-nums font-black">({overallStats.perfectStudents})</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('has_absences')}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
              statusFilter === 'has_absences'
                ? 'bg-rose-600 text-white border-rose-700 shadow-2xs'
                : 'bg-rose-50/70 text-rose-900 border-rose-200 hover:bg-rose-100/70'
            }`}
          >
            <span>لديهم غياب</span>
            <span className="tabular-nums font-black">({overallStats.studentsWithAbsences})</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('flagged')}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
              statusFilter === 'flagged'
                ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                : 'bg-amber-50/70 text-amber-900 border-amber-200 hover:bg-amber-100/70'
            }`}
          >
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            <span>يحتاجون متابعة</span>
            <span className="tabular-nums font-black">({overallStats.flaggedCount})</span>
          </button>
        </div>
      </div>

      {/* 3. Students Ranking Table / Card List */}
      {rankedStudents.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 text-slate-400 text-xs font-medium space-y-1">
          <p className="font-bold text-slate-600">لا يوجد طلاب يطابقون شروط البحث أو التصفية الحالية.</p>
          <p className="text-[11px] text-slate-400">يمكنك تبديل التصفية لعرض «جميع الطلاب» أو تغيير الحلقة.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rankedStudents.map((student, index) => {
            const currentRank = index + 1;
            const circle = circles.find((c) => c.id === student.circleId);
            const flag = getStudentFlag(student);
            const stats = studentStatsMap.get(student.id) || repository.getStudentAttendanceStats(student.id);

            return (
              <div
                key={student.id}
                onClick={() => handleOpenStudentModal(student)}
                className={`bg-white rounded-2xl p-3 sm:p-3.5 border shadow-2xs hover:shadow-xs transition-all cursor-pointer flex flex-col gap-2 ${
                  stats.absentDays >= 3
                    ? 'border-rose-200/90 bg-rose-50/15'
                    : flag.isFlagged
                    ? 'border-amber-200/90 bg-amber-50/15'
                    : currentRank <= 3
                    ? 'border-amber-300/80 bg-amber-50/10'
                    : 'border-slate-200/90 hover:border-teal-300'
                }`}
              >
                <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                  {/* Rank Badge + Student Info */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {getRankBadge(currentRank)}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                          {student.name}
                        </h4>
                        {currentRank === 1 && (
                          <span className="text-[10px] font-black text-amber-900 bg-amber-200/80 px-2 py-0.2 rounded-full shadow-2xs">
                            متصدر الحضور
                          </span>
                        )}
                      </div>

                      {circle?.name && (
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          <span className="font-bold text-teal-800">{circle.name}</span>
                          <span> · {circle.teacherName}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Attendance Days & Absence Days Badges */}
                  <div className="shrink-0 flex items-center gap-2 self-end sm:self-center">
                    {/* أيام الحضور */}
                    <div
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200/90 text-xs font-black tabular-nums shadow-2xs"
                      title="عدد أيام الحضور المسجلة (رصد المعلم 2 أو 1)"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>حضور: {stats.presentDays}</span>
                    </div>

                    {/* أيام الغياب */}
                    <div
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black tabular-nums shadow-2xs border ${
                        stats.absentDays > 0
                          ? 'bg-rose-50 text-rose-800 border-rose-200/90'
                          : 'bg-slate-50 text-slate-600 border-slate-200/90'
                      }`}
                      title="عدد أيام الغياب المسجلة (رصد المعلم 0)"
                    >
                      <UserX
                        className={`w-3.5 h-3.5 shrink-0 ${
                          stats.absentDays > 0 ? 'text-rose-600' : 'text-slate-400'
                        }`}
                      />
                      <span>غياب: {stats.absentDays}</span>
                    </div>

                    {/* نسبة الحضور */}
                    <div className="text-[11px] font-extrabold text-slate-500 tabular-nums">
                      ({stats.hasRecords ? `${stats.attendanceRate}%` : '—'})
                    </div>

                    {/* الرصيد التراكمي */}
                    <div className="text-xs font-black text-teal-900 tabular-nums pr-1">
                      ⭐ {student.currentPoints}
                    </div>
                  </div>
                </div>

                {/* Flag Bar if student has special attention warning */}
                {flag.isFlagged && (
                  <div className="bg-amber-50/80 px-2.5 py-1 rounded-xl border border-amber-200/80 text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                    <span className="text-amber-700 shrink-0">⚠️ تنبيه متابعة:</span>
                    <span className="truncate">{flag.label}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 4. STUDENT DETAIL MODAL */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[88vh] overflow-y-auto border border-slate-200 shadow-2xl p-5 space-y-4 text-right relative">
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

            {/* Attendance & Points Summary Card */}
            {(() => {
              const mStats = repository.getStudentAttendanceStats(selectedStudent.id);
              const circle = circles.find((c) => c.id === selectedStudent.circleId);

              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-bold">
                  {/* عدد أيام الحضور */}
                  <div className="bg-emerald-50/80 p-2.5 rounded-2xl border border-emerald-200/90">
                    <span className="text-[10px] text-emerald-800 block font-bold">أيام الحضور</span>
                    <span className="text-sm font-black text-emerald-950 block mt-0.5 tabular-nums">
                      {mStats.presentDays} يوم
                    </span>
                    <span className="text-[9px] text-emerald-700 font-medium block">
                      رصد (2 أو 1)
                    </span>
                  </div>

                  {/* عدد أيام الغياب */}
                  <div className="bg-rose-50/80 p-2.5 rounded-2xl border border-rose-200/90">
                    <span className="text-[10px] text-rose-800 block font-bold">أيام الغياب</span>
                    <span className="text-sm font-black text-rose-950 block mt-0.5 tabular-nums">
                      {mStats.absentDays} يوم
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

                  {/* الرصيد التراكمي */}
                  <div className="bg-teal-50/70 p-2.5 rounded-2xl border border-teal-200">
                    <span className="text-[10px] text-teal-700 block font-bold">الرصيد التراكمي</span>
                    <span className="text-sm font-black text-teal-950 block mt-0.5 tabular-nums">
                      ⭐ {selectedStudent.currentPoints}
                    </span>
                    <span className="text-[9px] text-teal-600 block mt-0.5 font-medium">نقطة</span>
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

            {/* Student Past Days Evaluation and Points History Log */}
            {(() => {
              const studentTxs = repository.getTransactions({ studentId: selectedStudent.id });
              const studentEvals = repository.getEvaluationsHistory(selectedStudent.id);
              const pastDailyGroups = groupTransactionsByDay(studentTxs, studentEvals);

              return (
                <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <h4 className="text-xs font-black text-slate-900">
                        سجل النقاط والتقييم للأيام السابقة
                      </h4>
                    </div>
                    <span className="text-[11px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200 tabular-nums">
                      إجمالي {selectedStudent.currentPoints} نقطة ({pastDailyGroups.length} أيام)
                    </span>
                  </div>

                  {pastDailyGroups.length === 0 ? (
                    <div className="text-center py-4 text-xs text-slate-400">
                      لا توجد تقييمات مسجلة للطالب في الأيام السابقة بعد.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-52 overflow-y-auto pl-1">
                      {pastDailyGroups.map((grp) => (
                        <div
                          key={grp.dateKey}
                          className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2 text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-800">
                                {grp.dayLabel === 'اليوم'
                                  ? `اليوم (${grp.arabicDayName})`
                                  : grp.dayLabel === 'أمس'
                                  ? `أمس (${grp.arabicDayName})`
                                  : grp.arabicDayName}
                              </span>
                              <span className="text-[11px] text-slate-400 tabular-nums">
                                {grp.dateKey}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
                              {grp.conciseSummary}
                            </div>
                          </div>

                          <div className="flex flex-col items-end shrink-0">
                            <span
                              dir="ltr"
                              className={`font-black tabular-nums ${
                                grp.totalPoints > 0 ? 'text-emerald-700' : 'text-slate-500'
                              }`}
                            >
                              {grp.totalPoints > 0 ? `+${grp.totalPoints}` : grp.totalPoints} ن
                            </span>
                            <span className="text-[10px] font-bold text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded-md border border-teal-200/80 mt-0.5 tabular-nums">
                              التراكمي: {grp.cumulativePointsSoFar} ن
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

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
