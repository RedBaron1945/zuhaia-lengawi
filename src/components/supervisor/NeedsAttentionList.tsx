import React, { useState, useMemo } from 'react';
import { Student } from '../../types';
import { repository } from '../../services/storageService';
import { useToast } from '../../context/ToastContext';
import {
  AlertTriangle,
  Phone,
  Search,
  Filter,
  CheckCircle2,
  X,
  User,
  CreditCard,
  PhoneCall,
  Save,
  MessageSquare,
  Award,
  Calendar,
  Check,
  ChevronLeft,
  Info,
  Eye,
  Lock,
  AlertCircle,
  GraduationCap,
  MapPin,
  Users as UsersIcon,
} from 'lucide-react';
import { formatHijriShortDate, calculateAge } from '../../utils/dateUtils';

interface NeedsAttentionListProps {
  students: Student[];
}

export const NeedsAttentionList: React.FC<NeedsAttentionListProps> = ({ students }) => {
  const [search, setSearch] = useState('');
  const [circleFilter, setCircleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'flagged' | 'regular'>('all');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showNationalId, setShowNationalId] = useState(false);
  const [editingNote, setEditingNote] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const { showToast } = useToast();

  const circles = repository.getCircles();

  // Helper to determine student flags
  const getStudentFlag = (student: Student) => {
    const attStats = repository.getStudentAttendanceStats(student.id);

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
    // Only flag low attendance if the student actually has recorded sessions!
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

  // Filter all active students
  const filteredStudents = useMemo(() => {
    return students
      .filter((s) => s.active)
      .filter((s) => (circleFilter === 'all' ? true : s.circleId === circleFilter))
      .filter((s) => (search ? s.name.includes(search) : true))
      .filter((s) => {
        const flag = getStudentFlag(s);
        if (statusFilter === 'flagged') return flag.isFlagged;
        if (statusFilter === 'regular') return !flag.isFlagged;
        return true;
      });
  }, [students, circleFilter, search, statusFilter]);

  const flaggedCount = students.filter((s) => s.active && getStudentFlag(s).isFlagged).length;
  const regularCount = students.filter((s) => s.active && !getStudentFlag(s).isFlagged).length;

  const handleOpenStudentModal = (student: Student) => {
    setSelectedStudent(student);
    setEditingNote(student.attentionReason || '');
    setShowNationalId(false);
    setShowClearConfirm(false);
  };

  const handleShowIdWithAudit = () => {
    if (!selectedStudent) return;
    setShowNationalId(true);
    // Log audit event in storage
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

  // Helper to mask National ID (e.g. 1084****58)
  const maskNationalId = (idStr?: string) => {
    const base = idStr || '1084920158';
    if (base.length < 6) return '10****' + base.slice(-2);
    return base.slice(0, 4) + '****' + base.slice(-2);
  };

  return (
    <div className="space-y-3">
      {/* Collapsed Top Info Banner */}
      <div className="bg-amber-50/90 border border-amber-200/90 px-3 py-2 rounded-2xl flex items-center justify-between text-[11px] text-amber-900 font-medium shadow-2xs">
        <div className="flex items-center gap-1.5 truncate">
          <Info className="w-3.5 h-3.5 text-amber-700 shrink-0" />
          <span className="truncate">نظام رصد سجلات الطلاب العامة والمتابعة الانضباطية</span>
        </div>
      </div>

      {/* Clickable Counter Filters */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`p-2.5 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'all'
              ? 'bg-teal-700 text-white border-teal-800 shadow-xs font-extrabold'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span className="block text-[10px] opacity-80">الجميع</span>
          <span className="text-sm font-black tabular-nums">{students.filter((s) => s.active).length}</span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('flagged')}
          className={`p-2.5 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'flagged'
              ? 'bg-rose-600 text-white border-rose-700 shadow-xs font-extrabold'
              : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100/80'
          }`}
        >
          <span className="block text-[10px] opacity-80">تحذيرات</span>
          <span className="text-sm font-black tabular-nums">{flaggedCount}</span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('regular')}
          className={`p-2.5 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'regular'
              ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs font-extrabold'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100/80'
          }`}
        >
          <span className="block text-[10px] opacity-80">منتظمون</span>
          <span className="text-sm font-black tabular-nums">{regularCount}</span>
        </button>
      </div>

      {/* Filters Row: Search Input + Circle Filter */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث باسم الطالب..."
            className="w-full pr-9 pl-3 py-2 text-xs rounded-xl bg-white border border-slate-200/90 focus:outline-hidden focus:border-teal-600 min-h-[40px] shadow-2xs placeholder:text-slate-400"
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

        <select
          value={circleFilter}
          onChange={(e) => setCircleFilter(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl bg-white border border-slate-200/90 text-slate-700 font-bold min-h-[40px] shadow-2xs cursor-pointer"
        >
          <option value="all">جميع الحلقات</option>
          {circles.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Students List */}
      {filteredStudents.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 text-slate-400 text-xs font-medium">
          لا يوجد طلاب يطابقون خيارات البحث أو التصفية الحالية.
        </div>
      ) : (
        <div className="space-y-2">
          {filteredStudents.map((student) => {
            const circle = circles.find((c) => c.id === student.circleId);
            const flag = getStudentFlag(student);
            const attStats = repository.getStudentAttendanceStats(student.id);

            return (
              <div
                key={student.id}
                onClick={() => handleOpenStudentModal(student)}
                className={`bg-white rounded-2xl p-3 sm:p-3.5 border shadow-2xs hover:shadow-xs transition-all cursor-pointer flex flex-col gap-2 ${
                  flag.isFlagged
                    ? 'border-rose-200/90 bg-rose-50/20'
                    : 'border-slate-200/90 hover:border-teal-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Status Dot / Avatar without duplicate text */}
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                        flag.isFlagged
                          ? 'bg-rose-100 text-rose-700 border border-rose-300'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {flag.isFlagged ? '⚠️' : '🟢'}
                    </div>

                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                        {student.name}
                      </h4>
                      {circle?.name && (
                        <p className="text-[11px] text-slate-500 truncate mt-0.2">
                          <span className="font-bold text-teal-800">{circle.name}</span>
                          <span> · {circle.teacherName}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right side status indicator with attendance/absence badges */}
                  <div className="shrink-0 flex items-center gap-1.5 text-left">
                    {attStats.hasRecords ? (
                      <>
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/90 text-[11px] font-black tabular-nums shadow-2xs"
                          title="أيام الحضور (ح)"
                        >
                          ح {attStats.presentDays}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-black tabular-nums shadow-2xs ${
                            attStats.absentDays > 0
                              ? 'bg-rose-50 text-rose-800 border border-rose-200/90'
                              : 'bg-slate-50 text-slate-600 border border-slate-200/90'
                          }`}
                          title="أيام الغياب (غ)"
                        >
                          غ {attStats.absentDays}
                        </span>
                      </>
                    ) : (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-lg bg-slate-50 text-slate-500 border border-slate-200 text-[11px] font-bold shadow-2xs"
                        title="لم يتم تسجيل حضور لهذا الطالب من المعلم بعد"
                      >
                        ح 0 · غ 0
                      </span>
                    )}

                    {flag.isFlagged ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-800 bg-rose-100/90 border border-rose-300 px-2 py-0.5 rounded-xl shadow-2xs">
                        <span>{flag.badge}</span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-black text-teal-900 tabular-nums">
                        ⭐ {student.currentPoints}
                      </span>
                    )}
                  </div>
                </div>

                {/* Flag Reason bar if flagged */}
                {flag.isFlagged && (
                  <div className="bg-rose-50/80 px-2.5 py-1 rounded-xl border border-rose-200/80 text-[11px] font-bold text-rose-900 flex items-center gap-1.5">
                    <span className="text-rose-600 shrink-0">الملاحظة:</span>
                    <span className="truncate">{flag.label}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* STUDENT DETAIL MODAL */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[85vh] overflow-y-auto border border-slate-200 shadow-2xl p-5 space-y-4 text-right relative">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center font-black text-base shadow-2xs">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900">
                    بطاقة الطالب التفصيلية
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    كود الطالب: {selectedStudent.id}
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

            {/* Official Demographic Information List with Dividers */}
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
                  {/* اسم الطالب الرباعي */}
                  <div className="py-1.5 flex items-center justify-between gap-2">
                    <span className="text-slate-500 font-bold shrink-0">اسم الطالب الرباعي:</span>
                    <span className={`text-left ${selectedStudent.fullNameQuad ? 'font-extrabold text-slate-900' : 'text-slate-400'}`}>
                      {selectedStudent.fullNameQuad || '—'}
                    </span>
                  </div>

                  {/* رقم الهوية الوطنية */}
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

                  {/* الجنسية */}
                  <div className="py-1.5 flex items-center justify-between gap-2">
                    <span className="text-slate-500 font-bold shrink-0">الجنسية:</span>
                    <span className={selectedStudent.nationality ? 'font-bold text-slate-900' : 'text-slate-400'}>
                      {selectedStudent.nationality || '—'}
                    </span>
                  </div>

                  {/* تاريخ الميلاد */}
                  <div className="py-1.5 flex items-center justify-between gap-2">
                    <span className="text-slate-500 font-bold shrink-0">تاريخ الميلاد:</span>
                    <span className={selectedStudent.birthDate ? 'font-bold text-slate-900 tabular-nums' : 'text-slate-400'}>
                      {selectedStudent.birthDate || '—'}
                    </span>
                  </div>

                  {/* عمر الطالب (محسوب تلقائياً) */}
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

                  {/* مكان الميلاد */}
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
                  {/* المدرسة */}
                  <div className="py-1.5 flex items-center justify-between gap-2">
                    <span className="text-slate-500 font-bold shrink-0">المدرسة التي يدرس بها:</span>
                    <span className={selectedStudent.schoolName ? 'font-bold text-slate-900 text-left' : 'text-slate-400'}>
                      {selectedStudent.schoolName || '—'}
                    </span>
                  </div>

                  {/* المرحلة الدراسية */}
                  <div className="py-1.5 flex items-center justify-between gap-2">
                    <span className="text-slate-500 font-bold shrink-0">المرحلة الدراسية:</span>
                    <span className={selectedStudent.educationalLevel ? 'font-bold text-slate-900' : 'text-slate-400'}>
                      {selectedStudent.educationalLevel || '—'}
                    </span>
                  </div>

                  {/* عنوان الطالب */}
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
                  {/* اسم ولي الأمر */}
                  <div className="py-1.5 flex items-center justify-between gap-2">
                    <span className="text-slate-500 font-bold shrink-0">اسم ولي الأمر:</span>
                    <span className={selectedStudent.guardianName ? 'font-extrabold text-slate-900' : 'text-slate-400'}>
                      {selectedStudent.guardianName || '—'}
                    </span>
                  </div>

                  {/* صلة القرابة */}
                  <div className="py-1.5 flex items-center justify-between gap-2">
                    <span className="text-slate-500 font-bold shrink-0">صلة القرابة:</span>
                    <span className={selectedStudent.guardianRelation ? 'font-bold text-slate-900' : 'text-slate-400'}>
                      {selectedStudent.guardianRelation || '—'}
                    </span>
                  </div>

                  {/* جوال ولي الأمر */}
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

                  {/* جوال الطالب */}
                  <div className="py-1.5 flex items-center justify-between gap-2">
                    <span className="text-slate-500 font-bold shrink-0">جوال الطالب:</span>
                    <span className={selectedStudent.phone ? 'font-bold text-slate-800 tabular-nums' : 'text-slate-400'}>
                      {selectedStudent.phone || '—'}
                    </span>
                  </div>

                  {/* البريد الإلكتروني */}
                  <div className="py-1.5 flex items-center justify-between gap-2">
                    <span className="text-slate-500 font-bold shrink-0">البريد الإلكتروني:</span>
                    <span className="font-bold text-slate-800 truncate max-w-[180px]">
                      {selectedStudent.email}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3 Main Stats in 1 Single Horizontal Row */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
              <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-bold">الحلقة</span>
                <span className="font-black text-slate-900 block truncate mt-0.5">
                  {circles.find((c) => c.id === selectedStudent.circleId)?.name || 'عامة'}
                </span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-bold">نسبة الحضور</span>
                {(() => {
                  const mStats = repository.getStudentAttendanceStats(selectedStudent.id);
                  return (
                    <>
                      <span className="font-black text-emerald-800 block mt-0.5 tabular-nums">
                        {mStats.hasRecords ? `${mStats.attendanceRate}%` : '—'}
                      </span>
                      <span className="text-[10px] text-slate-600 font-bold block mt-0.5">
                        {mStats.hasRecords ? `ح ${mStats.presentDays} · غ ${mStats.absentDays}` : 'لم يبدأ الرصد'}
                      </span>
                    </>
                  );
                })()}
              </div>

              <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-bold">النقاط</span>
                <span className="font-black text-teal-800 block mt-0.5 tabular-nums">
                  ⭐ {selectedStudent.currentPoints}
                </span>
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

                {/* Textual Clear Flag button with Confirmation */}
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
