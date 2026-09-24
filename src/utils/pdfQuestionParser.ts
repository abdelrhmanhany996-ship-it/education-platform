import { QuestionBankItem, QuestionType } from '../types';

/**
 * Turns plain text (typed, pasted, or extracted from a PDF) into question-bank items.
 *
 * Expected layout (PDF plan §4):
 *   1. Question text                      (also "1-", "1)", "(1)", "سؤال 1:", "س1:", Arabic digits)
 *   أ) option   ب) option ...             (also A) B) C) D))
 *   الإجابة: ب                            (also "الجواب", "Answer: B")
 *   الشرح: optional explanation
 *   [سؤال مقالي]                          essay, or a question with no options
 *
 * A single file may hold both the explanation and the questions when the questions
 * start under a clear heading ("الأسئلة" / "بنك الأسئلة" / "Questions").
 */

export interface ParseResult {
  success: boolean;
  questions: QuestionBankItem[];
  warnings: string[];
  rawItemCount: number;
  /** True when a heading was found and only the text after it was parsed. */
  usedSectionHeading?: boolean;
}

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const toWesternDigits = (s: string) => s.replace(/[٠-٩]/g, d => String(ARABIC_DIGITS.indexOf(d)));

const QUESTION_START = /^(?:\(?\d+\s*[\.\-\)]|سؤال\s*\d+\s*[:\.\-]?|س\s*\d+\s*[:\.\-]?)\s*/i;
// Exported quiz PDFs (Moodle etc.): "Question 1" on its own line, then the text, options, "The correct answer is: ..."
const QUESTION_WORD_START = /^Question\s*\d+\s*[:\.\-]?\s*/i;
const OPTION_LINE = /^(?:[أابجدهـ]|[A-Ea-e])\s*[\)\-\.\:]\s*/;
const SECTION_HEADING = /^\s*(?:#+\s*)?(?:بنك\s+)?(?:الأسئلة|الاسئلة|أسئلة|اسئلة|Questions)\s*[:：]?\s*$/i;
const ANSWER_LINE = /^(?:الإجابة الصحيحة|الاجابة الصحيحة|الإجابة|الاجابة|الجواب|الحل|The correct answer is|Correct Answer|Answer)\s*[:\-：]\s*(.+)$/i;
const EXPLANATION_LINE = /^(?:الشرح|التفسير|توضيح|Explanation)\s*[:\-：]\s*(.+)$/i;
const ESSAY_MARK = /\[?\s*(?:سؤال مقالي|مقالي|essay)\s*\]?/gi;

const LETTER_INDEX: Record<string, number> = {
  أ: 0, ا: 0, a: 0, '1': 0,
  ب: 1, b: 1, '2': 1,
  ج: 2, c: 2, '3': 2,
  د: 3, d: 3, '4': 3,
  ه: 4, هـ: 4, e: 4, '5': 4
};

function resolveAnswer(
  answerText: string,
  options: string[],
  type: QuestionType
): number | undefined {
  const cleaned = answerText.replace(/[\(\)\[\]]/g, '').trim();
  const firstToken = cleaned.split(/[\s\.\-:،\)]+/)[0].toLowerCase();

  if (type === 'true_false') {
    const trueIdx = options.findIndex(o => /صح|true/i.test(o));
    const falseIdx = options.findIndex(o => /خط[أا]|false/i.test(o));
    if (/^(صح|صحيح|true|t)$/i.test(firstToken) && trueIdx >= 0) return trueIdx;
    if (/^(خطأ|خطا|خاطئ|false|f)$/i.test(firstToken) && falseIdx >= 0) return falseIdx;
  }

  // A lone option letter / number: "ب" or "B" or "2"
  if (firstToken in LETTER_INDEX && firstToken.length <= 2) {
    const idx = LETTER_INDEX[firstToken];
    if (idx < options.length) return idx;
  }

  // Otherwise the answer is written out in full: match it against the option text
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

  // One file with explanation + questions: keep only what follows the heading
  let usedSectionHeading = false;
  const allLines = normalized.split('\n');
  const headingAt = allLines.findIndex((l, i) => i > 0 && SECTION_HEADING.test(l));
  if (headingAt > 0) {
    normalized = allLines.slice(headingAt + 1).join('\n');
    usedSectionHeading = true;
  }

  // "Question 1 ... The correct answer is: ..." exports: only those blocks are questions; other
  // numbered lines in the same file (worked solutions, notes) must not become essay questions.
  const wordMode = normalized.split('\n').filter(l => QUESTION_WORD_START.test(l.trim())).length >= 2;
  const startRe = wordMode ? QUESTION_WORD_START : QUESTION_START;

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
        if (wordMode) break; // everything after the answer belongs to the next section of the file
      } else if (e) explanationText = e[1].trim();
      else body.push(l);
    }
    if (!body.length) continue;

    // Text before the first numbered question (titles, notes) is not a question
    if (hasNumbering && !startRe.test(body[0])) continue;

    let prompt = body[0].replace(startRe, '').trim();
    const isExplicitEssay = ESSAY_MARK.test(block);
    ESSAY_MARK.lastIndex = 0;
    prompt = prompt.replace(ESSAY_MARK, '').trim();

    let optionLines: string[] = [];
    // Scanned exports come out of OCR with mangled option labels ("2.000", "6001"), so the labels
    // cannot be trusted: everything after the last line that ends the question sentence is an option.
    let positional = false;
    if (wordMode) {
      const rest = body.slice(1);
      let lastPromptLine = -1;
      rest.forEach((l, i) => {
        if (/[?؟]|\bOrder\b|:\s*$/.test(l)) lastPromptLine = i;
      });
      const opts = lastPromptLine >= 0 ? rest.slice(lastPromptLine + 1) : [];
      if (opts.length >= 2 && opts.length <= 6) {
        positional = true;
        prompt = rest.slice(0, lastPromptLine + 1).join(' ').trim();
        const bare = opts.map(o => o.replace(/^[A-Za-z0-9]{1,2}\s*[\.\)]\s*/, '').trim());
        const lens = bare.map(b => b.replace(/\s/g, '').length);
        const tally = new Map<number, number>();
        lens.forEach(n => tally.set(n, (tally.get(n) || 0) + 1));
        const common = [...tally.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? 0;
        optionLines = opts.map((o, i) => {
          let text = bare[i];
          // a label OCR'd as a digit and glued to the text ("6001" for "c.001")
          if (!/^[A-Za-z0-9]{1,2}\s*[\.\)]/.test(o) && text.replace(/\s/g, '').length === common + 1) text = text.replace(/^\S/, '').trim();
          return `${'abcdef'[i]}. ${text}`;
        });
      }
    }
    if (!positional) {
      for (let i = 1; i < body.length; i++) {
        const line = body[i].replace(ESSAY_MARK, '').trim();
        if (!line) continue;
        if (OPTION_LINE.test(line) || line.startsWith('•')) {
          optionLines.push(line);
        } else if (optionLines.length > 0) {
          optionLines[optionLines.length - 1] += ' ' + line;
        } else {
          prompt += ' ' + line;
        }
      }
    }

    let type: QuestionType;
    if (isExplicitEssay || optionLines.length === 0) {
      type = 'essay';
    } else if (
      optionLines.length === 2 &&
      optionLines.some(o => /صح|true/i.test(o)) &&
      optionLines.some(o => /خط[أا]|false/i.test(o))
    ) {
      type = 'true_false';
    } else if (optionLines.length >= 2) {
      type = 'multiple_choice';
    } else {
      type = 'essay';
    }

    let correctIdx: number | undefined;
    let needsReview = false;
    const options = type === 'essay' ? [] : optionLines;

    if (type !== 'essay') {
      if (answerText) {
        correctIdx = resolveAnswer(answerText, options, type);
        if (correctIdx === undefined) {
          needsReview = true;
          warnings.push(`السؤال ${qIndex}: تعذر تحديد الإجابة من "${answerText}"، اختر الإجابة الصحيحة يدوياً.`);
        }
      } else {
        needsReview = true;
        warnings.push(`السؤال ${qIndex}: لا يوجد سطر "الإجابة: ..."، اختر الإجابة الصحيحة يدوياً.`);
      }
    }

    questions.push({
      id: `qb_${lectureId}_${Date.now()}_${qIndex}_${Math.random().toString(36).slice(2, 6)}`,
      lectureId,
      questionNumber: qIndex,
      type,
      prompt,
      options,
      correctOptionIndex: correctIdx,
      correctAnswerText: answerText || undefined,
      explanation: explanationText || undefined,
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
