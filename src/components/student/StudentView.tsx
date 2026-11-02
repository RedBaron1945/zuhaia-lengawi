import React, { useState, useEffect } from 'react';
import { User, Student } from '../../types';
import { repository, subscribeToDataChanges } from '../../services/storageService';
import { RewardsCatalog } from './RewardsCatalog';
import { StudentHistory } from './StudentHistory';
import { StudentAchievements } from './StudentAchievements';
import { StudentOnboardingModal } from './StudentOnboardingModal';
import { BottomNav } from '../common/BottomNav';
import {
  Sparkles,
  ChevronLeft,
  Gift,
  ArrowLeft,
  X,
  CheckCircle2,
} from 'lucide-react';
import { getHijriParts } from '../../utils/dateUtils';
import { groupTransactionsByDay, DailyPointsGroup } from '../../utils/pointUtils';

interface StudentViewProps {
  currentUser: User;
}

export const StudentView: React.FC<StudentViewProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'home' | 'rewards' | 'history' | 'achievements'>('home');
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [, setTick] = useState(0);

  // Subscribe to reactive data changes
  useEffect(() => {
    const unsubscribe = subscribeToDataChanges(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  // Fetch current student profile from repository
  const studentId = currentUser.studentId || '';
  const student = (studentId ? repository.getStudentById(studentId) : undefined) || repository.getStudents()[0];
  const circle = student?.circleId ? repository.getCircleById(student.circleId) : null;
  const allTransactions = student ? repository.getTransactions({ studentId: student.id }) : [];
  const dailyGroups = groupTransactionsByDay(allTransactions);
  const recentDays = dailyGroups.slice(0, 3);

  // Helper for relative date display (اليوم / أمس / تاريخ)
  const formatRelativeDate = (dateString?: string) => {
    if (!dateString) return 'اليوم';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      const diffDays = Math.round((startOfToday - startOfTarget) / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return 'اليوم';
      if (diffDays === 1) return 'أمس';
      if (diffDays === 2) return 'منذ يومين';
      return getHijriParts(date).formatted;
    } catch {
      return 'مؤخراً';
    }
  };

  if (!student) {
    return (
      <div className="pb-24 max-w-2xl mx-auto px-3 sm:px-4 pt-12 text-center">
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xs">
          <div className="w-16 h-16 rounded-full bg-teal-50 text-teal-800 flex items-center justify-center text-3xl mx-auto mb-4 border border-teal-100">
            📖
          </div>
          <h2 className="text-lg font-black text-slate-800 mb-2">بوابة الطلاب</h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-md mx-auto leading-relaxed">
            لم يتم تسجيل بيانات الطلاب حتى الآن. سيتم تسجيل وإضافة البيانات الفعلية قريباً بإذن الله.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24 max-w-2xl mx-auto px-3 sm:px-4 pt-3">
      {/* Tab Navigation on larger screens */}
      <div className="hidden md:flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200 shadow-xs mb-4">
        <button
          onClick={() => setActiveTab('home')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'home' ? 'bg-teal-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          الرئيسية
        </button>
        <button
          onClick={() => setActiveTab('rewards')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'rewards' ? 'bg-teal-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          المكافآت
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'history' ? 'bg-teal-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          سجلي
        </button>
        <button
          onClick={() => setActiveTab('achievements')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'achievements' ? 'bg-teal-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          إنجازاتي
        </button>
      </div>

      {activeTab === 'home' && (
        <div className="space-y-4">
          {/* Main Hero Points Card */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-800 via-teal-700 to-teal-900 text-white p-5 sm:p-6 shadow-xl border border-teal-600/30">
            {/* Islamic geometric pattern watermark */}
            <div className="absolute -left-10 -bottom-10 w-44 h-44 rounded-full bg-teal-500/10 pointer-events-none" />
            <div className="absolute right-0 top-0 w-32 h-32 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div>
                    <h2 className="text-sm font-bold leading-none">{student.name}</h2>
                    <span className="text-[11px] text-teal-200 mt-0.5 inline-block">
                      {circle ? `${circle.name} - المعلم ${circle.teacherName}` : 'حلقة سعيد بن زيد - المعلم علي باعباد'}
                    </span>
                  </div>
                </div>

                {/* Profile Data completion status */}
                {student.profileCompleted ? (
                  <button
                    type="button"
                    onClick={() => setShowProfileModal(true)}
                    className="text-[10px] font-bold px-2 py-1 rounded-xl bg-white/15 hover:bg-white/25 text-teal-100 flex items-center gap-1 transition-colors cursor-pointer"
                    title="مراجعة وتعديل بياناتي"
                  >
                    <span>بياناتي المسجلة</span>
                    <span className="text-emerald-300">✓</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowProfileModal(true)}
                    className="text-[10px] font-black px-2.5 py-1 rounded-xl bg-amber-400 hover:bg-amber-300 text-teal-950 flex items-center gap-1 shadow-xs animate-pulse cursor-pointer"
                    title="تعبئة البيانات الرسمية"
                  >
                    <span>تعبئة البيانات</span>
                    <span>⚠️</span>
                  </button>
                )}
              </div>

              {/* Points Display: shortened to «رصيدك», smaller star, and ⓘ points explanation link */}
              <div className="my-4 text-center py-2">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <span className="text-xs font-bold text-teal-200 tracking-wide">
                    رصيدك
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPointsModal(true)}
                    className="w-5 h-5 rounded-full bg-white/15 hover:bg-white/25 text-teal-100 hover:text-white flex items-center justify-center text-[11px] font-bold transition-colors cursor-pointer"
                    title="شرح احتساب النقاط"
                    aria-label="شرح احتساب النقاط"
                  >
                    ⓘ
                  </button>
                </div>
                <div className="inline-flex items-center justify-center gap-2">
                  <span className="text-xl text-amber-300">⭐</span>
                  <span className="text-5xl sm:text-6xl font-black tracking-tight text-white tabular-nums drop-shadow-md">
                    {student.currentPoints}
                  </span>
                  <span className="text-base sm:text-lg font-bold text-teal-200 mr-1 self-end mb-2">
                    نقطة
                  </span>
                </div>
              </div>

              {/* Quick Actions Strip */}
              <div className="grid grid-cols-2 gap-2 mt-4">
                <button
                  onClick={() => setActiveTab('rewards')}
                  className="min-h-[44px] rounded-xl bg-amber-500 hover:bg-amber-600 text-teal-950 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Gift className="w-4 h-4 text-teal-950" />
                  <span>استرداد مكافأة</span>
                </button>
                {/* Clear white border for 'عرض سجلي' with RTL forward ArrowLeft */}
                <button
                  onClick={() => setActiveTab('history')}
                  className="min-h-[44px] rounded-xl border-2 border-white/80 bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs active:scale-[0.98] transition-all cursor-pointer"
                >
                  <span>عرض سجلي</span>
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Recent Point Operations: daily consolidated view, concise summary, larger numbers */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                آخر عمليات النقاط
              </h3>
              {/* 44px Touch Target for 'عرض الكل' */}
              <button
                onClick={() => setActiveTab('history')}
                className="min-h-[44px] px-2 text-xs font-bold text-teal-700 hover:text-teal-900 inline-flex items-center gap-1 cursor-pointer"
                aria-label="عرض سجل النقاط"
              >
                <span>عرض الكل</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {recentDays.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  لا توجد نقاط مسجلة حتى الآن.
                </div>
              ) : (
                recentDays.map((day: DailyPointsGroup) => (
                  <div
                    key={day.dateKey}
                    onClick={() => setActiveTab('history')}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/70 hover:bg-teal-50/40 border border-slate-100 hover:border-teal-200 text-xs transition-colors cursor-pointer"
                  >
                    <div className="flex flex-col gap-0.5 max-w-[70%]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-800">
                          {day.dayLabel === 'اليوم'
                            ? `نقاط اليوم (${day.arabicDayName})`
                            : day.dayLabel === 'أمس'
                            ? `نقاط أمس (${day.arabicDayName})`
                            : `نقاط ${day.arabicDayName}`}
                        </span>
                        {day.isToday && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-100 text-teal-800">
                            اليوم
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium line-clamp-1">
                        {day.conciseSummary}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        dir="ltr"
                        className={`text-base font-black tabular-nums ${
                          day.totalPoints > 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {day.totalPoints > 0 ? `+${day.totalPoints}` : day.totalPoints}
                      </span>
                      <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Motivational Hadith in one single clean line at the bottom */}
          <div className="text-center py-2 px-1">
            <p className="text-[11px] text-slate-500 font-medium inline-flex items-center justify-center gap-1.5 flex-wrap">
              <span>قال رسول الله ﷺ:</span>
              <span className="text-teal-900 font-bold">« خَيْرُكُمْ مَنْ تَعَلَّمَ القُرْآنَ وَعَلَّمَهُ »</span>
            </p>
          </div>
        </div>
      )}

      {activeTab === 'rewards' && (
        <RewardsCatalog student={student} onRedeemSuccess={() => setTick((t) => t + 1)} />
      )}

      {activeTab === 'history' && <StudentHistory studentId={student.id} />}

      {activeTab === 'achievements' && <StudentAchievements student={student} />}

      {/* Points Calculation Explanation Modal */}
      {showPointsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-sm w-full shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowPointsModal(false)}
              className="absolute left-4 top-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <span className="w-8 h-8 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center font-bold text-sm">
                ⭐
              </span>
              <h3 className="text-sm font-black text-slate-900">
                كيف تُحسب نقاطك اليومية؟
              </h3>
            </div>

            <p className="text-xs text-slate-600 mb-3.5 leading-relaxed">
              يحصل الطالب المتميز على ما يصل إلى <strong className="text-teal-900 font-black">10 نقاط يومياً</strong> (بحد أقصى 40 نقطة أسبوعياً) موزعة على 5 معايير أساسية:
            </p>

            <div className="space-y-2 mb-5">
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 text-xs font-semibold text-slate-800">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  الحضور
                </span>
                <span className="font-extrabold text-teal-800">2 نقطة</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 text-xs font-semibold text-slate-800">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  الحفظ
                </span>
                <span className="font-extrabold text-teal-800">2 نقطة</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 text-xs font-semibold text-slate-800">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  المراجعة
                </span>
                <span className="font-extrabold text-teal-800">2 نقطة</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 text-xs font-semibold text-slate-800">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  الإنضباط
                </span>
                <span className="font-extrabold text-teal-800">2 نقطة</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 text-xs font-semibold text-slate-800">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  الزي
                </span>
                <span className="font-extrabold text-teal-800">2 نقطة</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowPointsModal(false)}
              className="w-full py-2.5 rounded-xl bg-teal-800 hover:bg-teal-900 text-white font-extrabold text-xs shadow-md shadow-teal-900/15 transition-all cursor-pointer"
            >
              حسناً، استوعبت
            </button>
          </div>
        </div>
      )}

      {/* Mandatory Onboarding & Profile Completion Modal */}
      {student && (
        <StudentOnboardingModal
          student={student}
          isOpen={!student.profileCompleted || showProfileModal}
          onComplete={() => {
            setShowProfileModal(false);
            setTick((t) => t + 1);
          }}
        />
      )}

      {/* Mobile Bottom Navigation */}
      <BottomNav role="student" activeTab={activeTab} onTabChange={(t) => setActiveTab(t as any)} />
    </div>
  );
};
