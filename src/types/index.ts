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
}

export interface StudentAttendanceStats {
  presentDays: number;
  absentDays: number;
  excusedDays: number;
  totalSessions: number;
  attendanceRate: number; // percentage 0-100
  hasRecords: boolean;
}

