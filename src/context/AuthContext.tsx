import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Role } from '../types';
import { INITIAL_USERS, SUPERVISOR_UID, TECH_SUPPORT_UID } from '../data/mockData';
import { repository } from '../services/storageService';
import { auth, db } from '../lib/firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface AuthContextType {
  currentUser: User | null;
  login: (email: string, pass: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  switchUser: (role: Role, specificUserId?: string) => void;
  switchTeacherCircle: (circleId: string) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'tartil_auth_user_v2';

const createSupervisorUser = (email?: string, id?: string): User => ({
  id: id || SUPERVISOR_UID,
  email: email || '',
  name: 'الشيخ عبدالله بري',
  role: 'supervisor',
  createdAt: '2026-10-28T00:00:00Z',
});

const createTechSupportUser = (email?: string, id?: string): User => ({
  id: id || TECH_SUPPORT_UID,
  email: email || '',
  name: 'المهندس بسيل',
  role: 'admin',
  createdAt: '2026-10-28T00:00:00Z',
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load session:', e);
    }
    return null;
  });

  // Listen to Firebase Auth state & ensure supervisor and tech support UIDs are mapped
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        if (firebaseUser.uid === SUPERVISOR_UID) {
          const supervisor = createSupervisorUser(firebaseUser.email || undefined, firebaseUser.uid);
          setCurrentUser(supervisor);
          return;
        }

        if (firebaseUser.uid === TECH_SUPPORT_UID) {
          const techSupport = createTechSupportUser(firebaseUser.email || undefined, firebaseUser.uid);
          setCurrentUser(techSupport);
          return;
        }

        // Check if teacher UID matches any official teacher
        const matchedTeacherUser = INITIAL_USERS.find(
          (u) => u.id === firebaseUser.uid && u.role === 'teacher'
        );
        if (matchedTeacherUser) {
          const teacherUser: User = {
            ...matchedTeacherUser,
            email: firebaseUser.email || matchedTeacherUser.email,
          };
          setCurrentUser(teacherUser);
          return;
        }

        // Check if student UID matches any official student
        const matchedStudentUser = INITIAL_USERS.find(
          (u) => u.id === firebaseUser.uid && u.role === 'student'
        );
        if (matchedStudentUser) {
          const studentUser: User = {
            ...matchedStudentUser,
            email: firebaseUser.email || matchedStudentUser.email,
          };
          setCurrentUser(studentUser);
          return;
        }

        // Check if user has registered role in Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data() as User;
            setCurrentUser(data);
          }
        } catch (e: any) {
          if (e?.code !== 'permission-denied') {
            console.warn('Firestore user fetch notice:', e);
          }
        }
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, [currentUser]);

  const login = async (email: string, pass: string): Promise<{ success: boolean; message?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, message: 'يرجى إدخال البريد الإلكتروني' };
    }

    // 1. Try Firebase Auth with email & password
    if (pass) {
      try {
        const cred = await signInWithEmailAndPassword(auth, cleanEmail, pass);
        // If the authenticated user in Firebase has the supervisor UID, grant supervisor role
        if (cred.user.uid === SUPERVISOR_UID) {
          const supervisor = createSupervisorUser(cred.user.email || cleanEmail, cred.user.uid);
          setCurrentUser(supervisor);
          try {
            await setDoc(doc(db, 'users', SUPERVISOR_UID), {
              ...supervisor,
              uid: SUPERVISOR_UID,
            }, { merge: true });
          } catch {
            // Ignore
          }
          return { success: true };
        }

        // If the authenticated user in Firebase has the Tech Support UID, grant admin role
        if (cred.user.uid === TECH_SUPPORT_UID) {
          const techSupport = createTechSupportUser(cred.user.email || cleanEmail, cred.user.uid);
          setCurrentUser(techSupport);
          try {
            await setDoc(doc(db, 'users', TECH_SUPPORT_UID), {
              ...techSupport,
              uid: TECH_SUPPORT_UID,
            }, { merge: true });
          } catch {
            // Ignore
          }
          return { success: true };
        }

        // Check if the authenticated Firebase UID belongs to an official teacher
        const matchedTeacherUser = INITIAL_USERS.find(
          (u) => u.id === cred.user.uid && u.role === 'teacher'
        );
        if (matchedTeacherUser) {
          const teacherUser: User = {
            ...matchedTeacherUser,
            email: cred.user.email || cleanEmail,
          };
          setCurrentUser(teacherUser);
          try {
            await setDoc(doc(db, 'users', cred.user.uid), {
              ...teacherUser,
              uid: cred.user.uid,
            }, { merge: true });
          } catch {
            // Ignore
          }
          return { success: true };
        }

        // Check if the authenticated Firebase UID belongs to an official student
        const matchedStudentUser = INITIAL_USERS.find(
          (u) => u.id === cred.user.uid && u.role === 'student'
        );
        if (matchedStudentUser) {
          const studentUser: User = {
            ...matchedStudentUser,
            email: cred.user.email || cleanEmail,
          };
          setCurrentUser(studentUser);
          try {
            await setDoc(doc(db, 'users', cred.user.uid), {
              ...studentUser,
              uid: cred.user.uid,
            }, { merge: true });
          } catch {
            // Ignore
          }
          return { success: true };
        }

        // Check Firestore user doc for role
        const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data() as User;
          setCurrentUser(data);
          return { success: true };
        }
      } catch (err: any) {
        console.warn('Firebase login attempt:', err?.message);
      }
    }

    // 3. Check credentials against INITIAL_USERS
    const matchedUser = INITIAL_USERS.find(
      (u) => u.email.toLowerCase() === cleanEmail
    );
    if (matchedUser) {
      setCurrentUser(matchedUser);
      return { success: true };
    }

    // 4. Check against real teachers registered in the system
    const teachers = repository.getTeachers();
    const matchedTeacher = teachers.find(
      (t) => t.email && t.email.toLowerCase() === cleanEmail
    );
    if (matchedTeacher) {
      const user: User = {
        id: `user_${matchedTeacher.id}`,
        email: matchedTeacher.email || `${matchedTeacher.id}@zuhaia.com`,
        name: matchedTeacher.name,
        role: 'teacher',
        circleId: matchedTeacher.circleIds[0] || 'circle_othman',
        createdAt: new Date().toISOString(),
      };
      setCurrentUser(user);
      return { success: true };
    }

    // 5. Check against real students registered in the system
    const students = repository.getStudents();
    const matchedStudent = students.find(
      (s) => s.email && s.email.toLowerCase() === cleanEmail
    );
    if (matchedStudent) {
      const user: User = {
        id: `user_${matchedStudent.id}`,
        email: matchedStudent.email,
        name: matchedStudent.name,
        role: 'student',
        studentId: matchedStudent.id,
        circleId: matchedStudent.circleId,
        createdAt: new Date().toISOString(),
      };
      setCurrentUser(user);
      return { success: true };
    }

    return {
      success: false,
      message: 'بيانات الدخول غير مسجلة في النظام. يرجى التحقق من صحة البيانات.',
    };
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('SignOut error:', e);
    }
    setCurrentUser(null);
  };

  const switchUser = (role: Role, specificUserId?: string) => {
    if (specificUserId) {
      const matched = INITIAL_USERS.find((u) => u.id === specificUserId);
      if (matched) {
        setCurrentUser(matched);
        return;
      }
    }
    const matched = INITIAL_USERS.find((u) => u.role === role);
    if (matched) {
      setCurrentUser(matched);
    }
  };

  const switchTeacherCircle = (circleId: string) => {
    if (currentUser && currentUser.role === 'teacher') {
      setCurrentUser({ ...currentUser, circleId });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        login,
        logout,
        switchUser,
        switchTeacherCircle,
        isAuthenticated: !!currentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
