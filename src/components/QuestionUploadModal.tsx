import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Lecture, QuestionBankItem } from '../types';
import { parseQuestionsFromText, SAMPLE_QUESTIONS_PDF_TEXT, ParseResult } from '../utils/pdfQuestionParser';
import {
  Upload,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  X,
  Trash2,
  Loader2
} from 'lucide-react';

interface QuestionUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetLecture?: Lecture | null;
}

const TYPE_LABEL = { multiple_choice: 'اختيار من متعدد', true_false: 'صح أم خطأ', essay: 'مقالي' } as const;

export const QuestionUploadModal: React.FC<QuestionUploadModalProps> = ({ isOpen, onClose, targetLecture }) => {
  const { courses, addQuestionsToLecture } = useApp();
  const allLectures = courses.flatMap(c => c.weeks.flatMap(w => w.lectures));

  const [lectureId, setLectureId] = useState<string>(targetLecture?.id || allLectures[0]?.id || '');
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [fileError, setFileError] = useState('');
  const [result, setResult] = useState<ParseResult | null>(null);
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [saved, setSaved] = useState(false);
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<{ page: number; pages: number } | null>(null);

  useEffect(() => {
    if (isOpen && targetLecture?.id) setLectureId(targetLecture.id);
  }, [isOpen, targetLecture?.id]);

  if (!isOpen) return null;

  const runParse = (source: string) => {
    const res = parseQuestionsFromText(source, lectureId);
    setResult(res);
    setQuestions(res.questions);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setFileName(file.name);
    setFileError('');
    setOcrFile(null);
    setBusy(true);
    try {
      let content = '';
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (isPdf) {
        const { extractTextFromPdf } = await import('../utils/pdfText');
        content = (await extractTextFromPdf(file)).text;
      } else {
        content = (await file.text()).normalize('NFKC');
      }
      setText(content);
      runParse(content);
      if (!content.trim()) {
        if (isPdf) {
          // Scanned PDF: no text layer, so read the page images automatically.
          setOcrFile(file);
          setBusy(false);
          await runOcr(file);
          return;
        }
        setFileError('لم يُستخرج أي نص. الصق الأسئلة يدوياً.');
      }
    } catch {
      setFileError('تعذر قراءة الملف. تأكد أنه PDF أو TXT سليم وغير محمي بكلمة مرور.');
    } finally {
      setBusy(false);
    }
  };

  const runOcr = async (fileArg?: File) => {
    const source = fileArg ?? ocrFile;
    if (!source) return;
    setFileError('');
    setOcrBusy(true);
    setOcrProgress({ page: 0, pages: 0 });
    try {
      const { extractTextViaOcr } = await import('../utils/pdfText');
      const { text: ocrText } = await extractTextViaOcr(source, info => setOcrProgress(info));
      if (!ocrText.trim()) {
        setFileError('القراءة الضوئية لم تستخرج نصاً واضحاً. جرّب صورة أوضح أو الصق الأسئلة يدوياً.');
      } else {
        setText(ocrText);
        runParse(ocrText);
      }
    } catch {
      setFileError('تعذّرت القراءة الضوئية. جرّب مرة أخرى أو الصق الأسئلة يدوياً.');
    } finally {
      setOcrBusy(false);
      setOcrProgress(null);
    }
  };

  const setCorrect = (id: string, idx: number) =>
    setQuestions(qs => qs.map(q => (q.id === id ? { ...q, correctOptionIndex: idx, needsReview: undefined } : q)));

  const remove = (id: string) => setQuestions(qs => qs.filter(q => q.id !== id));

  const unresolved = questions.filter(q => q.type !== 'essay' && q.correctOptionIndex === undefined).length;

  const save = () => {
    if (!questions.length || !lectureId || unresolved > 0) return;
    // Re-tag with the chosen lecture in case it was changed after parsing
    addQuestionsToLecture(lectureId, questions.map(q => ({ ...q, lectureId })));
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setQuestions([]);
      setResult(null);
      setText('');
      setFileName('');
      onClose();
    }, 1200);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden my-8 animate-pop">
        <div className="bg-slate-900 dark:bg-slate-950 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">رفع ملف الأسئلة وتحويله إلى كويز</h3>
              <p className="text-[12px] text-slate-400">PDF أو TXT، ثم راجع الأسئلة قبل الحفظ</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="إغلاق" className="p-1.5 rounded-lg bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-900 dark:text-slate-100">المحاضرة التي ستُضاف أسئلتها:</label>
            <select
              value={lectureId}
              onChange={e => setLectureId(e.target.value)}
              className="w-full text-sm p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-300 dark:border-slate-600 rounded-xl"
            >
              {allLectures.map(l => (
                <option key={l.id} value={l.id}>
                  {l.title} ({l.questionBank?.length || 0} سؤال حالياً)
                </option>
              ))}
            </select>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <label className="md:col-span-2 border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-indigo-400 rounded-2xl p-6 text-center bg-slate-50 dark:bg-slate-800/40 transition-colors relative cursor-pointer block">
              <input type="file" accept=".pdf,.txt,application/pdf,text/plain" onChange={handleFile} className="sr-only" />
              {busy ? (
                <Loader2 className="w-8 h-8 text-indigo-600 dark:text-indigo-400 mx-auto mb-2 animate-spin" />
              ) : (
                <FileText className="w-8 h-8 text-indigo-600 dark:text-indigo-400 mx-auto mb-2" />
              )}
              <div className="font-bold text-sm text-slate-800 dark:text-slate-200">
                {busy ? 'جارٍ استخراج النص...' : fileName || 'اضغط لاختيار ملف الأسئلة'}
              </div>
              <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1">
                الأفضل ملف أسئلة منفصل عن الشرح. يمكن ملف واحد إذا كان للأسئلة عنوان واضح مثل "الأسئلة".
              </p>
            </label>

            <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/25 rounded-2xl p-4 flex flex-col justify-between gap-3">
              <div className="text-xs">
                <div className="font-bold text-indigo-950 dark:text-indigo-100 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  تجربة سريعة
                </div>
                <p className="text-indigo-800 dark:text-indigo-300 mt-1 text-[12px] leading-relaxed">نص أسئلة جاهز (اختيار، صح/خطأ، مقالي).</p>
              </div>
              <button
                type="button"
                id="load-sample-questions-btn"
                onClick={() => {
                  setText(SAMPLE_QUESTIONS_PDF_TEXT);
                  setFileName('نموذج_أسئلة.txt');
                  runParse(SAMPLE_QUESTIONS_PDF_TEXT);
                }}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs"
              >
                تحميل نموذج
              </button>
            </div>
          </div>

          {fileError && (
            <div className="flex items-start gap-2 text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {fileError}
            </div>
          )}

          {ocrFile && !ocrBusy && (
            <button
              type="button"
              onClick={() => runOcr()}
              className="w-full py-2.5 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-500/25 text-indigo-800 dark:text-indigo-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              قراءة ضوئية (OCR) — تستغرق وقتاً حسب عدد الصفحات
            </button>
          )}
          {ocrBusy && (
            <div className="flex items-center gap-2 text-sm text-indigo-800 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/25 rounded-xl p-3">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              {ocrProgress?.pages
                ? `جارٍ التعرف الضوئي على الصفحة ${ocrProgress.page} من ${ocrProgress.pages}...`
                : 'جارٍ تجهيز محرك القراءة الضوئية...'}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="font-bold text-slate-900 dark:text-slate-100">النص المستخرج (يمكنك تعديله ثم إعادة التحليل):</label>
              <button
                type="button"
                onClick={() => text.trim() && runParse(text)}
                className="text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 dark:hover:text-indigo-200 font-bold"
              >
                إعادة التحليل
              </button>
            </div>
            <textarea
              rows={6}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={'1. ما هي كفاءة البحث الثنائي؟\nأ) O(1)\nب) O(log n)\nج) O(n)\nد) O(n^2)\nالإجابة: ب\n\n2. اشرح الفرق بين المصفوفة والقائمة المترابطة.\n[سؤال مقالي]'}
              className="w-full text-sm p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-300 dark:border-slate-600 rounded-xl font-mono leading-relaxed"
            />
          </div>

          {result && (
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-slate-900 dark:text-slate-100">الأسئلة المستخرجة: {questions.length}</span>
                {result.usedSectionHeading && (
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

              {!questions.length && (
                <p className="text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4">
                  لم يُعثر على أسئلة مرقمة. رقّم الأسئلة (1. 2. 3.) واكتب الخيارات (أ ب ج د) وسطر "الإجابة: ب".
                </p>
              )}

              {questions.map((q, i) => (
                <div key={q.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-sm space-y-2.5">
                  <div className="flex items-start gap-2">
                    <span className="w-6 h-6 rounded-md bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                      {i + 1}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 flex-1">{q.prompt}</span>
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
                        const correct = k === q.correctOptionIndex;
                        return (
                          <button
                            key={k}
                            type="button"
                            onClick={() => setCorrect(q.id, k)}
                            className={`text-start p-2 rounded-lg text-xs border transition-colors ${
                              correct
                                ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-400 text-emerald-900 dark:text-emerald-200 font-bold'
                                : q.correctOptionIndex === undefined
                                ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/25 text-slate-800 dark:text-slate-200 hover:border-emerald-400'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-300 dark:hover:border-emerald-500/40'
                            }`}
                          >
                            {opt}
                            {correct && <span className="ms-1.5">✓</span>}
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
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/40 p-4 sm:px-6 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {questions.length
              ? unresolved
                ? 'حدّد الإجابات الصحيحة الناقصة لتفعيل الحفظ'
                : `جاهز لإضافة ${questions.length} سؤال`
              : 'ارفع ملفاً أو حمّل النموذج'}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold">
              إلغاء
            </button>
            <button
              id="confirm-save-question-bank-btn"
              disabled={!questions.length || unresolved > 0}
              onClick={save}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
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
