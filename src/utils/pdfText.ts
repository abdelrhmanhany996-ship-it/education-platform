import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export { pdfjs };

export async function loadPdf(data: ArrayBuffer | Uint8Array) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  // pdf.js takes ownership of the buffer, so hand it a copy.
  return pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: true }).promise;
}

/**
 * Text of a PDF, one visual line per row, in reading order.
 * Arabic PDFs usually store letters as "presentation forms"; NFKC turns them back into normal letters.
 */
export async function extractTextFromPdf(file: File | Blob): Promise<{ text: string; pages: number }> {
  const pdf = await loadPdf(await file.arrayBuffer());
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

  return { text: lines.join('\n').normalize('NFKC'), pages: pdf.numPages };
}

/**
 * OCR fallback for scanned/image-only PDFs (no embedded text layer). Renders each page to a
 * canvas and runs Tesseract (Arabic + English) on it. Much slower than extractTextFromPdf,
 * so callers should only reach for this after the text layer comes back empty.
 */
export async function extractTextViaOcr(
  file: File | Blob,
  onProgress?: (info: { page: number; pages: number }) => void
): Promise<{ text: string; pages: number }> {
  const pdf = await loadPdf(await file.arrayBuffer());
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker(['ara', 'eng']);
  const lines: string[] = [];
  try {
    for (let p = 1; p <= pdf.numPages; p++) {
      onProgress?.({ page: p, pages: pdf.numPages });
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      const { data } = await worker.recognize(canvas);
      if (data.text.trim()) lines.push(data.text.normalize('NFKC').trim());
      lines.push('');
    }
  } finally {
    await worker.terminate();
  }
  return { text: lines.join('\n'), pages: pdf.numPages };
}
