import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { CertificateModal } from './CertificateModal';
import { formatDate } from '../utils/format';
import { Award, Clock, Hourglass } from 'lucide-react';

export const StudentCertificatePage: React.FC = () => {
  const { currentUser, courses, certificates } = useApp();
  const [open, setOpen] = useState(false);
  const course = courses[0];
  const mine = certificates.find(c => c.studentId === currentUser?.id);
  const approved = mine && (mine.status === 'approved' || mine.status === 'issued');

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">شهادتي</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">تُمنح شهادة PDF لأول 3 طلاب في الترتيب النهائي بعد انتهاء الكورس.</p>
      </div>

      {approved ? (
        <div className="surface p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
            <Award className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">مبروك! {mine!.rankTitle}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {mine!.courseTitle} · {formatDate(mine!.issueDate)}
            </p>
          </div>
          <button
            id="open-my-certificate-btn"
            onClick={() => setOpen(true)}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold"
          >
            عرض الشهادة وتنزيلها PDF
          </button>
        </div>
      ) : mine ? (
        <div className="surface p-8 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
            <Clock className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">شهادتك بانتظار اعتماد الدكتور</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">ستظهر هنا فور اعتمادها.</p>
        </div>
      ) : (
        <div className="surface p-8 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 mx-auto flex items-center justify-center">
            <Hourglass className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {course?.isCompleted ? 'لم تكن ضمن أول 3 في الترتيب النهائي' : 'الكورس لا يزال جارياً'}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            {course?.isCompleted
              ? 'شكراً لمجهودك طوال الكورس. تابع لوحة الشرف لمعرفة ترتيبك.'
              : 'تصدر الشهادات بعد أن ينهي الدكتور الكورس. واصل جمع النقاط لتكون ضمن أول 3.'}
          </p>
        </div>
      )}

      {mine && <CertificateModal certificate={mine} isOpen={open} onClose={() => setOpen(false)} isDoctor={false} />}
    </div>
  );
};
