import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Lecture, QuestionBankItem } from '../types';
import { parseQuestionsFromText, SAMPLE_QUESTIONS_PDF_TEXT, ParseResult } from '../utils/pdfQuestionParser';
import { extractAndStoreQuizQuestions, normalizeAiQuestions } from '../services/questionExtractionService';
import { api } from '../api';
import { clip, isCorruptQuestion, textLooksReadable } from '../utils/pdfQuestionParser';
import {
  Upload,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  X,
  Trash2,
  Loader2,
  Maximize2,
  Minimize2,
  Wand2
} from 'lucide-react';
import { useEscapeToClose } from '../hooks/useEscapeToClose';

interface QuestionUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetLecture?: Lecture | null;
}

const TYPE_LABEL = {
  multiple_choice: 'اختيار من متعدد',
  multiple_select: 'متعدد الإجابات (MSQ)',
  true_false: 'صح أم خطأ',
  essay: 'مقالي'
} as const;

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      const base64 = res.includes(',') ? res.split(',')[1] : res;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const QuestionUploadModal: React.FC<QuestionUploadModalProps> = ({ isOpen, onClose, targetLecture }) => {
  useEscapeToClose(isOpen, onClose);
  const { courses, addQuestionsToLecture, createQuizLecture } = useApp();
  const allLectures = courses.flatMap(c => c.weeks.flatMap(w => w.lectures.map(l => ({ ...l, courseTitle: c.title }))));

  const [lectureId, setLectureId] = useState<string>(targetLecture?.id || allLectures[0]?.id || '__CREATE_NEW__');
  const [newCourseTitle, setNewCourseTitle] = useState('كويزات ومقررات الأسئلة');
  const [newLectureTitle, setNewLectureTitle] = useState('');
  const [text, setText] = useState('');
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [fileError, setFileError] = useState('');
  const [result, setResult] = useState<ParseResult | null>(null);
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [saved, setSaved] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [genCount, setGenCount] = useState(10);
  const [genTypes, setGenTypes] = useState<QuestionBankItem['type'][]>(['multiple_choice', 'multiple_select']);
  const [genLang, setGenLang] = useState<'ar' | 'en' | 'same'>('ar');
  const [generated, setGenerated] = useState(0);

  useEffect(() => {
    if (isOpen) {
      if (targetLecture?.id) {
        setLectureId(targetLecture.id);
      } else if (allLectures.length > 0) {
        setLectureId(allLectures[0].id);
      } else {
        setLectureId('__CREATE_NEW__');
      }
    }
  }, [isOpen, targetLecture?.id, allLectures.length]);

  if (!isOpen) return null;

  const runParse = (source: string) => {
    if (!source.trim()) {
      setResult(null);
      setQuestions([]);
      return;
    }
    const res = parseQuestionsFromText(source, lectureId);
    const clean = res.questions.filter(q => !isCorruptQuestion(q));
    setResult({ ...res, questions: clean });
    setQuestions(clean);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setFileName(file.name);
    setSourceFile(file);
    setFileError('');
    setResult(null);
    setQuestions([]);
    setBusy(true);
    setStatusMsg('جارٍ قراءة الملف...');

    try {
      const res = await extractAndStoreQuizQuestions(file, lectureId === '__CREATE_NEW__' ? 'temp' : lectureId, undefined, setStatusMsg);
      if (res.text) setText(res.text);
      if (res.success) {
        setQuestions(res.questions);
        setStatusMsg(res.message || '');
      } else {
        setFileError(res.error || 'تعذر استخراج الأسئلة من الملف.');
        setStatusMsg('');
      }
    } catch {
      setFileError('تعذر قراءة الملف. تأكد أنه PDF أو صورة أو TXT سليم.');
      setStatusMsg('');
    } finally {
      setBusy(false);
    }
  };

  /** Sends the text in the box to Gemini; falls back to the rule-based parser. */
  const runAiParseWithBase64 = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setFileError('');
    setStatusMsg('جارٍ تحليل النص بالذكاء الاصطناعي...');
    try {
      const res = await api.parseQuestionsAI({ text });
      const qs = res.ai && res.questions?.length ? normalizeAiQuestions(res.questions, lectureId) : [];
      if (qs.length) {
        setResult(null);
        setQuestions(qs);
        setStatusMsg(`تم استخراج ${qs.length} سؤالاً بالذكاء الاصطناعي.`);
      } else {
        runParse(text);
        setStatusMsg('');
        if (res.error || res.message) setFileError(`الذكاء الاصطناعي غير متاح الآن، تم التحليل المحلي. (${res.error || res.message})`);
      }
    } catch (err: any) {
      runParse(text);
      setStatusMsg('');
      setFileError(`الذكاء الاصطناعي غير متاح الآن، تم التحليل المحلي. (${err?.message || err})`);
    } finally {
      setBusy(false);
    }
  };

  /** Writes new questions about the file's content (for lecture notes / solutions that contain no questions). */
  const generate = async () => {
    if (busy || !genTypes.length) return;
    const useText = text.trim() && textLooksReadable(text);
    if (!useText && !sourceFile) return setFileError('ارفع ملف المحاضرة أو الصق نصها في المربع أولاً.');
    if (!useText && sourceFile && sourceFile.size > 3 * 1024 * 1024) {
      return setFileError('الملف كبير على التوليد المباشر (أكثر من 3MB). الصق جزء الشرح المطلوب في المربع ثم اضغط توليد.');
    }
    setBusy(true);
    setFileError('');
    setStatusMsg(`جارٍ كتابة ${genCount} سؤالاً من محتوى الملف بالذكاء الاصطناعي...`);
    try {
      const body = useText
        ? { text }
        : {
            fileBase64: await fileToBase64(sourceFile!),
            mimeType: sourceFile!.type || (sourceFile!.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/png')
          };
      const res = await api.generateQuestionsAI({ ...body, count: genCount, types: genTypes, language: genLang });
      const qs = normalizeAiQuestions(res.questions || [], lectureId === '__CREATE_NEW__' ? 'temp' : lectureId);
      if (!qs.length) throw new Error('لم يرجع الذكاء الاصطناعي أسئلة صالحة، حاول مرة أخرى.');
      setResult(null);
      // Replaces leftovers of a failed extraction (sentences read as essays) unless the doctor asked for essays
      setQuestions(prev => [...(genTypes.includes('essay') ? prev : prev.filter(q => q.type !== 'essay')), ...qs]);
      setStatusMsg('');
      setFileError('');
      setGenerated(qs.length);
    } catch (err: any) {
      setStatusMsg('');
      setFileError(err?.message || 'تعذّر توليد الأسئلة.');
    } finally {
      setBusy(false);
    }
  };
  const toggleGenType = (t: QuestionBankItem['type']) =>
    setGenTypes(ts => (ts.includes(t) ? ts.filter(x => x !== t) : [...ts, t]));

  /** MCQ <-> MSQ for a choice question. */
  const toggleMulti = (id: string) =>
    setQuestions(qs =>
      qs.map(q => {
        if (q.id !== id || q.type === 'essay' || q.type === 'true_false') return q;
        const idxs = (q.correctOptionIndexes || [q.correctOptionIndex ?? -1]).filter(x => x >= 0);
        if (q.type === 'multiple_select') {
          const first = idxs[0] ?? -1;
          return { ...q, type: 'multiple_choice' as const, correctOptionIndex: first, correctOptionIndexes: [first] };
        }
        return { ...q, type: 'multiple_select' as const, correctOptionIndexes: idxs.length ? idxs : [-1] };
      })
    );

  const setCorrect = (id: string, idx: number) =>
    setQuestions(qs =>
      qs.map(q => {
        if (q.id !== id) return q;
        if (q.type === 'multiple_select') {
          const curr = (q.correctOptionIndexes || (typeof q.correctOptionIndex === 'number' && q.correctOptionIndex >= 0 ? [q.correctOptionIndex] : [])).filter(x => x >= 0);
          const next = curr.includes(idx) ? curr.filter(x => x !== idx) : [...curr, idx].sort((a, b) => a - b);
          const firstIdx = next.length > 0 ? next[0] : -1;
          return {
            ...q,
            correctOptionIndexes: next.length > 0 ? next : [-1],
            correctOptionIndex: firstIdx,
            needsReview: next.length > 0 ? undefined : true
          };
        }
        return { ...q, correctOptionIndex: idx, correctOptionIndexes: [idx], needsReview: undefined };
      })
    );

  const remove = (id: string) => setQuestions(qs => qs.filter(q => q.id !== id));

  const unresolved = questions.filter(q => q.type !== 'essay' && (q.correctOptionIndex === undefined || q.correctOptionIndex === -1 || q.correctOptionIndex < 0)).length;

  const runAiParse = async () => {
    await runAiParseWithBase64();
  };

  const save = async () => {
    if (!questions.length || unresolved > 0 || busy) return;
    setBusy(true);
    setStatusMsg('جارٍ الحفظ وبناء الكويز...');
    try {
      if (lectureId === '__CREATE_NEW__') {
        const title = newLectureTitle.trim() || fileName.replace(/\.[^/.]+$/, '') || 'كويز جديد من ملف الأسئلة';
        const id = createQuizLecture(newCourseTitle, title, questions);
        if (!id) throw new Error('create failed');
      } else {
        addQuestionsToLecture(
          lectureId,
          questions.map(q => ({ ...q, lectureId }))
        );
      }
      setSaved(true);
      setStatusMsg('');
      setTimeout(() => {
        setSaved(false);
        setQuestions([]);
        setResult(null);
        setText('');
        setFileName('');
        onClose();
      }, 1000);
    } catch {
      setFileError('تعذر حفظ الأسئلة. حاول مرة أخرى.');
      setStatusMsg('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden animate-pop transition-all flex flex-col ${
        isExpanded ? 'fixed inset-0 z-50 rounded-none w-screen h-screen my-0' : 'rounded-2xl max-w-4xl w-full my-8'
      }`}>
        <div className="bg-slate-900 dark:bg-slate-950 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">رفع ملف PDF/TXT وتحويله إلى كويز MCQ / MSQ</h3>
              <p className="text-[12px] text-slate-400">استخراج الأسئلة الموجودة في الملف، أو توليد أسئلة جديدة من شرح المحاضرة</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsExpanded(v => !v)}
              className="p-1.5 rounded-lg bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 text-slate-300 transition"
              title={isExpanded ? 'تصغير النافذة' : 'توسيع النافذة بالكامل'}
              aria-label="توسيع النافذة"
            >
              {isExpanded ? <Minimize2 className="w-5 h-5 text-amber-400" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <button onClick={onClose} aria-label="إغلاق" className="p-1.5 rounded-lg bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 text-slate-300">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className={`p-5 sm:p-6 space-y-5 overflow-y-auto ${isExpanded ? 'flex-1' : 'max-h-[75vh]'}`}>
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-900 dark:text-slate-100">المحاضرة / الكويز المستهدف:</label>
            <select
              value={lectureId}
              onChange={e => setLectureId(e.target.value)}
              className="w-full text-sm p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-300 dark:border-slate-600 rounded-xl font-bold"
            >
              <option value="__CREATE_NEW__">✨ + إنشاء كويز ومحاضرة جديدة بملف الأسئلة تلقائياً</option>
              {allLectures.map(l => (
                <option key={l.id} value={l.id}>
                  {l.courseTitle} - {l.title} ({l.questionBank?.length || 0} سؤال حالياً)
                </option>
              ))}
            </select>

            {lectureId === '__CREATE_NEW__' && (
              <div className="grid sm:grid-cols-2 gap-3 p-3 bg-indigo-50/70 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-xl text-xs">
                <div>
                  <label className="block font-bold text-indigo-950 dark:text-indigo-200 mb-1">اسم المقرر / المادة:</label>
                  <input
                    type="text"
                    value={newCourseTitle}
                    onChange={e => setNewCourseTitle(e.target.value)}
                    placeholder="مثال: أسس البرمجة الهيكلية"
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-700 rounded-lg text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-indigo-950 dark:text-indigo-200 mb-1">عنوان الكويز / المحاضرة:</label>
                  <input
                    type="text"
                    value={newLectureTitle}
                    onChange={e => setNewLectureTitle(e.target.value)}
                    placeholder={fileName ? fileName.replace(/\.[^/.]+$/, '') : 'كويز الأسبوع الأول'}
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-700 rounded-lg text-xs font-bold"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <label className="md:col-span-2 border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-indigo-400 rounded-2xl p-6 text-center bg-slate-50 dark:bg-slate-800/40 transition-colors relative cursor-pointer block">
              <input type="file" accept=".pdf,.txt,image/*,application/pdf,text/plain" onChange={handleFile} className="sr-only" />
              {busy ? (
                <Loader2 className="w-8 h-8 text-indigo-600 dark:text-indigo-400 mx-auto mb-2 animate-spin" />
              ) : (
                <FileText className="w-8 h-8 text-indigo-600 dark:text-indigo-400 mx-auto mb-2" />
              )}
              <div className="font-bold text-sm text-slate-800 dark:text-slate-200">
                {busy ? 'جارٍ المسح الضوئي (OCR) والتحليل...' : fileName || 'رفع مستند PDF أو صورة ورقة امتحانية (OCR)'}
              </div>
              <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1">
                يدعم الماسح الضوئي (OCR) لتحويل الصور والمستندات الممسوحة إلى أسئلة الاختيار من متعدد (MCQ / MSQ).
              </p>
            </label>

            <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/25 rounded-2xl p-4 flex flex-col justify-between gap-3">
              <div className="text-xs">
                <div className="font-bold text-indigo-950 dark:text-indigo-100 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  نموذج تجريبي
                </div>
                <p className="text-indigo-800 dark:text-indigo-300 mt-1 text-[12px] leading-relaxed">تحميل أسئلة تجريبية سريعة بالصيغة المقبولة.</p>
              </div>
              <button
                type="button"
                id="load-sample-questions-btn"
                disabled={busy}
                onClick={() => {
                  setText(SAMPLE_QUESTIONS_PDF_TEXT);
                  setFileName('نموذج_أسئلة.txt');
                  runParse(SAMPLE_QUESTIONS_PDF_TEXT);
                }}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs cursor-pointer"
              >
                تحميل نموذج
              </button>
            </div>
          </div>

          {statusMsg && (
            <div className="flex items-center gap-2.5 text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/25 rounded-xl p-3 animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin shrink-0 text-indigo-600 dark:text-indigo-400" />
              <div className="flex-1 font-bold">{statusMsg}</div>
            </div>
          )}

          {fileError && (
            <div className="flex items-start gap-2 text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="flex-1 leading-relaxed">{fileError}</div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <label className="font-bold text-slate-900 dark:text-slate-100">النص المستخرج / المحرر:</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={runAiParse}
                  disabled={busy || !text.trim()}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center gap-1 text-[11px] shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  تحليل بالذكاء الاصطناعي
                </button>
                <button
                  type="button"
                  onClick={() => text.trim() && runParse(text)}
                  className="text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 dark:hover:text-indigo-200 font-bold"
                >
                  إعادة التحليل
                </button>
              </div>
            </div>
            <textarea
              dir="auto"
              rows={6}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={'1. ما هي كفاءة البحث الثنائي؟\nأ) O(1)\nب) O(log n)\nج) O(n)\nد) O(n^2)\nالإجابة: ب\n\n2. اشرح الفرق بين المصفوفة والقائمة المترابطة.\n[سؤال مقالي]'}
              className="w-full text-sm p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-300 dark:border-slate-600 rounded-xl font-mono leading-relaxed"
            />
          </div>

          {(text.trim() || sourceFile) && (
            <section
              aria-labelledby="gen-title"
              className={`rounded-2xl border p-4 space-y-3 ${
                questions.filter(q => q.type !== 'essay').length === 0
                  ? 'border-indigo-300 dark:border-indigo-500/40 bg-indigo-50/70 dark:bg-indigo-500/10'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40'
              }`}
            >
              <div>
                <h4 id="gen-title" className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Wand2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  توليد أسئلة من محتوى الملف
                </h4>
                <p className="text-[12px] text-slate-600 dark:text-slate-400 mt-0.5">
                  للملفات التي فيها شرح أو حلول بدون أسئلة: يكتب الذكاء الاصطناعي أسئلة جديدة عن المحتوى، وتراجعها قبل الحفظ.
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-3 text-xs">
                <fieldset>
                  <legend className="font-bold text-slate-700 dark:text-slate-300 mb-1">نوع الأسئلة</legend>
                  <div className="flex flex-wrap gap-1.5">
                    {(['multiple_choice', 'multiple_select', 'true_false', 'essay'] as const).map(t => (
                      <label
                        key={t}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border cursor-pointer ${
                          genTypes.includes(t)
                            ? 'border-indigo-500 bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 font-bold'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <input type="checkbox" checked={genTypes.includes(t)} onChange={() => toggleGenType(t)} className="accent-indigo-600" />
                        {t === 'multiple_choice' ? 'MCQ' : t === 'multiple_select' ? 'MSQ' : TYPE_LABEL[t]}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="block">
                  <span className="block font-bold text-slate-700 dark:text-slate-300 mb-1">العدد</span>
                  <select
                    value={genCount}
                    onChange={e => setGenCount(Number(e.target.value))}
                    className="p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-bold"
                  >
                    {[5, 10, 15, 20, 30].map(n => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="block font-bold text-slate-700 dark:text-slate-300 mb-1">اللغة</span>
                  <select
                    value={genLang}
                    onChange={e => setGenLang(e.target.value as 'ar' | 'en' | 'same')}
                    className="p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-bold"
                  >
                    <option value="ar">عربي</option>
                    <option value="en">English</option>
                    <option value="same">نفس لغة الملف</option>
                  </select>
                </label>
                <button
                  type="button"
                  id="generate-questions-btn"
                  onClick={() => void generate()}
                  disabled={busy || !genTypes.length}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold flex items-center gap-1.5"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  توليد الأسئلة
                </button>
              </div>
              {generated > 0 && !busy && (
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  تم توليد {generated} سؤالاً وإضافتها للقائمة بالأسفل. راجع الإجابات الصحيحة قبل الحفظ.
                </p>
              )}
            </section>
          )}

          {(result || questions.length > 0) && (
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-slate-900 dark:text-slate-100">الأسئلة المستخرجة ({questions.length}):</span>
                {result?.usedSectionHeading && (
                  <span className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/25 px-2 py-0.5 rounded-full font-bold">
                    قُرئ قسم "الأسئلة" فقط
                  </span>
                )}
                {unresolved > 0 && (
                  <span className="bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/25 px-2 py-0.5 rounded-full font-bold">
                    {unresolved} سؤال بلا إجابة صحيحة، اضغط الخيار الصحيح
                  </span>
                )}
              </div>

              {!questions.length && text.trim() && (
                <p className="text-sm text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 rounded-xl p-4">
                  تأكد من ترقيم الأسئلة (مثل 1. أو س1:) وإضافة الاختيارات (أ) ب) ج) د)) مع سطر "الإجابة: ب".
                </p>
              )}

              {(() => {
                const renderCard = (q: QuestionBankItem, i: number) => (
                  <div key={q.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-sm space-y-2.5">
                    <div className="flex items-start gap-2">
                      <span className="w-6 h-6 rounded-md bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                        {i + 1}
                      </span>
                      <span dir="auto" className="font-bold text-slate-900 dark:text-slate-100 flex-1 break-words min-w-0 text-start">{clip(q.prompt)}</span>
                      {(q.type === 'multiple_choice' || q.type === 'multiple_select') && (
                        <button
                          type="button"
                          onClick={() => toggleMulti(q.id)}
                          className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-md border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-indigo-400"
                          title="تحويل بين اختيار واحد (MCQ) ومتعدد الإجابات (MSQ)"
                        >
                          {q.type === 'multiple_select' ? '← MCQ' : '← MSQ'}
                        </button>
                      )}
                      <span className="shrink-0 text-[12px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/25">
                        {TYPE_LABEL[q.type]}
                      </span>
                      <button
                        onClick={() => remove(q.id)}
                        aria-label="حذف السؤال"
                        className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
  
                    {q.options.length > 0 && (
                      <div className="grid sm:grid-cols-2 gap-1.5">
                        {q.options.map((opt, k) => {
                          const isCorrect = q.type === 'multiple_select'
                            ? (q.correctOptionIndexes || [q.correctOptionIndex]).includes(k)
                            : k === q.correctOptionIndex;
                          return (
                            <button
                              key={k}
                              type="button"
                              onClick={() => setCorrect(q.id, k)}
                              className={`text-start p-2 rounded-lg text-xs border transition-colors ${
                                isCorrect
                                  ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-400 text-emerald-900 dark:text-emerald-200 font-bold'
                                  : (q.correctOptionIndex === undefined || q.correctOptionIndex === -1 || q.correctOptionIndex < 0)
                                  ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/25 text-slate-800 dark:text-slate-200 hover:border-emerald-400'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-300 dark:hover:border-emerald-500/40'
                              }`}
                            >
                              <bdi dir="auto">{clip(opt, 300)}</bdi>
                              {isCorrect && <span className="ms-1.5 font-black">✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {q.explanation && (
                      <div className="text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 p-2 rounded-md border border-slate-200 dark:border-slate-700">
                        <strong>الشرح: </strong>
                        {q.explanation}
                      </div>
                    )}
                  </div>
  );
                const choice = questions.filter(q => q.type !== 'essay');
                const essays = questions.filter(q => q.type === 'essay');
                return (
                  <>
                    {choice.map((q, i) => renderCard(q, i))}
                    {essays.length > 0 && (
                      <div className="pt-3 mt-1 border-t border-dashed border-slate-300 dark:border-slate-600 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-bold text-slate-900 dark:text-slate-100">الأسئلة المقالية ({essays.length})</span>
                          <button
                            type="button"
                            onClick={() => setQuestions(qs => qs.filter(q => q.type !== 'essay'))}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 font-bold"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            حذف كل المقالي
                          </button>
                        </div>
                        {essays.map((q, i) => renderCard(q, choice.length + i))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/40 p-4 sm:px-6 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {questions.length
              ? unresolved
                ? 'حدّد الإجابات الصحيحة الناقصة لتفعيل الحفظ'
                : `جاهز لإضافة ${questions.length} سؤال`
              : 'اختر ملف PDF أو TXT لاستخراج الأسئلة تلقائياً'}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold">
              إلغاء
            </button>
            <button
              id="confirm-save-question-bank-btn"
              disabled={!questions.length || unresolved > 0 || busy}
              onClick={() => void save()}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              {saved ? 'تم الحفظ' : 'حفظ في بنك الأسئلة'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
