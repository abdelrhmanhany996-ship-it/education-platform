import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Lecture, QuizAccessMode, QuizSchedule, QuizSettings } from '../types';
import { QuestionUploadModal } from './QuestionUploadModal';
import { formatDateTime, fromLocalInput, toLocalInput } from '../utils/format';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  FileText,
  Loader2,
  Plus,
  Trash2,
  Upload,
  Users
} from 'lucide-react';

const input =
  'w-full text-sm p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500';
const label = 'block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1';
const btnPrimary =
  'px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5';
const btnGhost =
  'px-3 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5';

type Tab = 'explain' | 'questions' | 'quiz';

/* ------------------------------ schedule editors ------------------------------ */

const DateRange: React.FC<{
  value?: QuizSchedule;
  onChange: (v: QuizSchedule | undefined) => void;
}> = ({ value, onChange }) => (
  <div className="grid sm:grid-cols-3 gap-2">
    <div>
      <span className={label}>يفتح</span>
      <input
        type="datetime-local"
        className={input}
        value={toLocalInput(value?.opensAt)}
        onChange={e => {
          const iso = fromLocalInput(e.target.value);
          if (!iso) return onChange(undefined);
          onChange({ opensAt: iso, closesAt: value?.closesAt || iso, durationMinutes: value?.durationMinutes });
        }}
      />
    </div>
    <div>
      <span className={label}>يُغلق</span>
      <input
        type="datetime-local"
        className={input}
        value={toLocalInput(value?.closesAt)}
        onChange={e => {
          const iso = fromLocalInput(e.target.value);
          if (!iso || !value) return;
          onChange({ ...value, closesAt: iso });
        }}
        disabled={!value}
      />
    </div>
    <div>
      <span className={label}>مدة الطالب (دقيقة)</span>
      <input
        type="number"
        min={1}
        placeholder="الافتراضية"
        className={input}
        value={value?.durationMinutes ?? ''}
        onChange={e => {
          if (!value) return;
          onChange({ ...value, durationMinutes: e.target.value ? Number(e.target.value) : undefined });
        }}
        disabled={!value}
      />
    </div>
  </div>
);

const ScheduleEditor: React.FC<{ lecture: Lecture }> = ({ lecture }) => {
  const { users, groups, updateLectureQuizSettings } = useApp();
  const s = lecture.quizSettings;
  const mode: QuizAccessMode = s.accessMode || 'window';
  const students = users.filter(u => u.role === 'student');
  const patch = (p: Partial<QuizSettings>) => updateLectureQuizSettings(lecture.id, p);

  // automatic staggering for option C
  const [start, setStart] = useState('');
  const [gap, setGap] = useState(10);
  const [windowH, setWindowH] = useState(2);

  const setStudent = (studentId: string, sched?: QuizSchedule) => {
    const rest = (s.studentSchedules || []).filter(x => x.studentId !== studentId);
    patch({ studentSchedules: sched ? [...rest, { ...sched, studentId }] : rest });
  };
  const setGroup = (groupId: string, sched?: QuizSchedule) => {
    const rest = (s.groupSchedules || []).filter(x => x.groupId !== groupId);
    patch({ groupSchedules: sched ? [...rest, { ...sched, groupId }] : rest });
  };

  const autoDistribute = () => {
    const base = fromLocalInput(start);
    if (!base) return;
    const t0 = new Date(base).getTime();
    patch({
      studentSchedules: students.map((st, i) => {
        const opens = t0 + i * gap * 60000;
        return {
          studentId: st.id,
          opensAt: new Date(opens).toISOString(),
          closesAt: new Date(opens + windowH * 3600000).toISOString()
        };
      })
    });
  };

  const modes: { id: QuizAccessMode; title: string; text: string }[] = [
    { id: 'window', title: 'أ) نافذة عامة', text: 'فترة واحدة للجميع، والمؤقت يبدأ عند دخول كل طالب.' },
    { id: 'groups', title: 'ب) مجموعات', text: 'كل مجموعة لها وقت فتح وإغلاق مختلف.' },
    { id: 'per_student', title: 'ج) لكل طالب', text: 'موعد ومدة مخصصة لكل طالب، الأدق مع توزيع تلقائي.' }
  ];

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-2">
        {modes.map(m => (
          <button
            key={m.id}
            type="button"
            onClick={() => patch({ accessMode: m.id })}
            className={`text-start p-3 rounded-xl border-2 transition-colors ${
              mode === m.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-200 dark:hover:border-indigo-500/25'
            }`}
          >
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{m.title}</div>
            <div className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">{m.text}</div>
          </button>
        ))}
      </div>

      {mode === 'window' && (
        <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
          <label className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
            <input
              type="checkbox"
              checked={!!s.publicWindow}
              onChange={e => {
                if (e.target.checked) {
                  const now = new Date();
                  patch({
                    publicWindow: {
                      opensAt: now.toISOString(),
                      closesAt: new Date(now.getTime() + 6 * 3600000).toISOString()
                    }
                  });
                } else patch({ publicWindow: undefined });
              }}
            />
            تحديد نافذة عامة بتاريخ ووقت (مثلاً 6 ساعات)
          </label>
          {s.publicWindow ? (
            <DateRange value={s.publicWindow} onChange={v => patch({ publicWindow: v })} />
          ) : (
            <div className="max-w-xs">
              <span className={label}>مدة الصلاحية لكل طالب بعد تسجيل حضوره (ساعة)</span>
              <input
                type="number"
                min={1}
                className={input}
                value={s.validityWindowHours}
                onChange={e => patch({ validityWindowHours: Math.max(1, Number(e.target.value) || 1) })}
              />
            </div>
          )}
        </div>
      )}

      {mode === 'groups' && (
        <div className="space-y-3">
          {groups.length === 0 && (
            <div className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              لا توجد مجموعات. أنشئها من صفحة "المجموعات" في القائمة الجانبية ثم عُد هنا.
            </div>
          )}
          {groups.map(g => {
            const sched = s.groupSchedules?.find(x => x.groupId === g.id);
            return (
              <div key={g.id} className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    {g.name}
                    <span className="text-[12px] text-slate-500 dark:text-slate-400 font-normal">({g.memberIds.length} طالب)</span>
                  </div>
                  {!sched && <span className="text-[12px] text-amber-700 dark:text-amber-300 font-bold">بلا موعد</span>}
                </div>
                <DateRange
                  value={sched}
                  onChange={v => setGroup(g.id, v)}
                />
              </div>
            );
          })}
        </div>
      )}

      {mode === 'per_student' && (
        <div className="space-y-3">
          <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/25 rounded-xl p-4 space-y-3">
            <div className="text-sm font-bold text-indigo-950 dark:text-indigo-100">توزيع تلقائي على كل الطلاب ({students.length})</div>
            <div className="grid sm:grid-cols-4 gap-2 items-end">
              <div className="sm:col-span-2">
                <span className={label}>يبدأ الأول في</span>
                <input type="datetime-local" className={input} value={start} onChange={e => setStart(e.target.value)} />
              </div>
              <div>
                <span className={label}>فاصل بين طالبين (دقيقة)</span>
                <input type="number" min={0} className={input} value={gap} onChange={e => setGap(Number(e.target.value))} />
              </div>
              <div>
                <span className={label}>مدة إتاحة كل طالب (ساعة)</span>
                <input type="number" min={1} className={input} value={windowH} onChange={e => setWindowH(Number(e.target.value) || 1)} />
              </div>
            </div>
            <button disabled={!start} onClick={autoDistribute} className={btnPrimary}>
              <CalendarClock className="w-4 h-4" />
              توزيع المواعيد
            </button>
          </div>

          <div className="border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto scroll-thin">
            {students.map(st => {
              const sched = s.studentSchedules?.find(x => x.studentId === st.id);
              return (
                <div key={st.id} className="p-3 grid lg:grid-cols-[10rem_1fr] gap-2 items-center">
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{st.name}</div>
                  <DateRange value={sched} onChange={v => setStudent(st.id, v)} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

/* --------------------------------- lecture panel -------------------------------- */

const LecturePanel: React.FC<{ lecture: Lecture; index: number }> = ({ lecture, index }) => {
  const {
    updateLecture,
    updateLectureQuizSettings,
    replaceLecturePdf,
    deleteLecture,
    updateQuestion,
    deleteQuestion
  } = useApp();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('explain');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const s = lecture.quizSettings;
  const pending = lecture.questionBank.filter(q => q.type !== 'essay' && q.correctOptionIndex === undefined).length;
  const released = !lecture.releaseAt || new Date(lecture.releaseAt).getTime() <= Date.now();

  const tabs: { id: Tab; label: string }[] = [
    { id: 'explain', label: 'الشرح' },
    { id: 'questions', label: `الأسئلة (${lecture.questionBank.length})` },
    { id: 'quiz', label: 'الكويز والجدولة' }
  ];

  const numField = (
    lbl: string,
    key: 'durationMinutes' | 'questionsToDraw' | 'passingPercentage',
    hint?: string
  ) => (
    <div>
      <span className={label}>{lbl}</span>
      <input
        type="number"
        min={0}
        className={input}
        value={s[key]}
        onChange={e => updateLectureQuizSettings(lecture.id, { [key]: Math.max(0, Number(e.target.value) || 0) })}
      />
      {hint && <span className="text-[12px] text-slate-500 dark:text-slate-400">{hint}</span>}
    </div>
  );

  const toggle = (lbl: string, key: 'randomizeQuestions' | 'randomizeChoices' | 'preventGoBack') => (
    <label className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 cursor-pointer">
      <input
        type="checkbox"
        checked={!!s[key]}
        onChange={e => updateLectureQuizSettings(lecture.id, { [key]: e.target.checked })}
      />
      {lbl}
    </label>
  );

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full text-start p-4 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
      >
        <span className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-black text-sm flex items-center justify-center shrink-0">
          {index}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{lecture.title}</div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" />
              {lecture.explanationPdf.fileId ? `PDF (${lecture.explanationPdf.pageCount} صفحة)` : 'شرح تجريبي'}
            </span>
            <span>{lecture.questionBank.length} سؤال</span>
            <span className={released ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300 font-bold'}>
              {released ? 'منشورة' : `تُنشر ${formatDateTime(lecture.releaseAt)}`}
            </span>
            {pending > 0 && <span className="text-rose-600 dark:text-rose-400 font-bold">{pending} سؤال بلا إجابة</span>}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-slate-200 dark:border-slate-700 p-4 space-y-4">
          <div role="tablist" className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit max-w-full overflow-x-auto scroll-thin">
            {tabs.map(t => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                  tab === t.id ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {msg && (
            <div
              className={`text-sm rounded-xl px-3 py-2 border ${
                msg.ok ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/25 text-emerald-800 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/25 text-rose-800 dark:text-rose-300'
              }`}
            >
              {msg.text}
            </div>
          )}

          {tab === 'explain' && (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <span className={label}>عنوان المحاضرة</span>
                  <input
                    className={input}
                    defaultValue={lecture.title}
                    onBlur={e => e.target.value.trim() && updateLecture(lecture.id, { title: e.target.value.trim() })}
                  />
                </div>
                <div>
                  <span className={label}>موعد النشر (قبله تظهر مقفلة للطلاب)</span>
                  <input
                    type="datetime-local"
                    className={input}
                    value={toLocalInput(lecture.releaseAt)}
                    onChange={e => updateLecture(lecture.id, { releaseAt: fromLocalInput(e.target.value) })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <span className={label}>وصف مختصر</span>
                  <input
                    className={input}
                    defaultValue={lecture.summary}
                    onBlur={e => updateLecture(lecture.id, { summary: e.target.value })}
                  />
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm">
                  <div className="font-bold text-slate-900 dark:text-slate-100">ملف الشرح (PDF)</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {lecture.explanationPdf.fileId
                      ? 'ملف مرفوع، يظهر للطالب بلا زر تنزيل وعليه اسمه وكوده.'
                      : 'الشرح الحالي نصوص تجريبية. ارفع PDF لاستبداله.'}
                  </div>
                </div>
                <label className={`${btnPrimary} cursor-pointer ${busy ? 'opacity-60 pointer-events-none' : ''}`}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {lecture.explanationPdf.fileId ? 'استبدال الملف' : 'رفع ملف PDF'}
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    className="sr-only"
                    onChange={async e => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (!f) return;
                      setBusy(true);
                      const r = await replaceLecturePdf(lecture.id, f);
                      setBusy(false);
                      setMsg({ ok: r.success, text: r.success ? 'تم رفع الملف' : r.error || 'فشل الرفع' });
                    }}
                  />
                </label>
              </div>

              <button
                onClick={() => window.confirm('حذف المحاضرة وكل نتائج الطلاب فيها؟ لا يمكن التراجع.') && deleteLecture(lecture.id)}
                className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                حذف المحاضرة
              </button>
            </div>
          )}

          {tab === 'questions' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  اضغط الخيار لتحديده كإجابة صحيحة. الأسئلة الزائدة عن عدد الكويز تُسحب عشوائياً لكل طالب.
                </p>
                <button onClick={() => setUploadOpen(true)} className={btnPrimary}>
                  <Upload className="w-4 h-4" />
                  رفع ملف أسئلة
                </button>
              </div>

              {lecture.questionBank.length === 0 && (
                <div className="text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl p-6 text-center">لا توجد أسئلة بعد.</div>
              )}

              {lecture.questionBank.map((q, i) => (
                <div key={q.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-2 bg-slate-50/50 dark:bg-slate-800/40">
                  <div className="flex items-start gap-2">
                    <span className="w-6 h-6 rounded-md bg-slate-900 dark:bg-slate-950 text-white text-xs font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 flex-1">{q.prompt}</p>
                    <span className="text-[12px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-md shrink-0">
                      {q.type === 'essay' ? 'مقالي' : q.type === 'true_false' ? 'صح/خطأ' : 'اختيار'}
                    </span>
                    <button
                      onClick={() => deleteQuestion(lecture.id, q.id)}
                      aria-label="حذف السؤال"
                      className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {q.options.length > 0 && (
                    <div className="grid sm:grid-cols-2 gap-1.5">
                      {q.options.map((o, k) => (
                        <button
                          key={k}
                          onClick={() => updateQuestion(lecture.id, q.id, { correctOptionIndex: k })}
                          className={`text-start text-xs p-2 rounded-lg border ${
                            k === q.correctOptionIndex
                              ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-400 text-emerald-900 dark:text-emerald-200 font-bold'
                              : q.correctOptionIndex === undefined
                              ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/25 text-slate-800 dark:text-slate-200'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-300 dark:hover:border-emerald-500/40'
                          }`}
                        >
                          {o}
                          {k === q.correctOptionIndex && ' ✓'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === 'quiz' && (
            <div className="space-y-5">
              <div className="grid sm:grid-cols-3 gap-3">
                {numField('مدة الكويز (دقيقة)', 'durationMinutes')}
                {numField('عدد الأسئلة لكل طالب', 'questionsToDraw', `0 = كل البنك (${lecture.questionBank.length})`)}
                {numField('نسبة النجاح %', 'passingPercentage')}
              </div>
              <div className="grid sm:grid-cols-3 gap-2">
                {toggle('ترتيب عشوائي للأسئلة', 'randomizeQuestions')}
                {toggle('ترتيب عشوائي للاختيارات', 'randomizeChoices')}
                {toggle('منع الرجوع للسؤال السابق', 'preventGoBack')}
              </div>
              <div className="max-w-sm">
                <span className={label}>ظهور الإجابات النموذجية للطالب</span>
                <select
                  className={input}
                  value={s.revealAnswers || 'after_close'}
                  onChange={e =>
                    updateLectureQuizSettings(lecture.id, { revealAnswers: e.target.value as QuizSettings['revealAnswers'] })
                  }
                >
                  <option value="after_close">بعد إغلاق الكويز للجميع (الأفضل)</option>
                  <option value="after_submit">فور التسليم</option>
                  <option value="never">لا تظهر</option>
                </select>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  طريقة فتح الكويز
                </h4>
                <ScheduleEditor lecture={lecture} />
              </div>
            </div>
          )}
        </div>
      )}

      <QuestionUploadModal isOpen={uploadOpen} onClose={() => setUploadOpen(false)} targetLecture={lecture} />
    </div>
  );
};

/* ---------------------------------- page ---------------------------------- */

export const DoctorCourses: React.FC = () => {
  const { courses, addNewWeek, addNewLecture, createCourse, setCoursePrice } = useApp();
  const [selectedCourseId, setSelectedCourseId] = useState(courses[0]?.id || '');
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [showNewCourse, setShowNewCourse] = useState(false);
  const course = courses.find(c => c.id === selectedCourseId) || courses[0];
  const [weekForm, setWeekForm] = useState({ open: false, title: '', desc: '' });
  const [lecForm, setLecForm] = useState<{
    weekId: string;
    title: string;
    summary: string;
    duration: string;
    releaseAt: string;
    file: File | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  let counter = 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">المقررات والمحاضرات</h2>
          {course ? (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                {course.title} · <bdi dir="ltr">{course.code}</bdi> ·{' '}
                <span className={course.isCompleted ? 'text-slate-500 dark:text-slate-400' : 'text-emerald-700 dark:text-emerald-300 font-bold'}>
                  {course.isCompleted ? 'منتهٍ' : 'جارٍ'}
                </span>
              </p>
              <label className="flex items-center gap-2 mt-2 text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300">سعر الكورس (يظهر للطالب عند التسجيل):</span>
                <input
                  type="number"
                  min={0}
                  defaultValue={course.price ?? ''}
                  key={course.id}
                  placeholder="مجاني"
                  onBlur={e => {
                    const v = e.target.value.trim();
                    setCoursePrice(course.id, v === '' ? null : Number(v));
                  }}
                  className="w-28 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-slate-500 dark:text-slate-400">ج.م</span>
              </label>
            </>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">أنشئ أول مقرر لك لتبدأ.</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowNewCourse(v => !v)} className={btnGhost}>
            <Plus className="w-4 h-4" />
            كورس جديد
          </button>
          {course && (
            <button onClick={() => setWeekForm(f => ({ ...f, open: !f.open }))} className={btnPrimary}>
              <Plus className="w-4 h-4" />
              أسبوع جديد
            </button>
          )}
        </div>
      </div>

      {courses.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto scroll-thin pb-1">
          {courses.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCourseId(c.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                c.id === selectedCourseId ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {c.title}
            </button>
          ))}
        </div>
      )}

      {showNewCourse && (
        <form
          onSubmit={e => {
            e.preventDefault();
            if (!newCourseTitle.trim()) return;
            createCourse(newCourseTitle.trim());
            setNewCourseTitle('');
            setShowNewCourse(false);
          }}
          className="surface p-4 grid sm:grid-cols-[1fr_auto] gap-3 items-end"
        >
          <div>
            <span className={label}>اسم المقرر / المادة الجديدة</span>
            <input className={input} value={newCourseTitle} onChange={e => setNewCourseTitle(e.target.value)} required />
          </div>
          <button type="submit" className={btnPrimary}>
            إنشاء
          </button>
        </form>
      )}

      {!course ? (
        <div className="surface p-10 text-center text-slate-500 dark:text-slate-400">لا يوجد مقرر بعد. أنشئ أول واحد من زر "كورس جديد".</div>
      ) : (
        <>
      {weekForm.open && (
        <form
          onSubmit={e => {
            e.preventDefault();
            if (!weekForm.title.trim()) return;
            addNewWeek(course.id, weekForm.title.trim(), weekForm.desc.trim());
            setWeekForm({ open: false, title: '', desc: '' });
          }}
          className="surface p-4 grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end"
        >
          <div>
            <span className={label}>عنوان الأسبوع</span>
            <input className={input} value={weekForm.title} onChange={e => setWeekForm(f => ({ ...f, title: e.target.value }))} required />
          </div>
          <div>
            <span className={label}>وصف (اختياري)</span>
            <input className={input} value={weekForm.desc} onChange={e => setWeekForm(f => ({ ...f, desc: e.target.value }))} />
          </div>
          <button type="submit" className={btnPrimary}>
            إضافة
          </button>
        </form>
      )}

      {course.weeks.map(week => (
        <section key={week.id} className="surface p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">{week.title}</h3>
              {week.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{week.description}</p>}
            </div>
            <button
              onClick={() =>
                setLecForm({ weekId: week.id, title: '', summary: '', duration: '45 دقيقة', releaseAt: '', file: null })
              }
              className={btnGhost}
            >
              <Plus className="w-4 h-4" />
              محاضرة
            </button>
          </div>

          {lecForm?.weekId === week.id && (
            <form
              onSubmit={async e => {
                e.preventDefault();
                setBusy(true);
                setError('');
                const r = await addNewLecture(course.id, week.id, {
                  title: lecForm.title.trim(),
                  summary: lecForm.summary.trim(),
                  duration: lecForm.duration,
                  releaseAt: fromLocalInput(lecForm.releaseAt),
                  pdfTitle: lecForm.title.trim(),
                  pdfFile: lecForm.file
                });
                setBusy(false);
                if (r.success) setLecForm(null);
                else setError(r.error || 'تعذرت الإضافة');
              }}
              className="bg-indigo-50/60 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/25 rounded-2xl p-4 space-y-3"
            >
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <span className={label}>عنوان المحاضرة *</span>
                  <input className={input} required value={lecForm.title} onChange={e => setLecForm({ ...lecForm, title: e.target.value })} />
                </div>
                <div>
                  <span className={label}>موعد النشر (اتركه فارغاً للنشر الآن)</span>
                  <input type="datetime-local" className={input} value={lecForm.releaseAt} onChange={e => setLecForm({ ...lecForm, releaseAt: e.target.value })} />
                </div>
                <div>
                  <span className={label}>وصف مختصر</span>
                  <input className={input} value={lecForm.summary} onChange={e => setLecForm({ ...lecForm, summary: e.target.value })} />
                </div>
                <div>
                  <span className={label}>المدة</span>
                  <input className={input} value={lecForm.duration} onChange={e => setLecForm({ ...lecForm, duration: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <span className={label}>ملف الشرح (PDF، حتى 25 ميجابايت)</span>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    className={input}
                    onChange={e => setLecForm({ ...lecForm, file: e.target.files?.[0] || null })}
                  />
                </div>
              </div>
              {error && <p className="text-sm text-rose-700 dark:text-rose-300 font-bold">{error}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={busy} className={btnPrimary}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  حفظ المحاضرة
                </button>
                <button type="button" onClick={() => setLecForm(null)} className={btnGhost}>
                  إلغاء
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2.5">
            {week.lectures.length === 0 && (
              <div className="text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl p-5 text-center">لا توجد محاضرات في هذا الأسبوع.</div>
            )}
            {week.lectures.map(l => (
              <LecturePanel key={l.id} lecture={l} index={++counter} />
            ))}
          </div>
        </section>
      ))}
      </>
      )}
    </div>
  );
};
