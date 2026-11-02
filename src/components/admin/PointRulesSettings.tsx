import React, { useState } from 'react';
import { PointRules, User } from '../../types';
import { repository } from '../../services/storageService';
import { useToast } from '../../context/ToastContext';
import { Settings, Check, RotateCcw } from 'lucide-react';

interface PointRulesSettingsProps {
  adminUser: User;
  onUpdate: () => void;
}

export const PointRulesSettings: React.FC<PointRulesSettingsProps> = ({ adminUser, onUpdate }) => {
  const [rules, setRules] = useState<PointRules>(() => repository.getPointRules());
  const { showToast } = useToast();

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    repository.updatePointRules(rules, adminUser);
    showToast('تم حفظ قواعد النقاط الجديدة وتحديث النظام فوراً ✓', 'success');
    onUpdate();
  };

  const handleChange = (key: keyof PointRules, val: number) => {
    setRules((prev) => ({
      ...prev,
      [key]: Math.max(0, val),
    }));
  };

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
            <Settings className="w-4 h-4 text-indigo-700" />
            إعدادات وقواعد منح النقاط في الحلقات
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            تُطبق هذه القيم ديناميكياً على التحضير والتقييم دون الحاجة لتعديل الكود
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* 1. Attendance */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-800 mb-1">
              🟢 1. الحضور
            </label>
            <p className="text-[11px] text-slate-500 mb-2">الحضور المبكر (الحد الأقصى 2ن)</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="5"
                value={rules.attendanceEarly ?? 2}
                onChange={(e) => handleChange('attendanceEarly', parseInt(e.target.value) || 0)}
                className="w-24 px-3 py-1.5 text-sm font-black text-center rounded-lg border border-slate-300 bg-white"
              />
              <span className="text-xs font-bold text-slate-600">نقاط</span>
            </div>
          </div>

          {/* 2. Memorization */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-800 mb-1">
              📖 2. الحفظ
            </label>
            <p className="text-[11px] text-slate-500 mb-2">إتقان حفظ المقرر اليومي المطلوب</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="5"
                value={rules.memorizationMax ?? 2}
                onChange={(e) => handleChange('memorizationMax', parseInt(e.target.value) || 0)}
                className="w-24 px-3 py-1.5 text-sm font-black text-center rounded-lg border border-slate-300 bg-white"
              />
              <span className="text-xs font-bold text-slate-600">نقاط</span>
            </div>
          </div>

          {/* 3. Revision */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-800 mb-1">
              🔄 3. المراجعة
            </label>
            <p className="text-[11px] text-slate-500 mb-2">إتقان مراجعة المحفوظات السابقة</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="5"
                value={rules.revisionMax ?? 2}
                onChange={(e) => handleChange('revisionMax', parseInt(e.target.value) || 0)}
                className="w-24 px-3 py-1.5 text-sm font-black text-center rounded-lg border border-slate-300 bg-white"
              />
              <span className="text-xs font-bold text-slate-600">نقاط</span>
            </div>
          </div>

          {/* 4. Discipline */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-800 mb-1">
              ⭐ 4. الإنضباط
            </label>
            <p className="text-[11px] text-slate-500 mb-2">الأدب وحسن السلوك والتفاعل القرآني</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="5"
                value={rules.disciplineMax ?? 2}
                onChange={(e) => handleChange('disciplineMax', parseInt(e.target.value) || 0)}
                className="w-24 px-3 py-1.5 text-sm font-black text-center rounded-lg border border-slate-300 bg-white"
              />
              <span className="text-xs font-bold text-slate-600">نقاط</span>
            </div>
          </div>

          {/* 5. Uniform */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-800 mb-1">
              👔 5. الزي
            </label>
            <p className="text-[11px] text-slate-500 mb-2">الالتزام بالزي المناسب والسمت الحسن</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="5"
                value={rules.uniformMax ?? 2}
                onChange={(e) => handleChange('uniformMax', parseInt(e.target.value) || 0)}
                className="w-24 px-3 py-1.5 text-sm font-black text-center rounded-lg border border-slate-300 bg-white"
              />
              <span className="text-xs font-bold text-slate-600">نقاط</span>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            className="w-full sm:w-auto min-h-[44px] px-6 rounded-xl bg-indigo-900 hover:bg-indigo-950 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>حفظ واعتماد قواعد النقاط</span>
          </button>
        </div>
      </form>
    </div>
  );
};
