/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ThemeProvider } from './context/ThemeContext';
import { Header, BrandMark } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { DoctorDashboard } from './components/DoctorDashboard';
import { DoctorCourses } from './components/DoctorCourses';
import {
  ActivityReport,
  AlertsPage,
  DoctorCertificates,
  EssayGrading,
  GroupsManager,
  SettingsPage
} from './components/DoctorTools';
import { EnrollmentRequests } from './components/EnrollmentRequests';
import { AssistantFiles, AssistantMessages } from './components/AssistantTools';
import { StaffChatPage, StudentChatPage } from './components/ChatPage';
import { QuizImportPage } from './components/QuizImportPage';
import { StudentDashboard } from './components/StudentDashboard';
import { StudentCertificatePage } from './components/StudentCertificatePage';
import { StudentAccountPage } from './components/StudentAccountPage';
import { LeaderboardModal } from './components/LeaderboardModal';
import { LandingPage } from './components/LandingPage';
import { AuthModal } from './components/AuthModal';
import { ASSISTANT_NAV, DOCTOR_NAV, STUDENT_NAV, PageId } from './nav';
import { Loader2, WifiOff } from 'lucide-react';

const MainContent: React.FC = () => {
  const { currentUser, isImpersonating, status, retryConnect, logout } = useApp();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [menuOpen, setMenuOpen] = useState(false);

  const isDoctorView = currentUser?.role === 'doctor' && !isImpersonating;
  const isAssistantView = currentUser?.role === 'assistant';
  const nav = isDoctorView ? DOCTOR_NAV : isAssistantView ? ASSISTANT_NAV : STUDENT_NAV;
  const [page, setPage] = useState<PageId>('overview');

  // Each role has its own menu: land on its first page when the role changes
  const validPage = nav.some(n => n.id === page) ? page : nav[0].id;
  useEffect(() => {
    if (validPage !== page) setPage(validPage);
  }, [validPage, page]);

  const navigate = (p: PageId) => {
    setPage(p);
    setMenuOpen(false);
    window.scrollTo({ top: 0 });
  };

  const openAuth = (mode: 'login' | 'signup' = 'login') => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  const title = nav.find(n => n.id === validPage)?.label || '';

  const renderPage = () => {
    if (!currentUser) return <LandingPage onOpenAuth={openAuth} />;

    if (isDoctorView) {
      switch (validPage) {
        case 'overview':
        case 'students':
          return <DoctorDashboard page={validPage} onNavigate={navigate} />;
        case 'enrollments':
          return <EnrollmentRequests canApprove />;
        case 'courses':
          return <DoctorCourses />;
        case 'quizImport':
          return <QuizImportPage />;
        case 'grading':
          return <EssayGrading />;
        case 'groups':
          return <GroupsManager />;
        case 'leaderboard':
          return <LeaderboardModal isOpen asPage onClose={() => undefined} />;
        case 'certificates':
          return <DoctorCertificates />;
        case 'alerts':
          return <AlertsPage />;
        case 'chat':
          return <StaffChatPage />;
        case 'activity':
          return <ActivityReport />;
        case 'settings':
          return <SettingsPage />;
      }
    }

    if (isAssistantView) {
      switch (validPage) {
        case 'enrollments':
          return <EnrollmentRequests canApprove={false} />;
        case 'messages':
          return <AssistantMessages />;
        case 'chat':
          return <StaffChatPage />;
        case 'files':
          return <AssistantFiles />;
      }
    }

    if (validPage === 'leaderboard') return <LeaderboardModal isOpen asPage onClose={() => undefined} />;
    if (validPage === 'certificate') return <StudentCertificatePage />;
    if (validPage === 'chat') return <StudentChatPage />;
    if (validPage === 'account') return <StudentAccountPage />;
    return <StudentDashboard onOpenAuth={() => openAuth('login')} />;
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600 dark:text-slate-300 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
        <span className="text-sm font-bold">جارٍ تحميل البيانات...</span>
      </div>
    );
  }

  if (status === 'offline') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="surface p-8 max-w-md text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 mx-auto flex items-center justify-center">
            <WifiOff className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-black text-slate-900">تعذّر الاتصال بالخادم</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            تأكد أن الخادم يعمل (الأمر <span dir="ltr" className="font-mono">npm run dev</span>) ثم أعد المحاولة.
          </p>
          <div className="flex justify-center gap-2">
            <button onClick={retryConnect} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold">إعادة المحاولة</button>
            <button onClick={logout} className="px-5 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-bold">تسجيل الخروج</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:flex">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-[60] focus:bg-white dark:focus:bg-slate-900 focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lift"
      >
        تخطي إلى المحتوى
      </a>

      {currentUser && (
        <Sidebar page={validPage} onNavigate={navigate} open={menuOpen} onClose={() => setMenuOpen(false)} />
      )}

      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        <Header title={title} onOpenAuth={openAuth} onOpenMenu={() => setMenuOpen(true)} />

        <main id="main" className="flex-1">
          {renderPage()}
        </main>

        <footer className="border-t border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 mt-10 print:hidden">
          <div className="px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300 font-bold">
              <BrandMark className="w-7 h-7" />
              <span>المنصة التعليمية الأكاديمية © {new Date().getFullYear()}</span>
            </div>
            <p>نسخة تجريبية · البيانات محفوظة محلياً على هذا الجهاز</p>
          </div>
        </footer>
      </div>

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} initialMode={authMode} />
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <MainContent />
      </AppProvider>
    </ThemeProvider>
  );
}
