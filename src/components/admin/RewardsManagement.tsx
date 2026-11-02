import React, { useState } from 'react';
import { Reward, User } from '../../types';
import { repository } from '../../services/storageService';
import { useToast } from '../../context/ToastContext';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { Gift, Plus, Edit2, Trash2, Power, X, Sparkles } from 'lucide-react';

interface RewardsManagementProps {
  adminUser: User;
  onUpdate: () => void;
}

export const RewardsManagement: React.FC<RewardsManagementProps> = ({ adminUser, onUpdate }) => {
  const [rewards, setRewards] = useState<Reward[]>(() => repository.getRewards());
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<Reward | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [costPoints, setCostPoints] = useState(100);
  const [emoji, setEmoji] = useState('🎁');
  const [totalQuantity, setTotalQuantity] = useState(50);

  const { showToast } = useToast();

  const handleOpenAdd = () => {
    setTitle('');
    setDescription('');
    setCostPoints(100);
    setEmoji('🎁');
    setTotalQuantity(50);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (r: Reward) => {
    setEditingReward(r);
    setTitle(r.title);
    setDescription(r.description);
    setCostPoints(r.costPoints);
    setEmoji(r.emoji);
    setTotalQuantity(r.totalQuantity);
  };

  const handleSaveReward = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('الرجاء إدخال اسم المكافأة', 'error');
      return;
    }

    if (editingReward) {
      const updated: Reward = {
        ...editingReward,
        title: title.trim(),
        description: description.trim(),
        costPoints,
        emoji,
        totalQuantity,
        remainingQuantity: Math.min(editingReward.remainingQuantity, totalQuantity),
      };
      repository.saveReward(updated, adminUser);
      showToast('تم تحديث المكافأة بنجاح', 'success');
      setEditingReward(null);
    } else {
      const newReward: Reward = {
        id: `reward_${Date.now().toString(36)}`,
        title: title.trim(),
        description: description.trim(),
        costPoints,
        emoji,
        totalQuantity,
        remainingQuantity: totalQuantity,
        available: true,
      };
      repository.saveReward(newReward, adminUser);
      showToast('تمت إضافة المكافأة الجديدة بنجاح', 'success');
      setIsAddModalOpen(false);
    }

    setRewards(repository.getRewards());
    onUpdate();
  };

  const handleToggleAvailable = (r: Reward) => {
    repository.toggleRewardAvailable(r.id, adminUser);
    showToast(r.available ? `تم تعطيل استرداد ${r.title}` : `تم تفعيل استرداد ${r.title}`, 'info');
    setRewards(repository.getRewards());
    onUpdate();
  };

  const handleConfirmDelete = () => {
    if (!deleteCandidate) return;
    repository.deleteReward(deleteCandidate.id, adminUser);
    showToast('تم حذف المكافأة', 'info');
    setDeleteCandidate(null);
    setRewards(repository.getRewards());
    onUpdate();
  };

  return (
    <div className="space-y-3">
      {/* Top action row */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-extrabold text-slate-800">كتالوج المكافآت والحوافز</h3>
        <button
          onClick={handleOpenAdd}
          className="min-h-[40px] px-3.5 rounded-xl bg-indigo-900 hover:bg-indigo-950 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة مكافأة جديدة</span>
        </button>
      </div>

      {/* Rewards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {rewards.map((reward) => (
          <div
            key={reward.id}
            className={`bg-white rounded-2xl p-4 border transition-all flex flex-col justify-between shadow-xs ${
              reward.available ? 'border-slate-200' : 'border-slate-200 bg-slate-50/70 opacity-60'
            }`}
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-2xl shrink-0">
                    <span>{reward.emoji}</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">{reward.title}</h4>
                    <span className="text-xs font-black text-teal-800 tabular-nums">
                      ⭐ {reward.costPoints} نقطة
                    </span>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    reward.available
                      ? 'bg-teal-50 text-teal-800 border border-teal-200'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {reward.available ? 'متاح للاسترداد' : 'معطل'}
                </span>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed mb-3 line-clamp-2">
                {reward.description}
              </p>

              <div className="text-[11px] text-slate-500 flex items-center justify-between pt-2 border-t border-slate-100 mb-3">
                <span>المتبقي: {reward.remainingQuantity} / {reward.totalQuantity}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => handleToggleAvailable(reward)}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg border min-h-[36px] flex items-center gap-1 ${
                  reward.available
                    ? 'border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100'
                    : 'border-teal-300 text-teal-800 bg-teal-50 hover:bg-teal-100'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                <span>{reward.available ? 'تعطيل الاسترداد' : 'تفعيل'}</span>
              </button>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleOpenEdit(reward)}
                  className="p-2 text-slate-500 hover:text-indigo-700 hover:bg-slate-100 rounded-lg min-h-[36px] min-w-[36px] flex items-center justify-center"
                  title="تعديل المكافأة"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDeleteCandidate(reward)}
                  className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg min-h-[36px] min-w-[36px] flex items-center justify-center"
                  title="حذف المكافأة"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Reward Modal */}
      {(isAddModalOpen || editingReward) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-right p-5 animate-scale-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h3 className="text-sm font-extrabold text-slate-900">
                {editingReward ? 'تعديل المكافأة' : 'إضافة مكافأة جديدة'}
              </h3>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingReward(null);
                }}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveReward} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم المكافأة</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: كوبون شاورما"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الأيقونة (Emoji)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={emoji}
                    onChange={(e) => setEmoji(e.target.value)}
                    className="w-16 px-3 py-2 text-base text-center rounded-xl border border-slate-200"
                  />
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {['🌯', '🍦', '📖', '🛍️', '⚽', '🎢', '🍔', '🎁', '⭐'].map((em) => (
                      <button
                        type="button"
                        key={em}
                        onClick={() => setEmoji(em)}
                        className="w-8 h-8 rounded-lg border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-lg"
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">السعر بالنقاط</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={costPoints}
                    onChange={(e) => setCostPoints(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الكمية الإجمالية</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={totalQuantity}
                    onChange={(e) => setTotalQuantity(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">وصف المكافأة والشروط</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="وصف موجز للمكافأة ومكان استبدالها..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full min-h-[44px] rounded-xl bg-indigo-900 hover:bg-indigo-950 text-white font-bold text-xs shadow-md"
                >
                  {editingReward ? 'حفظ تعديلات المكافأة' : 'إضافة المكافأة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteCandidate && (
        <ConfirmationModal
          isOpen={!!deleteCandidate}
          onClose={() => setDeleteCandidate(null)}
          onConfirm={handleConfirmDelete}
          title="حذف المكافأة"
          message={`هل أنت متأكد من حذف مكافأة (${deleteCandidate.title})؟`}
          confirmText="حذف"
          cancelText="إلغاء"
          type="danger"
        />
      )}
    </div>
  );
};
