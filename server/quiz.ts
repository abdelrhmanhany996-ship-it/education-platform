/**
 * Quizzes run on the server.
 *
 *  - Students never receive the question bank. Before starting they only see how many questions there are;
 *    after starting they get their own drawn paper, without correct answers or explanations.
 *  - Answers are revealed only when the doctor's reveal rule allows it (after submit / after the quiz closes).
 *  - Starting, the timer/deadline and grading are decided here, so editing the page cannot change a score.
 */
import crypto from 'node:crypto';
import type { Doc, Store } from './store';
import { HttpError } from './access';
import { buildAttemptPlan, canRevealAnswers, getQuizAccess, getQuizDeadline, gradeAttempt } from '../src/utils/quizEngine';
import { isCorruptQuestion } from '../src/utils/pdfQuestionParser';

const ANSWER_FIELDS = ['correctOptionIndex', 'correctOptionIndexes', 'correctAnswerText', 'explanation', 'needsReview'];

const stripAnswers = (q: Doc): Doc => {
  const out = { ...q };
  ANSWER_FIELDS.forEach(k => delete out[k]);
  return out;
};

/** The student's copy of a course: no question bank, only their own paper (answers only when allowed). */
export function courseForStudent(course: Doc, studentId: string, states: Doc[]): Doc {
  return {
    ...course,
    weeks: (course.weeks || []).map((w: Doc) => ({
      ...w,
      lectures: (w.lectures || []).map((l: Doc) => {
        const bank: Doc[] = (l.questionBank || []).filter((q: Doc) => !isCorruptQuestion(q as any));
        const st = states.find(s => s.studentId === studentId && s.lectureId === l.id);
        const order: string[] = st && (st.quizStartedAt || st.quizCompleted) ? st.quizQuestionOrder || [] : [];
        const reveal = canRevealAnswers(l as any, st as any);
        const paper = order
          .map(id => bank.find(q => q.id === id))
          .filter(Boolean)
          .map(q => (reveal ? q! : stripAnswers(q!)));
        // A video link (YouTube…) is never sent in the course data; the player asks for it through video-access
        const { videoUrl, ...rest } = l;
        return { ...rest, ...(videoUrl ? { externalVideo: true } : {}), questionBank: paper, questionCount: bank.length };
      })
    }))
  };
}

/* --------------------------- protected state fields -------------------------- */

/** Only the server sets these on a student's progress record. */
const SERVER_ONLY = [
  'quizStartedAt',
  'quizQuestionOrder',
  'quizOptionOrders',
  'quizCompleted',
  'quizAutoScore',
  'essayGrades',
  'essayPending',
  'quizScore',
  'quizTotalPoints',
  'quizAttemptsCount',
  'quizFinishedAt',
  'quizDurationSeconds',
  'submittedLate',
  'answers',
  'quizWindowStart',
  'quizWindowEnd'
];

/**
 * What a student may store in their own progress record: lecture/attendance steps, drafts while a quiz
 * runs, tab-switch counts (never lowered). Everything about the quiz outcome keeps the server's value.
 */
export function safeStudentState(incoming: Doc, existing: Doc | undefined, lecture: Doc | undefined): Doc {
  const out: Doc = { ...incoming };
  if (existing) {
    out.studentId = existing.studentId;
    out.lectureId = existing.lectureId;
    out.courseId = existing.courseId;
  }
  for (const k of SERVER_ONLY) {
    if (existing && k in existing) out[k] = existing[k];
    else delete out[k];
  }
  // The quiz window starts when attendance is first recorded, with the length the doctor set
  if (out.stage2Completed && !out.quizWindowStart && lecture) {
    const hours = lecture.quizSettings?.validityWindowHours || 24;
    const now = Date.now();
    out.quizWindowStart = new Date(now).toISOString();
    out.quizWindowEnd = new Date(now + hours * 3600_000).toISOString();
  }
  const running = !!existing?.quizStartedAt && !existing?.quizCompleted;
  if (!running) {
    if (existing && 'draftAnswers' in existing) out.draftAnswers = existing.draftAnswers;
    else delete out.draftAnswers;
  }
  out.tabSwitches = Math.max(Number(existing?.tabSwitches) || 0, Number(incoming.tabSwitches) || 0);
  if (existing?.currentStage === 'completed') out.currentStage = 'completed';
  if (existing?.stage2Completed) out.stage2Completed = true;
  if (existing?.stage1Completed) out.stage1Completed = true;
  return out;
}

/* ------------------------------- start / submit ------------------------------ */

const busy = new Set<string>();
const lock = (key: string) => {
  if (busy.has(key)) throw new HttpError(409, 'جارٍ تنفيذ الطلب، انتظر لحظة');
  busy.add(key);
  return () => busy.delete(key);
};

const logEntry = (me: Doc, action: string, details?: string): Doc => ({
  id: `log_${crypto.randomUUID().slice(0, 12)}`,
  userId: me.id,
  userName: me.name,
  userAcademicId: me.academicId,
  userRole: me.role,
  action,
  timestamp: new Date().toISOString(),
  type: 'quiz',
  ...(details ? { details } : {})
});

async function load(store: Store, me: Doc, ref: { lecture: Doc }) {
  const states = await store.getAll('studentStates');
  const state = states.find(s => s.studentId === me.id && s.lectureId === ref.lecture.id);
  const groups = await store.getAll('groups');
  return { state, groups };
}

export async function startQuiz(store: Store, me: Doc, ref: { course: Doc; lecture: Doc }) {
  if (me.role !== 'student') throw new HttpError(403, 'الكويز للطلاب فقط (المعاينة لا تبدأ كويزاً)');
  const release = lock(`${me.id}:${ref.lecture.id}`);
  try {
    const { state, groups } = await load(store, me, ref);
    const lecture = ref.lecture;
    if (!state) throw new HttpError(400, 'أكمل قراءة الشرح وسجّل الحضور أولاً');
    if (state.quizCompleted) throw new HttpError(409, 'سلّمت هذا الكويز بالفعل');
    if (state.quizStartedAt) return { resumed: true };
    if (!(lecture.questionBank || []).length) throw new HttpError(400, 'لا توجد أسئلة في هذا الكويز بعد');

    const access = getQuizAccess(lecture as any, me.id, groups as any, state as any);
    if (access.status === 'locked' || access.status === 'not_scheduled') throw new HttpError(403, access.reason);
    if (access.status === 'not_open') throw new HttpError(403, 'الكويز لم يُفتح بعد');
    if (access.status === 'closed') throw new HttpError(403, 'انتهت مدة الكويز');

    const plan = buildAttemptPlan(lecture as any, me.id, (Number(state.quizAttemptsCount) || 0) + 1);
    await store.upsertMany('studentStates', [
      {
        ...state,
        quizStartedAt: new Date().toISOString(),
        quizQuestionOrder: plan.questionOrder,
        quizOptionOrders: plan.optionOrders,
        draftAnswers: {},
        tabSwitches: 0,
        currentStage: 3
      }
    ]);
    await store.upsertMany('activityLogs', [logEntry(me, `بدء كويز ${lecture.title}`)]);
    return { resumed: false };
  } finally {
    release();
  }
}

type Answers = Record<string, { selectedOptionIndex?: number; selectedOptionIndexes?: number[]; textAnswer?: string }>;

/** Keeps only answers to questions on the student's paper, in the expected shape and size. */
function cleanAnswers(raw: unknown, order: string[]): Answers {
  const out: Answers = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const id of order) {
    const a = (raw as Record<string, any>)[id];
    if (!a || typeof a !== 'object') continue;
    const v: Answers[string] = {};
    if (Number.isInteger(a.selectedOptionIndex)) v.selectedOptionIndex = a.selectedOptionIndex;
    if (Array.isArray(a.selectedOptionIndexes)) v.selectedOptionIndexes = a.selectedOptionIndexes.filter(Number.isInteger).slice(0, 20);
    if (typeof a.textAnswer === 'string') v.textAnswer = a.textAnswer.slice(0, 10_000);
    out[id] = v;
  }
  return out;
}

export async function submitQuiz(store: Store, me: Doc, ref: { course: Doc; lecture: Doc }, rawAnswers: unknown) {
  if (me.role !== 'student') throw new HttpError(403, 'الكويز للطلاب فقط');
  const release = lock(`${me.id}:${ref.lecture.id}`);
  try {
    const { state, groups } = await load(store, me, ref);
    const lecture = ref.lecture;
    if (!state) throw new HttpError(400, 'المحاضرة غير متاحة');
    if (state.quizCompleted) throw new HttpError(409, 'تم تسليم الكويز من قبل');
    if (!state.quizStartedAt || !state.quizQuestionOrder) throw new HttpError(400, 'ابدأ الكويز أولاً');

    const access = getQuizAccess(lecture as any, me.id, groups as any, state as any);
    const deadline = getQuizDeadline(state as any, access);
    const now = Date.now();
    // Late submissions are graded on what was auto-saved before the deadline
    const late = deadline !== null && now > deadline + 15_000;
    const answers = cleanAnswers(late ? state.draftAnswers : rawAnswers, state.quizQuestionOrder);

    const graded = gradeAttempt(lecture.questionBank || [], state.quizQuestionOrder, answers);
    const duration = Math.max(0, Math.round((now - new Date(state.quizStartedAt).getTime()) / 1000));
    await store.upsertMany('studentStates', [
      {
        ...state,
        quizCompleted: true,
        quizAutoScore: graded.autoScore,
        essayGrades: {},
        essayPending: graded.essayPending,
        quizScore: graded.autoScore,
        quizTotalPoints: graded.totalPoints,
        quizAttemptsCount: (Number(state.quizAttemptsCount) || 0) + 1,
        quizFinishedAt: new Date(now).toISOString(),
        quizDurationSeconds: duration,
        ...(late ? { submittedLate: true } : {}),
        currentStage: 'completed',
        answers
      }
    ]);
    await store.upsertMany('activityLogs', [
      logEntry(
        me,
        `تسليم كويز ${lecture.title}: ${graded.autoScore}/${graded.totalPoints}` +
          (graded.essayPending ? ` (${graded.essayPending} مقالي بانتظار التصحيح)` : ''),
        `${duration} ثانية`
      )
    ]);
    return { score: graded.autoScore, totalPoints: graded.totalPoints, essayPending: graded.essayPending, late };
  } finally {
    release();
  }
}
