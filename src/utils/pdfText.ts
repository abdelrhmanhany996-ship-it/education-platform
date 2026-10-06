// The legacy build carries polyfills for browsers that lack the newest JS (e.g. Map#getOrInsertComputed);
// the modern build fails there and the PDF never opens
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
// Bundled with the app (same version as pdfjs-dist), so PDFs open without reaching a CDN
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { textLooksReadable } from './pdfQuestionParser';

if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
}

export { pdfjs };

/** Rejects when a PDF.js step hangs (e.g. the worker never starts), so callers can fall back. */
export function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    p,
    new Promise<never>((_, reject) => {
      t = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    })
  ]).finally(() => clearTimeout(t));
}

export async function loadPdf(data: ArrayBuffer | Uint8Array) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  try {
    return await withTimeout(
      pdfjs.getDocument({
        data: bytes.slice(),
        useSystemFonts: true
      }).promise,
      20_000,
      'PDF load'
    );
  } catch (err) {
    console.warn('pdfjs primary worker load failed, trying fallback:', err);
    try {
      return await withTimeout(
        pdfjs.getDocument({
          data: bytes.slice(),
          useSystemFonts: true,
          disableFontFace: true
        }).promise,
        20_000,
        'PDF load'
      );
    } catch (err2) {
      console.error('pdfjs secondary load failed:', err2);
      throw err2;
    }
  }
}

/**
  * Fallback raw text extractor if pdfjs worker fails or returns empty text
  */
export function extractRawStringsFromPdfBuffer(buffer: ArrayBuffer): string {
  try {
    const decoder = new TextDecoder('latin1');
    const raw = decoder.decode(buffer);
    const matches = raw.match(/\(([^()\\]|\\[\s\S])*\)/g);
    if (!matches || !matches.length) return '';

    const lines: string[] = [];
    let curLine = '';

    for (const match of matches) {
      let str = match.slice(1, -1);
      str = str
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
        .replace(/\\(.)/g, '$1');

      if (/[a-zA-Z0-9\u0600-\u06FF]/.test(str)) {
        curLine += str + ' ';
        if (curLine.length > 80 || str.includes('\n')) {
          lines.push(curLine.trim());
          curLine = '';
        }
      }
    }
    if (curLine.trim()) lines.push(curLine.trim());

    return lines.join('\n').normalize('NFKC');
  } catch {
    return '';
  }
}

type TextPiece = { str: string; x: number };
type Dir = 'R' | 'L';

const ARABIC = /[\u0621-\u064A\u066E-\u06D3\u06FA-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
const LATIN = /[A-Za-z\u00C0-\u024F]/;
const DIGIT = /[0-9\u0660-\u0669\u06F0-\u06F9]/;
const MIRROR: Record<string, string> = { '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<' };
const countChars = (pieces: TextPiece[], re: RegExp) =>
  pieces.reduce((n, p) => n + [...p.str].filter(c => re.test(c)).length, 0);
const kind = (s: string) => (ARABIC.test(s) ? 'R' : LATIN.test(s) ? 'L' : DIGIT.test(s) ? 'EN' : null);

/**
 * Text of one PDF line in reading order.
 * Some PDF writers (browsers' "Save as PDF", many converters) store Arabic glyph by glyph in visual order,
 * so a plain concatenation comes out reversed ("ﺔﺑﺎﺟﻹا" instead of "الإجابة"). Lines of an Arabic page are
 * rebuilt from the glyph positions with a simplified bidi pass: right to left, Latin runs kept left to right,
 * numbers kept in order, brackets mirrored.
 */
export function orderLine(input: TextPiece[], pageIsArabic = false): string {
  const hasArabic = input.some(p => ARABIC.test(p.str));
  if (!hasArabic && !pageIsArabic) return input.map(p => p.str).join('');
  const sortedInput = [...input].sort((a, b) => a.x - b.x);
  const firstKind = sortedInput.map(p => kind(p.str)).find(Boolean);
  // On an English page an Arabic line numbered at the left edge ("5. أي…") was laid out left to right
  const base: Dir =
    pageIsArabic || (countChars(input, ARABIC) >= countChars(input, LATIN) && firstKind !== 'EN') ? 'R' : 'L';

  // Sentence punctuation glued to the left of a Latin piece ("?Which", "؟LIFO") ends that sentence
  const pieces: TextPiece[] = [];
  for (const p of sortedInput) {
    const m = base === 'R' && kind(p.str) === 'L' ? p.str.match(/^([?؟!.,،:;]+)(.+)$/) : null;
    if (m) pieces.push({ str: m[1], x: p.x - 1e-3 }, { str: m[2], x: p.x });
    else pieces.push(p);
  }
  const kinds = pieces.map(p => kind(p.str));
  const nearest = (i: number, step: number, accept: (k: string | null) => boolean) => {
    for (let j = i + step; j >= 0 && j < kinds.length; j += step) if (accept(kinds[j])) return kinds[j];
    return null;
  };
  // Numbers follow the text logically before them (to their right on an RTL line, left on an LTR line)
  const strong = kinds.map((k, i) => {
    if (k !== 'EN') return k as Dir | null;
    const before = nearest(i, base === 'R' ? 1 : -1, x => x === 'R' || x === 'L');
    return before === 'L' ? 'L' : before === 'R' ? 'R' : base;
  });
  // Neutral pieces (spaces, punctuation) take a direction only when it is on both sides
  const dir: Dir[] = strong.map((d, i) => {
    if (d) return d;
    let l = i - 1;
    while (l >= 0 && !strong[l]) l--;
    let r = i + 1;
    while (r < strong.length && !strong[r]) r++;
    return l >= 0 && r < strong.length && strong[l] === strong[r] ? strong[l]! : base;
  });

  const runs: { dir: Dir; items: TextPiece[] }[] = [];
  pieces.forEach((p, i) => {
    const last = runs[runs.length - 1];
    if (last && last.dir === dir[i]) last.items.push(p);
    else runs.push({ dir: dir[i], items: [p] });
  });
  const rtlText = (items: TextPiece[]) => {
    let out = '';
    for (let i = items.length - 1; i >= 0; ) {
      if (kind(items[i].str) === 'EN') {
        let j = i;
        while (j > 0 && kind(items[j - 1].str) === 'EN') j--;
        out += items.slice(j, i + 1).map(p => p.str).join('');
        i = j - 1;
        continue;
      }
      const s = items[i].str;
      out += ARABIC.test(s) ? s : [...s].reverse().map(c => MIRROR[c] || c).join('');
      i--;
    }
    return out;
  };
  return (base === 'R' ? runs.reverse() : runs)
    .map(run => (run.dir === 'L' ? run.items.map(p => p.str).join('') : rtlText(run.items)))
    .join('');
}

/**
 * Text of a PDF, one visual line per row, in reading order.
 * Arabic PDFs usually store letters as "presentation forms"; NFKC turns them back into normal letters.
 */
export async function extractTextFromPdf(file: File | Blob): Promise<{ text: string; pages: number }> {
  let arrayBuf: ArrayBuffer | null = null;
  try {
    arrayBuf = await file.arrayBuffer();
    const pdf = await loadPdf(arrayBuf);
    const lines: string[] = [];

    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const all = (content.items as any[]).filter(i => typeof i.str === 'string').map(i => ({ str: i.str as string, x: 0 }));
      const pageIsArabic = countChars(all, ARABIC) > countChars(all, LATIN);
      let line: TextPiece[] = [];
      let lastY: number | null = null;
      const flush = () => {
        const text = orderLine(line, pageIsArabic).trim();
        if (text) lines.push(text);
        line = [];
      };

      for (const item of content.items as any[]) {
        if (typeof item.str !== 'string') continue;
        const y = Math.round(item.transform[5]);
        if (lastY !== null && Math.abs(y - lastY) > 3) flush();
        line.push({ str: item.str, x: item.transform[4] });
        if (item.hasEOL) flush();
        lastY = y;
      }
      flush();
      lines.push('');
    }

    const resultText = lines.join('\n').normalize('NFKC');
    if (textLooksReadable(resultText)) {
      return { text: resultText, pages: pdf.numPages };
    }
  } catch (e) {
    console.warn('PDF text extraction via pdfjs error:', e);
  }

  // Fallback: raw stream text extraction
  if (arrayBuf) {
    // Only trust it when it is real text: compressed streams decode to binary noise
    const rawText = extractRawStringsFromPdfBuffer(arrayBuf);
    if (textLooksReadable(rawText)) {
      return { text: rawText, pages: 1 };
    }
  }

  return { text: '', pages: 0 };
}

/**
 * OCR fallback for scanned/image-only PDFs (no embedded text layer). Renders each page to a
 * canvas and runs Tesseract (Arabic + English) on it.
 */
export async function extractTextViaOcr(
  file: File | Blob,
  onProgress?: (info: { page: number; pages: number }) => void
): Promise<{ text: string; pages: number }> {
  try {
    const arrayBuf = await file.arrayBuffer();
    const pdf = await loadPdf(arrayBuf);
    const { createWorker } = await import('tesseract.js');
    const worker = await withTimeout(createWorker(['ara', 'eng']), 40_000, 'OCR start');
    const lines: string[] = [];
    try {
      // OCR is slow (several seconds per page); cap it so the dialog always finishes
      const pages = Math.min(pdf.numPages, 25);
      for (let p = 1; p <= pages; p++) {
        onProgress?.({ page: p, pages });
        const page = await pdf.getPage(p);
        const viewport = page.getViewport({ scale: 2.5 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) continue;
        
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;

        const { data } = await worker.recognize(canvas);
        if (data.text && data.text.trim()) {
          lines.push(data.text.normalize('NFKC').trim());
        }
        lines.push('');
      }
    } finally {
      await worker.terminate();
    }
    return { text: lines.join('\n'), pages: pdf.numPages };
  } catch (err) {
    console.error('OCR Extraction error:', err);
    return { text: '', pages: 0 };
  }
}
