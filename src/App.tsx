/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { Header } from './components/common/Header';
import { LoginView } from './components/auth/LoginView';
import { PWAInstallBanner } from './components/common/PWAInstallBanner';
import { Footer } from './components/common/Footer';
import { SupportTicketModal } from './components/support/SupportTicketModal';

const StudentView = lazy(() => import('./components/student/StudentView').then((m) => ({ default: m.StudentView })));
const TeacherView = lazy(() => import('./components/teacher/TeacherView').then((m) => ({ default: m.TeacherView })));
const SupervisorView = lazy(() => import('./components/supervisor/SupervisorView').then((m) => ({ default: m.SupervisorView })));
const AdminView = lazy(() => import('./components/admin/AdminView').then((m) => ({ default: m.AdminView })));

function AppContent() {
  const { currentUser, isAuthenticated } = useAuth();
  const [resetKey, setResetKey] = useState(0);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);

  if (!isAuthenticated || !currentUser) {
    return <LoginView />;
  }

  const handleResetData = () => {
    setResetKey((prev) => prev + 1);
  };

  return (
    <div key={resetKey} className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 w-full max-w-full">
      {/* Top Header (shown for non-teacher roles; teacher has unified single-line header) */}
      {currentUser.role !== 'teacher' && <Header onResetData={handleResetData} />}

      {/* Main Role-Specific View */}
      <main className="flex-1 w-full max-w-full">
        <Suspense
          fallback={
            <div className="flex items-center justify-center min-h-[50vh] text-teal-700 text-sm font-bold">
              جارٍ التحميل...
            </div>
          }
        >
          {currentUser.role === 'student' && <StudentView currentUser={currentUser} />}
          {currentUser.role === 'teacher' && <TeacherView currentUser={currentUser} />}
          {currentUser.role === 'supervisor' && <SupervisorView currentUser={currentUser} />}
          {currentUser.role === 'admin' && <AdminView currentUser={currentUser} />}
        </Suspense>
      </main>

      {/* Universal Footer with Support Ticket link */}
      <Footer onOpenSupport={() => setIsSupportModalOpen(true)} />

      {/* Support Ticket Modal */}
      <SupportTicketModal
        isOpen={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppContent />
        <PWAInstallBanner />
      </AuthProvider>
    </ToastProvider>
  );
}
