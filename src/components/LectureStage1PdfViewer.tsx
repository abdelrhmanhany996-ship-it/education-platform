import React, { Suspense, useState } from 'react';
import { Lecture, ExplanationPdf } from '../types';
import { useApp } from '../context/AppContext';
const PdfCanvasViewer = React.lazy(() => import('./PdfCanvasViewer').then(m => ({ default: m.PdfCanvasViewer })));
import {
  FileText,
  ChevronRight,
  ChevronLeft,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  CheckCircle2,
  BookOpen,
  HelpCircle,
  Code,
  Table,
  Layers,
  Sparkles
} from 'lucide-react';

interface LectureStage1PdfViewerProps {
  lecture: Lecture;
  isCompleted: boolean;
  onCompleteStage1: () => void;
  canProceedToStage2: boolean;
}

export const LectureStage1PdfViewer: React.FC<LectureStage1PdfViewerProps> = ({
  lecture,
  isCompleted,
  onCompleteStage1,
  canProceedToStage2
}) => {
  const pdf = lecture.explanationPdf;
  const { currentUser } = useApp();
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [realPages, setRealPages] = useState<number>(pdf?.pageCount || 1);
  const isRealPdf = !!pdf?.fileId;
  const totalPages = isRealPdf ? realPages : pdf?.pages?.length || 1;
  const activePageData = pdf?.pages?.[currentPage - 1];
  const watermark = `${currentUser?.name || ''} • ${currentUser?.academicId || ''}`;

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden" id="stage1-pdf-viewer">
      {/* Header Bar */}
      <div className="bg-slate-900 dark:bg-slate-950 text-white p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-500/30">
                المرحلة 1: عرض شرح المحاضرة
              </span>
              {isCompleted && (
                <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md flex items-center gap-1 border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3" />
                  تم الاطلاع
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-white mt-0.5">{pdf.title}</h3>
          </div>
        </div>

        {/* PDF Controls */}
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="hidden sm:flex items-center bg-slate-800 dark:bg-slate-700 rounded-lg p-1 text-slate-300 border border-slate-700 text-xs">
            <button
              onClick={() => setZoomLevel(prev => Math.max(80, prev - 10))}
              className="p-1.5 hover:text-white hover:bg-slate-700 rounded transition cursor-pointer"
              title="تصغير"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono">{zoomLevel}%</span>
            <button
              onClick={() => setZoomLevel(prev => Math.min(140, prev + 10))}
              className="p-1.5 hover:text-white hover:bg-slate-700 rounded transition cursor-pointer"
              title="تكبير"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* Page navigation */}
          <div className="flex items-center bg-slate-800 dark:bg-slate-700 rounded-lg p-1 text-slate-300 border border-slate-700 text-xs">
            <button
              onClick={handlePrevPage}
              disabled={currentPage <= 1}
              className="p-1.5 hover:text-white hover:bg-slate-700 rounded disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
              title="الصفحة السابقة"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="px-3 font-bold font-mono">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={handleNextPage}
              disabled={currentPage >= totalPages}
              className="p-1.5 hover:text-white hover:bg-slate-700 rounded disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
              title="الصفحة التالية"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>

      {/* Topics Tags Bar */}
      <div
        className={`bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex-wrap items-center gap-2 text-xs ${
          pdf.topics.length ? 'flex' : 'hidden'
        }`}
      >
        <span className="font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
          <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          المحاور الرئيسية:
        </span>
        {pdf.topics.map((t, idx) => (
          <span
            key={idx}
            className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 px-2.5 py-0.5 rounded-full border border-slate-300 dark:border-slate-600 font-medium"
          >
            {t}
          </span>
        ))}
      </div>

      {/* Main Document Viewer Canvas */}
      <div className="p-6 md:p-8 bg-slate-50 dark:bg-slate-800/40 min-h-[460px] flex flex-col justify-between">
        {isRealPdf ? (
          <div className="mx-auto w-full max-w-4xl">
            <Suspense fallback={<div className="py-16 text-center text-sm text-slate-500">جارٍ تحميل الشرح...</div>}>
            <PdfCanvasViewer
              fileId={pdf.fileId!}
              page={currentPage}
              zoom={zoomLevel}
              watermark={watermark}
              onLoaded={setRealPages}
            />
            </Suspense>
          </div>
        ) : (
        <div
          className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6 md:p-8 shadow-sm transition-all mx-auto w-full max-w-4xl"
          style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
        >
          {activePageData ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center text-sm">
                    {currentPage}
                  </span>
                  <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">{activePageData.title}</h4>
                </div>
                <span className="text-xs text-slate-400">
                  {lecture.title}
                </span>
              </div>

              {/* Page Content Body */}
              <div className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm whitespace-pre-line font-normal">
                {activePageData.content}
              </div>

              {/* Interactive Illustration Box */}
              {activePageData.diagramType === 'table' && (
                <div className="bg-indigo-50/50 dark:bg-indigo-500/10 rounded-xl p-4 border border-indigo-100 dark:border-indigo-500/25 mt-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 dark:text-indigo-200 mb-2">
                    <Table className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    مخطط بياني توضيحي للمقارنة
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-indigo-100 dark:border-indigo-500/25">
                      <div className="font-bold text-slate-900 dark:text-slate-100">O(1)</div>
                      <div className="text-[12px] text-slate-500 dark:text-slate-400">ثابت - ممتاز</div>
                    </div>
                    <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-indigo-100 dark:border-indigo-500/25">
                      <div className="font-bold text-slate-900 dark:text-slate-100">O(log n)</div>
                      <div className="text-[12px] text-slate-500 dark:text-slate-400">لوغاريتمي - فائق السرعة</div>
                    </div>
                    <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-indigo-100 dark:border-indigo-500/25">
                      <div className="font-bold text-slate-900 dark:text-slate-100">O(n)</div>
                      <div className="text-[12px] text-slate-500 dark:text-slate-400">خطي - معتدل</div>
                    </div>
                    <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-indigo-100 dark:border-indigo-500/25">
                      <div className="font-bold text-rose-600 dark:text-rose-400">O(n^2)</div>
                      <div className="text-[12px] text-rose-500">تربيعي - مكلف</div>
                    </div>
                  </div>
                </div>
              )}

              {activePageData.diagramType === 'code' && (
                <div className="bg-slate-950 text-slate-200 rounded-xl p-4 font-mono text-xs text-left" dir="ltr">
                  <div className="text-slate-400 text-[12px] mb-1 font-sans">// Example Analysis</div>
                  <div>for (let i = 0; i &lt; n; i++) &#123;</div>
                  <div className="pl-4">for (let j = 0; j &lt; n; j++) &#123;</div>
                  <div className="pl-8 text-emerald-400">// Inner body executes N * N times =&gt; O(n^2)</div>
                  <div className="pl-4">&#125;</div>
                  <div>&#125;</div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500 dark:text-slate-400">لا توجد صفحات إضافية لعرضها.</div>
          )}
        </div>
        )}

        {/* Completion & Next Stage Trigger */}
        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-600 dark:text-slate-400">
            {isCompleted ? (
              <span className="text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                أتممت مراجعة هذا الشرح. يمكنك الانتقال لتسجيل الحضور في أي وقت.
              </span>
            ) : (
              <span>
                💡 عند الانتهاء من قراءة الشرح، اضغط على الزر المقابل لتأكيد الإتمام وفتح مرحلة تسجيل الحضور.
              </span>
            )}
          </div>

          <button
            id="finish-pdf-stage1-btn"
            onClick={onCompleteStage1}
            className={`px-6 py-3 rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer ${
              isCompleted
                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/25 hover:bg-emerald-100 dark:hover:bg-emerald-500/15'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            {isCompleted ? 'تم إتمام المرحلة 1 (إعادة التأكيد)' : 'تم إنهاء قراءة الشرح والانتقال لتسجيل الحضور ←'}
          </button>
        </div>
      </div>
    </div>
  );
};
