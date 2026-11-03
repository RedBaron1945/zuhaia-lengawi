import { PointTransaction, EvaluationRecord } from '../types';
import { getHijriParts, formatISODate, getArabicDayName } from './dateUtils';

export interface DailyPointsChip {
  label: string;
  amount: number;
  type: string;
  badgeClass: string;
}

export interface EvaluationCriterionDetail {
  key: 'attendance' | 'memorization' | 'revision' | 'discipline' | 'uniform';
  label: string;
  level: string;
  points: number;
  maxPoints: number;
  statusBadgeClass: string;
}

export interface DailyPointsGroup {
  dateKey: string; // YYYY-MM-DD
  dayLabel: string; // "اليوم" | "أمس" | "الخميس"
  arabicDayName: string; // "الخميس"
  hijriDate: string; // "18 ربيع الآخر 1448 هـ"
  fullDisplayDate: string; // "اليوم (الخميس) · 18 ربيع الآخر 1448 هـ"
  isToday: boolean;
  isYesterday: boolean;
  totalPoints: number;
  positivePoints: number;
  negativePoints: number;
  transactions: PointTransaction[];
  chips: DailyPointsChip[];
  conciseSummary: string;
  teachers: string[];
  evaluationBreakdown?: EvaluationCriterionDetail[];
  evaluationTotal?: number;
  additionalTransactions: PointTransaction[];
  cumulativePointsSoFar: number; // Running cumulative total points up to this day
}

/**
 * Parses daily evaluation string to extract structured ratings for each criterion:
 * e.g. "حضور مبكر (2ن)، انضباط 1ن، زي 0ن، حفظ 1ن، مراجعة 1ن"
 */
export function parseEvaluationBreakdown(reasonText: string): EvaluationCriterionDetail[] | undefined {
  if (!reasonText || (!reasonText.includes('تقييم يوم') && !reasonText.includes('حضور'))) {
    return undefined;
  }

  // Attendance
  let attPoints = 0;
  let attLevel = 'غائب';
  let attBadge = 'bg-rose-50 text-rose-800 border-rose-200';

  if (reasonText.includes('مبكر') || reasonText.includes('حضور مبكر (2ن)')) {
    attPoints = 2;
    attLevel = 'حضور مبكر';
    attBadge = 'bg-emerald-50 text-emerald-800 border-emerald-200';
  } else if (reasonText.includes('متأخر') || reasonText.includes('حضور متأخر (1ن)')) {
    attPoints = 1;
    attLevel = 'حضور متأخر';
    attBadge = 'bg-amber-50 text-amber-800 border-amber-200';
  }

  // Memorization
  const memMatch = reasonText.match(/حفظ\s*(\d+)ن/);
  const memPoints = memMatch ? parseInt(memMatch[1], 10) : 0;
  const memLevel = memPoints === 2 ? 'متقن' : memPoints === 1 ? 'جزئي' : 'لم يحفظ';
  const memBadge =
    memPoints === 2
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : memPoints === 1
      ? 'bg-amber-50 text-amber-800 border-amber-200'
      : 'bg-slate-100 text-slate-700 border-slate-200';

  // Revision
  const revMatch = reasonText.match(/مراجعة\s*(\d+)ن/);
  const revPoints = revMatch ? parseInt(revMatch[1], 10) : 0;
  const revLevel = revPoints === 2 ? 'متقنة' : revPoints === 1 ? 'جزئية' : 'لم يراجع';
  const revBadge =
    revPoints === 2
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : revPoints === 1
      ? 'bg-blue-50 text-blue-800 border-blue-200'
      : 'bg-slate-100 text-slate-700 border-slate-200';

  // Discipline
  const disMatch = reasonText.match(/انضباط\s*(\d+)ن/);
  const disPoints = disMatch ? parseInt(disMatch[1], 10) : 0;
  const disLevel = disPoints === 2 ? 'منضبط' : disPoints === 1 ? 'وسط' : 'مخالف';
  const disBadge =
    disPoints === 2
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : disPoints === 1
      ? 'bg-purple-50 text-purple-800 border-purple-200'
      : 'bg-slate-100 text-slate-700 border-slate-200';

  // Uniform
  const uniMatch = reasonText.match(/زي\s*(\d+)ن/);
  const uniPoints = uniMatch ? parseInt(uniMatch[1], 10) : 0;
  const uniLevel = uniPoints === 2 ? 'ملتزم' : uniPoints === 1 ? 'تنبيه' : 'مخالف';
  const uniBadge =
    uniPoints === 2
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : uniPoints === 1
      ? 'bg-amber-50 text-amber-800 border-amber-200'
      : 'bg-slate-100 text-slate-700 border-slate-200';

  return [
    {
      key: 'attendance',
      label: 'الحضور',
      level: attLevel,
      points: attPoints,
      maxPoints: 2,
      statusBadgeClass: attBadge,
    },
    {
      key: 'memorization',
      label: 'الحفظ',
      level: memLevel,
      points: memPoints,
      maxPoints: 2,
      statusBadgeClass: memBadge,
    },
    {
      key: 'revision',
      label: 'المراجعة',
      level: revLevel,
      points: revPoints,
      maxPoints: 2,
      statusBadgeClass: revBadge,
    },
    {
      key: 'discipline',
      label: 'الانضباط',
      level: disLevel,
      points: disPoints,
      maxPoints: 2,
      statusBadgeClass: disBadge,
    },
    {
      key: 'uniform',
      label: 'الزي',
      level: uniLevel,
      points: uniPoints,
      maxPoints: 2,
      statusBadgeClass: uniBadge,
    },
  ];
}

/**
 * Groups raw point transactions by day so that points earned throughout
 * the day appear as a single consolidated, concise record.
 */
export function groupTransactionsByDay(
  transactions: PointTransaction[],
  evaluations?: EvaluationRecord[]
): DailyPointsGroup[] {
  const map = new Map<string, PointTransaction[]>();

  (transactions || []).forEach((tx) => {
    let key = tx.date;
    if (!key) {
      key = formatISODate(new Date());
    } else if (key.includes('T')) {
      key = key.split('T')[0];
    }
    const list = map.get(key) || [];
    list.push(tx);
    map.set(key, list);
  });

  // If evaluation records are provided, guarantee that any evaluated date is present in the map
  if (evaluations && evaluations.length > 0) {
    evaluations.forEach((e) => {
      if (!e.date) return;
      const key = e.date.includes('T') ? e.date.split('T')[0] : e.date;
      if (!map.has(key)) {
        const totalPts = typeof e.totalPoints === 'number' ? e.totalPoints : e.pointsAwarded || 0;
        const synthTx: PointTransaction = {
          id: `synth_eval_${e.id || key}`,
          studentId: e.studentId,
          studentName: e.studentName || '',
          amount: totalPts,
          type: 'memorization',
          reason: e.notes
            ? `تقييم يوم ${e.dayName || getArabicDayName(key)} (${key}): ${e.notes}`
            : `تقييم يوم ${e.dayName || getArabicDayName(key)} (${key})`,
          date: key,
          createdBy: e.recordedBy || 'المعلم',
          createdByRole: 'teacher',
        };
        map.set(key, [synthTx]);
      }
    });
  }

  const now = new Date();
  const todayKey = formatISODate(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = formatISODate(yesterday);

  const groups: DailyPointsGroup[] = [];

  map.forEach((txList, dateKey) => {
    let totalPoints = 0;
    let positivePoints = 0;
    let negativePoints = 0;

    txList.forEach((tx) => {
      const amt = Number(tx.amount) || 0;
      totalPoints += amt;
      if (amt > 0) positivePoints += amt;
      else negativePoints += amt;
    });

    const isToday = dateKey === todayKey;
    const isYesterday = dateKey === yesterdayKey;

    // Use getArabicDayName to guarantee mathematical accuracy regardless of client timezone
    const arabicDayName = getArabicDayName(dateKey);

    let dateObj: Date;
    try {
      const [y, m, d] = dateKey.split('-').map(Number);
      dateObj = new Date(y, m - 1, d);
    } catch {
      dateObj = new Date();
    }
    const hijri = getHijriParts(dateObj);

    let dayLabel: string = arabicDayName;
    if (isToday) dayLabel = 'اليوم';
    else if (isYesterday) dayLabel = 'أمس';

    const fullDisplayDate = isToday
      ? `اليوم (${arabicDayName}) · ${hijri.full}`
      : isYesterday
      ? `أمس (${arabicDayName}) · ${hijri.full}`
      : `${arabicDayName} · ${hijri.full}`;

    // Find any daily evaluation transaction in this day's list
    const evalTx = txList.find(
      (t) => t.reason?.startsWith('تقييم يوم') || t.idempotencyKey?.includes('daily_eval')
    );
    const evaluationBreakdown = evalTx ? parseEvaluationBreakdown(evalTx.reason) : undefined;
    const evaluationTotal = evalTx ? evalTx.amount : undefined;

    // Non-evaluation transactions (e.g. reward redemptions, extra bonuses)
    const additionalTransactions = txList.filter(
      (t) => t !== evalTx && !t.reason?.startsWith('تقييم يوم')
    );

    // Aggregating categories into concise chips
    const catMap: Record<string, { label: string; amount: number; type: string; badgeClass: string }> = {};

    if (evaluationBreakdown) {
      evaluationBreakdown.forEach((item) => {
        catMap[item.label] = {
          label: item.label,
          amount: item.points,
          type: item.key,
          badgeClass: item.statusBadgeClass,
        };
      });
      // Add other transactions to chips
      additionalTransactions.forEach((tx) => {
        const amt = Number(tx.amount) || 0;
        let label = 'إضافي';
        let badgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
        if (tx.type === 'reward_redemption') {
          label = 'استبدال مكافأة';
          badgeClass = 'bg-rose-50 text-rose-800 border-rose-200';
        } else if (tx.type === 'admin_bonus') {
          label = 'مكافأة إدارية';
          badgeClass = 'bg-amber-50 text-amber-800 border-amber-200';
        }
        if (!catMap[label]) {
          catMap[label] = { label, amount: 0, type: tx.type, badgeClass };
        }
        catMap[label].amount += amt;
      });
    } else {
      txList.forEach((tx) => {
        const amt = Number(tx.amount) || 0;
        let label = 'أخرى';
        let type = tx.type as string;
        let badgeClass = 'bg-slate-100 text-slate-700 border-slate-200';

        if (tx.type === 'attendance') {
          label = 'حضور';
          badgeClass = 'bg-teal-50 text-teal-800 border-teal-200';
        } else if (tx.type === 'memorization') {
          label = 'حفظ';
          badgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
        } else if (tx.type === 'revision') {
          label = 'مراجعة';
          badgeClass = 'bg-blue-50 text-blue-800 border-blue-200';
        } else if (tx.type === 'reward_redemption') {
          label = 'استبدال مكافأة';
          badgeClass = 'bg-rose-50 text-rose-800 border-rose-200';
        } else if (tx.type === 'admin_bonus') {
          label = 'مكافأة إدارية';
          badgeClass = 'bg-amber-50 text-amber-800 border-amber-200';
        }
        if (!catMap[label]) {
          catMap[label] = { label, amount: 0, type, badgeClass };
        }
        catMap[label].amount += amt;
      });
    }

    const chips = Object.values(catMap);

    // Build clean concise one-line summary
    let conciseSummary = '';
    if (evaluationBreakdown) {
      const evalPts = evaluationTotal ?? evaluationBreakdown.reduce((s, c) => s + c.points, 0);
      const addPts = additionalTransactions.reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const parts: string[] = [`التقييم ${evalPts}/10`];
      if (additionalTransactions.length > 0) {
        parts.push(`عمليات إضافية ${addPts >= 0 ? `+${addPts}` : addPts}`);
      }
      conciseSummary = parts.join(' · ');
    } else {
      const chipSummaries: string[] = [];
      chips.forEach((c) => {
        const sign = c.amount > 0 ? `+${c.amount}` : `${c.amount}`;
        chipSummaries.push(`${c.label} (${sign})`);
      });
      conciseSummary =
        chipSummaries.length > 0 ? chipSummaries.join(' · ') : txList[0]?.reason || 'سجل نقاط اليوم';
    }

    // Unique list of teachers/creators
    const teachers = Array.from(
      new Set(
        txList
          .map((t) => t.createdBy)
          .filter((name): name is string => Boolean(name && name.trim()))
      )
    );

    groups.push({
      dateKey,
      dayLabel,
      arabicDayName,
      hijriDate: hijri.full,
      fullDisplayDate,
      isToday,
      isYesterday,
      totalPoints,
      positivePoints,
      negativePoints,
      transactions: txList,
      chips,
      conciseSummary,
      teachers,
      evaluationBreakdown,
      evaluationTotal,
      additionalTransactions,
      cumulativePointsSoFar: 0,
    });
  });

  // 1. Sort chronologically (oldest first) to calculate running cumulative balance across days
  groups.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  let runningCumulative = 0;
  groups.forEach((g) => {
    runningCumulative += g.totalPoints;
    g.cumulativePointsSoFar = Math.max(0, runningCumulative);
  });

  // 2. Sort newest day first for clean timeline display
  groups.sort((a, b) => b.dateKey.localeCompare(a.dateKey));

  return groups;
}
