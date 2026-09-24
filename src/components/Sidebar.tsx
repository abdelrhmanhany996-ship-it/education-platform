import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { ThemeSwitch } from '../context/ThemeContext';
import { BrandMark } from './Header';
import { DEMO_ACCOUNTS } from '../demoAccounts';
import { ASSISTANT_NAV, DOCTOR_NAV, STUDENT_NAV, NavItem, PageId } from '../nav';
import { ArrowLeftRight, Check, ChevronDown, KeyRound, LogOut, X } from 'lucide-react';

interface Props {
  page: PageId;
  onNavigate: (p: PageId) => void;
  open: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<Props> = ({ page, onNavigate, open, onClose }) => {
  const {
    currentUser,
    isImpersonating,
    users,
    enrollments,
    logout,
    exitImpersonation,
    quickLogin,
    getPendingEssays,
    getStudentAnalytics,
    getChatThreadsForStaff,
    getChatDoctors,
    getChatThread
  } = useApp();
  const [demoOpen, setDemoOpen] = useState(false);

  const isDoctorView = currentUser?.role === 'doctor' && !isImpersonating;
  const isAssistantView = currentUser?.role === 'assistant';
  const items: NavItem[] = isDoctorView ? DOCTOR_NAV : isAssistantView ? ASSISTANT_NAV : STUDENT_NAV;

  // Live counters next to the doctor's/assistant's menu items
  const counts: Record<string, number> = {};
  if (isDoctorView || isAssistantView) {
    counts.enrollments = enrollments.filter(e => e.status === 'pending_contact').length;
    counts.chat = getChatThreadsForStaff().reduce((sum, t) => sum + t.unread, 0);
  }
  if (isDoctorView) {
    counts.grading = getPendingEssays().length;
    counts.alerts = users
      .filter(u => u.role === 'student')
      .filter(u => {
        const a = getStudentAnalytics(u.id);
        return a?.hasAbsenceAlarm || a?.hasPerformanceAlarm;
      }).length;
  }
  if (!isDoctorView && !isAssistantView) {
    counts.chat = getChatDoctors().reduce(
      (sum, d) => sum + getChatThread(d.doctorId).filter(m => m.senderRole !== 'student' && !m.readByStudent).length,
      0
    );
  }

  // Close the drawer with Escape and lock page scroll behind it
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!currentUser) return null;

  const groups = items.reduce<Record<string, NavItem[]>>((acc, it) => {
    (acc[it.group] ||= []).push(it);
    return acc;
  }, {});

  const roleLabel = isDoctorView ? 'لوحة الدكتور' : isAssistantView ? 'لوحة المساعد' : 'بوابة الطالب';

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-xs lg:hidden animate-fade"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        id="app-sidebar"
        aria-label="القائمة الرئيسية"
        className={`fixed inset-y-0 start-0 z-50 w-72 max-w-[85vw] flex flex-col bg-white dark:bg-slate-900 border-e border-slate-200 dark:border-slate-700 transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:h-screen lg:z-20 lg:max-w-none lg:translate-x-0 lg:shrink-0 print:hidden ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-16 px-4 flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <BrandMark className="w-9 h-9" />
            <div className="min-w-0">
              <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100 leading-tight truncate">المنصة الأكاديمية</div>
              <div className="text-[12px] text-slate-500 dark:text-slate-400 leading-tight">{roleLabel}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="إغلاق القائمة"
            className="lg:hidden p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto scroll-thin px-3 py-4 space-y-5">
          {Object.entries(groups).map(([group, list]) => (
            <div key={group} className="space-y-1">
              <div className="px-3 pb-1 text-[12px] font-bold text-slate-400">{group}</div>
              {list.map(it => {
                const active = page === it.id;
                const count = it.badge ? counts[it.badge] : 0;
                return (
                  <button
                    key={it.id}
                    id={`nav-${it.id}`}
                    onClick={() => {
                      onNavigate(it.id);
                      onClose();
                    }}
                    aria-current={active ? 'page' : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors text-start ${
                      active
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-900/20'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <it.icon className={`w-[18px] h-[18px] shrink-0 ${active ? '' : 'text-slate-400'}`} />
                    <span className="flex-1 truncate">{it.label}</span>
                    {count > 0 && (
                      <span
                        className={`min-w-5 h-5 px-1.5 rounded-full text-[12px] font-black flex items-center justify-center ${
                          active ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300' : 'bg-rose-500 text-white'
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-3 space-y-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
          {/* Demo account switcher */}
          <div id="quick-demo-accounts-bar">
            <button
              onClick={() => setDemoOpen(o => !o)}
              aria-expanded={demoOpen}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <KeyRound className="w-4 h-4 text-amber-500" />
              <span className="flex-1 text-start">حسابات تجريبية</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${demoOpen ? 'rotate-180' : ''}`} />
            </button>
            {demoOpen && (
              <div className="mt-1 space-y-0.5 animate-fade">
                {DEMO_ACCOUNTS.map(a => {
                  const active = currentUser.username === a.username && !isImpersonating;
                  return (
                    <button
                      key={a.username}
                      onClick={() => {
                        quickLogin(a.username);
                        onClose();
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-start text-xs ${
                        active ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-900 dark:text-indigo-200' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span className={`w-7 h-7 rounded-md flex items-center justify-center ${a.tone}`}>
                        <a.icon className="w-3.5 h-3.5" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-bold truncate">{a.name}</span>
                        <span className="block text-[12px] text-slate-500 dark:text-slate-400">{a.role}</span>
                      </span>
                      {active && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <ThemeSwitch />

          <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5">
            {currentUser.avatar ? (
              <img src={currentUser.avatar} alt="" className="w-9 h-9 rounded-lg object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-sm">
                {currentUser.name.slice(0, 1)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{currentUser.name}</div>
              <div className="text-[12px] text-slate-500 dark:text-slate-400">
                {currentUser.role === 'doctor' ? 'دكتور' : currentUser.role === 'assistant' ? 'مساعد' : 'طالب'}
              </div>
            </div>
            {isImpersonating ? (
              <button
                onClick={exitImpersonation}
                title="إنهاء المعاينة"
                aria-label="إنهاء المعاينة"
                className="p-2 rounded-lg text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/15"
              >
                <ArrowLeftRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                id="header-logout-btn"
                onClick={logout}
                title="تسجيل الخروج"
                aria-label="تسجيل الخروج"
                className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
