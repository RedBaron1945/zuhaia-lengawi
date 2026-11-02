import React from 'react';
import { repository } from '../../services/storageService';
import { Student } from '../../types';
import { Award, Lock, Sparkles, CheckCircle2 } from 'lucide-react';

interface StudentAchievementsProps {
  student: Student;
}

export const StudentAchievements: React.FC<StudentAchievementsProps> = ({ student }) => {
  const achievements = repository.getAchievements(student.id);

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-amber-500 via-amber-600 to-teal-800 text-white rounded-3xl p-5 shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Award className="w-5 h-5 text-amber-200" />
              <span className="text-xs font-bold text-amber-100">لوحة الأوسمة والإنجازات</span>
            </div>
            <h3 className="text-lg font-black">أوسمة الطالب القرآنية</h3>
            <p className="text-xs text-amber-100/90 mt-1">
              واصل الحضور والتسميع لفتح أوسمة الفخر والتميز
            </p>
          </div>
          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex flex-col items-center justify-center shrink-0">
            <span className="text-xl font-black tabular-nums">
              {achievements.filter((a) => a.unlockedAt).length} / {achievements.length}
            </span>
            <span className="text-[10px] text-amber-200 font-medium">أوسمة مكتسبة</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {achievements.map((item) => {
          const isUnlocked = !!item.unlockedAt;

          return (
            <div
              key={item.id}
              className={`p-4 rounded-2xl border transition-all flex items-start gap-3.5 ${
                isUnlocked
                  ? 'bg-white border-amber-300 shadow-xs'
                  : 'bg-slate-50/70 border-slate-200 opacity-60'
              }`}
            >
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0 shadow-xs ${
                  isUnlocked
                    ? 'bg-gradient-to-br from-amber-100 to-amber-200 border border-amber-300'
                    : 'bg-slate-200 border border-slate-300 text-slate-400 grayscale'
                }`}
              >
                <span>{item.icon}</span>
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <h4 className="text-sm font-extrabold text-slate-900">{item.title}</h4>
                  {isUnlocked ? (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                      <CheckCircle2 className="w-3 h-3 text-teal-600" />
                      مكتمل
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-slate-400">
                      <Lock className="w-3 h-3" />
                      مغلق
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-600 leading-snug">{item.description}</p>

                {item.requiredPoints && (
                  <div className="mt-2 text-[11px] text-slate-500 font-medium">
                    الهدف: {item.requiredPoints} نقطة
                    {!isUnlocked && (
                      <span className="text-amber-700 font-bold mr-1">
                        (متبقي {Math.max(0, item.requiredPoints - student.currentPoints)})
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
