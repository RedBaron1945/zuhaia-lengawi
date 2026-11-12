import React, { useState } from 'react';
import { Student } from '../../types';
import { repository } from '../../services/storageService';
import { useToast } from '../../context/ToastContext';
import {
  X,
  User,
  CreditCard,
  PhoneCall,
  Check,
  Eye,
  GraduationCap,
  Users as UsersIcon,
} from 'lucide-react';
import { calculateAge } from '../../utils/dateUtils';

interface StudentProfileModalProps {
  student: Student | null;
  onClose: () => void;
}

export const StudentProfileModal: React.FC<StudentProfileModalProps> = ({ student, onClose }) => {
  const [showNationalId, setShowNationalId] = useState(false);
  const { showToast } = useToast();

  if (!student) return null;

  const circles = repository.getCircles();
  const circle = circles.find((c) => c.id === student.circleId);
  const attStats = repository.getStudentAttendanceStats(student.id);

  const maskNationalId = (idStr?: string) => {
    const base = idStr || '1084920158';
    if (base.length < 6) return '10****' + base.slice(-2);
    return base.slice(0, 4) + '****' + base.slice(-2);
  };

  const handleShowIdWithAudit = () => {
    setShowNationalId(true);
    repository.addAuditLog({
      actorId: 'user',
      actorName: 'معاينة البطاقة',
      actorRole: 'supervisor',
      action: 'عرض بيانات حساسة',
      details: `تمت معاينة رقم الهوية الوطنية للطالب (${student.name})`,
      targetType: 'student',
      targetId: student.id,
    });
    showToast('تم إظهار الهوية وتسجيل إجراء المعاينة في سجل التدقيق ✓', 'info');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl p-5 space-y-4 text-right relative select-text">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center font-black text-base shadow-2xs">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900">
                بطاقة الطالب الرسمية
              </h3>
              <p className="text-[11px] text-slate-500">
                {student.name} · كود الطالب: {student.id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Statistics Banner (3 columns) */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
          <div className="bg-emerald-50/80 p-2.5 rounded-2xl border border-emerald-200/90">
            <span className="text-[10px] text-emerald-800 block font-bold">أيام الحضور</span>
            <span className="text-sm font-black text-emerald-950 block mt-0.5 tabular-nums">
              {attStats.presentDays} يوم
            </span>
            <span className="text-[9px] text-emerald-700 font-medium block">
              رصد (2 أو 1)
            </span>
          </div>

          <div className="bg-rose-50/80 p-2.5 rounded-2xl border border-rose-200/90">
            <span className="text-[10px] text-rose-800 block font-bold">أيام الغياب</span>
            <span className="text-sm font-black text-rose-950 block mt-0.5 tabular-nums">
              {attStats.absentDays} يوم
            </span>
            <span className="text-[9px] text-rose-700 font-medium block">
              رصد (0)
            </span>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
            <span className="text-[10px] text-slate-500 block font-bold">نسبة الانضباط</span>
            <span className="text-sm font-black text-slate-900 block mt-0.5 tabular-nums">
              {attStats.hasRecords ? `${attStats.attendanceRate}%` : '—'}
            </span>
            <span className="text-[9px] text-slate-500 font-medium block truncate">
              {circle?.name || 'عامة'}
            </span>
          </div>
        </div>

        {/* Demographic Information Sections */}
        <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-200/90 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
            <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-teal-700" />
              <span>البيانات الشخصية ومعلومات الاتصال</span>
            </h4>
            {student.profileCompleted ? (
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
                <span className={`text-left ${student.fullNameQuad ? 'font-extrabold text-slate-900' : 'text-slate-400'}`}>
                  {student.fullNameQuad || student.name || '—'}
                </span>
              </div>

              <div className="py-1.5 flex items-center justify-between gap-2">
                <span className="text-slate-500 font-bold shrink-0">رقم الهوية / الإقامة:</span>
                {student.nationalId ? (
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900 tabular-nums">
                      {showNationalId ? student.nationalId : maskNationalId(student.nationalId)}
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
                <span className={student.nationality ? 'font-bold text-slate-900' : 'text-slate-400'}>
                  {student.nationality || '—'}
                </span>
              </div>

              <div className="py-1.5 flex items-center justify-between gap-2">
                <span className="text-slate-500 font-bold shrink-0">تاريخ الميلاد:</span>
                <span className={student.birthDate ? 'font-bold text-slate-900 tabular-nums' : 'text-slate-400'}>
                  {student.birthDate || '—'}
                </span>
              </div>

              <div className="py-1.5 flex items-center justify-between gap-2">
                <span className="text-slate-500 font-bold shrink-0">عمر الطالب:</span>
                <span className={student.birthDate || student.age ? 'font-black text-teal-900 tabular-nums' : 'text-slate-400'}>
                  {student.birthDate && calculateAge(student.birthDate) !== null
                    ? `${calculateAge(student.birthDate)} سنة`
                    : student.age
                    ? `${student.age} سنة`
                    : '—'}
                </span>
              </div>

              <div className="py-1.5 flex items-center justify-between gap-2">
                <span className="text-slate-500 font-bold shrink-0">مكان الميلاد:</span>
                <span className={student.birthPlace ? 'font-bold text-slate-900' : 'text-slate-400'}>
                  {student.birthPlace || '—'}
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
                <span className={student.schoolName ? 'font-bold text-slate-900 text-left' : 'text-slate-400'}>
                  {student.schoolName || '—'}
                </span>
              </div>

              <div className="py-1.5 flex items-center justify-between gap-2">
                <span className="text-slate-500 font-bold shrink-0">المرحلة الدراسية:</span>
                <span className={student.educationalLevel ? 'font-bold text-slate-900' : 'text-slate-400'}>
                  {student.educationalLevel || '—'}
                </span>
              </div>

              <div className="py-1.5 flex items-center justify-between gap-2">
                <span className="text-slate-500 font-bold shrink-0">عنوان الطالب:</span>
                <span className={student.address ? 'font-bold text-slate-900 text-left' : 'text-slate-400'}>
                  {student.address || '—'}
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
                <span className={student.guardianName ? 'font-extrabold text-slate-900' : 'text-slate-400'}>
                  {student.guardianName || '—'}
                </span>
              </div>

              <div className="py-1.5 flex items-center justify-between gap-2">
                <span className="text-slate-500 font-bold shrink-0">صلة القرابة:</span>
                <span className={student.guardianRelation ? 'font-bold text-slate-900' : 'text-slate-400'}>
                  {student.guardianRelation || '—'}
                </span>
              </div>

              <div className="py-1.5 flex items-center justify-between gap-2">
                <span className="text-slate-500 font-bold shrink-0">جوال ولي الأمر:</span>
                {student.guardianPhone || student.parentPhone ? (
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-teal-900 tabular-nums">
                      {student.guardianPhone || student.parentPhone}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <a
                        href={`tel:${student.guardianPhone || student.parentPhone}`}
                        className="p-1 rounded-lg bg-teal-700 text-white text-[10px] font-bold flex items-center gap-1 shadow-2xs"
                        title="اتصال تلفوني"
                      >
                        <PhoneCall className="w-3 h-3" />
                      </a>
                      <a
                        href={`https://wa.me/966${(student.guardianPhone || student.parentPhone)!.replace(/^0/, '')}`}
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
                <span className={student.phone ? 'font-bold text-slate-800 tabular-nums' : 'text-slate-400'}>
                  {student.phone || '—'}
                </span>
              </div>

              <div className="py-1.5 flex items-center justify-between gap-2">
                <span className="text-slate-500 font-bold shrink-0">البريد الإلكتروني:</span>
                <span className="font-bold text-slate-800 truncate max-w-[180px]">
                  {student.email || '—'}
                </span>
              </div>
            </div>
          </div>
        </div>


        {/* Close Button */}
        <div className="pt-2 border-t border-slate-100 sticky bottom-0 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
