import React, { useState, useMemo } from 'react';
import { Student } from '../../types';
import { repository } from '../../services/storageService';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { calculateAge } from '../../utils/dateUtils';
import logoZuhaia from '../../assets/logo-zuhaia-transparent.png';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  User,
  CreditCard,
  GraduationCap,
  MapPin,
  Calendar,
  Phone,
  Users,
  ShieldCheck,
  AlertCircle,
  LogOut,
} from 'lucide-react';

interface StudentOnboardingModalProps {
  student: Student;
  isOpen: boolean;
  onComplete: () => void;
}

export const StudentOnboardingModal: React.FC<StudentOnboardingModalProps> = ({
  student,
  isOpen,
  onComplete,
}) => {
  const { logout } = useAuth();
  const { showToast, celebratePoints } = useToast();

  // Current step: 0 = Welcome screen, 1 = Personal & ID, 2 = School & Address, 3 = Guardian & Contact
  const [step, setStep] = useState<number>(0);

  // Form Fields State (empty by default until user fills them in)
  const [fullNameQuad, setFullNameQuad] = useState(student.fullNameQuad || student.name || '');
  const [nationalId, setNationalId] = useState(student.nationalId || '');
  const [nationality, setNationality] = useState(student.nationality || '');
  const [birthDate, setBirthDate] = useState(student.birthDate || '');
  const [birthPlace, setBirthPlace] = useState(student.birthPlace || '');
  const [schoolName, setSchoolName] = useState(student.schoolName || '');
  const [educationalLevel, setEducationalLevel] = useState(student.educationalLevel || '');
  
  // Helper to parse existing address into 3 parts (المدينة - الحي - الشارع)
  const parseAddressParts = (addr?: string) => {
    if (!addr) return { city: '', district: '', street: '' };
    const parts = addr.split(/\s*[-–—]\s*/);
    return {
      city: parts[0] || '',
      district: parts[1] || '',
      street: parts.slice(2).join(' - ') || '',
    };
  };

  const initialAddr = parseAddressParts(student.address);
  const [addressCity, setAddressCity] = useState(initialAddr.city);
  const [addressDistrict, setAddressDistrict] = useState(initialAddr.district);
  const [addressStreet, setAddressStreet] = useState(initialAddr.street);
  const [guardianName, setGuardianName] = useState(student.guardianName || '');
  const STANDARD_RELATIONS = useMemo(() => ['أب', 'أم', 'أخ', 'عم'], []);
  const [selectedRelationType, setSelectedRelationType] = useState<string>(() => {
    if (!student.guardianRelation) return '';
    return ['أب', 'أم', 'أخ', 'عم'].includes(student.guardianRelation)
      ? student.guardianRelation
      : 'أخرى';
  });
  const [customRelation, setCustomRelation] = useState<string>(() => {
    if (!student.guardianRelation) return '';
    return ['أب', 'أم', 'أخ', 'عم'].includes(student.guardianRelation)
      ? ''
      : student.guardianRelation;
  });
  const [guardianPhone, setGuardianPhone] = useState(student.guardianPhone || student.parentPhone || '');
  const [phone, setPhone] = useState(student.phone || '');

  // Validation error banner for current step
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Automatic Age Calculation from birthDate
  const computedAge = useMemo(() => calculateAge(birthDate), [birthDate]);

  if (!isOpen) return null;

  // Validation before advancing to next step
  const validateStep = (currentStep: number): boolean => {
    setErrorMsg(null);

    if (currentStep === 1) {
      if (!fullNameQuad.trim() || fullNameQuad.trim().split(/\s+/).length < 3) {
        setErrorMsg('يرجى إدخال اسم الطالب كاملاً (ثلاثي أو رباعي على الأقل)');
        return false;
      }
      if (!nationalId.trim()) {
        setErrorMsg('يرجى إدخال رقم الهوية الوطنية أو الإقامة');
        return false;
      }
      if (!/^\d{10}$/.test(nationalId.trim())) {
        setErrorMsg('رقم الهوية / الإقامة يجب أن يتكون من 10 أرقام');
        return false;
      }
      if (!nationality.trim()) {
        setErrorMsg('يرجى تحديد أو إدخال جنسية الطالب');
        return false;
      }
      if (!birthDate) {
        setErrorMsg('يرجى تحديد تاريخ ميلاد الطالب');
        return false;
      }
      if (!birthPlace.trim()) {
        setErrorMsg('يرجى كتابة مكان الميلاد (المدينة)');
        return false;
      }
    }

    if (currentStep === 2) {
      if (!schoolName.trim()) {
        setErrorMsg('يرجى كتابة اسم المدرسة التي يدرس بها الطالب');
        return false;
      }
      if (!educationalLevel.trim()) {
        setErrorMsg('يرجى تحديد المرحلة الدراسية للطالب');
        return false;
      }
      if (!addressCity.trim() && !addressDistrict.trim() && !addressStreet.trim()) {
        setErrorMsg('يرجى إدخال عنوان الطالب');
        return false;
      }
    }

    if (currentStep === 3) {
      if (!guardianName.trim()) {
        setErrorMsg('يرجى إدخال اسم ولي أمر الطالب');
        return false;
      }
      if (!selectedRelationType) {
        setErrorMsg('يرجى تحديد صلة القرابة');
        return false;
      }
      if (selectedRelationType === 'أخرى' && !customRelation.trim()) {
        setErrorMsg('يرجى كتابة صلة القرابة في الخانة المخصصة');
        return false;
      }
      if (!guardianPhone.trim()) {
        setErrorMsg('يرجى إدخال رقم جوال ولي الأمر');
        return false;
      }
      const cleanPhone = guardianPhone.replace(/\s+/g, '');
      if (!/^05\d{8}$/.test(cleanPhone)) {
        setErrorMsg('رقم جوال ولي الأمر يجب أن يبدأ بـ 05 ويتكون من 10 أرقام');
        return false;
      }
    }

    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    setErrorMsg(null);
    setStep((prev) => Math.max(1, prev - 1));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(3)) return;

    const updatedStudent: Student = {
      ...student,
      fullNameQuad: fullNameQuad.trim(),
      nationalId: nationalId.trim(),
      nationality: nationality.trim(),
      birthDate: birthDate,
      birthPlace: birthPlace.trim(),
      age: computedAge ?? (student.age || 0),
      schoolName: schoolName.trim(),
      educationalLevel: educationalLevel.trim(),
      address: [addressCity.trim(), addressDistrict.trim(), addressStreet.trim()].filter(Boolean).join(' - '),
      guardianName: guardianName.trim(),
      guardianRelation: (selectedRelationType === 'أخرى' ? customRelation.trim() : selectedRelationType) || '',
      guardianPhone: guardianPhone.trim(),
      parentPhone: guardianPhone.trim(),
      phone: phone.trim() || '',
      profileCompleted: true,
    };

    const res = repository.saveStudent(updatedStudent, {
      id: student.id,
      name: student.name,
      role: 'student',
    });

    if (res.success) {
      celebratePoints(10, 'اكتمال تسجيل وتحديث البيانات الرسمية بنجاح!');
      showToast('حيّاك الله! تم حفظ بياناتك الرسمية بنجاح واكتمال التسجيل 🎉', 'success');
      onComplete();
    } else {
      showToast(res.message || 'حدث خطأ أثناء حفظ البيانات', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-fade-in select-none">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-right animate-scale-up max-h-[92vh] flex flex-col">
        {/* Step 0: Welcome Screen */}
        {step === 0 && (
          <div className="relative p-6 sm:p-8 flex flex-col items-center text-center space-y-5 my-auto">
            {/* Top Bar with Logout Button */}
            <div className="w-full flex items-center justify-between pb-1 -mt-1">
              <span className="text-[11px] font-bold text-slate-400 truncate max-w-[180px]">
                حساب الطالب: {student.name}
              </span>
              <button
                type="button"
                onClick={() => logout()}
                className="px-2.5 py-1.5 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200/80 hover:border-rose-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                title="تسجيل الخروج والعودة لشاشة الدخول"
                aria-label="تسجيل الخروج"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>تسجيل الخروج</span>
              </button>
            </div>

            {/* Mosque Logo */}
            <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-3xl bg-teal-50/70 border-2 border-teal-100 flex items-center justify-center p-3.5 shadow-lg shadow-teal-900/10">
              <img
                src={logoZuhaia}
                alt="شعار جامع ومسجد زهية لنجاوي"
                className="w-full h-full object-contain drop-shadow-xs"
              />
            </div>

            {/* Welcome Text */}
            <div className="space-y-2 max-w-sm">
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                حيّاك الله!
              </h2>
            </div>

            {/* Arrow Button to Start Data Entry */}
            <div className="w-full pt-2 max-w-xs">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full min-h-[50px] rounded-2xl bg-gradient-to-r from-teal-700 to-teal-800 hover:from-teal-800 hover:to-teal-900 text-white font-black text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-teal-800/25 active:scale-[0.98] transition-all cursor-pointer group"
              >
                <span>البدء بتعبئة البيانات</span>
                <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
              </button>
            </div>
          </div>
        )}

        {/* Steps 1, 2, 3: Form Wizard Header */}
        {step > 0 && (
          <div className="bg-gradient-to-r from-teal-800 to-teal-900 text-white p-4 sm:p-5 shrink-0">
            <div className="flex items-center justify-between gap-3 mb-2.5">
              <div className="flex items-center gap-2.5">
                <img
                  src={logoZuhaia}
                  alt="شعار الحلقات"
                  className="w-7 h-7 object-contain bg-white/10 rounded-lg p-0.5"
                />
                <div>
                  <h3 className="text-sm font-black text-white">تعبئة البيانات الرسمية للطالب</h3>
                  <p className="text-[11px] text-teal-200 font-medium">
                    {step === 1 && 'الخطوة 1 من 3: البيانات الشخصية والهوية'}
                    {step === 2 && 'الخطوة 2 من 3: البيانات الدراسية والسكن'}
                    {step === 3 && 'الخطوة 3 من 3: بيانات ولي الأمر والتواصل'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black bg-white/15 px-2.5 py-1 rounded-xl text-teal-100">
                  {step} / 3
                </span>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-rose-500/30 text-teal-100 hover:text-white transition-colors cursor-pointer"
                  title="تسجيل الخروج والعودة"
                  aria-label="تسجيل الخروج"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Visual Step Progress Bar */}
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              <div
                className={`h-1.5 rounded-full transition-all ${
                  step >= 1 ? 'bg-amber-400' : 'bg-white/20'
                }`}
              />
              <div
                className={`h-1.5 rounded-full transition-all ${
                  step >= 2 ? 'bg-amber-400' : 'bg-white/20'
                }`}
              />
              <div
                className={`h-1.5 rounded-full transition-all ${
                  step >= 3 ? 'bg-amber-400' : 'bg-white/20'
                }`}
              />
            </div>
          </div>
        )}

        {/* Form Body */}
        {step > 0 && (
          <form
            onSubmit={step === 3 ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }}
            className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-right"
          >
            {/* Error Notification Banner if any */}
            {errorMsg && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* STEP 1: Personal & ID */}
            {step === 1 && (
              <div className="space-y-3.5">
                {/* 1. اسم الطالب الرباعي */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-teal-700" />
                    <span>اسم الطالب الرباعي <span className="text-rose-500">*</span></span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fullNameQuad}
                    onChange={(e) => setFullNameQuad(e.target.value)}
                    placeholder="مثال: عبدالرحمن أحمد بن صالح الزهراني"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-teal-600 focus:ring-1 focus:ring-teal-600 font-medium"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    يُرجى كتابة الاسم الرباعي كما هو مسجل في الهوية الوطنية أو الإقامة.
                  </span>
                </div>

                {/* 2. رقم الهوية */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-teal-700" />
                    <span>رقم الهوية الوطنية أو الإقامة <span className="text-rose-500">*</span></span>
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value.replace(/\D/g, ''))}
                    placeholder=""
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-teal-600 focus:ring-1 focus:ring-teal-600 font-bold tabular-nums"
                  />
                </div>

                {/* 3. الجنسية */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    الجنسية <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {['سعودي', 'يمني', 'مصري', 'سوري', 'سوداني'].map((nat) => (
                      <button
                        key={nat}
                        type="button"
                        onClick={() => setNationality(nat)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          nationality === nat
                            ? 'bg-teal-700 text-white border-teal-700 shadow-2xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {nat}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    required
                    value={nationality}
                    onChange={(e) => setNationality(e.target.value)}
                    placeholder="أو اكتب الجنسية هنا"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-teal-600 font-medium"
                  />
                </div>

                {/* 4. تاريخ الميلاد & حساب العمر تلقائياً */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-teal-700" />
                      <span>تاريخ الميلاد <span className="text-rose-500">*</span></span>
                    </label>
                    <input
                      type="date"
                      required
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-teal-600 font-medium"
                    />
                  </div>

                  {/* عمر الطالب (محسوب تلقائياً) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      عمر الطالب <span className="text-teal-700 text-[10px] font-normal">(محسوب تلقائياً)</span>
                    </label>
                    <div className="w-full px-3.5 py-2 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 text-xs font-extrabold flex items-center justify-between min-h-[38px]">
                      <span>
                        {computedAge !== null ? `${computedAge} سنة` : 'يُحسب عند اختيار التاريخ'}
                      </span>
                      {computedAge !== null && (
                        <span className="text-[10px] bg-teal-200/80 text-teal-950 px-2 py-0.5 rounded-md">
                          تلقائي
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 5. مكان الميلاد */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-teal-700" />
                    <span>مكان الميلاد <span className="text-rose-500">*</span></span>
                  </label>
                  <input
                    type="text"
                    required
                    value={birthPlace}
                    onChange={(e) => setBirthPlace(e.target.value)}
                    placeholder="مثال: مكة المكرمة، جدة، الرياض..."
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-teal-600 font-medium"
                  />
                </div>
              </div>
            )}

            {/* STEP 2: School & Address */}
            {step === 2 && (
              <div className="space-y-3.5">
                {/* 6. المدرسة التي يدرس بها الطالب */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-teal-700" />
                    <span>المدرسة التي يدرس بها الطالب <span className="text-rose-500">*</span></span>
                  </label>
                  <input
                    type="text"
                    required
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder="مثال: مدرسة الإمام مالك الابتدائية"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-teal-600 font-medium"
                  />
                </div>

                {/* 7. المرحلة الدراسية */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-teal-700" />
                    <span>المرحلة الدراسية <span className="text-rose-500">*</span></span>
                  </label>
                  <input
                    type="text"
                    required
                    value={educationalLevel}
                    onChange={(e) => setEducationalLevel(e.target.value)}
                    placeholder="مثال: الصف الخامس الابتدائي"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-teal-600 focus:ring-1 focus:ring-teal-600 font-medium"
                  />
                </div>

                {/* 8. عنوان الطالب */}
                <div className="space-y-1.5">
                  <div>
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-teal-700" />
                      <span>عنوان الطالب <span className="text-rose-500">*</span></span>
                    </label>
                  </div>

                  <div className="p-3 bg-slate-50/90 rounded-2xl border border-slate-200/90 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {/* الحقل 1: المدينة */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          1. المدينة
                        </label>
                        <input
                          type="text"
                          value={addressCity}
                          onChange={(e) => setAddressCity(e.target.value)}
                          placeholder="مثال: جدة"
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-teal-600 focus:ring-1 focus:ring-teal-600 font-medium"
                        />
                      </div>

                      {/* الحقل 2: الحي */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          2. الحي
                        </label>
                        <input
                          type="text"
                          value={addressDistrict}
                          onChange={(e) => setAddressDistrict(e.target.value)}
                          placeholder="مثال: حي النسيم"
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-teal-600 focus:ring-1 focus:ring-teal-600 font-medium"
                        />
                      </div>

                      {/* الحقل 3: الشارع */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          3. الشارع
                        </label>
                        <input
                          type="text"
                          value={addressStreet}
                          onChange={(e) => setAddressStreet(e.target.value)}
                          placeholder="مثال: شارع أم المؤمنين صفية"
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-teal-600 focus:ring-1 focus:ring-teal-600 font-medium"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Guardian & Contact */}
            {step === 3 && (
              <div className="space-y-3.5">
                {/* 9. اسم ولي أمر الطالب */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-teal-700" />
                    <span>اسم ولي أمر الطالب <span className="text-rose-500">*</span></span>
                  </label>
                  <input
                    type="text"
                    required
                    value={guardianName}
                    onChange={(e) => setGuardianName(e.target.value)}
                    placeholder="مثال: أحمد بن صالح الزهراني"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-teal-600 font-medium"
                  />
                </div>

                {/* 10. صلة القرابة */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    صلة القرابة <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 mb-2">
                    {['أب', 'أم', 'أخ', 'عم', 'أخرى'].map((rel) => (
                      <button
                        key={rel}
                        type="button"
                        onClick={() => setSelectedRelationType(rel)}
                        className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          selectedRelationType === rel
                            ? 'bg-teal-700 text-white border-teal-700 shadow-2xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {rel}
                      </button>
                    ))}
                  </div>

                  {/* تظهر خانة يكتب فيها صلة القرابة فقط لو اختار أخرى */}
                  {selectedRelationType === 'أخرى' && (
                    <div className="animate-fade-in mt-1.5">
                      <input
                        type="text"
                        required
                        autoFocus
                        value={customRelation}
                        onChange={(e) => setCustomRelation(e.target.value)}
                        placeholder="اكتب صلة القرابة هنا (مثال: خال، جد، ولي أمر...)"
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-teal-600 focus:outline-hidden focus:ring-1 focus:ring-teal-600 font-medium bg-teal-50/20"
                      />
                    </div>
                  )}
                </div>

                {/* 11. رقم الجوال لولي الأمر */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-teal-700" />
                    <span>رقم الجوال لولي الأمر <span className="text-rose-500">*</span></span>
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={guardianPhone}
                    onChange={(e) => setGuardianPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="05xxxxxxxx"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-teal-600 font-bold tabular-nums"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    يُستخدم لإرسال الإشعارات وتواصل المعلم والمشرف مع ولي الأمر.
                  </span>
                </div>

                {/* 12. رقم جوال الطالب (اختياري) */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>رقم جوال الطالب (اختياري إن وجد)</span>
                  </label>
                  <input
                    type="tel"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="05xxxxxxxx (اختياري)"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-teal-600 font-medium tabular-nums"
                  />
                </div>
              </div>
            )}

            {/* Bottom Actions Bar */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handlePrev}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <ArrowRight className="w-4 h-4" />
                <span>السابق</span>
              </button>

              {step < 3 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-6 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-teal-700/20 cursor-pointer transition-all active:scale-[0.98]"
                >
                  <span>التالي</span>
                  <ArrowLeft className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-emerald-600/25 cursor-pointer transition-all active:scale-[0.98]"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>حفظ واعتماد البيانات</span>
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
