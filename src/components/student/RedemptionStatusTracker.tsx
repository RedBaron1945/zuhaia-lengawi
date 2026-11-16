import React from 'react';
import { RedemptionRequest } from '../../types';
import { Check, X } from 'lucide-react';
import { formatHijriDate } from '../../utils/dateUtils';

interface RedemptionStatusTrackerProps {
  request: RedemptionRequest;
  onDelete?: (req: RedemptionRequest) => void;
}

interface TrackerStep {
  key: 'pending' | 'approved' | 'ready' | 'delivered';
  label: string;
}

const TRACKER_STEPS: TrackerStep[] = [
  { key: 'pending', label: 'موافقة المشرف' },
  { key: 'approved', label: 'جاري التجهيز' },
  { key: 'ready', label: 'جاهز للاستلام' },
  { key: 'delivered', label: 'تم الاستلام' },
];

function getStatusPresentation(req: RedemptionRequest): {
  activeStepIndex: number;
  title: string;
  subtitle: string;
  progressWidthPercent: number;
  isRejected: boolean;
  isCompleted: boolean;
} {
  switch (req.status) {
    case 'pending':
      return {
        activeStepIndex: 0,
        title: 'بانتظار موافقة المشرف',
        subtitle: 'تم إرسال طلب الاسترداد وهو الآن بانتظار موافقة المشرف على الطالب',
        progressWidthPercent: 12,
        isRejected: false,
        isCompleted: false,
      };
    case 'approved':
      return {
        activeStepIndex: 1,
        title: 'جاري تجهيز الطلب',
        subtitle: 'تمت موافقة المشرف وجاري تجهيز المكافأة للطالب',
        progressWidthPercent: 45,
        isRejected: false,
        isCompleted: false,
      };
    case 'ready':
      return {
        activeStepIndex: 2,
        title: 'جاهز للاستلام',
        subtitle: 'تم تجهيز المكافأة ويمكنك استلامها من المشرف في الحلقة',
        progressWidthPercent: 78,
        isRejected: false,
        isCompleted: false,
      };
    case 'delivered':
      return {
        activeStepIndex: 3,
        title: 'تم الاستلام',
        subtitle: req.handledBy
          ? `تم تسليم المكافأة للطالب بواسطة ${req.handledBy}`
          : 'تم تسليم المكافأة للطالب بنجاح',
        progressWidthPercent: 100,
        isRejected: false,
        isCompleted: true,
      };
    case 'rejected':
      return {
        activeStepIndex: 0,
        title: 'تم رفض الطلب',
        subtitle: `${req.rejectionReason || 'تعذر تنفيذ طلب المكافأة حالياً'}${
          req.refunded ? ` · تمت إعادة ${req.rewardCost} نقطة لرصيدك` : ''
        }`,
        progressWidthPercent: 0,
        isRejected: true,
        isCompleted: false,
      };
  }
}

export const RedemptionStatusTracker: React.FC<RedemptionStatusTrackerProps> = ({
  request,
  onDelete,
}) => {
  const presentation = getStatusPresentation(request);

  const metaParts: string[] = [`${request.rewardCost} نقطة`];
  if (request.requestDate) {
    metaParts.push(formatHijriDate(new Date(request.requestDate)));
  }
  if (request.handledBy) {
    metaParts.push(`المشرف: ${request.handledBy}`);
  }

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs transition-colors">
      {/* Top Reward Info Row */}
      <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-2xl shrink-0">
            <span aria-hidden="true">{request.rewardEmoji}</span>
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-slate-900 truncate">{request.rewardTitle}</h4>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums truncate">
              {metaParts.join(' · ')}
            </p>
          </div>
        </div>

        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(request)}
            title="حذف الطلب من السجل"
            aria-label="حذف الطلب من السجل"
            className="min-w-[44px] min-h-[44px] -my-1.5 -ml-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Centered Current Stage Headline & Subtitle (matching reference tracker layout) */}
      <div className="text-center pt-5 pb-6 px-2">
        <h5
          className={`text-base sm:text-lg font-extrabold tracking-tight ${
            presentation.isRejected
              ? 'text-rose-700'
              : presentation.isCompleted
              ? 'text-emerald-700'
              : 'text-slate-900'
          }`}
        >
          {presentation.title}
        </h5>
        <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed max-w-md mx-auto">
          {presentation.subtitle}
        </p>
      </div>

      {/* 4-Step Horizontal RTL Progress Track */}
      <div className="relative pb-1" dir="rtl">
        {/* Track Line Layer spanning from center of first column (12.5%) to center of last column (12.5%) */}
        <div
          aria-hidden="true"
          className="absolute top-3.5 left-[12.5%] right-[12.5%] h-1.5 bg-slate-200 rounded-full overflow-hidden"
        >
          {!presentation.isRejected && (
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                presentation.isCompleted ? 'bg-emerald-700' : 'bg-sky-700'
              }`}
              style={{ width: `${presentation.progressWidthPercent}%` }}
            />
          )}
        </div>

        {/* Step Nodes & Labels */}
        <div className="relative z-10 grid grid-cols-4 gap-1">
          {TRACKER_STEPS.map((step, index) => {
            const isFirstRejected = presentation.isRejected && index === 0;
            const isDoneOrCurrent = !presentation.isRejected && index <= presentation.activeStepIndex;
            const isCurrent = !presentation.isRejected && index === presentation.activeStepIndex;

            const circleClass = isFirstRejected
              ? 'bg-rose-600 border-rose-600 text-white'
              : isDoneOrCurrent
              ? presentation.isCompleted
                ? 'bg-emerald-700 border-emerald-700 text-white'
                : 'bg-sky-700 border-sky-700 text-white'
              : 'bg-white border-2 border-slate-300 text-transparent';

            const labelText = isFirstRejected ? 'تم الرفض' : step.label;

            return (
              <div key={step.key} className="flex flex-col items-center text-center">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors shadow-2xs ${circleClass}`}
                >
                  {isFirstRejected ? (
                    <X className="w-3.5 h-3.5 stroke-[2.75]" />
                  ) : isDoneOrCurrent ? (
                    <Check className="w-3.5 h-3.5 stroke-[2.75]" />
                  ) : null}
                </div>
                <span
                  className={`mt-2 text-[11px] sm:text-xs leading-snug px-0.5 ${
                    isFirstRejected
                      ? 'font-extrabold text-rose-700'
                      : isCurrent
                      ? 'font-extrabold text-slate-900'
                      : isDoneOrCurrent
                      ? 'font-semibold text-slate-700'
                      : 'font-medium text-slate-500'
                  }`}
                >
                  {labelText}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
