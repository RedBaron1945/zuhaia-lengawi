/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { Header } from './components/common/Header';
import { LoginView } from './components/auth/LoginView';
import { StudentView } from './components/student/StudentView';
import { TeacherView } from './components/teacher/TeacherView';
import { SupervisorView } from './components/supervisor/SupervisorView';
import { AdminView } from './components/admin/AdminView';
import { PWAInstallBanner } from './components/common/PWAInstallBanner';
import { Footer } from './components/common/Footer';
import { SupportTicketModal } from './components/support/SupportTicketModal';

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
        {currentUser.role === 'student' && <StudentView currentUser={currentUser} />}
        {currentUser.role === 'teacher' && <TeacherView currentUser={currentUser} />}
        {currentUser.role === 'supervisor' && <SupervisorView currentUser={currentUser} />}
        {currentUser.role === 'admin' && <AdminView currentUser={currentUser} />}
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
