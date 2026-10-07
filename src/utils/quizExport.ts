import type { QuestionBankItem } from '../types';

const LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح'];
const LABEL = /^\s*[\(\[]?(?:[أابجدهـوزحa-hA-H]|[1-8])[\)\.\:\-\]]\s*/;

const esc = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const correctOf = (q: QuestionBankItem) =>
  (q.type === 'multiple_select' ? q.correctOptionIndexes || [] : [q.correctOptionIndex ?? -1]).filter(i => i >= 0);

const HINT: Partial<Record<QuestionBankItem['type'], string>> = {
  multiple_select: 'اختر كل الإجابات الصحيحة',
  true_false: 'صح أم خطأ'
};

/** A printable exam paper (RTL, Arabic-friendly), optionally followed by the answer key on its own page. */
export function buildQuizHtml(title: string, questions: QuestionBankItem[], withKey: boolean): string {
  const items = questions
    .map((q, i) => {
      const opts = q.options
        .map((o, k) => `<li><span class="box"></span><b>${LETTERS[k] || k + 1})</b> <bdi>${esc(o.replace(LABEL, ''))}</bdi></li>`)
        .join('');
      const hint = HINT[q.type] ? ` <span class="hint">(${HINT[q.type]})</span>` : '';
      const body = q.type === 'essay' ? '<div class="lines"></div>' : `<ol class="opts">${opts}</ol>`;
      return `<section class="q"><p><b>${i + 1}.</b> <bdi>${esc(q.prompt)}</bdi>${hint}</p>${body}</section>`;
    })
    .join('');

  const key = withKey
    ? `<div class="key"><h2>نموذج الإجابة</h2><table><tr><th>السؤال</th><th>الإجابة</th><th>الشرح</th></tr>${questions
        .map((q, i) => {
          const ans = q.type === 'essay' ? 'مقالي' : correctOf(q).map(k => LETTERS[k] || k + 1).join('، ') || '—';
          return `<tr><td>${i + 1}</td><td>${esc(ans)}</td><td><bdi>${esc(q.explanation || '')}</bdi></td></tr>`;
        })
        .join('')}</table></div>`
    : '';

  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  body{font-family:'Cairo','Segoe UI',Tahoma,Arial,sans-serif;color:#111;margin:32px;line-height:1.7;font-size:14pt}
  h1{font-size:20pt;margin:0 0 4px} .meta{display:flex;gap:32px;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:18px;font-size:12pt}
  .meta span{flex:1;border-bottom:1px dotted #555;padding-bottom:2px}
  .q{margin:0 0 16px;page-break-inside:avoid;break-inside:avoid} .q p{margin:0 0 6px}
  .hint{color:#555;font-size:11pt} .opts{list-style:none;margin:0;padding:0 18px}
  .opts li{margin:3px 0;display:flex;gap:8px;align-items:baseline} .box{display:inline-block;width:11px;height:11px;border:1.5px solid #333;border-radius:2px;flex-shrink:0}
  .lines{height:90px;margin:0 18px;background:repeating-linear-gradient(transparent,transparent 29px,#999 30px)}
  .key{page-break-before:always;break-before:page} table{width:100%;border-collapse:collapse;font-size:12pt}
  th,td{border:1px solid #444;padding:6px 8px;text-align:start;vertical-align:top} th{background:#eee}
  bdi{unicode-bidi:plaintext}
</style></head><body>
<h1>${esc(title)}</h1>
<div class="meta"><span>الاسم:</span><span>الكود:</span><span>الدرجة: &nbsp; / ${questions.length}</span></div>
${items}${key}</body></html>`;
}

const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80) || 'كويز';

/** Word opens an HTML document saved as .doc, keeping Arabic and right-to-left layout. */
export function downloadQuizWord(title: string, questions: QuestionBankItem[], withKey: boolean) {
  const html = buildQuizHtml(title, questions, withKey);
  const blob = new Blob(['﻿', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName(title)}.doc`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Opens the browser's print dialog on the paper; "Save as PDF" gives a PDF file. */
export function printQuizPdf(title: string, questions: QuestionBankItem[], withKey: boolean) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(buildQuizHtml(title, questions, withKey));
  doc.close();
  setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 60_000);
  }, 300);
}
