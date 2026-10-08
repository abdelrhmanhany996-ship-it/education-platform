import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api';
import { QuestionBankItem } from '../types';
import { extractTextFromPdf, extractTextViaOcr } from '../utils/pdfText';
import { textLooksReadable } from '../utils/pdfQuestionParser';
import { buildQuizHtml, downloadQuizWord, printQuizPdf } from '../utils/quizExport';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  Copy,
  Eye,
  FileDown,
  FileText,
  FileUp,
  KeyRound,
  Loader2,
  Minus,
  PenLine,
  Plus,
  Printer,
  Save,
  Sparkles,
  Trash2,
  X
} from 'lucide-react';

const field =
  'w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition';

const POINT_PRESETS = [2, 5, 10];
const COUNTS = [3, 5, 8, 10, 15];

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

/** Grows with its content so long questions and model answers never hide behind a scrollbar. */
const AutoTextarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement> & { minRows?: number }> = ({ minRows = 2, className, ...props }) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [props.value]);
  return <textarea ref={ref} rows={minRows} dir="auto" className={`${className} resize-none overflow-hidden leading-relaxed`} {...props} />;
};

const Panel: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; id?: string; label?: string }> = ({ title, icon, children, id, label }) => (
  <section className="surface p-4 space-y-3" aria-labelledby={id} aria-label={label}>
    <h3 id={id} className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
      <span className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 flex items-center justify-center">{icon}</span>
      {title}
    </h3>
    {children}
  </section>
);

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
  const [openAnswers, setOpenAnswers] = useState<Record<string, boolean>>({});
  const [sourceText, setSourceText] = useState('');
  const [fileName, setFileName] = useState('');
  const [dragging, setDragging] = useState(false);
  const [count, setCount] = useState(5);
  const [lang, setLang] = useState<'ar' | 'en' | 'same'>('ar');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [withKey, setWithKey] = useState(true);
  const [preview, setPreview] = useState(false);
  const [target, setTarget] = useState(lectures[0]?.id || '__CREATE_NEW__');
  const fileRef = useRef<HTMLInputElement>(null);

  const ready = items.filter(q => q.prompt.trim());
  const total = ready.reduce((s, q) => s + (Number(q.points) || 0), 0);
  const missingAnswers = ready.filter(q => !String(q.explanation || '').trim()).length;
  const paperTitle = title.trim() || 'أسئلة مقالية';

  const update = (id: string, patch: Partial<QuestionBankItem>) => setItems(list => list.map(q => (q.id === id ? { ...q, ...patch } : q)));
  const setPoints = (id: string, v: number) => update(id, { points: Math.max(1, Math.min(100, Math.round(v) || 1)) });
  const move = (i: number, by: number) =>
    setItems(list => {
      const j = i + by;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const duplicate = (i: number) =>
    setItems(list => {
      const copy = { ...newEssay(list.length + 1), prompt: list[i].prompt, explanation: list[i].explanation, points: list[i].points };
      return [...list.slice(0, i + 1), copy, ...list.slice(i + 1)];
    });
  const remove = (id: string) => setItems(list => (list.length > 1 ? list.filter(x => x.id !== id) : [newEssay(1)]));
  const addEssay = () => {
    const q = newEssay(items.length + 1);
    setItems(list => [...list, q]);
    // Focus the new question once it is on the page
    setTimeout(() => document.querySelector<HTMLTextAreaElement>(`[data-prompt="${q.id}"]`)?.focus(), 30);
  };

  const readFile = async (file?: File | null) => {
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
      setFileName('');
      setError(err?.message || 'تعذّر قراءة الملف.');
    } finally {
      setBusy('');
    }
  };

  const generate = async () => {
    if (!sourceText.trim()) return setError('ارفع ملف المحاضرة أو الصق الشرح أولاً.');
    setError('');
    setNotice('');
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
    setError('');
    setNotice(`تمت إضافة ${qs.length} سؤال مقالي إلى ${target === '__CREATE_NEW__' ? 'محاضرة جديدة' : 'كويز المحاضرة'}. تصححها من "تصحيح المقالي".`);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <PenLine className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            إنشاء أسئلة مقالية
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
            اكتب الأسئلة أو ولّدها من ملف المحاضرة، مع إجابة نموذجية ودرجة لكل سؤال، ثم حمّل الورقة أو أضفها لكويز محاضرة.
          </p>
        </div>
        <dl className="flex gap-2" aria-label="ملخص الورقة">
          {[
            { k: 'سؤال', v: ready.length },
            { k: 'درجة', v: total }
          ].map(s => (
            <div key={s.k} className="surface px-4 py-2 text-center min-w-[84px] flex flex-col-reverse">
              <dt className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{s.k}</dt>
              <dd className="text-xl font-black text-indigo-600 dark:text-indigo-300 tabular-nums">{s.v}</dd>
            </div>
          ))}
        </dl>
      </header>

      <div aria-live="polite" className="space-y-2">
        {busy && (
          <div className="flex items-center gap-2 text-sm text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/25 rounded-xl p-3">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            {busy}
          </div>
        )}
        {error && (
          <div role="alert" className="flex items-start gap-2 text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 rounded-xl p-3">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span className="flex-1">{error}</span>
            <button type="button" onClick={() => setError('')} aria-label="إغلاق" className="text-rose-500 hover:text-rose-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {notice && !error && (
          <div className="flex items-start gap-2 text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 rounded-xl p-3">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            <span className="flex-1">{notice}</span>
            <button type="button" onClick={() => setNotice('')} aria-label="إغلاق" className="text-emerald-600 hover:text-emerald-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
        {/* Questions */}
        <section className="space-y-4 min-w-0" aria-labelledby="essay-list">
          <div className="surface p-4">
            <label className="block">
              <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">عنوان الورقة</span>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="مثال: امتحان مقالي - المحاضرة 3"
                className={`${field} text-base font-bold`}
              />
            </label>
          </div>

          <h3 id="essay-list" className="sr-only">
            الأسئلة
          </h3>

          <ol className="space-y-3">
            {items.map((q, i) => {
              const answerOpen = openAnswers[q.id] ?? true;
              const hasAnswer = !!String(q.explanation || '').trim();
              const iconBtn =
                'p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none';
              return (
                <li key={q.id}>
                  <article className="surface overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/40 transition" aria-label={`السؤال ${i + 1}`}>
                    <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-700">
                      <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white text-xs font-black flex items-center justify-center shrink-0 tabular-nums">{i + 1}</span>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex-1">سؤال مقالي</span>

                      <div className="flex items-center gap-1" role="group" aria-label={`درجة السؤال ${i + 1}`}>
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 me-1">الدرجة</span>
                        <button type="button" onClick={() => setPoints(q.id, q.points - 1)} aria-label="إنقاص الدرجة" className={iconBtn} disabled={q.points <= 1}>
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={q.points}
                          onChange={e => setPoints(q.id, Number(e.target.value))}
                          aria-label={`درجة السؤال ${i + 1}`}
                          className="w-12 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-center text-sm font-black tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button type="button" onClick={() => setPoints(q.id, q.points + 1)} aria-label="زيادة الدرجة" className={iconBtn} disabled={q.points >= 100}>
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center border-s border-slate-200 dark:border-slate-700 ps-1.5 ms-0.5">
                        <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`تحريك السؤال ${i + 1} لأعلى`} title="لأعلى" className={iconBtn}>
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={`تحريك السؤال ${i + 1} لأسفل`} title="لأسفل" className={iconBtn}>
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => duplicate(i)} aria-label={`تكرار السؤال ${i + 1}`} title="تكرار" className={iconBtn}>
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(q.id)}
                          aria-label={`حذف السؤال ${i + 1}`}
                          title="حذف"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="p-4 space-y-3">
                      <AutoTextarea
                        data-prompt={q.id}
                        minRows={2}
                        value={q.prompt}
                        onChange={e => update(q.id, { prompt: e.target.value })}
                        placeholder="اكتب نص السؤال... مثال: اشرح خطوات تبسيط الدالة باستخدام خريطة كارنو مع مثال."
                        aria-label={`نص السؤال ${i + 1}`}
                        className={`${field} text-[15px] font-bold`}
                      />

                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">درجة سريعة:</span>
                        {POINT_PRESETS.map(p => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setPoints(q.id, p)}
                            aria-pressed={q.points === p}
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition ${
                              q.points === p
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-indigo-400'
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>

                      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setOpenAnswers(s => ({ ...s, [q.id]: !answerOpen }))}
                          aria-expanded={answerOpen}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                          الإجابة النموذجية / نقاط التصحيح
                          <span
                            className={`ms-1 px-1.5 py-0.5 rounded-md text-[10px] ${
                              hasAnswer
                                ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                : 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {hasAnswer ? 'مكتوبة' : 'غير مكتوبة'}
                          </span>
                          <ChevronDown className={`w-4 h-4 ms-auto transition-transform ${answerOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {answerOpen && (
                          <div className="p-3 bg-white dark:bg-slate-900">
                            <AutoTextarea
                              minRows={3}
                              value={q.explanation || ''}
                              onChange={e => update(q.id, { explanation: e.target.value })}
                              placeholder="النقاط التي يجب أن تحتويها الإجابة، تظهر في نموذج الإجابة وعند التصحيح."
                              aria-label={`الإجابة النموذجية للسؤال ${i + 1}`}
                              className={`${field} text-sm bg-amber-50/40 dark:bg-amber-500/5`}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ol>

          <button
            type="button"
            id="add-essay-btn"
            onClick={addEssay}
            className="w-full py-4 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-sm font-bold text-slate-600 dark:text-slate-300 hover:border-indigo-400 hover:text-indigo-700 hover:bg-indigo-50/40 dark:hover:bg-indigo-500/5 flex items-center justify-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4" />
            إضافة سؤال مقالي
          </button>
        </section>

        {/* Tools */}
        <div className="space-y-4 lg:sticky lg:top-20">
          <Panel title="توليد بالذكاء الاصطناعي" icon={<Sparkles className="w-4 h-4" />} id="essay-src">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,application/pdf,text/plain"
              className="sr-only"
              onChange={e => {
                void readFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={e => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => {
                e.preventDefault();
                setDragging(false);
                void readFile(e.dataTransfer.files?.[0]);
              }}
              disabled={!!busy}
              className={`w-full rounded-xl border-2 border-dashed p-4 text-center transition disabled:opacity-50 ${
                dragging ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400'
              }`}
            >
              {fileName ? <FileText className="w-6 h-6 mx-auto text-indigo-600" /> : <FileUp className="w-6 h-6 mx-auto text-slate-400" />}
              <span className={`block mt-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 ${fileName ? 'truncate' : ''}`}>
                {fileName || 'اسحب ملف المحاضرة هنا أو اضغط للاختيار'}
              </span>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">PDF أو TXT</span>
            </button>
            <textarea
              dir="auto"
              rows={4}
              value={sourceText}
              onChange={e => setSourceText(e.target.value)}
              placeholder="أو الصق هنا شرح المحاضرة / الجزء الذي تريد أسئلة عنه"
              className={`${field} text-xs leading-relaxed`}
            />
            <div>
              <span className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">عدد الأسئلة</span>
              <div className="flex gap-1.5" role="radiogroup" aria-label="عدد الأسئلة">
                {COUNTS.map(n => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={count === n}
                    onClick={() => setCount(n)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-black tabular-nums border transition ${
                      count === n
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-indigo-400'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">لغة الأسئلة</span>
              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800" role="radiogroup" aria-label="لغة الأسئلة">
                {(
                  [
                    ['ar', 'عربي'],
                    ['en', 'English'],
                    ['same', 'لغة الملف']
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={lang === v}
                    onClick={() => setLang(v)}
                    className={`py-1.5 rounded-lg text-xs font-bold transition ${
                      lang === v ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              id="generate-essays-btn"
              onClick={() => void generate()}
              disabled={!!busy || !sourceText.trim()}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-1.5"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              توليد {count} أسئلة مقالية
            </button>
          </Panel>

          <Panel title="تحميل الورقة" icon={<Printer className="w-4 h-4" />} label="تحميل وحفظ">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {ready.length} سؤال · المجموع {total} درجة
              {missingAnswers > 0 && <span className="block text-amber-700 dark:text-amber-300 mt-0.5">{missingAnswers} سؤال بدون إجابة نموذجية</span>}
            </p>
            <label className="flex items-center justify-between gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
              إرفاق الإجابات النموذجية في آخر الورقة
              <input type="checkbox" checked={withKey} onChange={e => setWithKey(e.target.checked)} className="w-4 h-4 accent-indigo-600" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                id="essay-pdf-btn"
                disabled={!ready.length}
                onClick={() => download('pdf')}
                className="py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                PDF
              </button>
              <button
                type="button"
                id="essay-word-btn"
                disabled={!ready.length}
                onClick={() => download('word')}
                className="py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <FileDown className="w-4 h-4" />
                Word
              </button>
            </div>
            <button
              type="button"
              disabled={!ready.length}
              onClick={() => setPreview(true)}
              className="w-full py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              <Eye className="w-4 h-4" />
              معاينة الورقة
            </button>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
              <span className="block text-xs font-bold text-slate-700 dark:text-slate-300">أو أضفها لكويز محاضرة على المنصة</span>
              <select value={target} onChange={e => setTarget(e.target.value)} aria-label="المحاضرة" className={`${field} text-xs`}>
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
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                حفظ في المنصة
              </button>
            </div>
          </Panel>
        </div>
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="معاينة الورقة" onClick={() => setPreview(false)}>
          <div className="w-full max-w-3xl h-[85vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200">
              <span className="text-sm font-extrabold text-slate-900">معاينة: {paperTitle}</span>
              <button type="button" onClick={() => setPreview(false)} aria-label="إغلاق المعاينة" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <iframe title="معاينة الورقة" className="flex-1 w-full" srcDoc={buildQuizHtml(paperTitle, ready, withKey)} sandbox="" />
          </div>
        </div>
      )}
    </div>
  );
};
