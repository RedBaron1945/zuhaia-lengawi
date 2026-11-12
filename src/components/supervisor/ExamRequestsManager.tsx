import React, { useState, useMemo } from 'react';
import { ExamNomination, ExamNominationStatus, Student, getBranchByPartsCount } from '../../types';
import { repository } from '../../services/storageService';
import { useToast } from '../../context/ToastContext';
import { StudentProfileModal } from '../common/StudentProfileModal';
import { ConfirmationModal } from '../common/ConfirmationModal';
import {
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  User,
  BookOpen,
  Calendar,
  AlertCircle,
  RotateCcw,
  Sparkles,
  PhoneCall,
  ChevronDown,
  X,
  Trash2,
} from 'lucide-react';

interface ExamRequestsManagerProps {
  supervisorName: string;
  onUpdate?: () => void;
}

export const ExamRequestsManager: React.FC<ExamRequestsManagerProps> = ({
  supervisorName,
  onUpdate,
}) => {
  const { showToast } = useToast();
  const [statusFilter, setStatusFilter] = useState<'all' | ExamNominationStatus>('pending');
  const [circleFilter, setCircleFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [cancellationTargetId, setCancellationTargetId] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ExamNomination | null>(null);

  const circles = repository.getCircles();
  const nominations: ExamNomination[] = repository.getExamNominations();
  const students = repository.getStudents();

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    const res = repository.deleteExamNomination(deleteTarget.id, supervisorName || 'المشرف');
    if (res.success) {
      showToast(res.message, 'info');
      setDeleteTarget(null);
      onUpdate?.();
    } else {
      showToast(res.message, 'error');
    }
  };

  // Summary counts
  const counts = useMemo(() => {
    let pending = 0;
    let completed = 0;
    let cancelled = 0;

    nominations.forEach((n: ExamNomination) => {
      if (n.status === 'pending') pending++;
      else if (n.status === 'completed') completed++;
      else if (n.status === 'cancelled') cancelled++;
    });

    return {
      total: nominations.length,
      pending,
      completed,
      cancelled,
    };
  }, [nominations]);

  // Filter nominations
  const filteredNominations = useMemo(() => {
    return nominations
      .filter((n: ExamNomination) => (circleFilter === 'all' ? true : n.circleId === circleFilter))
      .filter((n: ExamNomination) => (statusFilter === 'all' ? true : n.status === statusFilter))
      .filter((n: ExamNomination) => (search.trim() ? n.studentName.includes(search.trim()) : true))
      .sort((a: ExamNomination, b: ExamNomination) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [nominations, circleFilter, statusFilter, search]);

  const handleMarkCompleted = (nomination: ExamNomination) => {
    const res = repository.updateExamNominationStatus({
      nominationId: nomination.id,
      status: 'completed',
      handledBy: supervisorName || 'مدير المجمع',
    });

    if (res.success) {
      showToast(`تم اعتماد الطالب (${nomination.studentName}) كـ «تم الاختبار» بنجاح ✓`, 'success');
      onUpdate?.();
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleConfirmCancel = () => {
    if (!cancellationTargetId) return;

    const res = repository.updateExamNominationStatus({
      nominationId: cancellationTargetId,
      status: 'cancelled',
      handledBy: supervisorName || 'مدير المجمع',
      cancellationReason: cancellationReason.trim() || undefined,
    });

    if (res.success) {
      showToast('تم إلغاء طلب الاختبار بنجاح', 'info');
      setCancellationTargetId(null);
      setCancellationReason('');
      onUpdate?.();
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleRevertToPending = (nominationId: string) => {
    const res = repository.updateExamNominationStatus({
      nominationId,
      status: 'pending',
      handledBy: supervisorName || 'مدير المجمع',
    });

    if (res.success) {
      showToast('تمت إعادة الطلب إلى قيد الانتظار', 'info');
      onUpdate?.();
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleOpenStudentProfile = (studentId: string, studentNameFallback: string) => {
    const st = repository.getStudentById(studentId);
    if (st) {
      setSelectedStudent(st);
    } else {
      showToast(`تعذر العثور على بطاقة الطالب ${studentNameFallback}`, 'error');
    }
  };

  return (
    <div className="space-y-3.5">
      {/* 1. Header & Summary Stats */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
          <div>
            <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              <span>طلبات الاختبارات</span>
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
              متابعة واعتماد ترشيحات المعلمين لاختبارات الأجزاء القرآنية لطلاب الحلقات
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {counts.pending > 0 ? (
              <span className="text-xs font-black text-amber-950 bg-amber-100 border border-amber-300 px-3 py-1 rounded-xl shadow-2xs flex items-center gap-1.5 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>{counts.pending} طلبات بانتظار الاختبار</span>
              </span>
            ) : (
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-xl">
                لا توجد طلبات معلقة
              </span>
            )}
          </div>
        </div>

        {/* 4 Counter Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`p-2.5 rounded-2xl border transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-teal-800 text-white border-teal-900 font-black shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            <span className="text-[10px] block opacity-80">إجمالي الطلبات</span>
            <span className="text-base font-black tabular-nums">{counts.total}</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            className={`p-2.5 rounded-2xl border transition-all cursor-pointer ${
              statusFilter === 'pending'
                ? 'bg-amber-500 text-slate-950 border-amber-600 font-black shadow-xs'
                : 'bg-amber-50/80 hover:bg-amber-100/80 text-amber-950 border-amber-200'
            }`}
          >
            <span className="text-[10px] block opacity-90">بانتظار الاختبار</span>
            <span className="text-base font-black tabular-nums">{counts.pending}</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('completed')}
            className={`p-2.5 rounded-2xl border transition-all cursor-pointer ${
              statusFilter === 'completed'
                ? 'bg-emerald-600 text-white border-emerald-700 font-black shadow-xs'
                : 'bg-emerald-50/80 hover:bg-emerald-100/80 text-emerald-950 border-emerald-200'
            }`}
          >
            <span className="text-[10px] block opacity-90">تم الاختبار</span>
            <span className="text-base font-black tabular-nums">{counts.completed}</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('cancelled')}
            className={`p-2.5 rounded-2xl border transition-all cursor-pointer ${
              statusFilter === 'cancelled'
                ? 'bg-rose-600 text-white border-rose-700 font-black shadow-xs'
                : 'bg-rose-50/80 hover:bg-rose-100/80 text-rose-950 border-rose-200'
            }`}
          >
            <span className="text-[10px] block opacity-90">ملغية</span>
            <span className="text-base font-black tabular-nums">{counts.cancelled}</span>
          </button>
        </div>
      </div>

      {/* 2. Search & Circle Filter Bar */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث باسم الطالب..."
            className="w-full pr-9 pl-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-hidden focus:border-teal-600 min-h-[38px] shadow-2xs"
          />
        </div>

        <select
          value={circleFilter}
          onChange={(e) => setCircleFilter(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-bold min-h-[38px] shadow-2xs cursor-pointer focus:bg-white focus:outline-hidden focus:border-teal-600 shrink-0"
        >
          <option value="all">جميع الحلقات ({circles.length})</option>
          {circles.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.teacherName})
            </option>
          ))}
        </select>
      </div>

      {/* 3. Requests List */}
      {filteredNominations.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 text-slate-400 text-xs font-medium space-y-1 shadow-2xs">
          <p className="font-bold text-slate-600">لا توجد طلبات ترشيح للاختبار تطابق التصفية الحالية.</p>
          <p className="text-[11px] text-slate-400">
            عند قيام المعلمين بترشيح طلابهم للاختبار، ستظهر الطلبات هنا مباشرة.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredNominations.map((nomination: ExamNomination) => {
            const isPending = nomination.status === 'pending';
            const isCompleted = nomination.status === 'completed';
            const isCancelled = nomination.status === 'cancelled';

            return (
              <div
                key={nomination.id}
                className={`bg-white rounded-2xl p-3.5 sm:p-4 border shadow-2xs transition-all space-y-3 ${
                  isPending
                    ? 'border-amber-300 bg-amber-50/15'
                    : isCompleted
                    ? 'border-emerald-200 bg-emerald-50/10'
                    : 'border-slate-200 bg-slate-50/40 opacity-80'
                }`}
              >
                {/* Header: Student Info & Status Badge */}
                <div className="flex items-start justify-between gap-2.5 flex-wrap">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 border ${
                        isPending
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : isCompleted
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {isCompleted ? '✓' : isCancelled ? '✕' : '📖'}
                    </div>

                    <div className="min-w-0">
                      {/* Clickable Student Name */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenStudentProfile(nomination.studentId, nomination.studentName)
                          }
                          className="text-xs sm:text-sm font-black text-slate-900 hover:text-teal-700 hover:underline cursor-pointer transition-colors text-right"
                          title="انقر لعرض البطاقة الشخصية للطالب وسجله الكامل"
                        >
                          {nomination.studentName}
                        </button>
                      </div>

                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        <span className="font-bold text-teal-800">{nomination.circleName}</span>
                        <span> · المعلم: {nomination.teacherName}</span>
                      </p>
                    </div>
                  </div>

                  {/* Status Badge and X / Delete button */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isPending && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                        <Clock className="w-3.5 h-3.5 text-amber-700" />
                        <span>بانتظار الاختبار</span>
                      </span>
                    )}
                    {isCompleted && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                        <span>تم الاختبار بنجاح</span>
                      </span>
                    )}
                    {isCancelled && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black bg-rose-100 text-rose-900 border border-rose-300 shadow-2xs">
                        <XCircle className="w-3.5 h-3.5 text-rose-700" />
                        <span>ملغي</span>
                      </span>
                    )}

                    {/* زر علامة إكس أو حذف من السجل */}
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(nomination)}
                      title="حذف طلب الاختبار من السجل"
                      aria-label="حذف طلب الاختبار من السجل"
                      className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200/80 hover:border-rose-200 flex items-center justify-center transition-all cursor-pointer shadow-2xs group"
                    >
                      <X className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    </button>
                  </div>
                </div>

                {/* Nomination Details: فرع الاختبار + الملاحظات */}
                <div className="bg-white p-3 rounded-xl border border-slate-200/80 text-xs text-slate-700 space-y-1.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-500">فرع الاختبار:</span>
                      <span className="font-black text-amber-950 bg-amber-100/90 border border-amber-300 px-2.5 py-0.5 rounded-lg text-xs sm:text-sm shadow-2xs">
                        {nomination.partsDescription || getBranchByPartsCount(nomination.partsCount).title}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 font-medium">
                      تاريخ الطلب: {nomination.requestDate}
                    </div>
                  </div>

                  {nomination.partsDescription &&
                    nomination.partsDescription !== getBranchByPartsCount(nomination.partsCount).title && (
                      <div className="text-[11px] pt-1 border-t border-slate-100 text-slate-600">
                        <span className="font-bold text-slate-500">المقرر / السور:</span>{' '}
                        <span className="font-medium text-slate-900">{nomination.partsDescription}</span>
                      </div>
                    )}

                  {nomination.notes && (
                    <div className="text-[11px] pt-1 border-t border-slate-100 text-slate-600">
                      <span className="font-bold text-slate-500">ملاحظة المعلم:</span>{' '}
                      <span className="italic">{nomination.notes}</span>
                    </div>
                  )}

                  {isCompleted && nomination.completedAt && (
                    <div className="text-[10px] text-emerald-800 pt-1 border-t border-emerald-100 font-bold flex items-center justify-between">
                      <span>تم الاختبار والاعتماد بواسطة: {nomination.handledBy || 'مدير المجمع'}</span>
                      <span>{new Date(nomination.completedAt).toLocaleDateString('ar-SA')}</span>
                    </div>
                  )}

                  {isCancelled && nomination.cancellationReason && (
                    <div className="text-[10px] text-rose-800 pt-1 border-t border-rose-100 font-bold flex items-center justify-between">
                      <span>سبب الإلغاء: {nomination.cancellationReason}</span>
                      <span>بواسطة: {nomination.handledBy || 'مدير المجمع'}</span>
                    </div>
                  )}
                </div>

                {/* Supervisor Action Buttons */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  {/* Quick Profile View Trigger */}
                  <button
                    type="button"
                    onClick={() =>
                      handleOpenStudentProfile(nomination.studentId, nomination.studentName)
                    }
                    className="text-xs font-bold text-teal-800 hover:text-teal-950 flex items-center gap-1 cursor-pointer"
                  >
                    <User className="w-3.5 h-3.5 text-teal-700" />
                    <span>عرض بطاقة الطالب وبياناته المسجلة</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {isPending && (
                      <>
                        {/* Cancel Button */}
                        <button
                          type="button"
                          onClick={() => setCancellationTargetId(nomination.id)}
                          className="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>إلغاء الطلب</span>
                        </button>

                        {/* Mark As Completed Button */}
                        <button
                          type="button"
                          onClick={() => handleMarkCompleted(nomination)}
                          className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>تم الإختبار</span>
                        </button>
                      </>
                    )}

                    {isPending && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(nomination)}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200/80 hover:border-rose-200 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        title="حذف هذا الطلب نهائياً من السجل"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف</span>
                      </button>
                    )}

                    {!isPending && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleRevertToPending(nomination.id)}
                          className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                          title="إعادة الطلب لحالة قيد الانتظار"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>إعادة للانتظار</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(nomination)}
                          className="px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                          title="حذف هذا الطلب نهائياً من السجل"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>حذف من السجل</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancellation Confirmation Dialog */}
      {cancellationTargetId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-fade-in select-none">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4 text-right shadow-2xl border border-slate-200 animate-scale-up">
            <div className="flex items-center gap-2 text-rose-700 font-black text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>تأكيد إلغاء ترشيح الاختبار</span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              هل أنت متأكد من إلغاء هذا الطلب؟ يمكنك كتابة سبب الإلغاء ليظهر في السجل:
            </p>

            <textarea
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              placeholder="سبب الإلغاء (مثال: عدم اكتمال الحفظ، تأجيل الموعد)..."
              className="w-full p-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-hidden focus:border-rose-500 min-h-[60px]"
            />

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setCancellationTargetId(null);
                  setCancellationReason('');
                }}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black cursor-pointer shadow-xs active:scale-95"
              >
                تأكيد الإلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal for Exam Requests */}
      {deleteTarget && (
        <ConfirmationModal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
          title="حذف طلب الاختبار من السجل"
          message={`هل أنت متأكد من رغبتك في حذف طلب اختبار الطالب (${deleteTarget.studentName}) - ${deleteTarget.partsCount} ${deleteTarget.partsCount === 1 ? 'جزء' : 'أجزاء'} نهائياً من سجل طلبات الاختبارات؟`}
          confirmText="نعم، حذف من السجل"
          cancelText="إلغاء"
          type="danger"
        />
      )}

      {/* Student Profile Modal on Clicking Student Name */}
      {selectedStudent && (
        <StudentProfileModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>
  );
};
