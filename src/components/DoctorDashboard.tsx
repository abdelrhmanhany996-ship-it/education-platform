import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { User } from '../types';
import { StudentDetailsModal } from './StudentDetailsModal';
import { AddUserModal } from './AddUserModal';
import { WhatsAppModal } from './WhatsAppModal';
import { TelegramModal } from './TelegramModal';
import { formatDateTime } from '../utils/format';
import type { PageId } from '../nav';
import {
  AlertTriangle,
  ArrowUpDown,
  Award,
  ChevronLeft,
  ClipboardCheck,
  Eye,
  GraduationCap,
  MessageCircle,
  Search,
  Send,
  ShieldCheck,
  TrendingDown,
  Trophy,
  Upload,
  UserPlus
} from 'lucide-react';

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

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'absence_alarms' | 'drop_alarms' | 'top_performers'>('all');
  const [sortBy, setSortBy] = useState<'rank' | 'name' | 'attendance' | 'average'>('rank');
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
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

  const course = courses[0];
  const lecturesAll = courses.flatMap(c => c.weeks.flatMap(w => w.lectures));
  const students = users.filter(u => u.role === 'student');
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

  /* ------------------------------ overview ------------------------------ */
  if (page === 'overview') {
    const needAttention = students.filter(s => alarms.get(s.id)?.hasAbsenceAlarm || alarms.get(s.id)?.hasPerformanceAlarm);
    const totalAlerts = absenceCount + dropCount;

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6" id="doctor-dashboard-container">
        <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-indigo-800 via-indigo-900 to-indigo-950 text-white shadow-lift animate-rise">
          <div className="absolute inset-0 hero-pattern opacity-60" aria-hidden="true" />
          <div className="absolute -top-20 -left-16 w-72 h-72 rounded-full bg-amber-400/15 blur-3xl" aria-hidden="true" />
          <div className="relative p-6 sm:p-8 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
            <div className="space-y-3 min-w-0">
              <span className="inline-flex items-center gap-2 bg-white/10 border border-white/15 px-3 py-1 rounded-full text-[12px] font-bold text-amber-200">
                <ShieldCheck className="w-3.5 h-3.5" />
                لوحة أستاذ المقرر
              </span>
              <h1 className="text-2xl sm:text-3xl font-black leading-tight">
                أهلاً بك، {currentUser?.name || course?.doctorName}
              </h1>
              <p className="text-sm text-indigo-100/90 max-w-2xl leading-relaxed">
                {totalAlerts + pendingEssays > 0
                  ? `عندك ${totalAlerts} تنبيه و${pendingEssays} إجابة مقالية تنتظر المتابعة اليوم.`
                  : 'لا توجد تنبيهات ولا إجابات بانتظار التصحيح، كل شيء على ما يرام.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                id="upload-questions-btn"
                onClick={() => onNavigate('courses')}
                className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-950 px-4 py-2.5 rounded-xl text-xs font-black shadow-lg shadow-black/20 transition-colors"
              >
                <Upload className="w-4 h-4" />
                رفع أسئلة / محاضرة
              </button>
              <button
                id="btn-add-account-doctor"
                onClick={() => setIsAddUserOpen(true)}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                إضافة حساب
              </button>
              <button
                onClick={() => onNavigate('leaderboard')}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors"
              >
                <Trophy className="w-4 h-4 text-amber-300" />
                لوحة الشرف
              </button>
            </div>
          </div>
        </section>

        <section aria-label="ملخص الأداء" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="surface p-5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">الطلاب بالمنصة</span>
              <div className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-1.5 leading-none">{students.length}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 truncate">
                {released} من {lecturesAll.length} محاضرات منشورة
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
          </div>

          <div className={`surface p-5 flex items-start justify-between gap-3 border-s-4 ${absenceCount ? 'border-s-rose-500' : 'border-s-slate-200'}`}>
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">إنذار غياب متتالٍ</span>
              <div className={`text-3xl font-black mt-1.5 leading-none ${absenceCount ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'}`}>{absenceCount}</div>
              <button
                onClick={() => {
                  setFilterMode('absence_alarms');
                  onNavigate('students');
                }}
                className="text-xs text-rose-700 dark:text-rose-300 font-bold mt-2 hover:underline"
              >
                عرض المتغيبين ←
              </button>
            </div>
            <div className="w-11 h-11 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>

          <div className={`surface p-5 flex items-start justify-between gap-3 border-s-4 ${dropCount ? 'border-s-amber-500' : 'border-s-slate-200'}`}>
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">هبوط أداء</span>
              <div className={`text-3xl font-black mt-1.5 leading-none ${dropCount ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100'}`}>{dropCount}</div>
              <button
                onClick={() => {
                  setFilterMode('drop_alarms');
                  onNavigate('students');
                }}
                className="text-xs text-amber-700 dark:text-amber-300 font-bold mt-2 hover:underline"
              >
                عرض المتراجعين ←
              </button>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>

          <div className={`surface p-5 flex items-start justify-between gap-3 border-s-4 ${pendingEssays ? 'border-s-purple-500' : 'border-s-slate-200'}`}>
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">مقالي بانتظار التصحيح</span>
              <div className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-1.5 leading-none">{pendingEssays}</div>
              <button onClick={() => onNavigate('grading')} className="text-xs text-purple-700 dark:text-purple-300 font-bold mt-2 hover:underline">
                ابدأ التصحيح ←
              </button>
            </div>
            <div className="w-11 h-11 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <ClipboardCheck className="w-5 h-5" />
            </div>
          </div>
        </section>

        <div className="grid xl:grid-cols-3 gap-4">
          <section className="surface p-5 xl:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">يحتاجون متابعتك ({needAttention.length})</h3>
              <button onClick={() => onNavigate('alerts')} className="text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:underline">
                كل التنبيهات ←
              </button>
            </div>
            {needAttention.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">لا يوجد طلاب عليهم إنذارات.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {needAttention.slice(0, 6).map(s => {
                  const a = alarms.get(s.id)!;
                  return (
                    <li key={s.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{s.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {a.hasAbsenceAlarm && `لم يُكمل ${a.consecutiveAbsences} محاضرات متتالية`}
                          {a.hasAbsenceAlarm && a.hasPerformanceAlarm && ' · '}
                          {a.hasPerformanceAlarm && `هبوط ${a.performanceDropPercentage}%`}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() =>
                            a.hasAbsenceAlarm
                              ? openWa(s, 'consecutive_absence', { absenceCount: a.consecutiveAbsences })
                              : openWa(s, 'performance_drop', { dropPercentage: a.performanceDropPercentage })
                          }
                          className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/25 px-3 py-1.5 rounded-lg"
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
                          className="flex items-center gap-1.5 text-xs font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-500/10 hover:bg-sky-100 dark:hover:bg-sky-500/15 border border-sky-200 dark:border-sky-500/25 px-3 py-1.5 rounded-lg"
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

          <section className="surface p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">المتصدرون</h3>
              <button onClick={() => onNavigate('leaderboard')} className="text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:underline">
                الكل ←
              </button>
            </div>
            {board.filter(e => e.quizzesCompleted > 0).slice(0, 3).map(e => (
              <div key={e.studentId} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                <span className="text-xl w-7 text-center">{e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : '🥉'}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{e.studentName}</div>
                  <div className="text-[12px] text-slate-500 dark:text-slate-400">{e.quizzesCompleted} كويز</div>
                </div>
                <div className="text-base font-black text-indigo-700 dark:text-indigo-300">{e.totalPoints}</div>
              </div>
            ))}
            {board.every(e => e.quizzesCompleted === 0) && (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">لم يُنهِ أحد كويزاً بعد.</p>
            )}
          </section>
        </div>

        <section className="surface p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">آخر النشاط</h3>
            <button onClick={() => onNavigate('activity')} className="text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:underline">
              السجل الكامل ←
            </button>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {activityLogs.slice(0, 6).map(l => (
              <li key={l.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-slate-700 dark:text-slate-300">
                  <span className="font-bold text-slate-900 dark:text-slate-100">{l.userName}</span> · {l.action}
                </span>
                <span className="text-[12px] text-slate-500 dark:text-slate-400">{formatDateTime(l.timestamp)}</span>
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
  const rankOf = (id: string) => board.find(e => e.studentId === id)?.rank ?? 999;

  const list = students
    .filter(s => {
      const q = searchQuery.toLowerCase();
      const matches =
        s.name.toLowerCase().includes(q) ||
        s.academicId.toLowerCase().includes(q) ||
        s.username.toLowerCase().includes(q) ||
        s.phone.includes(searchQuery);
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

  const pill = (active: boolean, tone: string) =>
    `px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1 text-xs ${
      active ? tone : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
    }`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">الطلاب</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">مرتبون من الأعلى نقاطاً إلى الأقل، مع الإنذارات وأرقام واتساب.</p>
        </div>
        <button
          id="btn-add-account-doctor"
          onClick={() => setIsAddUserOpen(true)}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
        >
          <UserPlus className="w-4 h-4" />
          إضافة طالب
        </button>
      </div>

      <div className="surface p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative w-full lg:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute top-3 start-3" />
          <input
            id="search-students-input"
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم أو الكود أو الهاتف"
            className="w-full ps-9 pe-3 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:bg-white dark:focus:bg-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button onClick={() => setFilterMode('all')} className={pill(filterMode === 'all', 'bg-indigo-600 text-white')}>
            الكل ({students.length})
          </button>
          <button onClick={() => setFilterMode('absence_alarms')} className={pill(filterMode === 'absence_alarms', 'bg-rose-600 text-white')}>
            <AlertTriangle className="w-3.5 h-3.5" />
            غياب ({absenceCount})
          </button>
          <button onClick={() => setFilterMode('drop_alarms')} className={pill(filterMode === 'drop_alarms', 'bg-amber-500 text-slate-950')}>
            <TrendingDown className="w-3.5 h-3.5" />
            هبوط ({dropCount})
          </button>
          <button onClick={() => setFilterMode('top_performers')} className={pill(filterMode === 'top_performers', 'bg-amber-500 text-slate-950')}>
            <Trophy className="w-3.5 h-3.5" />
            المتصدرون
          </button>
          <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 ms-1">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs font-bold"
              aria-label="ترتيب القائمة"
            >
              <option value="rank">حسب الترتيب</option>
              <option value="name">حسب الاسم</option>
              <option value="attendance">حسب الحضور</option>
              <option value="average">حسب المتوسط</option>
            </select>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
        {list.length === 0 && (
          <div className="col-span-full text-center py-12 surface border-dashed text-slate-400 text-sm">
            لا توجد نتائج مطابقة.
          </div>
        )}

        {list.map(student => {
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
              className={`surface p-5 flex flex-col gap-4 hover:shadow-lift transition-shadow ${
                isAbsence ? 'border-rose-300 dark:border-rose-500/40 ring-1 ring-rose-100 dark:ring-rose-500/25' : isDrop ? 'border-amber-300 dark:border-amber-500/40 ring-1 ring-amber-100 dark:ring-amber-500/25' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {student.avatar ? (
                    <img src={student.avatar} alt="" className="w-12 h-12 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700 shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-base shrink-0">
                      {student.name.slice(0, 1)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 truncate">{student.name}</h3>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
                      <span className="font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded-md" dir="ltr">
                        {student.academicId}
                      </span>
                      <span className="font-mono" dir="ltr">
                        {student.phone}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-end shrink-0">
                  <div className="text-xl font-black text-indigo-700 dark:text-indigo-300 leading-none">{points}</div>
                  <div className="text-[12px] text-slate-400 mt-1">نقطة</div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[12px]">
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-2 py-1 rounded-lg">المركز #{entry?.rank ?? '-'}</span>
                <span
                  className={`font-bold px-2 py-1 rounded-lg ${
                    badge === 'none' ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' : 'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300'
                  }`}
                >
                  {badge === 'gold' ? '🥇 ذهبي' : badge === 'silver' ? '🥈 فضي' : badge === 'bronze' ? '🥉 برونزي' : 'بلا درع'}
                </span>
              </div>

              {(isAbsence || isDrop) && (
                <div className="space-y-2">
                  {isAbsence && (
                    <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 text-rose-900 dark:text-rose-200 p-3 rounded-xl text-xs flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 font-bold min-w-0">
                        <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                        لم يُكمل {a!.consecutiveAbsences} محاضرات متتالية
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => openWa(student, 'consecutive_absence', { absenceCount: a!.consecutiveAbsences })}
                          className="text-[12px] bg-rose-600 text-white font-bold px-2.5 py-1.5 rounded-lg hover:bg-rose-700 flex items-center gap-1"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          راسله
                        </button>
                        <button
                          onClick={() => openTg(student, 'consecutive_absence', { absenceCount: a!.consecutiveAbsences })}
                          title={student.telegramChatId ? undefined : 'الطالب لم يربط تليجرام بعد'}
                          className="text-[12px] bg-sky-600 text-white font-bold px-2.5 py-1.5 rounded-lg hover:bg-sky-700 flex items-center gap-1"
                        >
                          <Send className="w-3.5 h-3.5" />
                          تليجرام
                        </button>
                      </div>
                    </div>
                  )}
                  {isDrop && (
                    <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 text-amber-950 dark:text-amber-100 p-3 rounded-xl text-xs flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 font-bold min-w-0">
                        <TrendingDown className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        المتوسط {a!.previousQuizzesAverage}% ← {a!.lastQuizzesAverage}%
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => openWa(student, 'performance_drop', { dropPercentage: a!.performanceDropPercentage })}
                          className="text-[12px] bg-amber-500 text-slate-950 font-bold px-2.5 py-1.5 rounded-lg hover:bg-amber-400 flex items-center gap-1"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          تابع
                        </button>
                        <button
                          onClick={() => openTg(student, 'performance_drop', { dropPercentage: a!.performanceDropPercentage })}
                          title={student.telegramChatId ? undefined : 'الطالب لم يربط تليجرام بعد'}
                          className="text-[12px] bg-sky-600 text-white font-bold px-2.5 py-1.5 rounded-lg hover:bg-sky-700 flex items-center gap-1"
                        >
                          <Send className="w-3.5 h-3.5" />
                          تليجرام
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 text-xs">
                {[
                  ['الحضور', `${a?.attendanceRate ?? 0}%`, a?.attendanceRate ?? 0, 'bg-emerald-500', 'text-emerald-700 dark:text-emerald-300'],
                  ['الكويزات', String(completed), Math.min(100, completed * 25), 'bg-slate-400', 'text-slate-800 dark:text-slate-200'],
                  ['المتوسط', `${a?.lastQuizzesAverage ?? 0}%`, a?.lastQuizzesAverage ?? 0, 'bg-indigo-500', 'text-indigo-700 dark:text-indigo-300']
                ].map(([t, v, w, bar, txt]) => (
                  <div key={t as string} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">{t}</span>
                      <span className={`font-bold ${txt}`}>{v}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(100, w as number)}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 mt-auto">
                <button
                  id={`btn-impersonate-${student.id}`}
                  onClick={() => impersonateStudent(student.id)}
                  className="flex-1 py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                  title="الدخول بحساب الطالب للمعاينة. لا تُحفظ أي تغييرات."
                >
                  <Eye className="w-4 h-4" />
                  معاينة كطالب
                </button>
                <button
                  onClick={() => openWa(student, 'quiz_reminder')}
                  aria-label={`مراسلة ${student.name} عبر واتساب`}
                  title="مراسلة عبر واتساب"
                  className="p-2.5 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/25 rounded-xl transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                </button>
                <button
                  onClick={() => openTg(student, 'quiz_reminder')}
                  aria-label={`مراسلة ${student.name} عبر تليجرام`}
                  title={student.telegramChatId ? 'مراسلة عبر تليجرام' : 'مراسلة عبر تليجرام (الطالب لم يربط تليجرام بعد)'}
                  className="p-2.5 text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-500/10 hover:bg-sky-100 dark:hover:bg-sky-500/15 border border-sky-200 dark:border-sky-500/25 rounded-xl transition-colors"
                >
                  <Send className="w-4 h-4" />
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

      <StudentDetailsModal student={selectedStudent} isOpen={!!selectedStudent} onClose={() => setSelectedStudent(null)} />
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
