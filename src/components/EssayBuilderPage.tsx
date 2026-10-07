import React, { useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api';
import { QuestionBankItem } from '../types';
import { extractTextFromPdf, extractTextViaOcr } from '../utils/pdfText';
import { textLooksReadable } from '../utils/pdfQuestionParser';
import { downloadQuizWord, printQuizPdf } from '../utils/quizExport';
import {
  CheckCircle2,
  Download,
  FileDown,
  FileText,
  Loader2,
  PenLine,
  Plus,
  Printer,
  Sparkles,
  Trash2,
  AlertTriangle
} from 'lucide-react';

const field =
  'w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

const newEssay = (n: number, prompt = '', modelAnswer = '', points = 5): QuestionBankItem => ({
  id: `qb_essay_${Date.now()}_${n}_${Math.random().toString(36).slice(2, 6)}`,
  lectureId: 'temp',
  questionNumber: n,
  type: 'essay',
  prompt,
  options: [],
  explanation: modelAnswer,
  correctAnswerText: '',
  points
});

/** Its own page for essay (written-answer) questions: write them, or generate them from a lecture file,
 *  each with a model answer for grading, then download the paper or add them to a lecture. */
export const EssayBuilderPage: React.FC = () => {
  const { courses, addQuestionsToLecture, createQuizLecture } = useApp();
  const lectures = useMemo(
    () => courses.flatMap(c => c.weeks.flatMap(w => w.lectures.map(l => ({ id: l.id, title: l.title, courseTitle: c.title })))),
    [courses]
  );

  const [title, setTitle] = useState('');
  const [items, setItems] = useState<QuestionBankItem[]>([newEssay(1)]);
  const [sourceText, setSourceText] = useState('');
  const [fileName, setFileName] = useState('');
  const [count, setCount] = useState(5);
  const [lang, setLang] = useState<'ar' | 'en' | 'same'>('ar');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [withKey, setWithKey] = useState(true);
  const [target, setTarget] = useState(lectures[0]?.id || '__CREATE_NEW__');
  const fileRef = useRef<HTMLInputElement>(null);

  const ready = items.filter(q => q.prompt.trim());
  const total = ready.reduce((s, q) => s + (Number(q.points) || 0), 0);
  const paperTitle = title.trim() || 'أسئلة مقالية';

  const update = (id: string, patch: Partial<QuestionBankItem>) =>
    setItems(list => list.map(q => (q.id === id ? { ...q, ...patch } : q)));

  const readFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setFileName(file.name);
    setError('');
    setBusy('جارٍ قراءة الملف...');
    try {
      let text = '';
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        text = (await extractTextFromPdf(file)).text;
        if (!textLooksReadable(text)) {
          setBusy('الملف ممسوح ضوئياً، جارٍ القراءة الضوئية (OCR)...');
          text = (await extractTextViaOcr(file)).text;
        }
      } else {
        text = (await file.text()).normalize('NFKC');
      }
      if (!textLooksReadable(text)) throw new Error('تعذّر قراءة نص واضح من الملف. الصق الشرح في المربع بدلاً من ذلك.');
      setSourceText(text);
      if (!title.trim()) setTitle(file.name.replace(/\.[^/.]+$/, ''));
    } catch (err: any) {
      setError(err?.message || 'تعذّر قراءة الملف.');
    } finally {
      setBusy('');
    }
  };

  const generate = async () => {
    if (!sourceText.trim()) return setError('ارفع ملف المحاضرة أو الصق الشرح أولاً.');
    setError('');
    setBusy(`جارٍ كتابة ${count} أسئلة مقالية مع الإجابات النموذجية...`);
    try {
      const res = await api.generateQuestionsAI({ text: sourceText, count, types: ['essay'], language: lang });
      const generated = (res.questions || [])
        .filter(q => String(q.prompt || '').trim())
        .map((q, i) => newEssay(i + 1, String(q.prompt).trim(), String(q.explanation || '').trim(), 5));
      if (!generated.length) throw new Error('لم يرجع الذكاء الاصطناعي أسئلة، حاول مرة أخرى.');
      // Drop the empty starter card, keep anything the doctor already wrote
      setItems(list => [...list.filter(q => q.prompt.trim()), ...generated]);
      setNotice(`تم توليد ${generated.length} أسئلة. راجعها وعدّل الإجابات النموذجية والدرجات.`);
    } catch (err: any) {
      setError(err?.message || 'تعذّر توليد الأسئلة.');
    } finally {
      setBusy('');
    }
  };

  const download = (kind: 'pdf' | 'word') => {
    if (!ready.length) return;
    if (kind === 'pdf') printQuizPdf(paperTitle, ready, withKey);
    else downloadQuizWord(paperTitle, ready, withKey);
  };

  const save = () => {
    if (!ready.length) return;
    const qs = ready.map((q, i) => ({ ...q, questionNumber: i + 1, points: Math.max(1, Number(q.points) || 1) }));
    if (target === '__CREATE_NEW__') {
      const id = createQuizLecture('أسئلة مقالية', paperTitle, qs);
      if (!id) return setError('تعذّر إنشاء المحاضرة.');
    } else {
      addQuestionsToLecture(target, qs.map(q => ({ ...q, lectureId: target })));
    }
    setNotice(`تمت إضافة ${qs.length} سؤال مقالي إلى ${target === '__CREATE_NEW__' ? 'محاضرة جديدة' : 'كويز المحاضرة'}. تصححها من "تصحيح المقالي".`);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <header>
        <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <PenLine className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          إنشاء أسئلة مقالية
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          اكتب الأسئلة بنفسك أو ولّدها من ملف المحاضرة، مع إجابة نموذجية ودرجة لكل سؤال، ثم حمّل الورقة أو أضفها لكويز محاضرة.
        </p>
      </header>

      <section className="surface p-5 space-y-3" aria-labelledby="essay-src">
        <h3 id="essay-src" className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          توليد من ملف المحاضرة (اختياري)
        </h3>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept=".pdf,.txt,application/pdf,text/plain" className="sr-only" onChange={readFile} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={!!busy}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 disabled:opacity-50"
          >
            <FileText className="w-4 h-4" />
            {fileName || 'رفع PDF أو TXT'}
          </button>
        </div>
        <textarea
          dir="auto"
          rows={4}
          value={sourceText}
          onChange={e => setSourceText(e.target.value)}
          placeholder="أو الصق هنا شرح المحاضرة / الجزء الذي تريد أسئلة عنه"
          className={`${field} leading-relaxed`}
        />
        <div className="flex flex-wrap items-end gap-3 text-xs">
          <label>
            <span className="block font-bold text-slate-700 dark:text-slate-300 mb-1">عدد الأسئلة</span>
            <select value={count} onChange={e => setCount(Number(e.target.value))} className={`${field} w-auto font-bold`}>
              {[3, 5, 8, 10, 15].map(n => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="block font-bold text-slate-700 dark:text-slate-300 mb-1">اللغة</span>
            <select value={lang} onChange={e => setLang(e.target.value as typeof lang)} className={`${field} w-auto font-bold`}>
              <option value="ar">عربي</option>
              <option value="en">English</option>
              <option value="same">نفس لغة الملف</option>
            </select>
          </label>
          <button
            type="button"
            id="generate-essays-btn"
            onClick={() => void generate()}
            disabled={!!busy || !sourceText.trim()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold flex items-center gap-1.5"
          >
            <Sparkles className="w-4 h-4" />
            توليد أسئلة مقالية
          </button>
        </div>
      </section>

      {busy && (
        <div className="flex items-center gap-2 text-sm text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/25 rounded-xl p-3">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          {busy}
        </div>
      )}
      {error && (
        <div role="alert" className="flex items-start gap-2 text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}
      {notice && !error && (
        <div className="flex items-start gap-2 text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 rounded-xl p-3">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          {notice}
        </div>
      )}

      <section className="space-y-3" aria-labelledby="essay-list">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label className="flex-1 min-w-[220px]">
            <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">عنوان الورقة</span>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="مثال: امتحان مقالي - المحاضرة 3" className={field} />
          </label>
          <span id="essay-list" className="text-xs font-bold text-slate-600 dark:text-slate-400">
            {ready.length} سؤال · المجموع {total} درجة
          </span>
        </div>

        {items.map((q, i) => (
          <article key={q.id} className="surface p-4 space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex-1">سؤال مقالي</span>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                الدرجة
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={q.points}
                  onChange={e => update(q.id, { points: Math.max(1, Math.min(100, Number(e.target.value) || 1)) })}
                  className="w-16 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-center"
                />
              </label>
              <button
                type="button"
                onClick={() => setItems(list => (list.length > 1 ? list.filter(x => x.id !== q.id) : [newEssay(1)]))}
                aria-label={`حذف السؤال ${i + 1}`}
                className="p-1.5 text-slate-400 hover:text-rose-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <textarea
              dir="auto"
              rows={2}
              value={q.prompt}
              onChange={e => update(q.id, { prompt: e.target.value })}
              placeholder="نص السؤال، مثال: اشرح خطوات تبسيط الدالة باستخدام خريطة كارنو مع مثال."
              aria-label={`نص السؤال ${i + 1}`}
              className={`${field} font-bold`}
            />
            <textarea
              dir="auto"
              rows={3}
              value={q.explanation || ''}
              onChange={e => update(q.id, { explanation: e.target.value })}
              placeholder="الإجابة النموذجية / نقاط التصحيح (تظهر في نموذج الإجابة وعند التصحيح)"
              aria-label={`الإجابة النموذجية للسؤال ${i + 1}`}
              className={`${field} text-xs bg-slate-50 dark:bg-slate-800/40`}
            />
          </article>
        ))}

        <button
          type="button"
          id="add-essay-btn"
          onClick={() => setItems(list => [...list, newEssay(list.length + 1)])}
          className="w-full py-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-sm font-bold text-slate-600 dark:text-slate-300 hover:border-indigo-400 hover:text-indigo-700 flex items-center justify-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          إضافة سؤال مقالي
        </button>
      </section>

      <section className="surface p-4 flex flex-wrap items-center gap-3" aria-label="تحميل وحفظ">
        <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={withKey} onChange={e => setWithKey(e.target.checked)} className="accent-indigo-600" />
          إرفاق الإجابات النموذجية
        </label>
        <div className="flex flex-wrap gap-2 ms-auto">
          <button
            type="button"
            id="essay-pdf-btn"
            disabled={!ready.length}
            onClick={() => download('pdf')}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            تحميل PDF
          </button>
          <button
            type="button"
            id="essay-word-btn"
            disabled={!ready.length}
            onClick={() => download('word')}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <FileDown className="w-4 h-4" />
            تحميل Word
          </button>
        </div>
        <div className="w-full flex flex-wrap items-center gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">أو أضفها لكويز محاضرة:</span>
          <select value={target} onChange={e => setTarget(e.target.value)} className={`${field} w-auto flex-1 min-w-[200px] text-xs`}>
            <option value="__CREATE_NEW__">+ محاضرة جديدة باسم الورقة</option>
            {lectures.map(l => (
              <option key={l.id} value={l.id}>
                {l.courseTitle} - {l.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            id="essay-save-btn"
            disabled={!ready.length}
            onClick={save}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 flex items-center gap-1.5"
          >
            <Download className="w-4 h-4 rotate-180" />
            حفظ في المنصة
          </button>
        </div>
      </section>
    </div>
  );
};
