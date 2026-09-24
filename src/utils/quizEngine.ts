import {
  Lecture,
  QuestionBankItem,
  QuizSchedule,
  StudentGroup,
  StudentLectureState
} from '../types';

/* ------------------------------------------------------------------ */
/*  Seeded shuffle: same student + lecture + attempt => same paper,    */
/*  so a page reload can never re-roll the questions.                  */
/* ------------------------------------------------------------------ */

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(items: T[], seed: string): T[] {
  const rand = mulberry32(hashString(seed));
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface QuizAttemptPlan {
  questionOrder: string[];
  optionOrders: Record<string, number[]>;
}

/** Draws the student's own paper from the question bank (PDF plan §3 and §8). */
export function buildAttemptPlan(
  lecture: Lecture,
  studentId: string,
  attemptNo: number
): QuizAttemptPlan {
  const bank = lecture.questionBank || [];
  const s = lecture.quizSettings;
  const base = `${studentId}|${lecture.id}|${attemptNo}`;

  const ordered = s.randomizeQuestions ? seededShuffle(bank, `${base}|q`) : [...bank];
  const count = s.questionsToDraw > 0 ? Math.min(bank.length, s.questionsToDraw) : bank.length;
  const drawn = ordered.slice(0, count);

  const optionOrders: Record<string, number[]> = {};
  for (const q of drawn) {
    const identity = q.options.map((_, i) => i);
    // True/false keeps its natural order; only real multiple-choice is shuffled.
    optionOrders[q.id] =
      s.randomizeChoices && q.type === 'multiple_choice'
        ? seededShuffle(identity, `${base}|o|${q.id}`)
        : identity;
  }

  return { questionOrder: drawn.map(q => q.id), optionOrders };
}

/* ------------------------------------------------------------------ */
/*  Opening rules: option A (public window), B (groups), C (student)   */
/* ------------------------------------------------------------------ */

export type QuizAccess =
  | { status: 'locked'; reason: string }
  | { status: 'not_scheduled'; reason: string }
  | {
      status: 'not_open' | 'open' | 'closed';
      opensAt: string;
      closesAt: string;
      durationMinutes: number;
      source: 'student' | 'group' | 'public' | 'personal_window';
    };

function withStatus(
  sched: QuizSchedule,
  fallbackMinutes: number,
  source: 'student' | 'group' | 'public' | 'personal_window',
  now: number
): QuizAccess {
  const opens = new Date(sched.opensAt).getTime();
  const closes = new Date(sched.closesAt).getTime();
  const status = now < opens ? 'not_open' : now > closes ? 'closed' : 'open';
  return {
    status,
    opensAt: sched.opensAt,
    closesAt: sched.closesAt,
    durationMinutes: sched.durationMinutes || fallbackMinutes,
    source
  };
}

export function getQuizAccess(
  lecture: Lecture,
  studentId: string,
  groups: StudentGroup[],
  state: StudentLectureState | undefined,
  now: number = Date.now()
): QuizAccess {
  if (!state?.stage2Completed) {
    return { status: 'locked', reason: 'أكمل قراءة الشرح وسجّل الحضور أولاً' };
  }
  const s = lecture.quizSettings;
  const mode = s.accessMode || 'window';
  const dur = s.durationMinutes || 15;

  if (mode === 'per_student') {
    const own = s.studentSchedules?.find(x => x.studentId === studentId);
    if (!own) return { status: 'not_scheduled', reason: 'لم يحدد الدكتور موعد الكويز لك بعد' };
    return withStatus(own, dur, 'student', now);
  }

  if (mode === 'groups') {
    const myGroupIds = groups.filter(g => g.memberIds.includes(studentId)).map(g => g.id);
    const own = s.groupSchedules?.find(x => myGroupIds.includes(x.groupId));
    if (!own) return { status: 'not_scheduled', reason: 'مجموعتك ليس لها موعد كويز حتى الآن' };
    return withStatus(own, dur, 'group', now);
  }

  if (s.publicWindow) return withStatus(s.publicWindow, dur, 'public', now);

  if (state.quizWindowStart && state.quizWindowEnd) {
    return withStatus(
      { opensAt: state.quizWindowStart, closesAt: state.quizWindowEnd },
      dur,
      'personal_window',
      now
    );
  }
  return { status: 'locked', reason: 'أكمل قراءة الشرح وسجّل الحضور أولاً' };
}

/** Hard stop for a running attempt: own timer or the end of the window, whichever is first. */
export function getQuizDeadline(state: StudentLectureState, access: QuizAccess): number | null {
  if (!state.quizStartedAt) return null;
  if (access.status === 'locked' || access.status === 'not_scheduled') return null;
  const byTimer = new Date(state.quizStartedAt).getTime() + access.durationMinutes * 60000;
  return Math.min(byTimer, new Date(access.closesAt).getTime());
}

/** Correct answers stay hidden until nobody can still be taking the quiz (plan §8). */
export function canRevealAnswers(
  lecture: Lecture,
  state: StudentLectureState | undefined,
  now: number = Date.now()
): boolean {
  if (!state?.quizCompleted) return false;
  const s = lecture.quizSettings;
  const rule = s.revealAnswers || 'after_close';
  if (rule === 'never') return false;
  if (rule === 'after_submit') return true;

  const closings: string[] = [];
  const mode = s.accessMode || 'window';
  if (mode === 'per_student') s.studentSchedules?.forEach(x => closings.push(x.closesAt));
  else if (mode === 'groups') s.groupSchedules?.forEach(x => closings.push(x.closesAt));
  else if (s.publicWindow) closings.push(s.publicWindow.closesAt);

  if (closings.length > 0) {
    const last = Math.max(...closings.map(c => new Date(c).getTime()));
    return now > last;
  }
  return state.quizWindowEnd ? now > new Date(state.quizWindowEnd).getTime() : true;
}

/* ------------------------------------------------------------------ */
/*  Grading                                                            */
/* ------------------------------------------------------------------ */

export interface GradeResult {
  autoScore: number;
  totalPoints: number;
  essayPending: number;
}

export function gradeAttempt(
  bank: QuestionBankItem[],
  questionOrder: string[],
  answers: Record<string, { selectedOptionIndex?: number; textAnswer?: string }>
): GradeResult {
  let autoScore = 0;
  let totalPoints = 0;
  let essayPending = 0;

  for (const id of questionOrder) {
    const q = bank.find(x => x.id === id);
    if (!q) continue;
    totalPoints += q.points;
    const a = answers[id];
    if (q.type === 'essay') {
      if (a?.textAnswer && a.textAnswer.trim().length > 0) essayPending++;
    } else if (
      a?.selectedOptionIndex !== undefined &&
      q.correctOptionIndex !== undefined &&
      a.selectedOptionIndex === q.correctOptionIndex
    ) {
      autoScore += q.points;
    }
  }
  return { autoScore, totalPoints, essayPending };
}

export function sumEssayGrades(grades: Record<string, number> | undefined): number {
  return Object.values(grades || {}).reduce((a, b) => a + b, 0);
}
