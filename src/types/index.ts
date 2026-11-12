export type Role = 'student' | 'teacher' | 'supervisor' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  studentId?: string; // Linked student record if role === 'student'
  circleId?: string;  // Linked circle if teacher
  avatar?: string;
  createdAt: string;
}

export interface Student {
  id: string;
  name: string;
  email: string;
  circleId: string;
  currentPoints: number; // Denormalized for Firebase Spark efficiency
  level?: string;
  streakDays: number;
  attendanceRate: number; // percentage 0-100
  memorizationRating: 'ممتاز' | 'جيد جداً' | 'جيد' | 'يحتاج متابعة';
  active: boolean;
  phone?: string;
  parentPhone?: string;
  fullNameQuad?: string;
  nationalId?: string;
  nationality?: string;
  birthDate?: string; // YYYY-MM-DD
  birthPlace?: string;
  age?: number;
  schoolName?: string;
  educationalLevel?: string; // e.g. ابتدائي / متوسط / ثانوي / جامعي
  address?: string;
  guardianName?: string;
  guardianPhone?: string;
  guardianRelation?: string;
  profileCompleted?: boolean;
  lastActivityDate: string;
  consecutiveAbsences: number;
  daysWithoutLog: number;
  attentionReason?: string; // If student needs attention
}

export interface Teacher {
  id: string;
  name: string;
  email: string;
  circleIds: string[];
  phone?: string;
  active: boolean;
}

export interface Circle {
  id: string;
  name: string;
  teacherId: string;
  teacherName: string;
  schedule: string;
  studentCount: number;
  description?: string;
  room?: string;
}

export type TransactionType =
  | 'attendance'
  | 'memorization'
  | 'revision'
  | 'task'
  | 'reward_redemption'
  | 'admin_bonus'
  | 'admin_correction'
  | 'refund';

export interface PointTransaction {
  id: string;
  studentId: string;
  studentName: string;
  amount: number; // positive or negative
  type: TransactionType;
  reason: string;
  date: string;
  createdBy: string;
  createdByRole: Role;
  idempotencyKey?: string; // student + date + activity + session to prevent duplicates
}

export interface Reward {
  id: string;
  title: string;
  description: string;
  costPoints: number;
  emoji: string;
  imageUrl?: string;
  totalQuantity: number;
  remainingQuantity: number;
  available: boolean;
  category?: string;
  originalValueSar?: number;
  expiresAt?: string;
}

export type RedemptionStatus = 'pending' | 'approved' | 'delivered' | 'rejected';

export interface RedemptionRequest {
  id: string;
  studentId: string;
  studentName: string;
  circleName: string;
  rewardId: string;
  rewardTitle: string;
  rewardCost: number;
  rewardEmoji: string;
  status: RedemptionStatus;
  requestDate: string;
  updatedDate?: string;
  handledBy?: string;
  rejectionReason?: string;
  refunded?: boolean;
}

export type AttendanceStatus = 'present' | 'absent' | 'excused';

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  circleId: string;
  date: string; // YYYY-MM-DD
  session: string; // e.g., 'عصر' or 'مغرب'
  status: AttendanceStatus;
  pointsAwarded: number;
  recordedBy: string;
  timestamp: string;
}

export type AttendanceType = 'early' | 'late' | 'absent';

export interface EvaluationRecord {
  id: string;
  studentId: string;
  studentName: string;
  circleId: string;
  date: string; // YYYY-MM-DD
  dayName?: string;
  weekNumber?: number;
  month?: string; // YYYY-MM
  attendance?: AttendanceType;
  attendancePoints?: number; // 2 for early, 1 for late, 0 for absent
  disciplineScore?: number; // 0 - 2
  uniformScore?: number; // 0 - 2
  memorizationScore?: number | any; // 0 - 2 or legacy
  revisionScore?: number | any; // 0 - 2 or legacy
  familyMeetingScore?: number; // 0 - 2
  behaviorScore?: string;
  totalPoints?: number; // out of 10
  pointsAwarded?: number;
  notes?: string;
  recordedBy: string;
  teacherId?: string;
  timestamp: string;
}

export interface PointRules {
  attendanceEarly: number; // 2
  attendanceLate: number;  // 1
  attendanceAbsent: number; // 0
  disciplineMax: number;   // 2
  uniformMax: number;      // 2
  memorizationMax: number; // 2
  revisionMax: number;     // 2
  // Legacy compatibility
  attendance?: number;
  memorizationFull?: number;
  memorizationPartial?: number;
  revisionFull?: number;
  revisionPartial?: number;
  taskBonus?: number;
  excellenceBonus?: number;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: Role;
  action: string;
  details: string;
  targetType: 'student' | 'reward' | 'point' | 'teacher' | 'circle' | 'settings' | 'redemption';
  targetId?: string;
  timestamp: string;
}

export interface Achievement {
  id: string;
  code: string;
  title: string;
  description: string;
  icon: string;
  requiredPoints?: number;
  requiredStreak?: number;
  unlockedAt?: string;
  currentValue?: number;
}

export interface StudentAttendanceStats {
  presentDays: number;
  absentDays: number;
  excusedDays: number;
  totalSessions: number;
  attendanceRate: number; // percentage 0-100
  hasRecords: boolean;
  streakDays: number;
  maxStreakDays: number;
  consecutiveAbsences: number;
}

export type ExamNominationStatus = 'pending' | 'completed' | 'cancelled';

export interface ExamBranchOption {
  branchNumber: number;
  partsCount: number;
  title: string;
  partsText: string;
}

export const EXAM_BRANCHES: ExamBranchOption[] = [
  { branchNumber: 1, partsCount: 1, title: 'الفرع الأول - جزء واحد', partsText: 'جزء واحد' },
  { branchNumber: 2, partsCount: 2, title: 'الفرع الثاني - جزئين', partsText: 'جزئين' },
  { branchNumber: 3, partsCount: 3, title: 'الفرع الثالث - 3 أجزاء', partsText: '3 أجزاء' },
  { branchNumber: 4, partsCount: 5, title: 'الفرع الرابع - 5 أجزاء', partsText: '5 أجزاء' },
  { branchNumber: 5, partsCount: 10, title: 'الفرع الخامس - 10 أجزاء', partsText: '10 أجزاء' },
  { branchNumber: 6, partsCount: 13, title: 'الفرع السادس - 13 جزء', partsText: '13 جزء' },
  { branchNumber: 7, partsCount: 15, title: 'الفرع السابع - 15 جزء', partsText: '15 جزء' },
  { branchNumber: 8, partsCount: 20, title: 'الفرع الثامن - 20 جزء', partsText: '20 جزء' },
  { branchNumber: 9, partsCount: 25, title: 'الفرع التاسع - 25 جزء', partsText: '25 جزء' },
  { branchNumber: 10, partsCount: 30, title: 'الفرع العاشر - 30 جزء', partsText: '30 جزء' },
];

export const getBranchByPartsCount = (count: number): ExamBranchOption => {
  return (
    EXAM_BRANCHES.find((b) => b.partsCount === count) || {
      branchNumber: 0,
      partsCount: count,
      title: `اختبار ${count} أجزاء`,
      partsText: `${count} أجزاء`,
    }
  );
};

export interface ExamNomination {
  id: string;
  studentId: string;
  studentName: string;
  circleId: string;
  circleName: string;
  teacherId: string;
  teacherName: string;
  partsCount: number; // e.g. 1, 2, 3, 5, 10, 13, 15, 20, 25, 30
  partsDescription?: string; // e.g., 'الفرع الأول - جزء واحد'
  notes?: string;
  status: ExamNominationStatus;
  requestDate: string; // YYYY-MM-DD
  createdAt: string; // ISO string
  updatedAt?: string;
  completedAt?: string;
  handledBy?: string; // e.g. 'مدير المجمع'
  cancellationReason?: string;
}

export type SupportTicketType = 'مشكلة' | 'اقتراح' | 'استفسار' | 'أخرى..';
export type SupportTicketPriority = 'high' | 'medium' | 'low';

export interface SupportTicket {
  id: string;
  ticketType: SupportTicketType;
  priority: SupportTicketPriority;
  message: string;
  senderName: string;
  senderRole?: Role | 'guest';
  senderPhone?: string;
  senderEmail?: string;
  senderId?: string;
  createdAt: string; // ISO string
  status: 'new' | 'in_progress' | 'resolved';
}

