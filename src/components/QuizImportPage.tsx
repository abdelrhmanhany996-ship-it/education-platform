import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { QuestionUploadModal } from './QuestionUploadModal';
import { Sparkles, Upload } from 'lucide-react';

/** A dedicated, top-level entry point for "upload a PDF, get an MCQ quiz out of it" — the same
 * uploader lives inside each lecture's "الأسئلة" tab, but doctors kept missing it there. */
export const QuizImportPage: React.FC = () => {
  const { courses } = useApp();
  const [open, setOpen] = useState(false);
  const lectures = courses.flatMap(c => c.weeks.flatMap(w => w.lectures.map(l => ({ ...l, courseTitle: c.title }))));

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">إنشاء كويز من ملف أسئلة (PDF)</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            ارفع ملف فيه الأسئلة وإجاباتها الصحيحة، وتتحول تلقائياً إلى كويز اختيار من متعدد يصحَّح للطلبة أولاً بأول.
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          disabled={!lectures.length}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold flex items-center gap-2 shrink-0"
        >
          <Upload className="w-4 h-4" />
          رفع ملف أسئلة
        </button>
      </div>

      <div className="surface p-5 space-y-3">
        <div className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
          <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
          <div className="space-y-1.5 leading-relaxed">
            <p>رقّم الأسئلة (1. 2. 3.)، اكتب الخيارات (أ ب ج د)، وأنهِ كل سؤال بسطر "الإجابة: ب" — النظام يقرأ الإجابة من الحل مباشرة.</p>
            <p>تقدر تعدّل الإجابة الصحيحة في أي وقت من تبويب "الأسئلة" داخل المحاضرة، وكل الطلبة اللي سبق وحلوا الكويز يتصححوا تلقائياً من جديد.</p>
          </div>
        </div>
      </div>

      {!lectures.length ? (
        <div className="surface p-10 text-center text-slate-500 dark:text-slate-400">أنشئ مقرراً ومحاضرة أولاً من "المقررات والمحاضرات".</div>
      ) : (
        <div className="surface divide-y divide-slate-100 dark:divide-slate-800">
          {lectures.map(l => (
            <div key={l.id} className="p-3.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{l.title}</div>
                <div className="text-[12px] text-slate-500 dark:text-slate-400">{l.courseTitle} · {l.questionBank?.length || 0} سؤال حالياً</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <QuestionUploadModal isOpen={open} onClose={() => setOpen(false)} />
    </div>
  );
};
