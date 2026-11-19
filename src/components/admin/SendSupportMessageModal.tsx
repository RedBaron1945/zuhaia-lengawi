import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Send,
  Users,
  GraduationCap,
  BookOpen,
  Shield,
  UserCheck,
  Search,
  Check,
  Megaphone,
} from 'lucide-react';
import { Role, SupportMessageAudience } from '../../types';
import { SUPERVISOR_UID, normalizeCircleId } from '../../data/mockData';
import { repository } from '../../services/storageService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

interface SendSupportMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSent?: () => void;
}

interface SelectableUser {
  id: string;
  name: string;
  role: Exclude<Role, 'admin'>;
  roleLabel: string;
  subtitle?: string;
  circleId?: string;
  searchText: string;
}

const MAX_CUSTOM_RECIPIENTS = 300;

export const SendSupportMessageModal: React.FC<SendSupportMessageModalProps> = ({
  isOpen,
  onClose,
  onSent,
}) => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [audienceType, setAudienceType] = useState<SupportMessageAudience>('all');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'teacher' | 'student' | 'supervisor'>('all');
  const [circleFilter, setCircleFilter] = useState<string>('all');
  const [submitting, setSubmitting] = useState(false);

  // Reset form on open
  useEffect(() => {
    if (!isOpen) return;
    setAudienceType('all');
    setTitle('');
    setBody('');
    setSelectedUserIds(new Set());
    setSearchQuery('');
    setRoleFilter('all');
    setCircleFilter('all');
    setSubmitting(false);
  }, [isOpen]);

  // Lock background scroll & support Escape key
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, submitting, onClose]);

  const circles = isOpen ? repository.getCircles() : [];
  const teachers = isOpen ? repository.getTeachers().filter((t) => t.active !== false) : [];
  const students = isOpen ? repository.getStudents().filter((s) => s.active !== false) : [];

  const circleMap = useMemo(() => {
    const map = new Map<string, { name: string; teacherName: string }>();
    circles.forEach((c) => {
      map.set(c.id, { name: c.name, teacherName: c.teacherName });
    });
    return map;
  }, [circles]);

  const selectableUsers = useMemo<SelectableUser[]>(() => {
    if (!isOpen) return [];
    const list: SelectableUser[] = [];

    // 1. Supervisor
    list.push({
      id: SUPERVISOR_UID,
      name: 'مدير المجمع',
      role: 'supervisor',
      roleLabel: 'مدير المجمع',
      subtitle: 'الإشراف العام',
      searchText: 'مدير المجمع المشرف العام',
    });

    // 2. Teachers
    teachers.forEach((t) => {
      const circleNames = (t.circleIds || [])
        .map((cid) => circleMap.get(normalizeCircleId(cid))?.name)
        .filter(Boolean)
        .join(' · ');
      list.push({
        id: t.id,
        name: t.name,
        role: 'teacher',
        roleLabel: 'معلم',
        subtitle: circleNames || undefined,
        circleId: t.circleIds?.[0] ? normalizeCircleId(t.circleIds[0]) : undefined,
        searchText: `${t.name} معلم ${circleNames}`.toLowerCase(),
      });
    });

    // 3. Students
    students.forEach((s) => {
      const cid = normalizeCircleId(s.circleId);
      const circleInfo = circleMap.get(cid);
      const subtitle = circleInfo
        ? `${circleInfo.teacherName} · ${circleInfo.name}`
        : undefined;
      list.push({
        id: s.id,
        name: s.name,
        role: 'student',
        roleLabel: 'طالب',
        subtitle,
        circleId: cid,
        searchText: `${s.name} طالب ${circleInfo?.teacherName || ''} ${circleInfo?.name || ''}`.toLowerCase(),
      });
    });

    return list;
  }, [isOpen, teachers, students, circleMap]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return selectableUsers.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (circleFilter !== 'all') {
        if (u.role === 'supervisor') return false;
        if (u.role === 'teacher') {
          const t = teachers.find((item) => item.id === u.id);
          const teacherCircles = (t?.circleIds || []).map((c) => normalizeCircleId(c));
          if (!teacherCircles.includes(circleFilter)) return false;
        } else if (u.circleId !== circleFilter) {
          return false;
        }
      }
      if (q && !u.searchText.includes(q)) return false;
      return true;
    });
  }, [selectableUsers, roleFilter, circleFilter, searchQuery, teachers]);

  const totalAllUsersCount = 1 + teachers.length + students.length;

  const selectedUsersList = useMemo(() => {
    return selectableUsers.filter((u) => selectedUserIds.has(u.id));
  }, [selectableUsers, selectedUserIds]);

  const resolvedRecipientCount = useMemo(() => {
    switch (audienceType) {
      case 'all':
        return totalAllUsersCount;
      case 'teachers':
        return teachers.length;
      case 'students':
        return students.length;
      case 'supervisors':
        return 1;
      case 'custom':
        return selectedUserIds.size;
    }
  }, [audienceType, totalAllUsersCount, teachers.length, students.length, selectedUserIds.size]);

  const deliverySummaryText = useMemo(() => {
    switch (audienceType) {
      case 'all':
        return `جميع المستخدمين (${totalAllUsersCount})`;
      case 'teachers':
        return `جميع المعلمين (${teachers.length})`;
      case 'students':
        return `جميع الطلاب (${students.length})`;
      case 'supervisors':
        return 'مدير المجمع (1)';
      case 'custom':
        if (selectedUserIds.size === 0) return 'لم يتم تحديد أي مستلم بعد';
        if (selectedUsersList.length <= 3) {
          return selectedUsersList.map((u) => u.name).join('، ');
        }
        return `${selectedUsersList
          .slice(0, 2)
          .map((u) => u.name)
          .join('، ')} و+${selectedUsersList.length - 2} آخرين`;
    }
  }, [audienceType, totalAllUsersCount, teachers.length, students.length, selectedUserIds.size, selectedUsersList]);

  if (!isOpen || typeof document === 'undefined') return null;

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        if (next.size >= MAX_CUSTOM_RECIPIENTS) {
          showToast(`الحد الأقصى للتحديد المخصص هو ${MAX_CUSTOM_RECIPIENTS} مستلم`, 'error');
          return prev;
        }
        next.add(userId);
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      for (const u of filteredUsers) {
        if (next.size >= MAX_CUSTOM_RECIPIENTS) break;
        next.add(u.id);
      }
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedUserIds(new Set());
  };

  const canSubmit =
    !submitting &&
    body.trim().length > 0 &&
    (audienceType !== 'custom' || selectedUserIds.size > 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const targetUserIds =
        audienceType === 'custom' ? Array.from(selectedUserIds) : undefined;
      const recipientNames =
        audienceType === 'custom' ? selectedUsersList.map((u) => u.name) : undefined;

      const res = repository.sendSupportMessage({
        title: title.trim() || undefined,
        body: body.trim(),
        audienceType,
        targetUserIds,
        recipientNames,
        recipientCount: resolvedRecipientCount,
        senderId: currentUser?.id || 'admin',
        senderName: currentUser?.name ? `الدعم الفني (${currentUser.name})` : 'الدعم الفني',
      });

      if (res.success) {
        showToast(res.message, 'success');
        onSent?.();
        onClose();
      } else {
        showToast(res.message, 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const audienceOptions: Array<{
    key: SupportMessageAudience;
    label: string;
    count: number;
    icon: React.ReactNode;
  }> = [
    {
      key: 'all',
      label: 'الجميع',
      count: totalAllUsersCount,
      icon: <Users className="w-4 h-4" />,
    },
    {
      key: 'teachers',
      label: 'المعلمون فقط',
      count: teachers.length,
      icon: <BookOpen className="w-4 h-4" />,
    },
    {
      key: 'students',
      label: 'الطلاب فقط',
      count: students.length,
      icon: <GraduationCap className="w-4 h-4" />,
    },
    {
      key: 'supervisors',
      label: 'مدير المجمع',
      count: 1,
      icon: <Shield className="w-4 h-4" />,
    },
    {
      key: 'custom',
      label: 'أسماء محددة',
      count: selectedUserIds.size,
      icon: <UserCheck className="w-4 h-4" />,
    },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in"
      onClick={() => {
        if (!submitting) onClose();
      }}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-right flex flex-col max-h-[90dvh]"
        role="dialog"
        aria-modal="true"
        aria-label="إرسال رسالة من الدعم الفني"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200/80 bg-slate-50/80 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 flex items-center justify-center shrink-0">
              <Megaphone className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-slate-900 truncate">
                إرسال رسالة إلى صندوق الوارد
              </h3>
              <p className="text-[11px] text-slate-500 font-medium truncate">
                اختر الفئة المستهدفة أو حدّد أسماء معينة لتصلهم الرسالة فوراً
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="w-9 h-9 min-w-[38px] min-h-[38px] rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="إغلاق"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
            {/* Audience Mode Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-extrabold text-slate-800">
                المستلمون
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {audienceOptions.map((opt) => {
                  const active = audienceType === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setAudienceType(opt.key)}
                      className={`p-2.5 rounded-xl border text-right transition-all flex flex-col gap-1 cursor-pointer ${
                        active
                          ? 'bg-indigo-900 text-white border-indigo-900 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className={active ? 'text-indigo-200' : 'text-indigo-700'}>
                          {opt.icon}
                        </span>
                        <span
                          className={`text-[11px] font-black tabular-nums ${
                            active ? 'text-indigo-200' : 'text-slate-400'
                          }`}
                        >
                          {opt.count}
                        </span>
                      </div>
                      <span className="text-xs font-extrabold truncate">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Recipient Picker */}
            {audienceType === 'custom' && (
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                {/* Role filter tabs + Circle dropdown */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div
                    role="group"
                    aria-label="تصفية حسب الدور"
                    className="inline-flex items-center rounded-xl border border-slate-200 bg-white p-0.5 text-[11px] font-bold shrink-0"
                  >
                    {(
                      [
                        { key: 'all', label: 'الكل' },
                        { key: 'teacher', label: 'المعلمون' },
                        { key: 'student', label: 'الطلاب' },
                        { key: 'supervisor', label: 'المدير' },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => {
                          setRoleFilter(tab.key);
                          if (tab.key === 'supervisor') setCircleFilter('all');
                        }}
                        className={`px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                          roleFilter === tab.key
                            ? 'bg-indigo-900 text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {roleFilter !== 'supervisor' && (
                    <select
                      value={circleFilter}
                      onChange={(e) => setCircleFilter(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 focus:outline-hidden focus:border-indigo-600 min-h-[36px]"
                    >
                      <option value="all">كل الحلقات</option>
                      {circles.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.teacherName} — {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Search + quick select buttons */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="ابحث بالاسم أو المعلم أو الحلقة..."
                      className="w-full pr-8 pl-3 py-2 text-xs rounded-xl bg-white border border-slate-200 focus:outline-hidden focus:border-indigo-600 min-h-[36px]"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleSelectAllFiltered}
                      disabled={filteredUsers.length === 0}
                      className="px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-40 text-indigo-900 text-[11px] font-extrabold transition-colors cursor-pointer whitespace-nowrap"
                    >
                      تحديد الظاهر ({filteredUsers.length})
                    </button>
                    {selectedUserIds.size > 0 && (
                      <button
                        type="button"
                        onClick={handleClearSelection}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap"
                      >
                        مسح الكل
                      </button>
                    )}
                  </div>
                </div>

                {/* Selected names preview */}
                {selectedUsersList.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-[11px] font-extrabold text-indigo-900">
                      المحددون ({selectedUsersList.length}):
                    </span>
                    {selectedUsersList.slice(0, 8).map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => toggleUserSelection(u.id)}
                        title="إزالة من المستلمين"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-100/90 hover:bg-rose-100 text-indigo-950 hover:text-rose-800 text-[11px] font-bold transition-colors cursor-pointer"
                      >
                        <span>{u.name}</span>
                        <X className="w-3 h-3" />
                      </button>
                    ))}
                    {selectedUsersList.length > 8 && (
                      <span className="text-[11px] font-bold text-slate-500">
                        +{selectedUsersList.length - 8} آخرين
                      </span>
                    )}
                  </div>
                )}

                {/* Scrollable Checklist */}
                <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
                  {filteredUsers.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      لا يوجد مستخدمون مطابقون للبحث
                    </div>
                  ) : (
                    filteredUsers.map((u) => {
                      const isSelected = selectedUserIds.has(u.id);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => toggleUserSelection(u.id)}
                          className={`w-full px-3 py-2 text-right flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                            isSelected ? 'bg-indigo-50/75' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`w-4.5 h-4.5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                                isSelected
                                  ? 'bg-indigo-900 border-indigo-900 text-white'
                                  : 'bg-white border-slate-300'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3" />}
                            </span>
                            <div className="min-w-0">
                              <div className="text-xs font-extrabold text-slate-900 truncate">
                                {u.name}
                              </div>
                              {u.subtitle && (
                                <div className="text-[11px] text-slate-500 truncate">
                                  {u.subtitle}
                                </div>
                              )}
                            </div>
                          </div>
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md shrink-0 ${
                              u.role === 'supervisor'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : u.role === 'teacher'
                                ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {u.roleLabel}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Optional Subject / Title */}
            <div className="space-y-1.5">
              <label
                htmlFor="support-msg-title"
                className="block text-xs font-extrabold text-slate-800"
              >
                عنوان الرسالة{' '}
                <span className="text-[11px] font-medium text-slate-400">(اختياري)</span>
              </label>
              <input
                id="support-msg-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 200))}
                placeholder="مثال: تنبيه هام بخصوص رصد الحضور أو تحديثات النظام..."
                className="w-full px-3.5 py-2.5 text-base sm:text-xs rounded-xl bg-slate-50 focus:bg-white border border-slate-200 focus:outline-hidden focus:border-indigo-600 text-slate-900 placeholder:text-slate-400"
              />
            </div>

            {/* Message Body */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="support-msg-body"
                  className="block text-xs font-extrabold text-slate-800"
                >
                  نص الرسالة <span className="text-rose-600">*</span>
                </label>
                <span className="text-[11px] text-slate-400 tabular-nums">
                  {body.length} / 3000
                </span>
              </div>
              <textarea
                id="support-msg-body"
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, 3000))}
                placeholder="اكتب رسالتك هنا لتصل مباشرة إلى صندوق الوارد لدى المستلمين المحددين..."
                rows={4}
                required
                className="w-full p-3.5 text-base sm:text-xs rounded-xl bg-slate-50 focus:bg-white border border-slate-200 focus:outline-hidden focus:border-indigo-600 text-slate-900 placeholder:text-slate-400 leading-relaxed resize-none font-[inherit]"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 sm:px-5 py-3.5 border-t border-slate-200/80 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
            <div className="text-[11px] text-slate-600 font-semibold min-w-0">
              <span className="text-slate-400">ستصل في صندوق الوارد إلى: </span>
              <span className="font-extrabold text-slate-900">{deliverySummaryText}</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-indigo-900 hover:bg-indigo-950 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{submitting ? 'جاري الإرسال...' : 'إرسال الرسالة'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
