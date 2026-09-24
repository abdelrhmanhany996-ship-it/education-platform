import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { BadgePolicy, Certificate, User } from '../types';
import { WhatsAppModal } from './WhatsAppModal';
import { TelegramModal } from './TelegramModal';
import { CertificateModal } from './CertificateModal';
import { AddUserModal } from './AddUserModal';
import { TelegramAccountCard } from './TelegramAccountCard';
import { formatDateTime } from '../utils/format';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  FileSignature,
  Flag,
  Headphones,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Trash2,
  TrendingDown,
  UserPlus,
  Users
} from 'lucide-react';

const input =
  'w-full text-sm p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500';
const label = 'block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1';
const btnPrimary =
  'px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5';
const btnGhost =
  'px-3 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5';

const PageWrap: React.FC<{ title: string; subtitle?: string; children: React.ReactNode; wide?: boolean }> = ({
  title,
  subtitle,
  children,
  wide
}) => (
  <div className={`${wide ? 'max-w-6xl' : 'max-w-5xl'} mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6`}>
    <div>
      <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">{title}</h2>
      {subtitle && <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{subtitle}</p>}
    </div>
    {children}
  </div>
);

const Empty: React.FC<{ icon: React.ReactNode; text: string }> = ({ icon, text }) => (
  <div className="surface p-10 text-center text-slate-500 dark:text-slate-400 space-y-2">
    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">{icon}</div>
    <p className="text-sm">{text}</p>
  </div>
);

/* ------------------------------- essay grading ------------------------------- */

export const EssayGrading: React.FC = () => {
  const { getPendingEssays, gradeEssay } = useApp();
  const pending = getPendingEssays();

  return (
    <PageWrap
      title="تصحيح الأسئلة المقالية"
      subtitle="الأسئلة المقالية لا تُصحَّح آلياً ولا تُحتسب نقاطها في الترتيب قبل أن تعطيها درجة."
    >
      {pending.length === 0 ? (
        <Empty icon={<ClipboardCheck className="w-6 h-6" />} text="لا توجد إجابات مقالية بانتظار التصحيح." />
      ) : (
        <div className="space-y-4">
          {pending.map(p => {
            const options = Array.from(new Set([0, p.maxPoints / 2, p.maxPoints])).filter(x => x <= p.maxPoints);
            return (
              <article key={`${p.studentId}-${p.questionId}`} className="surface p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="font-bold text-slate-900 dark:text-slate-100">
                    {p.studentName} <span className="text-slate-400 font-normal">· <bdi dir="ltr">{p.studentAcademicId}</bdi></span>
                  </div>
                  <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-md">{p.lectureTitle}</span>
                </div>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{p.prompt}</p>
                <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed">
                  {p.answer}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400">الدرجة (من {p.maxPoints}):</span>
                  {options.map(v => (
                    <button
                      key={v}
                      onClick={() => gradeEssay(p.studentId, p.lectureId, p.questionId, v)}
                      className={`px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${
                        v === p.maxPoints
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/15'
                          : v === 0
                          ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-500/15'
                          : 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/15'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </PageWrap>
  );
};

/* ---------------------------------- groups ---------------------------------- */

export const GroupsManager: React.FC = () => {
  const { users, groups, createGroup, updateGroup, deleteGroup } = useApp();
  const [name, setName] = useState('');
  const students = users.filter(u => u.role === 'student');

  const toggle = (groupId: string, studentId: string) => {
    const target = groups.find(g => g.id === groupId);
    if (!target) return;
    const has = target.memberIds.includes(studentId);
    // A student belongs to one group only, otherwise the quiz time would be ambiguous.
    groups.forEach(g => {
      if (g.id !== groupId && g.memberIds.includes(studentId)) {
        updateGroup(g.id, { memberIds: g.memberIds.filter(m => m !== studentId) });
      }
    });
    updateGroup(groupId, {
      memberIds: has ? target.memberIds.filter(m => m !== studentId) : [...target.memberIds, studentId]
    });
  };

  const assigned = new Set(groups.flatMap(g => g.memberIds));
  const unassigned = students.filter(s => !assigned.has(s.id)).length;

  return (
    <PageWrap
      title="المجموعات"
      subtitle="قسّم الطلاب إلى مجموعات لتعطي كل مجموعة وقت فتح مختلفاً للكويز (الخيار ب). تُضبط المواعيد من صفحة المقررات."
    >
      <form
        onSubmit={e => {
          e.preventDefault();
          createGroup(name);
          setName('');
        }}
        className="surface p-4 flex flex-wrap gap-3 items-end"
      >
        <div className="flex-1 min-w-52">
          <span className={label}>اسم المجموعة الجديدة</span>
          <input className={input} value={name} onChange={e => setName(e.target.value)} placeholder="مثال: المجموعة الأولى" />
        </div>
        <button className={btnPrimary} disabled={!name.trim()}>
          <Plus className="w-4 h-4" />
          إنشاء
        </button>
      </form>

      {groups.length > 0 && unassigned > 0 && (
        <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {unassigned} طالب بلا مجموعة، ولن يستطيعوا فتح كويز مجدول بالمجموعات.
        </div>
      )}

      {groups.length === 0 ? (
        <Empty icon={<Users className="w-6 h-6" />} text="لم تُنشأ مجموعات بعد." />
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {groups.map(g => (
            <section key={g.id} className="surface p-4 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  className={`${input} font-bold`}
                  defaultValue={g.name}
                  onBlur={e => e.target.value.trim() && updateGroup(g.id, { name: e.target.value.trim() })}
                  aria-label="اسم المجموعة"
                />
                <button
                  onClick={() => window.confirm(`حذف ${g.name}؟`) && deleteGroup(g.id)}
                  aria-label="حذف المجموعة"
                  className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{g.memberIds.length} طالب</div>
              <div className="max-h-64 overflow-y-auto scroll-thin border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                {students.map(s => (
                  <label key={s.id} className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <input type="checkbox" checked={g.memberIds.includes(s.id)} onChange={() => toggle(g.id, s.id)} />
                    <span className="flex-1 truncate text-slate-800 dark:text-slate-200">{s.name}</span>
                    {assigned.has(s.id) && !g.memberIds.includes(s.id) && (
                      <span className="text-[12px] text-slate-400">في مجموعة أخرى</span>
                    )}
                  </label>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </PageWrap>
  );
};

/* ------------------------------ alerts & messages ---------------------------- */

const TYPE_LABEL: Record<string, string> = {
  consecutive_absence: 'إنذار غياب',
  performance_drop: 'هبوط أداء',
  quiz_reminder: 'تذكير كويز',
  certificate_award: 'تهنئة',
  enrollment_contact: 'تواصل تسجيل'
};

export const AlertsPage: React.FC = () => {
  const { users, getStudentAnalytics, whatsappLogs, telegramLogs, getMessageQuota, alertSettings } = useApp();
  const [wa, setWa] = useState<{
    student: User;
    type: 'consecutive_absence' | 'performance_drop';
    ctx: { absenceCount?: number; dropPercentage?: number };
  } | null>(null);
  const [tg, setTg] = useState<typeof wa>(null);

  const rows = users
    .filter(u => u.role === 'student')
    .map(s => ({ student: s, a: getStudentAnalytics(s.id) }))
    .filter(r => r.a && (r.a.hasAbsenceAlarm || r.a.hasPerformanceAlarm));

  return (
    <PageWrap
      title="التنبيهات والرسائل"
      subtitle={`إنذار الغياب عند ${alertSettings.absenceConsecutive} محاضرات متتالية، وإنذار الهبوط عند انخفاض ${alertSettings.dropPercent}% أو أكثر. تُعدَّل من الإعدادات.`}
      wide
    >
      <section className="space-y-3">
        <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">تنبيهات نشطة ({rows.length})</h3>
        {rows.length === 0 ? (
          <Empty icon={<CheckCircle2 className="w-6 h-6" />} text="لا توجد تنبيهات، كل الطلاب على المسار الصحيح." />
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {rows.map(({ student, a }) => {
              const quota = getMessageQuota(student.id, 'whatsapp');
              return (
                <article key={student.id} className="surface p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100 truncate">{student.name}</div>
                      <div className="text-[12px] text-slate-500 dark:text-slate-400" dir="ltr">{student.phone}</div>
                    </div>
                    <span className="text-[12px] text-slate-500 dark:text-slate-400 shrink-0">
                      رسائل الأسبوع {quota.sentThisWeek}/{quota.max}
                    </span>
                  </div>
                  {a!.hasAbsenceAlarm && (
                    <div className="flex items-center justify-between gap-2 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 rounded-xl p-2.5 text-xs text-rose-900 dark:text-rose-200">
                      <span className="flex items-center gap-1.5 font-bold">
                        <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                        لم يُكمل {a!.consecutiveAbsences} محاضرات متتالية
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => setWa({ student, type: 'consecutive_absence', ctx: { absenceCount: a!.consecutiveAbsences } })}
                          className="bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          واتساب
                        </button>
                        <button
                          onClick={() => setTg({ student, type: 'consecutive_absence', ctx: { absenceCount: a!.consecutiveAbsences } })}
                          title={student.telegramChatId ? undefined : 'الطالب لم يربط تليجرام بعد'}
                          className="bg-sky-600 hover:bg-sky-700 text-white px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1"
                        >
                          <Send className="w-3.5 h-3.5" />
                          تليجرام
                        </button>
                      </div>
                    </div>
                  )}
                  {a!.hasPerformanceAlarm && (
                    <div className="flex items-center justify-between gap-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 rounded-xl p-2.5 text-xs text-amber-950 dark:text-amber-100">
                      <span className="flex items-center gap-1.5 font-bold">
                        <TrendingDown className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        المتوسط نزل من {a!.previousQuizzesAverage}% إلى {a!.lastQuizzesAverage}% ({a!.performanceDropPercentage}%-)
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => setWa({ student, type: 'performance_drop', ctx: { dropPercentage: a!.performanceDropPercentage } })}
                          className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          تابع
                        </button>
                        <button
                          onClick={() => setTg({ student, type: 'performance_drop', ctx: { dropPercentage: a!.performanceDropPercentage } })}
                          title={student.telegramChatId ? undefined : 'الطالب لم يربط تليجرام بعد'}
                          className="bg-sky-600 hover:bg-sky-700 text-white px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1"
                        >
                          <Send className="w-3.5 h-3.5" />
                          تليجرام
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">سجل رسائل واتساب ({whatsappLogs.length})</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          "تلقائية" تعني أن المنصة أرسلتها بنفسها دون ضغط أحد، حسب شروط التنبيه وقناة الإرسال في الإعدادات.
        </p>
        {whatsappLogs.length === 0 ? (
          <Empty icon={<MessageCircle className="w-6 h-6" />} text="لم تُرسل رسائل بعد." />
        ) : (
          <div className="surface overflow-hidden">
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full text-sm min-w-[34rem]">
                <thead className="bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="text-start p-3 font-bold">الطالب</th>
                    <th className="text-start p-3 font-bold">النوع</th>
                    <th className="text-start p-3 font-bold">الوقت</th>
                    <th className="text-start p-3 font-bold">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {whatsappLogs.slice(0, 50).map(l => (
                    <tr key={l.id}>
                      <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{l.studentName}</td>
                      <td className="p-3 text-slate-700 dark:text-slate-300">{TYPE_LABEL[l.messageType] || l.messageType}</td>
                      <td className="p-3 text-slate-500 dark:text-slate-400">{formatDateTime(l.sentAt)}</td>
                      <td className="p-3">
                        <span
                          className={`text-[12px] px-2 py-0.5 rounded-md font-bold ${
                            l.status === 'failed' ? 'bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {l.status === 'failed' ? 'فشلت' : l.auto ? 'أُرسلت تلقائياً' : 'أُرسلت'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">سجل رسائل تليجرام ({telegramLogs.length})</h3>
        {telegramLogs.length === 0 ? (
          <Empty icon={<Send className="w-6 h-6" />} text="لم تُرسل رسائل تليجرام بعد." />
        ) : (
          <div className="surface overflow-hidden">
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full text-sm min-w-[34rem]">
                <thead className="bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="text-start p-3 font-bold">الطالب</th>
                    <th className="text-start p-3 font-bold">النوع</th>
                    <th className="text-start p-3 font-bold">الوقت</th>
                    <th className="text-start p-3 font-bold">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {telegramLogs.slice(0, 50).map(l => (
                    <tr key={l.id}>
                      <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{l.studentName}</td>
                      <td className="p-3 text-slate-700 dark:text-slate-300">{TYPE_LABEL[l.messageType] || l.messageType}</td>
                      <td className="p-3 text-slate-500 dark:text-slate-400">{formatDateTime(l.sentAt)}</td>
                      <td className="p-3">
                        <span
                          className={`text-[12px] px-2 py-0.5 rounded-md font-bold ${
                            l.status === 'failed' ? 'bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {l.status === 'failed' ? 'فشلت' : l.auto ? 'أُرسلت تلقائياً' : 'أُرسلت'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <WhatsAppModal
        isOpen={!!wa}
        onClose={() => setWa(null)}
        student={wa?.student || null}
        defaultType={wa?.type}
        contextDetails={wa?.ctx}
      />
      <TelegramModal
        isOpen={!!tg}
        onClose={() => setTg(null)}
        student={tg?.student || null}
        defaultType={tg?.type}
        contextDetails={tg?.ctx}
      />
    </PageWrap>
  );
};

/* ------------------------------- activity report ------------------------------ */

const TYPE_TABS = [
  ['all', 'الكل'],
  ['login', 'الدخول'],
  ['lecture', 'المحاضرات'],
  ['attendance', 'الحضور'],
  ['quiz', 'الكويزات'],
  ['admin', 'الإدارة'],
  ['certificate', 'الشهادات']
] as const;

export const ActivityReport: React.FC = () => {
  const { activityLogs, studentStates, users, courses } = useApp();
  const [type, setType] = useState<(typeof TYPE_TABS)[number][0]>('all');
  const [q, setQ] = useState('');

  const lectures = courses.flatMap(c => c.weeks.flatMap(w => w.lectures));

  const flags = useMemo(() => {
    const out: { key: string; student: string; lecture: string; reasons: string[] }[] = [];
    for (const s of studentStates) {
      if (!s.quizCompleted) continue;
      const reasons: string[] = [];
      const n = s.quizQuestionOrder?.length || 0;
      if ((s.tabSwitches || 0) >= 3) reasons.push(`غادر تبويب الكويز ${s.tabSwitches} مرات`);
      if (s.quizDurationSeconds !== undefined && n > 0 && s.quizDurationSeconds < n * 4) {
        reasons.push(`سلّم في ${s.quizDurationSeconds} ثانية فقط لـ ${n} أسئلة`);
      }
      if (s.submittedLate) reasons.push('سُلِّم بعد انتهاء الوقت');
      if ((s.quizAttemptsCount || 0) > 1) reasons.push(`${s.quizAttemptsCount} محاولات`);
      if (reasons.length) {
        out.push({
          key: s.id,
          student: users.find(u => u.id === s.studentId)?.name || s.studentId,
          lecture: lectures.find(l => l.id === s.lectureId)?.title || s.lectureId,
          reasons
        });
      }
    }
    return out;
  }, [studentStates, users, lectures]);

  const shown = activityLogs.filter(
    l =>
      (type === 'all' || l.type === type) &&
      (!q || l.userName.includes(q) || l.action.includes(q) || l.userAcademicId.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <PageWrap
      title="سجل النشاط والتقارير"
      subtitle="حركات الطلاب بأوقاتها الحقيقية، وتنبيهات على السلوك غير الطبيعي في الكويزات."
      wide
    >
      <section className="space-y-3">
        <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Flag className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          سلوك يستحق المراجعة ({flags.length})
        </h3>
        {flags.length === 0 ? (
          <Empty icon={<ShieldAlert className="w-6 h-6" />} text="لا توجد مؤشرات غير طبيعية حتى الآن." />
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {flags.map(f => (
              <div key={f.key} className="surface p-4 space-y-1.5 border-s-4 border-s-amber-500">
                <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100">{f.student}</div>
                <div className="text-[12px] text-slate-500 dark:text-slate-400">{f.lecture}</div>
                <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-0.5 pt-1">
                  {f.reasons.map(r => (
                    <li key={r}>• {r}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        <p className="text-[12px] text-slate-500 dark:text-slate-400">
          هذه مؤشرات وليست إثباتاً للغش: الانتقال بين التبويبات مثلاً قد يكون عرضياً.
        </p>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">كل الحركات ({shown.length})</h3>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute top-3 start-3" />
            <input className={`${input} ps-9`} placeholder="بحث بالاسم أو الكود أو الحدث" value={q} onChange={e => setQ(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-1.5 overflow-x-auto scroll-thin pb-1">
          {TYPE_TABS.map(([id, text]) => (
            <button
              key={id}
              onClick={() => setType(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${
                type === id ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {text}
            </button>
          ))}
        </div>
        <div className="surface divide-y divide-slate-100 dark:divide-slate-800">
          {shown.length === 0 && <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">لا توجد نتائج.</div>}
          {shown.slice(0, 120).map(l => (
            <div key={l.id} className="p-3.5 flex flex-wrap items-center justify-between gap-2 text-sm">
              <div className="min-w-0">
                <span className="font-bold text-slate-900 dark:text-slate-100">{l.userName}</span>
                <span className="text-[12px] text-slate-400 mx-1.5">
                  (<bdi dir="ltr">{l.userAcademicId}</bdi>)
                </span>
                <span className="text-slate-700 dark:text-slate-300">{l.action}</span>
                {l.details && <span className="text-[12px] text-slate-400 ms-1.5">· {l.details}</span>}
              </div>
              <span className="text-[12px] text-slate-500 dark:text-slate-400 shrink-0">{formatDateTime(l.timestamp)}</span>
            </div>
          ))}
        </div>
      </section>
    </PageWrap>
  );
};

/* -------------------------- certificates & end of course ---------------------- */

export const DoctorCertificates: React.FC = () => {
  const { courses, certificates, endCourse, reopenCourse, approveCertificate, certSettings } = useApp();
  const [selectedCourseId, setSelectedCourseId] = useState(courses[0]?.id || '');
  const course = courses.find(c => c.id === selectedCourseId) || courses[0];
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const courseCertificates = certificates.filter(c => c.courseId === course?.id);
  const current = courseCertificates.find(c => c.id === openId) || null;

  if (!course) {
    return (
      <PageWrap title="الشهادات" subtitle="لا يوجد مقرر بعد.">
        <Empty icon={<Award className="w-6 h-6" />} text="أنشئ مقرراً أولاً من صفحة المقررات." />
      </PageWrap>
    );
  }
  const ended = !!course.isCompleted;

  return (
    <PageWrap title="الشهادات" subtitle="تصدر شهادة PDF لأول 3 طلاب في الترتيب النهائي بعد إنهاء الكورس.">
      {courses.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto scroll-thin pb-1">
          {courses.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCourseId(c.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap ${
                c.id === selectedCourseId ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {c.title}
            </button>
          ))}
        </div>
      )}
      <section
        className={`surface p-5 flex flex-wrap items-center justify-between gap-4 border-s-4 ${
          ended ? 'border-s-emerald-500' : 'border-s-amber-500'
        }`}
      >
        <div>
          <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
            {ended ? 'الكورس منتهٍ' : 'الكورس جارٍ'} · {course.title}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-xl">
            {ended
              ? `أُنهي في ${formatDateTime(course.endedAt)}. الترتيب النهائي مثبّت والشهادات صادرة.`
              : 'لا تُصدر الشهادات قبل إنهاء الكورس، حتى لا يتغير الترتيب بعد التوزيع. تأكد من تصحيح المقالي أولاً.'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            الاعتماد: {certSettings.autoApprove ? 'تلقائي عند الإصدار' : 'يدوي من الدكتور'} (يُغيَّر من الإعدادات)
          </p>
        </div>
        {ended ? (
          <button
            onClick={() => window.confirm('إعادة فتح الكورس تسحب الشهادات غير المعتمدة فقط. متابعة؟') && reopenCourse(course.id)}
            className={btnGhost}
          >
            <RefreshCw className="w-4 h-4" />
            إعادة فتح الكورس
          </button>
        ) : (
          <button
            onClick={() => {
              if (!window.confirm('إنهاء الكورس وإصدار شهادات أول 3 طلاب؟')) return;
              const { created } = endCourse(course.id);
              setNotice(created ? `أُصدرت ${created} شهادة` : 'لا يوجد طلاب أنهوا كويزات، لم تُصدر شهادات');
            }}
            className={btnPrimary}
          >
            <Award className="w-4 h-4" />
            إنهاء الكورس وإصدار الشهادات
          </button>
        )}
      </section>

      {notice && <div className="text-sm bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 text-emerald-800 dark:text-emerald-300 rounded-xl p-3">{notice}</div>}

      {courseCertificates.length === 0 ? (
        <Empty icon={<Award className="w-6 h-6" />} text="لا توجد شهادات بعد." />
      ) : (
        <div className="grid md:grid-cols-3 gap-4">
          {courseCertificates.map((c: Certificate) => (
            <article key={c.id} className="surface p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 px-2.5 py-0.5 rounded-md border border-amber-200 dark:border-amber-500/25">
                  {c.rankTitle}
                </span>
                <span
                  className={`text-[12px] font-bold px-2 py-0.5 rounded-md ${
                    c.status === 'pending_approval' ? 'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300' : 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
                  }`}
                >
                  {c.status === 'pending_approval' ? 'بانتظار الاعتماد' : 'معتمدة'}
                </span>
              </div>
              <div>
                <h4 className="text-base font-extrabold text-slate-900 dark:text-slate-100">{c.studentName}</h4>
                <div className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
                  <bdi dir="ltr">{c.studentAcademicId}</bdi> · {c.totalPoints} نقطة
                </div>
              </div>
              <div className="flex gap-2 mt-auto">
                <button onClick={() => setOpenId(c.id)} className={`${btnPrimary} flex-1 justify-center`}>
                  <Award className="w-4 h-4" />
                  معاينة وتنزيل
                </button>
                {c.status === 'pending_approval' && (
                  <button
                    onClick={() => approveCertificate(c.id)}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
                  >
                    اعتماد
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <CertificateModal
        certificate={current}
        isOpen={!!current}
        onClose={() => setOpenId(null)}
        isDoctor
        onApprove={approveCertificate}
      />
    </PageWrap>
  );
};

/* ---------------------------------- settings --------------------------------- */

export const SettingsPage: React.FC = () => {
  const {
    badgePolicy,
    updateBadgePolicy,
    alertSettings,
    updateAlertSettings,
    certSettings,
    updateCertSettings,
    resetAllData,
    users,
    impersonateAssistant
  } = useApp();
  const assistants = users.filter(u => u.role === 'assistant');

  const [policy, setPolicy] = useState<BadgePolicy>(badgePolicy);
  const [saved, setSaved] = useState('');
  const [addDoctorOpen, setAddDoctorOpen] = useState(false);

  const flash = (t: string) => {
    setSaved(t);
    setTimeout(() => setSaved(''), 2000);
  };

  const num = (v: string, min = 0) => Math.max(min, Number(v) || 0);

  return (
    <PageWrap title="الإعدادات" subtitle="سياسة الدروع، حدود الإنذارات، الشهادات، وحسابات الدكاترة.">
      {saved && (
        <div className="fixed bottom-4 start-4 z-40 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-lift text-sm font-bold flex items-center gap-2 animate-pop">
          <CheckCircle2 className="w-4 h-4" />
          {saved}
        </div>
      )}

      <form
        onSubmit={e => {
          e.preventDefault();
          updateBadgePolicy(policy);
          flash('حُفظت سياسة الدروع');
        }}
        className="surface p-5 space-y-4"
      >
        <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-500" />
          سياسة الدروع
        </h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {(
            [
              ['fixed_ranks', 'المراكز الثابتة', '1-3 ذهبي · 4-10 فضي · 11-30 برونزي'],
              ['percentiles', 'النسب المئوية', 'أعلى 5% ذهبي · 10% فضي · 20% برونزي (للأعداد الكبيرة)']
            ] as const
          ).map(([id, t, d]) => (
            <button
              key={id}
              type="button"
              onClick={() =>
                setPolicy(
                  id === 'fixed_ranks'
                    ? { type: id, goldThreshold: 3, silverThreshold: 10, bronzeThreshold: 30 }
                    : { type: id, goldThreshold: 5, silverThreshold: 10, bronzeThreshold: 20 }
                )
              }
              className={`text-start p-3 rounded-xl border-2 ${
                policy.type === id ? 'border-amber-400 bg-amber-50 dark:bg-amber-500/10' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
              }`}
            >
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{t}</div>
              <div className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">{d}</div>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              ['goldThreshold', policy.type === 'fixed_ranks' ? 'حتى المركز (ذهبي)' : 'أعلى % (ذهبي)'],
              ['silverThreshold', policy.type === 'fixed_ranks' ? 'حتى المركز (فضي)' : 'التالي % (فضي)'],
              ['bronzeThreshold', policy.type === 'fixed_ranks' ? 'حتى المركز (برونزي)' : 'التالي % (برونزي)']
            ] as const
          ).map(([k, t]) => (
            <div key={k}>
              <span className={label}>{t}</span>
              <input type="number" min={1} className={input} value={policy[k]} onChange={e => setPolicy({ ...policy, [k]: num(e.target.value, 1) })} />
            </div>
          ))}
        </div>
        <p className="text-[12px] text-slate-500 dark:text-slate-400">لا يُمنح درع لطالب لم يُنهِ أي كويز.</p>
        <button className={btnPrimary}>حفظ</button>
      </form>

      <section className="surface p-5 space-y-4">
        <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-500" />
          حدود الإنذارات والرسائل
        </h3>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <span className={label}>غياب محاضرات متتالية</span>
            <input type="number" min={1} className={input} value={alertSettings.absenceConsecutive} onChange={e => updateAlertSettings({ absenceConsecutive: num(e.target.value, 1) })} />
          </div>
          <div>
            <span className={label}>مهلة قبل احتساب الغياب (ساعة)</span>
            <input type="number" min={0} className={input} value={alertSettings.graceHours} onChange={e => updateAlertSettings({ graceHours: num(e.target.value) })} />
          </div>
          <div>
            <span className={label}>نسبة الهبوط المنبِّهة %</span>
            <input type="number" min={1} className={input} value={alertSettings.dropPercent} onChange={e => updateAlertSettings({ dropPercent: num(e.target.value, 1) })} />
          </div>
          <div>
            <span className={label}>كويزات كل متوسط</span>
            <input type="number" min={1} max={6} className={input} value={alertSettings.dropWindow} onChange={e => updateAlertSettings({ dropWindow: num(e.target.value, 1) })} />
          </div>
          <div>
            <span className={label}>حد الرسائل لكل طالب أسبوعياً</span>
            <input type="number" min={1} className={input} value={alertSettings.maxMessagesPerWeek} onChange={e => updateAlertSettings({ maxMessagesPerWeek: num(e.target.value, 1) })} />
          </div>
          <div>
            <span className={label}>أقل فاصل بين رسالتين (ساعة)</span>
            <input type="number" min={0} className={input} value={alertSettings.minHoursBetween} onChange={e => updateAlertSettings({ minHoursBetween: num(e.target.value) })} />
          </div>
        </div>
        <p className="text-[12px] text-slate-500 dark:text-slate-400">
          تُقارن الإنذارات متوسط آخر {alertSettings.dropWindow} كويزات بمتوسط {alertSettings.dropWindow} قبلها. تُحتسب التغييرات فوراً.
        </p>
      </section>

      <section className="surface p-5 space-y-4">
        <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <FileSignature className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          الشهادات
        </h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <span className={label}>اسم الجهة على الشهادة</span>
            <input className={input} value={certSettings.institutionName} onChange={e => updateCertSettings({ institutionName: e.target.value })} />
          </div>
          <div>
            <span className={label}>صورة التوقيع (PNG/JPG شفاف، حتى 300 ك.ب)</span>
            <input
              type="file"
              accept="image/png,image/jpeg"
              className={input}
              onChange={e => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 300 * 1024) return flash('الصورة أكبر من 300 ك.ب');
                const r = new FileReader();
                r.onload = () => {
                  updateCertSettings({ signatureDataUrl: String(r.result) });
                  flash('حُفظ التوقيع');
                };
                r.readAsDataURL(f);
              }}
            />
          </div>
        </div>
        {certSettings.signatureDataUrl && (
          <div className="flex items-center gap-3">
            <img src={certSettings.signatureDataUrl} alt="التوقيع" className="h-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-1" />
            <button onClick={() => updateCertSettings({ signatureDataUrl: undefined })} className={btnGhost}>
              إزالة
            </button>
          </div>
        )}
        <label className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200 cursor-pointer">
          <input type="checkbox" checked={certSettings.autoApprove} onChange={e => updateCertSettings({ autoApprove: e.target.checked })} />
          اعتماد الشهادات تلقائياً عند الإصدار (بدلاً من مراجعتها يدوياً)
        </label>
      </section>

      <section className="surface p-5 space-y-3">
        <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          إضافة حساب دكتور
        </h3>
        <p className="text-[12px] text-slate-500 dark:text-slate-400">
          حسابات الدكاترة لا تُنشأ من صفحة التسجيل العامة، وتُضاف من هنا فقط، بنفس نموذج "إضافة حساب".
        </p>
        <button type="button" onClick={() => setAddDoctorOpen(true)} className={btnPrimary}>
          <Plus className="w-4 h-4" />
          إضافة دكتور
        </button>
      </section>
      <AddUserModal isOpen={addDoctorOpen} onClose={() => setAddDoctorOpen(false)} initialRole="doctor" />

      <TelegramAccountCard />

      <section className="surface p-5 space-y-4">
        <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Headphones className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          المساعدون ({assistants.length})
        </h3>
        <p className="text-[12px] text-slate-500 dark:text-slate-400">
          ادخل بحساب أي مساعد لترى بالظبط اللي هو شايفه وبيتعامل معاه (طلبات التسجيل، الرسائل، الملفات). لا تُحفظ أي تغييرات.
        </p>
        {assistants.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">لا يوجد مساعدون بعد. أضف واحداً من "إضافة حساب" في صفحة الطلاب.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {assistants.map(a => (
              <div key={a.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{a.name}</div>
                  <div className="text-[12px] text-slate-500 dark:text-slate-400 font-mono" dir="ltr">{a.academicId}</div>
                </div>
                <button onClick={() => impersonateAssistant(a.id)} className={btnGhost}>
                  <Eye className="w-4 h-4" />
                  معاينة كمساعد
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="surface p-5 border-rose-200 dark:border-rose-500/25 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-extrabold text-rose-800 dark:text-rose-300">إعادة ضبط البيانات التجريبية</div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">تعيد الطلاب والمحاضرات والنتائج والملفات المرفوعة إلى الحالة الأولى.</p>
        </div>
        <button
          onClick={() => window.confirm('سيُحذف كل شيء وتعود البيانات التجريبية الأولى. متابعة؟') && resetAllData()}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
        >
          <RefreshCw className="w-4 h-4" />
          إعادة الضبط
        </button>
      </section>
    </PageWrap>
  );
};
