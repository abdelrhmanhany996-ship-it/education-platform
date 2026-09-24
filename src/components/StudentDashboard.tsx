import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Course, CourseWeek, Lecture } from '../types';
import { LectureStage1PdfViewer } from './LectureStage1PdfViewer';
import { LectureStage2Attendance } from './LectureStage2Attendance';
import { LectureStage3Quiz } from './LectureStage3Quiz';
import { LeaderboardModal } from './LeaderboardModal';
import { isLectureReleased } from '../utils/scoring';
import { formatDateTime } from '../utils/format';
import { CertificateModal } from './CertificateModal';
import {
  BookOpen,
  CheckCircle2,
  Lock,
  Trophy,
  Award,
  Medal,
  Clock,
  Sparkles,
  CalendarCheck,
  FileText,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  PlayCircle,
  HelpCircle,
  ShieldCheck,
  GraduationCap
} from 'lucide-react';

interface StudentDashboardProps {
  onOpenAuth: () => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({ onOpenAuth }) => {
  const {
    currentUser,
    courses,
    studentStates,
    getStudentLectureState,
    completeStage1,
    submitAttendanceAndFeedback,
    getLeaderboard,
    certificates,
    approveCertificate
  } = useApp();

  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState<boolean>(false);
  const [selectedCertModal, setSelectedCertModal] = useState<boolean>(false);

  // Active course, week, and lecture
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courses[0]?.id || '');
  const currentCourse = courses.find(c => c.id === selectedCourseId) || courses[0];
  const [selectedWeekId, setSelectedWeekId] = useState<string>(currentCourse?.weeks[0]?.id || '');
  const activeWeek = currentCourse?.weeks.find(w => w.id === selectedWeekId) || currentCourse?.weeks[0];

  const [selectedLectureId, setSelectedLectureId] = useState<string>(
    activeWeek?.lectures[0]?.id || ''
  );

  // Fallback to active lecture
  const activeLecture =
    activeWeek?.lectures.find(l => l.id === selectedLectureId) ||
    activeWeek?.lectures[0] ||
    currentCourse?.weeks[0]?.lectures[0];

  // Active student state for current lecture
  const activeLectureState = currentUser && activeLecture
    ? getStudentLectureState(currentUser.id, activeLecture.id)
    : undefined;

  // Active stage tab (1, 2, or 3)
  const currentStageNum: 1 | 2 | 3 =
    activeLectureState?.currentStage === 'completed'
      ? 3
      : (activeLectureState?.currentStage as 1 | 2 | 3) || 1;

  const [activeStageTab, setActiveStageTab] = useState<1 | 2 | 3>(currentStageNum);

  // Switching the course tab: jump to its first week/lecture instead of keeping a stale selection
  useEffect(() => {
    const firstWeek = currentCourse?.weeks[0];
    setSelectedWeekId(firstWeek?.id || '');
    setSelectedLectureId(firstWeek?.lectures[0]?.id || '');
    setActiveStageTab(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourseId]);

  if (!currentUser) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 rounded-3xl mx-auto flex items-center justify-center">
          <GraduationCap className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">مرحباً بك في المنصة التعليمية الأكاديمية</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
          يرجى تسجيل الدخول بحسابك أو إنشاء حساب طالب أو دكتور جديد للوصول لشروحات المحاضرات، تسجيل الحضور، والكويزات ولوحة الشرف.
        </p>
        <button
          onClick={onOpenAuth}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-md shadow-indigo-600/20 cursor-pointer"
        >
          تسجيل الدخول / إنشاء حساب
        </button>
      </div>
    );
  }

  if (!currentCourse) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-20 h-20 bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 rounded-3xl mx-auto flex items-center justify-center">
          <BookOpen className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">لا يوجد مقرر مفعّل على حسابك بعد</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
          إذا سجّلت طلباً لمادة، فهو بانتظار موافقة الدكتور. تواصل مع الدكتور أو المساعد لمتابعة حالة طلبك.
        </p>
      </div>
    );
  }

  // Calculate student personal ranking and stats
  const allLeaderboardEntries = getLeaderboard(currentCourse.id);
  const myEntry = allLeaderboardEntries.find(e => e.studentId === currentUser.id);
  const myTotalPoints = myEntry?.totalPoints || 0;
  const myRank = myEntry?.rank || 1;
  const myBadge = myEntry?.badge || 'none';

  // Check if student has an issued or pending certificate
  const myCertificate = certificates.find(c => c.studentId === currentUser.id);

  // Overall course progress: lectures whose 3 stages are all completed
  const allLectures = currentCourse?.weeks.flatMap(w => w.lectures) ?? [];
  const doneLectures = allLectures.filter(
    l => getStudentLectureState(currentUser.id, l.id)?.currentStage === 'completed'
  ).length;
  const courseProgress = {
    done: doneLectures,
    total: allLectures.length,
    pct: allLectures.length ? Math.round((doneLectures / allLectures.length) * 100) : 0
  };

  // Handlers for 3 stages
  const handleCompleteStage1 = () => {
    if (!activeLecture) return;
    completeStage1(activeLecture.id, currentUser.id);
    setActiveStageTab(2); // Automatically advance to Stage 2
  };

  const handleSubmitAttendance = (rating: number, comment: string) => {
    if (!activeLecture) return;
    const res = submitAttendanceAndFeedback(activeLecture.id, currentUser.id, rating, comment);
    if (res.success) {
      setActiveStageTab(3); // Advance to Stage 3
    }
  };

  const handleProceedToQuiz = () => {
    setActiveStageTab(3);
  };


  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8" id="student-platform-container">
      {/* Student identity, progress & rank */}
      <section className="surface overflow-hidden animate-rise">
        <div className="h-1.5 bg-linear-to-l from-amber-400 via-indigo-500 to-indigo-700" aria-hidden="true" />
        <div className="p-5 sm:p-7 grid lg:grid-cols-[1.1fr_1fr] gap-6 lg:gap-10 items-center">
          {/* Profile */}
          <div className="flex items-center gap-4 min-w-0">
            {currentUser.avatar ? (
              <img
                src={currentUser.avatar}
                alt=""
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover ring-2 ring-indigo-100 dark:ring-indigo-500/25 shrink-0"
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-2xl font-bold shrink-0">
                {currentUser.name.slice(0, 1)}
              </div>
            )}

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">{currentUser.name}</h2>
                <span className="text-[12px] bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-bold px-2.5 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-500/25">
                  طالب منتظم
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-2 py-0.5 rounded-md font-mono" dir="ltr">
                  {currentUser.academicId}
                </span>
                <span>{[currentUser.faculty, currentUser.department].filter(Boolean).join(' — ')}</span>
                <span className="font-mono" dir="ltr">{currentUser.phone}</span>
              </div>
            </div>
          </div>

          {/* Progress + stats */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-bold text-slate-700 dark:text-slate-300">تقدمك في المقرر</span>
                <span className="text-slate-500 dark:text-slate-400">
                  <span className="font-bold text-indigo-700 dark:text-indigo-300">{courseProgress.done}</span> من {courseProgress.total} محاضرات مكتملة
                </span>
              </div>
              <div
                className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"
                role="progressbar"
                aria-valuenow={courseProgress.pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="تقدم الطالب في المقرر"
              >
                <div
                  className="h-full rounded-full bg-linear-to-l from-indigo-500 to-indigo-700 transition-all duration-700"
                  style={{ width: `${courseProgress.pct}%` }}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-stretch gap-3">
              <div className="flex-1 min-w-[6.5rem] bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2.5">
                <span className="text-[12px] text-slate-500 dark:text-slate-400 font-bold block">مجموع النقاط</span>
                <span className="text-xl font-black text-indigo-700 dark:text-indigo-300 leading-tight">{myTotalPoints}</span>
              </div>

              <div className="flex-1 min-w-[8rem] bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 rounded-2xl px-4 py-2.5">
                <span className="text-[12px] text-amber-800 dark:text-amber-300 font-bold block">الترتيب والدرع</span>
                <div className="flex items-center gap-1.5 leading-tight">
                  <span className="text-lg">
                    {myBadge === 'gold' ? '🥇' : myBadge === 'silver' ? '🥈' : myBadge === 'bronze' ? '🥉' : '🎖️'}
                  </span>
                  <span className="text-xl font-black text-amber-950 dark:text-amber-100">#{myRank}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2 justify-center">
                <button
                  id="open-leaderboard-btn"
                  onClick={() => setIsLeaderboardOpen(true)}
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <Trophy className="w-4 h-4" />
                  لوحة الشرف
                </button>
                {myCertificate && (
                  <button
                    id="open-my-certificate-btn"
                    onClick={() => setSelectedCertModal(true)}
                    className="px-4 py-2 bg-slate-900 dark:bg-slate-950 hover:bg-slate-800 dark:hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <Award className="w-4 h-4" />
                    شهادتي
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {courses.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto scroll-thin pb-1">
          {courses.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCourseId(c.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                c.id === selectedCourseId
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {c.title}
            </button>
          ))}
        </div>
      )}

      {/* Main Grid: Weeks & Lectures Navigator + 3-Stage Container */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        {/* Left Column (1 Col): Weeks & Lectures Directory */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              منهج المقرر والمحاضرات
            </h3>
            <span className="text-[12px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-mono">
              {currentCourse?.code}
            </span>
          </div>

          {/* Weeks Accordion / List */}
          <div className="space-y-3">
            {currentCourse?.weeks.map(week => {
              const isWeekActive = week.id === selectedWeekId;

              return (
                <div
                  key={week.id}
                  className={`rounded-2xl border transition-all overflow-hidden ${
                    isWeekActive
                      ? 'bg-white dark:bg-slate-900 border-indigo-300 dark:border-indigo-500/40 shadow-xs'
                      : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-900'
                  }`}
                >
                  <button
                    onClick={() => setSelectedWeekId(week.id)}
                    className="w-full text-right p-3.5 flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100">{week.title}</div>
                      <div className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {week.lectures.length} محاضرات
                      </div>
                    </div>
                    <span className="text-xs text-slate-400">
                      <ChevronLeft className={`w-4 h-4 transition-transform ${isWeekActive ? '-rotate-90' : ''}`} />
                    </span>
                  </button>

                  {/* Lectures inside this week */}
                  {isWeekActive && (
                    <div className="p-2 pt-0 space-y-1.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                      {week.lectures.map((lec, idx) => {
                        const isLecSelected = activeLecture?.id === lec.id;
                        const state = getStudentLectureState(currentUser.id, lec.id);
                        const isCompleted = state?.currentStage === 'completed';
                        const isStage2 = state?.stage2Completed;
                        const isStage1 = state?.stage1Completed;
                        const locked = !isLectureReleased(lec.releaseAt, Date.now());

                        return (
                          <button
                            key={lec.id}
                            onClick={() => {
                              if (locked) return;
                              setSelectedLectureId(lec.id);
                              // Sync active stage tab to user current stage
                              const stage = state?.currentStage === 'completed' ? 3 : (state?.currentStage as 1 | 2 | 3) || 1;
                              setActiveStageTab(stage);
                            }}
                            className={`w-full text-right p-2.5 rounded-xl text-xs transition-all flex items-center justify-between gap-2 cursor-pointer ${
                              isLecSelected
                                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                                : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className="p-1 rounded-md bg-black/10">
                                <PlayCircle className="w-3.5 h-3.5 shrink-0" />
                              </span>
                              <span className="truncate">{idx + 1}. {lec.title}</span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {locked ? (
                                <span className="text-[12px] px-1.5 py-0.5 rounded font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                  <Lock className="w-3 h-3" />
                                  مقفلة
                                </span>
                              ) : isCompleted ? (
                                <span className={`text-[12px] px-1.5 py-0.5 rounded font-bold ${
                                  isLecSelected ? 'bg-white/20 text-white' : 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
                                }`}>
                                  ✓ كويز ({state.quizScore}ن)
                                </span>
                              ) : isStage2 ? (
                                <span className={`text-[12px] px-1.5 py-0.5 rounded font-bold ${
                                  isLecSelected ? 'bg-white/20 text-white' : 'bg-blue-100 dark:bg-blue-500/15 text-blue-800 dark:text-blue-300'
                                }`}>
                                  حضور ✓
                                </span>
                              ) : isStage1 ? (
                                <span className={`text-[12px] px-1.5 py-0.5 rounded font-bold ${
                                  isLecSelected ? 'bg-white/20 text-white' : 'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300'
                                }`}>
                                  قراءة ✓
                                </span>
                              ) : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column (3 Cols): 3-Stage Lecture Execution Experience */}
        <div className="xl:col-span-3 space-y-6">
          {activeLecture && !isLectureReleased(activeLecture.releaseAt, Date.now()) ? (
            <div className="surface p-10 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
                <Lock className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{activeLecture.title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">هذه المحاضرة تُفتح في {formatDateTime(activeLecture.releaseAt)}.</p>
            </div>
          ) : activeLecture ? (
            <div className="space-y-6">
              {/* Active Lecture Header Banner */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1">
                    <span>{currentCourse?.title}</span>
                    <span>•</span>
                    <span>{activeWeek?.title}</span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">{activeLecture.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{activeLecture.summary}</p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1 rounded-xl font-mono">
                    المدة: {activeLecture.duration}
                  </span>
                </div>
              </div>

              {/* 3-Stage Progress Nav Stepper */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-2 shadow-xs grid grid-cols-3 gap-2">
                {/* Stage 1 Button */}
                <button
                  onClick={() => setActiveStageTab(1)}
                  className={`p-3 rounded-xl text-right transition cursor-pointer flex items-center justify-between gap-2 ${
                    activeStageTab === 1
                      ? 'bg-indigo-600 text-white font-bold shadow-xs'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      activeStageTab === 1 ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}>
                      1
                    </span>
                    <div>
                      <div className="text-xs font-bold leading-tight whitespace-nowrap">شرح المحاضرة</div>
                      <div className={`hidden sm:block text-[12px] ${activeStageTab === 1 ? 'text-indigo-200' : 'text-slate-400'}`}>
                        ملف السلايدات والـ PDF
                      </div>
                    </div>
                  </div>

                  {activeLectureState?.stage1Completed && (
                    <CheckCircle2 className={`w-4 h-4 ${activeStageTab === 1 ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`} />
                  )}
                </button>

                {/* Stage 2 Button */}
                <button
                  onClick={() => {
                    if (activeLectureState?.stage1Completed) {
                      setActiveStageTab(2);
                    }
                  }}
                  disabled={!activeLectureState?.stage1Completed}
                  className={`p-3 rounded-xl text-right transition flex items-center justify-between gap-2 ${
                    !activeLectureState?.stage1Completed
                      ? 'opacity-40 cursor-not-allowed text-slate-400'
                      : activeStageTab === 2
                      ? 'bg-indigo-600 text-white font-bold shadow-xs cursor-pointer'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      activeStageTab === 2 ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}>
                      2
                    </span>
                    <div>
                      <div className="text-xs font-bold leading-tight whitespace-nowrap">الحضور والتقييم</div>
                      <div className={`hidden sm:block text-[12px] ${activeStageTab === 2 ? 'text-indigo-200' : 'text-slate-400'}`}>
                        بدء مؤقت نافذة الكويز
                      </div>
                    </div>
                  </div>

                  {!activeLectureState?.stage1Completed ? (
                    <Lock className="w-4 h-4 text-slate-400" />
                  ) : activeLectureState?.stage2Completed ? (
                    <CheckCircle2 className={`w-4 h-4 ${activeStageTab === 2 ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`} />
                  ) : null}
                </button>

                {/* Stage 3 Button */}
                <button
                  onClick={() => {
                    if (activeLectureState?.stage2Completed) {
                      setActiveStageTab(3);
                    }
                  }}
                  disabled={!activeLectureState?.stage2Completed}
                  className={`p-3 rounded-xl text-right transition flex items-center justify-between gap-2 ${
                    !activeLectureState?.stage2Completed
                      ? 'opacity-40 cursor-not-allowed text-slate-400'
                      : activeStageTab === 3
                      ? 'bg-indigo-600 text-white font-bold shadow-xs cursor-pointer'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      activeStageTab === 3 ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}>
                      3
                    </span>
                    <div>
                      <div className="text-xs font-bold leading-tight whitespace-nowrap">حل الكويز</div>
                      <div className={`hidden sm:block text-[12px] ${activeStageTab === 3 ? 'text-indigo-200' : 'text-slate-400'}`}>
                        نقاط وترتيب تنافسي
                      </div>
                    </div>
                  </div>

                  {!activeLectureState?.stage2Completed ? (
                    <Lock className="w-4 h-4 text-slate-400" />
                  ) : activeLectureState?.quizCompleted ? (
                    <CheckCircle2 className={`w-4 h-4 ${activeStageTab === 3 ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`} />
                  ) : null}
                </button>
              </div>

              {/* Stage View Content Router */}
              {activeStageTab === 1 && (
                <LectureStage1PdfViewer
                  lecture={activeLecture}
                  isCompleted={Boolean(activeLectureState?.stage1Completed)}
                  onCompleteStage1={handleCompleteStage1}
                  canProceedToStage2={true}
                />
              )}

              {activeStageTab === 2 && (
                <LectureStage2Attendance
                  lecture={activeLecture}
                  studentState={activeLectureState}
                  isStage1Completed={Boolean(activeLectureState?.stage1Completed)}
                  onSubmitAttendance={handleSubmitAttendance}
                  onProceedToQuiz={handleProceedToQuiz}
                />
              )}

              {activeStageTab === 3 && (
                <LectureStage3Quiz
                  key={`${activeLecture.id}:${activeLectureState?.quizStartedAt || ''}`}
                  lecture={activeLecture}
                  studentState={activeLectureState}
                />
              )}
            </div>
          ) : (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-400">
              اختر محاضرة للبدء
            </div>
          )}
        </div>
      </div>

      {/* Leaderboard Modal */}
      <LeaderboardModal
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
      />

      {/* Certificate Modal */}
      {myCertificate && (
        <CertificateModal
          certificate={myCertificate}
          isOpen={selectedCertModal}
          onClose={() => setSelectedCertModal(false)}
          isDoctor={false}
        />
      )}
    </div>
  );
};
