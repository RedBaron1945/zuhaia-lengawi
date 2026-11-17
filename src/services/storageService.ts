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
  SupportTicketPriority,
  SupportTicketReply,
  User,
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
  getDocs,
  onSnapshotsInSync,
  query,
  where,
  orderBy,
  limit,
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
  STATIC_CACHE_META: 'tartil_static_cache_meta_v1',
  SESSION_OWNER: 'tartil_session_owner_v1',
  DELETED_STUDENTS: 'tartil_deleted_students_v1',
};

const CIRCLES_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const TEACHERS_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const REWARDS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const AUDIT_LOGS_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

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

function computeStudentBalancesMap(transactions: PointTransaction[]): Map<string, number> {
  const byStudent = new Map<string, PointTransaction[]>();
  transactions.forEach((tx) => {
    if (tx.studentId && typeof tx.amount === 'number') {
      const list = byStudent.get(tx.studentId);
      if (list) list.push(tx);
      else byStudent.set(tx.studentId, [tx]);
    }
  });

  const balances = new Map<string, number>();
  byStudent.forEach((txs, studentId) => {
    const sorted = [...txs].sort((a, b) => {
      const da = (a.date || '').split('T')[0];
      const db = (b.date || '').split('T')[0];
      if (da !== db) return da.localeCompare(db);
      return (b.amount || 0) - (a.amount || 0);
    });
    let balance = 0;
    for (const tx of sorted) {
      balance = Math.max(0, balance + tx.amount);
    }
    balances.set(studentId, balance);
  });

  return balances;
}

// Helper to strip undefined values so Firestore setDoc never throws Unsupported field value: undefined
function sanitizeForFirestore<T>(data: T): Record<string, any> {
  return JSON.parse(JSON.stringify(data));
}

// In-memory cache of synced items to eliminate redundant writes and downstream read cycles
const syncedHashes = new Map<string, string>();
const HARD_DELETED_SEED_STUDENT_IDS = [
  'umJD21AJBZfD8d4HapZdLR4izc92',
  '8g9oEJRdqsaNGJfoClzQ5ofYM8o2',
  '4ipFtSNlHdhOieigmbpJodTn2Gx2',
  'P2HiDOdD6qVQl8j7owLyZ7b0VRA2',
  'NJ41NTvoclPTPTnK0kPoDXyKQAP2',
  'qgsb2sYahucl4SmMS52uz487Wb02',
  'orS9AoCDxBN6grKkW0lvRz9C1fy1',
  'Bh2QqE4z27OffMlP7QHEnH0sKm43',
  '2D6GLrJPPCQXxAw5Ao4R2ZiBpUt2',
  'eqqlscRwHAbrK95fDrMeBB97yfo2',
  'wfn1G1thBGSBTwJoHnmr9RmnV822',
  'ZRSlMQDEnJfFRDB98zXQfyDfEEo1',
  '13BCdtkYC6cbH7j4aTpM8K2y76p1',
  'C2EWxvorywhXTJEpLle1HDp2i2J3',
  'r5cBXITYHWTCOLOOI3ZkVeLiLLh1',
  '7tYRaNNqOOelC1mYdvp1OU3sgnC3',
  'UIBS5OqSnpfhspNksObBkG39RaI3',
  'XIZl3ZMAEMZh0ytrzzE6YcpAN7Y2',
  'aD5vkvAyqMb3ExSiA5rJRR0rRUr1',
  'R2xPHml7WBOePdEVHW4DhZShFMh2',
  '0fLTSHjk5LWU3QN9Q4LGbFhUvII3',
  'Wit3I25DpGS46JmAf8LlexHPW0I2',
  'MH5ytx1Do0YrouH3RruZCJ1w1qm1',
  'f3VdNZuRLjgtJ6OXtskUvAtiHuy2',
  'acsSfLFIU6bK2gwALaan91P0Ks12',
  'gSEAzNpm5FNjwNDGGANZbSqaGV22',
];
const deletedDocIds = new Set<string>([
  ...HARD_DELETED_SEED_STUDENT_IDS,
  ...(typeof localStorage !== 'undefined'
    ? loadItem<string[]>(STORAGE_KEYS.DELETED_STUDENTS, [])
    : []),
]);

function getPersistedDeletedStudentIds(): Set<string> {
  const saved = typeof localStorage !== 'undefined'
    ? loadItem<string[]>(STORAGE_KEYS.DELETED_STUDENTS, [])
    : [];
  const merged = new Set<string>([...HARD_DELETED_SEED_STUDENT_IDS, ...saved]);
  merged.forEach((id) => deletedDocIds.add(id));
  return merged;
}

function savePersistedDeletedStudentIds(ids: Set<string>): void {
  const arr = Array.from(ids);
  arr.forEach((id) => deletedDocIds.add(id));
  if (typeof localStorage !== 'undefined') {
    saveItem(STORAGE_KEYS.DELETED_STUDENTS, arr);
  }
}

async function syncDeletedStudentsTombstonesToFirestore(ids: Set<string>): Promise<void> {
  try {
    await setDoc(doc(db, 'rules', 'deleted_students'), {
      id: 'deleted_students',
      ids: Array.from(ids),
      updatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.warn('Firestore deleted_students tombstone sync notice:', err?.message || err);
  }
}

async function cascadeDeleteStudentInFirestore(studentId: string): Promise<void> {
  const studentChildCollections = [
    'transactions',
    'evaluations',
    'attendance',
    'redemptions',
    'exam_nominations',
  ];

  await Promise.all(
    studentChildCollections.map(async (colName) => {
      try {
        const snap = await getDocs(
          query(collection(db, colName), where('studentId', '==', studentId))
        );
        if (!snap.empty) {
          await Promise.all(
            snap.docs.map(async (d) => {
              deletedDocIds.add(d.id);
              await deleteDoc(doc(db, colName, d.id));
            })
          );
        }
      } catch (err: any) {
        console.warn(`Cascade delete notice (${colName} for ${studentId}):`, err?.message || err);
      }
    })
  );
}

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

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
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
    await repository.refreshStaticCaches(true);
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
  getCirclesForTeacher(teacherId: string, fallbackCircleId?: string): Circle[];
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
      note?: string;
      actorId?: string;
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
  getEvaluationsForCircleAndDate(circleId: string | string[], date: string): EvaluationRecord[];
  getEvaluationsForCircleAndWeek(circleId: string | string[], weekDates: string[]): EvaluationRecord[];

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
  refreshAuditLogs(force?: boolean): Promise<void>;
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
  getSupportTicketsForUser(user: User): SupportTicket[];
  createSupportTicket(ticket: Omit<SupportTicket, 'id' | 'createdAt' | 'status' | 'priority'> & { priority?: SupportTicketPriority }): { success: boolean; message: string; ticket: SupportTicket };
  updateSupportTicket(ticketId: string, updates: Partial<Pick<SupportTicket, 'priority' | 'status'>>): { success: boolean; message: string };
  replyToSupportTicket(params: {
    ticketId: string;
    message: string;
    senderName: string;
    senderRole: Role;
    markResolved?: boolean;
  }): { success: boolean; message: string; ticket?: SupportTicket };
  markSupportTicketAsRead(ticketId: string): { success: boolean };
  closeSupportTicket(ticketId: string): Promise<{ success: boolean; message: string }>;
  deleteSupportTicket(ticketId: string): Promise<{ success: boolean; message: string }>;

  // Session & Cache Control
  setSessionUser(user: User | null): void;
  refreshStaticCaches(force?: boolean): Promise<void>;
  lookupUserByEmail(email: string): Promise<User | null>;

  // Reset
  resetToDefaults(): void;
}

class FirestoreConnectedRepository implements IRepository {
  private unsubscribers: (() => void)[] = [];
  private activeSessionKey: string | null = null;
  private activeUser: User | null = null;
  private ledgerScope: 'none' | 'student' | 'all' = 'none';
  private hasEvaluationsScope = false;
  private scopedStudentId: string | null = null;
  private scopedCircleId: string | null = null;
  private scopedCircleIds: Set<string> = new Set();
  private staticInFlight = new Map<string, Promise<void>>();

  constructor() {
    // 0 Firestore reads at module boot / LoginView — listeners and cached static fetches start only in setSessionUser()
    this.seedInitialDataIfEmpty();
  }

  private async seedInitialDataIfEmpty() {
    if (typeof localStorage === 'undefined') return;
    const SEED_KEY = 'tartil_firestore_seeded_zuhaia_v4';
    if (!localStorage.getItem(SEED_KEY)) {
      localStorage.setItem(SEED_KEY, 'true');
    }
  }

  private teardownListeners() {
    this.unsubscribers.forEach((unsub) => {
      try {
        unsub();
      } catch {
        // ignore unsubscribe errors
      }
    });
    this.unsubscribers = [];
  }

  private clearScopedRuntimeCaches() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.removeItem(STORAGE_KEYS.EVALUATIONS);
      localStorage.removeItem(STORAGE_KEYS.TRANSACTIONS);
      localStorage.removeItem(STORAGE_KEYS.REDEMPTIONS);
      localStorage.removeItem(STORAGE_KEYS.EXAM_NOMINATIONS);
      localStorage.removeItem(STORAGE_KEYS.SUPPORT_TICKETS);
      localStorage.removeItem(STORAGE_KEYS.AUDIT_LOGS);
      const meta = this.getStaticCacheMeta();
      if (meta.audit_logs) {
        delete meta.audit_logs;
        saveItem(STORAGE_KEYS.STATIC_CACHE_META, meta);
      }
    } catch {
      // ignore storage errors
    }
  }

  private getStaticCacheMeta(): Record<string, number> {
    return loadItem<Record<string, number>>(STORAGE_KEYS.STATIC_CACHE_META, {});
  }

  private markStaticCacheFresh(colName: 'circles' | 'teachers' | 'rewards') {
    const meta = this.getStaticCacheMeta();
    meta[colName] = Date.now();
    saveItem(STORAGE_KEYS.STATIC_CACHE_META, meta);
  }

  private async fetchStaticCollectionCached<T extends { id: string }>(options: {
    colName: 'circles' | 'teachers' | 'rewards';
    storageKey: string;
    ttlMs: number;
    force?: boolean;
  }): Promise<void> {
    const { colName, storageKey, ttlMs, force } = options;

    try {
      const meta = this.getStaticCacheMeta();
      const lastFetchedAt = meta[colName] || 0;
      const hasCachedPayload =
        typeof localStorage !== 'undefined' && Boolean(localStorage.getItem(storageKey));

      if (!force && hasCachedPayload && Date.now() - lastFetchedAt < ttlMs) {
        return;
      }

      const existingPromise = this.staticInFlight.get(colName);
      if (existingPromise && !force) {
        return existingPromise;
      }

      const fetchPromise = (async () => {
        try {
          const snapshot = await getDocs(collection(db, colName));
          if (!snapshot.empty) {
            const list: T[] = [];
            snapshot.forEach((d) => {
              const item = d.data() as T;
              if (item && item.id && !deletedDocIds.has(item.id)) {
                list.push(item);
              }
            });
            saveItem(storageKey, list);
            if (colName === 'circles') {
              this.recalculateCircleStudentCounts();
            }
            debouncedNotifySubscribers();
          }
          this.markStaticCacheFresh(colName);
        } catch (err: any) {
          console.warn(`Static cached fetch notice (${colName}):`, err?.message || err);
        } finally {
          this.staticInFlight.delete(colName);
        }
      })();

      this.staticInFlight.set(colName, fetchPromise);
      await fetchPromise;
    } catch (e) {
      console.warn(`Static fetch error (${colName}):`, e);
    }
  }

  private async syncDeletedStudentsFromFirestore(force = false): Promise<void> {
    try {
      const meta = this.getStaticCacheMeta();
      const lastFetchedAt = meta.deleted_students || 0;
      if (!force && Date.now() - lastFetchedAt < CIRCLES_CACHE_TTL_MS) {
        return;
      }

      const snap = await getDoc(doc(db, 'rules', 'deleted_students'));
      const merged = getPersistedDeletedStudentIds();
      if (snap.exists()) {
        const remoteIds = snap.data()?.ids;
        if (Array.isArray(remoteIds)) {
          remoteIds.forEach((id) => {
            if (typeof id === 'string' && id.trim()) {
              merged.add(id.trim());
            }
          });
        }
      }
      savePersistedDeletedStudentIds(merged);

      const students = loadItem<Student[]>(STORAGE_KEYS.STUDENTS, INITIAL_STUDENTS);
      const cleaned = students.filter((s) => !merged.has(s.id));
      if (cleaned.length !== students.length) {
        saveItem(STORAGE_KEYS.STUDENTS, cleaned);
        this.recalculateCircleStudentCounts();
        debouncedNotifySubscribers();
      }

      const nextMeta = this.getStaticCacheMeta();
      nextMeta.deleted_students = Date.now();

      // One-time admin cleanup to guarantee previously deleted seed students have zero orphan records in Firestore
      if (this.activeUser?.role === 'admin' && !nextMeta.hard_deleted_purge_v1) {
        nextMeta.hard_deleted_purge_v1 = Date.now();
        await Promise.all(
          HARD_DELETED_SEED_STUDENT_IDS.map(async (sid) => {
            deleteFromFirestore('students', sid);
            await cascadeDeleteStudentInFirestore(sid);
          })
        );
        await syncDeletedStudentsTombstonesToFirestore(merged);
      }

      saveItem(STORAGE_KEYS.STATIC_CACHE_META, nextMeta);
    } catch (err: any) {
      console.warn('Deleted students tombstone fetch notice:', err?.message || err);
    }
  }

  private async ensureLinkedSaeedStudentsInFirestore(): Promise<void> {
    try {
      const user = this.activeUser;
      if (!user) return;

      const meta = this.getStaticCacheMeta();
      if (meta.linked_saeed_students_v1) return;

      const LINKED_SAEED_STUDENT_IDS = [
        'WE8LIn7oK1VtUVeoUyiWMegiDXw2',
        'xU3gSqrjwSVxTdYag9KUHOPVmIg2',
      ];
      const activeStudentId = user.studentId || user.id;
      const isRelevantUser =
        user.role === 'admin' ||
        user.role === 'supervisor' ||
        (user.role === 'teacher' && normalizeCircleId(user.circleId || '') === 'circle_saeed') ||
        (user.role === 'student' && LINKED_SAEED_STUDENT_IDS.includes(activeStudentId));

      if (!isRelevantUser) return;

      const deletedIds = getPersistedDeletedStudentIds();
      const targetIds =
        user.role === 'student' ? [activeStudentId] : LINKED_SAEED_STUDENT_IDS;

      await Promise.all(
        targetIds.map(async (sid) => {
          if (deletedIds.has(sid)) return;
          const seed = INITIAL_STUDENTS.find((s) => s.id === sid);
          if (!seed) return;

          const studentRef = doc(db, 'students', sid);
          const snap = await getDoc(studentRef);
          if (!snap.exists()) {
            await setDoc(studentRef, sanitizeForFirestore(seed));
          } else {
            const data = snap.data() as Partial<Student> | undefined;
            if (normalizeCircleId(data?.circleId) !== 'circle_saeed' || !data?.name) {
              await setDoc(
                studentRef,
                {
                  circleId: 'circle_saeed',
                  ...(data?.name ? {} : { name: seed.name }),
                },
                { merge: true }
              );
            }
          }

          await setDoc(
            doc(db, 'users', sid),
            {
              id: sid,
              uid: sid,
              name: seed.name,
              role: 'student',
              studentId: sid,
              circleId: 'circle_saeed',
              createdAt: '2026-10-28T00:00:00Z',
            },
            { merge: true }
          );
        })
      );

      const nextMeta = this.getStaticCacheMeta();
      nextMeta.linked_saeed_students_v1 = Date.now();
      saveItem(STORAGE_KEYS.STATIC_CACHE_META, nextMeta);
      this.recalculateCircleStudentCounts();
      debouncedNotifySubscribers();
    } catch (err: any) {
      console.warn('Linked Saeed students sync notice:', err?.message || err);
    }
  }

  private async ensureLinkedOmarAliStudentsInFirestore(): Promise<void> {
    try {
      const user = this.activeUser;
      if (!user) return;

      const meta = this.getStaticCacheMeta();
      if (meta.linked_omar_ali_new_students_v1) return;

      const LINKED_TARGETS: Array<{ id: string; circleId: string }> = [
        { id: 'jIGLQ97INSNolwCkfDtSYFaGeyf2', circleId: 'circle_omar' },
        { id: 'kf8UnfcctYdRXZoLw4I4HvrRob62', circleId: 'circle_ali' },
      ];
      const activeStudentId = user.studentId || user.id;
      const teacherCircleIds = user.role === 'teacher' ? this.getTeacherCircleIds(user) : [];

      const relevantTargets =
        user.role === 'admin' || user.role === 'supervisor'
          ? LINKED_TARGETS
          : user.role === 'teacher'
          ? LINKED_TARGETS.filter((t) => teacherCircleIds.includes(t.circleId))
          : user.role === 'student'
          ? LINKED_TARGETS.filter((t) => t.id === activeStudentId)
          : [];

      if (relevantTargets.length === 0) return;

      const deletedIds = getPersistedDeletedStudentIds();
      const canWriteStudentDoc =
        user.role === 'admin' || user.role === 'supervisor' || user.role === 'teacher';
      const canWriteUserDoc =
        user.role === 'admin' || user.role === 'supervisor' || user.role === 'student';

      await Promise.all(
        relevantTargets.map(async ({ id: sid, circleId }) => {
          if (deletedIds.has(sid)) return;
          const seed = INITIAL_STUDENTS.find((s) => s.id === sid);
          if (!seed) return;

          if (canWriteStudentDoc) {
            const studentRef = doc(db, 'students', sid);
            const snap = await getDoc(studentRef);
            if (!snap.exists()) {
              await setDoc(studentRef, sanitizeForFirestore(seed));
            } else {
              const data = snap.data() as Partial<Student> | undefined;
              if (normalizeCircleId(data?.circleId) !== circleId || !data?.name) {
                await setDoc(
                  studentRef,
                  {
                    circleId,
                    ...(data?.name ? {} : { name: seed.name }),
                  },
                  { merge: true }
                );
              }
            }
          }

          if (canWriteUserDoc) {
            await setDoc(
              doc(db, 'users', sid),
              {
                id: sid,
                uid: sid,
                name: seed.name,
                role: 'student',
                studentId: sid,
                circleId,
                createdAt: '2026-10-28T00:00:00Z',
              },
              { merge: true }
            );
          }
        })
      );

      const nextMeta = this.getStaticCacheMeta();
      nextMeta.linked_omar_ali_new_students_v1 = Date.now();
      saveItem(STORAGE_KEYS.STATIC_CACHE_META, nextMeta);
      this.recalculateCircleStudentCounts();
      debouncedNotifySubscribers();
    } catch (err: any) {
      console.warn('Linked Omar/Ali new students sync notice:', err?.message || err);
    }
  }

  private async ensureLinkedAbbasStudentsInFirestore(): Promise<void> {
    try {
      const user = this.activeUser;
      if (!user) return;

      const meta = this.getStaticCacheMeta();
      if (meta.linked_abbas_new_students_v1) return;

      const LINKED_TARGETS: Array<{ id: string; circleId: string }> = [
        { id: 'AeighjzxKfO0Xmikbyx1ldn12rF2', circleId: 'circle_abbas' },
        { id: 'uROWzrTH6fTSaA8M5VmMOUAhEFE3', circleId: 'circle_abbas' },
      ];
      const activeStudentId = user.studentId || user.id;
      const teacherCircleIds = user.role === 'teacher' ? this.getTeacherCircleIds(user) : [];

      const relevantTargets =
        user.role === 'admin' || user.role === 'supervisor'
          ? LINKED_TARGETS
          : user.role === 'teacher'
          ? LINKED_TARGETS.filter((t) => teacherCircleIds.includes(t.circleId))
          : user.role === 'student'
          ? LINKED_TARGETS.filter((t) => t.id === activeStudentId)
          : [];

      if (relevantTargets.length === 0) return;

      const deletedIds = getPersistedDeletedStudentIds();
      const canWriteStudentDoc =
        user.role === 'admin' || user.role === 'supervisor' || user.role === 'teacher';
      const canWriteUserDoc =
        user.role === 'admin' || user.role === 'supervisor' || user.role === 'student';

      await Promise.all(
        relevantTargets.map(async ({ id: sid, circleId }) => {
          if (deletedIds.has(sid)) return;
          const seed = INITIAL_STUDENTS.find((s) => s.id === sid);
          if (!seed) return;

          if (canWriteStudentDoc) {
            const studentRef = doc(db, 'students', sid);
            const snap = await getDoc(studentRef);
            if (!snap.exists()) {
              await setDoc(studentRef, sanitizeForFirestore(seed));
            } else {
              const data = snap.data() as Partial<Student> | undefined;
              if (normalizeCircleId(data?.circleId) !== circleId || !data?.name) {
                await setDoc(
                  studentRef,
                  {
                    circleId,
                    ...(data?.name ? {} : { name: seed.name }),
                  },
                  { merge: true }
                );
              }
            }
          }

          if (canWriteUserDoc) {
            await setDoc(
              doc(db, 'users', sid),
              {
                id: sid,
                uid: sid,
                name: seed.name,
                role: 'student',
                studentId: sid,
                circleId,
                createdAt: '2026-10-28T00:00:00Z',
              },
              { merge: true }
            );
          }
        })
      );

      const nextMeta = this.getStaticCacheMeta();
      nextMeta.linked_abbas_new_students_v1 = Date.now();
      saveItem(STORAGE_KEYS.STATIC_CACHE_META, nextMeta);
      this.recalculateCircleStudentCounts();
      debouncedNotifySubscribers();
    } catch (err: any) {
      console.warn('Linked Abbas new students sync notice:', err?.message || err);
    }
  }

  private async ensureLinkedAliNewStudentInFirestore(): Promise<void> {
    try {
      const user = this.activeUser;
      if (!user) return;

      const meta = this.getStaticCacheMeta();
      if (meta.linked_ali_new_student_v2) return;

      const LINKED_TARGETS: Array<{ id: string; circleId: string }> = [
        { id: 'PQhWBDq8QSa8rAl2gf7NORBXBFL2', circleId: 'circle_ali' },
      ];
      const activeStudentId = user.studentId || user.id;
      const teacherCircleIds = user.role === 'teacher' ? this.getTeacherCircleIds(user) : [];

      const relevantTargets =
        user.role === 'admin' || user.role === 'supervisor'
          ? LINKED_TARGETS
          : user.role === 'teacher'
          ? LINKED_TARGETS.filter((t) => teacherCircleIds.includes(t.circleId))
          : user.role === 'student'
          ? LINKED_TARGETS.filter((t) => t.id === activeStudentId)
          : [];

      if (relevantTargets.length === 0) return;

      const deletedIds = getPersistedDeletedStudentIds();
      const canWriteStudentDoc =
        user.role === 'admin' || user.role === 'supervisor' || user.role === 'teacher';
      const canWriteUserDoc =
        user.role === 'admin' || user.role === 'supervisor' || user.role === 'student';

      await Promise.all(
        relevantTargets.map(async ({ id: sid, circleId }) => {
          if (deletedIds.has(sid)) return;
          const seed = INITIAL_STUDENTS.find((s) => s.id === sid);
          if (!seed) return;

          if (canWriteStudentDoc) {
            const studentRef = doc(db, 'students', sid);
            const snap = await getDoc(studentRef);
            if (!snap.exists()) {
              await setDoc(studentRef, sanitizeForFirestore(seed));
            } else {
              const data = snap.data() as Partial<Student> | undefined;
              if (normalizeCircleId(data?.circleId) !== circleId || !data?.name) {
                await setDoc(
                  studentRef,
                  {
                    circleId,
                    ...(data?.name ? {} : { name: seed.name }),
                  },
                  { merge: true }
                );
              }
            }
          }

          if (canWriteUserDoc) {
            await setDoc(
              doc(db, 'users', sid),
              {
                id: sid,
                uid: sid,
                name: seed.name,
                role: 'student',
                studentId: sid,
                circleId,
                createdAt: '2026-10-28T00:00:00Z',
              },
              { merge: true }
            );
          }
        })
      );

      const nextMeta = this.getStaticCacheMeta();
      nextMeta.linked_ali_new_student_v2 = Date.now();
      saveItem(STORAGE_KEYS.STATIC_CACHE_META, nextMeta);
      this.recalculateCircleStudentCounts();
      debouncedNotifySubscribers();
    } catch (err: any) {
      console.warn('Linked Ali new student sync notice:', err?.message || err);
    }
  }

  private getTeacherCircleIds(user: User): string[] {
    const ordered: string[] = [];
    const seen = new Set<string>();
    const addCircleId = (raw?: string) => {
      if (!raw) return;
      const norm = normalizeCircleId(raw);
      if (!seen.has(norm)) {
        seen.add(norm);
        ordered.push(norm);
      }
    };

    const initialTeacher = INITIAL_TEACHERS.find((t) => t.id === user.id);
    initialTeacher?.circleIds.forEach(addCircleId);

    const cachedTeacher = this.getTeachers().find((t) => t.id === user.id);
    cachedTeacher?.circleIds?.forEach(addCircleId);

    INITIAL_CIRCLES.filter((c) => c.teacherId === user.id).forEach((c) => addCircleId(c.id));
    this.getCircles()
      .filter((c) => c.teacherId === user.id)
      .forEach((c) => addCircleId(c.id));

    if (user.circleId) addCircleId(user.circleId);
    if (ordered.length === 0) addCircleId('circle_othman');

    return ordered;
  }

  private async ensureOmarAbdulazizCircleAndStudentsInFirestore(): Promise<void> {
    try {
      const user = this.activeUser;
      if (!user) return;

      const meta = this.getStaticCacheMeta();
      if (!meta.migrated_abdulaziz_hassan_uid_v1) {
        await this.migrateAbdulazizHassanUidInFirestore(user);
      }
      if (!meta.migrated_baabad_batch_uids_v1) {
        await this.migrateBaabadBatchUidsInFirestore(user);
      }
      if (meta.linked_omar_abdulaziz_v1 && meta.baabad_saeed_first_v1) return;

      if (meta.linked_omar_abdulaziz_v1 && !meta.baabad_saeed_first_v1) {
        if (
          user.role === 'admin' ||
          user.role === 'supervisor' ||
          (user.role === 'teacher' && user.id === 'NSmjSrHJZ6Ozr23TgdRms2qvPI32')
        ) {
          const teacherSeed = INITIAL_TEACHERS.find((t) => t.id === 'NSmjSrHJZ6Ozr23TgdRms2qvPI32');
          if (teacherSeed) {
            await setDoc(
              doc(db, 'teachers', teacherSeed.id),
              sanitizeForFirestore(teacherSeed),
              { merge: true }
            );
          }
          const nextMeta = this.getStaticCacheMeta();
          nextMeta.baabad_saeed_first_v1 = Date.now();
          saveItem(STORAGE_KEYS.STATIC_CACHE_META, nextMeta);
          debouncedNotifySubscribers();
        }
        return;
      }

      const OMAR_ABDULAZIZ_STUDENT_IDS = INITIAL_STUDENTS.filter(
        (s) => s.circleId === 'circle_omar_abdulaziz'
      ).map((s) => s.id);
      const activeStudentId = user.studentId || user.id;
      const teacherCircleIds = user.role === 'teacher' ? this.getTeacherCircleIds(user) : [];

      const isRelevantUser =
        user.role === 'admin' ||
        user.role === 'supervisor' ||
        (user.role === 'teacher' &&
          (user.id === 'NSmjSrHJZ6Ozr23TgdRms2qvPI32' ||
            teacherCircleIds.includes('circle_omar_abdulaziz'))) ||
        (user.role === 'student' && OMAR_ABDULAZIZ_STUDENT_IDS.includes(activeStudentId));

      if (!isRelevantUser) return;

      // Ensure Omar bin Abdulaziz circle + teacher Ali Baabad assignment exist in Firestore
      if (user.role === 'admin' || user.role === 'supervisor' || user.role === 'teacher') {
        const circleSeed = INITIAL_CIRCLES.find((c) => c.id === 'circle_omar_abdulaziz');
        if (circleSeed) {
          await setDoc(doc(db, 'circles', circleSeed.id), sanitizeForFirestore(circleSeed), {
            merge: true,
          });
        }
        const teacherSeed = INITIAL_TEACHERS.find((t) => t.id === 'NSmjSrHJZ6Ozr23TgdRms2qvPI32');
        if (teacherSeed) {
          await setDoc(
            doc(db, 'teachers', teacherSeed.id),
            sanitizeForFirestore(teacherSeed),
            { merge: true }
          );
        }
      }

      const deletedIds = getPersistedDeletedStudentIds();
      const targetIds =
        user.role === 'student' ? [activeStudentId] : OMAR_ABDULAZIZ_STUDENT_IDS;

      await Promise.all(
        targetIds.map(async (sid) => {
          if (deletedIds.has(sid)) return;
          const seed = INITIAL_STUDENTS.find((s) => s.id === sid);
          if (!seed) return;

          const studentRef = doc(db, 'students', sid);
          const snap = await getDoc(studentRef);
          if (!snap.exists()) {
            await setDoc(studentRef, sanitizeForFirestore(seed));
          } else {
            const data = snap.data() as Partial<Student> | undefined;
            if (normalizeCircleId(data?.circleId) !== 'circle_omar_abdulaziz' || !data?.name) {
              await setDoc(
                studentRef,
                {
                  circleId: 'circle_omar_abdulaziz',
                  ...(data?.name ? {} : { name: seed.name }),
                },
                { merge: true }
              );
            }
          }

          await setDoc(
            doc(db, 'users', sid),
            {
              id: sid,
              uid: sid,
              name: seed.name,
              role: 'student',
              studentId: sid,
              circleId: 'circle_omar_abdulaziz',
              createdAt: '2026-10-28T00:00:00Z',
            },
            { merge: true }
          );
        })
      );

      const nextMeta = this.getStaticCacheMeta();
      nextMeta.linked_omar_abdulaziz_v1 = Date.now();
      nextMeta.baabad_saeed_first_v1 = Date.now();
      saveItem(STORAGE_KEYS.STATIC_CACHE_META, nextMeta);
      this.recalculateCircleStudentCounts();
      debouncedNotifySubscribers();
    } catch (err: any) {
      console.warn('Linked Omar Abdulaziz students sync notice:', err?.message || err);
    }
  }

  private async migrateAbdulazizHassanUidInFirestore(user: User): Promise<void> {
    const OLD_UID = '8g9oEJRdqsaNGJfoClzQ5ofYM8o2';
    const NEW_UID = '99nKyWXb5PYL8s4SziKCKmiCSWt2';

    try {
      const activeStudentId = user.studentId || user.id;
      const teacherCircleIds = user.role === 'teacher' ? this.getTeacherCircleIds(user) : [];
      const isRelevant =
        user.role === 'admin' ||
        user.role === 'supervisor' ||
        (user.role === 'teacher' &&
          (user.id === 'NSmjSrHJZ6Ozr23TgdRms2qvPI32' ||
            teacherCircleIds.includes('circle_omar_abdulaziz'))) ||
        (user.role === 'student' && (activeStudentId === NEW_UID || activeStudentId === OLD_UID));

      if (!isRelevant) return;

      const seed = INITIAL_STUDENTS.find((s) => s.id === NEW_UID);
      if (!seed) return;

      const oldStudentRef = doc(db, 'students', OLD_UID);
      const newStudentRef = doc(db, 'students', NEW_UID);
      const [oldSnap, newSnap] = await Promise.all([getDoc(oldStudentRef), getDoc(newStudentRef)]);

      if (!newSnap.exists()) {
        const legacyData = oldSnap.exists() ? (oldSnap.data() as Partial<Student>) : {};
        await setDoc(
          newStudentRef,
          sanitizeForFirestore({
            ...seed,
            ...legacyData,
            id: NEW_UID,
            name: seed.name,
            circleId: 'circle_omar_abdulaziz',
          })
        );
      } else {
        const existingData = newSnap.data() as Partial<Student> | undefined;
        if (normalizeCircleId(existingData?.circleId) !== 'circle_omar_abdulaziz' || !existingData?.name) {
          await setDoc(
            newStudentRef,
            {
              circleId: 'circle_omar_abdulaziz',
              ...(existingData?.name ? {} : { name: seed.name }),
            },
            { merge: true }
          );
        }
      }

      await setDoc(
        doc(db, 'users', NEW_UID),
        {
          id: NEW_UID,
          uid: NEW_UID,
          name: seed.name,
          role: 'student',
          studentId: NEW_UID,
          circleId: 'circle_omar_abdulaziz',
          createdAt: '2026-10-28T00:00:00Z',
        },
        { merge: true }
      );

      // Move any child records from OLD_UID to NEW_UID and delete old student/user docs
      if (user.role === 'admin' || user.role === 'supervisor' || user.role === 'teacher') {
        const childCollections = [
          'evaluations',
          'transactions',
          'attendance',
          'redemptions',
          'exam_nominations',
        ];
        await Promise.all(
          childCollections.map(async (colName) => {
            try {
              const snap = await getDocs(
                query(collection(db, colName), where('studentId', '==', OLD_UID))
              );
              if (!snap.empty) {
                await Promise.all(
                  snap.docs.map((d) =>
                    setDoc(doc(db, colName, d.id), { studentId: NEW_UID }, { merge: true })
                  )
                );
              }
            } catch (err: any) {
              console.warn(`UID migration child notice (${colName}):`, err?.message || err);
            }
          })
        );
      }

      if (oldSnap.exists()) {
        await deleteDoc(oldStudentRef);
      }
      const oldUserRef = doc(db, 'users', OLD_UID);
      const oldUserSnap = await getDoc(oldUserRef);
      if (oldUserSnap.exists()) {
        await deleteDoc(oldUserRef);
      }

      // Migrate local cached arrays too so old UID never appears locally
      const deletedIds = getPersistedDeletedStudentIds();
      deletedIds.add(OLD_UID);
      savePersistedDeletedStudentIds(deletedIds);
      void syncDeletedStudentsTombstonesToFirestore(deletedIds);

      const localStudents = loadItem<Student[]>(STORAGE_KEYS.STUDENTS, []);
      const legacyLocal = localStudents.find((s) => s.id === OLD_UID);
      const withoutOld = localStudents.filter((s) => s.id !== OLD_UID);
      if (!withoutOld.some((s) => s.id === NEW_UID)) {
        withoutOld.push({
          ...seed,
          ...(legacyLocal || {}),
          id: NEW_UID,
          name: seed.name,
          circleId: 'circle_omar_abdulaziz',
        });
      }
      saveItem(STORAGE_KEYS.STUDENTS, withoutOld);

      const migrateLocalStudentId = <T extends { studentId?: string }>(key: string) => {
        const items = loadItem<T[]>(key, []);
        let changed = false;
        const updated = items.map((item) => {
          if (item.studentId === OLD_UID) {
            changed = true;
            return { ...item, studentId: NEW_UID };
          }
          return item;
        });
        if (changed) {
          saveItem(key, updated);
        }
      };
      migrateLocalStudentId<EvaluationRecord>(STORAGE_KEYS.EVALUATIONS);
      migrateLocalStudentId<PointTransaction>(STORAGE_KEYS.TRANSACTIONS);
      migrateLocalStudentId<AttendanceRecord>(STORAGE_KEYS.ATTENDANCE);
      migrateLocalStudentId<RedemptionRequest>(STORAGE_KEYS.REDEMPTIONS);
      migrateLocalStudentId<ExamNomination>(STORAGE_KEYS.EXAM_NOMINATIONS);

      const nextMeta = this.getStaticCacheMeta();
      nextMeta.migrated_abdulaziz_hassan_uid_v1 = Date.now();
      saveItem(STORAGE_KEYS.STATIC_CACHE_META, nextMeta);
      this.recalculateCircleStudentCounts();
      debouncedNotifySubscribers();
    } catch (err: any) {
      console.warn('UID migration notice:', err?.message || err);
    }
  }

  private async migrateBaabadBatchUidsInFirestore(user: User): Promise<void> {
    const MIGRATIONS: Array<{ oldUid: string; newUid: string; circleId: string }> = [
      { oldUid: '4ipFtSNlHdhOieigmbpJodTn2Gx2', newUid: 'WE8LIn7oK1VtUVeoUyiWMegiDXw2', circleId: 'circle_saeed' },
      { oldUid: 'P2HiDOdD6qVQl8j7owLyZ7b0VRA2', newUid: 'xU3gSqrjwSVxTdYag9KUHOPVmIg2', circleId: 'circle_saeed' },
      { oldUid: 'NJ41NTvoclPTPTnK0kPoDXyKQAP2', newUid: 'mazEYvcDjWQFJGJ2gJE3VqD92yb2', circleId: 'circle_omar_abdulaziz' },
      { oldUid: 'qgsb2sYahucl4SmMS52uz487Wb02', newUid: 'hpcxec6jyaW9JsqmXgQzUxJjHmg1', circleId: 'circle_omar_abdulaziz' },
      { oldUid: 'orS9AoCDxBN6grKkW0lvRz9C1fy1', newUid: 'WIqMH3z2V1VHUs63cC9BfTpKMKC2', circleId: 'circle_omar_abdulaziz' },
      { oldUid: 'Bh2QqE4z27OffMlP7QHEnH0sKm43', newUid: 'dmG8X1rNHhc6PgSTGHQSpMRAe9i1', circleId: 'circle_omar_abdulaziz' },
      { oldUid: '2D6GLrJPPCQXxAw5Ao4R2ZiBpUt2', newUid: 'YsW0SiKnsOfR5tQLbgvpg1qED7F2', circleId: 'circle_omar_abdulaziz' },
      { oldUid: 'eqqlscRwHAbrK95fDrMeBB97yfo2', newUid: 'bAyIbEbRr7gEYDGGaKesi62Tkc53', circleId: 'circle_omar_abdulaziz' },
      { oldUid: 'wfn1G1thBGSBTwJoHnmr9RmnV822', newUid: 'tL4d74QQ9oegfKFvcu1vxiVt4DF3', circleId: 'circle_omar_abdulaziz' },
      { oldUid: 'ZRSlMQDEnJfFRDB98zXQfyDfEEo1', newUid: 'ncDK5Jkw6TWyFa87y0J17LB5Q1h1', circleId: 'circle_omar_abdulaziz' },
      { oldUid: '13BCdtkYC6cbH7j4aTpM8K2y76p1', newUid: 'zgE2FLDwvbhnQ1daBiBB2HXVpek2', circleId: 'circle_omar_abdulaziz' },
      { oldUid: 'C2EWxvorywhXTJEpLle1HDp2i2J3', newUid: 'vLRwwNsFQEhjVVC7CxYd3CtaK2K2', circleId: 'circle_omar_abdulaziz' },
      { oldUid: 'r5cBXITYHWTCOLOOI3ZkVeLiLLh1', newUid: 'VrKUJxm0zuaht1ZzLc3j1JIqyQ92', circleId: 'circle_omar_abdulaziz' },
      { oldUid: '7tYRaNNqOOelC1mYdvp1OU3sgnC3', newUid: 'znMVDJQsIKUspEgalmK5nxbVBD13', circleId: 'circle_omar_abdulaziz' },
      { oldUid: 'UIBS5OqSnpfhspNksObBkG39RaI3', newUid: 'PhVeXhJU34SiJUUR0NhW69VnoeB3', circleId: 'circle_omar_abdulaziz' },
      { oldUid: 'XIZl3ZMAEMZh0ytrzzE6YcpAN7Y2', newUid: '7HEQVOCi0bYp0pYSXP6afiqV1mf2', circleId: 'circle_omar_abdulaziz' },
      { oldUid: 'aD5vkvAyqMb3ExSiA5rJRR0rRUr1', newUid: 'PjlFnI49MTR7oV95AiaARNJqKCo1', circleId: 'circle_omar_abdulaziz' },
      { oldUid: 'R2xPHml7WBOePdEVHW4DhZShFMh2', newUid: 'P0KbvgjbGjPALndxrq8SFLUFpcD3', circleId: 'circle_omar_abdulaziz' },
      { oldUid: '0fLTSHjk5LWU3QN9Q4LGbFhUvII3', newUid: 'hMBWFivHBwfwzpyCnjqLtiT3wug2', circleId: 'circle_omar_abdulaziz' },
      { oldUid: 'Wit3I25DpGS46JmAf8LlexHPW0I2', newUid: 'DQBJXCADjUNvVN0KpIf22p6cYx23', circleId: 'circle_omar_abdulaziz' },
      { oldUid: 'MH5ytx1Do0YrouH3RruZCJ1w1qm1', newUid: 'TpiGsSQhY9fL7FSrqaNniuUc3Ez2', circleId: 'circle_omar_abdulaziz' },
      { oldUid: 'f3VdNZuRLjgtJ6OXtskUvAtiHuy2', newUid: 'Pu4N4qOVDPflyffywISIP1dClC43', circleId: 'circle_omar_abdulaziz' },
      { oldUid: 'acsSfLFIU6bK2gwALaan91P0Ks12', newUid: '9GeVLJRWNPULtuhHGm0GwHh92ai1', circleId: 'circle_omar_abdulaziz' },
      { oldUid: 'gSEAzNpm5FNjwNDGGANZbSqaGV22', newUid: 'f6WUBDPkOPR8CT1D8elwmJLCJJm1', circleId: 'circle_omar_abdulaziz' },
    ];

    try {
      const activeStudentId = user.studentId || user.id;
      const teacherCircleIds = user.role === 'teacher' ? this.getTeacherCircleIds(user) : [];
      const isStaff =
        user.role === 'admin' ||
        user.role === 'supervisor' ||
        (user.role === 'teacher' &&
          (user.id === 'NSmjSrHJZ6Ozr23TgdRms2qvPI32' ||
            teacherCircleIds.includes('circle_omar_abdulaziz') ||
            teacherCircleIds.includes('circle_saeed')));

      const relevantMigrations = isStaff
        ? MIGRATIONS
        : user.role === 'student'
        ? MIGRATIONS.filter((m) => m.newUid === activeStudentId || m.oldUid === activeStudentId)
        : [];

      if (relevantMigrations.length === 0) return;

      const migrationByOld = new Map(relevantMigrations.map((m) => [m.oldUid, m.newUid]));
      const deletedIds = getPersistedDeletedStudentIds();

      await Promise.all(
        relevantMigrations.map(async ({ oldUid, newUid, circleId }) => {
          const seed = INITIAL_STUDENTS.find((s) => s.id === newUid);
          if (!seed) return;

          const oldStudentRef = doc(db, 'students', oldUid);
          const newStudentRef = doc(db, 'students', newUid);
          const [oldSnap, newSnap] = await Promise.all([getDoc(oldStudentRef), getDoc(newStudentRef)]);

          if (!newSnap.exists()) {
            const legacyData = oldSnap.exists() ? (oldSnap.data() as Partial<Student>) : {};
            await setDoc(
              newStudentRef,
              sanitizeForFirestore({
                ...seed,
                ...legacyData,
                id: newUid,
                name: seed.name,
                circleId,
              })
            );
          } else {
            const existingData = newSnap.data() as Partial<Student> | undefined;
            if (normalizeCircleId(existingData?.circleId) !== circleId || !existingData?.name) {
              await setDoc(
                newStudentRef,
                {
                  circleId,
                  ...(existingData?.name ? {} : { name: seed.name }),
                },
                { merge: true }
              );
            }
          }

          await setDoc(
            doc(db, 'users', newUid),
            {
              id: newUid,
              uid: newUid,
              name: seed.name,
              role: 'student',
              studentId: newUid,
              circleId,
              createdAt: '2026-10-28T00:00:00Z',
            },
            { merge: true }
          );

          if (isStaff) {
            const childCollections = [
              'evaluations',
              'transactions',
              'attendance',
              'redemptions',
              'exam_nominations',
            ];
            await Promise.all(
              childCollections.map(async (colName) => {
                try {
                  const snap = await getDocs(
                    query(collection(db, colName), where('studentId', '==', oldUid))
                  );
                  if (!snap.empty) {
                    await Promise.all(
                      snap.docs.map((d) =>
                        setDoc(doc(db, colName, d.id), { studentId: newUid }, { merge: true })
                      )
                    );
                  }
                } catch (err: any) {
                  console.warn(`Batch UID child notice (${colName}):`, err?.message || err);
                }
              })
            );
          }

          if (oldSnap.exists()) {
            await deleteDoc(oldStudentRef);
          }
          const oldUserRef = doc(db, 'users', oldUid);
          const oldUserSnap = await getDoc(oldUserRef);
          if (oldUserSnap.exists()) {
            await deleteDoc(oldUserRef);
          }

          deletedIds.add(oldUid);
        })
      );

      savePersistedDeletedStudentIds(deletedIds);
      void syncDeletedStudentsTombstonesToFirestore(deletedIds);

      // Update localStorage caches so old UIDs never show up locally
      const localStudents = loadItem<Student[]>(STORAGE_KEYS.STUDENTS, []);
      const legacyByOld = new Map<string, Student>();
      localStudents.forEach((s) => {
        if (migrationByOld.has(s.id)) {
          legacyByOld.set(s.id, s);
        }
      });
      const cleanedStudents = localStudents.filter((s) => !migrationByOld.has(s.id));
      const existingStudentIds = new Set(cleanedStudents.map((s) => s.id));
      relevantMigrations.forEach(({ oldUid, newUid, circleId }) => {
        if (!existingStudentIds.has(newUid)) {
          const seed = INITIAL_STUDENTS.find((s) => s.id === newUid);
          if (seed) {
            const legacyLocal = legacyByOld.get(oldUid);
            cleanedStudents.push({
              ...seed,
              ...(legacyLocal || {}),
              id: newUid,
              name: seed.name,
              circleId,
            });
            existingStudentIds.add(newUid);
          }
        }
      });
      saveItem(STORAGE_KEYS.STUDENTS, cleanedStudents);

      const migrateLocalStudentIds = <T extends { studentId?: string }>(key: string) => {
        const items = loadItem<T[]>(key, []);
        let changed = false;
        const updated = items.map((item) => {
          if (item.studentId && migrationByOld.has(item.studentId)) {
            changed = true;
            return { ...item, studentId: migrationByOld.get(item.studentId)! };
          }
          return item;
        });
        if (changed) {
          saveItem(key, updated);
        }
      };
      migrateLocalStudentIds<EvaluationRecord>(STORAGE_KEYS.EVALUATIONS);
      migrateLocalStudentIds<PointTransaction>(STORAGE_KEYS.TRANSACTIONS);
      migrateLocalStudentIds<AttendanceRecord>(STORAGE_KEYS.ATTENDANCE);
      migrateLocalStudentIds<RedemptionRequest>(STORAGE_KEYS.REDEMPTIONS);
      migrateLocalStudentIds<ExamNomination>(STORAGE_KEYS.EXAM_NOMINATIONS);

      const nextMeta = this.getStaticCacheMeta();
      nextMeta.migrated_baabad_batch_uids_v1 = Date.now();
      saveItem(STORAGE_KEYS.STATIC_CACHE_META, nextMeta);
      this.recalculateCircleStudentCounts();
      debouncedNotifySubscribers();
    } catch (err: any) {
      console.warn('Baabad batch UID migration notice:', err?.message || err);
    }
  }

  public async refreshStaticCaches(force = false): Promise<void> {
    const role = this.activeUser?.role;
    if (!role) return;

    const tasks: Promise<void>[] = [
      this.fetchStaticCollectionCached<Circle>({
        colName: 'circles',
        storageKey: STORAGE_KEYS.CIRCLES,
        ttlMs: CIRCLES_CACHE_TTL_MS,
        force,
      }),
      this.syncDeletedStudentsFromFirestore(force).then(async () => {
        await this.ensureLinkedSaeedStudentsInFirestore();
        await this.ensureLinkedOmarAliStudentsInFirestore();
        await this.ensureLinkedAbbasStudentsInFirestore();
        await this.ensureLinkedAliNewStudentInFirestore();
        await this.ensureOmarAbdulazizCircleAndStudentsInFirestore();
      }),
    ];

    if (role === 'teacher' || role === 'supervisor' || role === 'admin') {
      tasks.push(
        this.fetchStaticCollectionCached<Teacher>({
          colName: 'teachers',
          storageKey: STORAGE_KEYS.TEACHERS,
          ttlMs: TEACHERS_CACHE_TTL_MS,
          force,
        })
      );
    }

    if (role === 'student' || role === 'admin') {
      tasks.push(
        this.fetchStaticCollectionCached<Reward>({
          colName: 'rewards',
          storageKey: STORAGE_KEYS.REWARDS,
          ttlMs: REWARDS_CACHE_TTL_MS,
          force,
        })
      );
    }

    if (role === 'admin') {
      tasks.push(this.refreshAuditLogs(force));
    }

    await Promise.all(tasks);
  }

  public async refreshAuditLogs(force = false): Promise<void> {
    if (this.activeUser?.role !== 'admin') return;
    try {
      const meta = this.getStaticCacheMeta();
      const lastFetchedAt = meta.audit_logs || 0;
      const hasCached =
        typeof localStorage !== 'undefined' && Boolean(localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS));

      if (!force && hasCached && Date.now() - lastFetchedAt < AUDIT_LOGS_CACHE_TTL_MS) {
        return;
      }

      const existingPromise = this.staticInFlight.get('audit_logs');
      if (existingPromise && !force) {
        return existingPromise;
      }

      const fetchPromise = (async () => {
        try {
          const snap = await getDocs(
            query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(150))
          );
          const mergedMap = new Map<string, AuditLog>();
          if (!snap.empty) {
            snap.forEach((d) => {
              const log = d.data() as AuditLog;
              if (log && log.id && !deletedDocIds.has(log.id)) {
                mergedMap.set(log.id, log);
              }
            });
          }
          // Preserve any local logs added just moments ago before server echo
          this.getAuditLogs().forEach((localLog) => {
            if (localLog && localLog.id && !deletedDocIds.has(localLog.id) && !mergedMap.has(localLog.id)) {
              mergedMap.set(localLog.id, localLog);
            }
          });

          const sorted = Array.from(mergedMap.values())
            .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
            .slice(0, 150);

          saveItem(STORAGE_KEYS.AUDIT_LOGS, sorted);
          const nextMeta = this.getStaticCacheMeta();
          nextMeta.audit_logs = Date.now();
          saveItem(STORAGE_KEYS.STATIC_CACHE_META, nextMeta);
          debouncedNotifySubscribers();
        } catch (err: any) {
          console.warn('Audit logs fetch notice:', err?.message || err);
        } finally {
          this.staticInFlight.delete('audit_logs');
        }
      })();

      this.staticInFlight.set('audit_logs', fetchPromise);
      await fetchPromise;
    } catch (e) {
      console.warn('Audit logs refresh error:', e);
    }
  }

  public async lookupUserByEmail(email: string): Promise<User | null> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return null;

    // 1. Check local cache first (0 Firestore reads)
    const localTeacher = this.getTeachers().find(
      (t) => t.email && t.email.trim().toLowerCase() === cleanEmail
    );
    if (localTeacher) {
      return {
        id: `user_${localTeacher.id}`,
        email: localTeacher.email || `${localTeacher.id}@zuhaia.com`,
        name: localTeacher.name,
        role: 'teacher',
        circleId: localTeacher.circleIds?.[0] || 'circle_othman',
        createdAt: new Date().toISOString(),
      };
    }

    const localStudent = this.getStudents().find(
      (s) => s.email && s.email.trim().toLowerCase() === cleanEmail
    );
    if (localStudent) {
      return {
        id: `user_${localStudent.id}`,
        email: localStudent.email,
        name: localStudent.name,
        role: 'student',
        studentId: localStudent.id,
        circleId: localStudent.circleId,
        createdAt: new Date().toISOString(),
      };
    }

    // 2. Targeted limit(1) query fallback ONLY when not found locally
    try {
      const teacherSnap = await getDocs(
        query(collection(db, 'teachers'), where('email', '==', cleanEmail), limit(1))
      );
      if (!teacherSnap.empty) {
        const t = teacherSnap.docs[0].data() as Teacher;
        if (t && t.id) {
          return {
            id: `user_${t.id}`,
            email: t.email || cleanEmail,
            name: t.name,
            role: 'teacher',
            circleId: t.circleIds?.[0] || 'circle_othman',
            createdAt: new Date().toISOString(),
          };
        }
      }

      const studentSnap = await getDocs(
        query(collection(db, 'students'), where('email', '==', cleanEmail), limit(1))
      );
      if (!studentSnap.empty) {
        const s = studentSnap.docs[0].data() as Student;
        const deletedIds = getPersistedDeletedStudentIds();
        if (s && s.id && !deletedIds.has(s.id)) {
          return {
            id: `user_${s.id}`,
            email: s.email || cleanEmail,
            name: s.name,
            role: 'student',
            studentId: s.id,
            circleId: s.circleId,
            createdAt: new Date().toISOString(),
          };
        }
      }
    } catch (err) {
      console.warn('Email lookup fallback notice:', err);
    }

    return null;
  }

  private getSessionKeyForUser(user: User | null): string | null {
    if (!user) return null;
    if (user.role === 'student') {
      const sId = user.studentId || user.id;
      return `student:${sId}:${(user.email || '').toLowerCase()}`;
    }
    if (user.role === 'teacher') {
      const cId = normalizeCircleId(user.circleId || 'circle_othman');
      return `teacher:${cId}:${user.id}:${(user.email || '').toLowerCase()}`;
    }
    return `${user.role}:${user.id}`;
  }

  public setSessionUser(user: User | null): void {
    const nextKey = this.getSessionKeyForUser(user);
    if (nextKey === this.activeSessionKey) {
      return;
    }

    this.teardownListeners();
    this.activeSessionKey = nextKey;
    this.activeUser = user;

    if (!user || !nextKey) {
      this.ledgerScope = 'none';
      this.hasEvaluationsScope = false;
      this.scopedStudentId = null;
      this.scopedCircleId = null;
      this.scopedCircleIds = new Set();
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEYS.SESSION_OWNER);
      }
      this.clearScopedRuntimeCaches();
      updateSyncState({
        status: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'connected',
        errorMessage: undefined,
      });
      return;
    }

    // Clear stale scoped data only if switching to a DIFFERENT account on this device
    if (typeof localStorage !== 'undefined') {
      const prevOwner = localStorage.getItem(STORAGE_KEYS.SESSION_OWNER);
      if (prevOwner && prevOwner !== nextKey) {
        this.clearScopedRuntimeCaches();
      }
      localStorage.setItem(STORAGE_KEYS.SESSION_OWNER, nextKey);
    }

    if (user.role === 'student') {
      this.ledgerScope = 'student';
      this.hasEvaluationsScope = true;
      this.scopedStudentId = user.studentId || user.id;
      this.scopedCircleId = user.circleId ? normalizeCircleId(user.circleId) : null;
      this.scopedCircleIds = this.scopedCircleId ? new Set([this.scopedCircleId]) : new Set();
    } else if (user.role === 'teacher') {
      const teacherCircleIds = this.getTeacherCircleIds(user);
      this.ledgerScope = 'none';
      this.hasEvaluationsScope = true;
      this.scopedStudentId = null;
      this.scopedCircleId = teacherCircleIds[0] || normalizeCircleId(user.circleId || 'circle_othman');
      this.scopedCircleIds = new Set(teacherCircleIds);
    } else if (user.role === 'supervisor') {
      this.ledgerScope = 'all';
      this.hasEvaluationsScope = true;
      this.scopedStudentId = null;
      this.scopedCircleId = null;
      this.scopedCircleIds = new Set();
    } else {
      // admin
      this.ledgerScope = 'all';
      this.hasEvaluationsScope = false;
      this.scopedStudentId = null;
      this.scopedCircleId = null;
      this.scopedCircleIds = new Set();
    }

    // Run local-only reconciliation appropriate for the active role
    this.reconcileStudentPointsFromTransactions();
    this.reconcileStudentAttendance();
    this.recalculateCircleStudentCounts();

    // Load static collections via TTL-cached getDocs
    void this.refreshStaticCaches(false);

    // Start role-scoped real-time Firestore listeners
    this.initScopedFirestoreListeners(user);
    debouncedNotifySubscribers();
  }

  /**
   * Reconciles currentPoints against transactions ledger strictly within the active role's scope.
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

      // Teacher sessions do not subscribe to transactions — preserve Firestore student.currentPoints untouched
      if (this.ledgerScope === 'none') {
        return;
      }

      const rawTransactions = loadItem<PointTransaction[]>(STORAGE_KEYS.TRANSACTIONS, INITIAL_TRANSACTIONS);
      let txModified = false;
      let finalTxs = rawTransactions;

      // Cross-check evaluation transactions against evaluations ONLY when evaluations are synced for this scope
      if (this.hasEvaluationsScope) {
        const scopedId = this.ledgerScope === 'student' ? this.scopedStudentId : null;
        const evalMap = new Map<string, { studentId: string; date: string; txs: PointTransaction[] }>();
        const otherTxs: PointTransaction[] = [];

        rawTransactions.forEach((tx) => {
          if (scopedId && tx.studentId !== scopedId) {
            otherTxs.push(tx);
            return;
          }

          if (tx.reason?.includes('تقييم يوم الأحد (2026-10-29)')) {
            tx.reason = tx.reason.replace('تقييم يوم الأحد (2026-10-29)', 'تقييم يوم الخميس (2026-10-29)');
            txModified = true;
          }

          const isNonEvalType =
            tx.type === 'admin_bonus' ||
            tx.type === 'admin_correction' ||
            tx.type === 'reward_redemption' ||
            tx.type === 'refund' ||
            tx.type === 'attendance';

          const isEval =
            !isNonEvalType &&
            (tx.idempotencyKey?.includes('daily_eval') ||
              tx.id?.includes('eval') ||
              tx.reason?.startsWith('تقييم يوم') ||
              tx.reason?.startsWith('إلغاء وحذف تقييم يوم'));

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
              const key = `${tx.studentId}::${dateStr}`;
              const entry = evalMap.get(key) || { studentId: tx.studentId, date: dateStr, txs: [] };
              entry.txs.push(tx);
              evalMap.set(key, entry);
            } else {
              txModified = true;
            }
          } else {
            otherTxs.push(tx);
          }
        });

        const consolidatedTxs: PointTransaction[] = [...otherTxs];

        evalMap.forEach(({ studentId: sId, date: dKey, txs: list }) => {
          const matchingEval = evals.find((e) => {
            const eDate = e.date?.includes('T') ? e.date.split('T')[0] : e.date;
            return e.studentId === sId && eDate === dKey;
          });

          const evalScore = matchingEval
            ? typeof matchingEval.totalPoints === 'number'
              ? matchingEval.totalPoints
              : matchingEval.pointsAwarded || 0
            : 0;

          if (!matchingEval || evalScore <= 0) {
            txModified = true;
            return;
          }

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

        const addedEvalKeys = new Set<string>();
        evals.forEach((e) => {
          if (!e.studentId || !e.date) return;
          if (scopedId && e.studentId !== scopedId) return;
          const eDate = e.date.includes('T') ? e.date.split('T')[0] : e.date;
          const pts = typeof e.totalPoints === 'number' ? e.totalPoints : e.pointsAwarded || 0;
          if (pts <= 0) return;
          const key = `${e.studentId}::${eDate}`;
          if (!evalMap.has(key) && !addedEvalKeys.has(key)) {
            addedEvalKeys.add(key);
            const accurateDay = e.dayName || getArabicDayName(eDate);
            const att =
              e.attendance === 'early' ? 'مبكر (2ن)' : e.attendance === 'late' ? 'متأخر (1ن)' : 'غائب (0ن)';
            const cleanReason = `تقييم يوم ${accurateDay} (${eDate}): حضور ${att}، حفظ ${e.memorizationScore || 0}ن، مراجعة ${e.revisionScore || 0}ن، انضباط ${e.disciplineScore || 0}ن، زي ${e.uniformScore || 0}ن`;
            const newTx: PointTransaction = {
              id: `tx_eval_${e.studentId}_${eDate}`,
              studentId: e.studentId,
              studentName: e.studentName,
              amount: pts,
              type: 'memorization',
              reason: cleanReason,
              date: eDate,
              createdBy: e.recordedBy || 'المعلم',
              createdByRole: 'teacher',
              idempotencyKey: `daily_eval_${e.studentId}_${eDate}`,
            };
            consolidatedTxs.push(newTx);
            txModified = true;
          }
        });

        if (txModified) {
          saveItem(STORAGE_KEYS.TRANSACTIONS, consolidatedTxs);
        }
        finalTxs = txModified ? consolidatedTxs : rawTransactions;
      }

      // 3. Reconcile student balances with transactions ledger LOCALLY (only for students in scope)
      const students = loadItem<Student[]>(STORAGE_KEYS.STUDENTS, INITIAL_STUDENTS);
      const txPointsByStudent = computeStudentBalancesMap(finalTxs);

      let modified = false;
      students.forEach((s) => {
        if (this.ledgerScope === 'student' && s.id !== this.scopedStudentId) {
          return;
        }
        const truePoints = txPointsByStudent.get(s.id) || 0;
        if (s.currentPoints !== truePoints) {
          s.currentPoints = truePoints;
          modified = true;
        }
      });

      if (modified) {
        saveItem(STORAGE_KEYS.STUDENTS, students);
      }
    } catch (e) {
      console.warn('Reconciliation notice:', e);
    }
  }

  private initScopedFirestoreListeners(user: User) {
    try {
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

      const subscribeSupportTickets = (q: ReturnType<typeof query> | ReturnType<typeof collection>) => {
        const unsub = onSnapshot(
          q as any,
          { includeMetadataChanges: false },
          (snapshot: any) => {
            if (snapshot.metadata.hasPendingWrites) return;
            recordSnapshotReceived(snapshot.metadata.fromCache);
            const list: SupportTicket[] = [];
            if (!snapshot.empty) {
              snapshot.forEach((d: any) => {
                const ticket = d.data() as SupportTicket;
                if (ticket && ticket.id && !deletedDocIds.has(ticket.id)) {
                  list.push(ticket);
                }
              });
            }
            saveItem(STORAGE_KEYS.SUPPORT_TICKETS, list);
            debouncedNotifySubscribers();
          },
          handleSnapshotError('support_tickets')
        );
        this.unsubscribers.push(unsub);
      };

      const buildSenderIds = (u: User): string[] => {
        const ids = new Set<string>();
        if (u.id) ids.add(u.id);
        if (u.studentId) {
          ids.add(u.studentId);
          ids.add(`user_${u.studentId}`);
        }
        return Array.from(ids).slice(0, 10);
      };

      if (user.role === 'student') {
        const studentId = user.studentId || user.id;

        // 1. Single student document listener (1 doc)
        const unsubStudent = onSnapshot(
          doc(db, 'students', studentId),
          { includeMetadataChanges: false },
          (docSnap) => {
            if (docSnap.metadata.hasPendingWrites) return;
            recordSnapshotReceived(docSnap.metadata.fromCache);
            if (docSnap.exists()) {
              const s = docSnap.data() as Student;
              if (s && s.id && !deletedDocIds.has(s.id)) {
                const existing = loadItem<Student[]>(STORAGE_KEYS.STUDENTS, INITIAL_STUDENTS);
                const idx = existing.findIndex((item) => item.id === s.id);
                if (idx >= 0) {
                  existing[idx] = s;
                } else {
                  existing.push(s);
                }
                saveItem(STORAGE_KEYS.STUDENTS, existing);
                this.reconcileStudentPointsFromTransactions();
                debouncedNotifySubscribers();
              }
            }
          },
          handleSnapshotError('students')
        );
        this.unsubscribers.push(unsubStudent);

        // 2. Own evaluations only
        const unsubEvals = onSnapshot(
          query(collection(db, 'evaluations'), where('studentId', '==', studentId)),
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
            this.reconcileStudentPointsFromTransactions();
            this.reconcileStudentAttendance();
            debouncedNotifySubscribers();
          },
          handleSnapshotError('evaluations')
        );
        this.unsubscribers.push(unsubEvals);

        // 3. Own transactions only
        const unsubTx = onSnapshot(
          query(collection(db, 'transactions'), where('studentId', '==', studentId)),
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
            this.reconcileStudentPointsFromTransactions();
            debouncedNotifySubscribers();
          },
          handleSnapshotError('transactions')
        );
        this.unsubscribers.push(unsubTx);

        // 4. Own redemptions only
        const unsubRedemptions = onSnapshot(
          query(collection(db, 'redemptions'), where('studentId', '==', studentId)),
          { includeMetadataChanges: false },
          (snapshot) => {
            if (snapshot.metadata.hasPendingWrites) return;
            recordSnapshotReceived(snapshot.metadata.fromCache);
            const list: RedemptionRequest[] = [];
            if (!snapshot.empty) {
              snapshot.forEach((d) => {
                const req = d.data() as RedemptionRequest;
                if (req && req.id && !deletedDocIds.has(req.id)) {
                  list.push(req);
                }
              });
            }
            saveItem(STORAGE_KEYS.REDEMPTIONS, list);
            debouncedNotifySubscribers();
          },
          handleSnapshotError('redemptions')
        );
        this.unsubscribers.push(unsubRedemptions);

        // 5. Own support tickets only
        const senderIds = buildSenderIds(user);
        if (senderIds.length > 0) {
          subscribeSupportTickets(
            query(collection(db, 'support_tickets'), where('senderId', 'in', senderIds))
          );
        }
        return;
      }

      if (user.role === 'teacher') {
        const teacherCircleIds = this.getTeacherCircleIds(user).slice(0, 10);
        const teacherCircleSet = new Set(teacherCircleIds);

        const studentsQuery =
          teacherCircleIds.length > 1
            ? query(collection(db, 'students'), where('circleId', 'in', teacherCircleIds))
            : query(collection(db, 'students'), where('circleId', '==', teacherCircleIds[0]));

        const evalsQuery =
          teacherCircleIds.length > 1
            ? query(collection(db, 'evaluations'), where('circleId', 'in', teacherCircleIds))
            : query(collection(db, 'evaluations'), where('circleId', '==', teacherCircleIds[0]));

        // 1. Teacher's circle(s) students only
        const unsubStudents = onSnapshot(
          studentsQuery,
          { includeMetadataChanges: false },
          (snapshot) => {
            if (snapshot.metadata.hasPendingWrites) return;
            recordSnapshotReceived(snapshot.metadata.fromCache);
            if (!snapshot.empty) {
              const remoteCircleStudents: Student[] = [];
              const remoteIds = new Set<string>();
              snapshot.forEach((d) => {
                const s = d.data() as Student;
                if (s && s.id && !deletedDocIds.has(s.id)) {
                  remoteCircleStudents.push(s);
                  remoteIds.add(s.id);
                }
              });
              const existing = loadItem<Student[]>(STORAGE_KEYS.STUDENTS, INITIAL_STUDENTS);
              const otherCircleStudents = existing.filter(
                (s) => !teacherCircleSet.has(normalizeCircleId(s.circleId)) && !remoteIds.has(s.id)
              );
              saveItem(STORAGE_KEYS.STUDENTS, [...otherCircleStudents, ...remoteCircleStudents]);
              this.reconcileStudentAttendance();
              this.recalculateCircleStudentCounts();
              debouncedNotifySubscribers();
            }
          },
          handleSnapshotError('students')
        );
        this.unsubscribers.push(unsubStudents);

        // 2. Teacher's circle(s) evaluations only
        const unsubEvals = onSnapshot(
          evalsQuery,
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
            this.reconcileStudentAttendance();
            debouncedNotifySubscribers();
          },
          handleSnapshotError('evaluations')
        );
        this.unsubscribers.push(unsubEvals);

        // 3. Own support tickets only
        const senderIds = buildSenderIds(user);
        if (senderIds.length > 0) {
          subscribeSupportTickets(
            query(collection(db, 'support_tickets'), where('senderId', 'in', senderIds))
          );
        }
        return;
      }

      if (user.role === 'supervisor') {
        // 1. All Students
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
              this.reconcileStudentPointsFromTransactions();
              this.reconcileStudentAttendance();
              this.recalculateCircleStudentCounts();
              debouncedNotifySubscribers();
            }
          },
          handleSnapshotError('students')
        );
        this.unsubscribers.push(unsubStudents);

        // 2. All Evaluations
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
            this.reconcileStudentPointsFromTransactions();
            this.reconcileStudentAttendance();
            debouncedNotifySubscribers();
          },
          handleSnapshotError('evaluations')
        );
        this.unsubscribers.push(unsubEvals);

        // 3. All Transactions
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
            this.reconcileStudentPointsFromTransactions();
            debouncedNotifySubscribers();
          },
          handleSnapshotError('transactions')
        );
        this.unsubscribers.push(unsubTx);

        // 4. All Redemptions
        const unsubRedemptions = onSnapshot(
          collection(db, 'redemptions'),
          { includeMetadataChanges: false },
          (snapshot) => {
            if (snapshot.metadata.hasPendingWrites) return;
            recordSnapshotReceived(snapshot.metadata.fromCache);
            const list: RedemptionRequest[] = [];
            if (!snapshot.empty) {
              snapshot.forEach((d) => {
                const req = d.data() as RedemptionRequest;
                if (req && req.id && !deletedDocIds.has(req.id)) {
                  list.push(req);
                }
              });
            }
            saveItem(STORAGE_KEYS.REDEMPTIONS, list);
            debouncedNotifySubscribers();
          },
          handleSnapshotError('redemptions')
        );
        this.unsubscribers.push(unsubRedemptions);

        // 5. All Exam Nominations
        const unsubNominations = onSnapshot(
          collection(db, 'exam_nominations'),
          { includeMetadataChanges: false },
          (snapshot) => {
            if (snapshot.metadata.hasPendingWrites) return;
            recordSnapshotReceived(snapshot.metadata.fromCache);
            const list: ExamNomination[] = [];
            if (!snapshot.empty) {
              snapshot.forEach((d) => list.push(d.data() as ExamNomination));
            }
            saveItem(STORAGE_KEYS.EXAM_NOMINATIONS, list);
            debouncedNotifySubscribers();
          },
          handleSnapshotError('exam_nominations')
        );
        this.unsubscribers.push(unsubNominations);

        // 6. Supervisor Support Tickets only
        subscribeSupportTickets(
          query(collection(db, 'support_tickets'), where('senderRole', '==', 'supervisor'))
        );
        return;
      }

      // Admin (Tech Support): needs Students, Transactions, Support Tickets (no evaluations/redemptions/nominations)
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
            this.reconcileStudentPointsFromTransactions();
            this.recalculateCircleStudentCounts();
            debouncedNotifySubscribers();
          }
        },
        handleSnapshotError('students')
      );
      this.unsubscribers.push(unsubStudents);

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
          this.reconcileStudentPointsFromTransactions();
          debouncedNotifySubscribers();
        },
        handleSnapshotError('transactions')
      );
      this.unsubscribers.push(unsubTx);

      subscribeSupportTickets(collection(db, 'support_tickets'));
    } catch (e) {
      console.warn('Firestore real-time listeners initialization skipped:', e);
    }
  }

  // Students
  getStudents(): Student[] {
    const deletedStudentIds = getPersistedDeletedStudentIds();
    const rawLoaded = loadItem<Student[]>(STORAGE_KEYS.STUDENTS, INITIAL_STUDENTS);
    const loaded = rawLoaded.filter((s) => !deletedStudentIds.has(s.id));
    // Remove student level if any legacy field remains and normalize circleId
    let modified = loaded.length !== rawLoaded.length;
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

    // Merge any INITIAL_STUDENTS not yet present in loaded (skip IDs explicitly deleted)
    const loadedIds = new Set(loaded.map((s) => s.id));
    INITIAL_STUDENTS.forEach((initialStudent) => {
      if (
        !loadedIds.has(initialStudent.id) &&
        !deletedDocIds.has(initialStudent.id) &&
        !deletedStudentIds.has(initialStudent.id)
      ) {
        loaded.push(initialStudent);
        modified = true;
      }
    });

    // Reconcile currentPoints against transactions ledger ONLY when ledger is loaded for that student's scope
    if (this.ledgerScope === 'all' || (this.ledgerScope === 'student' && this.scopedStudentId)) {
      const transactions = loadItem<PointTransaction[]>(STORAGE_KEYS.TRANSACTIONS, INITIAL_TRANSACTIONS);
      const txPointsByStudent = computeStudentBalancesMap(transactions);
      loaded.forEach((s) => {
        if (this.ledgerScope === 'student' && s.id !== this.scopedStudentId) return;
        if (txPointsByStudent.has(s.id)) {
          const truePoints = txPointsByStudent.get(s.id)!;
          if (s.currentPoints !== truePoints) {
            s.currentPoints = truePoints;
            modified = true;
          }
        }
      });
    }

    // Reconcile attendance and streaks ONLY for students whose evaluation scope is actively loaded
    if (this.hasEvaluationsScope) {
      loaded.forEach((s) => {
        const inEvalScope =
          (this.ledgerScope === 'all' && !this.scopedCircleId && !this.scopedStudentId) ||
          (this.scopedStudentId && s.id === this.scopedStudentId) ||
          (this.scopedCircleIds.size > 0 && this.scopedCircleIds.has(normalizeCircleId(s.circleId))) ||
          (this.scopedCircleId && normalizeCircleId(s.circleId) === this.scopedCircleId);

        if (!inEvalScope) return;

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
    }

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

    const deletedIds = getPersistedDeletedStudentIds();
    deletedIds.add(id);
    savePersistedDeletedStudentIds(deletedIds);
    void syncDeletedStudentsTombstonesToFirestore(deletedIds);

    const filtered = students.filter((s) => s.id !== id);
    saveItem(STORAGE_KEYS.STUDENTS, filtered);
    deleteFromFirestore('students', id);

    // Purge student's related records locally and in Firestore
    const filterByStudent = <T extends { id: string; studentId?: string }>(key: string) => {
      const items = loadItem<T[]>(key, []);
      const kept = items.filter((item) => {
        if (item.studentId === id) {
          deletedDocIds.add(item.id);
          return false;
        }
        return true;
      });
      if (kept.length !== items.length) {
        saveItem(key, kept);
      }
    };
    filterByStudent<PointTransaction>(STORAGE_KEYS.TRANSACTIONS);
    filterByStudent<EvaluationRecord>(STORAGE_KEYS.EVALUATIONS);
    filterByStudent<AttendanceRecord>(STORAGE_KEYS.ATTENDANCE);
    filterByStudent<RedemptionRequest>(STORAGE_KEYS.REDEMPTIONS);
    filterByStudent<ExamNomination>(STORAGE_KEYS.EXAM_NOMINATIONS);
    void cascadeDeleteStudentInFirestore(id);

    this.recalculateCircleStudentCounts();

    this.addAuditLog({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'حذف طالب',
      details: `تم حذف الطالب ${student.name} وجميع سجلاته المرتبطة نهائياً`,
      targetType: 'student',
      targetId: id,
    });

    notifySubscribers();
    return { success: true, message: 'تم حذف الطالب وسجلاته نهائياً بنجاح' };
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

  getCirclesForTeacher(teacherId: string, fallbackCircleId?: string): Circle[] {
    const allCircles = this.getCircles();
    const matchedTeacher = this.getTeachers().find((t) => t.id === teacherId);
    const orderedIds: string[] = [];
    const seen = new Set<string>();

    const addId = (raw?: string) => {
      if (!raw) return;
      const norm = normalizeCircleId(raw);
      if (!seen.has(norm)) {
        seen.add(norm);
        orderedIds.push(norm);
      }
    };

    matchedTeacher?.circleIds?.forEach(addId);
    allCircles.filter((c) => c.teacherId === teacherId).forEach((c) => addId(c.id));

    if (orderedIds.length === 0 && fallbackCircleId) {
      addId(fallbackCircleId);
    }

    const result = orderedIds
      .map((cid) => allCircles.find((c) => c.id === cid))
      .filter((c): c is Circle => Boolean(c));

    if (result.length > 0) return result;
    return allCircles[0] ? [allCircles[0]] : [];
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
    this.markStaticCacheFresh('circles');
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
        const currentIds = Array.isArray(existing.circleIds) ? existing.circleIds : [];
        const mergedIds = [...initT.circleIds];
        currentIds.forEach((cid) => {
          if (!mergedIds.includes(cid)) mergedIds.push(cid);
        });
        if (
          mergedIds.length !== currentIds.length ||
          mergedIds.some((cid, idx) => currentIds[idx] !== cid)
        ) {
          existing.circleIds = mergedIds;
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
    this.markStaticCacheFresh('teachers');
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
    this.markStaticCacheFresh('teachers');
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
    note?: string;
    actorId?: string;
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
    const balanceBefore = student.currentPoints;
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

    if (params.amount < 0 && balanceBefore + params.amount < 0) {
      return {
        success: false,
        message: `رصيد الطالب لا يكفي (${balanceBefore} نقطة متاحة فقط).`,
      };
    }

    const balanceAfter = Math.max(0, balanceBefore + params.amount);

    const newTx: PointTransaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
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
    student.currentPoints = balanceAfter;
    student.lastActivityDate = newTx.date;
    students[studentIndex] = student;
    saveItem(STORAGE_KEYS.STUDENTS, students);
    syncToFirestore('students', student);

    if (params.type === 'admin_bonus' || params.type === 'admin_correction' || params.createdByRole === 'admin') {
      const cleanNote = params.note?.trim();
      const signedAmountText = `${params.amount >= 0 ? `+${params.amount}` : params.amount}`;
      const isReversal = params.reason.startsWith('تصحيح عكسي');
      const actionTitle = isReversal
        ? 'تصحيح عكسي للنقاط'
        : params.amount >= 0
        ? 'إضافة نقاط إدارية'
        : 'خصم نقاط إداري';

      const detailParts = [
        `الطالب: ${student.name}`,
        `التعديل: ${signedAmountText}`,
        `الرصيد: ${balanceBefore} ← ${balanceAfter}`,
        `السبب: ${params.reason}`,
        ...(cleanNote ? [`ملاحظة: ${cleanNote}`] : []),
        `المسؤول: ${params.createdBy}`,
      ];

      this.addAuditLog({
        actorId: params.actorId || params.createdBy,
        actorName: params.createdBy,
        actorRole: params.createdByRole,
        action: actionTitle,
        details: detailParts.join(' | '),
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
        id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
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
    if (!this.hasEvaluationsScope) return;
    try {
      const students = loadItem<Student[]>(STORAGE_KEYS.STUDENTS, INITIAL_STUDENTS);
      let modified = false;

      students.forEach((s) => {
        const inEvalScope =
          (this.ledgerScope === 'all' && !this.scopedCircleId && !this.scopedStudentId) ||
          (this.scopedStudentId && s.id === this.scopedStudentId) ||
          (this.scopedCircleIds.size > 0 && this.scopedCircleIds.has(normalizeCircleId(s.circleId))) ||
          (this.scopedCircleId && normalizeCircleId(s.circleId) === this.scopedCircleId);

        if (!inEvalScope) return;

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
      id: `eval_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
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
    const oldEvalRecord = existingIndex >= 0 ? evals[existingIndex] : undefined;
    const oldEvalPoints = oldEvalRecord
      ? typeof oldEvalRecord.totalPoints === 'number'
        ? oldEvalRecord.totalPoints
        : oldEvalRecord.pointsAwarded || 0
      : 0;

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
        id: `eval_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
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

    // Consolidate all evaluation transactions for this student and date into EXACTLY ONE deterministic doc
    const deterministicTxId = `tx_eval_${student.id}_${params.date}`;
    const transactions = this.getTransactions();
    const isThisDailyEvalTx = (t: PointTransaction) =>
      t.studentId === student.id &&
      (t.idempotencyKey === `daily_eval_${student.id}_${params.date}` ||
       t.idempotencyKey?.startsWith(`student_${student.id}:${params.date}:daily_eval`) ||
       (t.date === params.date && (t.reason?.startsWith('تقييم يوم') || t.reason?.startsWith('إلغاء وحذف تقييم يوم'))));

    const oldEvalTxs = transactions.filter(isThisDailyEvalTx);
    const oldRecordedPoints =
      this.ledgerScope === 'none'
        ? oldEvalPoints
        : oldEvalTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const netPointsDelta = totalPoints - oldRecordedPoints;

    const attendanceLabel =
      params.attendance === 'early' ? 'مبكر (2ن)' : params.attendance === 'late' ? 'متأخر (1ن)' : params.attendance === 'absent' ? 'غائب (0ن)' : 'لم يُرصد';
    const cleanReason = `تقييم يوم ${accurateDayName} (${params.date}): حضور ${attendanceLabel}، حفظ ${params.memorizationScore ?? '-'}ن، مراجعة ${params.revisionScore ?? '-'}ن، انضباط ${params.disciplineScore ?? '-'}ن، زي ${params.uniformScore ?? '-'}ن`;

    const remainingTxs = transactions.filter((t) => !isThisDailyEvalTx(t));
    const consolidatedTxId = oldEvalTxs[0]?.id || deterministicTxId;

    // Delete superseded transactions or deleted 0-point deterministic transaction
    oldEvalTxs.forEach((t) => {
      if (totalPoints <= 0 || t.id !== consolidatedTxId) {
        deleteFromFirestore('transactions', t.id);
      }
    });
    if (totalPoints <= 0) {
      deleteFromFirestore('transactions', deterministicTxId);
    }

    if (totalPoints > 0) {
      const consolidatedTx: PointTransaction = {
        id: consolidatedTxId,
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

    // Compute exact balance using ledger when loaded, or accurate delta when Teacher skips loading full ledger
    let studentTotalPoints: number;
    if (this.ledgerScope === 'all' || (this.ledgerScope === 'student' && student.id === this.scopedStudentId)) {
      this.reconcileStudentPointsFromTransactions();
      const reconciledBalances = computeStudentBalancesMap(
        loadItem<PointTransaction[]>(STORAGE_KEYS.TRANSACTIONS, INITIAL_TRANSACTIONS)
      );
      studentTotalPoints = reconciledBalances.get(student.id) || 0;
    } else {
      studentTotalPoints = Math.max(0, (student.currentPoints || 0) + (totalPoints - oldEvalPoints));
    }

    const freshStudents = this.getStudents();
    const sIdx = freshStudents.findIndex((s) => s.id === params.studentId);
    if (sIdx >= 0) {
      const currentTarget = freshStudents[sIdx];
      const stats = this.getStudentAttendanceStats(currentTarget.id);
      const nextAttentionReason =
        params.attendance === 'absent' && stats.consecutiveAbsences >= 3
          ? `غياب متكرر (${stats.consecutiveAbsences} أيام متتالية)`
          : currentTarget.attentionReason;

      const studentDocChanged =
        currentTarget.currentPoints !== studentTotalPoints ||
        currentTarget.attendanceRate !== stats.attendanceRate ||
        currentTarget.streakDays !== stats.streakDays ||
        currentTarget.consecutiveAbsences !== stats.consecutiveAbsences ||
        currentTarget.daysWithoutLog !== 0 ||
        currentTarget.lastActivityDate !== params.date ||
        currentTarget.attentionReason !== nextAttentionReason;

      currentTarget.currentPoints = studentTotalPoints;
      currentTarget.daysWithoutLog = 0;
      currentTarget.lastActivityDate = params.date;
      currentTarget.attendanceRate = stats.attendanceRate;
      currentTarget.streakDays = stats.streakDays;
      currentTarget.consecutiveAbsences = stats.consecutiveAbsences;
      currentTarget.attentionReason = nextAttentionReason;

      saveItem(STORAGE_KEYS.STUDENTS, freshStudents);
      if (studentDocChanged) {
        syncToFirestore('students', currentTarget);
      }
    }

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
    const oldEvalPoints = old
      ? typeof old.totalPoints === 'number'
        ? old.totalPoints
        : old.pointsAwarded || 0
      : 0;

    if (toDelete.length > 0) {
      saveItem(STORAGE_KEYS.EVALUATIONS, remainingEvals);
      toDelete.forEach((oldRec) => {
        deleteFromFirestore('evaluations', oldRec.id);
        deletedDocIds.add(oldRec.id);
      });
    }

    // Cleanly remove any evaluation transactions for this date and deduct points
    const deterministicTxId = `tx_eval_${params.studentId}_${params.date}`;
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
    // Ensure deterministic Firestore transaction doc is deleted even when Teacher did not load full transactions
    deleteFromFirestore('transactions', deterministicTxId);
    deletedDocIds.add(deterministicTxId);
    saveItem(STORAGE_KEYS.TRANSACTIONS, remainingTxs);

    const freshStudents = loadItem<Student[]>(STORAGE_KEYS.STUDENTS, INITIAL_STUDENTS);
    const sIdx = freshStudents.findIndex((s) => s.id === params.studentId);
    if (sIdx >= 0) {
      let studentTotalPoints: number;
      if (this.ledgerScope === 'all' || (this.ledgerScope === 'student' && params.studentId === this.scopedStudentId)) {
        this.reconcileStudentPointsFromTransactions();
        const reconciledBalances = computeStudentBalancesMap(
          loadItem<PointTransaction[]>(STORAGE_KEYS.TRANSACTIONS, INITIAL_TRANSACTIONS)
        );
        studentTotalPoints = reconciledBalances.get(params.studentId) || 0;
      } else {
        studentTotalPoints = Math.max(0, (freshStudents[sIdx].currentPoints || 0) - oldEvalPoints);
      }

      const stats = this.getStudentAttendanceStats(freshStudents[sIdx].id);
      const studentDocChanged =
        freshStudents[sIdx].currentPoints !== studentTotalPoints ||
        freshStudents[sIdx].attendanceRate !== stats.attendanceRate ||
        freshStudents[sIdx].streakDays !== stats.streakDays ||
        freshStudents[sIdx].consecutiveAbsences !== stats.consecutiveAbsences;

      freshStudents[sIdx].currentPoints = studentTotalPoints;
      freshStudents[sIdx].attendanceRate = stats.attendanceRate;
      freshStudents[sIdx].streakDays = stats.streakDays;
      freshStudents[sIdx].consecutiveAbsences = stats.consecutiveAbsences;
      saveItem(STORAGE_KEYS.STUDENTS, freshStudents);
      if (studentDocChanged) {
        syncToFirestore('students', freshStudents[sIdx]);
      }
    }

    notifySubscribers();
    return { success: true, message: 'تم إلغاء التقييم ومزامنة النقاط بنجاح', deletedRecord: old };
  }

  getEvaluationForStudentAndDate(studentId: string, date: string): EvaluationRecord | undefined {
    const evals = this.getEvaluationsList();
    return evals.find((e) => e.studentId === studentId && e.date === date);
  }

  getEvaluationsForCircleAndDate(circleId: string | string[], date: string): EvaluationRecord[] {
    const evals = this.getEvaluationsList();
    if (Array.isArray(circleId)) {
      const circleSet = new Set(circleId);
      return evals.filter((e) => circleSet.has(e.circleId) && e.date === date);
    }
    return evals.filter((e) => e.circleId === circleId && e.date === date);
  }

  getEvaluationsForCircleAndWeek(circleId: string | string[], weekDates: string[]): EvaluationRecord[] {
    const evals = this.getEvaluationsList();
    const datesSet = new Set(weekDates);
    if (Array.isArray(circleId)) {
      const circleSet = new Set(circleId);
      return evals.filter((e) => circleSet.has(e.circleId) && datesSet.has(e.date));
    }
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
    this.markStaticCacheFresh('rewards');
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
    this.markStaticCacheFresh('rewards');
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
    this.markStaticCacheFresh('rewards');
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
    this.markStaticCacheFresh('rewards');
    syncToFirestore('rewards', reward);

    const circle = this.getCircleById(student.circleId);
    const request: RedemptionRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
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
          this.markStaticCacheFresh('rewards');
          syncToFirestore('rewards', rewards[rIdx]);
        }
      }
    }

    requests[reqIndex] = req;
    saveItem(STORAGE_KEYS.REDEMPTIONS, requests);
    syncToFirestore('redemptions', req);

    const statusArabicLabel =
      params.status === 'approved'
        ? 'جاري تجهيز الطلب'
        : params.status === 'ready'
        ? 'جاهز للاستلام'
        : params.status === 'delivered'
        ? 'تم التسليم'
        : params.status === 'rejected'
        ? 'مرفوض'
        : 'بانتظار الموافقة';

    this.addAuditLog({
      actorId: params.handledBy,
      actorName: params.handledBy,
      actorRole: 'supervisor',
      action: `تحديث طلب استرداد إلى (${statusArabicLabel})`,
      details: `طلب ${req.rewardTitle} للطالب ${req.studentName} [${req.rewardCost} نقطة]${req.refunded ? ' - تمت إعادة النقاط' : ''}`,
      targetType: 'redemption',
      targetId: req.id,
    });

    notifySubscribers();
    return {
      success: true,
      message: `تم تحديث حالة الطلب إلى "${statusArabicLabel}" بنجاح.`,
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
        id: `exam_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
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
      details: `حضور مبكر: ${rules.attendanceEarly ?? 2}ن، حفظ: ${rules.memorizationMax ?? 2}ن، مراجعة: ${rules.revisionMax ?? 2}ن، انضباط: ${rules.disciplineMax ?? 2}ن، زي: ${rules.uniformMax ?? 2}ن`,
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
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    logs.unshift(newLog);
    if (logs.length > 150) logs.pop();
    saveItem(STORAGE_KEYS.AUDIT_LOGS, logs);
    syncToFirestore('audit_logs', newLog);
  }

  deleteAuditLog(logId: string): { success: boolean; message: string } {
    const logs = this.getAuditLogs();
    const target = logs.find((l) => l.id === logId);
    if (target?.targetType === 'point') {
      return {
        success: false,
        message: 'سجلات تعديل النقاط محمية ولا يمكن حذفها؛ يتم التصحيح بعملية عكسية جديدة.',
      };
    }
    const filtered = logs.filter((l) => l.id !== logId);
    saveItem(STORAGE_KEYS.AUDIT_LOGS, filtered);
    deleteFromFirestore('audit_logs', logId);
    deletedDocIds.add(logId);
    notifySubscribers();
    return { success: true, message: 'تم حذف السجل بنجاح' };
  }

  clearAllAuditLogs(): { success: boolean; message: string } {
    const logs = this.getAuditLogs();
    const preservedPointLogs = logs.filter((l) => l.targetType === 'point');
    logs
      .filter((l) => l.targetType !== 'point')
      .forEach((l) => {
        deleteFromFirestore('audit_logs', l.id);
        deletedDocIds.add(l.id);
      });
    saveItem(STORAGE_KEYS.AUDIT_LOGS, preservedPointLogs);
    notifySubscribers();
    return {
      success: true,
      message:
        preservedPointLogs.length > 0
          ? 'تم مسح السجلات غير المرتبطة بالنقاط مع الاحتفاظ بسجلات النقاط الموثقة.'
          : 'تم مسح كامل سجل العمليات بنجاح',
    };
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

  getSupportTicketsForUser(user: User): SupportTicket[] {
    const all = this.getSupportTickets();
    const cleanEmail = user.email?.trim().toLowerCase() || '';
    const candidateIds = new Set<string>();
    if (user.id) candidateIds.add(user.id);
    if (user.studentId) {
      candidateIds.add(user.studentId);
      candidateIds.add(`user_${user.studentId}`);
    }

    return all
      .filter((t) => {
        if (user.role === 'supervisor' && t.senderRole === 'supervisor') return true;
        if (t.senderId && candidateIds.has(t.senderId)) return true;
        if (cleanEmail && t.senderEmail && t.senderEmail.trim().toLowerCase() === cleanEmail) return true;
        return false;
      })
      .sort((a, b) => {
        if (Boolean(b.unreadByUser) !== Boolean(a.unreadByUser)) {
          return b.unreadByUser ? 1 : -1;
        }
        const timeA = new Date(a.adminReplyAt || a.createdAt).getTime();
        const timeB = new Date(b.adminReplyAt || b.createdAt).getTime();
        return timeB - timeA;
      });
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
      id: `ticket_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
      status: 'new',
      replies: [],
      unreadByUser: false,
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

  replyToSupportTicket(params: {
    ticketId: string;
    message: string;
    senderName: string;
    senderRole: Role;
    markResolved?: boolean;
  }): { success: boolean; message: string; ticket?: SupportTicket } {
    const cleanMsg = params.message.trim();
    if (!cleanMsg) {
      return { success: false, message: 'الرجاء كتابة نص الرد أولاً' };
    }

    const list = this.getSupportTickets();
    const idx = list.findIndex((t) => t.id === params.ticketId);
    if (idx === -1) return { success: false, message: 'التذكرة غير موجودة' };

    const existing = list[idx];
    const nowIso = new Date().toISOString();
    const existingReplies: SupportTicketReply[] = Array.isArray(existing.replies) ? [...existing.replies] : [];

    const isSupportReply = params.senderRole === 'admin';
    const resolvedSenderName = isSupportReply ? 'الدعم الفني' : params.senderName;

    // Preserve legacy adminReply if replies array was empty
    if (existingReplies.length === 0 && existing.adminReply) {
      existingReplies.push({
        id: `reply_legacy_${existing.id}`,
        message: existing.adminReply,
        senderName: 'الدعم الفني',
        senderRole: 'admin',
        createdAt: existing.adminReplyAt || existing.createdAt,
      });
    }

    const newReply: SupportTicketReply = {
      id: `reply_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      message: cleanMsg,
      senderName: resolvedSenderName,
      senderRole: params.senderRole,
      createdAt: nowIso,
    };
    existingReplies.push(newReply);

    const nextStatus: SupportTicket['status'] = isSupportReply
      ? params.markResolved
        ? 'resolved'
        : existing.status === 'new'
        ? 'in_progress'
        : existing.status
      : existing.status === 'resolved'
      ? 'in_progress'
      : existing.status;

    const updatedTicket: SupportTicket = {
      ...existing,
      replies: existingReplies,
      status: nextStatus,
      ...(isSupportReply
        ? {
            adminReply: cleanMsg,
            adminReplyAt: nowIso,
            adminReplyBy: 'الدعم الفني',
            unreadByUser: true,
          }
        : {
            unreadByUser: false,
          }),
    };

    list[idx] = updatedTicket;
    saveItem(STORAGE_KEYS.SUPPORT_TICKETS, list);
    syncToFirestore('support_tickets', updatedTicket);

    if (isSupportReply) {
      this.addAuditLog({
        actorId: params.senderName,
        actorName: params.senderName,
        actorRole: 'admin',
        action: 'الرد على تذكرة دعم فني',
        details: `رد على تذكرة ${existing.senderName}: ${cleanMsg.slice(0, 60)}${cleanMsg.length > 60 ? '...' : ''}`,
        targetType: 'settings',
        targetId: existing.id,
      });
    }

    notifySubscribers();
    return {
      success: true,
      message: isSupportReply ? 'تم إرسال الرد لصندوق وارد المرسل بنجاح' : 'تم إرسال ردك للدعم الفني بنجاح',
      ticket: updatedTicket,
    };
  }

  markSupportTicketAsRead(ticketId: string): { success: boolean } {
    const list = this.getSupportTickets();
    const idx = list.findIndex((t) => t.id === ticketId);
    if (idx === -1) return { success: false };
    if (!list[idx].unreadByUser) return { success: true };

    list[idx] = {
      ...list[idx],
      unreadByUser: false,
      userLastReadAt: new Date().toISOString(),
    };
    saveItem(STORAGE_KEYS.SUPPORT_TICKETS, list);
    syncToFirestore('support_tickets', list[idx]);
    notifySubscribers();
    return { success: true };
  }

  async closeSupportTicket(ticketId: string): Promise<{ success: boolean; message: string }> {
    if (!ticketId) {
      return { success: false, message: 'معرّف التذكرة غير صالح' };
    }

    const ticketPath = `support_tickets/${ticketId}`;
    deletedDocIds.add(ticketId);
    syncedHashes.delete(`support_tickets_${ticketId}`);

    // Remove from local support tickets immediately
    const list = this.getSupportTickets();
    const filtered = list.filter((t) => t.id !== ticketId);
    saveItem(STORAGE_KEYS.SUPPORT_TICKETS, filtered);

    // Remove any local audit logs linked to this ticket so no trace remains
    const logs = this.getAuditLogs();
    const removedLogIds = new Set<string>();
    const remainingLogs = logs.filter((l) => {
      if (l.targetId === ticketId) {
        removedLogIds.add(l.id);
        deletedDocIds.add(l.id);
        syncedHashes.delete(`audit_logs_${l.id}`);
        return false;
      }
      return true;
    });
    if (removedLogIds.size > 0) {
      saveItem(STORAGE_KEYS.AUDIT_LOGS, remainingLogs);
    }

    notifySubscribers();

    updateSyncState({
      status: 'syncing',
      pendingWritesCount: currentSyncStatus.pendingWritesCount + 1,
    });

    try {
      // Permanently delete the support ticket document (and its embedded replies) from Firestore
      await deleteDoc(doc(db, 'support_tickets', ticketId));

      // Purge any server-side audit logs referencing this ticketId to free space completely
      try {
        const auditSnap = await getDocs(
          query(collection(db, 'audit_logs'), where('targetId', '==', ticketId))
        );
        const serverDeletePromises: Promise<void>[] = [];
        auditSnap.forEach((d) => {
          deletedDocIds.add(d.id);
          syncedHashes.delete(`audit_logs_${d.id}`);
          serverDeletePromises.push(deleteDoc(d.ref));
        });
        removedLogIds.forEach((logId) => {
          if (!auditSnap.docs.some((d) => d.id === logId)) {
            serverDeletePromises.push(deleteDoc(doc(db, 'audit_logs', logId)));
          }
        });
        if (serverDeletePromises.length > 0) {
          await Promise.all(serverDeletePromises);
        }
      } catch (auditErr: any) {
        console.warn('Linked audit log cleanup notice:', auditErr?.message || auditErr);
      }

      updateSyncState({
        status: 'connected',
        lastUpdated: new Date(),
        pendingWritesCount: Math.max(0, currentSyncStatus.pendingWritesCount - 1),
        errorMessage: undefined,
      });

      notifySubscribers();
      return {
        success: true,
        message: 'تم إغلاق التذكرة وحذفها نهائياً من السجلات والخادم',
      };
    } catch (err: any) {
      updateSyncState({
        status: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error',
        errorMessage: err?.message,
        pendingWritesCount: Math.max(0, currentSyncStatus.pendingWritesCount - 1),
      });

      if (err?.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.DELETE, ticketPath);
      }

      return {
        success: false,
        message: 'تعذر حذف التذكرة من الخادم، تحقق من الاتصال وحاول مجدداً',
      };
    }
  }

  deleteSupportTicket(ticketId: string): Promise<{ success: boolean; message: string }> {
    return this.closeSupportTicket(ticketId);
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
