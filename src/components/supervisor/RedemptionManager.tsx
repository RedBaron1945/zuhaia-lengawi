import React, { useState } from 'react';
import { RedemptionRequest } from '../../types';
import { repository } from '../../services/storageService';
import { useToast } from '../../context/ToastContext';
import { Check, X, PackageCheck, RotateCcw, Clock3, AlertCircle, Sparkles } from 'lucide-react';
import { ConfirmationModal } from '../common/ConfirmationModal';

interface RedemptionManagerProps {
  onUpdate?: () => void;
  supervisorName: string;
}

export const RedemptionManager: React.FC<RedemptionManagerProps> = ({ onUpdate, supervisorName }) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'delivered' | 'rejected'>('all');
  const [selectedReq, setSelectedReq] = useState<RedemptionRequest | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('نفاد الكوبونات لدى المتجر حالياً');
  const [refundPoints, setRefundPoints] = useState(true);
  const { showToast } = useToast();

  const requests = repository.getRedemptionRequests({ status: filter === 'all' ? undefined : filter });

  const handleApprove = (req: RedemptionRequest) => {
    const res = repository.updateRedemptionStatus({
      requestId: req.id,
      status: 'approved',
      handledBy: supervisorName,
    });
    if (res.success) {
      showToast(`تمت الموافقة على طلب ${req.rewardTitle} للطالب ${req.studentName} ✓`, 'success');
      if (onUpdate) onUpdate();
    }
  };

  const handleDeliver = (req: RedemptionRequest) => {
    const res = repository.updateRedemptionStatus({
      requestId: req.id,
      status: 'delivered',
      handledBy: supervisorName,
    });
    if (res.success) {
      showToast(`تم تسليم المكافأة (${req.rewardTitle}) للطالب ${req.studentName} بنجاح 🎉`, 'success');
      if (onUpdate) onUpdate();
    }
  };

  const handleOpenReject = (req: RedemptionRequest) => {
    setSelectedReq(req);
    setRejectModalOpen(true);
  };

  const handleConfirmReject = () => {
    if (!selectedReq) return;

    const res = repository.updateRedemptionStatus({
      requestId: selectedReq.id,
      status: 'rejected',
      handledBy: supervisorName,
      rejectionReason: rejectReason,
      refundPoints,
    });

    if (res.success) {
      showToast(
        `تم رفض الطلب${refundPoints ? ` وإعادة ${selectedReq.rewardCost} نقطة لرصيد الطالب` : ''}`,
        'info'
      );
      setRejectModalOpen(false);
      setSelectedReq(null);
      if (onUpdate) onUpdate();
    }
  };

  return (
    <div className="space-y-3">
      {/* Filter Tabs - Distributed Evenly */}
      <div className="grid grid-cols-5 gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200/90 w-full text-[11px] font-bold">
        {[
          { id: 'all', label: 'الكل' },
          { id: 'pending', label: 'معلقة' },
          { id: 'approved', label: 'مقبولة' },
          { id: 'delivered', label: 'مسلّمة' },
          { id: 'rejected', label: 'مرفوضة' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id as any)}
            className={`py-2 rounded-xl font-extrabold transition-all text-center cursor-pointer ${
              filter === tab.id
                ? 'bg-teal-700 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Requests List */}
      {requests.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 text-slate-500">
          لا توجد مطالبات مكافآت مسجلة في هذا القسم.
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div
              key={req.id}
              className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs flex flex-col gap-3 hover:border-teal-200 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-2xl shrink-0">
                    <span>{req.rewardEmoji}</span>
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-black text-slate-900 truncate">{req.studentName}</h4>
                    {/* Standalone Prominent Amount Line */}
                    <div className="text-sm font-black text-teal-800 tabular-nums my-0.5">
                      ⭐ {req.rewardCost} نقطة
                    </div>
                    {/* Reward Title Beneath */}
                    <p className="text-xs font-bold text-slate-700 truncate">
                      {req.rewardTitle}
                    </p>
                    <span className="text-[11px] text-slate-400 mt-0.5 block truncate">{req.circleName}</span>
                  </div>
                </div>

                {/* Status indicator */}
                <div className="text-left shrink-0">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                      req.status === 'pending'
                        ? 'bg-amber-100 text-amber-900 border border-amber-200'
                        : req.status === 'approved'
                        ? 'bg-teal-50 text-teal-800 border border-teal-200'
                        : req.status === 'delivered'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {req.status === 'pending' && <Clock3 className="w-3.5 h-3.5" />}
                    {req.status === 'pending'
                      ? 'قيد المراجعة'
                      : req.status === 'approved'
                      ? 'تمت الموافقة'
                      : req.status === 'delivered'
                      ? 'تم التسليم'
                      : 'مرفوض'}
                  </span>
                </div>
              </div>

              {/* Action Buttons based on status */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                {req.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleApprove(req)}
                      className="flex-1 min-h-[44px] rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs active:scale-[0.98] transition-all cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>قبول الطلب</span>
                    </button>
                    <button
                      onClick={() => handleOpenReject(req)}
                      className="min-h-[44px] px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                      <span>رفض</span>
                    </button>
                  </>
                )}

                {req.status === 'approved' && (
                  <button
                    onClick={() => handleDeliver(req)}
                    className="w-full min-h-[44px] rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <PackageCheck className="w-4 h-4" />
                    <span>تأكيد التسليم الفعلي للطالب</span>
                  </button>
                )}

                {req.status === 'delivered' && (
                  <div className="text-xs text-slate-500 flex items-center justify-between w-full">
                    <span>المشرف المسلّم: {req.handledBy || supervisorName}</span>
                  </div>
                )}

                {req.status === 'rejected' && (
                  <div className="text-xs text-slate-500 flex items-center justify-between w-full">
                    <span>مرفوض: {req.rejectionReason}</span>
                    {req.refunded && <span className="text-emerald-700 font-bold">(تمت إعادة النقاط)</span>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject with Refund points Modal */}
      {selectedReq && rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-right p-6 animate-scale-up space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              رفض طلب المكافأة
            </h3>

            <p className="text-xs text-slate-600">
              أنت على وشك رفض طلب {selectedReq.rewardTitle} للطالب {selectedReq.studentName}.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">سبب الرفض</label>
              <input
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-rose-500"
              />
            </div>

            {/* Checkbox for refunding points (Requirement 18) */}
            <label className="flex items-center gap-2 p-3 bg-teal-50 border border-teal-200 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={refundPoints}
                onChange={(e) => setRefundPoints(e.target.checked)}
                className="w-4 h-4 text-teal-600 rounded-sm"
              />
              <div className="text-xs font-bold text-teal-900">
                إعادة النقاط ({selectedReq.rewardCost} نقطة) تلقائياً لرصيد الطالب
              </div>
            </label>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={handleConfirmReject}
                className="w-full min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
              >
                تأكيد الرفض
              </button>
              <button
                onClick={() => setRejectModalOpen(false)}
                className="w-full min-h-[40px] rounded-xl border border-slate-200 text-slate-600 font-medium text-xs hover:bg-slate-50"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
