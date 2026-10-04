import * as pdfjs from 'pdfjs-dist';
import { textLooksReadable } from './pdfQuestionParser';

if (typeof window !== 'undefined') {
  const version = pdfjs.version || '6.3.289';
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
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
      let line = '';
      let lastY: number | null = null;

      for (const item of content.items as any[]) {
        if (typeof item.str !== 'string') continue;
        const y = Math.round(item.transform[5]);
        if (lastY !== null && Math.abs(y - lastY) > 3) {
          if (line.trim()) lines.push(line.trim());
          line = '';
        }
        line += item.str;
        if (item.hasEOL) {
          if (line.trim()) lines.push(line.trim());
          line = '';
        }
        lastY = y;
      }
      if (line.trim()) lines.push(line.trim());
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
