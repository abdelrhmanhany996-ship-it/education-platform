import { QuestionBankItem, QuestionType } from '../types';

export interface ParseResult {
  success: boolean;
  questions: QuestionBankItem[];
  warnings: string[];
  rawItemCount: number;
  usedSectionHeading?: boolean;
}

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const toWesternDigits = (s: string) => s.replace(/[٠-٩]/g, d => String(ARABIC_DIGITS.indexOf(d)));

const QUESTION_START = /^(?:\(?\d+\s*[\.\-\:\)]|سؤال\s*\d+|س\s*\d+|q\s*\d+|question\s*\d+)\s*/i;
const OPTION_LINE = /^(?:[\(\[]?[أابجدهـa-eA-E][\)\.\:\-\]]|[\(\[]?[1-5][\)\:]|•|\-)\s*/;
const SECTION_HEADING = /^\s*(?:#+\s*)?(?:بنك\s+)?(?:الأسئلة|الاسئلة|أسئلة|اسئلة|Questions|Quiz|Test)\s*[:：]?\s*$/i;
const ANSWER_LINE = /^(?:الإجابة الصحيحة|الاجابة الصحيحة|الإجابة|الاجابة|الجواب|الحل|المفتاح|The correct answer is|Correct Answer|Correct|Answer|Ans|Key)\s*[:=\-：]?\s*(.+)$/i;
const EXPLANATION_LINE = /^(?:الشرح|التفسير|توضيح|Explanation|Exp)\s*[:\-：]\s*(.+)$/i;
const ESSAY_MARK = /\[?\s*(?:سؤال مقالي|مقالي|essay)\s*\]?/gi;

const LETTER_INDEX: Record<string, number> = {
  أ: 0, ا: 0, a: 0, '1': 0,
  ب: 1, b: 1, '2': 1,
  ج: 2, c: 2, '3': 2,
  د: 3, d: 3, '4': 3,
  ه: 4, هـ: 4, e: 4, '5': 4
};

function resolveMultipleAnswers(
  answerText: string,
  options: string[],
  type: QuestionType
): number[] {
  const cleaned = answerText.replace(/[\(\)\[\]]/g, '').trim();
  const tokens = cleaned.split(/[\s,،+&و\-:\/]+/).map(t => t.trim().toLowerCase()).filter(Boolean);
  const found = new Set<number>();

  for (const token of tokens) {
    if (token in LETTER_INDEX) {
      const idx = LETTER_INDEX[token];
      if (idx < options.length) found.add(idx);
    }
  }

  if (found.size === 0) {
    const single = resolveAnswer(answerText, options, type);
    if (single !== undefined) found.add(single);
  }

  return Array.from(found).sort((a, b) => a - b);
}

function resolveAnswer(
  answerText: string,
  options: string[],
  type: QuestionType
): number | undefined {
  const cleaned = answerText.replace(/[\(\)\[\]]/g, '').trim();
  const firstToken = cleaned.split(/[\s\.\-:،\)=]+/)[0].toLowerCase();

  if (type === 'true_false') {
    const trueIdx = options.findIndex(o => /صح|true|t/i.test(o));
    const falseIdx = options.findIndex(o => /خط[أا]|false|f/i.test(o));
    if (/^(صح|صحيح|true|t|1)$/i.test(firstToken) && trueIdx >= 0) return trueIdx;
    if (/^(خطأ|خطا|خاطئ|false|f|2)$/i.test(firstToken) && falseIdx >= 0) return falseIdx;
  }

  if (firstToken in LETTER_INDEX && firstToken.length <= 2) {
    const idx = LETTER_INDEX[firstToken];
    if (idx < options.length) return idx;
  }

  const bare = cleaned.replace(OPTION_LINE, '').trim();
  const squash = (s: string) => s.replace(/[\s\.\,;:،]/g, '').toLowerCase();
  if (squash(bare).length >= 1) {
    const exact = options.findIndex(o => squash(o.replace(OPTION_LINE, '')) === squash(bare));
    if (exact >= 0) return exact;
  }
  if (bare.length >= 2) {
    const idx = options.findIndex(o => o.replace(OPTION_LINE, '').trim() === bare);
    if (idx >= 0) return idx;
    const loose = options.findIndex(o => o.includes(bare));
    if (loose >= 0) return loose;
  }
  return undefined;
}

export function parseQuestionsFromText(rawText: string, lectureId: string = 'temp'): ParseResult {
  const warnings: string[] = [];
  const questions: QuestionBankItem[] = [];

  if (!rawText || !rawText.trim()) {
    return { success: false, questions: [], warnings: ['النص المدخل فارغ'], rawItemCount: 0 };
  }

  let normalized = toWesternDigits(rawText.normalize('NFKC'))
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  let usedSectionHeading = false;
  const allLines = normalized.split('\n');
  const headingAt = allLines.findIndex((l, i) => i > 0 && SECTION_HEADING.test(l));
  if (headingAt > 0) {
    normalized = allLines.slice(headingAt + 1).join('\n');
    usedSectionHeading = true;
  }

  const startRe = QUESTION_START;

  // Split into blocks at each numbered question
  const blocks: string[] = [];
  let current: string[] = [];
  for (const line of normalized.split('\n')) {
    const t = line.trim();
    if (startRe.test(t) && !OPTION_LINE.test(t)) {
      if (current.length) blocks.push(current.join('\n'));
      current = [];
    }
    current.push(line);
  }
  if (current.length) blocks.push(current.join('\n'));

  const hasNumbering = normalized.split('\n').some(l => startRe.test(l.trim()));
  const finalBlocks = hasNumbering
    ? blocks
    : normalized.split(/\n\s*\n/).filter(b => b.trim().length > 10);

  let qIndex = 1;

  for (const block of finalBlocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) continue;

    let answerText = '';
    let explanationText = '';
    const body: string[] = [];

    for (const l of lines) {
      const a = l.match(ANSWER_LINE);
      const e = l.match(EXPLANATION_LINE);
      if (a) {
        answerText = a[1].trim();
      } else if (e) {
        explanationText = e[1].trim();
      } else {
        body.push(l);
      }
    }
    if (!body.length) continue;

    let prompt = body[0].replace(startRe, '').trim();
    const isExplicitEssay = ESSAY_MARK.test(block);
    ESSAY_MARK.lastIndex = 0;
    prompt = prompt.replace(ESSAY_MARK, '').trim();

    let optionLines: string[] = [];
    for (let i = 1; i < body.length; i++) {
      const line = body[i].replace(ESSAY_MARK, '').trim();
      if (!line) continue;
      if (OPTION_LINE.test(line)) {
        optionLines.push(line);
      } else if (optionLines.length > 0) {
        optionLines[optionLines.length - 1] += ' ' + line;
      } else {
        prompt += ' ' + line;
      }
    }

    // If options were not matched line-by-line, check if options are written in a single line like:
    // "أ) الخيار الأول  ب) الخيار الثاني  ج) الخيار الثالث"
    if (optionLines.length < 2) {
      const inlineMatches = prompt.match(/(?:[\(\[]?[أابجدهـa-eA-E][\)\.\:\-\]]\s*[^أابجدهـa-eA-E\n]+)/g);
      if (inlineMatches && inlineMatches.length >= 2) {
        optionLines = inlineMatches.map(m => m.trim());
        const firstOptPos = prompt.indexOf(inlineMatches[0]);
        if (firstOptPos > 0) {
          prompt = prompt.substring(0, firstOptPos).trim();
        }
      }
    }

    let type: QuestionType;
    if (isExplicitEssay || optionLines.length === 0) {
      type = 'essay';
    } else if (
      optionLines.length === 2 &&
      optionLines.some(o => /صح|true|t/i.test(o)) &&
      optionLines.some(o => /خط[أا]|false|f/i.test(o))
    ) {
      type = 'true_false';
    } else if (optionLines.length >= 2) {
      type = 'multiple_choice';
    } else {
      type = 'essay';
    }

    let correctIdx: number | undefined;
    let correctIdxs: number[] | undefined;
    let needsReview = false;
    const options = type === 'essay' ? [] : optionLines;

    if (type !== 'essay') {
      if (answerText) {
        const multipleMatches = resolveMultipleAnswers(answerText, options, type);
        if (multipleMatches.length > 1) {
          type = 'multiple_select';
          correctIdxs = multipleMatches;
          correctIdx = multipleMatches[0];
        } else if (multipleMatches.length === 1) {
          correctIdx = multipleMatches[0];
          correctIdxs = [correctIdx];
        } else {
          correctIdx = 0;
          correctIdxs = [0];
          needsReview = true;
          warnings.push(`السؤال ${qIndex}: تعذر تحديد الإجابة من "${answerText}"، تم اختيار الخيار الأول افتراضياً.`);
        }
      } else {
        // Check if any option is marked with * or (correct) or (صح)
        const markedIdx = options.findIndex(o => /\*|\(correct\)|\(صحيح\)|\(الإجابة\)|✓/i.test(o));
        if (markedIdx >= 0) {
          correctIdx = markedIdx;
          correctIdxs = [markedIdx];
        } else {
          correctIdx = 0;
          correctIdxs = [0];
          needsReview = true;
          warnings.push(`السؤال ${qIndex}: يرجى تأكيد الخيار الصحيح.`);
        }
      }
    }

    // Clean prompt
    if (prompt.length < 3 && options.length === 0) continue;

    questions.push({
      id: `qb_${lectureId}_${Date.now()}_${qIndex}_${Math.random().toString(36).slice(2, 6)}`,
      lectureId,
      questionNumber: qIndex,
      type,
      prompt: prompt || `سؤال ${qIndex}`,
      options,
      correctOptionIndex: (typeof correctIdx === 'number' && !isNaN(correctIdx)) ? Math.round(correctIdx) : -1,
      correctOptionIndexes: (correctIdxs && correctIdxs.length > 0) ? correctIdxs : [(typeof correctIdx === 'number' && !isNaN(correctIdx)) ? Math.round(correctIdx) : -1],
      correctAnswerText: answerText || '',
      explanation: explanationText || '',
      points: 1,
      needsReview: needsReview || undefined
    });
    qIndex++;
  }

  return {
    success: questions.length > 0,
    questions,
    warnings,
    rawItemCount: questions.length,
    usedSectionHeading
  };
}

export const SAMPLE_QUESTIONS_PDF_TEXT = `1. ما هو التعقيد الزمني (Time Complexity) للوصول إلى عنصر في مصفوفة عادية عن طريق الفهرس (Index)؟
أ) O(1)
ب) O(n)
ج) O(log n)
د) O(n^2)
الإجابة: أ
الشرح: مصفوفات الذاكرة تسمح بالوصول المباشر O(1) بفضل الحساب المباشر لعنوان الخلية في الرام.

2. المكدس (Stack) يتبع خوارزمية FIFO (First In First Out).
أ) صح
ب) خطأ
الإجابة: ب
الشرح: المكدس يتبع LIFO (Last In First Out) بينما الطابور Queue هو الذي يتبع FIFO.

3. ما هي الخوارزمية الأنسب للبحث عن أقصر مسار في رسم بياني غير موجه بأوزان متساوية؟
أ) البحث في العمق أولاً (DFS)
ب) خوارزمية بريم (Prim's Algorithm)
ج) البحث في العرض أولاً (BFS)
د) خوارزمية فرلويد وارشال
الإجابة: ج
الشرح: خوارزمية BFS تضمن استكشاف المستويات مستوى بمستوى وتصل لأقصر مسار.

4. شجرة البحث الثنائية المتوازنة (AVL Tree) تضمن أن ارتفاع الشجرة لا يتجاوز:
أ) O(n)
ب) O(log n)
ج) O(n log n)
د) O(1)
الإجابة: ب
الشرح: بفضل عمليات الدوران (Rotations)، يبقى عامل التوازن بين -1 و +1 ويكون الارتفاع O(log n).

5. اشرح الفرق الجوهري بين بنية البيانات الخطية (Linear) وغير الخطية (Non-linear)، مع ذكر مثالين على كل نوع وتأثير ذلك على كفاءة الذاكرة.
[سؤال مقالي]
`;

/* ------------------------------------------------------------------ */
/*  Quality checks: reject binary noise from a badly read PDF          */
/* ------------------------------------------------------------------ */

/** Longest prompt / option a real exam question has. Anything longer is a broken import. */
export const MAX_PROMPT_CHARS = 4000;
export const MAX_OPTION_CHARS = 1500;
export const MAX_OPTIONS = 12;

// Arabic (+ presentation forms), Latin letters/digits, whitespace, common math & punctuation.
const READABLE =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0020-\u007E\s\u00A0\u00B0\u00B1\u00B2\u00B3\u00B7\u00D7\u00F7\u2010-\u2027\u2030-\u205E\u2070-\u209F\u2190-\u22FF\u2460-\u24FF\u2500-\u25FF\u2600-\u27BF\u0391-\u03C9]/u;

/** Share of characters that belong to real text (0..1). Binary PDF streams score far below 0.9. */
export function readableRatio(text: string, sample = 4000): number {
  if (!text) return 1;
  const s = text.length > sample ? text.slice(0, sample / 2) + text.slice(-sample / 2) : text;
  let ok = 0;
  let total = 0;
  for (const ch of s) {
    total++;
    if (READABLE.test(ch)) ok++;
  }
  return total ? ok / total : 1;
}

export const isGarbledText = (text: string) => readableRatio(text) < 0.9;

/** True when extracted document text is usable for question parsing. */
export const textLooksReadable = (text: string) => text.trim().length >= 10 && !isGarbledText(text);

/** A question produced by a broken import (binary data, whole pages glued into one option...). */
export function isCorruptQuestion(q: Pick<QuestionBankItem, 'prompt' | 'options'>): boolean {
  const prompt = String(q.prompt ?? '');
  const options = Array.isArray(q.options) ? q.options.map(o => String(o ?? '')) : [];
  if (prompt.length > MAX_PROMPT_CHARS) return true;
  if (options.length > MAX_OPTIONS) return true;
  if (options.some(o => o.length > MAX_OPTION_CHARS)) return true;
  return isGarbledText(prompt + ' ' + options.join(' '));
}

/** Cut long text for display so a bad record can never lock up the page. */
export const clip = (text: string, max = 600) => (text.length > max ? text.slice(0, max) + '…' : text);
