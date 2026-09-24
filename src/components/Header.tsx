import React from 'react';
import { useApp } from '../context/AppContext';
import { ThemeIconButton } from '../context/ThemeContext';
import { ArrowLeftRight, Eye, GraduationCap, LogIn, Menu, UserPlus, WifiOff } from 'lucide-react';

export const BrandMark: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <div
    className={`${className} rounded-xl bg-linear-to-br from-indigo-500 to-indigo-800 flex items-center justify-center text-white shadow-md shadow-indigo-900/20 ring-1 ring-white/20 relative shrink-0`}
    aria-hidden="true"
  >
    <GraduationCap className="w-[55%] h-[55%]" />
    <span className="absolute -bottom-0.5 -left-0.5 w-3 h-3 rounded-full bg-amber-400 ring-2 ring-white" />
  </div>
);

interface HeaderProps {
  title: string;
  onOpenAuth: (mode?: 'login' | 'signup') => void;
  /** Opens the sidebar drawer (the three-line button, phones and tablets only). */
  onOpenMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ title, onOpenAuth, onOpenMenu }) => {
  const { currentUser, isImpersonating, originalDoctor, exitImpersonation, syncState } = useApp();

  return (
    <header
      className="sticky top-0 z-30 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-700 print:hidden"
      id="app-main-header"
    >
      {isImpersonating && originalDoctor && (
        <div
          id="impersonation-banner"
          role="status"
          className="bg-linear-to-l from-amber-400 to-amber-300 text-slate-950 border-b border-amber-500/40"
        >
          <div className="px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm">
              <span className="p-1.5 bg-slate-950/10 rounded-lg">
                <Eye className="w-4 h-4" />
              </span>
              <span className="font-black">وضع المعاينة</span>
              <span className="bg-white/70 dark:bg-slate-900/70 px-2 py-0.5 rounded-md font-bold">{currentUser?.name}</span>
              <span className="hidden sm:inline">التغييرات هنا لا تُحفظ في سجل الحساب.</span>
            </div>
            <button
              id="exit-impersonation-btn"
              onClick={exitImpersonation}
              className="flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 dark:hover:bg-slate-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              العودة للوحة الدكتور
            </button>
          </div>
        </div>
      )}

      <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-3">
        {currentUser && onOpenMenu && (
          <button
            onClick={onOpenMenu}
            aria-label="فتح القائمة"
            aria-controls="app-sidebar"
            className="lg:hidden p-2.5 -ms-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Menu className="w-6 h-6" />
          </button>
        )}

        {currentUser ? (
          <h1 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 truncate">{title}</h1>
        ) : (
          <div className="flex items-center gap-3 min-w-0">
            <BrandMark />
            <div className="min-w-0 hidden min-[440px]:block">
              <h1 className="text-sm sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 leading-tight truncate">
                المنصة التعليمية الأكاديمية
              </h1>
              <p className="text-[12px] text-slate-500 dark:text-slate-400 hidden sm:block leading-tight">بوابة الدكتور والطلاب لإدارة التعلم</p>
            </div>
          </div>
        )}

        <div className="flex-1" />

        {syncState === 'offline' && (
          <span
            role="status"
            className="hidden sm:flex items-center gap-1.5 text-[12px] font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 px-2.5 py-1 rounded-lg"
          >
            <WifiOff className="w-3.5 h-3.5" />
            غير متصل بالخادم، ستُحفظ التغييرات عند عودة الاتصال
          </span>
        )}

        <ThemeIconButton />

        {!currentUser && (
          <>
            <button
              id="header-signin-btn"
              onClick={() => onOpenAuth('login')}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              <LogIn className="w-4 h-4" />
              <span className="hidden sm:inline">تسجيل الدخول</span>
            </button>
            <button
              id="header-signup-btn"
              onClick={() => onOpenAuth('signup')}
              className="flex items-center gap-1.5 whitespace-nowrap bg-indigo-600 hover:bg-indigo-700 text-white px-3 sm:px-4 py-2 rounded-xl text-xs font-bold shadow-sm shadow-indigo-900/20 transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              إنشاء حساب
            </button>
          </>
        )}
      </div>
    </header>
  );
};
