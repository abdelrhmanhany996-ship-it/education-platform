import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { User } from '../types';
import { StudentDetailsModal } from './StudentDetailsModal';
import { StudentReportModal } from './StudentReportModal';
import { QuickCertificateModal } from './QuickCertificateModal';
import { AddUserModal } from './AddUserModal';
import { WhatsAppModal } from './WhatsAppModal';
import { TelegramModal } from './TelegramModal';
import { StudentDistributionChart } from './StudentDistributionChart';
import { formatDateTime } from '../utils/format';
import type { PageId } from '../nav';
import {
  AlertTriangle,
  ArrowUpDown,
  Award,
  CalendarClock,
  ChevronLeft,
  ClipboardCheck,
  Eye,
  GraduationCap,
  MessageCircle,
  Printer,
  Search,
  Send,
  ShieldCheck,
  TrendingDown,
  Trophy,
  Upload,
  UserPlus
} from 'lucide-react';
import { Avatar } from './Avatar';

interface Props {
  page: 'overview' | 'students';
  onNavigate: (page: PageId) => void;
}

type WaType = 'consecutive_absence' | 'performance_drop' | 'quiz_reminder' | 'certificate_award';

export const DoctorDashboard: React.FC<Props> = ({ page, onNavigate }) => {
  const {
    users,
    currentUser,
    courses,
    studentStates,
    impersonateStudent,
    getStudentAnalytics,
    getLeaderboard,
    getPendingEssays,
    activityLogs
  } = useApp();

  const students = useMemo(() => users.filter(u => u.role === 'student'), [users]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'absence_alarms' | 'drop_alarms' | 'top_performers'>('all');
  const [sortBy, setSortBy] = useState<'rank' | 'name' | 'attendance' | 'average'>('rank');
  const [visibleCount, setVisibleCount] = useState<number>(10);
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [reportStudent, setReportStudent] = useState<User | null>(null);
  const [quickCertStudent, setQuickCertStudent] = useState<User | null>(null);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [wa, setWa] = useState<{ student: User | null; type: WaType; ctx?: any }>({
    student: null,
    type: 'consecutive_absence'
  });
  const [waOpen, setWaOpen] = useState(false);
  const [tg, setTg] = useState<{ student: User | null; type: WaType; ctx?: any }>({
    student: null,
    type: 'consecutive_absence'
  });
  const [tgOpen, setTgOpen] = useState(false);

  // Reset pagination window when search or filter changes
  useEffect(() => {
    setVisibleCount(10);
  }, [searchQuery, filterMode, sortBy]);

  const course = courses[0];
  const lecturesAll = courses.flatMap(c => c.weeks.flatMap(w => w.lectures));
  const board = getLeaderboard();
  const topIds = new Set(board.slice(0, 3).map(e => e.studentId));
  const pendingEssays = getPendingEssays().length;

  const alarms = useMemo(() => {
    const m = new Map<string, NonNullable<ReturnType<typeof getStudentAnalytics>>>();
    students.forEach(s => {
      const a = getStudentAnalytics(s.id);
      if (a) m.set(s.id, a);
    });
    return m;
  }, [students, studentStates, courses]);

  let absenceCount = 0;
  let dropCount = 0;
  alarms.forEach(a => {
    if (a.hasAbsenceAlarm) absenceCount++;
    if (a.hasPerformanceAlarm) dropCount++;
  });

  const openWa = (student: User, type: WaType, ctx?: any) => {
    setWa({ student, type, ctx });
    setWaOpen(true);
  };
  const openTg = (student: User, type: WaType, ctx?: any) => {
    setTg({ student, type, ctx });
    setTgOpen(true);
  };

  const now = Date.now();
  const released = lecturesAll.filter(l => !l.releaseAt || new Date(l.releaseAt).getTime() <= now).length;

  const rankOf = (id: string) => board.find(e => e.studentId === id)?.rank ?? 999;

  // Search operates across the FULL stored students array
  const list = useMemo(() => {
    return students
      .filter(s => {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          !q ||
          s.name.toLowerCase().includes(q) ||
          s.academicId.toLowerCase().includes(q) ||
          s.username.toLowerCase().includes(q) ||
          s.phone.includes(q);
        const a = alarms.get(s.id);
        if (filterMode === 'absence_alarms') return matches && a?.hasAbsenceAlarm;
        if (filterMode === 'drop_alarms') return matches && a?.hasPerformanceAlarm;
        if (filterMode === 'top_performers') return matches && topIds.has(s.id);
        return matches;
      })
      .sort((x, y) => {
        if (sortBy === 'name') return x.name.localeCompare(y.name, 'ar');
        if (sortBy === 'attendance') return (alarms.get(y.id)?.attendanceRate || 0) - (alarms.get(x.id)?.attendanceRate || 0);
        if (sortBy === 'average') return (alarms.get(y.id)?.lastQuizzesAverage || 0) - (alarms.get(x.id)?.lastQuizzesAverage || 0);
        return rankOf(x.id) - rankOf(y.id);
      });
  }, [students, searchQuery, filterMode, alarms, topIds, sortBy, board]);

  /* ------------------------------ overview ------------------------------ */
  if (page === 'overview') {
    const needAttention = students.filter(s => alarms.get(s.id)?.hasAbsenceAlarm || alarms.get(s.id)?.hasPerformanceAlarm);
    const totalAlerts = absenceCount + dropCount;

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8" id="doctor-dashboard-container">
        {/* Hero Section */}
        <section className="relative overflow-hidden rounded-[2rem] bg-linear-to-br from-indigo-800 via-indigo-900 to-indigo-950 text-white shadow-lift animate-rise border border-indigo-700/30">
          <div className="absolute inset-0 hero-pattern opacity-60" aria-hidden="true" />
          <div className="absolute -top-24 -left-20 w-80 h-80 rounded-full bg-amber-400/15 blur-3xl" aria-hidden="true" />
          <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full bg-indigo-500/20 blur-3xl" aria-hidden="true" />
          
          <div className="relative p-7 sm:p-9 lg:p-10 flex flex-col xl:flex-row xl:items-center justify-between gap-8">
            <div className="space-y-3.5 max-w-3xl">
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/15 px-3.5 py-1.5 rounded-full text-xs font-bold text-amber-200">
                <ShieldCheck className="w-4 h-4 text-amber-300" />
                <span>لوحة أستاذ المقرر</span>
                <span className="text-white/40">·</span>
                <span className="text-white/80">{course?.title || 'المقرر الأكاديمي'}</span>
              </div>
              
              <h1 className="text-2xl sm:text-4xl font-black leading-tight tracking-tight">
                أهلاً بك، {currentUser?.name || course?.doctorName}
              </h1>
              
              <p className="text-sm sm:text-base text-indigo-100/90 leading-relaxed font-medium">
                {totalAlerts + pendingEssays > 0
                  ? `عندك ${totalAlerts} تنبيه أكاديمي و${pendingEssays} إجابة مقالية تنتظر المتابعة والتصحيح اليوم.`
                  : 'لا توجد تنبيهات ولا إجابات بانتظار التصحيح، جميع الطلاب في حالة متابعة ممتازة.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0 pt-2 xl:pt-0">
              <button
                id="upload-questions-btn"
                onClick={() => onNavigate('courses')}
                className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-950 px-5 py-3 rounded-2xl text-xs sm:text-sm font-black shadow-lg shadow-amber-950/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <Upload className="w-4 h-4" />
                رفع أسئلة / محاضرة
              </button>
              <button
                id="btn-add-account-doctor"
                onClick={() => setIsAddUserOpen(true)}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4.5 py-3 rounded-2xl text-xs sm:text-sm font-bold backdrop-blur-md hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <UserPlus className="w-4 h-4" />
                إضافة حساب
              </button>
              <button
                onClick={() => onNavigate('leaderboard')}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4.5 py-3 rounded-2xl text-xs sm:text-sm font-bold backdrop-blur-md hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <Trophy className="w-4 h-4 text-amber-300" />
                لوحة الشرف
              </button>
            </div>
          </div>
        </section>

        {/* Stats Grid */}
        <section aria-label="ملخص الأداء" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          <div className="surface p-6 flex items-start justify-between gap-4 hover:shadow-lift transition-all">
            <div className="space-y-1.5 min-w-0">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">الطلاب بالمنصة</span>
              <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-slate-100 leading-none">{students.length}</div>
              <p className="text-xs text-slate-500 dark:text-slate-400 pt-1.5 truncate">
                {released} من {lecturesAll.length} محاضرات منشورة
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-500/20">
              <GraduationCap className="w-6 h-6" />
            </div>
          </div>

          <div className={`surface p-6 flex items-start justify-between gap-4 transition-all hover:shadow-lift border-s-4 ${absenceCount ? 'border-s-rose-500' : 'border-s-slate-200 dark:border-s-slate-700'}`}>
            <div className="space-y-1.5 min-w-0">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">إنذار غياب متتالٍ</span>
              <div className={`text-3xl sm:text-4xl font-extrabold leading-none ${absenceCount ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'}`}>{absenceCount}</div>
              <button
                onClick={() => {
                  setFilterMode('absence_alarms');
                  onNavigate('students');
                }}
                className="text-xs text-rose-700 dark:text-rose-300 font-bold pt-1.5 hover:underline inline-flex items-center gap-1"
              >
                عرض المتغيبين ←
              </button>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-100 dark:border-rose-500/20">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>

          <div className={`surface p-6 flex items-start justify-between gap-4 transition-all hover:shadow-lift border-s-4 ${dropCount ? 'border-s-amber-500' : 'border-s-slate-200 dark:border-s-slate-700'}`}>
            <div className="space-y-1.5 min-w-0">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">هبوط أداء</span>
              <div className={`text-3xl sm:text-4xl font-extrabold leading-none ${dropCount ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100'}`}>{dropCount}</div>
              <button
                onClick={() => {
                  setFilterMode('drop_alarms');
                  onNavigate('students');
                }}
                className="text-xs text-amber-700 dark:text-amber-300 font-bold pt-1.5 hover:underline inline-flex items-center gap-1"
              >
                عرض المتراجعين ←
              </button>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-100 dark:border-amber-500/20">
              <TrendingDown className="w-6 h-6" />
            </div>
          </div>

          <div className={`surface p-6 flex items-start justify-between gap-4 transition-all hover:shadow-lift border-s-4 ${pendingEssays ? 'border-s-purple-500' : 'border-s-slate-200 dark:border-s-slate-700'}`}>
            <div className="space-y-1.5 min-w-0">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">مقالي بانتظار التصحيح</span>
              <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-slate-100 leading-none">{pendingEssays}</div>
              <button onClick={() => onNavigate('grading')} className="text-xs text-purple-700 dark:text-purple-300 font-bold pt-1.5 hover:underline inline-flex items-center gap-1">
                ابدأ التصحيح ←
              </button>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-100 dark:border-purple-500/20">
              <ClipboardCheck className="w-6 h-6" />
            </div>
          </div>
        </section>

        {/* Student Distribution Section */}
        <StudentDistributionChart
          students={students}
          alarms={alarms}
          onSelectFilter={(fm) => {
            setFilterMode(fm);
            onNavigate('students');
          }}
        />

        {/* Two-Column Insights */}
        <div className="grid xl:grid-cols-3 gap-6">
          <section className="surface p-6 xl:col-span-2 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3.5">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">يحتاجون متابعتك ({needAttention.length})</h3>
              <button onClick={() => onNavigate('alerts')} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                كل التنبيهات ←
              </button>
            </div>
            {needAttention.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center font-medium">لا يوجد طلاب عليهم إنذارات حالياً.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {needAttention.slice(0, 6).map(s => {
                  const a = alarms.get(s.id)!;
                  return (
                    <li key={s.id} className="py-3.5 flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100 truncate">{s.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                          {a.hasAbsenceAlarm && <span>لم يُكمل {a.consecutiveAbsences} محاضرات متتالية</span>}
                          {a.hasAbsenceAlarm && a.hasPerformanceAlarm && <span aria-hidden="true">·</span>}
                          {a.hasPerformanceAlarm && <span>هبوط في الأداء قدره {a.performanceDropPercentage}%</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() =>
                            a.hasAbsenceAlarm
                              ? openWa(s, 'consecutive_absence', { absenceCount: a.consecutiveAbsences })
                              : openWa(s, 'performance_drop', { dropPercentage: a.performanceDropPercentage })
                          }
                          className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 border border-emerald-200/80 dark:border-emerald-500/25 px-3.5 py-2 rounded-xl transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          واتساب
                        </button>
                        <button
                          onClick={() =>
                            a.hasAbsenceAlarm
                              ? openTg(s, 'consecutive_absence', { absenceCount: a.consecutiveAbsences })
                              : openTg(s, 'performance_drop', { dropPercentage: a.performanceDropPercentage })
                          }
                          title={s.telegramChatId ? undefined : 'الطالب لم يربط تليجرام بعد'}
                          className="flex items-center gap-1.5 text-xs font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-500/10 hover:bg-sky-100 dark:hover:bg-sky-500/20 border border-sky-200/80 dark:border-sky-500/25 px-3.5 py-2 rounded-xl transition-colors"
                        >
                          <Send className="w-3.5 h-3.5" />
                          تليجرام
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="surface p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3.5">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">المتصدرون</h3>
              <button onClick={() => onNavigate('leaderboard')} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                الكل ←
              </button>
            </div>
            <div className="space-y-2.5">
              {board.filter(e => e.quizzesCompleted > 0).slice(0, 3).map(e => (
                <div key={e.studentId} className="flex items-center gap-3.5 p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <span className="text-xl w-8 text-center shrink-0">{e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : '🥉'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{e.studentName}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{e.quizzesCompleted} كويز مكتمل</div>
                  </div>
                  <div className="text-base font-black text-indigo-700 dark:text-indigo-300 shrink-0">{e.totalPoints} ن</div>
                </div>
              ))}
              {board.every(e => e.quizzesCompleted === 0) && (
                <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center font-medium">لم يُنهِ أحد كويزاً بعد.</p>
              )}
            </div>
          </section>
        </div>

        {/* Activity Feed */}
        <section className="surface p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3.5">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">آخر النشاط بالمنصة</h3>
            <button onClick={() => onNavigate('activity')} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
              السجل الكامل ←
            </button>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {activityLogs.slice(0, 6).map(l => (
              <li key={l.id} className="py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                <div className="text-slate-700 dark:text-slate-300">
                  <span className="font-extrabold text-slate-900 dark:text-slate-100">{l.userName}</span>
                  <span className="text-slate-400 px-1.5">·</span>
                  <span>{l.action}</span>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{formatDateTime(l.timestamp)}</span>
              </li>
            ))}
          </ul>
        </section>

        <AddUserModal isOpen={isAddUserOpen} onClose={() => setIsAddUserOpen(false)} />
        <WhatsAppModal
          isOpen={waOpen}
          onClose={() => setWaOpen(false)}
          student={wa.student}
          defaultType={wa.type}
          contextDetails={wa.ctx}
        />
        <TelegramModal
          isOpen={tgOpen}
          onClose={() => setTgOpen(false)}
          student={tg.student}
          defaultType={tg.type}
          contextDetails={tg.ctx}
        />
      </div>
    );
  }

  /* ------------------------------- students ------------------------------ */
  const visibleStudents = list.slice(0, visibleCount);

  const filterBtnClass = (active: boolean, activeColorClass: string) =>
    `px-3.5 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 text-xs ${
      active
        ? `${activeColorClass} shadow-xs`
        : 'bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700/80'
    }`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">سجل الطلاب</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            إجمالي الطلاب بالمنصة: <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{students.length} طالب</span> · البحث ينطبق على كافة السجلات
          </p>
        </div>
        <button
          id="btn-add-account-doctor"
          onClick={() => setIsAddUserOpen(true)}
          className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-md shadow-indigo-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          إضافة طالب جديد
        </button>
      </div>

      {/* Search & Filters Toolbar */}
      <div className="surface p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="relative w-full lg:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute top-3.5 start-3.5" />
          <input
            id="search-students-input"
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم أو الكود أو الهاتف..."
            className="w-full ps-10 pe-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:bg-white dark:focus:bg-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setFilterMode('all')} className={filterBtnClass(filterMode === 'all', 'bg-indigo-600 text-white')}>
            الكل ({students.length})
          </button>
          <button onClick={() => setFilterMode('absence_alarms')} className={filterBtnClass(filterMode === 'absence_alarms', 'bg-rose-600 text-white')}>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-200" />
            إنذار غياب ({absenceCount})
          </button>
          <button onClick={() => setFilterMode('drop_alarms')} className={filterBtnClass(filterMode === 'drop_alarms', 'bg-amber-500 text-slate-950')}>
            <TrendingDown className="w-3.5 h-3.5 text-slate-950" />
            هبوط أداء ({dropCount})
          </button>
          <button onClick={() => setFilterMode('top_performers')} className={filterBtnClass(filterMode === 'top_performers', 'bg-indigo-700 text-white')}>
            <Trophy className="w-3.5 h-3.5 text-amber-300" />
            المتصدرون
          </button>
          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block mx-1" />
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400 ms-auto sm:ms-0">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span>ترتيب:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-200"
              aria-label="ترتيب القائمة"
            >
              <option value="rank">حسب الترتيب</option>
              <option value="name">حسب الاسم</option>
              <option value="attendance">حسب نسبة الحضور</option>
              <option value="average">حسب متوسط الاختبارات</option>
            </select>
          </label>
        </div>
      </div>

      <div className="text-xs text-slate-500 dark:text-slate-400 font-bold px-1 flex items-center justify-between">
        <span>عرض {visibleStudents.length} من أصل {list.length} طالب مطابق</span>
        {list.length > visibleCount && (
          <span className="text-indigo-600 dark:text-indigo-400">(يتبقى {list.length - visibleCount} طالب لم يُعرض بعد)</span>
        )}
      </div>

      {/* Student Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-5">
        {list.length === 0 && (
          <div className="col-span-full text-center py-16 surface border-dashed text-slate-400 text-sm font-medium">
            لا توجد نتائج مطابقة لخيارات البحث المحددة.
          </div>
        )}

        {visibleStudents.map(student => {
          const a = alarms.get(student.id);
          const isAbsence = !!a?.hasAbsenceAlarm;
          const isDrop = !!a?.hasPerformanceAlarm;
          const states = studentStates.filter(s => s.studentId === student.id);
          const points = states.reduce((acc, s) => acc + (s.quizScore || 0), 0);
          const completed = states.filter(s => s.quizCompleted).length;
          const entry = board.find(e => e.studentId === student.id);
          const badge = entry?.badge || 'none';

          return (
            <article
              key={student.id}
              id={`student-card-${student.id}`}
              className={`surface p-6 flex flex-col gap-5 hover:shadow-lift transition-all duration-200 ${
                isAbsence
                  ? 'border-rose-300 dark:border-rose-500/40 ring-1 ring-rose-100 dark:ring-rose-500/25'
                  : isDrop
                  ? 'border-amber-300 dark:border-amber-500/40 ring-1 ring-amber-100 dark:ring-amber-500/25'
                  : 'hover:border-indigo-200 dark:hover:border-indigo-500/30'
              }`}
            >
              {/* Header Info */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  <Avatar
                    src={student.avatar}
                    name={student.name}
                    className="w-12 h-12 rounded-2xl object-cover ring-2 ring-slate-100 dark:ring-slate-800 shrink-0"
                    fallbackClassName="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-black text-lg shrink-0"
                  />
                  <div className="min-w-0">
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 truncate">{student.name}</h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                      <span className="font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md font-bold" dir="ltr">
                        {student.academicId}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono" dir="ltr">
                        {student.phone}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-end shrink-0">
                  <div className="text-2xl font-black text-indigo-700 dark:text-indigo-300 leading-none">{points}</div>
                  <div className="text-[12px] text-slate-400 mt-1 font-bold">نقطة</div>
                </div>
              </div>

              {/* Rank & Honor Badge */}
              <div className="flex items-center gap-2 text-xs">
                <span className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-extrabold px-2.5 py-1 rounded-lg">المركز #{entry?.rank ?? '-'}</span>
                <span
                  className={`font-extrabold px-2.5 py-1 rounded-lg ${
                    badge === 'none'
                      ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400'
                      : 'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300'
                  }`}
                >
                  {badge === 'gold' ? '🥇 درع ذهبي' : badge === 'silver' ? '🥈 درع فضي' : badge === 'bronze' ? '🥉 درع برونزي' : 'بدون درع'}
                </span>
              </div>

              {/* Alarms Warning Box */}
              {(isAbsence || isDrop) && (
                <div className="space-y-2">
                  {isAbsence && (
                    <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200/80 dark:border-rose-500/25 text-rose-900 dark:text-rose-200 p-3.5 rounded-2xl text-xs flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 font-bold min-w-0">
                        <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                        <span className="truncate">لم يُكمل {a!.consecutiveAbsences} محاضرات متتالية</span>
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => openWa(student, 'consecutive_absence', { absenceCount: a!.consecutiveAbsences })}
                          className="text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          واتساب
                        </button>
                        <button
                          onClick={() => openTg(student, 'consecutive_absence', { absenceCount: a!.consecutiveAbsences })}
                          title={student.telegramChatId ? undefined : 'الطالب لم يربط تليجرام بعد'}
                          className="text-xs bg-sky-600 hover:bg-sky-700 text-white font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1"
                        >
                          <Send className="w-3.5 h-3.5" />
                          تليجرام
                        </button>
                      </div>
                    </div>
                  )}
                  {isDrop && (
                    <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200/80 dark:border-amber-500/25 text-amber-950 dark:text-amber-100 p-3.5 rounded-2xl text-xs flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 font-bold min-w-0">
                        <TrendingDown className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span className="truncate">المتوسط: {a!.previousQuizzesAverage}% ← {a!.lastQuizzesAverage}%</span>
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => openWa(student, 'performance_drop', { dropPercentage: a!.performanceDropPercentage })}
                          className="text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          تابع
                        </button>
                        <button
                          onClick={() => openTg(student, 'performance_drop', { dropPercentage: a!.performanceDropPercentage })}
                          title={student.telegramChatId ? undefined : 'الطالب لم يربط تليجرام بعد'}
                          className="text-xs bg-sky-600 hover:bg-sky-700 text-white font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1"
                        >
                          <Send className="w-3.5 h-3.5" />
                          تليجرام
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Attendance & Score Progress Bars */}
              <div className="grid grid-cols-3 gap-3.5 text-xs bg-slate-50/70 dark:bg-slate-800/30 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                {[
                  ['الحضور', `${a?.attendanceRate ?? 0}%`, a?.attendanceRate ?? 0, 'bg-emerald-500', 'text-emerald-700 dark:text-emerald-300'],
                  ['الكويزات', String(completed), Math.min(100, completed * 25), 'bg-slate-500', 'text-slate-800 dark:text-slate-200'],
                  ['المتوسط', `${a?.lastQuizzesAverage ?? 0}%`, a?.lastQuizzesAverage ?? 0, 'bg-indigo-600', 'text-indigo-700 dark:text-indigo-300']
                ].map(([t, v, w, bar, txt]) => (
                  <div key={t as string} className="space-y-1.5">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">{t}</span>
                      <span className={`font-extrabold ${txt}`}>{v}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(100, w as number)}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 mt-auto">
                <button
                  id={`btn-impersonate-${student.id}`}
                  onClick={() => impersonateStudent(student.id)}
                  className="flex-1 py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                  title="الدخول بحساب الطالب للمعاينة. لا تُحفظ أي تغييرات."
                >
                  <Eye className="w-4 h-4" />
                  معاينة كطالب
                </button>
                <button
                  onClick={() => openWa(student, 'quiz_reminder')}
                  aria-label={`مراسلة ${student.name} عبر واتساب`}
                  title="مراسلة عبر واتساب"
                  className="p-2.5 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 border border-emerald-200/80 dark:border-emerald-500/25 rounded-xl transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                </button>
                <button
                  onClick={() => openTg(student, 'quiz_reminder')}
                  aria-label={`مراسلة ${student.name} عبر تليجرام`}
                  title={student.telegramChatId ? 'مراسلة عبر تليجرام' : 'مراسلة عبر تليجرام (الطالب لم يربط تليجرام بعد)'}
                  className="p-2.5 text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-500/10 hover:bg-sky-100 dark:hover:bg-sky-500/20 border border-sky-200/80 dark:border-sky-500/25 rounded-xl transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
                <button
                  id={`btn-print-report-${student.id}`}
                  onClick={() => setReportStudent(student)}
                  aria-label={`طباعة بيان حالة ${student.name}`}
                  title="طباعة بيان حالة الطالب والأداء الأكاديمي"
                  className="p-2.5 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 border border-indigo-200/80 dark:border-indigo-500/25 rounded-xl transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  id={`btn-quick-cert-${student.id}`}
                  onClick={() => setQuickCertStudent(student)}
                  aria-label={`إصدار شهادة لـ ${student.name}`}
                  title="إصدار وتجهيز شهادة تقدير فورية للطالب"
                  className="p-2.5 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 border border-amber-200/80 dark:border-amber-500/25 rounded-xl transition-colors cursor-pointer"
                >
                  <Award className="w-4 h-4" />
                </button>
                <button
                  id={`btn-view-details-${student.id}`}
                  onClick={() => setSelectedStudent(student)}
                  className="py-2.5 px-3 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-xs rounded-xl flex items-center gap-1 transition-colors"
                >
                  تفاصيل
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {list.length > visibleCount && (
        <div className="flex flex-col items-center justify-center pt-2 pb-6 space-y-2">
          <button
            id="btn-load-more-students"
            onClick={() => setVisibleCount(prev => prev + 10)}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs sm:text-sm font-extrabold shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
          >
            <span>عرض المزيد (+10 طلاب)</span>
            <span className="bg-indigo-800/80 px-2 py-0.5 rounded-lg text-xs">
              {visibleStudents.length} / {list.length}
            </span>
          </button>
          <p className="text-[12px] text-slate-500 dark:text-slate-400">
            يظهر حالياً {visibleStudents.length} طالب من إجمالي {list.length} طالب بالبحث.
          </p>
        </div>
      )}

      <StudentDetailsModal student={selectedStudent} isOpen={!!selectedStudent} onClose={() => setSelectedStudent(null)} />
      <StudentReportModal student={reportStudent} isOpen={!!reportStudent} onClose={() => setReportStudent(null)} />
      <QuickCertificateModal isOpen={!!quickCertStudent} onClose={() => setQuickCertStudent(null)} initialStudent={quickCertStudent} />
      <AddUserModal isOpen={isAddUserOpen} onClose={() => setIsAddUserOpen(false)} />
      <WhatsAppModal
        isOpen={waOpen}
        onClose={() => setWaOpen(false)}
        student={wa.student}
        defaultType={wa.type}
        contextDetails={wa.ctx}
      />
      <TelegramModal
        isOpen={tgOpen}
        onClose={() => setTgOpen(false)}
        student={tg.student}
        defaultType={tg.type}
        contextDetails={tg.ctx}
      />
    </div>
  );
};
