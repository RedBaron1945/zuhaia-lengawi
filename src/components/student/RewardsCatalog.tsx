import React, { useState } from 'react';
import { Reward, Student } from '../../types';
import { repository } from '../../services/storageService';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { useToast } from '../../context/ToastContext';
import { Sparkles, Check, AlertCircle, ShoppingBag } from 'lucide-react';

interface RewardsCatalogProps {
  student: Student;
  onRedeemSuccess?: () => void;
}

export const RewardsCatalog: React.FC<RewardsCatalogProps> = ({ student, onRedeemSuccess }) => {
  const [rewards, setRewards] = useState<Reward[]>(() => repository.getRewards());
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { showToast } = useToast();

  const handleOpenRedeem = (reward: Reward) => {
    if (student.currentPoints < reward.costPoints) {
      showToast(`عفواً، رصيدك (${student.currentPoints} نقطة) لا يكفي لاسترداد هذه المكافأة (${reward.costPoints} نقطة).`, 'error');
      return;
    }
    setSelectedReward(reward);
    setIsModalOpen(true);
  };

  const handleConfirmRedeem = () => {
    if (!selectedReward) return;

    const result = repository.createRedemptionRequest(student.id, selectedReward.id);

    if (result.success) {
      showToast(`تم استرداد ${selectedReward.title} بنجاح! طلبك قيد المراجعة لدى المشرف. 🎉`, 'success');
      // Update local state
      setRewards(repository.getRewards());
      setIsModalOpen(false);
      setSelectedReward(null);
      if (onRedeemSuccess) onRedeemSuccess();
    } else {
      showToast(result.message, 'error');
    }
  };

  const availableRewards = rewards.filter((r) => r.available);

  return (
    <div className="space-y-4">
      {/* Rewards Grid */}
      {availableRewards.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xs text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl mx-auto mb-3">
            🎁
          </div>
          <h4 className="text-sm font-extrabold text-slate-800 mb-1">لا توجد مكافآت معروضة حالياً</h4>
          <p className="text-xs text-slate-500 font-medium">
            سيتم إضافة مكافآت وجوائز تحفيزية مميزة قريباً بإذن الله!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {availableRewards.map((reward) => {
            const canAfford = student.currentPoints >= reward.costPoints;

          return (
            <div
              key={reward.id}
              className={`bg-white rounded-2xl p-4 border transition-all flex flex-col justify-between ${
                canAfford
                  ? 'border-slate-200 shadow-sm hover:shadow-md hover:border-teal-300'
                  : 'border-slate-200/60 opacity-80'
              }`}
            >
              <div>
                {/* Reward Top Strip */}
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-100/80 flex items-center justify-center text-3xl shadow-xs shrink-0">
                    <span>{reward.emoji}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-base font-extrabold text-teal-900 tabular-nums flex items-center gap-1">
                      {reward.costPoints}
                      <span className="text-xs font-bold text-slate-500">نقطة</span>
                    </span>
                  </div>
                </div>

                {/* Title & Description */}
                <h4 className="text-sm font-bold text-slate-900 mb-1">{reward.title}</h4>
                <p className="text-xs text-slate-500 leading-relaxed mb-3 line-clamp-2">
                  {reward.description}
                </p>

                {/* Points deficit notice if not enough points (Quantity and SAR value deleted) */}
                {!canAfford && (
                  <div className="flex items-center justify-end text-[11px] mb-3 pt-2 border-t border-slate-100">
                    <span className="text-amber-700 font-semibold flex items-center gap-1">
                      ينقصك {reward.costPoints - student.currentPoints} نقطة
                    </span>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <button
                onClick={() => handleOpenRedeem(reward)}
                disabled={!canAfford}
                className={`w-full min-h-[44px] rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-xs ${
                  canAfford
                    ? 'bg-teal-700 hover:bg-teal-800 text-white active:scale-[0.98] cursor-pointer'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                }`}
              >
                {canAfford ? (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    <span>استرداد المكافأة</span>
                  </>
                ) : (
                  <span>نقاطك غير كافية</span>
                )}
              </button>
            </div>
          );
        })}
        </div>
      )}

      {/* Confirmation Modal */}
      {selectedReward && (
        <ConfirmationModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onConfirm={handleConfirmRedeem}
          title="🎁 استرداد المكافأة"
          message={`هل أنت متأكد من استرداد ${selectedReward.title}؟\nسيتم خصم ${selectedReward.costPoints} نقطة من رصيدك الحالي (${student.currentPoints} نقطة).`}
          confirmText="تأكيد الاسترداد"
          cancelText="إلغاء"
          type="reward"
          iconEmoji={selectedReward.emoji}
        />
      )}
    </div>
  );
};
