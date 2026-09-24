import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { LeaderboardEntry, BadgeTier } from '../types';
import {
  Trophy,
  Award,
  Medal,
  Shield,
  Clock,
  Sparkles,
  User as UserIcon,
  X,
  Filter,
  CheckCircle2,
  Lock,
  ChevronDown
} from 'lucide-react';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Render inline as a page (sidebar item) instead of a modal. */
  asPage?: boolean;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({ isOpen, onClose, asPage = false }) => {
  const { courses, getLeaderboard, currentUser, badgePolicy } = useApp();
  const [boardType, setBoardType] = useState<'final' | 'weekly'>('final');
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courses[0]?.id || '');
  const [selectedWeekId, setSelectedWeekId] = useState<string>(courses[0]?.weeks[0]?.id || '');

  if (!isOpen && !asPage) return null;

  const currentCourse = courses.find(c => c.id === selectedCourseId) || courses[0];
  const weeks = currentCourse?.weeks || [];

  // Fetch computed entries based on active view
  const entries: LeaderboardEntry[] = currentCourse
    ? getLeaderboard(currentCourse.id, boardType === 'weekly' ? selectedWeekId : undefined)
    : [];

  // Check if current user is student and determine if in top 10
  const isDoctor = currentUser?.role === 'doctor';
  const currentStudentEntry = entries.find(e => e.studentId === currentUser?.id);
  const isCurrentUserInTop10 = currentStudentEntry ? currentStudentEntry.rank <= 10 : false;

  const getBadgeVisual = (badge: BadgeTier, rank: number) => {
    switch (badge) {
      case 'gold':
        return {
          icon: <Trophy className="w-4 h-4 text-amber-500" />,
          label: 'درع ذهبي',
          bg: 'bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40',
          medal: '🥇'
        };
      case 'silver':
        return {
          icon: <Medal className="w-4 h-4 text-slate-400" />,
          label: 'درع فضي',
          bg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600',
          medal: '🥈'
        };
      case 'bronze':
        return {
          icon: <Shield className="w-4 h-4 text-amber-700 dark:text-amber-300" />,
          label: 'درع برونزي',
          bg: 'bg-amber-100/60 dark:bg-amber-500/15 text-amber-900 dark:text-amber-200 border-amber-400/40',
          medal: '🥉'
        };
      default:
        return {
          icon: null,
          label: 'مشارك',
          bg: 'bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700',
          medal: `#${rank}`
        };
    }
  };

  return (
    <div
      className={
        asPage
          ? 'max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8'
          : 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto'
      }
    >
      <div
        className={`bg-white dark:bg-slate-900 rounded-2xl w-full border border-slate-200 dark:border-slate-700 overflow-hidden ${
          asPage ? 'shadow-card' : 'max-w-4xl shadow-2xl my-8 animate-pop'
        }`}
      >
        {/* Header */}
        <div className="bg-linear-to-r from-amber-600 via-indigo-700 to-indigo-900 text-white p-6 relative">
          {!asPage && (
            <button
              onClick={onClose}
              aria-label="إغلاق"
              className="absolute top-5 left-5 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-amber-300 shadow-sm">
              <Trophy className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider bg-amber-400/20 text-amber-200 px-2 py-0.5 rounded-md border border-amber-300/30 dark:border-amber-500/40">
                  لوحة الشرف والأوسمة الأكاديمية
                </span>
                <span className="text-xs bg-white/10 text-white px-2 py-0.5 rounded-md">
                  {currentCourse?.title}
                </span>
              </div>
              <h2 className="text-xl font-black text-white mt-1">
                ترتيب الطلاب ومنظومة الدروع التنافسية
              </h2>
            </div>
          </div>

          {/* Toggle Type */}
          <div className="flex flex-wrap items-center gap-3 mt-6">
            <div className="inline-flex p-1 rounded-xl bg-slate-950/30 border border-white/10 text-xs">
              <button
                onClick={() => setBoardType('final')}
                className={`px-4 py-2 rounded-lg font-bold transition-all cursor-pointer ${
                  boardType === 'final'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                🏆 الترتيب النهائي العام (كل المقرر)
              </button>
              <button
                onClick={() => setBoardType('weekly')}
                className={`px-4 py-2 rounded-lg font-bold transition-all cursor-pointer ${
                  boardType === 'weekly'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                📅 الترتيب الأسبوعي
              </button>
            </div>

            {boardType === 'weekly' && (
              <select
                value={selectedWeekId}
                onChange={e => setSelectedWeekId(e.target.value)}
                className="bg-white/15 text-white border border-white/20 rounded-xl px-3 py-2 text-xs font-bold focus:outline-hidden cursor-pointer"
              >
                {weeks.map(w => (
                  <option key={w.id} value={w.id} className="text-slate-900 dark:text-slate-100">
                    {w.title}
                  </option>
                ))}
              </select>
            )}

            {courses.length > 1 && (
              <select
                value={selectedCourseId}
                onChange={e => {
                  setSelectedCourseId(e.target.value);
                  setSelectedWeekId(courses.find(c => c.id === e.target.value)?.weeks[0]?.id || '');
                }}
                className="bg-white/15 text-white border border-white/20 rounded-xl px-3 py-2 text-xs font-bold focus:outline-hidden cursor-pointer"
              >
                {courses.map(c => (
                  <option key={c.id} value={c.id} className="text-slate-900 dark:text-slate-100">
                    {c.title}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {/* Rules & Privacy Banner */}
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-xs text-slate-600 dark:text-slate-400 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                معايير كسر التعادل في الترتيب:
              </div>
              <p>
                1. أعلى نقاط بآخر كويز • 2. أقل عدد محاولات • 3. أسبقية وقت الإنهاء.
              </p>
            </div>

            {/* Privacy rule notice for students */}
            {!isDoctor && (
              <div className="bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-[12px] text-slate-500 dark:text-slate-400">
                🔒 <strong>سياسة الخصوصية الأكاديمية:</strong> يتم عرض أسماء أفضل 10 طلاب فقط، بينما يرى باقي الطلاب ترتيبهم ونقاطهم الفردية.
              </div>
            )}
          </div>

          {/* If current user is student and NOT in top 10, show their private rank card at top */}
          {!isDoctor && currentStudentEntry && !isCurrentUserInTop10 && (
            <div className="bg-linear-to-r from-amber-50 dark:from-amber-500/10 via-indigo-50 dark:via-indigo-500/10 to-blue-50 dark:to-blue-500/10 border-2 border-indigo-300 dark:border-indigo-500/40 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-black text-lg flex items-center justify-center shadow-xs">
                  #{currentStudentEntry.rank}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200">بطاقة مركزك الشخصي</span>
                    <span className="text-[12px] bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-mono">
                      {currentStudentEntry.studentAcademicId}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    {currentStudentEntry.studentName} (أنت)
                  </h4>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-[12px] text-slate-500 dark:text-slate-400 font-bold">الدرع المستحق</div>
                  <div className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1 mt-0.5">
                    {getBadgeVisual(currentStudentEntry.badge, currentStudentEntry.rank).medal}{' '}
                    {getBadgeVisual(currentStudentEntry.badge, currentStudentEntry.rank).label}
                  </div>
                </div>

                <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />

                <div className="text-center">
                  <div className="text-[12px] text-slate-500 dark:text-slate-400 font-bold">مجموع نقاطك</div>
                  <div className="text-xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                    {currentStudentEntry.totalPoints} نقطة
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Leaderboard Table */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-3.5 px-4">المركز</th>
                    <th className="py-3.5 px-4">الطالب</th>
                    <th className="py-3.5 px-4">الدرع المستحق</th>
                    <th className="py-3.5 px-4 text-center">الكويزات المكتملة</th>
                    <th className="py-3.5 px-4 text-center">آخر كويز</th>
                    <th className="py-3.5 px-4 text-left font-mono">مجموع النقاط</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {entries.map((entry, idx) => {
                    const isTop10 = entry.rank <= 10;
                    const isSelf = entry.studentId === currentUser?.id;
                    const badgeInfo = getBadgeVisual(entry.badge, entry.rank);

                    // Privacy masking: if viewer is student, entries outside top 10 are hidden (except self)
                    const isMasked = !isDoctor && !isTop10 && !isSelf;

                    return (
                      <tr
                        key={entry.studentId}
                        className={`transition-colors ${
                          isSelf
                            ? 'bg-indigo-50/70 dark:bg-indigo-500/10 font-bold'
                            : entry.rank === 1
                            ? 'bg-amber-50/40 dark:bg-amber-500/10'
                            : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        {/* Rank */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                                entry.rank === 1
                                  ? 'bg-amber-500 text-white shadow-xs'
                                  : entry.rank === 2
                                  ? 'bg-slate-400 text-white'
                                  : entry.rank === 3
                                  ? 'bg-amber-700 text-white'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {entry.rank}
                            </span>
                            <span className="text-base">{badgeInfo.medal}</span>
                          </div>
                        </td>

                        {/* Student Name */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            {isMasked ? (
                              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center">
                                <Lock className="w-3.5 h-3.5" />
                              </div>
                            ) : (
                              <img
                                src={entry.studentAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                                alt=""
                                className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                              />
                            )}

                            <div>
                              <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                {isMasked ? (
                                  <span className="text-slate-400 italic font-normal">
                                    طالب رقم #{entry.rank} (محجوب للخصوصية)
                                  </span>
                                ) : (
                                  <>
                                    <span>{entry.studentName}</span>
                                    {isSelf && (
                                      <span className="text-[12px] bg-indigo-600 text-white px-1.5 py-0.2 rounded-sm">
                                        أنت
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                              {!isMasked && (
                                <div className="text-[12px] text-slate-400 font-mono">
                                  {entry.studentAcademicId}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Badge */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${badgeInfo.bg}`}
                          >
                            {badgeInfo.icon}
                            {badgeInfo.label}
                          </span>
                        </td>

                        {/* Quizzes Count */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap text-slate-600 dark:text-slate-400">
                          {entry.quizzesCompleted}
                        </td>

                        {/* Latest Quiz Score */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span className="font-mono text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                            {entry.latestQuizScore} نقطة
                          </span>
                        </td>

                        {/* Total Points */}
                        <td className="py-3.5 px-4 text-left whitespace-nowrap">
                          <span className="font-mono text-base font-black text-indigo-600 dark:text-indigo-400">
                            {entry.totalPoints}
                          </span>
                          <span className="text-[12px] text-slate-500 dark:text-slate-400 font-normal mr-1">نقطة</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-700 p-4 px-6 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div>
            سياسة الدروع الحالية:{' '}
            <strong>
              {badgePolicy.type === 'fixed_ranks'
                ? `المراكز 1-${badgePolicy.goldThreshold} ذهبي • ${badgePolicy.goldThreshold + 1}-${badgePolicy.silverThreshold} فضي • ${badgePolicy.silverThreshold + 1}-${badgePolicy.bronzeThreshold} برونزي`
                : 'نظام النسب المئوية (أعلى 5% ذهبي • 10% فضي • 20% برونزي)'}
            </strong>
          </div>
          {!asPage && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 dark:bg-slate-950 hover:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl font-bold cursor-pointer transition"
            >
              إغلاق
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
