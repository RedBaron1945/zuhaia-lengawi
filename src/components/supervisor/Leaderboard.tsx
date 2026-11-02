import React, { useState, useMemo } from 'react';
import { Student } from '../../types';
import { repository } from '../../services/storageService';
import { Search, Filter, Check, X } from 'lucide-react';

interface LeaderboardProps {
  students: Student[];
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ students }) => {
  const [circleFilter, setCircleFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const circles = repository.getCircles();

  // Filter and sort students descending by current points
  const sortedStudents = useMemo(() => {
    return [...students]
      .filter((s) => s.active)
      .filter((s) => (circleFilter === 'all' ? true : s.circleId === circleFilter))
      .filter((s) => (search ? s.name.includes(search) : true))
      .sort((a, b) => b.currentPoints - a.currentPoints);
  }, [students, circleFilter, search]);

  // Check if top 3 podium should be shown
  const showPodium = !search && circleFilter === 'all' && sortedStudents.length >= 3;

  // When podium is shown, list starts from rank 4 (index 3). Otherwise starts from rank 1.
  const listStudents = showPodium ? sortedStudents.slice(3) : sortedStudents;
  const rankOffset = showPodium ? 4 : 1;

  const activeCircleName =
    circleFilter === 'all'
      ? 'جميع الحلقات'
      : circles.find((c) => c.id === circleFilter)?.name || 'الحلقات';

  const getRankBadge = (rankNumber: number) => {
    if (rankNumber === 1) {
      return (
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-amber-100 border-2 border-amber-400 text-amber-800 flex items-center justify-center font-black text-sm shadow-2xs shrink-0">
          🥇
        </div>
      );
    }
    if (rankNumber === 2) {
      return (
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-100 border-2 border-slate-300 text-slate-700 flex items-center justify-center font-black text-sm shadow-2xs shrink-0">
          🥈
        </div>
      );
    }
    if (rankNumber === 3) {
      return (
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-amber-50 border-2 border-amber-600/40 text-amber-900 flex items-center justify-center font-black text-sm shadow-2xs shrink-0">
          🥉
        </div>
      );
    }
    return (
      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-50 border border-slate-200 text-slate-600 flex items-center justify-center font-black text-xs tabular-nums shrink-0">
        {rankNumber}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Unified Single-Row: Search Field + Circle Filter Button */}
      <div className="flex items-center gap-2 relative">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث في لوحة الشرف..."
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

        {/* Filter Button with Icon */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`min-h-[40px] px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer ${
              circleFilter !== 'all'
                ? 'bg-teal-50 border-teal-300 text-teal-800'
                : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50'
            }`}
            title="تصفية حسب الحلقة"
          >
            <Filter className="w-3.5 h-3.5" />
            <span className="max-w-[90px] sm:max-w-[120px] truncate">{activeCircleName}</span>
            {circleFilter !== 'all' && (
              <span className="w-1.5 h-1.5 rounded-full bg-teal-600 shrink-0" />
            )}
          </button>

          {/* Quick Filter Popover / Dropdown */}
          {isFilterOpen && (
            <>
              <div
                className="fixed inset-0 z-30 bg-black/10"
                onClick={() => setIsFilterOpen(false)}
              />
              <div className="absolute left-0 top-full mt-1.5 w-56 bg-white rounded-2xl shadow-xl border border-slate-200/90 py-1.5 z-40 text-right animate-scale-up">
                <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 border-b border-slate-100 flex items-center justify-between">
                  <span>تصفية الحلقات</span>
                  <button
                    onClick={() => setIsFilterOpen(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCircleFilter('all');
                    setIsFilterOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 font-bold ${
                    circleFilter === 'all' ? 'text-teal-800 bg-teal-50/60' : 'text-slate-700'
                  }`}
                >
                  <span>جميع الحلقات</span>
                  {circleFilter === 'all' && <Check className="w-3.5 h-3.5 text-teal-700" />}
                </button>
                <div className="my-1 border-t border-slate-100" />
                <div className="max-h-56 overflow-y-auto">
                  {circles.map((c) => {
                    const isSelected = circleFilter === c.id;
                    const studentCount = students.filter((s) => s.circleId === c.id && s.active).length;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setCircleFilter(c.id);
                          setIsFilterOpen(false);
                        }}
                        className={`w-full px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer ${
                          isSelected ? 'text-teal-800 bg-teal-50/60 font-black' : 'text-slate-700 font-medium'
                        }`}
                      >
                        <div className="text-right truncate pr-1">
                          <span className="block truncate">{c.name}</span>
                          <span className="text-[10px] text-slate-400 font-normal">{c.teacherName}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
                            {studentCount}
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-teal-700" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Top 3 Podium Highlights: 3 Equal Width Columns without text clipping */}
      {showPodium && (
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5 w-full pt-2 pb-1 items-end">
          {/* Rank 2 (Right side in RTL) */}
          <div className="w-full min-w-0 bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-200/90 text-center flex flex-col items-center justify-end shadow-2xs h-36">
            <span className="text-2xl mb-1 shrink-0">🥈</span>
            <span className="text-xs font-bold text-slate-900 truncate w-full text-center">
              {sortedStudents[1].name}
            </span>
            {circles.find((c) => c.id === sortedStudents[1].circleId)?.name && (
              <span className="text-[10px] text-slate-500 truncate w-full text-center mt-0.5">
                {circles.find((c) => c.id === sortedStudents[1].circleId)?.name}
              </span>
            )}
            <div className="mt-1.5 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200/70 w-full text-center">
              <span className="text-xs font-black text-teal-800 tabular-nums">
                ⭐ {sortedStudents[1].currentPoints}
              </span>
            </div>
          </div>

          {/* Rank 1 (Tallest, Center) */}
          <div className="w-full min-w-0 bg-gradient-to-b from-amber-50/90 to-white rounded-2xl p-2.5 sm:p-3 border-2 border-amber-300 text-center flex flex-col items-center justify-end shadow-xs h-42">
            <span className="text-3xl mb-1 shrink-0">🥇</span>
            <span className="text-xs sm:text-sm font-black text-slate-900 truncate w-full text-center">
              {sortedStudents[0].name}
            </span>
            {circles.find((c) => c.id === sortedStudents[0].circleId)?.name && (
              <span className="text-[10px] text-amber-800 font-semibold truncate w-full text-center mt-0.5">
                {circles.find((c) => c.id === sortedStudents[0].circleId)?.name}
              </span>
            )}
            <div className="mt-1.5 bg-amber-100/80 px-2 py-0.5 rounded-lg border border-amber-200 w-full text-center">
              <span className="text-xs sm:text-sm font-black text-amber-800 tabular-nums">
                ⭐ {sortedStudents[0].currentPoints}
              </span>
            </div>
            <span className="text-[9px] text-amber-900 font-extrabold bg-amber-200/70 px-1.5 py-0.2 rounded-full mt-1 shrink-0">
              متصدر الحلقات
            </span>
          </div>

          {/* Rank 3 (Left side in RTL) */}
          <div className="w-full min-w-0 bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-200/90 text-center flex flex-col items-center justify-end shadow-2xs h-32">
            <span className="text-2xl mb-1 shrink-0">🥉</span>
            <span className="text-xs font-bold text-slate-900 truncate w-full text-center">
              {sortedStudents[2].name}
            </span>
            {circles.find((c) => c.id === sortedStudents[2].circleId)?.name && (
              <span className="text-[10px] text-slate-500 truncate w-full text-center mt-0.5">
                {circles.find((c) => c.id === sortedStudents[2].circleId)?.name}
              </span>
            )}
            <div className="mt-1.5 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200/70 w-full text-center">
              <span className="text-xs font-black text-teal-800 tabular-nums">
                ⭐ {sortedStudents[2].currentPoints}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard list: Starts from 4th place when podium is shown */}
      <div className="bg-white rounded-2xl border border-slate-200/90 divide-y divide-slate-100 overflow-hidden shadow-2xs">
        {listStudents.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs font-medium">
            لا يوجد طلاب يطابقون شروط البحث أو التصفية
          </div>
        ) : (
          listStudents.map((student, idx) => {
            const currentRank = rankOffset + idx;
            const circle = circles.find((c) => c.id === student.circleId);
            const circleName = circle ? circle.name : '';

            return (
              <div
                key={student.id}
                className={`p-3 sm:p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors ${
                  !showPodium && idx < 3 ? 'bg-amber-50/20' : ''
                }`}
              >
                {/* Student Info & Rank */}
                <div className="flex items-center gap-3 min-w-0">
                  {getRankBadge(currentRank)}
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                      {student.name}
                    </h4>
                    {/* Circle Name Only */}
                    {circleName && (
                      <div className="text-[11px] font-bold text-teal-800 mt-0.5 truncate">
                        {circleName}
                      </div>
                    )}
                  </div>
                </div>

                {/* Points Only */}
                <div className="text-left shrink-0">
                  <span className="text-xs sm:text-sm font-black text-teal-900 tabular-nums block">
                    ⭐ {student.currentPoints}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
