import {
  User,
  StudentLectureState,
  LeaderboardEntry,
  BadgePolicy,
  BadgeTier,
  Course,
  AlertSettings
} from '../types';

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  absenceConsecutive: 2,
  graceHours: 24,
  dropPercent: 20,
  dropWindow: 3,
  maxMessagesPerWeek: 2,
  minHoursBetween: 24,
  channels: ['whatsapp']
};

/**
 * Leaderboard (PDF plan §5). Order: total points, then
 * (1) highest score in the latest quiz, (2) fewest attempts, (3) earliest finish time.
 * A medal is only given to students who actually completed at least one quiz.
 */
export function calculateLeaderboard(
  students: User[],
  studentStates: StudentLectureState[],
  badgePolicy: BadgePolicy,
  weekId?: string
): LeaderboardEntry[] {
  const relevantStates = weekId ? studentStates.filter(s => s.weekId === weekId) : studentStates;

  const entries: Omit<LeaderboardEntry, 'rank' | 'badge'>[] = students.map(student => {
    const mine = relevantStates.filter(s => s.studentId === student.id);
    const totalPoints = mine.reduce((acc, s) => acc + (s.quizScore || 0), 0);
    const quizzesCompleted = mine.filter(s => s.quizCompleted).length;

    const latest = mine
      .filter(s => s.quizCompleted && s.quizFinishedAt)
      .sort((a, b) => new Date(b.quizFinishedAt!).getTime() - new Date(a.quizFinishedAt!).getTime())[0];

    return {
      studentId: student.id,
      studentName: student.name,
      studentAcademicId: student.academicId,
      studentAvatar: student.avatar,
      totalPoints,
      quizzesCompleted,
      latestQuizScore: latest ? latest.quizScore || 0 : 0,
      latestQuizFinishedAt: latest?.quizFinishedAt,
      totalAttempts: mine.reduce((acc, s) => acc + (s.quizAttemptsCount || (s.quizCompleted ? 1 : 0)), 0)
    };
  });

  entries.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.latestQuizScore !== a.latestQuizScore) return b.latestQuizScore - a.latestQuizScore;
    if (a.totalAttempts !== b.totalAttempts) return a.totalAttempts - b.totalAttempts;
    if (a.latestQuizFinishedAt && b.latestQuizFinishedAt) {
      return new Date(a.latestQuizFinishedAt).getTime() - new Date(b.latestQuizFinishedAt).getTime();
    }
    if (a.latestQuizFinishedAt && !b.latestQuizFinishedAt) return -1;
    if (!a.latestQuizFinishedAt && b.latestQuizFinishedAt) return 1;
    return a.studentName.localeCompare(b.studentName, 'ar');
  });

  const totalCount = entries.length;

  return entries.map((entry, index) => {
    const rank = index + 1;
    let badge: BadgeTier = 'none';

    if (entry.quizzesCompleted > 0) {
      if (badgePolicy.type === 'fixed_ranks') {
        if (rank <= badgePolicy.goldThreshold) badge = 'gold';
        else if (rank <= badgePolicy.silverThreshold) badge = 'silver';
        else if (rank <= badgePolicy.bronzeThreshold) badge = 'bronze';
      } else {
        // Percent based: top X%, next Y%, next Z% (cumulative cut-offs)
        const percentile = (rank / totalCount) * 100;
        const goldCutoff = badgePolicy.goldThreshold;
        const silverCutoff = goldCutoff + badgePolicy.silverThreshold;
        const bronzeCutoff = silverCutoff + badgePolicy.bronzeThreshold;
        if (percentile <= goldCutoff) badge = 'gold';
        else if (percentile <= silverCutoff) badge = 'silver';
        else if (percentile <= bronzeCutoff) badge = 'bronze';
      }
    }

    return { ...entry, rank, badge };
  });
}

/** True when the lecture is available (and, for alarms, has been for at least `graceHours`). */
export function isLectureReleased(releaseAt: string | undefined, now: number, graceHours = 0): boolean {
  if (!releaseAt) return true;
  const t = new Date(releaseAt).getTime();
  if (Number.isNaN(t)) return true;
  return now >= t + graceHours * 3600 * 1000;
}

const pct = (score?: number, total?: number) =>
  total && total > 0 ? ((score || 0) / total) * 100 : 0;

/**
 * Doctor alarms (PDF plan §7):
 *  - absence: the last N *released* lectures were not completed (open explanation + attendance)
 *  - drop: average of the last K quizzes fell below the average of the K before them by X %
 */
export function calculateStudentAlarms(
  student: User,
  course: Course,
  studentStates: StudentLectureState[],
  settings: AlertSettings = DEFAULT_ALERT_SETTINGS,
  now: number = Date.now()
) {
  const ordered = course.weeks.flatMap(w => w.lectures).sort((a, b) => a.order - b.order);
  const due = ordered.filter(l => isLectureReleased(l.releaseAt, now, settings.graceHours));
  const totalLecturesCount = due.length;

  let consecutiveAbsences = 0;
  let attendedLecturesCount = 0;
  for (const lecture of due) {
    const st = studentStates.find(s => s.studentId === student.id && s.lectureId === lecture.id);
    if (st && st.stage2Completed && st.attended) {
      attendedLecturesCount++;
      consecutiveAbsences = 0;
    } else {
      consecutiveAbsences++;
    }
  }
  const hasAbsenceAlarm = consecutiveAbsences >= settings.absenceConsecutive;

  // Quizzes in finishing order
  const quizzes = studentStates
    .filter(s => s.studentId === student.id && s.quizCompleted && s.quizFinishedAt)
    .sort((a, b) => new Date(a.quizFinishedAt!).getTime() - new Date(b.quizFinishedAt!).getTime());

  let performanceDropPercentage = 0;
  let hasPerformanceAlarm = false;
  let lastQuizzesAverage = 0;
  let previousQuizzesAverage = 0;

  const avg = (list: StudentLectureState[]) =>
    list.length ? list.reduce((a, q) => a + pct(q.quizScore, q.quizTotalPoints), 0) / list.length : 0;

  if (quizzes.length >= 2) {
    // Use K quizzes per side; with few quizzes, split what exists in half.
    const k = Math.min(settings.dropWindow, Math.floor(quizzes.length / 2));
    const recent = quizzes.slice(-k);
    const before = quizzes.slice(-2 * k, -k);
    lastQuizzesAverage = Math.round(avg(recent));
    previousQuizzesAverage = Math.round(avg(before));

    if (previousQuizzesAverage > 0) {
      const relativeDrop = ((previousQuizzesAverage - lastQuizzesAverage) / previousQuizzesAverage) * 100;
      if (relativeDrop >= settings.dropPercent) {
        performanceDropPercentage = Math.round(relativeDrop);
        hasPerformanceAlarm = true;
      }
    }
  } else if (quizzes.length === 1) {
    lastQuizzesAverage = Math.round(pct(quizzes[0].quizScore, quizzes[0].quizTotalPoints));
  }

  const latest = quizzes[quizzes.length - 1];

  return {
    consecutiveAbsences,
    hasAbsenceAlarm,
    performanceDropPercentage,
    hasPerformanceAlarm,
    attendanceRate: totalLecturesCount > 0 ? Math.round((attendedLecturesCount / totalLecturesCount) * 100) : 100,
    attendedLecturesCount,
    totalLecturesCount,
    lastQuizzesAverage,
    previousQuizzesAverage,
    latestQuizScorePercentage: latest ? Math.round(pct(latest.quizScore, latest.quizTotalPoints)) : 0
  };
}
