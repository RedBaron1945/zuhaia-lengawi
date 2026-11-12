import {
  Student,
  Circle,
  Teacher,
  PointTransaction,
  Reward,
  RedemptionRequest,
  PointRules,
  AuditLog,
  Achievement,
  AttendanceRecord,
  EvaluationRecord,
  Role,
  StudentAttendanceStats,
  ExamNomination,
  ExamNominationStatus,
  SupportTicket,
  SupportTicketType,
  SupportTicketPriority,
} from '../types';
import {
  INITIAL_STUDENTS,
  INITIAL_CIRCLES,
  INITIAL_TEACHERS,
  INITIAL_TRANSACTIONS,
  INITIAL_REWARDS,
  INITIAL_REDEMPTION_REQUESTS,
  INITIAL_POINT_RULES,
  INITIAL_ACHIEVEMENTS,
  INITIAL_AUDIT_LOGS,
  INITIAL_EVALUATIONS,
  normalizeCircleId,
} from '../data/mockData';
import { getArabicDayName, isCircleDay } from '../utils/dateUtils';
import { db, auth } from '../lib/firebase';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDoc,
  onSnapshotsInSync,
} from 'firebase/firestore';

const STORAGE_KEYS = {
  STUDENTS: 'tartil_students_v5',
  CIRCLES: 'tartil_circles_v6',
  TEACHERS: 'tartil_teachers_v4',
  TRANSACTIONS: 'tartil_transactions_v4',
  REWARDS: 'tartil_rewards_v3',
  REDEMPTIONS: 'tartil_redemptions_v3',
  ATTENDANCE: 'tartil_attendance_v2',
  EVALUATIONS: 'tartil_evaluations_v2',
  RULES: 'tartil_rules_v2',
  AUDIT_LOGS: 'tartil_audit_logs_v2',
  ACHIEVEMENTS: 'tartil_achievements_v2',
  CURRENT_USER: 'tartil_current_user_v2',
  PURGED_MOCK: 'tartil_mock_purged_flag_v2',
  EXAM_NOMINATIONS: 'tartil_exam_nominations_v2',
  SUPPORT_TICKETS: 'tartil_support_tickets_v1',
};

// Auto-purge any legacy mock data from browser localStorage once
try {
  if (!localStorage.getItem(STORAGE_KEYS.PURGED_MOCK)) {
    const oldKeys = [
      'tartil_students_v1',
      'tartil_transactions_v3',
      'tartil_rewards_v2',
      'tartil_redemptions_v2',
      'tartil_attendance_v1',
      'tartil_evaluations_v1',
      'tartil_audit_logs_v1',
      'tartil_rules_v1',
      'tartil_circles_v1',
      'tartil_teachers_v1',
    ];
    oldKeys.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem(STORAGE_KEYS.PURGED_MOCK, 'true');
  }
} catch {
  // Ignore in non-browser or sandbox environments
}

// Sync status types and reactive listener for connection health
export type FirestoreSyncStatus = 'connected' | 'syncing' | 'offline' | 'error';

export interface SyncStatusInfo {
  status: FirestoreSyncStatus;
  lastUpdated: Date | null;
  pendingWritesCount: number;
  isOnline: boolean;
  isCached: boolean;
  errorMessage?: string;
}

type SyncStatusListener = (info: SyncStatusInfo) => void;
const syncStatusListeners: Set<SyncStatusListener> = new Set();

let currentSyncStatus: SyncStatusInfo = {
  status: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'connected',
  lastUpdated: new Date(),
  pendingWritesCount: 0,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isCached: true,
};

export const getSyncStatus = (): SyncStatusInfo => ({ ...currentSyncStatus });

export const subscribeToSyncStatus = (callback: SyncStatusListener) => {
  syncStatusListeners.add(callback);
  // Defer initial delivery to guarantee it does not execute synchronously inside a render cycle
  setTimeout(() => {
    if (syncStatusListeners.has(callback)) {
      try {
        callback(getSyncStatus());
      } catch (e) {
        console.error('Error in initial sync status callback:', e);
      }
    }
  }, 0);
  return () => {
    syncStatusListeners.delete(callback);
  };
};

export const updateSyncState = (partial: Partial<SyncStatusInfo>) => {
  currentSyncStatus = { ...currentSyncStatus, ...partial };
  // Defer notification with setTimeout(..., 0) so no component receives a setState while another component is rendering
  setTimeout(() => {
    syncStatusListeners.forEach((cb) => {
      try {
        cb(currentSyncStatus);
      } catch (e) {
        console.error('Error notifying sync listener:', e);
      }
    });
  }, 0);
};

// Monitor online / offline network state
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    updateSyncState({ isOnline: true, status: 'syncing' });
  });
  window.addEventListener('offline', () => {
    updateSyncState({ isOnline: false, status: 'offline' });
  });
}

// Event listener type for reactive updates across components
type StateChangeListener = () => void;
const listeners: Set<StateChangeListener> = new Set();

export const subscribeToDataChanges = (callback: StateChangeListener) => {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
};

let debounceTimer: any = null;
const debouncedNotifySubscribers = () => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    notifySubscribers();
  }, 40);
};

const notifySubscribers = () => {
  setTimeout(() => {
    listeners.forEach((listener) => {
      try {
        listener();
      } catch (e) {
        console.error('Error in subscriber callback:', e);
      }
    });
  }, 0);
};

// Helpers for localStorage
function loadItem<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Failed to load ${key} from storage:`, e);
    return defaultValue;
  }
}

function saveItem<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Failed to save ${key} to storage:`, e);
  }
}

// Helper to strip undefined values so Firestore setDoc never throws Unsupported field value: undefined
function sanitizeForFirestore<T>(data: T): Record<string, any> {
  return JSON.parse(JSON.stringify(data));
}

// In-memory cache of synced items to eliminate redundant writes and downstream read cycles
const syncedHashes = new Map<string, string>();
const deletedDocIds = new Set<string>();

// Asynchronous Firestore Sync Helpers
async function syncToFirestore<T extends { id: string }>(collectionName: string, item: T) {
  try {
    if (!item?.id) return;
    const docKey = `${collectionName}_${item.id}`;
    deletedDocIds.delete(item.id);
    const sanitized = sanitizeForFirestore(item);
    const serialized = JSON.stringify(sanitized);
    if (syncedHashes.get(docKey) === serialized) {
      // Data hasn't changed; avoid duplicate write & read triggers
      return;
    }

    updateSyncState({
      status: 'syncing',
      pendingWritesCount: currentSyncStatus.pendingWritesCount + 1,
    });

    await setDoc(doc(db, collectionName, item.id), sanitized);
    syncedHashes.set(docKey, serialized);

    updateSyncState({
      status: 'connected',
      lastUpdated: new Date(),
      pendingWritesCount: Math.max(0, currentSyncStatus.pendingWritesCount - 1),
      errorMessage: undefined,
    });
  } catch (err: any) {
    console.warn(`Firestore sync notice on '${collectionName}':`, err?.message || err);
    updateSyncState({
      status: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error',
      errorMessage: err?.message || 'خطأ في الاتصال بفاير ستور',
      pendingWritesCount: Math.max(0, currentSyncStatus.pendingWritesCount - 1),
    });
  }
}

async function deleteFromFirestore(collectionName: string, id: string) {
  try {
    if (!id) return;
    deletedDocIds.add(id);
    syncedHashes.delete(`${collectionName}_${id}`);

    updateSyncState({
      status: 'syncing',
      pendingWritesCount: currentSyncStatus.pendingWritesCount + 1,
    });

    await deleteDoc(doc(db, collectionName, id));

    updateSyncState({
      status: 'connected',
      lastUpdated: new Date(),
      pendingWritesCount: Math.max(0, currentSyncStatus.pendingWritesCount - 1),
      errorMessage: undefined,
    });
  } catch (err: any) {
    console.warn(`Firestore delete notice on '${collectionName}':`, err?.message || err);
    updateSyncState({
      status: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error',
      errorMessage: err?.message,
      pendingWritesCount: Math.max(0, currentSyncStatus.pendingWritesCount - 1),
    });
  }
}

export const triggerManualSync = async (): Promise<void> => {
  try {
    updateSyncState({ status: 'syncing' });
    await getDoc(doc(db, 'rules', 'default_rules'));
    updateSyncState({
      status: 'connected',
      lastUpdated: new Date(),
      errorMessage: undefined,
    });
  } catch (e: any) {
    updateSyncState({
      status: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error',
      errorMessage: e?.message || 'تعذر الاتصال بقاعدة البيانات',
    });
    throw e;
  }
};

export interface IRepository {
  // Students
  getStudents(): Student[];
  getStudentById(id: string): Student | undefined;
  saveStudent(student: Student, actor: { id: string; name: string; role: Role }): { success: boolean; message: string };
  deleteStudent(id: string, actor: { id: string; name: string; role: Role }): { success: boolean; message: string };
  toggleStudentActive(id: string, actor: { id: string; name: string; role: Role }): { success: boolean; active: boolean };

  // Circles & Teachers
  getCircles(): Circle[];
  getCircleById(id: string): Circle | undefined;
  saveCircle(circle: Circle, actor: { id: string; name: string; role: Role }): void;
  getTeachers(): Teacher[];
  saveTeacher(teacher: Teacher, actor: { id: string; name: string; role: Role }): void;
  deleteTeacher(id: string, actor: { id: string; name: string; role: Role }): void;

  // Points & Transactions
  getTransactions(filter?: { studentId?: string }): PointTransaction[];
  addPointTransaction(
    params: {
      studentId: string;
      amount: number;
      type: PointTransaction['type'];
      reason: string;
      createdBy: string;
      createdByRole: Role;
      idempotencyKey?: string;
    }
  ): { success: boolean; message: string; transaction?: PointTransaction; duplicate?: boolean };

  // Attendance
  recordAttendance(
    params: {
      studentId: string;
      circleId: string;
      status: 'present' | 'absent' | 'excused';
      date: string;
      session: string;
      teacherName: string;
    }
  ): { success: boolean; message: string; pointsAwarded: number; duplicate?: boolean };
  getAttendanceHistory(circleId?: string, date?: string): AttendanceRecord[];
  getStudentAttendanceStats(studentId: string, period?: 'week' | 'month' | 'all'): StudentAttendanceStats;


  // Evaluations
  recordEvaluation(
    params: {
      studentId: string;
      circleId: string;
      date: string;
      memorizationScore: 'full' | 'partial' | 'none';
      revisionScore: 'full' | 'partial' | 'none';
      behaviorScore?: 'excellent' | 'good' | 'average';
      notes?: string;
      teacherName: string;
    }
  ): { success: boolean; message: string; totalPoints: number };
  getEvaluationsHistory(studentId?: string): EvaluationRecord[];

  // Daily multi-criteria evaluation (Sunday to Wednesday rubric)
  saveDailyEvaluation(params: {
    studentId: string;
    circleId: string;
    date: string;
    dayName?: string;
    attendance?: 'early' | 'late' | 'absent' | null;
    disciplineScore?: number | null;
    uniformScore?: number | null;
    memorizationScore?: number | null;
    revisionScore?: number | null;
    familyMeetingScore?: number;
    notes?: string;
    teacherName: string;
    teacherId?: string;
  }): { success: boolean; message: string; record: EvaluationRecord; deltaPoints: number };
  deleteDailyEvaluation(params: {
    studentId: string;
    date: string;
    teacherName?: string;
  }): { success: boolean; message: string; deletedRecord?: EvaluationRecord };
  getEvaluationForStudentAndDate(studentId: string, date: string): EvaluationRecord | undefined;
  getEvaluationsForCircleAndDate(circleId: string, date: string): EvaluationRecord[];
  getEvaluationsForCircleAndWeek(circleId: string, weekDates: string[]): EvaluationRecord[];

  // Rewards & Redemptions
  getRewards(): Reward[];
  getRewardById(id: string): Reward | undefined;
  saveReward(reward: Reward, actor: { id: string; name: string; role: Role }): void;
  deleteReward(id: string, actor: { id: string; name: string; role: Role }): void;
  toggleRewardAvailable(id: string, actor: { id: string; name: string; role: Role }): void;

  getRedemptionRequests(filter?: { studentId?: string; status?: string }): RedemptionRequest[];
  createRedemptionRequest(
    studentId: string,
    rewardId: string
  ): { success: boolean; message: string; request?: RedemptionRequest };
  updateRedemptionStatus(
    params: {
      requestId: string;
      status: RedemptionRequest['status'];
      handledBy: string;
      rejectionReason?: string;
      refundPoints?: boolean;
    }
  ): { success: boolean; message: string };
  deleteRedemptionRequest(requestId: string, handledBy?: string): { success: boolean; message: string };

  // Rules & Settings
  getPointRules(): PointRules;
  updatePointRules(rules: PointRules, actor: { id: string; name: string; role: Role }): void;

  // Audit Logs & Achievements
  getAuditLogs(): AuditLog[];
  addAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>): void;
  deleteAuditLog(logId: string): { success: boolean; message: string };
  clearAllAuditLogs(): { success: boolean; message: string };
  getAchievements(studentId?: string): Achievement[];

  // Exam Nominations (ترشيح للاختبار)
  getExamNominations(filter?: { circleId?: string; status?: string; studentId?: string }): ExamNomination[];
  createExamNominations(
    nominations: Array<{
      studentId: string;
      studentName: string;
      circleId: string;
      circleName: string;
      teacherId: string;
      teacherName: string;
      partsCount: number;
      partsDescription?: string;
      notes?: string;
    }>
  ): { success: boolean; message: string; count: number };
  updateExamNominationStatus(params: {
    nominationId: string;
    status: ExamNominationStatus;
    handledBy: string;
    cancellationReason?: string;
  }): { success: boolean; message: string };
  deleteExamNomination(nominationId: string, handledBy?: string): { success: boolean; message: string };

  // Support Tickets (الدعم الفني)
  getSupportTickets(): SupportTicket[];
  createSupportTicket(ticket: Omit<SupportTicket, 'id' | 'createdAt' | 'status' | 'priority'> & { priority?: SupportTicketPriority }): { success: boolean; message: string; ticket: SupportTicket };
  updateSupportTicket(ticketId: string, updates: Partial<Pick<SupportTicket, 'priority' | 'status'>>): { success: boolean; message: string };
  deleteSupportTicket(ticketId: string): { success: boolean; message: string };

  // Reset
  resetToDefaults(): void;
}

class FirestoreConnectedRepository implements IRepository {
  private listenersInitialized = false;
  private unsubscribers: (() => void)[] = [];

  constructor() {
    this.reconcileStudentPointsFromTransactions();
    this.reconcileStudentAttendance();
    this.initFirestoreRealtimeListeners();
    this.recalculateCircleStudentCounts();
    this.seedInitialDataIfEmpty();
  }

  private async seedInitialDataIfEmpty() {
    if (typeof localStorage === 'undefined') return;
    const SEED_KEY = 'tartil_firestore_seeded_zuhaia_v4';
    if (!localStorage.getItem(SEED_KEY)) {
      localStorage.setItem(SEED_KEY, 'true');
    }
  }

  /**
   * Reconciles currentPoints for every student against the transactions ledger.
   * Guarantees that points displayed and persisted in Firestore never diverge from recorded transactions.
   */
  public reconcileStudentPointsFromTransactions(): void {
    try {
      // 1. Correct any evaluation records where dayName didn't match the actual date
      const evals = loadItem<EvaluationRecord[]>(STORAGE_KEYS.EVALUATIONS, INITIAL_EVALUATIONS);
      let evalsModified = false;
      evals.forEach((e) => {
        if (e.date) {
          const accurateDay = getArabicDayName(e.date);
          if (e.dayName !== accurateDay) {
            e.dayName = accurateDay;
            evalsModified = true;
          }
        }
      });
      if (evalsModified) {
        saveItem(STORAGE_KEYS.EVALUATIONS, evals);
      }

      // 2. Clean and consolidate transactions
      const rawTransactions = loadItem<PointTransaction[]>(STORAGE_KEYS.TRANSACTIONS, INITIAL_TRANSACTIONS);
      let txModified = false;

      // Group evaluation transactions by `${studentId}_${date}`
      const evalMap = new Map<string, PointTransaction[]>();
      const otherTxs: PointTransaction[] = [];

      rawTransactions.forEach((tx) => {
        // Fix wrong day name in transaction text if present
        if (tx.reason?.includes('تقييم يوم الأحد (2026-10-29)')) {
          tx.reason = tx.reason.replace('تقييم يوم الأحد (2026-10-29)', 'تقييم يوم الخميس (2026-10-29)');
          txModified = true;
        }

        const isEval =
          tx.idempotencyKey?.includes('daily_eval') ||
          tx.id?.includes('eval') ||
          tx.reason?.includes('تقييم') ||
          tx.reason?.startsWith('تقييم يوم') ||
          tx.reason?.startsWith('إلغاء وحذف تقييم يوم');

        if (isEval && tx.studentId) {
          let dateStr = tx.date;
          if (!dateStr && tx.idempotencyKey) {
            const m = tx.idempotencyKey.match(/\d{4}-\d{2}-\d{2}/);
            if (m) dateStr = m[0];
          }
          if (!dateStr && tx.id) {
            const m = tx.id.match(/\d{4}-\d{2}-\d{2}/);
            if (m) dateStr = m[0];
          }
          if (!dateStr && tx.reason) {
            const m = tx.reason.match(/\d{4}-\d{2}-\d{2}/);
            if (m) dateStr = m[0];
          }
          if (dateStr) {
            if (dateStr.includes('T')) dateStr = dateStr.split('T')[0];
            const key = `${tx.studentId}_${dateStr}`;
            const list = evalMap.get(key) || [];
            list.push(tx);
            evalMap.set(key, list);
          } else {
            // Orphan evaluation transaction with no identifiable date
            txModified = true;
          }
        } else {
          otherTxs.push(tx);
        }
      });

      const consolidatedTxs: PointTransaction[] = [...otherTxs];

      // Process evaluation transaction groups:
      // An evaluation transaction is strictly valid ONLY if an active EvaluationRecord exists in `evals` with points > 0!
      evalMap.forEach((list, groupKey) => {
        const [sId, dKey] = groupKey.split('_');
        const matchingEval = evals.find((e) => e.studentId === sId && e.date === dKey);

        const evalScore = matchingEval
          ? typeof matchingEval.totalPoints === 'number'
            ? matchingEval.totalPoints
            : matchingEval.pointsAwarded || 0
          : 0;

        // If no evaluation record exists in evals or points are 0, skip
        if (!matchingEval || evalScore <= 0) {
          txModified = true;
          return;
        }

        // Matching evaluation exists with points > 0:
        const accurateDay = matchingEval.dayName || getArabicDayName(dKey);
        const att =
          matchingEval.attendance === 'early'
            ? 'مبكر (2ن)'
            : matchingEval.attendance === 'late'
            ? 'متأخر (1ن)'
            : 'غائب (0ن)';
        const cleanReason = `تقييم يوم ${accurateDay} (${dKey}): حضور ${att}، حفظ ${matchingEval.memorizationScore || 0}ن، مراجعة ${matchingEval.revisionScore || 0}ن، انضباط ${matchingEval.disciplineScore || 0}ن، زي ${matchingEval.uniformScore || 0}ن`;

        const primaryTx = list[0];
        if (list.length > 1) {
          txModified = true;
        }

        const consolidatedTx: PointTransaction = {
          id: primaryTx.id || `tx_eval_${sId}_${dKey}`,
          studentId: sId,
          studentName: matchingEval.studentName || primaryTx.studentName,
          amount: evalScore,
          type: 'memorization',
          reason: cleanReason,
          date: dKey,
          createdBy: matchingEval.recordedBy || primaryTx.createdBy || 'المعلم',
          createdByRole: 'teacher',
          idempotencyKey: `daily_eval_${sId}_${dKey}`,
        };

        if (primaryTx.amount !== evalScore || primaryTx.reason !== cleanReason || list.length > 1) {
          txModified = true;
        }

        consolidatedTxs.push(consolidatedTx);
      });

      // Ensure that all existing active evaluations in `evals` (with points > 0) have a corresponding transaction
      evals.forEach((e) => {
        if (!e.studentId || !e.date) return;
        const pts = typeof e.totalPoints === 'number' ? e.totalPoints : e.pointsAwarded || 0;
        if (pts <= 0) return;
        const key = `${e.studentId}_${e.date}`;
        if (!evalMap.has(key)) {
          const accurateDay = e.dayName || getArabicDayName(e.date);
          const att =
            e.attendance === 'early' ? 'مبكر (2ن)' : e.attendance === 'late' ? 'متأخر (1ن)' : 'غائب (0ن)';
          const cleanReason = `تقييم يوم ${accurateDay} (${e.date}): حضور ${att}، حفظ ${e.memorizationScore || 0}ن، مراجعة ${e.revisionScore || 0}ن، انضباط ${e.disciplineScore || 0}ن، زي ${e.uniformScore || 0}ن`;
          const newTx: PointTransaction = {
            id: `tx_eval_${e.studentId}_${e.date}`,
            studentId: e.studentId,
            studentName: e.studentName,
            amount: pts,
            type: 'memorization',
            reason: cleanReason,
            date: e.date,
            createdBy: e.recordedBy || 'المعلم',
            createdByRole: 'teacher',
            idempotencyKey: `daily_eval_${e.studentId}_${e.date}`,
          };
          consolidatedTxs.push(newTx);
          txModified = true;
        }
      });

      if (txModified) {
        saveItem(STORAGE_KEYS.TRANSACTIONS, consolidatedTxs);
      }

      // 3. Reconcile student balances with transactions ledger LOCALLY
      const finalTxs = txModified ? consolidatedTxs : rawTransactions;
      const students = loadItem<Student[]>(STORAGE_KEYS.STUDENTS, INITIAL_STUDENTS);

      const txPointsByStudent = new Map<string, number>();
      finalTxs.forEach((tx) => {
        if (tx.studentId && typeof tx.amount === 'number') {
          const cur = txPointsByStudent.get(tx.studentId) || 0;
          txPointsByStudent.set(tx.studentId, cur + tx.amount);
        }
      });

      let modified = false;
      students.forEach((s) => {
        const truePoints = Math.max(0, txPointsByStudent.get(s.id) || 0);
        if (s.currentPoints !== truePoints) {
          s.currentPoints = truePoints;
          modified = true;
          // Local update only - no Firestore writes inside reconciliation
        }
      });

      if (modified) {
        saveItem(STORAGE_KEYS.STUDENTS, students);
      }
    } catch (e) {
      console.warn('Reconciliation notice:', e);
    }
  }

  private initFirestoreRealtimeListeners() {
    if (this.listenersInitialized) return;
    this.listenersInitialized = true;

    try {
      // Global snapshot sync listener to confirm Firestore caught up with remote server
      const unsubSync = onSnapshotsInSync(db, () => {
        updateSyncState({
          status: 'connected',
          lastUpdated: new Date(),
          isCached: false,
          errorMessage: undefined,
        });
      });
      this.unsubscribers.push(unsubSync);

      const handleSnapshotError = (col: string) => (error: any) => {
        if (error?.code === 'permission-denied') {
          updateSyncState({ status: 'error', errorMessage: 'قواعد فاير ستور تمنع القراءة' });
          return;
        }
        console.warn(`Firestore onSnapshot (${col}):`, error?.message || error);
        updateSyncState({
          status: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error',
          errorMessage: error?.message,
        });
      };

      const recordSnapshotReceived = (fromCache: boolean) => {
        updateSyncState({
          status: 'connected',
          lastUpdated: new Date(),
          isCached: fromCache,
          errorMessage: undefined,
        });
      };

      // 1. Sync Students from Firestore
      const unsubStudents = onSnapshot(
        collection(db, 'students'),
        { includeMetadataChanges: false },
        (snapshot) => {
          if (snapshot.metadata.hasPendingWrites) return;
          recordSnapshotReceived(snapshot.metadata.fromCache);
          if (!snapshot.empty) {
            const list: Student[] = [];
            snapshot.forEach((d) => {
              const s = d.data() as Student;
              if (s && s.id && !deletedDocIds.has(s.id)) {
                list.push(s);
              }
            });
            saveItem(STORAGE_KEYS.STUDENTS, list);
            this.recalculateCircleStudentCounts();
            debouncedNotifySubscribers();
          }
        },
        handleSnapshotError('students')
      );
      this.unsubscribers.push(unsubStudents);

      // 2. Sync Circles from Firestore
      const unsubCircles = onSnapshot(
        collection(db, 'circles'),
        { includeMetadataChanges: false },
        (snapshot) => {
          if (snapshot.metadata.hasPendingWrites) return;
          recordSnapshotReceived(snapshot.metadata.fromCache);
          if (!snapshot.empty) {
            const list: Circle[] = [];
            snapshot.forEach((d) => list.push(d.data() as Circle));
            saveItem(STORAGE_KEYS.CIRCLES, list);
            debouncedNotifySubscribers();
          }
        },
        handleSnapshotError('circles')
      );
      this.unsubscribers.push(unsubCircles);

      // 3. Sync Teachers from Firestore
      const unsubTeachers = onSnapshot(
        collection(db, 'teachers'),
        { includeMetadataChanges: false },
        (snapshot) => {
          if (snapshot.metadata.hasPendingWrites) return;
          recordSnapshotReceived(snapshot.metadata.fromCache);
          if (!snapshot.empty) {
            const list: Teacher[] = [];
            snapshot.forEach((d) => list.push(d.data() as Teacher));
            saveItem(STORAGE_KEYS.TEACHERS, list);
            debouncedNotifySubscribers();
          }
        },
        handleSnapshotError('teachers')
      );
      this.unsubscribers.push(unsubTeachers);

      // 4. Sync Evaluations from Firestore
      const unsubEvals = onSnapshot(
        collection(db, 'evaluations'),
        { includeMetadataChanges: false },
        (snapshot) => {
          if (snapshot.metadata.hasPendingWrites) return;
          recordSnapshotReceived(snapshot.metadata.fromCache);
          const list: EvaluationRecord[] = [];
          if (!snapshot.empty) {
            snapshot.forEach((d) => {
              const rec = d.data() as EvaluationRecord;
              if (rec && rec.id && !deletedDocIds.has(rec.id)) {
                list.push(rec);
              }
            });
          }
          saveItem(STORAGE_KEYS.EVALUATIONS, list);
          debouncedNotifySubscribers();
        },
        handleSnapshotError('evaluations')
      );
      this.unsubscribers.push(unsubEvals);

      // 5. Sync Point Transactions from Firestore
      const unsubTx = onSnapshot(
        collection(db, 'transactions'),
        { includeMetadataChanges: false },
        (snapshot) => {
          if (snapshot.metadata.hasPendingWrites) return;
          recordSnapshotReceived(snapshot.metadata.fromCache);
          const list: PointTransaction[] = [];
          if (!snapshot.empty) {
            snapshot.forEach((d) => {
              const tx = d.data() as PointTransaction;
              if (tx && tx.id && !deletedDocIds.has(tx.id)) {
                list.push(tx);
              }
            });
          }
          saveItem(STORAGE_KEYS.TRANSACTIONS, list);
          debouncedNotifySubscribers();
        },
        handleSnapshotError('transactions')
      );
      this.unsubscribers.push(unsubTx);

      // 6. Sync Rewards from Firestore
      const unsubRewards = onSnapshot(
        collection(db, 'rewards'),
        { includeMetadataChanges: false },
        (snapshot) => {
          if (snapshot.metadata.hasPendingWrites) return;
          recordSnapshotReceived(snapshot.metadata.fromCache);
          if (!snapshot.empty) {
            const list: Reward[] = [];
            snapshot.forEach((d) => {
              const r = d.data() as Reward;
              if (r && r.id && !deletedDocIds.has(r.id)) {
                list.push(r);
              }
            });
            saveItem(STORAGE_KEYS.REWARDS, list);
            debouncedNotifySubscribers();
          }
        },
        handleSnapshotError('rewards')
      );
      this.unsubscribers.push(unsubRewards);

      // 7. Sync Redemptions from Firestore
      const unsubRedemptions = onSnapshot(
        collection(db, 'redemptions'),
        { includeMetadataChanges: false },
        (snapshot) => {
          if (snapshot.metadata.hasPendingWrites) return;
          recordSnapshotReceived(snapshot.metadata.fromCache);
          if (!snapshot.empty) {
            const list: RedemptionRequest[] = [];
            snapshot.forEach((d) => list.push(d.data() as RedemptionRequest));
            saveItem(STORAGE_KEYS.REDEMPTIONS, list);
            debouncedNotifySubscribers();
          }
        },
        handleSnapshotError('redemptions')
      );
      this.unsubscribers.push(unsubRedemptions);

      // 8. Sync Exam Nominations from Firestore
      const unsubNominations = onSnapshot(
        collection(db, 'exam_nominations'),
        { includeMetadataChanges: false },
        (snapshot) => {
          if (snapshot.metadata.hasPendingWrites) return;
          recordSnapshotReceived(snapshot.metadata.fromCache);
          if (!snapshot.empty) {
            const list: ExamNomination[] = [];
            snapshot.forEach((d) => list.push(d.data() as ExamNomination));
            saveItem(STORAGE_KEYS.EXAM_NOMINATIONS, list);
            debouncedNotifySubscribers();
          }
        },
        handleSnapshotError('exam_nominations')
      );
      this.unsubscribers.push(unsubNominations);

      // 9. Sync Support Tickets from Firestore
      const unsubTickets = onSnapshot(
        collection(db, 'support_tickets'),
        { includeMetadataChanges: false },
        (snapshot) => {
          if (snapshot.metadata.hasPendingWrites) return;
          recordSnapshotReceived(snapshot.metadata.fromCache);
          if (!snapshot.empty) {
            const list: SupportTicket[] = [];
            snapshot.forEach((d) => list.push(d.data() as SupportTicket));
            saveItem(STORAGE_KEYS.SUPPORT_TICKETS, list);
            debouncedNotifySubscribers();
          }
        },
        handleSnapshotError('support_tickets')
      );
      this.unsubscribers.push(unsubTickets);
    } catch (e) {
      console.warn('Firestore real-time listeners initialization skipped:', e);
    }
  }

  // Students
  getStudents(): Student[] {
    const loaded = loadItem<Student[]>(STORAGE_KEYS.STUDENTS, INITIAL_STUDENTS);
    // Remove student level if any legacy field remains and normalize circleId
    let modified = false;
    loaded.forEach((s) => {
      if (s.level) {
        delete s.level;
        modified = true;
      }
      if (s.circleId) {
        const normalized = normalizeCircleId(s.circleId);
        if (normalized !== s.circleId) {
          s.circleId = normalized;
          modified = true;
        }
      }
    });

    // Merge any INITIAL_STUDENTS not yet present in loaded
    const loadedIds = new Set(loaded.map((s) => s.id));
    INITIAL_STUDENTS.forEach((initialStudent) => {
      if (!loadedIds.has(initialStudent.id)) {
        loaded.push(initialStudent);
        modified = true;
      }
    });

    // Reconcile currentPoints against transactions ledger to guarantee consistency
    const transactions = loadItem<PointTransaction[]>(STORAGE_KEYS.TRANSACTIONS, INITIAL_TRANSACTIONS);
    const txPointsByStudent = new Map<string, number>();
    transactions.forEach((tx) => {
      if (tx.studentId && typeof tx.amount === 'number') {
        const cur = txPointsByStudent.get(tx.studentId) || 0;
        txPointsByStudent.set(tx.studentId, cur + tx.amount);
      }
    });

    loaded.forEach((s) => {
      if (txPointsByStudent.has(s.id)) {
        const truePoints = Math.max(0, txPointsByStudent.get(s.id)!);
        if (s.currentPoints !== truePoints) {
          s.currentPoints = truePoints;
          modified = true;
        }
      }

      // Reconcile attendance and streaks against evaluation/attendance records
      const stats = this.getStudentAttendanceStats(s.id);
      if (
        s.attendanceRate !== stats.attendanceRate ||
        s.streakDays !== stats.streakDays ||
        s.consecutiveAbsences !== stats.consecutiveAbsences
      ) {
        s.attendanceRate = stats.attendanceRate;
        s.streakDays = stats.streakDays;
        s.consecutiveAbsences = stats.consecutiveAbsences;
        modified = true;
      }
    });

    if (modified) {
      saveItem(STORAGE_KEYS.STUDENTS, loaded);
    }
    return loaded;
  }

  getStudentById(id: string): Student | undefined {
    return this.getStudents().find((s) => s.id === id);
  }

  saveStudent(student: Student, actor: { id: string; name: string; role: Role }): { success: boolean; message: string } {
    // Ensure circleId is normalized to official ID
    student.circleId = normalizeCircleId(student.circleId);

    const students = this.getStudents();
    const existingIndex = students.findIndex((s) => s.id === student.id);
    const isNew = existingIndex === -1;

    if (isNew) {
      students.push(student);
    } else {
      students[existingIndex] = student;
    }

    saveItem(STORAGE_KEYS.STUDENTS, students);
    syncToFirestore('students', student);

    // Update Circle student count
    this.recalculateCircleStudentCounts();

    // Audit log
    this.addAuditLog({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: isNew ? 'إضافة طالب جديد' : 'تحديث بيانات طالب',
      details: `${isNew ? 'تمت إضافة' : 'تم تعديل'} الطالب ${student.name} في ${this.getCircleById(student.circleId)?.name || 'الحلقة'}`,
      targetType: 'student',
      targetId: student.id,
    });

    notifySubscribers();
    return { success: true, message: isNew ? 'تمت إضافة الطالب بنجاح' : 'تم تحديث بيانات الطالب' };
  }

  deleteStudent(id: string, actor: { id: string; name: string; role: Role }): { success: boolean; message: string } {
    const students = this.getStudents();
    const student = students.find((s) => s.id === id);
    if (!student) return { success: false, message: 'الطالب غير موجود' };

    deletedDocIds.add(id);
    const filtered = students.filter((s) => s.id !== id);
    saveItem(STORAGE_KEYS.STUDENTS, filtered);
    deleteFromFirestore('students', id);
    this.recalculateCircleStudentCounts();

    this.addAuditLog({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'حذف طالب',
      details: `تم حذف الطالب ${student.name}`,
      targetType: 'student',
      targetId: id,
    });

    notifySubscribers();
    return { success: true, message: 'تم حذف الطالب بنجاح' };
  }

  toggleStudentActive(id: string, actor: { id: string; name: string; role: Role }): { success: boolean; active: boolean } {
    const students = this.getStudents();
    const student = students.find((s) => s.id === id);
    if (!student) return { success: false, active: false };

    student.active = !student.active;
    saveItem(STORAGE_KEYS.STUDENTS, students);
    syncToFirestore('students', student);
    this.recalculateCircleStudentCounts();

    this.addAuditLog({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: student.active ? 'تفعيل حساب طالب' : 'تعطيل حساب طالب',
      details: `تم ${student.active ? 'تفعيل' : 'تعطيل'} حساب الطالب ${student.name}`,
      targetType: 'student',
      targetId: id,
    });

    notifySubscribers();
    return { success: true, active: student.active };
  }

  // Circles & Teachers
  getCircles(): Circle[] {
    const circles = loadItem<Circle[]>(STORAGE_KEYS.CIRCLES, INITIAL_CIRCLES);
    let modified = false;
    INITIAL_CIRCLES.forEach((initC) => {
      const existing = circles.find((c) => c.id === initC.id);
      if (existing) {
        if (existing.teacherId !== initC.teacherId || existing.teacherName !== initC.teacherName) {
          existing.teacherId = initC.teacherId;
          existing.teacherName = initC.teacherName;
          modified = true;
        }
      } else {
        circles.push(initC);
        modified = true;
      }
    });
    if (modified) {
      saveItem(STORAGE_KEYS.CIRCLES, circles);
    }
    return circles;
  }

  getCircleById(id: string): Circle | undefined {
    return this.getCircles().find((c) => c.id === id);
  }

  saveCircle(circle: Circle, actor: { id: string; name: string; role: Role }): void {
    const circles = this.getCircles();
    const idx = circles.findIndex((c) => c.id === circle.id);
    if (idx >= 0) {
      circles[idx] = circle;
    } else {
      circles.push(circle);
    }
    saveItem(STORAGE_KEYS.CIRCLES, circles);
    syncToFirestore('circles', circle);

    this.addAuditLog({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: idx >= 0 ? 'تحديث حلقة' : 'إضافة حلقة جديدة',
      details: `${circle.name} بإشراف ${circle.teacherName}`,
      targetType: 'circle',
      targetId: circle.id,
    });

    notifySubscribers();
  }

  private recalculateCircleStudentCounts(): void {
    const students = this.getStudents();
    const circles = this.getCircles();
    circles.forEach((c) => {
      c.studentCount = students.filter((s) => s.circleId === c.id && s.active).length;
    });
    saveItem(STORAGE_KEYS.CIRCLES, circles);
  }

  getTeachers(): Teacher[] {
    const teachers = loadItem<Teacher[]>(STORAGE_KEYS.TEACHERS, INITIAL_TEACHERS);
    let modified = false;
    INITIAL_TEACHERS.forEach((initT) => {
      const existing = teachers.find((t) => t.name === initT.name || t.id === initT.id);
      if (existing) {
        if (existing.id !== initT.id) {
          existing.id = initT.id;
          modified = true;
        }
      } else {
        teachers.push(initT);
        modified = true;
      }
    });
    if (modified) {
      saveItem(STORAGE_KEYS.TEACHERS, teachers);
    }
    return teachers;
  }

  saveTeacher(teacher: Teacher, actor: { id: string; name: string; role: Role }): void {
    const teachers = this.getTeachers();
    const idx = teachers.findIndex((t) => t.id === teacher.id);
    if (idx >= 0) {
      teachers[idx] = teacher;
    } else {
      teachers.push(teacher);
    }
    saveItem(STORAGE_KEYS.TEACHERS, teachers);
    syncToFirestore('teachers', teacher);

    this.addAuditLog({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: idx >= 0 ? 'تعديل بيانات معلم' : 'إضافة معلم جديد',
      details: `المعلم ${teacher.name} (${teacher.email})`,
      targetType: 'teacher',
      targetId: teacher.id,
    });

    notifySubscribers();
  }

  deleteTeacher(id: string, actor: { id: string; name: string; role: Role }): void {
    const teachers = this.getTeachers();
    const teacher = teachers.find((t) => t.id === id);
    const filtered = teachers.filter((t) => t.id !== id);
    saveItem(STORAGE_KEYS.TEACHERS, filtered);
    deleteFromFirestore('teachers', id);

    this.addAuditLog({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'حذف معلم',
      details: `تم حذف المعلم ${teacher?.name || id}`,
      targetType: 'teacher',
      targetId: id,
    });

    notifySubscribers();
  }

  // Transactions & Points
  getTransactions(filter?: { studentId?: string }): PointTransaction[] {
    const all = loadItem<PointTransaction[]>(STORAGE_KEYS.TRANSACTIONS, INITIAL_TRANSACTIONS);
    if (filter?.studentId) {
      return all.filter((t) => t.studentId === filter.studentId);
    }
    return all;
  }

  addPointTransaction(params: {
    studentId: string;
    amount: number;
    type: PointTransaction['type'];
    reason: string;
    createdBy: string;
    createdByRole: Role;
    idempotencyKey?: string;
  }): { success: boolean; message: string; transaction?: PointTransaction; duplicate?: boolean } {
    const students = this.getStudents();
    const studentIndex = students.findIndex((s) => s.id === params.studentId);

    if (studentIndex === -1) {
      return { success: false, message: 'الطالب غير موجود' };
    }

    const student = students[studentIndex];
    const transactions = this.getTransactions();

    if (params.idempotencyKey) {
      const existing = transactions.find((t) => t.idempotencyKey === params.idempotencyKey);
      if (existing) {
        return {
          success: false,
          duplicate: true,
          message: `تم تسجيل هذه العملية مسبقاً اليوم (${params.reason}) ولم يتم تكرار النقاط.`,
          transaction: existing,
        };
      }
    }

    if (params.amount < 0 && student.currentPoints + params.amount < 0) {
      return {
        success: false,
        message: `رصيد الطالب لا يكفي (${student.currentPoints} نقطة متاحة فقط).`,
      };
    }

    const newTx: PointTransaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      studentId: student.id,
      studentName: student.name,
      amount: params.amount,
      type: params.type,
      reason: params.reason,
      date: new Date().toISOString().split('T')[0],
      createdBy: params.createdBy,
      createdByRole: params.createdByRole,
      idempotencyKey: params.idempotencyKey,
    };

    transactions.unshift(newTx);
    saveItem(STORAGE_KEYS.TRANSACTIONS, transactions);
    syncToFirestore('transactions', newTx);

    // Atomically update student denormalized current points
    student.currentPoints = Math.max(0, student.currentPoints + params.amount);
    student.lastActivityDate = newTx.date;
    students[studentIndex] = student;
    saveItem(STORAGE_KEYS.STUDENTS, students);
    syncToFirestore('students', student);

    if (params.type === 'admin_bonus' || params.type === 'admin_correction' || params.createdByRole === 'admin') {
      this.addAuditLog({
        actorId: params.createdBy,
        actorName: params.createdBy,
        actorRole: params.createdByRole,
        action: params.amount >= 0 ? 'إضافة نقاط إدارية' : 'خصم نقاط إداري',
        details: `${params.amount >= 0 ? '+' : ''}${params.amount} نقطة للطالب ${student.name} - السبب: ${params.reason}`,
        targetType: 'point',
        targetId: student.id,
      });
    }

    notifySubscribers();
    return {
      success: true,
      message: `تم تسجيل العملية بنجاح (${params.amount >= 0 ? '+' : ''}${params.amount} نقطة).`,
      transaction: newTx,
    };
  }

  // Attendance
  recordAttendance(params: {
    studentId: string;
    circleId: string;
    status: 'present' | 'absent' | 'excused';
    date: string;
    session: string;
    teacherName: string;
  }): { success: boolean; message: string; pointsAwarded: number; duplicate?: boolean } {
    const attendanceRecords = loadItem<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);
    const students = this.getStudents();
    const student = students.find((s) => s.id === params.studentId);
    if (!student) return { success: false, message: 'الطالب غير موجود', pointsAwarded: 0 };

    const rules = this.getPointRules();
    const idempotencyKey = `student_${params.studentId}:${params.date}:attendance:${params.session}`;

    const existingIndex = attendanceRecords.findIndex(
      (r) => r.studentId === params.studentId && r.date === params.date && r.session === params.session
    );

    let pointsToAward = 0;
    if (params.status === 'present') {
      pointsToAward = rules.attendance ?? rules.attendanceEarly ?? 2;
    }

    if (existingIndex >= 0) {
      const existing = attendanceRecords[existingIndex];
      if (existing.status === params.status) {
        return {
          success: false,
          duplicate: true,
          message: `تم تحضير الطالب ${student.name} كـ (${params.status === 'present' ? 'حاضر' : params.status === 'excused' ? 'معتذر' : 'غائب'}) مسبقاً اليوم.`,
          pointsAwarded: 0,
        };
      }
      existing.status = params.status;
      existing.pointsAwarded = pointsToAward;
      attendanceRecords[existingIndex] = existing;
      syncToFirestore('attendance', existing);
    } else {
      const record: AttendanceRecord = {
        id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        studentId: student.id,
        studentName: student.name,
        circleId: params.circleId,
        date: params.date,
        session: params.session,
        status: params.status,
        pointsAwarded: pointsToAward,
        recordedBy: params.teacherName,
        timestamp: new Date().toISOString(),
      };
      attendanceRecords.unshift(record);
      syncToFirestore('attendance', record);
    }

    saveItem(STORAGE_KEYS.ATTENDANCE, attendanceRecords);

    if (params.status === 'present') {
      const txResult = this.addPointTransaction({
        studentId: student.id,
        amount: pointsToAward,
        type: 'attendance',
        reason: `حضور الحلقة (${params.session})`,
        createdBy: params.teacherName,
        createdByRole: 'teacher',
        idempotencyKey,
      });

      if (txResult.duplicate) {
        return {
          success: true,
          duplicate: true,
          message: `تم تحديث الحضور، ونقاط الحضور مسجلة بالفعل اليوم (${pointsToAward} نقاط).`,
          pointsAwarded: 0,
        };
      }
    }

    const freshStudents = this.getStudents();
    const sIdx = freshStudents.findIndex((s) => s.id === params.studentId);
    if (sIdx >= 0) {
      if (params.status === 'present') {
        freshStudents[sIdx].streakDays = (freshStudents[sIdx].streakDays || 0) + 1;
        freshStudents[sIdx].consecutiveAbsences = 0;
        freshStudents[sIdx].daysWithoutLog = 0;
        freshStudents[sIdx].lastActivityDate = params.date;
      } else if (params.status === 'absent') {
        freshStudents[sIdx].streakDays = 0;
        freshStudents[sIdx].consecutiveAbsences = (freshStudents[sIdx].consecutiveAbsences || 0) + 1;
        if (freshStudents[sIdx].consecutiveAbsences >= 3) {
          freshStudents[sIdx].attentionReason = `غياب متكرر (${freshStudents[sIdx].consecutiveAbsences} أيام متتالية)`;
        }
      }
      saveItem(STORAGE_KEYS.STUDENTS, freshStudents);
      syncToFirestore('students', freshStudents[sIdx]);
    }

    notifySubscribers();
    return {
      success: true,
      message:
        params.status === 'present'
          ? `تم تحضير ${student.name} وتمت إضافة +${pointsToAward} نقاط إلى رصيده! 🌟`
          : `تم تسجيل ${student.name} كـ ${params.status === 'excused' ? 'معتذر' : 'غائب'} بنجاح.`,
      pointsAwarded: pointsToAward,
    };
  }

  getAttendanceHistory(circleId?: string, date?: string): AttendanceRecord[] {
    let records = loadItem<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);
    if (circleId) records = records.filter((r) => r.circleId === circleId);
    if (date) records = records.filter((r) => r.date === date);
    return records;
  }

  getStudentAttendanceStats(studentId: string, period?: 'week' | 'month' | 'all'): StudentAttendanceStats {
    const evals = loadItem<EvaluationRecord[]>(STORAGE_KEYS.EVALUATIONS, INITIAL_EVALUATIONS);
    const attendance = loadItem<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);

    let studentEvals = evals.filter((e) => e.studentId === studentId);
    let studentAttendance = attendance.filter((r) => r.studentId === studentId);

    // Apply period filtering if specified
    if (period && period !== 'all') {
      const now = new Date();
      let minDate = '';
      if (period === 'week') {
        const d = new Date(now);
        // Start of current week (Sunday)
        d.setDate(d.getDate() - d.getDay());
        minDate = d.toISOString().split('T')[0];
      } else if (period === 'month') {
        const d = new Date(now.getFullYear(), now.getMonth(), 1);
        minDate = d.toISOString().split('T')[0];
      }
      if (minDate) {
        studentEvals = studentEvals.filter((e) => e.date >= minDate);
        studentAttendance = studentAttendance.filter((a) => a.date >= minDate);
      }
    }

    // Map each distinct date to status
    const dateStatusMap = new Map<string, 'present' | 'absent' | 'excused'>();

    // Daily evaluations from teachers (standard rubric: 2 or 1 = present, 0 = absent)
    studentEvals.forEach((e) => {
      if (e.date) {
        const att = e.attendance;
        const attPts = typeof e.attendancePoints === 'number' ? e.attendancePoints : undefined;
        const isPresent =
          att === 'early' ||
          att === 'late' ||
          attPts === 2 ||
          attPts === 1 ||
          (att as any) === 2 ||
          (att as any) === 1 ||
          (att as any) === '2' ||
          (att as any) === '1';
        const isAbsent =
          att === 'absent' ||
          attPts === 0 ||
          (att as any) === 0 ||
          (att as any) === '0';

        if (isPresent) {
          dateStatusMap.set(e.date, 'present');
        } else if (isAbsent) {
          dateStatusMap.set(e.date, 'absent');
        }
      }
    });

    // Dedicated attendance sessions (if not already captured on that date)
    studentAttendance.forEach((a) => {
      if (a.date && !dateStatusMap.has(a.date)) {
        dateStatusMap.set(a.date, a.status);
      }
    });

    let presentDays = 0;
    let absentDays = 0;
    let excusedDays = 0;

    dateStatusMap.forEach((status) => {
      if (status === 'present') presentDays++;
      else if (status === 'absent') absentDays++;
      else if (status === 'excused') excusedDays++;
    });

    const totalSessions = presentDays + absentDays;
    const hasRecords = totalSessions > 0;
    const attendanceRate = hasRecords ? Math.round((presentDays / totalSessions) * 100) : 0;

    // Calculate accurate streaks from chronological entries
    const sortedEntries = Array.from(dateStatusMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    let currentStreak = 0;
    let maxStreak = 0;
    let currentConsecutiveAbsences = 0;

    sortedEntries.forEach(([_, status]) => {
      if (status === 'present') {
        currentStreak++;
        currentConsecutiveAbsences = 0;
        if (currentStreak > maxStreak) {
          maxStreak = currentStreak;
        }
      } else if (status === 'absent') {
        currentStreak = 0;
        currentConsecutiveAbsences++;
      }
    });

    const streakDays = hasRecords ? currentStreak : 0;
    const maxStreakDays = hasRecords ? maxStreak : 0;
    const consecutiveAbsences = hasRecords ? currentConsecutiveAbsences : 0;

    return {
      presentDays,
      absentDays,
      excusedDays,
      totalSessions,
      attendanceRate,
      hasRecords,
      streakDays,
      maxStreakDays,
      consecutiveAbsences,
    };
  }

  public reconcileStudentAttendance(): void {
    try {
      const students = loadItem<Student[]>(STORAGE_KEYS.STUDENTS, INITIAL_STUDENTS);
      let modified = false;

      students.forEach((s) => {
        const stats = this.getStudentAttendanceStats(s.id);
        if (
          s.attendanceRate !== stats.attendanceRate ||
          s.streakDays !== stats.streakDays ||
          s.consecutiveAbsences !== stats.consecutiveAbsences
        ) {
          s.attendanceRate = stats.attendanceRate;
          s.streakDays = stats.streakDays;
          s.consecutiveAbsences = stats.consecutiveAbsences;
          modified = true;
        }
      });

      if (modified) {
        saveItem(STORAGE_KEYS.STUDENTS, students);
      }
    } catch (e) {
      console.warn('Student attendance reconciliation notice:', e);
    }
  }

  // Evaluations
  recordEvaluation(params: {
    studentId: string;
    circleId: string;
    date: string;
    memorizationScore: 'full' | 'partial' | 'none';
    revisionScore: 'full' | 'partial' | 'none';
    behaviorScore?: 'excellent' | 'good' | 'average';
    notes?: string;
    teacherName: string;
  }): { success: boolean; message: string; totalPoints: number } {
    const students = this.getStudents();
    const student = students.find((s) => s.id === params.studentId);
    if (!student) return { success: false, message: 'الطالب غير موجود', totalPoints: 0 };

    const rules = this.getPointRules();
    let memPoints = 0;
    if (params.memorizationScore === 'full') memPoints = rules.memorizationFull ?? 2;
    else if (params.memorizationScore === 'partial') memPoints = rules.memorizationPartial ?? 1;

    let revPoints = 0;
    if (params.revisionScore === 'full') revPoints = rules.revisionFull ?? 2;
    else if (params.revisionScore === 'partial') revPoints = rules.revisionPartial ?? 1;

    let behPoints = 0;
    if (params.behaviorScore === 'excellent') behPoints = rules.excellenceBonus ?? 1;

    const totalPoints = memPoints + revPoints + behPoints;

    const evals = loadItem<EvaluationRecord[]>(STORAGE_KEYS.EVALUATIONS, []);
    const evalRecord: EvaluationRecord = {
      id: `eval_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      studentId: student.id,
      studentName: student.name,
      circleId: params.circleId,
      date: params.date,
      memorizationScore: params.memorizationScore,
      revisionScore: params.revisionScore,
      behaviorScore: params.behaviorScore,
      pointsAwarded: totalPoints,
      notes: params.notes,
      recordedBy: params.teacherName,
      timestamp: new Date().toISOString(),
    };
    evals.unshift(evalRecord);
    saveItem(STORAGE_KEYS.EVALUATIONS, evals);
    syncToFirestore('evaluations', evalRecord);

    if (memPoints > 0) {
      this.addPointTransaction({
        studentId: student.id,
        amount: memPoints,
        type: 'memorization',
        reason: `تسميع الحفظ (${params.memorizationScore === 'full' ? 'كامل المطلوب' : 'جزء من المطلوب'})`,
        createdBy: params.teacherName,
        createdByRole: 'teacher',
      });
    }

    if (revPoints > 0) {
      this.addPointTransaction({
        studentId: student.id,
        amount: revPoints,
        type: 'revision',
        reason: `مراجعة السور المقررة (${params.revisionScore === 'full' ? 'كاملة ومتقنة' : 'جزئية'})`,
        createdBy: params.teacherName,
        createdByRole: 'teacher',
      });
    }

    if (behPoints > 0) {
      this.addPointTransaction({
        studentId: student.id,
        amount: behPoints,
        type: 'task',
        reason: 'تميز في الأدب والسمت القرآني في الحلقة',
        createdBy: params.teacherName,
        createdByRole: 'teacher',
      });
    }

    const freshStudents = this.getStudents();
    const sIdx = freshStudents.findIndex((s) => s.id === params.studentId);
    if (sIdx >= 0) {
      freshStudents[sIdx].daysWithoutLog = 0;
      freshStudents[sIdx].lastActivityDate = params.date;
      if (params.memorizationScore === 'full' && params.revisionScore === 'full') {
        freshStudents[sIdx].memorizationRating = 'ممتاز';
      }
      saveItem(STORAGE_KEYS.STUDENTS, freshStudents);
      syncToFirestore('students', freshStudents[sIdx]);
    }

    notifySubscribers();
    return {
      success: true,
      message: `تم تسجيل تقييم ${student.name} بنجاح وإضافة ${totalPoints} نقطة! 🎉`,
      totalPoints,
    };
  }

  getEvaluationsList(): EvaluationRecord[] {
    return loadItem<EvaluationRecord[]>(STORAGE_KEYS.EVALUATIONS, INITIAL_EVALUATIONS);
  }

  getEvaluationsHistory(studentId?: string): EvaluationRecord[] {
    const records = this.getEvaluationsList();
    if (studentId) return records.filter((r) => r.studentId === studentId);
    return records;
  }

  saveDailyEvaluation(params: {
    studentId: string;
    circleId: string;
    date: string;
    dayName?: string;
    attendance?: 'early' | 'late' | 'absent' | null;
    disciplineScore?: number | null;
    uniformScore?: number | null;
    memorizationScore?: number | null;
    revisionScore?: number | null;
    familyMeetingScore?: number;
    notes?: string;
    teacherName: string;
    teacherId?: string;
  }): { success: boolean; message: string; record: EvaluationRecord; deltaPoints: number } {
    const students = this.getStudents();
    const student = students.find((s) => s.id === params.studentId);
    if (!student) {
      return { success: false, message: 'الطالب غير موجود', record: {} as any, deltaPoints: 0 };
    }

    const rules = this.getPointRules();
    let attPoints = 0;
    if (params.attendance === 'early') attPoints = rules.attendanceEarly ?? 2;
    else if (params.attendance === 'late') attPoints = rules.attendanceLate ?? 1;
    else if (params.attendance === 'absent') attPoints = rules.attendanceAbsent ?? 0;
    else attPoints = 0;

    const discPts = typeof params.disciplineScore === 'number' ? params.disciplineScore : 0;
    const uniPts = typeof params.uniformScore === 'number' ? params.uniformScore : 0;
    const memPts = typeof params.memorizationScore === 'number' ? params.memorizationScore : 0;
    const revPts = typeof params.revisionScore === 'number' ? params.revisionScore : 0;

    const totalPoints = attPoints + discPts + uniPts + memPts + revPts;

    const accurateDayName = getArabicDayName(params.date);

    if (!isCircleDay(params.date)) {
      return {
        success: false,
        message: 'الرصد متاح فقط لأيام الحلقات المقررة من الأحد إلى الأربعاء',
        record: {} as EvaluationRecord,
        deltaPoints: 0,
      };
    }

    const evals = this.getEvaluationsList();
    const existingIndex = evals.findIndex((e) => e.studentId === params.studentId && e.date === params.date);

    let evalRecord: EvaluationRecord;

    if (existingIndex >= 0) {
      const old = evals[existingIndex];
      evalRecord = {
        ...old,
        circleId: params.circleId,
        attendance: params.attendance || undefined,
        attendancePoints: attPoints,
        disciplineScore: typeof params.disciplineScore === 'number' ? params.disciplineScore : undefined,
        uniformScore: typeof params.uniformScore === 'number' ? params.uniformScore : undefined,
        memorizationScore: typeof params.memorizationScore === 'number' ? params.memorizationScore : undefined,
        revisionScore: typeof params.revisionScore === 'number' ? params.revisionScore : undefined,
        familyMeetingScore: params.familyMeetingScore ?? old.familyMeetingScore ?? 2,
        totalPoints,
        pointsAwarded: totalPoints,
        dayName: accurateDayName,
        notes: params.notes,
        recordedBy: params.teacherName,
        teacherId: params.teacherId,
        timestamp: new Date().toISOString(),
      };
      evals[existingIndex] = evalRecord;
    } else {
      evalRecord = {
        id: `eval_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        studentId: student.id,
        studentName: student.name,
        circleId: params.circleId,
        date: params.date,
        dayName: accurateDayName,
        attendance: params.attendance || undefined,
        attendancePoints: attPoints,
        disciplineScore: typeof params.disciplineScore === 'number' ? params.disciplineScore : undefined,
        uniformScore: typeof params.uniformScore === 'number' ? params.uniformScore : undefined,
        memorizationScore: typeof params.memorizationScore === 'number' ? params.memorizationScore : undefined,
        revisionScore: typeof params.revisionScore === 'number' ? params.revisionScore : undefined,
        familyMeetingScore: params.familyMeetingScore ?? 2,
        totalPoints,
        pointsAwarded: totalPoints,
        notes: params.notes,
        recordedBy: params.teacherName,
        teacherId: params.teacherId,
        timestamp: new Date().toISOString(),
      };
      evals.unshift(evalRecord);
    }

    saveItem(STORAGE_KEYS.EVALUATIONS, evals);
    syncToFirestore('evaluations', evalRecord);

    // Consolidate all evaluation transactions for this student and date into EXACTLY ONE transaction
    const transactions = this.getTransactions();
    const isThisDailyEvalTx = (t: PointTransaction) =>
      t.studentId === student.id &&
      (t.idempotencyKey === `daily_eval_${student.id}_${params.date}` ||
       t.idempotencyKey?.startsWith(`student_${student.id}:${params.date}:daily_eval`) ||
       (t.date === params.date && (t.reason.startsWith('تقييم يوم') || t.reason.startsWith('إلغاء وحذف تقييم يوم'))));

    const oldEvalTxs = transactions.filter(isThisDailyEvalTx);
    const oldRecordedPoints = oldEvalTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const netPointsDelta = totalPoints - oldRecordedPoints;

    const attendanceLabel =
      params.attendance === 'early' ? 'مبكر (2ن)' : params.attendance === 'late' ? 'متأخر (1ن)' : params.attendance === 'absent' ? 'غائب (0ن)' : 'لم يُرصد';
    const cleanReason = `تقييم يوم ${accurateDayName} (${params.date}): حضور ${attendanceLabel}، حفظ ${params.memorizationScore ?? '-'}ن، مراجعة ${params.revisionScore ?? '-'}ن، انضباط ${params.disciplineScore ?? '-'}ن، زي ${params.uniformScore ?? '-'}ن`;

    // Filter out old evaluation transactions to replace them with 1 clean consolidated transaction
    const remainingTxs = transactions.filter((t) => !isThisDailyEvalTx(t));

    // Delete old intermediate transactions from Firestore
    oldEvalTxs.forEach((t) => {
      deleteFromFirestore('transactions', t.id);
    });

    if (totalPoints > 0) {
      const consolidatedTx: PointTransaction = {
        id: oldEvalTxs[0]?.id || `tx_eval_${student.id}_${params.date}`,
        studentId: student.id,
        studentName: student.name,
        amount: totalPoints,
        type: 'memorization',
        reason: cleanReason,
        date: params.date,
        createdBy: params.teacherName,
        createdByRole: 'teacher',
        idempotencyKey: `daily_eval_${student.id}_${params.date}`,
      };
      remainingTxs.unshift(consolidatedTx);
      syncToFirestore('transactions', consolidatedTx);
    }

    saveItem(STORAGE_KEYS.TRANSACTIONS, remainingTxs);

    // Calculate new current points for student directly from ledger
    const studentTotalPoints = remainingTxs
      .filter((t) => t.studentId === student.id && typeof t.amount === 'number')
      .reduce((sum, t) => sum + t.amount, 0);

    const freshStudents = loadItem<Student[]>(STORAGE_KEYS.STUDENTS, INITIAL_STUDENTS);
    const sIdx = freshStudents.findIndex((s) => s.id === params.studentId);
    if (sIdx >= 0) {
      freshStudents[sIdx].currentPoints = Math.max(0, studentTotalPoints);
      if (params.attendance !== 'absent' && params.attendance) {
        freshStudents[sIdx].streakDays = (freshStudents[sIdx].streakDays || 0) + 1;
        freshStudents[sIdx].consecutiveAbsences = 0;
      } else if (params.attendance === 'absent') {
        freshStudents[sIdx].streakDays = 0;
        freshStudents[sIdx].consecutiveAbsences = (freshStudents[sIdx].consecutiveAbsences || 0) + 1;
        if (freshStudents[sIdx].consecutiveAbsences >= 3) {
          freshStudents[sIdx].attentionReason = `غياب متكرر (${freshStudents[sIdx].consecutiveAbsences} أيام متتالية)`;
        }
      }
      freshStudents[sIdx].daysWithoutLog = 0;
      freshStudents[sIdx].lastActivityDate = params.date;
      const stats = this.getStudentAttendanceStats(freshStudents[sIdx].id);
      freshStudents[sIdx].attendanceRate = stats.attendanceRate;
      saveItem(STORAGE_KEYS.STUDENTS, freshStudents);
      syncToFirestore('students', freshStudents[sIdx]);
    }

    this.reconcileStudentPointsFromTransactions();
    notifySubscribers();
    return {
      success: true,
      message: `تم حفظ تقييم ${student.name} بنجاح (${totalPoints} من 10 نقاط)`,
      record: evalRecord,
      deltaPoints: netPointsDelta,
    };
  }

  deleteDailyEvaluation(params: {
    studentId: string;
    date: string;
    teacherName?: string;
  }): { success: boolean; message: string; deletedRecord?: EvaluationRecord } {
    const evals = this.getEvaluationsList();
    const toDelete = evals.filter((e) => e.studentId === params.studentId && e.date === params.date);
    const remainingEvals = evals.filter((e) => !(e.studentId === params.studentId && e.date === params.date));
    const old = toDelete[0];
    if (toDelete.length > 0) {
      saveItem(STORAGE_KEYS.EVALUATIONS, remainingEvals);
      toDelete.forEach((oldRec) => {
        deleteFromFirestore('evaluations', oldRec.id);
        deletedDocIds.add(oldRec.id);
      });
    }

    // Cleanly remove any evaluation transactions for this date and deduct points
    const transactions = this.getTransactions();
    const isThisDailyEvalTx = (t: PointTransaction) =>
      t.studentId === params.studentId &&
      (t.idempotencyKey === `daily_eval_${params.studentId}_${params.date}` ||
       t.idempotencyKey?.startsWith(`student_${params.studentId}:${params.date}:daily_eval`) ||
       (t.date === params.date && (t.reason?.startsWith('تقييم يوم') || t.reason?.startsWith('إلغاء وحذف تقييم يوم') || t.idempotencyKey?.includes('daily_eval'))));

    const oldEvalTxs = transactions.filter(isThisDailyEvalTx);
    const remainingTxs = transactions.filter((t) => !isThisDailyEvalTx(t));
    oldEvalTxs.forEach((t) => {
      deleteFromFirestore('transactions', t.id);
      deletedDocIds.add(t.id);
    });
    saveItem(STORAGE_KEYS.TRANSACTIONS, remainingTxs);

    // Calculate new current points for student directly from ledger
    const studentTotalPoints = remainingTxs
      .filter((t) => t.studentId === params.studentId && typeof t.amount === 'number')
      .reduce((sum, t) => sum + t.amount, 0);

    const freshStudents = loadItem<Student[]>(STORAGE_KEYS.STUDENTS, INITIAL_STUDENTS);
    const sIdx = freshStudents.findIndex((s) => s.id === params.studentId);
    if (sIdx >= 0) {
      freshStudents[sIdx].currentPoints = Math.max(0, studentTotalPoints);
      const stats = this.getStudentAttendanceStats(freshStudents[sIdx].id);
      freshStudents[sIdx].attendanceRate = stats.attendanceRate;
      saveItem(STORAGE_KEYS.STUDENTS, freshStudents);
      syncToFirestore('students', freshStudents[sIdx]);
    }

    this.reconcileStudentPointsFromTransactions();
    notifySubscribers();
    return { success: true, message: 'تم إلغاء التقييم ومزامنة النقاط بنجاح', deletedRecord: old };
  }

  getEvaluationForStudentAndDate(studentId: string, date: string): EvaluationRecord | undefined {
    const evals = this.getEvaluationsList();
    return evals.find((e) => e.studentId === studentId && e.date === date);
  }

  getEvaluationsForCircleAndDate(circleId: string, date: string): EvaluationRecord[] {
    const evals = this.getEvaluationsList();
    return evals.filter((e) => e.circleId === circleId && e.date === date);
  }

  getEvaluationsForCircleAndWeek(circleId: string, weekDates: string[]): EvaluationRecord[] {
    const evals = this.getEvaluationsList();
    const datesSet = new Set(weekDates);
    return evals.filter((e) => e.circleId === circleId && datesSet.has(e.date));
  }

  // Rewards & Redemptions
  getRewards(): Reward[] {
    return loadItem<Reward[]>(STORAGE_KEYS.REWARDS, INITIAL_REWARDS);
  }

  getRewardById(id: string): Reward | undefined {
    return this.getRewards().find((r) => r.id === id);
  }

  saveReward(reward: Reward, actor: { id: string; name: string; role: Role }): void {
    const rewards = this.getRewards();
    const idx = rewards.findIndex((r) => r.id === reward.id);
    const isNew = idx === -1;
    if (isNew) {
      rewards.push(reward);
    } else {
      rewards[idx] = reward;
    }
    saveItem(STORAGE_KEYS.REWARDS, rewards);
    syncToFirestore('rewards', reward);

    this.addAuditLog({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: isNew ? 'إضافة مكافأة جديدة' : 'تحديث مكافأة',
      details: `${reward.title} (${reward.costPoints} نقطة - متبقي ${reward.remainingQuantity})`,
      targetType: 'reward',
      targetId: reward.id,
    });

    notifySubscribers();
  }

  deleteReward(id: string, actor: { id: string; name: string; role: Role }): void {
    const rewards = this.getRewards();
    const reward = rewards.find((r) => r.id === id);
    deletedDocIds.add(id);
    const filtered = rewards.filter((r) => r.id !== id);
    saveItem(STORAGE_KEYS.REWARDS, filtered);
    deleteFromFirestore('rewards', id);

    this.addAuditLog({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'حذف مكافأة',
      details: `تم حذف المكافأة ${reward?.title || id}`,
      targetType: 'reward',
      targetId: id,
    });

    notifySubscribers();
  }

  toggleRewardAvailable(id: string, actor: { id: string; name: string; role: Role }): void {
    const rewards = this.getRewards();
    const reward = rewards.find((r) => r.id === id);
    if (!reward) return;

    reward.available = !reward.available;
    saveItem(STORAGE_KEYS.REWARDS, rewards);
    syncToFirestore('rewards', reward);

    this.addAuditLog({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: reward.available ? 'تفعيل استرداد مكافأة' : 'تعطيل استرداد مكافأة',
      details: `${reward.title}`,
      targetType: 'reward',
      targetId: id,
    });

    notifySubscribers();
  }

  getRedemptionRequests(filter?: { studentId?: string; status?: string }): RedemptionRequest[] {
    let requests = loadItem<RedemptionRequest[]>(STORAGE_KEYS.REDEMPTIONS, INITIAL_REDEMPTION_REQUESTS);
    if (filter?.studentId) {
      requests = requests.filter((r) => r.studentId === filter.studentId);
    }
    if (filter?.status && filter.status !== 'all') {
      requests = requests.filter((r) => r.status === filter.status);
    }
    return requests;
  }

  createRedemptionRequest(
    studentId: string,
    rewardId: string
  ): { success: boolean; message: string; request?: RedemptionRequest } {
    const students = this.getStudents();
    const student = students.find((s) => s.id === studentId);
    if (!student) return { success: false, message: 'الطالب غير موجود' };

    const rewards = this.getRewards();
    const reward = rewards.find((r) => r.id === rewardId);
    if (!reward) return { success: false, message: 'المكافأة غير موجودة' };

    if (!reward.available || reward.remainingQuantity <= 0) {
      return { success: false, message: 'عذراً، هذه المكافأة غير متاحة حالياً أو نفدت الكمية.' };
    }

    if (student.currentPoints < reward.costPoints) {
      return {
        success: false,
        message: `نقاطك غير كافية لاسترداد ${reward.title}. تحتاج ${reward.costPoints} نقطة ورصيدك الحالي ${student.currentPoints} نقطة.`,
      };
    }

    const txResult = this.addPointTransaction({
      studentId: student.id,
      amount: -reward.costPoints,
      type: 'reward_redemption',
      reason: `استرداد مكافأة: ${reward.title}`,
      createdBy: student.name,
      createdByRole: 'student',
    });

    if (!txResult.success) {
      return { success: false, message: txResult.message };
    }

    reward.remainingQuantity = Math.max(0, reward.remainingQuantity - 1);
    saveItem(STORAGE_KEYS.REWARDS, rewards);
    syncToFirestore('rewards', reward);

    const circle = this.getCircleById(student.circleId);
    const request: RedemptionRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      studentId: student.id,
      studentName: student.name,
      circleName: circle?.name || 'حلقة القرآن',
      rewardId: reward.id,
      rewardTitle: reward.title,
      rewardCost: reward.costPoints,
      rewardEmoji: reward.emoji,
      status: 'pending',
      requestDate: new Date().toISOString(),
    };

    const requests = this.getRedemptionRequests();
    requests.unshift(request);
    saveItem(STORAGE_KEYS.REDEMPTIONS, requests);
    syncToFirestore('redemptions', request);

    notifySubscribers();
    return {
      success: true,
      message: `تم إرسال طلب استرداد ${reward.title} بنجاح! رصيدك المتبقي: ${student.currentPoints} نقطة.`,
      request,
    };
  }

  updateRedemptionStatus(params: {
    requestId: string;
    status: RedemptionRequest['status'];
    handledBy: string;
    rejectionReason?: string;
    refundPoints?: boolean;
  }): { success: boolean; message: string } {
    const requests = this.getRedemptionRequests();
    const reqIndex = requests.findIndex((r) => r.id === params.requestId);
    if (reqIndex === -1) return { success: false, message: 'طلب الاسترداد غير موجود' };

    const req = requests[reqIndex];
    req.status = params.status;
    req.handledBy = params.handledBy;
    req.updatedDate = new Date().toISOString();

    if (params.rejectionReason) {
      req.rejectionReason = params.rejectionReason;
    }

    if (params.status === 'rejected' && params.refundPoints && !req.refunded) {
      const student = this.getStudentById(req.studentId);
      if (student) {
        this.addPointTransaction({
          studentId: student.id,
          amount: req.rewardCost,
          type: 'refund',
          reason: `استرجاع نقاط طلب مرفوض: ${req.rewardTitle}${params.rejectionReason ? ` (${params.rejectionReason})` : ''}`,
          createdBy: params.handledBy,
          createdByRole: 'supervisor',
        });
        req.refunded = true;

        const rewards = this.getRewards();
        const rIdx = rewards.findIndex((r) => r.id === req.rewardId);
        if (rIdx >= 0) {
          rewards[rIdx].remainingQuantity += 1;
          saveItem(STORAGE_KEYS.REWARDS, rewards);
          syncToFirestore('rewards', rewards[rIdx]);
        }
      }
    }

    requests[reqIndex] = req;
    saveItem(STORAGE_KEYS.REDEMPTIONS, requests);
    syncToFirestore('redemptions', req);

    this.addAuditLog({
      actorId: params.handledBy,
      actorName: params.handledBy,
      actorRole: 'supervisor',
      action: `تحديث طلب استرداد إلى (${params.status === 'approved' ? 'مقبول' : params.status === 'delivered' ? 'تم التسليم' : 'مرفوض'})`,
      details: `طلب ${req.rewardTitle} للطالب ${req.studentName} [${req.rewardCost} نقطة]${req.refunded ? ' - تمت إعادة النقاط' : ''}`,
      targetType: 'redemption',
      targetId: req.id,
    });

    notifySubscribers();
    return {
      success: true,
      message: `تم تحديث حالة الطلب إلى "${params.status === 'approved' ? 'تمت الموافقة' : params.status === 'delivered' ? 'تم التسليم' : 'مرفوض'}" بنجاح.`,
    };
  }

  deleteRedemptionRequest(requestId: string, handledBy?: string): { success: boolean; message: string } {
    const requests = this.getRedemptionRequests();
    const req = requests.find((r) => r.id === requestId);
    if (!req) return { success: false, message: 'طلب المطالبة غير موجود' };

    // If pending and not refunded yet, return the points to the student upon deletion
    if (req.status === 'pending' && !req.refunded) {
      const students = this.getStudents();
      const student = students.find((s) => s.id === req.studentId);
      if (student) {
        this.addPointTransaction({
          studentId: student.id,
          amount: req.rewardCost,
          type: 'refund',
          reason: `إلغاء وحذف طلب مكافأة: ${req.rewardTitle} (إعادة ${req.rewardCost} نقطة)`,
          createdBy: handledBy || 'المشرف',
          createdByRole: 'supervisor',
        });
      }
    }

    const filtered = requests.filter((r) => r.id !== requestId);
    saveItem(STORAGE_KEYS.REDEMPTIONS, filtered);
    deleteFromFirestore('redemptions', requestId);
    deletedDocIds.add(requestId);

    this.addAuditLog({
      actorId: handledBy || 'supervisor',
      actorName: handledBy || 'المشرف',
      actorRole: 'supervisor',
      action: 'حذف طلب استرداد',
      details: `تم حذف طلب ${req.rewardTitle} للطالب ${req.studentName} من سجل وتاريخ المطالبات`,
      targetType: 'redemption',
      targetId: req.id,
    });

    notifySubscribers();
    return { success: true, message: 'تم حذف المطالبة من السجل بنجاح' };
  }

  // Exam Nominations (ترشيح للاختبار)
  getExamNominations(filter?: { circleId?: string; status?: string; studentId?: string }): ExamNomination[] {
    let list = loadItem<ExamNomination[]>(STORAGE_KEYS.EXAM_NOMINATIONS, []);
    if (filter?.circleId && filter.circleId !== 'all') {
      list = list.filter((n) => n.circleId === filter.circleId);
    }
    if (filter?.status && filter.status !== 'all') {
      list = list.filter((n) => n.status === filter.status);
    }
    if (filter?.studentId) {
      list = list.filter((n) => n.studentId === filter.studentId);
    }
    return list;
  }

  createExamNominations(
    nominations: Array<{
      studentId: string;
      studentName: string;
      circleId: string;
      circleName: string;
      teacherId: string;
      teacherName: string;
      partsCount: number;
      partsDescription?: string;
      notes?: string;
    }>
  ): { success: boolean; message: string; count: number } {
    if (!nominations || nominations.length === 0) {
      return { success: false, message: 'لم يتم تحديد أي طالب للترشيح', count: 0 };
    }

    const currentList = this.getExamNominations();
    const today = new Date().toISOString().split('T')[0];
    const nowIso = new Date().toISOString();

    const createdList: ExamNomination[] = [];

    nominations.forEach((item) => {
      const newNomination: ExamNomination = {
        id: `exam_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        studentId: item.studentId,
        studentName: item.studentName,
        circleId: item.circleId,
        circleName: item.circleName,
        teacherId: item.teacherId,
        teacherName: item.teacherName,
        partsCount: Math.max(1, item.partsCount),
        partsDescription: item.partsDescription?.trim() || undefined,
        notes: item.notes?.trim() || undefined,
        status: 'pending',
        requestDate: today,
        createdAt: nowIso,
      };

      createdList.push(newNomination);
      currentList.unshift(newNomination);
      syncToFirestore('exam_nominations', newNomination);

      this.addAuditLog({
        actorId: item.teacherId || 'teacher',
        actorName: item.teacherName || 'معلم الحلقة',
        actorRole: 'teacher',
        action: 'ترشيح للاختبار',
        details: `ترشيح الطالب ${item.studentName} لاختبار (${item.partsDescription || `${item.partsCount} أجزاء`}) من قِبل ${item.teacherName}`,
        targetType: 'student',
        targetId: item.studentId,
      });
    });

    saveItem(STORAGE_KEYS.EXAM_NOMINATIONS, currentList);
    notifySubscribers();

    return {
      success: true,
      message: `تم إرسال ترشيح ${nominations.length} ${nominations.length === 1 ? 'طالب' : 'طلاب'} للاختبار بنجاح إلى المشرف العام.`,
      count: nominations.length,
    };
  }

  updateExamNominationStatus(params: {
    nominationId: string;
    status: ExamNominationStatus;
    handledBy: string;
    cancellationReason?: string;
  }): { success: boolean; message: string } {
    const list = this.getExamNominations();
    const idx = list.findIndex((n) => n.id === params.nominationId);
    if (idx === -1) {
      return { success: false, message: 'طلب الترشيح غير موجود' };
    }

    const item = list[idx];
    item.status = params.status;
    item.handledBy = params.handledBy;
    item.updatedAt = new Date().toISOString();

    if (params.status === 'completed') {
      item.completedAt = new Date().toISOString();
    } else if (params.status === 'cancelled') {
      item.cancellationReason = params.cancellationReason?.trim() || 'تم الإلغاء من المشرف';
    }

    list[idx] = item;
    saveItem(STORAGE_KEYS.EXAM_NOMINATIONS, list);
    syncToFirestore('exam_nominations', item);

    this.addAuditLog({
      actorId: params.handledBy,
      actorName: params.handledBy,
      actorRole: 'supervisor',
      action: params.status === 'completed' ? 'اعتماد إتمام الاختبار' : 'إلغاء ترشيح الاختبار',
      details: `طلب اختبار الطالب ${item.studentName} (${item.partsDescription || `${item.partsCount} أجزاء`}) - الحالة: ${params.status === 'completed' ? 'تم الاختبار' : 'ملغي'}`,
      targetType: 'student',
      targetId: item.studentId,
    });

    notifySubscribers();

    const statusText = params.status === 'completed' ? 'تم الاختبار بنجاح' : 'تم إلغاء الطلب';
    return {
      success: true,
      message: `تم تحديث حالة ترشيح الطالب ${item.studentName} إلى (${statusText}) ✓`,
    };
  }

  deleteExamNomination(nominationId: string, handledBy?: string): { success: boolean; message: string } {
    const list = this.getExamNominations();
    const item = list.find((n) => n.id === nominationId);
    if (!item) {
      return { success: false, message: 'طلب الترشيح غير موجود' };
    }

    const filtered = list.filter((n) => n.id !== nominationId);
    saveItem(STORAGE_KEYS.EXAM_NOMINATIONS, filtered);
    deleteFromFirestore('exam_nominations', nominationId);
    deletedDocIds.add(nominationId);

    this.addAuditLog({
      actorId: handledBy || 'supervisor',
      actorName: handledBy || 'المشرف',
      actorRole: 'supervisor',
      action: 'حذف ترشيح اختبار',
      details: `تم حذف ترشيح اختبار الطالب ${item.studentName} (${item.partsDescription || `${item.partsCount} أجزاء`}) من السجل`,
      targetType: 'student',
      targetId: item.studentId,
    });

    notifySubscribers();
    return {
      success: true,
      message: `تم حذف طلب اختبار الطالب ${item.studentName} من السجل بنجاح ✓`,
    };
  }

  // Rules
  getPointRules(): PointRules {
    return loadItem<PointRules>(STORAGE_KEYS.RULES, INITIAL_POINT_RULES);
  }

  updatePointRules(rules: PointRules, actor: { id: string; name: string; role: Role }): void {
    saveItem(STORAGE_KEYS.RULES, rules);
    syncToFirestore('rules', { id: 'default_rules', ...rules });

    this.addAuditLog({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'تعديل قواعد النقاط',
      details: `حضور: ${rules.attendance}ن، حفظ كامل: ${rules.memorizationFull}ن، مراجعة: ${rules.revisionFull}ن`,
      targetType: 'settings',
    });

    notifySubscribers();
  }

  // Audit Logs & Achievements
  getAuditLogs(): AuditLog[] {
    return loadItem<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS);
  }

  addAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>): void {
    const logs = this.getAuditLogs();
    const newLog: AuditLog = {
      ...log,
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
    };
    logs.unshift(newLog);
    if (logs.length > 150) logs.pop();
    saveItem(STORAGE_KEYS.AUDIT_LOGS, logs);
    syncToFirestore('audit_logs', newLog);
  }

  deleteAuditLog(logId: string): { success: boolean; message: string } {
    const logs = this.getAuditLogs();
    const filtered = logs.filter((l) => l.id !== logId);
    saveItem(STORAGE_KEYS.AUDIT_LOGS, filtered);
    deleteFromFirestore('audit_logs', logId);
    deletedDocIds.add(logId);
    notifySubscribers();
    return { success: true, message: 'تم حذف السجل بنجاح' };
  }

  clearAllAuditLogs(): { success: boolean; message: string } {
    const logs = this.getAuditLogs();
    logs.forEach((l) => {
      deleteFromFirestore('audit_logs', l.id);
      deletedDocIds.add(l.id);
    });
    saveItem(STORAGE_KEYS.AUDIT_LOGS, []);
    notifySubscribers();
    return { success: true, message: 'تم مسح كامل سجل العمليات بنجاح' };
  }

  getAchievements(studentId?: string): Achievement[] {
    const base = loadItem<Achievement[]>(STORAGE_KEYS.ACHIEVEMENTS, INITIAL_ACHIEVEMENTS);
    if (!studentId) return base;

    const student = this.getStudentById(studentId);
    if (!student) return base;

    const stats = this.getStudentAttendanceStats(student.id);
    // Student can only qualify for streak badges if they have recorded attendance sessions and reached the required streak
    const effectiveStreak = stats.hasRecords ? Math.max(student.streakDays || 0, stats.maxStreakDays || 0) : 0;

    return base.map((ach) => {
      let isUnlocked = false;
      let currentValue: number | undefined = undefined;

      if (ach.requiredPoints) {
        currentValue = student.currentPoints;
        if (student.currentPoints >= ach.requiredPoints) {
          isUnlocked = true;
        }
      } else if (ach.requiredStreak) {
        currentValue = effectiveStreak;
        if (effectiveStreak >= ach.requiredStreak) {
          isUnlocked = true;
        }
      }

      if (ach.code === 'first_100') {
        currentValue = student.currentPoints;
        if (student.currentPoints >= 100) {
          isUnlocked = true;
        }
      }

      return {
        ...ach,
        currentValue,
        unlockedAt: isUnlocked ? (ach.unlockedAt || new Date().toISOString().split('T')[0]) : undefined,
      };
    });
  }

  // Support Tickets (الدعم الفني)
  getSupportTickets(): SupportTicket[] {
    const list = loadItem<SupportTicket[]>(STORAGE_KEYS.SUPPORT_TICKETS, []);
    let modified = false;
    list.forEach((t) => {
      if (!t.priority) {
        if (t.senderRole === 'supervisor' || t.senderRole === 'teacher' || t.senderRole === 'admin') {
          t.priority = 'high';
        } else if (t.senderRole === 'student') {
          t.priority = t.ticketType === 'مشكلة' ? 'medium' : 'low';
        } else {
          t.priority = 'medium';
        }
        modified = true;
      }
    });
    if (modified) {
      saveItem(STORAGE_KEYS.SUPPORT_TICKETS, list);
    }
    return list;
  }

  createSupportTicket(params: Omit<SupportTicket, 'id' | 'createdAt' | 'status' | 'priority'> & { priority?: SupportTicketPriority }): {
    success: boolean;
    message: string;
    ticket: SupportTicket;
  } {
    const list = this.getSupportTickets();

    // Auto-calculate priority based on system rules:
    // مدير المجمع أو المعلمين -> أولوية عالية (high)
    // الطلاب -> أولوية متوسطة (medium) إذا مشكلة، أو منخفضة (low) للاقتراحات والاستفسارات
    let calculatedPriority: SupportTicketPriority = params.priority || 'medium';
    if (!params.priority) {
      if (params.senderRole === 'supervisor' || params.senderRole === 'teacher' || params.senderRole === 'admin') {
        calculatedPriority = 'high';
      } else if (params.senderRole === 'student') {
        calculatedPriority = params.ticketType === 'مشكلة' ? 'medium' : 'low';
      } else {
        calculatedPriority = 'medium';
      }
    }

    const newTicket: SupportTicket = {
      ...params,
      priority: calculatedPriority,
      id: `ticket_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString(),
      status: 'new',
    };
    list.unshift(newTicket);
    saveItem(STORAGE_KEYS.SUPPORT_TICKETS, list);
    syncToFirestore('support_tickets', newTicket);

    this.addAuditLog({
      actorId: params.senderId || 'guest',
      actorName: params.senderName,
      actorRole: (params.senderRole as Role) || 'student',
      action: 'إرسال تذكرة دعم فني',
      details: `تذكرة [أولوية ${calculatedPriority === 'high' ? 'عالية' : calculatedPriority === 'medium' ? 'متوسطة' : 'منخفضة'}] [${params.ticketType}]: ${params.message.slice(0, 50)}...`,
      targetType: 'settings',
      targetId: newTicket.id,
    });

    notifySubscribers();
    return {
      success: true,
      message: 'تم إرسال تذكرة الدعم الفني بنجاح',
      ticket: newTicket,
    };
  }

  updateSupportTicket(
    ticketId: string,
    updates: Partial<Pick<SupportTicket, 'priority' | 'status'>>
  ): { success: boolean; message: string } {
    const list = this.getSupportTickets();
    const idx = list.findIndex((t) => t.id === ticketId);
    if (idx === -1) return { success: false, message: 'التذكرة غير موجودة' };

    list[idx] = { ...list[idx], ...updates };
    saveItem(STORAGE_KEYS.SUPPORT_TICKETS, list);
    syncToFirestore('support_tickets', list[idx]);
    notifySubscribers();
    return { success: true, message: 'تم تحديث التذكرة بنجاح' };
  }

  deleteSupportTicket(ticketId: string): { success: boolean; message: string } {
    const list = this.getSupportTickets();
    const filtered = list.filter((t) => t.id !== ticketId);
    saveItem(STORAGE_KEYS.SUPPORT_TICKETS, filtered);
    deleteFromFirestore('support_tickets', ticketId);
    deletedDocIds.add(ticketId);
    notifySubscribers();
    return { success: true, message: 'تم حذف التذكرة بنجاح' };
  }

  resetToDefaults(): void {
    localStorage.removeItem(STORAGE_KEYS.STUDENTS);
    localStorage.removeItem(STORAGE_KEYS.CIRCLES);
    localStorage.removeItem(STORAGE_KEYS.TEACHERS);
    localStorage.removeItem(STORAGE_KEYS.TRANSACTIONS);
    localStorage.removeItem(STORAGE_KEYS.REWARDS);
    localStorage.removeItem(STORAGE_KEYS.REDEMPTIONS);
    localStorage.removeItem(STORAGE_KEYS.ATTENDANCE);
    localStorage.removeItem(STORAGE_KEYS.EVALUATIONS);
    localStorage.removeItem(STORAGE_KEYS.RULES);
    localStorage.removeItem(STORAGE_KEYS.AUDIT_LOGS);
    localStorage.removeItem(STORAGE_KEYS.ACHIEVEMENTS);
    localStorage.removeItem(STORAGE_KEYS.SUPPORT_TICKETS);
    notifySubscribers();
  }
}

// Singleton repository instance connected to Firebase
export const repository: IRepository = new FirestoreConnectedRepository();

/**
 * Helper to determine a student's attendance classification for a specific evaluation record:
 * - 2 points (or 'early') -> حاضر (+2)
 * - 1 point (or 'late') -> حاضر (+1)
 * - 0 points (or 'absent') -> غائب (0)
 * - No record -> بانتظار الرصد
 */
export function getStudentDayAttendance(evalRecord?: EvaluationRecord | null): {
  status: 'present' | 'absent' | 'not_recorded';
  points: number | null;
  label: string;
  badgeClass: string;
  detailLabel: string;
} {
  if (!evalRecord) {
    return {
      status: 'not_recorded',
      points: null,
      label: 'بانتظار الرصد',
      badgeClass: 'bg-slate-100 text-slate-500 border-slate-200 font-bold',
      detailLabel: 'لم يتم الرصد لهذا اليوم بعد',
    };
  }

  const att = evalRecord.attendance;
  const pts =
    typeof evalRecord.attendancePoints === 'number'
      ? evalRecord.attendancePoints
      : att === 'early' || (att as any) === 2 || (att as any) === '2'
      ? 2
      : att === 'late' || (att as any) === 1 || (att as any) === '1'
      ? 1
      : 0;

  if (pts === 2 || att === 'early') {
    return {
      status: 'present',
      points: 2,
      label: 'حاضر (2ن)',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-black',
      detailLabel: 'حاضر (مبكر - 2 درجات)',
    };
  }

  if (pts === 1 || att === 'late') {
    return {
      status: 'present',
      points: 1,
      label: 'حاضر (1ن)',
      badgeClass: 'bg-teal-50 text-teal-800 border-teal-300 font-black',
      detailLabel: 'حاضر (متأخر - 1 درجة)',
    };
  }

  return {
    status: 'absent',
    points: 0,
    label: 'غائب (0ن)',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-300 font-black',
    detailLabel: 'غائب (0 درجات)',
  };
}
