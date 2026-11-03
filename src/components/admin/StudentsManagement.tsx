import React, { useState, useMemo } from 'react';
import { Student, Circle, User } from '../../types';
import { repository } from '../../services/storageService';
import { useToast } from '../../context/ToastContext';
import { PointsAdjustmentModal } from './PointsAdjustmentModal';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { calculateAge } from '../../utils/dateUtils';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Power,
  Search,
  Award,
  CheckCircle,
  X,
  Eye,
  CreditCard,
  GraduationCap,
  MapPin,
  Calendar,
  Phone,
  ShieldCheck,
  Check,
  AlertCircle,
  PhoneCall,
} from 'lucide-react';

interface StudentsManagementProps {
  adminUser: User;
  onUpdate: () => void;
}

export const StudentsManagement: React.FC<StudentsManagementProps> = ({ adminUser, onUpdate }) => {
  const [students, setStudents] = useState<Student[]>(() => repository.getStudents());
  const [circles, setCircles] = useState<Circle[]>(() => repository.getCircles());
  const [search, setSearch] = useState('');
  const [circleFilter, setCircleFilter] = useState('all');

  // Modals state
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [inspectingStudent, setInspectingStudent] = useState<Student | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [pointsAdjustStudent, setPointsAdjustStudent] = useState<Student | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<Student | null>(null);

  // Form State for all 12 fields
  const [formName, setFormName] = useState('');
  const [formFullNameQuad, setFormFullNameQuad] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formCircleId, setFormCircleId] = useState(circles[0]?.id || 'circle_1');
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

  const handleOpenAdd = () => {
    setFormName('');
    setFormFullNameQuad('');
    setFormEmail('');
    setFormCircleId(circles[0]?.id || 'circle_1');
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
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (s: Student) => {
    setEditingStudent(s);
    setFormName(s.name || '');
    setFormFullNameQuad(s.fullNameQuad || s.name || '');
    setFormEmail(s.email || '');
    setFormCircleId(s.circleId);
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

  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast('الرجاء إدخال اسم الطالب', 'error');
      return;
    }

    const compiledAddress = [
      formAddressCity.trim(),
      formAddressDistrict.trim(),
      formAddressStreet.trim(),
    ]
      .filter(Boolean)
      .join(' - ');

    if (editingStudent) {
      // Edit
      const updated: Student = {
        ...editingStudent,
        name: formName.trim(),
        fullNameQuad: formFullNameQuad.trim() || formName.trim(),
        email: formEmail.trim(),
        circleId: formCircleId,
        nationalId: formNationalId.trim(),
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
      // Add
      const newStudent: Student = {
        id: `student_${Date.now().toString(36)}`,
        name: formName.trim(),
        fullNameQuad: formFullNameQuad.trim() || formName.trim(),
        email: formEmail.trim() || `student_${Date.now().toString(36).slice(-4)}@zuhaia.edu`,
        circleId: formCircleId,
        currentPoints: 0,
        streakDays: 0,
        attendanceRate: 100,
        memorizationRating: 'جيد',
        active: true,
        nationalId: formNationalId.trim(),
        nationality: formNationality.trim(),
        birthDate: formBirthDate,
        birthPlace: formBirthPlace.trim(),
        age: formComputedAge ?? 0,
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

  const handleConfirmDelete = () => {
    if (!deleteCandidate) return;
    const res = repository.deleteStudent(deleteCandidate.id, adminUser);
    showToast(res.message, 'info');
    setDeleteCandidate(null);
    setStudents(repository.getStudents());
    onUpdate();
  };

  const filteredStudents = students.filter((s) => {
    if (circleFilter !== 'all' && s.circleId !== circleFilter) return false;
    if (search && !s.name.includes(search) && !s.fullNameQuad?.includes(search)) return false;
    return true;
  });

  return (
    <div className="space-y-3">
      {/* Top action row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث باسم الطالب أو الاسم الرباعي..."
              className="w-full pr-9 pl-3 py-2 text-xs rounded-xl bg-white border border-slate-200 focus:outline-hidden focus:border-indigo-600 min-h-[40px]"
            />
          </div>
          <select
            value={circleFilter}
            onChange={(e) => setCircleFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-white border border-slate-200 text-slate-700 min-h-[40px]"
          >
            <option value="all">كل الحلقات</option>
            {circles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleOpenAdd}
          className="min-h-[40px] px-3.5 rounded-xl bg-indigo-900 hover:bg-indigo-950 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة طالب جديد</span>
        </button>
      </div>

      {/* Students List */}
      <div className="space-y-2.5">
        {filteredStudents.map((student) => {
          const circleName = circles.find((c) => c.id === student.circleId)?.name;

          return (
            <div
              key={student.id}
              className={`bg-white rounded-2xl p-4 border transition-all flex flex-col gap-2.5 shadow-xs ${
                student.active ? 'border-slate-200' : 'border-slate-200 bg-slate-50/70 opacity-70'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-900 font-extrabold flex items-center justify-center text-sm shrink-0">
                    {student.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-extrabold text-slate-900">{student.name}</h4>
                      {/* Profile completion badge */}
                      {student.profileCompleted ? (
                        <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>بيانات مكتملة</span>
                        </span>
                      ) : (
                        <span className="text-[10px] bg-slate-100 text-slate-500 border border-slate-200 font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <span>فارغة</span>
                        </span>
                      )}
                      {!student.active && (
                        <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-1.5 py-0.2 rounded-full">
                          معطل
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1 flex-wrap">
                      <span>{circleName}</span>
                      <span>·</span>
                      <span>ولي الأمر: {student.guardianPhone || student.parentPhone || '—'}</span>
                      {student.nationalId && (
                        <>
                          <span>·</span>
                          <span className="tabular-nums">هوية: {student.nationalId}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-left shrink-0">
                  <span className="text-xs font-black text-teal-800 bg-teal-50 px-2.5 py-1 rounded-xl border border-teal-200 inline-flex items-center gap-1 tabular-nums">
                    ⭐ {student.currentPoints} نقطة
                  </span>
                </div>
              </div>

              {/* Action Buttons Strip */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-1.5 overflow-x-auto text-xs">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPointsAdjustStudent(student)}
                    className="px-2.5 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold flex items-center gap-1 border border-teal-200 min-h-[36px] cursor-pointer"
                  >
                    <Award className="w-3.5 h-3.5 text-teal-700" />
                    <span>تعديل النقاط (IT)</span>
                  </button>

                  <button
                    onClick={() => setInspectingStudent(student)}
                    className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-bold flex items-center gap-1 border border-indigo-200 min-h-[36px] cursor-pointer"
                    title="استعراض كامل بطاقة الطالب"
                  >
                    <Eye className="w-3.5 h-3.5 text-indigo-700" />
                    <span>بطاقة الطالب</span>
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(student)}
                    className="p-2 text-indigo-700 hover:text-indigo-900 hover:bg-indigo-50 rounded-lg min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer transition-colors"
                    title="تعديل بيانات الطالب للدعم الفني"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleToggleActive(student)}
                    className={`p-2 rounded-lg min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer ${
                      student.active
                        ? 'text-amber-600 hover:bg-amber-50'
                        : 'text-emerald-600 hover:bg-emerald-50'
                    }`}
                    title={student.active ? 'تعطيل الحساب' : 'تفعيل الحساب'}
                  >
                    <Power className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setDeleteCandidate(student)}
                    className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                    title="حذف الطالب"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

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
                    بطاقة الطالب التفصيلية (الدعم الفني)
                  </h3>
                  <p className="text-[11px] text-slate-500">كود الطالب: {inspectingStudent.id}</p>
                </div>
              </div>
              <button
                onClick={() => setInspectingStudent(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 py-3 text-xs">
              {/* Profile Completion Status */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-700">حالة تعبئة البيانات:</span>
                {inspectingStudent.profileCompleted ? (
                  <span className="text-emerald-700 font-extrabold bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>مكتملة ومسجلة رسميًا</span>
                  </span>
                ) : (
                  <span className="text-slate-500 font-extrabold bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200 flex items-center gap-1">
                    <span>فارغة</span>
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
                      {inspectingStudent.fullNameQuad || inspectingStudent.name || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">رقم الهوية / الإقامة:</span>
                    <span className="font-bold text-slate-900 tabular-nums">
                      {inspectingStudent.nationalId || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">الجنسية:</span>
                    <span className="font-bold text-slate-900">
                      {inspectingStudent.nationality || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">تاريخ الميلاد:</span>
                    <span className="font-bold text-slate-900 tabular-nums">
                      {inspectingStudent.birthDate || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">العمر:</span>
                    <span className="font-extrabold text-teal-800 tabular-nums">
                      {(() => {
                        const calculated = inspectingStudent.birthDate
                          ? calculateAge(inspectingStudent.birthDate)
                          : inspectingStudent.age;
                        return calculated ? `${calculated} سنة` : '—';
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500 font-medium">مكان الميلاد:</span>
                    <span className="font-bold text-slate-900">
                      {inspectingStudent.birthPlace || '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. البيانات الدراسية والسكن */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <h5 className="font-black text-indigo-950 flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-indigo-700" />
                  <span>البيانات الدراسية والسكن</span>
                </h5>
                <div className="space-y-1.5">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">المدرسة:</span>
                    <span className="font-bold text-slate-900">
                      {inspectingStudent.schoolName || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">المرحلة الدراسية:</span>
                    <span className="font-bold text-slate-900">
                      {inspectingStudent.educationalLevel || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500 font-medium">عنوان الطالب:</span>
                    <span className="font-bold text-slate-900">
                      {inspectingStudent.address || '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. بيانات ولي الأمر والتواصل */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <h5 className="font-black text-indigo-950 flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-700" />
                  <span>بيانات ولي الأمر والتواصل</span>
                </h5>
                <div className="space-y-1.5">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">اسم ولي الأمر:</span>
                    <span className="font-bold text-slate-900">
                      {inspectingStudent.guardianName || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">صلة القرابة:</span>
                    <span className="font-bold text-slate-900">
                      {inspectingStudent.guardianRelation || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">جوال ولي الأمر:</span>
                    <span className="font-extrabold text-teal-900 tabular-nums">
                      {inspectingStudent.guardianPhone || inspectingStudent.parentPhone || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500 font-medium">جوال الطالب:</span>
                    <span className="font-bold text-slate-900 tabular-nums">
                      {inspectingStudent.phone || '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setInspectingStudent(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold"
              >
                إغلاق
              </button>
              <button
                type="button"
                onClick={() => {
                  const s = inspectingStudent;
                  setInspectingStudent(null);
                  handleOpenEdit(s);
                }}
                className="px-4 py-2 rounded-xl bg-indigo-900 hover:bg-indigo-950 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>تعديل بيانات هذا الطالب</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comprehensive Add / Edit Student Modal for Technical Support */}
      {(isAddModalOpen || editingStudent) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-right p-5 animate-scale-up max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3 shrink-0">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  {editingStudent ? 'تعديل وتصحيح بيانات الطالب (الدعم الفني)' : 'إضافة طالب جديد'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  يمكن لمسؤول الدعم الفني تصحيح أي حقل أو تعديل أي خطأ
                </p>
              </div>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingStudent(null);
                }}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="space-y-3.5 overflow-y-auto flex-1 pr-1 pl-1">
              {/* القسم 1: البيانات الشخصية والهوية */}
              <div className="p-3 rounded-2xl bg-slate-50/90 border border-slate-200/90 space-y-2.5">
                <h4 className="text-xs font-black text-indigo-950 flex items-center gap-1 border-b border-slate-200/80 pb-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-indigo-700" />
                  <span>البيانات الشخصية والهوية</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">اسم العرض المختصر</label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="مثال: عبدالرحمن الزهراني"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">اسم الطالب الرباعي</label>
                    <input
                      type="text"
                      value={formFullNameQuad}
                      onChange={(e) => setFormFullNameQuad(e.target.value)}
                      placeholder="مثال: عبدالرحمن أحمد صالح الزهراني"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهوية / الإقامة</label>
                    <input
                      type="tel"
                      maxLength={10}
                      value={formNationalId}
                      onChange={(e) => setFormNationalId(e.target.value.replace(/\D/g, ''))}
                      placeholder="10 أرقام"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-bold tabular-nums"
                    />
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
                    <div className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-teal-50 text-teal-900 font-extrabold min-h-[38px] flex items-center justify-center">
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
                  <span>البيانات الدراسية والسكن والحلقة</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">الحلقة التابع لها</label>
                    <select
                      value={formCircleId}
                      onChange={(e) => setFormCircleId(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
                    >
                      {circles.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.teacherName})
                        </option>
                      ))}
                    </select>
                  </div>

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

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    عنوان الطالب
                  </label>
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

              <div className="flex items-center justify-end gap-2 pt-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingStudent(null);
                  }}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 text-slate-700"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-900 hover:bg-indigo-950 text-white font-bold text-xs shadow-md"
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
        />
      )}

      {/* Delete Confirmation */}
      {deleteCandidate && (
        <ConfirmationModal
          isOpen={!!deleteCandidate}
          onClose={() => setDeleteCandidate(null)}
          onConfirm={handleConfirmDelete}
          title="حذف الطالب نهائياً"
          message={`هل أنت متأكد من حذف الطالب (${deleteCandidate.name})؟\nسيتم حذف سجله بالكامل مع تسجيل العملية في سجل التدقيق الإداري.`}
          confirmText="حذف الطالب"
          cancelText="إلغاء"
          type="danger"
        />
      )}
    </div>
  );
};
