import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getFile } from '../utils/fileStore';
import { loadPdf } from '../utils/pdfText';
import { Loader2, FileWarning } from 'lucide-react';

interface Props {
  fileId: string;
  page: number;
  zoom: number; // percent
  watermark: string;
  onLoaded?: (pages: number) => void;
}

/**
 * Draws one PDF page on a canvas. There is no download button and the page is covered by the
 * student's name + code, which makes leaked screenshots traceable (a screenshot itself cannot be blocked).
 */
export const PdfCanvasViewer: React.FC<Props> = ({ fileId, page, zoom, watermark, onLoaded }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<Awaited<ReturnType<typeof loadPdf>> | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [width, setWidth] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    (async () => {
      try {
        const blob = await getFile(fileId);
        if (!blob) {
          if (!cancelled) setStatus('missing');
          return;
        }
        const pdf = await loadPdf(await blob.arrayBuffer());
        if (cancelled) return;
        setDoc(pdf);
        setStatus('ready');
        onLoaded?.(pdf.numPages);
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fileId]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!doc || !canvasRef.current || !width) return;
    let task: { cancel: () => void; promise: Promise<unknown> } | null = null;
    let cancelled = false;

    (async () => {
      const pdfPage = await doc.getPage(Math.min(Math.max(1, page), doc.numPages));
      const base = pdfPage.getViewport({ scale: 1 });
      const scale = (width / base.width) * (zoom / 100);
      const viewport = pdfPage.getViewport({ scale });
      const canvas = canvasRef.current!;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      const ctx = canvas.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (cancelled) return;
      task = pdfPage.render({ canvas, canvasContext: ctx, viewport });
      try {
        await task.promise;
      } catch {
        /* a newer render replaced this one */
      }
    })();

    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, page, zoom, width]);

  // Repeating diagonal name tag
  const tile = useMemo(() => {
    const safe = watermark.replace(/[<>&"]/g, '');
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="200">` +
      `<text x="180" y="100" text-anchor="middle" transform="rotate(-24 180 100)" ` +
      `font-family="sans-serif" font-size="18" font-weight="700" fill="rgba(90,100,110,0.16)">${safe}</text></svg>`;
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
  }, [watermark]);

  if (status === 'missing' || status === 'error') {
    return (
      <div className="py-16 text-center text-slate-500 dark:text-slate-400 space-y-2">
        <FileWarning className="w-10 h-10 mx-auto text-amber-500" />
        <p className="text-sm font-bold">
          {status === 'missing' ? 'ملف الشرح غير موجود على هذا الجهاز' : 'تعذر عرض ملف الـ PDF'}
        </p>
        <p className="text-xs max-w-sm mx-auto">
          {status === 'missing'
            ? 'الملفات المرفوعة تُحفظ في متصفح الدكتور الذي رفعها. النسخة الحالية تجريبية بلا خادم، فاطلب من الدكتور رفع الملف من هذا المتصفح.'
            : 'قد يكون الملف تالفاً أو محمياً بكلمة مرور.'}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={boxRef}
      data-no-print
      className="relative w-full overflow-auto select-none"
      onContextMenu={e => e.preventDefault()}
    >
      {status === 'loading' && (
        <div className="py-16 flex items-center justify-center text-slate-500 dark:text-slate-400 gap-2 text-sm">
          <Loader2 className="w-5 h-5 animate-spin" />
          جارٍ تحميل الشرح...
        </div>
      )}
      <div className="relative inline-block min-w-full text-center">
        <canvas ref={canvasRef} className="mx-auto bg-white dark:bg-slate-900 shadow-sm rounded-md" />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: tile, backgroundRepeat: 'repeat' }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
};
