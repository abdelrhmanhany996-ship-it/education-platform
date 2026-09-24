import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Enrollment, User } from '../types';
import { formatDateTime } from '../utils/format';
import { WhatsAppModal } from './WhatsAppModal';
import { TelegramModal } from './TelegramModal';
import {
  AlertCircle,
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  Clock,
  Mail,
  MessageCircle,
  Phone,
  Send,
  ThumbsDown,
  ThumbsUp,
  XCircle
} from 'lucide-react';

const input =
  'w-full text-sm p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500';
const btnPrimary =
  'px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5';

const STATUS_LABEL: Record<Enrollment['status'], { text: string; tone: string }> = {
  pending_contact: { text: 'بانتظار التواصل', tone: 'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300' },
  approved: { text: 'مقبول', tone: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300' },
  rejected: { text: 'مرفوض', tone: 'bg-rose-100 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300' }
};

/** Doctor: full control (approve/reject). Assistant: contact + payment note only. */
export const EnrollmentRequests: React.FC<{ canApprove: boolean }> = ({ canApprove }) => {
  const { enrollments, courses, users, contactEnrollment, approveEnrollment, rejectEnrollment, currentUser } = useApp();
  const [wa, setWa] = useState<{ student: User; enr: Enrollment } | null>(null);
  const [tg, setTg] = useState<{ student: User; enr: Enrollment } | null>(null);
  const priceOf = (enr: Enrollment) => courses.find(c => c.id === enr.courseId)?.price;

  const [filter, setFilter] = useState<'all' | Enrollment['status']>('pending_contact');
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState('');

  const list = enrollments
    .filter(e => filter === 'all' || e.status === filter)
    .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());

  const counts = {
    all: enrollments.length,
    pending_contact: enrollments.filter(e => e.status === 'pending_contact').length,
    approved: enrollments.filter(e => e.status === 'approved').length,
    rejected: enrollments.filter(e => e.status === 'rejected').length
  };

  const saveNote = async (id: string) => {
    setBusyId(id);
    await contactEnrollment(id, noteDrafts[id]);
    setBusyId('');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">طلبات التسجيل والدفع</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          {canApprove
            ? 'راجع كل طلب، تواصل مع الطالب لإتمام الدفع، ثم اقبل الطلب ليقدر يسجّل الدخول.'
            : 'تواصل مع الطالب وسجّل ملاحظة الدفع. القبول النهائي بيد الدكتور.'}
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ['pending_contact', 'بانتظار التواصل'],
            ['approved', 'مقبولة'],
            ['rejected', 'مرفوضة'],
            ['all', 'الكل']
          ] as const
        ).map(([id, text]) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
              filter === id ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {text} ({counts[id]})
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="surface p-10 text-center text-slate-500 dark:text-slate-400 space-y-2">
          <BadgeCheck className="w-10 h-10 mx-auto text-slate-400" />
          <p className="text-sm">لا توجد طلبات في هذا التصنيف.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map(enr => {
            const status = STATUS_LABEL[enr.status];
            return (
              <article key={enr.id} className="surface p-5 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">{enr.studentName}</h3>
                      <span className="text-[12px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded-md" dir="ltr">
                        {enr.studentAcademicId}
                      </span>
                      <span className={`text-[12px] font-bold px-2 py-0.5 rounded-md ${status.tone}`}>{status.text}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5" />
                        {enr.courseTitle}
                      </span>
                      {typeof courses.find(c => c.id === enr.courseId)?.price === 'number' && (
                        <span className="font-bold text-emerald-700 dark:text-emerald-300">
                          {courses.find(c => c.id === enr.courseId)?.price} ج.م
                        </span>
                      )}
                      <span className="flex items-center gap-1" dir="ltr">
                        <Phone className="w-3.5 h-3.5" />
                        {enr.studentPhone}
                      </span>
                      <span className="flex items-center gap-1" dir="ltr">
                        <Mail className="w-3.5 h-3.5" />
                        {enr.studentEmail}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDateTime(enr.requestedAt)}
                      </span>
                    </div>
                  </div>
                  {enr.contactedAt && (
                    <span className="text-[12px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-lg flex items-center gap-1 shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      تم التواصل {formatDateTime(enr.contactedAt)}
                    </span>
                  )}
                </div>

                {enr.status === 'pending_contact' && (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      className={input}
                      placeholder="ملاحظة الدفع (مثال: دفع 500 ج بفودافون كاش، إيصال #123)"
                      value={noteDrafts[enr.id] ?? enr.paymentNote ?? ''}
                      onChange={e => setNoteDrafts(d => ({ ...d, [enr.id]: e.target.value }))}
                    />
                    <button onClick={() => saveNote(enr.id)} disabled={busyId === enr.id} className={btnPrimary}>
                      <CheckCircle2 className="w-4 h-4" />
                      حفظ / تم التواصل
                    </button>
                  </div>
                )}
                {enr.status !== 'pending_contact' && enr.paymentNote && (
                  <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-lg p-2.5">
                    ملاحظة الدفع: {enr.paymentNote}
                  </div>
                )}

                {enr.status === 'pending_contact' && (
                  <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    {canApprove && (
                      <button
                        onClick={() => approveEnrollment(enr.id)}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                      >
                        <ThumbsUp className="w-4 h-4" />
                        قبول الطلب
                      </button>
                    )}
                    {(() => {
                      const student = users.find(u => u.id === enr.studentId);
                      if (!student) return null;
                      return (
                        <>
                          <button
                            onClick={() => setWa({ student, enr })}
                            className="px-3 py-2 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/25 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                          >
                            <MessageCircle className="w-4 h-4" />
                            واتساب
                          </button>
                          <button
                            onClick={() => setTg({ student, enr })}
                            className="px-3 py-2 bg-sky-50 dark:bg-sky-500/10 hover:bg-sky-100 dark:hover:bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/25 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                          >
                            <Send className="w-4 h-4" />
                            تليجرام
                          </button>
                        </>
                      );
                    })()}
                    {canApprove && (
                    <button
                      onClick={() => window.confirm(`رفض طلب ${enr.studentName}؟`) && rejectEnrollment(enr.id)}
                      className="px-4 py-2 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl text-xs font-bold flex items-center gap-1.5"
                    >
                      <ThumbsDown className="w-4 h-4" />
                      رفض
                    </button>
                    )}
                  </div>
                )}
                {enr.status === 'pending_contact' && !canApprove && (
                  <div className="flex items-center gap-1.5 text-[12px] text-amber-700 dark:text-amber-300">
                    <AlertCircle className="w-3.5 h-3.5" />
                    القبول النهائي بيد الدكتور {enr.doctorName}
                  </div>
                )}
                {enr.status === 'rejected' && (
                  <div className="flex items-center gap-1.5 text-[12px] text-rose-700 dark:text-rose-300">
                    <XCircle className="w-3.5 h-3.5" />
                    رُفض بواسطة {enr.decidedBy} في {formatDateTime(enr.decidedAt)}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <TelegramModal
        isOpen={!!tg}
        onClose={() => setTg(null)}
        student={tg?.student ?? null}
        defaultType="enrollment_contact"
        contextDetails={tg ? { courseTitle: tg.enr.courseTitle, price: priceOf(tg.enr) } : undefined}
      />
      <WhatsAppModal
        isOpen={!!wa}
        onClose={() => setWa(null)}
        student={wa?.student ?? null}
        defaultType="enrollment_contact"
        contextDetails={wa ? { courseTitle: wa.enr.courseTitle, price: priceOf(wa.enr) } : undefined}
      />
    </div>
  );
};
