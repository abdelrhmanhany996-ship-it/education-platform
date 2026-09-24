import React, { useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { useApp } from '../context/AppContext';
import { Lecture, QuestionBankItem, StudentLectureState } from '../types';
import { canRevealAnswers, getQuizDeadline } from '../utils/quizEngine';
import { formatCountdown, formatDateTime } from '../utils/format';
import {
  Award,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  EyeOff,
  HelpCircle,
  Hourglass,
  Lock,
  Play,
  ShieldAlert,
  XCircle
} from 'lucide-react';

type Answers = Record<string, { selectedOptionIndex?: number; textAnswer?: string }>;

interface Props {
  lecture: Lecture;
  studentState?: StudentLectureState;
}

const LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ'];
const stripLetter = (o: string) => o.replace(/^(?:[أابجدهـ]|[A-Ea-e])\s*[\)\-\.\:]\s*/, '');

function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

const Shell: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div
    id="stage3-quiz-container"
    className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-clip ${className}`}
  >
    {children}
  </div>
);

const Notice: React.FC<{
  icon: React.ReactNode;
  title: string;
  text: React.ReactNode;
  tone?: 'amber' | 'slate' | 'rose';
  children?: React.ReactNode;
}> = ({ icon, title, text, tone = 'slate', children }) => {
  const tones = {
    amber: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/25 text-amber-600 dark:text-amber-400',
    slate: 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400',
    rose: 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/25 text-rose-600 dark:text-rose-400'
  };
  return (
    <Shell className="p-8 text-center space-y-3">
      <div className={`w-14 h-14 rounded-2xl border mx-auto flex items-center justify-center ${tones[tone]}`}>
        {icon}
      </div>
      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">{text}</p>
      {children}
    </Shell>
  );
};

export const LectureStage3Quiz: React.FC<Props> = ({ lecture, studentState }) => {
  const { getAccess, startQuiz, saveQuizDraft, submitQuiz, logTabSwitch } = useApp();
  const now = useNow();
  const studentId = studentState?.studentId || '';
  const settings = lecture.quizSettings;

  const [error, setError] = useState('');
  const [answers, setAnswers] = useState<Answers>(studentState?.draftAnswers || {});
  const answersRef = useRef<Answers>(answers);
  answersRef.current = answers;
  const submittingRef = useRef(false);
  const saveTimer = useRef<number | undefined>(undefined);
  const [confettiDone, setConfettiDone] = useState(false);

  const running = !!studentState?.quizStartedAt && !studentState?.quizCompleted;
  const access = studentId ? getAccess(lecture.id, studentId) : null;
  const deadline = studentState && access ? getQuizDeadline(studentState, access) : null;
  const secondsLeft = deadline ? Math.max(0, Math.round((deadline - now) / 1000)) : 0;

  // The paper this student was dealt (fixed when the quiz started, survives reloads)
  const paper = useMemo(() => {
    if (!studentState?.quizQuestionOrder) return [];
    return studentState.quizQuestionOrder
      .map(id => lecture.questionBank.find(q => q.id === id))
      .filter((q): q is QuestionBankItem => !!q);
  }, [studentState?.quizQuestionOrder, lecture.questionBank]);

  const [qIndex, setQIndex] = useState(() => {
    if (!settings.preventGoBack || !studentState?.draftAnswers) return 0;
    const first = (studentState.quizQuestionOrder || []).findIndex(id => {
      const a = studentState.draftAnswers?.[id];
      return !(a && (a.selectedOptionIndex !== undefined || a.textAnswer?.trim()));
    });
    return Math.max(0, first);
  });

  const doSubmit = () => {
    if (!studentId) return;
    window.clearTimeout(saveTimer.current);
    const res = submitQuiz(lecture.id, studentId, answersRef.current);
    if (!res.success) {
      submittingRef.current = false;
      setError(res.error || 'تعذر تسليم الكويز');
      return;
    }
    if (res.totalPoints > 0 && res.score >= res.totalPoints * 0.7 && !confettiDone) {
      setConfettiDone(true);
      try {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      } catch {
        /* decorative only */
      }
    }
  };

  // Time is up: hand in what the student has, exactly once
  useEffect(() => {
    if (running && deadline && now >= deadline && !submittingRef.current) {
      submittingRef.current = true;
      doSubmit();
    }
  }, [now, running, deadline]);

  // Leaving the quiz tab is recorded for the doctor's activity report
  useEffect(() => {
    if (!running) return;
    const onHide = () => document.hidden && logTabSwitch(lecture.id, studentId);
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [running, lecture.id, studentId]);

  useEffect(() => () => window.clearTimeout(saveTimer.current), []);

  const persist = (next: Answers, immediate: boolean) => {
    setAnswers(next);
    window.clearTimeout(saveTimer.current);
    if (immediate) saveQuizDraft(lecture.id, studentId, next);
    else saveTimer.current = window.setTimeout(() => saveQuizDraft(lecture.id, studentId, next), 500);
  };

  /* ------------------------------ states ------------------------------ */

  if (!studentState?.stage2Completed) {
    return (
      <Notice
        tone="amber"
        icon={<Lock className="w-7 h-7" />}
        title="الكويز مقفل حالياً"
        text="لا يُفتح الكويز إلا بعد قراءة الشرح (المرحلة 1) وتسجيل الحضور والتقييم (المرحلة 2)."
      />
    );
  }

  /* ------------------------------ finished ---------------------------- */
  if (studentState.quizCompleted) {
    const score = studentState.quizScore ?? 0;
    const total = studentState.quizTotalPoints ?? 0;
    const pct = total ? Math.round((score / total) * 100) : 0;
    const reveal = canRevealAnswers(lecture, studentState);
    const drawn = (studentState.quizQuestionOrder || lecture.questionBank.map(x => x.id))
      .map(id => lecture.questionBank.find(q => q.id === id))
      .filter((q): q is QuestionBankItem => !!q);
    const given = studentState.answers || {};

    return (
      <Shell>
        <div className="bg-slate-900 dark:bg-slate-950 text-white p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-500/30">
              المرحلة 3: نتيجة الكويز
            </span>
            <h3 className="text-base font-bold mt-0.5">{lecture.title}</h3>
          </div>
        </div>

        <div className="p-6 md:p-8 space-y-6">
          <div className="bg-linear-to-r from-emerald-50 dark:from-emerald-500/10 to-teal-50 dark:to-teal-500/10 border border-emerald-200 dark:border-emerald-500/25 rounded-2xl p-6 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-emerald-950 dark:text-emerald-100">تم تسليم الكويز</h3>
            <div className="inline-flex items-center gap-4 bg-white dark:bg-slate-900 px-5 py-3 rounded-xl border border-emerald-200 dark:border-emerald-500/25">
              <div>
                <div className="text-[12px] font-bold text-slate-500 dark:text-slate-400">النتيجة</div>
                <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                  {score} / {total}
                </div>
              </div>
              <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
              <div>
                <div className="text-[12px] font-bold text-slate-500 dark:text-slate-400">النسبة</div>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{pct}%</div>
              </div>
            </div>
            {!!studentState.essayPending && (
              <p className="text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 rounded-lg px-3 py-2 max-w-md mx-auto">
                <Hourglass className="w-3.5 h-3.5 inline ms-1" />
                {studentState.essayPending} إجابة مقالية بانتظار تصحيح الدكتور، وستُضاف نقاطها إلى رصيدك بعد التصحيح.
              </p>
            )}
            {studentState.submittedLate && (
              <p className="text-xs text-rose-800 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 rounded-lg px-3 py-2 max-w-md mx-auto">
                انتهى الوقت قبل التسليم، فحُسبت الإجابات المحفوظة تلقائياً فقط.
              </p>
            )}
          </div>

          {!reveal ? (
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-sm text-slate-600 dark:text-slate-400">
              <EyeOff className="w-5 h-5 text-slate-400 shrink-0" />
              الإجابات النموذجية تظهر بعد إغلاق الكويز لجميع الطلاب، حتى لا تُسرَّب الأسئلة لمن لم يختبر بعد.
            </div>
          ) : (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">مراجعة الأسئلة والإجابات النموذجية</h4>
              {drawn.map((q, i) => {
                const order = studentState.quizOptionOrders?.[q.id] || q.options.map((_, k) => k);
                const mine = given[q.id];
                const isEssay = q.type === 'essay';
                const grade = studentState.essayGrades?.[q.id];
                const right = !isEssay && mine?.selectedOptionIndex === q.correctOptionIndex;
                return (
                  <div key={q.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3 bg-slate-50/50 dark:bg-slate-800/40">
                    <div className="flex items-start gap-2">
                      <span className="w-6 h-6 rounded-md bg-slate-900 dark:bg-slate-950 text-white text-xs font-bold flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100 flex-1">{q.prompt}</p>
                      {!isEssay &&
                        (right ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
                        ))}
                    </div>

                    {isEssay ? (
                      <div className="text-xs space-y-1.5">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 whitespace-pre-line text-slate-700 dark:text-slate-300">
                          {mine?.textAnswer || 'لم تُجب عن هذا السؤال'}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400">
                          {grade === undefined
                            ? mine?.textAnswer?.trim()
                              ? 'بانتظار التصحيح'
                              : ''
                            : `درجتك: ${grade} / ${q.points}`}
                        </div>
                      </div>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-2">
                        {order.map((orig, pos) => {
                          const isCorrect = orig === q.correctOptionIndex;
                          const isMine = orig === mine?.selectedOptionIndex;
                          return (
                            <div
                              key={orig}
                              className={`text-xs p-2.5 rounded-lg border flex items-center gap-2 ${
                                isCorrect
                                  ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-200 font-bold'
                                  : isMine
                                  ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500/40 text-rose-900 dark:text-rose-200'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <span className="font-bold">{LETTERS[pos]})</span>
                              <span className="flex-1">{stripLetter(q.options[orig])}</span>
                              {isMine && <span className="text-[12px]">إجابتك</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {q.explanation && (
                      <div className="text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                        <strong>الشرح: </strong>
                        {q.explanation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Shell>
    );
  }

  /* ------------------------------ not started ------------------------- */
  if (!running) {
    if (!lecture.questionBank.length) {
      return (
        <Notice
          icon={<HelpCircle className="w-7 h-7" />}
          title="بنك أسئلة الكويز قيد الإعداد"
          text="لم يرفع الدكتور أسئلة لهذه المحاضرة بعد."
        />
      );
    }
    if (!access || access.status === 'locked') {
      return (
        <Notice
          tone="amber"
          icon={<Lock className="w-7 h-7" />}
          title="الكويز مقفل حالياً"
          text={access && 'reason' in access ? access.reason : 'أكمل المرحلتين السابقتين'}
        />
      );
    }
    if (access.status === 'not_scheduled') {
      return (
        <Notice
          icon={<CalendarClock className="w-7 h-7" />}
          title="لم يُحدَّد موعد الكويز بعد"
          text={access.reason}
        />
      );
    }
    if (access.status === 'not_open') {
      const wait = Math.max(0, Math.round((new Date(access.opensAt).getTime() - now) / 1000));
      return (
        <Notice
          icon={<CalendarClock className="w-7 h-7" />}
          title="الكويز لم يُفتح بعد"
          text={`يفتح في ${formatDateTime(access.opensAt)} ويُغلق ${formatDateTime(access.closesAt)}.`}
        >
          <div className="inline-flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300">
            <Clock className="w-4 h-4" />
            يبدأ بعد {formatCountdown(wait)}
          </div>
        </Notice>
      );
    }
    if (access.status === 'closed') {
      return (
        <Notice
          tone="rose"
          icon={<Hourglass className="w-7 h-7" />}
          title="انتهت مدة الكويز"
          text={`أُغلق الكويز في ${formatDateTime(access.closesAt)} ولم تقم بتسليمه. تواصل مع الدكتور إن كان لديك عذر.`}
        />
      );
    }

    const count = settings.questionsToDraw > 0
      ? Math.min(settings.questionsToDraw, lecture.questionBank.length)
      : lecture.questionBank.length;
    const remaining = Math.max(0, Math.round((new Date(access.closesAt).getTime() - now) / 1000));

    return (
      <Shell>
        <div className="p-8 text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/25 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center">
            <Play className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">جاهز لبدء الكويز؟</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{lecture.title}</p>
          </div>

          <div className="grid grid-cols-3 gap-3 max-w-md mx-auto text-center">
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
              <div className="text-xl font-black text-slate-900 dark:text-slate-100">{count}</div>
              <div className="text-[12px] text-slate-500 dark:text-slate-400">سؤال</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
              <div className="text-xl font-black text-slate-900 dark:text-slate-100">{access.durationMinutes}</div>
              <div className="text-[12px] text-slate-500 dark:text-slate-400">دقيقة</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
              <div className="text-xl font-black text-slate-900 dark:text-slate-100">1</div>
              <div className="text-[12px] text-slate-500 dark:text-slate-400">نقطة/سؤال</div>
            </div>
          </div>

          <ul className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto text-start space-y-1.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 rounded-xl p-4">
            <li>• يبدأ المؤقت عند الضغط على "ابدأ" ولا يتوقف إذا أغلقت الصفحة.</li>
            <li>• إجاباتك تُحفظ تلقائياً، وإعادة تحميل الصفحة لا تغيّر الأسئلة ولا الوقت.</li>
            {settings.preventGoBack && <li>• لا يمكن الرجوع إلى سؤال سابق بعد تجاوزه.</li>}
            <li>• مغادرة تبويب الكويز تُسجَّل في تقرير الدكتور.</li>
            <li>• يُغلق الكويز نهائياً بعد {formatCountdown(remaining)}.</li>
          </ul>

          {error && <p className="text-sm text-rose-600 dark:text-rose-400 font-bold">{error}</p>}

          <button
            id="start-quiz-btn"
            onClick={() => {
              const res = startQuiz(lecture.id, studentId);
              if (!res.success) setError(res.error || 'تعذر بدء الكويز');
              else setError('');
            }}
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-black shadow-md shadow-indigo-900/20 transition-colors"
          >
            ابدأ الكويز الآن
          </button>
        </div>
      </Shell>
    );
  }

  /* ------------------------------ running ----------------------------- */
  if (!paper.length) {
    return (
      <Notice
        icon={<HelpCircle className="w-7 h-7" />}
        title="تعذر تحميل أسئلتك"
        text="حُذفت الأسئلة من بنك المحاضرة أثناء الكويز. تواصل مع الدكتور."
      />
    );
  }

  const q = paper[Math.min(qIndex, paper.length - 1)];
  const order = studentState.quizOptionOrders?.[q.id] || q.options.map((_, i) => i);
  const answered = (id: string) => {
    const a = answers[id];
    return !!a && (a.selectedOptionIndex !== undefined || !!a.textAnswer?.trim());
  };
  const answeredCount = paper.filter(p => answered(p.id)).length;
  const isLast = qIndex === paper.length - 1;
  const low = secondsLeft < 120;

  return (
    <Shell>
      <div className="bg-slate-900 dark:bg-slate-950 text-white p-4 flex flex-wrap items-center justify-between gap-3 sticky top-16 z-10">
        <div>
          <span className="text-xs font-bold bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-500/30">
            المرحلة 3: كويز المحاضرة
          </span>
          <h3 className="text-base font-bold mt-0.5">{lecture.title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {settings.preventGoBack && (
            <span className="hidden sm:flex text-[12px] bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-lg border border-amber-500/30 items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5" />
              ممنوع الرجوع
            </span>
          )}
          <div
            role="timer"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-sm font-bold border ${
              low
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 animate-pulse'
                : 'bg-slate-800 dark:bg-slate-700 border-slate-700 text-indigo-300'
            }`}
          >
            <Clock className="w-4 h-4" />
            {formatCountdown(secondsLeft)}
          </div>
        </div>
      </div>

      <div className="h-1.5 bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full bg-indigo-500 transition-all"
          style={{ width: `${(answeredCount / paper.length) * 100}%` }}
        />
      </div>

      <form
        onSubmit={e => {
          e.preventDefault();
          if (!submittingRef.current) {
            submittingRef.current = true;
            doSubmit();
          }
        }}
        className="p-5 md:p-8 space-y-6"
      >
        {/* Question palette */}
        <div className="flex flex-wrap gap-1.5" aria-label="أسئلة الكويز">
          {paper.map((p, i) => {
            const locked = settings.preventGoBack && i < qIndex;
            return (
              <button
                key={p.id}
                type="button"
                disabled={locked}
                onClick={() => setQIndex(i)}
                aria-label={`السؤال ${i + 1}`}
                className={`w-9 h-9 rounded-lg text-xs font-bold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  i === qIndex
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : answered(p.id)
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        <div className="space-y-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            السؤال {qIndex + 1} من {paper.length}
            {q.type === 'essay' && (
              <span className="ms-2 bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/25 px-2 py-0.5 rounded-md font-bold">
                مقالي
              </span>
            )}
          </div>
          <p className="text-base md:text-lg font-bold text-slate-900 dark:text-slate-100 leading-relaxed">{q.prompt}</p>

          {q.type === 'essay' ? (
            <textarea
              rows={7}
              value={answers[q.id]?.textAnswer || ''}
              onChange={e =>
                persist({ ...answers, [q.id]: { ...answers[q.id], textAnswer: e.target.value } }, false)
              }
              placeholder="اكتب إجابتك هنا..."
              enterKeyHint="done"
              className="w-full text-sm p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-300 dark:border-slate-600 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 leading-relaxed"
            />
          ) : (
            <div className="grid gap-2.5" role="radiogroup">
              {order.map((orig, pos) => {
                const selected = answers[q.id]?.selectedOptionIndex === orig;
                return (
                  <button
                    key={orig}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() =>
                      persist({ ...answers, [q.id]: { ...answers[q.id], selectedOptionIndex: orig } }, true)
                    }
                    className={`w-full text-start p-3.5 rounded-xl border-2 text-sm flex items-center gap-3 transition-colors ${
                      selected
                        ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-500 text-indigo-950 dark:text-indigo-100 font-bold'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-indigo-300 dark:hover:border-indigo-500/40'
                    }`}
                  >
                    <span
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                        selected ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {LETTERS[pos]}
                    </span>
                    <span className="flex-1">{stripLetter(q.options[orig])}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-rose-600 dark:text-rose-400 font-bold">{error}</p>}

        <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            disabled={qIndex === 0 || settings.preventGoBack}
            onClick={() => setQIndex(i => Math.max(0, i - 1))}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
            السابق
          </button>

          <span className="text-xs text-slate-500 dark:text-slate-400">
            أجبت عن {answeredCount} من {paper.length}
          </span>

          {isLast ? (
            <button
              type="submit"
              id="submit-quiz-btn"
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black"
              onClick={e => {
                if (answeredCount < paper.length && !window.confirm(`لم تجب عن ${paper.length - answeredCount} سؤال. تسليم الكويز الآن؟`)) {
                  e.preventDefault();
                }
              }}
            >
              تسليم الكويز
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setQIndex(i => Math.min(paper.length - 1, i + 1))}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold"
            >
              التالي
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      </form>
    </Shell>
  );
};
