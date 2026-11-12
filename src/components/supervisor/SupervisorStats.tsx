import React from 'react';
import { Student } from '../../types';
import { repository } from '../../services/storageService';
import { Users, CheckCircle, BarChart3, TrendingUp, AlertTriangle, BookOpen, Award } from 'lucide-react';
import { CircleAttendanceComparison } from './CircleAttendanceComparison';

interface SupervisorStatsProps {
  students: Student[];
}

export const SupervisorStats: React.FC<SupervisorStatsProps> = ({ students }) => {
  const circles = repository.getCircles();
  const transactions = repository.getTransactions();
  const attendanceHistory = repository.getAttendanceHistory();

  // Metrics
  const totalStudents = students.length;
  const activeStudents = students.filter((s) => s.active);

  const studentsWithRecords = activeStudents
    .map((s) => ({ student: s, stats: repository.getStudentAttendanceStats(s.id) }))
    .filter((item) => item.stats.hasRecords);

  const avgAttendance =
    studentsWithRecords.length > 0
      ? Math.round(
          studentsWithRecords.reduce((acc, item) => acc + item.stats.attendanceRate, 0) /
            studentsWithRecords.length
        )
      : 0;

  const totalAbsences = students.reduce((acc, s) => acc + s.consecutiveAbsences, 0);

  const memorizationTxCount = transactions.filter((t) => t.type === 'memorization').length;
  const revisionTxCount = transactions.filter((t) => t.type === 'revision').length;

  // Circles comparison
  const circleStats = circles.map((circle) => {
    const cStudents = activeStudents.filter((s) => s.circleId === circle.id);
    const cWithRecords = cStudents
      .map((s) => repository.getStudentAttendanceStats(s.id))
      .filter((st) => st.hasRecords);

    const avgAtt =
      cWithRecords.length > 0
        ? Math.round(cWithRecords.reduce((acc, st) => acc + st.attendanceRate, 0) / cWithRecords.length)
        : 0;
    const totalPoints = cStudents.reduce((acc, s) => acc + s.currentPoints, 0);
    return {
      circle,
      studentCount: cStudents.length,
      hasRecords: cWithRecords.length > 0,
      avgAttendance: avgAtt,
      totalPoints,
    };
  });

  return (
    <div className="space-y-4">
      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-slate-500">إجمالي الطلاب</span>
            <Users className="w-4 h-4 text-teal-600" />
          </div>
          <span className={`text-xl font-black tabular-nums ${totalStudents === 0 ? 'text-slate-400' : 'text-slate-900'}`}>
            {totalStudents}
          </span>
          <span className="text-[10px] text-teal-700 block mt-0.5 font-medium">{activeStudents.length} طالب نشط</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-slate-500">متوسط الحضور</span>
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <span className={`text-xl font-black tabular-nums ${studentsWithRecords.length === 0 ? 'text-slate-400' : 'text-slate-900'}`}>
            {studentsWithRecords.length > 0 ? `${avgAttendance}%` : '—'}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {studentsWithRecords.length > 0 ? 'نسبة عامة لجميع الحلقات' : 'بانتظار رصد المعلمين'}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-slate-500">جلسات التسميع</span>
            <BookOpen className="w-4 h-4 text-amber-600" />
          </div>
          <span className={`text-xl font-black tabular-nums ${memorizationTxCount === 0 ? 'text-slate-400' : 'text-slate-900'}`}>
            {memorizationTxCount}
          </span>
          <span className="text-[10px] text-amber-700 block mt-0.5 font-medium">إنجاز حفظ معتمد</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-slate-500">جلسات المراجعة</span>
            <Award className="w-4 h-4 text-indigo-600" />
          </div>
          <span className={`text-xl font-black tabular-nums ${revisionTxCount === 0 ? 'text-slate-400' : 'text-slate-900'}`}>
            {revisionTxCount}
          </span>
          <span className="text-[10px] text-indigo-700 block mt-0.5 font-medium">مراجعات مقيدة</span>
        </div>
      </div>

      {/* Circle Attendance Comparison (Interactive Circles & Arrows/Bars) */}
      <CircleAttendanceComparison circles={circles} students={students} />

      {/* Points Distribution & Activity Level */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Highest student points */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <h4 className="text-xs font-extrabold text-slate-900 mb-2 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            أعلى 3 طلاب تميزاً
          </h4>
          <div className="space-y-2">
            {students.slice(0, 3).map((s, idx) => (
              <div key={s.id} className="flex items-center justify-between text-xs py-1 border-b border-slate-50">
                <span className="font-bold text-slate-800">
                  {idx + 1}. {s.name}
                </span>
                <span className="font-black text-teal-700 tabular-nums">{s.currentPoints} ن</span>
              </div>
            ))}
          </div>
        </div>

        {/* Attendance Summary */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <h4 className="text-xs font-extrabold text-slate-900 mb-2 flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-teal-600" />
            موجز الانضباط
          </h4>
          <div className="space-y-1.5 text-xs text-slate-600">
            <div className="flex justify-between py-1">
              <span>نسبة الطلاب المنتظمين (&gt;85%):</span>
              {studentsWithRecords.filter((item) => item.stats.attendanceRate >= 85).length === 0 ? (
                <span className="font-bold text-slate-400">0 طلاب</span>
              ) : (
                <span className="font-bold text-teal-800">
                  {studentsWithRecords.filter((item) => item.stats.attendanceRate >= 85).length} طلاب
                </span>
              )}
            </div>
            <div className="flex justify-between py-1">
              <span>عدد الطلاب قيد المتابعة (&lt;70%):</span>
              {studentsWithRecords.filter((item) => item.stats.attendanceRate < 70).length === 0 ? (
                <span className="font-bold text-slate-400">0 طلاب</span>
              ) : (
                <span className="font-bold text-rose-600">
                  {studentsWithRecords.filter((item) => item.stats.attendanceRate < 70).length} طلاب
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
