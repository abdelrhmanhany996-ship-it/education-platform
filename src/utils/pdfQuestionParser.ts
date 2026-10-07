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

const QUESTION_START = /^(?:\(?\d+\s*[\.\-\:\)]|(?:سؤال|س|q|question)\s*\d+\s*[\.\-\:\)]?)\s*/i;
const OPTION_LINE = /^(?:[\(\[]?[أابجدهـa-eA-E][\)\.\:\-\]]|[\(\[]?[1-5][\)\:]|•|\-)\s*/;
const SECTION_HEADING = /^\s*(?:#+\s*)?(?:بنك\s+)?(?:الأسئلة|الاسئلة|أسئلة|اسئلة|Questions|Quiz|Test)\s*[:：]?\s*$/i;
const ANSWER_LINE = /^(?:الإجابات الصحيحة|الاجابات الصحيحة|الإجابة الصحيحة|الاجابة الصحيحة|الإجابات|الاجابات|الإجابة|الاجابة|الجواب|الحل|المفتاح|The correct answers are|The correct answer is|Correct Answers|Correct Answer|Correct|Answers|Answer|Ans|Key)\s*[:=\-：]?\s*(.+)$/i;
const EXPLANATION_LINE = /^(?:الشرح|التفسير|توضيح|Explanation|Exp)\s*[:\-：]\s*(.+)$/i;
const ESSAY_MARK = /\[?\s*(?:سؤال مقالي|مقالي|essay)\s*\]?/gi;

const LETTER_INDEX: Record<string, number> = {
  أ: 0, ا: 0, a: 0, '1': 0,
  ب: 1, b: 1, '2': 1,
  ج: 2, c: 2, '3': 2,
  د: 3, d: 3, '4': 3,
  ه: 4, هـ: 4, e: 4, '5': 4
};

const LETTER_OPTION = /^[\(\[]?(?:[أابجدa-eA-E]|هـ)[\)\.\:\-\]]\s/;
const TF_PROMPT = /true\s+or\s+false|true\/false|صح\s+(?:أ|ا)?م\s+خط(?:أ|ا)|صواب\s+(?:أ|ا)?م\s+خط(?:أ|ا)|ضع\s+علامة\s*\(?\s*[✓√]/i;
/** Marks put on the correct option(s): "ب) ... ✔", "✔ ب) ...", "(صحيح)", "*". */
const MARK = /\s*(?:\*|\(correct\)|\(صحيح\)|\(صح\)|\(الإجابة\)|✓|✔|☑|✅|√)\s*/gi;
const LEADING_MARK = /^(?:[✓✔☑✅√\*]|\[\s*[xX✓✔]\s*\])\s*/;
/** "اختر كل ما ينطبق", "أكثر من إجابة", "select all that apply" → the question has several correct answers. */
const MSQ_HINT = /اختر\s+(?:كل|جميع)|(?:أكثر|اكثر)\s+من\s+(?:إجابة|اجابة|اختيار)|إجابات\s+صحيحة|اجابات\s+صحيحة|(?:select|choose|mark|pick)\s+(?:all|two|three|more)|all\s+that\s+apply|\bMSQ\b|\bMRQ\b/i;
/** Heading of an answer key at the end of the file ("مفتاح الإجابات", "Answer Key"), alone or followed by the answers. */
const KEY_HEADING = /^\s*(?:#+\s*)?(?:مفتاح\s+(?:ال)?(?:إ|ا)جاب(?:ات|ة)|(?:ال)?(?:إ|ا)جابات(?:\s+(?:ال)?صحيحة)?|answer\s*key|answers|key)\s*[:：]?\s*(.*)$/i;
const KEY_ENTRY =
  /(\d{1,3})\s*(?:[\-\.\):=]\s*|\s+)((?:صح|صحيح|صواب|خطأ|خطا|خاطئ|true|false)(?![\p{L}])|(?:هـ|[أابجده]|[a-eA-E])(?![\p{L}])(?:\s*(?:[,،+&\/]|\s+و\s*|\s+)\s*(?:هـ|[أابجده]|[a-eA-E])(?![\p{L}]))*)/giu;

/** Answer key section → { questionNumber: "أ، ج" }; returns the text without it. */
function takeAnswerKey(text: string): { text: string; key: Map<number, string> } {
  const lines = text.split('\n');
  const firstQuestion = lines.findIndex(l => QUESTION_START.test(l.trim()));
  for (let i = lines.length - 1; i > Math.max(firstQuestion, 0); i--) {
    const m = lines[i].trim().match(KEY_HEADING);
    if (!m) continue;
    const body = [m[1], ...lines.slice(i + 1)].join('\n');
    const key = new Map<number, string>();
    for (const e of body.matchAll(KEY_ENTRY)) key.set(Number(e[1]), e[2].trim());
    if (key.size >= 2 || (key.size === 1 && !lines.slice(i + 1).some(l => l.trim()))) {
      return { text: lines.slice(0, i).join('\n'), key };
    }
  }
  return { text, key: new Map() };
}

const TF_TRUE = /^(?:[\(\[]?\S{1,2}[\)\.\:\-\]]\s*)?(?:صح|صحيح|صواب|true|t)\s*$/i;
const TF_FALSE = /^(?:[\(\[]?\S{1,2}[\)\.\:\-\]]\s*)?(?:خطأ|خطا|خاطئ|false|f)\s*$/i;
const TF_ANSWER = /^(?:صح|صحيح|صواب|خطأ|خطا|خاطئ|true|false)\.?$/i;
const INLINE_LABELS = [['أ', 'ب', 'ج', 'د', 'هـ'], ['ا', 'ب', 'ج', 'د', 'هـ'], ['a', 'b', 'c', 'd', 'e']];

/** "a) O(n) b) O(log n) c) O(1)" on one line → prompt + options (labels must run in order: a, b, c…). */
function splitInlineOptions(text: string): { prompt: string; options: string[] } | null {
  const marks = [...text.matchAll(/(^|\s)[\(\[]?([أابجدa-eA-E]|هـ)[\)\]]\s*/g)].map(m => ({
    at: m.index! + m[1].length,
    label: m[2].toLowerCase()
  }));
  for (const seq of INLINE_LABELS) {
    const start = marks.findIndex(m => m.label === seq[0]);
    if (start < 0) continue;
    const picked: typeof marks = [];
    for (const m of marks.slice(start)) if (m.label === seq[picked.length]) picked.push(m);
    if (picked.length < 2) continue;
    const options = picked.map((m, i) => text.slice(m.at, picked[i + 1]?.at ?? text.length).trim());
    if (options.some(o => o.replace(/^[\(\[]?\S+[\)\]]\s*/, '').length === 0)) continue;
    return { prompt: text.slice(0, picked[0].at).trim(), options };
  }
  return null;
}

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
    const trueIdx = options.findIndex(o => TF_TRUE.test(o));
    const falseIdx = options.findIndex(o => TF_FALSE.test(o));
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
  const answerKey = takeAnswerKey(normalized);
  normalized = answerKey.text;

  // Split into blocks at each numbered question
  const blocks: string[] = [];
  let current: string[] = [];
  // "1)" can number a question or an option; when options use letters (أ) ب) / a) b)), digits are questions
  const letterOptions = normalized.split('\n').some(l => LETTER_OPTION.test(l.trim()));
  for (const line of normalized.split('\n')) {
    const t = line.trim();
    if (startRe.test(t) && (!OPTION_LINE.test(t) || (letterOptions && /^\(?\d/.test(t)))) {
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

    const number = Number(body[0].match(/^\(?(\d+)|^(?:سؤال|س|q|question)\s*(\d+)/i)?.slice(1).find(Boolean));
    if (!answerText && number && answerKey.key.has(number)) answerText = answerKey.key.get(number)!;

    let prompt = body[0].replace(startRe, '').trim();
    const isExplicitEssay = ESSAY_MARK.test(block);
    ESSAY_MARK.lastIndex = 0;
    prompt = prompt.replace(ESSAY_MARK, '').trim();

    let optionLines: string[] = [];
    for (let i = 1; i < body.length; i++) {
      let line = body[i].replace(ESSAY_MARK, '').trim();
      if (!line) continue;
      // "✔ ب) ..." → the option, marked as correct
      const lead = line.match(LEADING_MARK);
      if (lead && OPTION_LINE.test(line.slice(lead[0].length))) line = `${line.slice(lead[0].length)} ✔`;
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
    if (optionLines.length === 1) {
      const inline = splitInlineOptions(optionLines[0]);
      if (inline && !inline.prompt) optionLines = inline.options;
    } else if (optionLines.length === 0) {
      const inline = splitInlineOptions(prompt);
      if (inline) {
        prompt = inline.prompt;
        optionLines = inline.options;
      }
    }

    // "True or False" / "صح أم خطأ" written without listing the two choices
    if (
      optionLines.length === 0 &&
      !isExplicitEssay &&
      (TF_PROMPT.test(prompt) || (answerText && TF_ANSWER.test(answerText.trim())))
    ) {
      optionLines = /[\u0600-\u06FF]/.test(prompt) ? ['صح', 'خطأ'] : ['True', 'False'];
    }

    let type: QuestionType;
    if (isExplicitEssay || optionLines.length === 0) {
      type = 'essay';
    } else if (
      optionLines.length === 2 &&
      optionLines.some(o => TF_TRUE.test(o)) &&
      optionLines.some(o => TF_FALSE.test(o))
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

    if (type !== 'essay' && answerText) options.forEach((o, i) => (options[i] = o.replace(MARK, ' ').trim()));
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
        const marked = options.map((o, i) => (o.search(MARK) >= 0 ? i : -1)).filter(i => i >= 0);
        options.forEach((o, i) => (options[i] = o.replace(MARK, ' ').trim()));
        if (marked.length > 1 && type === 'multiple_choice') {
          type = 'multiple_select';
          correctIdx = marked[0];
          correctIdxs = marked;
        } else if (marked.length) {
          const markedIdx = marked[0];
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

    // The question says several answers are correct even if the file marks only some of them
    if (type === 'multiple_choice' && MSQ_HINT.test(prompt)) {
      type = 'multiple_select';
      correctIdxs = correctIdxs && correctIdxs.length ? correctIdxs : [0];
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
