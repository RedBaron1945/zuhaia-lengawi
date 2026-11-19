import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Student, StudentIdType, STUDENT_ID_TYPE_LABELS, getStudentIdFieldLabel, Circle, User } from '../../types';
import { repository, subscribeToDataChanges } from '../../services/storageService';
import { useToast } from '../../context/ToastContext';
import { PointsAdjustmentModal } from './PointsAdjustmentModal';
import { StudentPointsLogModal } from '../common/StudentPointsLogModal';
import { calculateAge } from '../../utils/dateUtils';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Power,
  Search,
  Award,
  X,
  Eye,
  CreditCard,
  GraduationCap,
  Check,
  MoreVertical,
  AlertCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  ChevronLeft,
  LifeBuoy,
  CalendarDays,
  KeyRound,
  ClipboardPaste,
  Copy,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  parseSingleStudentLine,
  isValidStudentIdFormat,
} from '../../utils/studentPasteParser';

export interface PendingTicketStudentAction {
  ticketId: string;
  type: 'add' | 'delete';
  studentName: string;
}

interface StudentsManagementProps {
  adminUser: User;
  onUpdate: () => void;
  onNavigateToAuditLog?: () => void;
  pendingTicketAction?: PendingTicketStudentAction | null;
  onTicketActionComplete?: (ticketId: string) => void;
  onCancelTicketAction?: () => void;
}

type SortKey = 'name' | 'circle' | 'points' | 'status';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 25;

const hasMissingStudentData = (s: Student): boolean => {
  const hasGuardianPhone = Boolean((s.guardianPhone || s.parentPhone || '').trim());
  const hasNationalId = Boolean((s.nationalId || '').trim());
  return !s.profileCompleted || !hasGuardianPhone || !hasNationalId;
};

const normalizeArabicText = (text: string): string =>
  text
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .toLowerCase();

export const StudentsManagement: React.FC<StudentsManagementProps> = ({
  adminUser,
  onUpdate,
  onNavigateToAuditLog,
  pendingTicketAction,
  onTicketActionComplete,
  onCancelTicketAction,
}) => {
  const [students, setStudents] = useState<Student[]>(() => repository.getStudents());
  const [circles, setCircles] = useState<Circle[]>(() => repository.getCircles());
  const [search, setSearch] = useState('');
  const [circleFilter, setCircleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [dataFilter, setDataFilter] = useState<'all' | 'incomplete' | 'complete'>('all');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [currentPage, setCurrentPage] = useState(1);

  // Active ticket execution tracking
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);

  // Overflow ⋮ dropdown menu state
  const [menuAnchor, setMenuAnchor] = useState<{
    student: Student;
    top: number;
    left: number;
  } | null>(null);
  const menuPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = subscribeToDataChanges(() => {
      setStudents(repository.getStudents());
      setCircles(repository.getCircles());
    });
    return unsub;
  }, []);

  // Modals state
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [inspectingStudent, setInspectingStudent] = useState<Student | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [pointsAdjustStudent, setPointsAdjustStudent] = useState<Student | null>(null);
  const [pointsLogStudent, setPointsLogStudent] = useState<Student | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<Student | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');

  // Add/Edit Student Form State
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);
  const [smartPasteInput, setSmartPasteInput] = useState('');
  const [formUid, setFormUid] = useState('');
  const [copiedUid, setCopiedUid] = useState(false);

  const [formName, setFormName] = useState('');
  const [formFullNameQuad, setFormFullNameQuad] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formCircleId, setFormCircleId] = useState(circles[0]?.id || 'circle_1');
  const [formIdType, setFormIdType] = useState<StudentIdType>('national_id');
  const [formNationalId, setFormNationalId] = useState('');
  const [formNationality, setFormNationality] = useState('');
  const [formBirthDate, setFormBirthDate] = useState('');
  const [formBirthPlace, setFormBirthPlace] = useState('');
  const [formSchoolName, setFormSchoolName] = useState('');
  const [formEducationalLevel, setFormEducationalLevel] = useState('');

  const parseAddress = (addr?: string) => {
    if (!addr) return { city: '', district: '', street: '' };
    const parts = addr.split(/\s*[-–—]\s*/);
    return {
      city: parts[0] || '',
      district: parts[1] || '',
      street: parts.slice(2).join(' - ') || '',
    };
  };

  const [formAddressCity, setFormAddressCity] = useState('');
  const [formAddressDistrict, setFormAddressDistrict] = useState('');
  const [formAddressStreet, setFormAddressStreet] = useState('');
  const [formGuardianName, setFormGuardianName] = useState('');
  const [formGuardianRelation, setFormGuardianRelation] = useState('');
  const [formGuardianPhone, setFormGuardianPhone] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formProfileCompleted, setFormProfileCompleted] = useState(false);

  const { showToast } = useToast();

  // Computed Age in Edit Form
  const formComputedAge = useMemo(() => calculateAge(formBirthDate), [formBirthDate]);

  const teachers = useMemo(() => repository.getTeachers(), [circles]);

  const circleInfoMap = useMemo(() => {
    const map = new Map<string, { name: string; teacherName: string }>();
    circles.forEach((c) => {
      let teacherName = (c.teacherName || '').trim();
      if (!teacherName) {
        const matched = teachers.find(
          (t) =>
            t.id === c.teacherId ||
            (Array.isArray(t.circleIds) && t.circleIds.includes(c.id))
        );
        teacherName = matched?.name?.trim() || '';
      }
      map.set(c.id, { name: c.name, teacherName });
    });
    return map;
  }, [circles, teachers]);

  const teacherFilterOptions = useMemo(() => {
    const byTeacherKey = new Map<
      string,
      { key: string; teacherName: string; circleIds: Set<string> }
    >();
    circles.forEach((c) => {
      const teacherName = (c.teacherName || '').trim() || c.name;
      const key = (c.teacherId || teacherName).trim();
      const existing = byTeacherKey.get(key);
      if (existing) {
        existing.circleIds.add(c.id);
      } else {
        byTeacherKey.set(key, {
          key,
          teacherName,
          circleIds: new Set([c.id]),
        });
      }
    });
    return Array.from(byTeacherKey.values());
  }, [circles]);

  const selectedFilterCircleIds = useMemo(() => {
    if (circleFilter === 'all') return null;
    const match = teacherFilterOptions.find((opt) => opt.key === circleFilter);
    return match ? match.circleIds : null;
  }, [circleFilter, teacherFilterOptions]);

  // Close ⋮ menu on outside click, escape, or scroll
  useEffect(() => {
    if (!menuAnchor) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (menuPopoverRef.current && !menuPopoverRef.current.contains(e.target as Node)) {
        setMenuAnchor(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuAnchor(null);
    };
    const handleScroll = () => setMenuAnchor(null);

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [menuAnchor]);

  const resetForm = useCallback((prefillName = '') => {
    const defaultCircleId = repository.getCircles()[0]?.id || 'circle_othman';
    setShowOptionalDetails(false);
    setSmartPasteInput('');
    setFormUid('');
    setCopiedUid(false);
    setFormName(prefillName);
    setFormFullNameQuad(prefillName);
    setFormEmail('');
    setFormCircleId(defaultCircleId);
    setFormIdType('national_id');
    setFormNationalId('');
    setFormNationality('');
    setFormBirthDate('');
    setFormBirthPlace('');
    setFormSchoolName('');
    setFormEducationalLevel('');
    setFormAddressCity('');
    setFormAddressDistrict('');
    setFormAddressStreet('');
    setFormGuardianName('');
    setFormGuardianRelation('');
    setFormGuardianPhone('');
    setFormPhone('');
    setFormProfileCompleted(false);
  }, []);

  // Handle incoming "تنفيذ" action from SupportTicketsManager
  useEffect(() => {
    if (!pendingTicketAction) return;
    setActiveTicketId(pendingTicketAction.ticketId);

    if (pendingTicketAction.type === 'add') {
      setEditingStudent(null);
      resetForm(pendingTicketAction.studentName);
      setIsAddModalOpen(true);
    } else if (pendingTicketAction.type === 'delete') {
      const targetNorm = normalizeArabicText(pendingTicketAction.studentName);
      setSearch(pendingTicketAction.studentName);
      setCurrentPage(1);

      const allStudents = repository.getStudents();
      const exactMatches = allStudents.filter(
        (s) =>
          normalizeArabicText(s.name) === targetNorm ||
          normalizeArabicText(s.fullNameQuad || '') === targetNorm
      );
      const partialMatches =
        exactMatches.length > 0
          ? exactMatches
          : allStudents.filter((s) => {
              const n1 = normalizeArabicText(s.name);
              const n2 = normalizeArabicText(s.fullNameQuad || '');
              return (
                (targetNorm && (n1.includes(targetNorm) || n2.includes(targetNorm))) ||
                (n1 && targetNorm.includes(n1))
              );
            });

      if (partialMatches.length === 1) {
        setDeleteConfirmInput('');
        setDeleteCandidate(partialMatches[0]);
      } else if (partialMatches.length > 1) {
        showToast('وُجد أكثر من طالب مطابق للاسم، اختر الطالب المطلوب حذفه من القائمة.', 'info');
      } else {
        setSearch('');
        showToast(
          `لم يتم العثور تلقائياً على الطالب "${pendingTicketAction.studentName}"؛ ابحث عنه يدوياً لتنفيذ الحذف.`,
          'info'
        );
      }
    }
  }, [pendingTicketAction, resetForm, showToast]);

  const handleOpenAdd = () => {
    setActiveTicketId(null);
    resetForm('');
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (s: Student) => {
    setIsAddModalOpen(false);
    setShowOptionalDetails(true);
    setCopiedUid(false);
    setEditingStudent(s);
    setFormUid(s.id || '');
    setFormName(s.name || '');
    setFormFullNameQuad(s.fullNameQuad || s.name || '');
    setFormEmail(s.email || '');
    setFormCircleId(s.circleId);
    setFormIdType(s.idType || 'national_id');
    setFormNationalId(s.nationalId || '');
    setFormNationality(s.nationality || '');
    setFormBirthDate(s.birthDate || '');
    setFormBirthPlace(s.birthPlace || '');
    setFormSchoolName(s.schoolName || '');
    setFormEducationalLevel(s.educationalLevel || '');
    const addrParts = parseAddress(s.address);
    setFormAddressCity(addrParts.city);
    setFormAddressDistrict(addrParts.district);
    setFormAddressStreet(addrParts.street);
    setFormGuardianName(s.guardianName || '');
    setFormGuardianRelation(s.guardianRelation || '');
    setFormGuardianPhone(s.guardianPhone || s.parentPhone || '');
    setFormPhone(s.phone || '');
    setFormProfileCompleted(Boolean(s.profileCompleted));
  };

  const trimmedFormUid = formUid.trim();
  const isFormUidFormatValid = !trimmedFormUid || isValidStudentIdFormat(trimmedFormUid);
  const duplicateUidStudent = useMemo(() => {
    if (editingStudent || !trimmedFormUid) return null;
    return students.find((s) => s.id === trimmedFormUid) || null;
  }, [editingStudent, trimmedFormUid, students]);

  const handleSmartPasteChange = (rawValue: string) => {
    setSmartPasteInput(rawValue);
    if (!rawValue.trim()) return;
    const parsed = parseSingleStudentLine(rawValue, circles, formCircleId);
    if (parsed.name) {
      setFormName(parsed.name);
      setFormFullNameQuad(parsed.name);
    }
    if (parsed.uid) {
      setFormUid(parsed.uid);
    }
    if (parsed.detectedCircle && parsed.circleId) {
      setFormCircleId(parsed.circleId);
    }
  };

  const handleCopyStudentUid = async (uid: string) => {
    try {
      await navigator.clipboard.writeText(uid);
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 1800);
    } catch {
      showToast('تعذر النسخ التلقائي، يمكنك تحديد المعرّف ونسخه يدوياً.', 'info');
    }
  };

  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast('الرجاء إدخال اسم الطالب', 'error');
      return;
    }

    if (!editingStudent) {
      if (!isFormUidFormatValid) {
        showToast('معرّف Firebase UID يجب أن يحتوي على أحرف إنجليزية وأرقام فقط دون مسافات.', 'error');
        return;
      }
      if (duplicateUidStudent) {
        showToast(`هذا المعرّف مسجّل مسبقاً للطالب (${duplicateUidStudent.name}).`, 'error');
        return;
      }
    }

    const compiledAddress = [
      formAddressCity.trim(),
      formAddressDistrict.trim(),
      formAddressStreet.trim(),
    ]
      .filter(Boolean)
      .join(' - ');

    if (editingStudent) {
      const updated: Student = {
        ...editingStudent,
        name: formName.trim(),
        fullNameQuad: formFullNameQuad.trim() || formName.trim(),
        email: formEmail.trim(),
        circleId: formCircleId,
        idType: formIdType,
        nationalId: formNationalId.trim().slice(0, 120),
        nationality: formNationality.trim(),
        birthDate: formBirthDate,
        birthPlace: formBirthPlace.trim(),
        age: formComputedAge ?? editingStudent.age,
        schoolName: formSchoolName.trim(),
        educationalLevel: formEducationalLevel.trim(),
        address: compiledAddress,
        guardianName: formGuardianName.trim(),
        guardianRelation: formGuardianRelation.trim(),
        guardianPhone: formGuardianPhone.trim(),
        parentPhone: formGuardianPhone.trim(),
        phone: formPhone.trim() || '',
        profileCompleted: formProfileCompleted,
      };
      const res = repository.saveStudent(updated, adminUser);
      showToast(res.message, 'success');
      setEditingStudent(null);
    } else {
      const assignedId = trimmedFormUid || `student_${Date.now().toString(36)}`;
      const newStudent: Student = {
        id: assignedId,
        name: formName.trim(),
        fullNameQuad: formFullNameQuad.trim() || formName.trim(),
        email: formEmail.trim(),
        circleId: formCircleId,
        currentPoints: 0,
        streakDays: 0,
        attendanceRate: 100,
        memorizationRating: 'ممتاز',
        active: true,
        idType: formIdType,
        nationalId: formNationalId.trim().slice(0, 120),
        nationality: formNationality.trim(),
        birthDate: formBirthDate,
        birthPlace: formBirthPlace.trim(),
        ...(formComputedAge !== null ? { age: formComputedAge } : {}),
        schoolName: formSchoolName.trim(),
        educationalLevel: formEducationalLevel.trim(),
        address: compiledAddress,
        guardianName: formGuardianName.trim(),
        guardianRelation: formGuardianRelation.trim(),
        guardianPhone: formGuardianPhone.trim(),
        parentPhone: formGuardianPhone.trim(),
        phone: formPhone.trim() || '',
        profileCompleted: formProfileCompleted,
        lastActivityDate: new Date().toISOString().split('T')[0],
        consecutiveAbsences: 0,
        daysWithoutLog: 0,
      };
      const res = repository.saveStudent(newStudent, adminUser);
      showToast(res.message, 'success');
      setIsAddModalOpen(false);

      if (activeTicketId) {
        onTicketActionComplete?.(activeTicketId);
        setActiveTicketId(null);
      }
    }

    setStudents(repository.getStudents());
    onUpdate();
  };

  const handleToggleActive = (s: Student) => {
    const res = repository.toggleStudentActive(s.id, adminUser);
    showToast(res.active ? `تم تفعيل حساب ${s.name}` : `تم تعطيل حساب ${s.name}`, 'info');
    setStudents(repository.getStudents());
    onUpdate();
  };

  const openDeleteDialog = (student: Student) => {
    setDeleteConfirmInput('');
    setDeleteCandidate(student);
  };

  const handleConfirmDelete = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteCandidate) return;
    if (deleteConfirmInput.trim() !== deleteCandidate.name.trim()) {
      showToast('يجب كتابة اسم الطالب مطابقاً لتأكيد الحذف النهائي.', 'error');
      return;
    }

    const res = repository.deleteStudent(deleteCandidate.id, adminUser);
    showToast(res.message, 'info');
    setDeleteCandidate(null);
    setDeleteConfirmInput('');
    setStudents(repository.getStudents());
    onUpdate();

    if (activeTicketId) {
      onTicketActionComplete?.(activeTicketId);
      setActiveTicketId(null);
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'points' ? 'desc' : 'asc');
    }
    setCurrentPage(1);
  };

  const openRowMenu = (e: React.MouseEvent<HTMLButtonElement>, student: Student) => {
    e.stopPropagation();
    if (menuAnchor?.student.id === student.id) {
      setMenuAnchor(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 196;
    const menuHeight = 200;
    const openUpward = rect.bottom + menuHeight > window.innerHeight - 16;
    const top = openUpward ? Math.max(12, rect.top - menuHeight - 6) : rect.bottom + 6;
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - menuWidth - 12));
    setMenuAnchor({ student, top, left });
  };

  // Reset page to 1 when filters/search change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, circleFilter, statusFilter, dataFilter]);

  const filteredAndSortedStudents = useMemo(() => {
    const q = search.trim();
    const filtered = students.filter((s) => {
      if (statusFilter === 'active' && !s.active) return false;
      if (statusFilter === 'inactive' && s.active) return false;
      if (circleFilter !== 'all') {
        if (!selectedFilterCircleIds || !selectedFilterCircleIds.has(s.circleId)) return false;
      }
      if (dataFilter === 'incomplete' && !hasMissingStudentData(s)) return false;
      if (dataFilter === 'complete' && hasMissingStudentData(s)) return false;
      if (q) {
        const matchName = s.name.includes(q);
        const matchQuad = Boolean(s.fullNameQuad && s.fullNameQuad.includes(q));
        const matchId = Boolean(s.nationalId && s.nationalId.includes(q));
        if (!matchName && !matchQuad && !matchId) return false;
      }
      return true;
    });

    if (!sortKey) return filtered;

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') {
        cmp = a.name.localeCompare(b.name, 'ar');
      } else if (sortKey === 'circle') {
        const infoA = circleInfoMap.get(a.circleId);
        const infoB = circleInfoMap.get(b.circleId);
        const primaryA = infoA?.teacherName || infoA?.name || '';
        const primaryB = infoB?.teacherName || infoB?.name || '';
        cmp =
          primaryA.localeCompare(primaryB, 'ar') ||
          (infoA?.name || '').localeCompare(infoB?.name || '', 'ar');
      } else if (sortKey === 'points') {
        cmp = a.currentPoints - b.currentPoints;
      } else if (sortKey === 'status') {
        cmp = Number(b.active) - Number(a.active);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [students, statusFilter, circleFilter, selectedFilterCircleIds, dataFilter, search, sortKey, sortDir, circleInfoMap]);

  const totalCount = filteredAndSortedStudents.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const paginatedStudents = filteredAndSortedStudents.slice(startIndex, startIndex + PAGE_SIZE);
  const rangeStart = totalCount === 0 ? 0 : startIndex + 1;
  const rangeEnd = Math.min(startIndex + PAGE_SIZE, totalCount);

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />;
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-indigo-700" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-indigo-700" />
    );
  };

  return (
    <div className="space-y-3">
      {/* Pending Support Ticket Action Banner */}
      {activeTicketId && (
        <div className="rounded-xl bg-indigo-50 border border-indigo-200 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-indigo-950 font-bold">
            <LifeBuoy className="w-4 h-4 text-indigo-700 shrink-0" />
            <span>
              وضع تنفيذ تذكرة دعم: سيتم إغلاق التذكرة تلقائياً فور إتمام الإجراء
              {pendingTicketAction?.studentName ? ` (${pendingTicketAction.studentName})` : ''}.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setActiveTicketId(null);
              onCancelTicketAction?.();
            }}
            className="text-indigo-700 hover:text-indigo-950 font-bold shrink-0 cursor-pointer"
          >
            إلغاء الربط
          </button>
        </div>
      )}

      {/* Top action & filter row */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث باسم الطالب أو الاسم الرباعي أو الهوية..."
              className="w-full pr-9 pl-3 py-2 text-xs rounded-xl bg-white border border-slate-200 focus:outline-hidden focus:border-indigo-600 min-h-[40px]"
            />
          </div>
          <select
            value={circleFilter}
            onChange={(e) => setCircleFilter(e.target.value)}
            aria-label="تصفية حسب المعلم"
            className="px-3 py-2 text-xs rounded-xl bg-white border border-slate-200 text-slate-700 min-h-[40px] cursor-pointer"
          >
            <option value="all">كل الحلقات</option>
            {teacherFilterOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.teacherName}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            aria-label="تصفية حسب الحالة"
            className="px-3 py-2 text-xs rounded-xl bg-white border border-slate-200 text-slate-700 min-h-[40px] cursor-pointer"
          >
            <option value="all">كل الحالات</option>
            <option value="active">النشطين فقط</option>
            <option value="inactive">المعطلين فقط</option>
          </select>
          <select
            value={dataFilter}
            onChange={(e) => setDataFilter(e.target.value as any)}
            aria-label="تصفية حسب اكتمال البيانات"
            className="px-3 py-2 text-xs rounded-xl bg-white border border-slate-200 text-slate-700 min-h-[40px] cursor-pointer"
          >
            <option value="all">اكتمال البيانات: الكل</option>
            <option value="incomplete">بيانات ناقصة فقط</option>
            <option value="complete">بيانات مكتملة فقط</option>
          </select>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="min-h-[40px] px-3.5 rounded-xl bg-indigo-900 hover:bg-indigo-950 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة طالب جديد</span>
        </button>
      </div>

      {/* Results Counter */}
      <div className="flex items-center justify-between gap-2 text-xs text-slate-600 px-0.5">
        <span className="font-bold tabular-nums">
          عرض {rangeStart}–{rangeEnd} من أصل {totalCount} طالب
          {totalCount !== students.length ? ` (إجمالي المسجلين: ${students.length})` : ''}
        </span>
        {(search || circleFilter !== 'all' || statusFilter !== 'all' || dataFilter !== 'all') && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setCircleFilter('all');
              setStatusFilter('all');
              setDataFilter('all');
            }}
            className="text-indigo-700 hover:text-indigo-950 font-bold cursor-pointer"
          >
            إعادة ضبط الفلاتر
          </button>
        )}
      </div>

      {/* Empty State */}
      {totalCount === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 text-slate-500 text-xs space-y-2">
          <p className="font-bold text-slate-700">لا يوجد طلاب يطابقون معايير البحث أو التصفية.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table (52px row height, sortable headers) */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-600">
                  <th className="py-2.5 px-4">
                    <button
                      type="button"
                      onClick={() => handleSort('name')}
                      className="inline-flex items-center gap-1.5 hover:text-slate-900 cursor-pointer"
                    >
                      <span>الطالب</span>
                      {renderSortIcon('name')}
                    </button>
                  </th>
                  <th className="py-2.5 px-3">
                    <button
                      type="button"
                      onClick={() => handleSort('circle')}
                      className="inline-flex items-center gap-1.5 hover:text-slate-900 cursor-pointer"
                    >
                      <span>المعلم والحلقة</span>
                      {renderSortIcon('circle')}
                    </button>
                  </th>
                  <th className="py-2.5 px-3">
                    <button
                      type="button"
                      onClick={() => handleSort('points')}
                      className="inline-flex items-center gap-1.5 hover:text-slate-900 cursor-pointer"
                    >
                      <span>النقاط</span>
                      {renderSortIcon('points')}
                    </button>
                  </th>
                  <th className="py-2.5 px-3">
                    <button
                      type="button"
                      onClick={() => handleSort('status')}
                      className="inline-flex items-center gap-1.5 hover:text-slate-900 cursor-pointer"
                    >
                      <span>الحالة</span>
                      {renderSortIcon('status')}
                    </button>
                  </th>
                  <th className="py-2.5 px-2 w-12 text-center">
                    <span className="sr-only">الإجراءات</span>
                    <MoreVertical className="w-4 h-4 text-slate-400 inline-block" aria-hidden="true" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedStudents.map((student) => {
                  const circleInfo = circleInfoMap.get(student.circleId);
                  const incomplete = hasMissingStudentData(student);
                  const isZero = student.currentPoints === 0;

                  return (
                    <tr
                      key={student.id}
                      onClick={() => setInspectingStudent(student)}
                      className={`h-[52px] hover:bg-slate-50/90 transition-colors cursor-pointer ${
                        !student.active ? 'bg-slate-50/60 opacity-75' : ''
                      }`}
                    >
                      {/* الطالب */}
                      <td className="px-4 py-1.5 max-w-[260px]">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-extrabold flex items-center justify-center text-xs shrink-0">
                            {student.name.charAt(0)}
                          </div>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-extrabold text-slate-900 truncate">
                              {student.name}
                            </span>
                            {incomplete && (
                              <span
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 shrink-0"
                                title="بيانات الطالب ناقصة"
                              >
                                <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span>بيانات ناقصة</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* المعلم والحلقة */}
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        {circleInfo?.teacherName ? (
                          <>
                            <div className="text-xs font-bold text-slate-800 leading-snug">
                              {circleInfo.teacherName}
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                              {circleInfo.name}
                            </div>
                          </>
                        ) : (
                          <span className="text-slate-600 font-medium">
                            {circleInfo?.name || '—'}
                          </span>
                        )}
                      </td>

                      {/* النقاط */}
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-black tabular-nums border ${
                            isZero
                              ? 'text-slate-500 bg-slate-100 border-slate-200'
                              : 'text-teal-800 bg-teal-50 border-teal-200'
                          }`}
                        >
                          {student.currentPoints} نقطة
                        </span>
                      </td>

                      {/* الحالة */}
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-bold ${
                            student.active ? 'text-emerald-700' : 'text-slate-500'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              student.active ? 'bg-emerald-500' : 'bg-slate-400'
                            }`}
                          />
                          <span>{student.active ? 'نشط' : 'معطل'}</span>
                        </span>
                      </td>

                      {/* ⋮ Menu */}
                      <td className="px-2 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={(e) => openRowMenu(e, student)}
                          aria-label={`إجراءات ${student.name}`}
                          aria-expanded={menuAnchor?.student.id === student.id}
                          className="w-9 h-9 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 inline-flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile 2-Line Compact Cards */}
          <div className="md:hidden space-y-2">
            {paginatedStudents.map((student) => {
              const circleInfo = circleInfoMap.get(student.circleId);
              const guardianPhone = (student.guardianPhone || student.parentPhone || '').trim();
              const incomplete = hasMissingStudentData(student);
              const isZero = student.currentPoints === 0;

              return (
                <div
                  key={student.id}
                  onClick={() => setInspectingStudent(student)}
                  className={`bg-white rounded-xl px-3.5 py-2.5 border border-slate-200 shadow-2xs cursor-pointer active:bg-slate-50 transition-colors ${
                    !student.active ? 'bg-slate-50/70 opacity-75' : ''
                  }`}
                >
                  {/* Line 1: Name (+ missing data / inactive) + Points + ⋮ */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-extrabold text-slate-900 truncate">
                        {student.name}
                      </span>
                      {incomplete && (
                        <span
                          className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-amber-700 shrink-0"
                          title="بيانات ناقصة"
                        >
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                          <span>بيانات ناقصة</span>
                        </span>
                      )}
                      {!student.active && (
                        <span className="text-[11px] font-bold text-slate-500 shrink-0">
                          · معطل
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        className={`text-xs font-black tabular-nums px-2 py-0.5 rounded-lg border ${
                          isZero
                            ? 'text-slate-500 bg-slate-100 border-slate-200'
                            : 'text-teal-800 bg-teal-50 border-teal-200'
                        }`}
                      >
                        {student.currentPoints} ن
                      </span>
                      <button
                        type="button"
                        onClick={(e) => openRowMenu(e, student)}
                        aria-label={`إجراءات ${student.name}`}
                        className="w-9 h-9 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Line 2: Teacher (primary) + Circle (smaller) (+ Guardian Phone ONLY when present) */}
                  <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 mt-0.5">
                    {circleInfo?.teacherName ? (
                      <>
                        <span className="text-[11px] font-bold text-slate-700">
                          {circleInfo.teacherName}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          · {circleInfo.name}
                        </span>
                      </>
                    ) : (
                      <span className="text-[11px] text-slate-500 font-medium">
                        {circleInfo?.name || '—'}
                      </span>
                    )}
                    {guardianPhone && (
                      <>
                        <span className="text-[11px] text-slate-300">·</span>
                        <span className="text-[11px] text-slate-500 tabular-nums font-mono" dir="ltr">
                          {guardianPhone}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination (25 rows/page) */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
                <span>السابق</span>
              </button>

              <span className="text-xs font-bold text-slate-600 tabular-nums">
                صفحة {safePage} من {totalPages}
              </span>

              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
              >
                <span>التالي</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Floating ⋮ Action Menu (Fixed Viewport Position to prevent clipping) */}
      {menuAnchor && (
        <div
          ref={menuPopoverRef}
          role="menu"
          style={{ top: menuAnchor.top, left: menuAnchor.left }}
          className="fixed z-50 w-48 bg-white rounded-2xl border border-slate-200 shadow-xl py-1.5 text-right animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              const s = menuAnchor.student;
              setMenuAnchor(null);
              handleOpenEdit(s);
            }}
            className="w-full px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5 text-indigo-600" />
            <span>تعديل</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              const s = menuAnchor.student;
              setMenuAnchor(null);
              setPointsLogStudent(s);
            }}
            className="w-full px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
          >
            <CalendarDays className="w-3.5 h-3.5 text-teal-700" />
            <span>سجل النقاط</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              const s = menuAnchor.student;
              setMenuAnchor(null);
              setPointsAdjustStudent(s);
            }}
            className="w-full px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
          >
            <Award className="w-3.5 h-3.5 text-indigo-700" />
            <span>تعديل النقاط (IT)</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              const s = menuAnchor.student;
              setMenuAnchor(null);
              handleToggleActive(s);
            }}
            className="w-full px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
          >
            <Power className={`w-3.5 h-3.5 ${menuAnchor.student.active ? 'text-amber-600' : 'text-emerald-600'}`} />
            <span>{menuAnchor.student.active ? 'تعطيل الحساب' : 'تفعيل الحساب'}</span>
          </button>

          <div className="my-1 border-t border-slate-100" />

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              const s = menuAnchor.student;
              setMenuAnchor(null);
              openDeleteDialog(s);
            }}
            className="w-full px-3.5 py-2.5 text-xs font-extrabold text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span>حذف</span>
          </button>
        </div>
      )}

      {/* Full Student Detail Card Inspection Modal for Technical Support */}
      {inspectingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-right p-5 animate-scale-up max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-900 flex items-center justify-center font-black">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    بطاقة الطالب: {inspectingStudent.name}
                  </h3>
                  <p className="text-[11px] text-slate-500 tabular-nums">
                    {(() => {
                      const info = circleInfoMap.get(inspectingStudent.circleId);
                      if (!info) return '—';
                      return info.teacherName ? `${info.teacherName} · ${info.name}` : info.name;
                    })()}{' '}
                    · الرصيد: {inspectingStudent.currentPoints} نقطة
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectingStudent(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 cursor-pointer"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 py-3 text-xs">
              {/* Profile Completion Status */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-700">حالة تعبئة البيانات:</span>
                {!hasMissingStudentData(inspectingStudent) ? (
                  <span className="text-emerald-700 font-extrabold inline-flex items-center gap-1">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>مكتملة</span>
                  </span>
                ) : (
                  <span className="text-amber-700 font-extrabold inline-flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    <span>بيانات ناقصة</span>
                  </span>
                )}
              </div>

              {/* 1. البيانات الشخصية */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <h5 className="font-black text-indigo-950 flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-indigo-700" />
                  <span>البيانات الشخصية والهوية</span>
                </h5>
                <div className="space-y-1.5">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">اسم الطالب الرباعي:</span>
                    <span className="font-bold text-slate-900">
                      {inspectingStudent.fullNameQuad || inspectingStudent.name}
                    </span>
                  </div>
                  {inspectingStudent.nationalId && (
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">
                        {getStudentIdFieldLabel(inspectingStudent.idType)}:
                      </span>
                      <span className="font-bold text-slate-900 tabular-nums">
                        {inspectingStudent.nationalId}
                      </span>
                    </div>
                  )}
                  {inspectingStudent.nationality && (
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">الجنسية:</span>
                      <span className="font-bold text-slate-900">
                        {inspectingStudent.nationality}
                      </span>
                    </div>
                  )}
                  {inspectingStudent.birthDate && (
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">تاريخ الميلاد:</span>
                      <span className="font-bold text-slate-900 tabular-nums">
                        {inspectingStudent.birthDate}
                      </span>
                    </div>
                  )}
                  {(() => {
                    const calculated = inspectingStudent.birthDate
                      ? calculateAge(inspectingStudent.birthDate)
                      : inspectingStudent.age;
                    return calculated ? (
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500 font-medium">العمر:</span>
                        <span className="font-extrabold text-teal-800 tabular-nums">
                          {calculated} سنة
                        </span>
                      </div>
                    ) : null;
                  })()}
                  {inspectingStudent.birthPlace && (
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500 font-medium">مكان الميلاد:</span>
                      <span className="font-bold text-slate-900">
                        {inspectingStudent.birthPlace}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. البيانات الدراسية والسكن */}
              {(inspectingStudent.schoolName || inspectingStudent.educationalLevel || inspectingStudent.address) && (
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <h5 className="font-black text-indigo-950 flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-indigo-700" />
                    <span>البيانات الدراسية والسكن</span>
                  </h5>
                  <div className="space-y-1.5">
                    {inspectingStudent.schoolName && (
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500 font-medium">المدرسة:</span>
                        <span className="font-bold text-slate-900">{inspectingStudent.schoolName}</span>
                      </div>
                    )}
                    {inspectingStudent.educationalLevel && (
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500 font-medium">المرحلة الدراسية:</span>
                        <span className="font-bold text-slate-900">{inspectingStudent.educationalLevel}</span>
                      </div>
                    )}
                    {inspectingStudent.address && (
                      <div className="flex justify-between py-1">
                        <span className="text-slate-500 font-medium">عنوان الطالب:</span>
                        <span className="font-bold text-slate-900">{inspectingStudent.address}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 3. بيانات ولي الأمر والتواصل */}
              {(inspectingStudent.guardianName ||
                inspectingStudent.guardianRelation ||
                inspectingStudent.guardianPhone ||
                inspectingStudent.parentPhone ||
                inspectingStudent.phone) && (
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <h5 className="font-black text-indigo-950 flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-700" />
                    <span>بيانات ولي الأمر والتواصل</span>
                  </h5>
                  <div className="space-y-1.5">
                    {inspectingStudent.guardianName && (
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500 font-medium">اسم ولي الأمر:</span>
                        <span className="font-bold text-slate-900">{inspectingStudent.guardianName}</span>
                      </div>
                    )}
                    {inspectingStudent.guardianRelation && (
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500 font-medium">صلة القرابة:</span>
                        <span className="font-bold text-slate-900">{inspectingStudent.guardianRelation}</span>
                      </div>
                    )}
                    {(inspectingStudent.guardianPhone || inspectingStudent.parentPhone) && (
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500 font-medium">جوال ولي الأمر:</span>
                        <span className="font-extrabold text-teal-900 tabular-nums" dir="ltr">
                          {inspectingStudent.guardianPhone || inspectingStudent.parentPhone}
                        </span>
                      </div>
                    )}
                    {inspectingStudent.phone && (
                      <div className="flex justify-between py-1">
                        <span className="text-slate-500 font-medium">جوال الطالب:</span>
                        <span className="font-bold text-slate-900 tabular-nums" dir="ltr">
                          {inspectingStudent.phone}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0 flex-wrap">
              <button
                type="button"
                onClick={() => setInspectingStudent(null)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
              >
                إغلاق
              </button>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setPointsLogStudent(inspectingStudent)}
                  className="px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer shadow-2xs transition-colors"
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span>سجل النقاط</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const s = inspectingStudent;
                    setInspectingStudent(null);
                    setPointsAdjustStudent(s);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-800 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>تعديل النقاط (IT)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const s = inspectingStudent;
                    setInspectingStudent(null);
                    handleOpenEdit(s);
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-900 hover:bg-indigo-950 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>تعديل البيانات</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Student Modal for Technical Support */}
      {(isAddModalOpen || editingStudent) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div
            className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-right p-4 sm:p-5 animate-scale-up max-h-[92vh] flex flex-col"
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3 shrink-0">
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-black text-slate-900">
                  {editingStudent ? 'تعديل وتصحيح بيانات الطالب' : 'إضافة طالب جديد'}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                  {editingStudent
                    ? editingStudent.name
                    : activeTicketId
                    ? 'مرتبط بتذكرة دعم · ستُغلق التذكرة تلقائياً بعد الحفظ'
                    : 'أضف الطالب بمعرّف UID لربط حسابه بالحلقة والدخول مباشرة'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingStudent(null);
                }}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer shrink-0"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="space-y-3 overflow-y-auto flex-1 pr-0.5 pl-0.5">
                {/* Smart Paste Bar (Add mode only) */}
                {!editingStudent && (
                  <div className="p-3 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 space-y-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-extrabold text-indigo-950">
                      <ClipboardPaste className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
                      <span>لصق سريع للتعبئة التلقائية (اختياري)</span>
                    </label>
                    <input
                      type="text"
                      value={smartPasteInput}
                      onChange={(e) => handleSmartPasteChange(e.target.value)}
                      placeholder="الصق هنا: اسم الطالب + الحلقة + UID ليتم تعبئة الحقول تلقائياً"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-indigo-200 bg-white focus:outline-hidden focus:border-indigo-700 min-h-[40px]"
                    />
                  </div>
                )}

                {/* Edit Mode: Read-only UID Row with Copy */}
                {editingStudent && (
                  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <div className="min-w-0 flex items-center gap-2">
                      <KeyRound className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="text-slate-500 font-bold shrink-0">UID:</span>
                      <span className="font-mono text-[11px] font-bold text-slate-800 truncate" dir="ltr">
                        {editingStudent.id}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyStudentUid(editingStudent.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-[11px] font-bold text-slate-700 cursor-pointer shrink-0"
                    >
                      {copiedUid ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedUid ? 'تم النسخ' : 'نسخ'}</span>
                    </button>
                  </div>
                )}

                {/* Essential Core Fields (Name, Circle, UID) */}
                <div className="space-y-2.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      اسم الطالب <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="مثال: عبدالمحسن فلاته"
                      className="w-full px-3 py-2.5 text-xs font-bold rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-indigo-700 min-h-[42px]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      الحلقة التابع لها <span className="text-rose-600">*</span>
                    </label>
                    <select
                      value={formCircleId}
                      onChange={(e) => setFormCircleId(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs font-bold rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-indigo-700 min-h-[42px]"
                    >
                      {circles.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} · {c.teacherName}
                        </option>
                      ))}
                    </select>
                  </div>

                  {!editingStudent && (
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800 mb-1">
                        <KeyRound className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
                        <span>معرّف Firebase (UID)</span>
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={formUid}
                        onChange={(e) => setFormUid(e.target.value)}
                        placeholder="aov19OEotRWlPsLXrQQh5yC97zC3"
                        className={`w-full px-3 py-2.5 text-xs font-mono rounded-xl border bg-white focus:outline-hidden min-h-[42px] text-left ${
                          !isFormUidFormatValid || duplicateUidStudent
                            ? 'border-rose-400 focus:border-rose-600'
                            : 'border-slate-200 focus:border-indigo-700'
                        }`}
                      />
                      {!isFormUidFormatValid ? (
                        <p className="text-[11px] font-bold text-rose-600 mt-1">
                          صيغة الـ UID غير صالحة: استخدم أحرفاً إنجليزية وأرقاماً فقط دون مسافات.
                        </p>
                      ) : duplicateUidStudent ? (
                        <p className="text-[11px] font-bold text-rose-600 mt-1">
                          هذا المعرّف مسجّل مسبقاً للطالب: {duplicateUidStudent.name}
                        </p>
                      ) : trimmedFormUid ? (
                        <p className="text-[11px] font-medium text-emerald-700 mt-1">
                          سيُربط الطالب بحلقته وحساب دخوله في قاعدة البيانات مباشرة بهذا الـ UID.
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-500 mt-1">
                          اختياري: الصق الـ UID لتمكين الطالب من تسجيل الدخول، أو اتركه فارغاً لإنشاء معرّف داخلي.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Collapsible Toggle for Optional Extended Profile Fields (Collapsed by default in Add mode) */}
                {!editingStudent && (
                  <button
                    type="button"
                    onClick={() => setShowOptionalDetails((prev) => !prev)}
                    className="w-full py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <span>بيانات تفصيلية اختيارية (الهوية، المدرسة، ولي الأمر)</span>
                    {showOptionalDetails ? (
                      <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                  </button>
                )}

                {(editingStudent || showOptionalDetails) && (
                  <div className="space-y-3 pt-1">
                    {/* القسم 1: البيانات الشخصية والهوية */}
                    <div className="p-3 rounded-2xl bg-slate-50/90 border border-slate-200/90 space-y-2.5">
                      <h4 className="text-xs font-black text-indigo-950 flex items-center gap-1 border-b border-slate-200/80 pb-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-indigo-700" />
                        <span>البيانات الشخصية والهوية</span>
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">اسم الطالب الرباعي</label>
                          <input
                            type="text"
                            value={formFullNameQuad}
                            onChange={(e) => setFormFullNameQuad(e.target.value)}
                            placeholder="مثال: عبدالمحسن ... فلاته"
                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">البريد الإلكتروني</label>
                          <input
                            type="email"
                            dir="ltr"
                            value={formEmail}
                            onChange={(e) => setFormEmail(e.target.value)}
                            placeholder="student@example.com"
                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-left"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">نوع الوثيقة</label>
                          <div className="grid grid-cols-3 gap-1.5">
                            {(['national_id', 'visit_visa', 'passport'] as StudentIdType[]).map((typeOption) => (
                              <button
                                key={typeOption}
                                type="button"
                                onClick={() => {
                                  setFormIdType(typeOption);
                                  if (typeOption === 'national_id') {
                                    setFormNationalId((prev) =>
                                      prev
                                        .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
                                        .replace(/\D/g, '')
                                        .slice(0, 10)
                                    );
                                  }
                                }}
                                className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer ${
                                  formIdType === typeOption
                                    ? 'bg-indigo-900 text-white border-indigo-900'
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                {STUDENT_ID_TYPE_LABELS[typeOption]}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              {getStudentIdFieldLabel(formIdType)}
                            </label>
                            {formIdType === 'national_id' ? (
                              <input
                                type="tel"
                                dir="rtl"
                                inputMode="numeric"
                                maxLength={10}
                                value={formNationalId}
                                onChange={(e) =>
                                  setFormNationalId(
                                    e.target.value
                                      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
                                      .replace(/\D/g, '')
                                      .slice(0, 10)
                                  )
                                }
                                placeholder="10 أرقام فقط"
                                className="w-full px-3 py-2 text-xs text-right rounded-xl border border-slate-200 bg-white font-bold tabular-nums"
                              />
                            ) : (
                              <input
                                type="text"
                                value={formNationalId}
                                onChange={(e) => setFormNationalId(e.target.value)}
                                placeholder={
                                  formIdType === 'visit_visa'
                                    ? 'أدخل رقم تأشيرة الزيارة'
                                    : 'أدخل رقم جواز السفر'
                                }
                                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-bold tabular-nums"
                              />
                            )}
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">الجنسية</label>
                            <input
                              type="text"
                              value={formNationality}
                              onChange={(e) => setFormNationality(e.target.value)}
                              placeholder="سعودي"
                              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ الميلاد</label>
                          <input
                            type="date"
                            value={formBirthDate}
                            onChange={(e) => setFormBirthDate(e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">العمر المحسوب</label>
                          <div className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-teal-50 text-teal-900 font-extrabold min-h-[38px] flex items-center justify-center tabular-nums">
                            {formComputedAge !== null ? `${formComputedAge} سنة` : 'تلقائي'}
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">مكان الميلاد</label>
                        <input
                          type="text"
                          value={formBirthPlace}
                          onChange={(e) => setFormBirthPlace(e.target.value)}
                          placeholder="مثال: مكة المكرمة، جدة..."
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                        />
                      </div>
                    </div>

                    {/* القسم 2: البيانات الدراسية والسكن */}
                    <div className="p-3 rounded-2xl bg-slate-50/90 border border-slate-200/90 space-y-2.5">
                      <h4 className="text-xs font-black text-indigo-950 flex items-center gap-1 border-b border-slate-200/80 pb-1.5">
                        <GraduationCap className="w-3.5 h-3.5 text-indigo-700" />
                        <span>البيانات الدراسية والسكن</span>
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">المرحلة الدراسية</label>
                          <select
                            value={formEducationalLevel}
                            onChange={(e) => setFormEducationalLevel(e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                          >
                            <option value="">— اختر المرحلة الدراسية —</option>
                            <option value="ابتدائي">ابتدائي</option>
                            <option value="متوسط">متوسط</option>
                            <option value="ثانوي">ثانوي</option>
                            <option value="جامعي">جامعي</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">المدرسة التي يدرس بها</label>
                          <input
                            type="text"
                            value={formSchoolName}
                            onChange={(e) => setFormSchoolName(e.target.value)}
                            placeholder="اسم المدرسة"
                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">عنوان الطالب</label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-100/70 p-2 rounded-xl border border-slate-200">
                          <div>
                            <span className="block text-[10px] font-bold text-slate-500 mb-0.5">1. المدينة</span>
                            <input
                              type="text"
                              value={formAddressCity}
                              onChange={(e) => setFormAddressCity(e.target.value)}
                              placeholder="مثال: جدة"
                              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                            />
                          </div>
                          <div>
                            <span className="block text-[10px] font-bold text-slate-500 mb-0.5">2. الحي</span>
                            <input
                              type="text"
                              value={formAddressDistrict}
                              onChange={(e) => setFormAddressDistrict(e.target.value)}
                              placeholder="مثال: حي الروضة"
                              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                            />
                          </div>
                          <div>
                            <span className="block text-[10px] font-bold text-slate-500 mb-0.5">3. الشارع</span>
                            <input
                              type="text"
                              value={formAddressStreet}
                              onChange={(e) => setFormAddressStreet(e.target.value)}
                              placeholder="مثال: شارع صاري"
                              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* القسم 3: بيانات ولي الأمر والتواصل */}
                    <div className="p-3 rounded-2xl bg-slate-50/90 border border-slate-200/90 space-y-2.5">
                      <h4 className="text-xs font-black text-indigo-950 flex items-center gap-1 border-b border-slate-200/80 pb-1.5">
                        <Users className="w-3.5 h-3.5 text-indigo-700" />
                        <span>بيانات ولي الأمر والتواصل</span>
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">اسم ولي الأمر</label>
                          <input
                            type="text"
                            value={formGuardianName}
                            onChange={(e) => setFormGuardianName(e.target.value)}
                            placeholder="اسم ولي الأمر"
                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">صلة القرابة</label>
                          <input
                            type="text"
                            value={formGuardianRelation}
                            onChange={(e) => setFormGuardianRelation(e.target.value)}
                            placeholder="أب / أم / أخ..."
                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">هاتف ولي الأمر للتواصل</label>
                          <input
                            type="tel"
                            value={formGuardianPhone}
                            onChange={(e) => setFormGuardianPhone(e.target.value)}
                            placeholder="05xxxxxxxx"
                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-bold tabular-nums"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">جوال الطالب (اختياري)</label>
                          <input
                            type="tel"
                            value={formPhone}
                            onChange={(e) => setFormPhone(e.target.value)}
                            placeholder="05xxxxxxxx"
                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white tabular-nums"
                          />
                        </div>
                      </div>

                      {/* اكتمال الملف الرسمي */}
                      <div className="pt-1">
                        <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formProfileCompleted}
                            onChange={(e) => setFormProfileCompleted(e.target.checked)}
                            className="w-4 h-4 text-indigo-600 rounded-sm"
                          />
                          <span className="text-xs font-bold text-slate-800">
                            اعتماد اكتمال البيانات الرسمية للطالب
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddModalOpen(false);
                      setEditingStudent(null);
                    }}
                    className="px-4 py-2.5 min-h-[42px] text-xs font-bold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={!editingStudent && (!isFormUidFormatValid || Boolean(duplicateUidStudent))}
                    className="px-5 py-2.5 min-h-[42px] rounded-xl bg-indigo-900 hover:bg-indigo-950 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs shadow-sm cursor-pointer disabled:cursor-not-allowed"
                  >
                    {editingStudent ? 'حفظ التعديلات' : 'إضافة الطالب'}
                  </button>
                </div>
              </form>
          </div>
        </div>
      )}

      {/* Points Adjustment Modal */}
      {pointsAdjustStudent && (
        <PointsAdjustmentModal
          isOpen={!!pointsAdjustStudent}
          onClose={() => setPointsAdjustStudent(null)}
          student={pointsAdjustStudent}
          adminUser={adminUser}
          onSuccess={() => {
            setStudents(repository.getStudents());
            onUpdate();
          }}
          onNavigateToAuditLog={onNavigateToAuditLog}
        />
      )}

      {/* Daily Student Points Log Modal (Day Cards) */}
      <StudentPointsLogModal
        student={pointsLogStudent}
        onClose={() => setPointsLogStudent(null)}
      />

      {/* Typed-Name Delete Confirmation Modal */}
      {deleteCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div
            className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-scale-up text-right"
            role="dialog"
            aria-modal="true"
          >
            <div className="h-2 w-full bg-gradient-to-r from-rose-500 to-red-600" />
            <form onSubmit={handleConfirmDelete} className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">تأكيد حذف الطالب نهائياً</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    إجراء غير قابل للتراجع ويُسجَّل في سجل التدقيق
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200 text-xs text-rose-950 space-y-1">
                <p className="font-bold">للمتابعة، اكتب اسم الطالب التالي كما هو تماماً:</p>
                <p className="font-black text-sm select-all text-rose-700">{deleteCandidate.name}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اكتب اسم الطالب للتأكيد:
                </label>
                <input
                  type="text"
                  value={deleteConfirmInput}
                  onChange={(e) => setDeleteConfirmInput(e.target.value)}
                  placeholder={deleteCandidate.name}
                  className="w-full px-3 py-2.5 text-xs font-bold rounded-xl border border-slate-300 focus:outline-hidden focus:border-rose-600 bg-white"
                />
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="submit"
                  disabled={deleteConfirmInput.trim() !== deleteCandidate.name.trim()}
                  className="w-full min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  حذف الطالب نهائياً
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteCandidate(null);
                    setDeleteConfirmInput('');
                  }}
                  className="w-full min-h-[42px] rounded-xl font-bold text-xs text-slate-600 hover:bg-slate-100 border border-slate-200 cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
