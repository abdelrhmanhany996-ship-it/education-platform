import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { downloadFile } from '../api';
import { User } from '../types';
import { WhatsAppModal } from './WhatsAppModal';
import { TelegramModal } from './TelegramModal';
import { FileText, Loader2, MessageCircle, Search, Send } from 'lucide-react';

const input =
  'w-full text-sm p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500';

/** Assistant (and doctor, via the same component) send messages to any of their own students. */
export const AssistantMessages: React.FC = () => {
  const { users } = useApp();
  const [q, setQ] = useState('');
  const [wa, setWa] = useState<User | null>(null);
  const [tg, setTg] = useState<User | null>(null);

  const students = users
    .filter(u => u.role === 'student')
    .filter(s => !q || s.name.includes(q) || s.academicId.toLowerCase().includes(q.toLowerCase()) || s.phone.includes(q));

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">الرسائل</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">راسل أي طالب مباشرة عبر واتساب أو تليجرام.</p>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute top-3 start-3" />
        <input className={`${input} ps-9`} placeholder="بحث بالاسم أو الكود أو الهاتف" value={q} onChange={e => setQ(e.target.value)} />
      </div>

      <div className="surface divide-y divide-slate-100 dark:divide-slate-800">
        {students.length === 0 && <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">لا يوجد طلاب.</div>}
        {students.map(s => (
          <div key={s.id} className="p-3.5 flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{s.name}</div>
              <div className="text-[12px] text-slate-500 dark:text-slate-400 font-mono" dir="ltr">
                {s.academicId} · {s.phone}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setWa(s)}
                className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/25 rounded-lg text-xs font-bold flex items-center gap-1"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                واتساب
              </button>
              <button
                onClick={() => setTg(s)}
                className="px-3 py-1.5 bg-sky-50 dark:bg-sky-500/10 hover:bg-sky-100 dark:hover:bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/25 rounded-lg text-xs font-bold flex items-center gap-1"
              >
                <Send className="w-3.5 h-3.5" />
                تليجرام
              </button>
            </div>
          </div>
        ))}
      </div>

      <WhatsAppModal isOpen={!!wa} onClose={() => setWa(null)} student={wa} defaultType="quiz_reminder" />
      <TelegramModal isOpen={!!tg} onClose={() => setTg(null)} student={tg} defaultType="quiz_reminder" />
    </div>
  );
};

/** Every lecture PDF across the assistant's doctor's courses, ready to download. */
export const AssistantFiles: React.FC = () => {
  const { courses } = useApp();
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const rows = courses.flatMap(c =>
    c.weeks.flatMap(w =>
      w.lectures
        .filter(l => l.explanationPdf.fileId)
        .map(l => ({ courseTitle: c.title, weekTitle: w.title, lecture: l }))
    )
  );

  const download = async (fileId: string, title: string) => {
    setError('');
    setBusyId(fileId);
    try {
      const blob = await downloadFile(fileId);
      if (!blob) {
        setError('الملف غير موجود على الخادم.');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('تعذر تحميل الملف.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">ملفات PDF</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">كل ملفات شرح المحاضرات في مقررات دكتورك.</p>
      </div>

      {error && <div className="text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 rounded-xl p-3">{error}</div>}

      {rows.length === 0 ? (
        <div className="surface p-10 text-center text-slate-500 dark:text-slate-400">
          <FileText className="w-10 h-10 mx-auto mb-2 text-slate-400" />
          لا توجد ملفات مرفوعة بعد.
        </div>
      ) : (
        <div className="surface divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map(({ courseTitle, weekTitle, lecture }) => (
            <div key={lecture.id} className="p-3.5 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{lecture.title}</div>
                <div className="text-[12px] text-slate-500 dark:text-slate-400">
                  {courseTitle} · {weekTitle} · {lecture.explanationPdf.pageCount} صفحة
                </div>
              </div>
              <button
                onClick={() => download(lecture.explanationPdf.fileId!, lecture.title)}
                disabled={busyId === lecture.explanationPdf.fileId}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0"
              >
                {busyId === lecture.explanationPdf.fileId ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                تنزيل
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
