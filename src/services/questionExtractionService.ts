import { api, AiQuestion } from '../api';
import { extractTextFromPdf, extractTextViaOcr, withTimeout } from '../utils/pdfText';
import { isCorruptQuestion, parseQuestionsFromText, textLooksReadable } from '../utils/pdfQuestionParser';
import { QuestionBankItem, QuestionType } from '../types';

export interface ExtractionResult {
  success: boolean;
  questions: QuestionBankItem[];
  /** Where the questions came from, for the status message. */
  source?: 'ai' | 'text' | 'ocr';
  /** Extracted document text (for the editable text box), when read locally. */
  text?: string;
  message?: string;
  error?: string;
}

/** Gemini accepts ~20 MB of inline data per request; base64 adds a third. */
const AI_MAX_BYTES = 14 * 1024 * 1024;
const LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح'];
const LETTER_PREFIX = /^\s*[\(\[]?(?:[أابجدهـوزحa-hA-H]|[1-8])[\)\.\:\-\]]\s*/;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result || '');
      resolve(res.includes(',') ? res.split(',')[1] : res);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const newId = (lectureId: string, n: number) =>
  `qb_${lectureId}_${Date.now()}_${n}_${Math.random().toString(36).slice(2, 6)}`;

/** Turns Gemini's answer into bank items with a consistent shape (letters, indexes, MSQ). */
export function normalizeAiQuestions(raw: AiQuestion[], lectureId: string): QuestionBankItem[] {
  const out: QuestionBankItem[] = [];
  raw.forEach(r => {
    const prompt = String(r?.prompt || '').trim();
    if (!prompt) return;
    let options = (Array.isArray(r.options) ? r.options : []).map(o => String(o ?? '').trim()).filter(Boolean);
    let type: QuestionType = (['multiple_choice', 'multiple_select', 'true_false', 'essay'] as const).includes(r.type as any)
      ? (r.type as QuestionType)
      : options.length ? 'multiple_choice' : 'essay';
    if (type === 'essay') options = [];
    if (type !== 'essay' && options.length < 2) {
      type = 'essay';
      options = [];
    }
    if (type === 'true_false' && options.length !== 2) type = 'multiple_choice';

    const valid = (i: unknown): i is number => typeof i === 'number' && Number.isInteger(i) && i >= 0 && i < options.length;
    let idxs = (Array.isArray(r.correctOptionIndexes) ? r.correctOptionIndexes : []).filter(valid);
    if (!idxs.length && valid(r.correctOptionIndex)) idxs = [r.correctOptionIndex];
    idxs = [...new Set(idxs)].sort((a, b) => a - b);
    if (type === 'multiple_select' && idxs.length === 1) type = 'multiple_choice';
    if (type === 'multiple_choice' && idxs.length > 1) type = 'multiple_select';
    if (type !== 'multiple_select' && idxs.length > 1) idxs = [idxs[0]];

    // Consistent "أ) ..." labels so the doctor and students read the same letters.
    const labelled = options.map((o, i) => `${LETTERS[i] || i + 1}) ${o.replace(LETTER_PREFIX, '').trim()}`);
    const needsReview = type !== 'essay' && idxs.length === 0;
    const q: QuestionBankItem = {
      id: newId(lectureId, out.length + 1),
      lectureId,
      questionNumber: out.length + 1,
      type,
      prompt,
      options: labelled,
      correctOptionIndex: type === 'essay' ? undefined : idxs[0] ?? -1,
      correctOptionIndexes: type === 'essay' ? undefined : idxs.length ? idxs : [-1],
      correctAnswerText: idxs.map(i => LETTERS[i] || String(i + 1)).join('، '),
      explanation: String(r.explanation || '').trim(),
      points: 1,
      needsReview: needsReview || undefined
    };
    if (!isCorruptQuestion(q)) out.push(q);
  });
  return out;
}

async function ocrImage(file: File, onProgress?: (msg: string) => void): Promise<string> {
  try {
    onProgress?.('جارٍ قراءة الصورة ضوئياً (OCR)...');
    const { createWorker } = await import('tesseract.js');
    const worker = await withTimeout(createWorker(['ara', 'eng']), 40_000, 'OCR start');
    try {
      const url = URL.createObjectURL(file);
      const { data } = await worker.recognize(url);
      URL.revokeObjectURL(url);
      return (data.text || '').normalize('NFKC');
    } finally {
      await worker.terminate();
    }
  } catch (err) {
    console.error('OCR image error:', err);
    return '';
  }
}

/** Local path: text layer -> OCR for scanned pages -> rule-based parser. */
async function extractLocally(
  file: File,
  kind: 'pdf' | 'image' | 'text',
  lectureId: string,
  onProgress?: (msg: string) => void
): Promise<ExtractionResult> {
  let text = '';
  let source: ExtractionResult['source'] = 'text';

  if (kind === 'pdf') {
    onProgress?.('جارٍ قراءة نص ملف الـ PDF...');
    text = (await extractTextFromPdf(file).catch(() => ({ text: '', pages: 0 }))).text;
    if (!textLooksReadable(text)) {
      source = 'ocr';
      onProgress?.('الملف ممسوح ضوئياً، جارٍ تشغيل القراءة الضوئية (OCR)...');
      text = (
        await extractTextViaOcr(file, info => onProgress?.(`القراءة الضوئية: صفحة ${info.page} من ${info.pages}...`))
      ).text;
    }
  } else if (kind === 'image') {
    source = 'ocr';
    text = await ocrImage(file, onProgress);
  } else {
    text = (await file.text()).normalize('NFKC');
  }

  if (!textLooksReadable(text)) {
    return {
      success: false,
      questions: [],
      error: 'تعذّر قراءة نص واضح من الملف. جرّب ملفاً أوضح أو الصق الأسئلة كنص.'
    };
  }

  onProgress?.('جارٍ تحليل الأسئلة والاختيارات...');
  const questions = parseQuestionsFromText(text, lectureId).questions.filter(q => !isCorruptQuestion(q));
  return {
    success: questions.length > 0,
    questions,
    source,
    text,
    error: questions.length
      ? undefined
      : 'لم نجد أسئلة جاهزة في الملف (يبدو شرحاً أو حلاً). اضغط "توليد الأسئلة" بالأسفل لكتابة أسئلة MCQ/MSQ من المحتوى، أو عدّل النص في المربع ثم اضغط "إعادة التحليل".'
  };
}

/**
 * PDF / image / TXT -> question bank items.
 * 1) Gemini on the server reads the file itself (Arabic, scanned pages, MSQ, answer keys).
 * 2) If AI is unavailable or finds nothing, the browser extracts the text (or OCRs it) and parses it.
 * Nothing is saved here; the caller adds the reviewed questions to the lecture.
 */
export async function extractAndStoreQuizQuestions(
  file: File,
  lectureId: string,
  _courseId?: string,
  onProgress?: (msg: string) => void
): Promise<ExtractionResult> {
  try {
    const name = file.name.toLowerCase();
    const kind: 'pdf' | 'image' | 'text' =
      file.type === 'application/pdf' || name.endsWith('.pdf')
        ? 'pdf'
        : file.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp)$/.test(name)
        ? 'image'
        : 'text';

    let aiError = '';
    if (kind !== 'text' ? file.size <= AI_MAX_BYTES : file.size <= 400_000) {
      try {
        onProgress?.('جارٍ قراءة الملف بالذكاء الاصطناعي واستخراج الأسئلة...');
        let pdfText = '';
        if (kind === 'pdf') {
          try {
            const extracted = await extractTextFromPdf(file);
            if (extracted.text && textLooksReadable(extracted.text)) {
              pdfText = extracted.text;
            }
          } catch {
            /* ignore pdf extraction error, will fall back to base64 */
          }
        }

        const res =
          kind === 'text'
            ? await api.parseQuestionsAI({ text: (await file.text()).normalize('NFKC') })
            : pdfText
            ? await api.parseQuestionsAI({ text: pdfText })
            : await api.parseQuestionsAI({
                fileBase64: await fileToBase64(file),
                mimeType: kind === 'pdf' ? 'application/pdf' : file.type || 'image/png'
              });
        if (res.ai && res.questions?.length) {
          const questions = normalizeAiQuestions(res.questions, lectureId);
          if (questions.length) {
            return {
              success: true,
              questions,
              source: 'ai',
              message: `تم استخراج ${questions.length} سؤالاً بالذكاء الاصطناعي. راجع الإجابات الصحيحة قبل الحفظ.`
            };
          }
        }
        aiError = res.error || res.message || '';
      } catch (e: any) {
        aiError = String(e?.message || e);
        onProgress?.('الذكاء الاصطناعي لم يرد في الوقت المناسب، جارٍ القراءة المحلية...');
      }
    }

    const local = await extractLocally(file, kind, lectureId, onProgress);
    if (local.success) {
      local.message = `تم استخراج ${local.questions.length} سؤالاً من نص الملف. راجع الإجابات الصحيحة قبل الحفظ.`;
    } else if (aiError && !local.error) {
      local.error = aiError;
    }
    return local;
  } catch (err: any) {
    console.error('Question extraction error:', err);
    return { success: false, questions: [], error: String(err?.message || err) };
  }
}
