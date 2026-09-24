import React, { useState, useEffect } from 'react';
import { Lecture, StudentLectureState } from '../types';
import {
  CalendarCheck,
  Star,
  MessageSquare,
  Clock,
  CheckCircle2,
  Lock,
  AlertTriangle,
  ChevronLeft,
  Sparkles,
  ShieldAlert
} from 'lucide-react';

interface LectureStage2AttendanceProps {
  lecture: Lecture;
  studentState?: StudentLectureState;
  isStage1Completed: boolean;
  onSubmitAttendance: (rating: number, comment: string) => void;
  onProceedToQuiz: () => void;
}

export const LectureStage2Attendance: React.FC<LectureStage2AttendanceProps> = ({
  lecture,
  studentState,
  isStage1Completed,
  onSubmitAttendance,
  onProceedToQuiz
}) => {
  const [rating, setRating] = useState<number>(studentState?.starRating || 5);
  const [comment, setComment] = useState<string>(studentState?.feedbackComment || '');
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [timeLeftStr, setTimeLeftStr] = useState<string>('');
  const [isExpired, setIsExpired] = useState<boolean>(false);

  const isAttended = studentState?.stage2Completed && studentState?.attended;
  const validityHours = lecture.quizSettings.validityWindowHours || 24;

  // Live countdown timer for the student's individual quiz window
  useEffect(() => {
    if (!studentState?.quizWindowEnd) return;

    const calculateTimeRemaining = () => {
      const targetTime = new Date(studentState.quizWindowEnd!).getTime();
      const now = new Date().getTime();
      const diff = targetTime - now;

      if (diff <= 0) {
        setTimeLeftStr('انتهت صلاحية نافذة الكويز');
        setIsExpired(true);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeftStr(`${hours} ساعة و ${minutes} دقيقة و ${seconds} ثانية`);
      setIsExpired(false);
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000);
    return () => clearInterval(interval);
  }, [studentState?.quizWindowEnd]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitAttendance(rating, comment);
  };

  const ratingLabels: Record<number, string> = {
    1: 'ضعيف - لم أفهم بعض المفاهيم الأساسية',
    2: 'مقبول - الشرح يحتاج أمثلة إضافية',
    3: 'جيد - استوعبت أغلب النقاط',
    4: 'جيد جداً - شرح متميز ومفصل',
    5: 'ممتاز - استيعاب كامل للمحاضرة وتطبيقاتها'
  };

  if (!isStage1Completed) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 text-center space-y-4 shadow-xs">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
          <Lock className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">المرحلة 2 مقفلة حالياً</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
          وفقاً لنظام الكورس الأكاديمي، لا يمكنك تسجيل الحضور والتقييم إلا بعد إتمام الاطلاع على شرح المحاضرة في المرحلة الأولى.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden" id="stage2-attendance-container">
      {/* Header */}
      <div className="bg-linear-to-r from-blue-900 to-indigo-900 text-white p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-blue-300">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider bg-blue-500/20 text-blue-200 px-2 py-0.5 rounded-md border border-blue-400/30">
                المرحلة 2: تسجيل الحضور والتقييم
              </span>
              {isAttended && (
                <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md flex items-center gap-1 border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3" />
                  تم تسجيل الحضور
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-white mt-0.5">
              تأكيد الحضور وتقييم المحاضرة الأكاديمية
            </h3>
          </div>
        </div>

        {/* Doctor Policy Badge */}
        <div className="bg-white/10 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-blue-100 flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-300" />
          <span>صلاحية الكويز: <strong>{validityHours} ساعة</strong> من لحظة التسجيل</span>
        </div>
      </div>

      <div className="p-6 md:p-8 space-y-6">
        {/* Important Rule Banner */}
        <div className="bg-blue-50/70 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/25 rounded-xl p-4 text-xs text-blue-950 dark:text-blue-100 flex items-start gap-3">
          <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-blue-900 dark:text-blue-200">نظام فتح الكويز (مؤقت خاص ومستقل لكل طالب):</div>
            <p className="text-blue-800 dark:text-blue-300 leading-relaxed">
              بمجرد تسجيل حضورك، يبدأ <strong>مؤقتك المستقل الخاص</strong> بصلاحية ({validityHours} ساعة) تم ضبطها من لوحة تحكم الدكتور.
              لديك وقت بداية ونهاية فريدان ومخزنان بحسابك لدخول الكويز وإتمامه.
            </p>
          </div>
        </div>

        {/* If already submitted attendance */}
        {isAttended ? (
          <div className="space-y-6">
            <div className="bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 rounded-xl p-5 text-xs text-emerald-950 dark:text-emerald-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-bold text-sm text-emerald-900 dark:text-emerald-200">تم تسجيل حضورك بنجاح في هذه المحاضرة!</div>
                  <div className="text-emerald-700 dark:text-emerald-300 mt-0.5">
                    توقيت التسجيل: {studentState?.attendanceSubmittedAt ? new Date(studentState.attendanceSubmittedAt).toLocaleString('ar-EG') : 'اليوم'}
                  </div>
                </div>
              </div>

              {/* Star Rating Display */}
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-500/25 text-xs font-bold text-amber-600 dark:text-amber-400">
                <span>تقييمك:</span>
                <div className="flex items-center text-amber-400">
                  {[1, 2, 3, 4, 5].map(star => (
                    <Star
                      key={star}
                      className={`w-4 h-4 ${
                        star <= (studentState?.starRating || 5) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-slate-600 dark:text-slate-400">({studentState?.starRating || 5}/5)</span>
              </div>
            </div>

            {studentState?.feedbackComment && (
              <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-xs text-slate-700 dark:text-slate-300">
                <div className="font-bold text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  ملاحظاتك المسجلة للدكتور:
                </div>
                <p className="italic bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                  "{studentState.feedbackComment}"
                </p>
              </div>
            )}

            {/* Student Individual Timer Card */}
            <div className={`rounded-xl p-5 border text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
              isExpired
                ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/25 text-rose-900 dark:text-rose-200'
                : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/25 text-amber-950 dark:text-amber-100'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isExpired ? 'bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400' : 'bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 animate-pulse'
                }`}>
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm">
                    {isExpired ? 'انتهت فترة صلاحية الكويز الخاص بك' : 'المؤقت الزمني المستقل الخاص بك:'}
                  </div>
                  <div className="font-mono text-xs mt-0.5">
                    {isExpired ? 'يرجى التواصل مع الدكتور لطلب فتح تمديد' : `الوقت المتبقي: ${timeLeftStr}`}
                  </div>
                  {studentState?.quizWindowEnd && (
                    <div className="text-[12px] opacity-80 mt-0.5">
                      تنتهي الصلاحية في: {new Date(studentState.quizWindowEnd).toLocaleString('ar-EG')}
                    </div>
                  )}
                </div>
              </div>

              {!isExpired && (
                <button
                  id="proceed-to-quiz-btn"
                  onClick={onProceedToQuiz}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs transition cursor-pointer"
                >
                  <span>الانتقال للمرحلة 3: بدء الكويز</span>
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Form to Submit Attendance */
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Rating Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-900 dark:text-slate-100">
                1. تقييمك لمستوى شرح المحاضرة واستيعابك:
              </label>
              <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(star => {
                    const activeVal = hoverRating !== null ? hoverRating : rating;
                    const isFilled = star <= activeVal;
                    return (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(null)}
                        className="p-1 text-slate-300 hover:scale-110 transition cursor-pointer focus:outline-hidden"
                      >
                        <Star
                          className={`w-7 h-7 ${
                            isFilled ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
                <div className="text-xs font-bold text-indigo-900 dark:text-indigo-200 border-r border-slate-200 dark:border-slate-700 pr-3 mr-2">
                  {ratingLabels[hoverRating !== null ? hoverRating : rating]}
                </div>
              </div>
            </div>

            {/* Feedback Comment */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                <span>2. تعليقك أو أي استفسار حول المحتوى (اختياري):</span>
                <span className="text-[12px] text-slate-400 font-normal">يرسل مباشرة للدكتور</span>
              </label>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={3}
                placeholder="أكتب ملاحظاتك على الشرح، الأسئلة التي ترغب بمراجعتها مع الدكتور، أو مقترحاتك..."
                className="w-full text-xs p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition text-slate-800 dark:text-slate-200"
              />
            </div>

            {/* Submission Action */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                بالضغط على الزر سيتم تسجيل حضورك رسميًا وبدء نافذة الـ ({validityHours} ساعة) لحل الكويز.
              </div>

              <button
                type="submit"
                id="submit-attendance-btn"
                className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                تأكيد الحضور وبدء مؤقت الكويز ←
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
