import React, { Suspense, useState } from 'react';
import { Lecture, ExplanationPdf } from '../types';
import { useApp } from '../context/AppContext';
import { SecureVideoPlayer } from './SecureVideoPlayer';
const PdfCanvasViewer = React.lazy(() => import('./PdfCanvasViewer').then(m => ({ default: m.PdfCanvasViewer })));
import {
  FileText,
  ChevronRight,
  ChevronLeft,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Download,
  CheckCircle2,
  BookOpen,
  HelpCircle,
  Code,
  Table,
  Layers,
  Sparkles,
  Video
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
  const hasVideo = !!(lecture.videoUid || lecture.videoFileId || lecture.videoUrl);
  const [activeTab, setActiveTab] = useState<'pdf' | 'video'>(hasVideo ? 'video' : 'pdf');

  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const toggleExpand = () => {
    setIsExpanded(prev => !prev);
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const isRealPdf = !!pdf?.fileId;
  const totalPages = isRealPdf ? realPages : pdf?.pages?.length || 1;
  const activePageData = pdf?.pages?.[currentPage - 1];
  const watermark = `${currentUser?.name || ''} • ${currentUser?.academicId || ''}`;

  // Uploaded videos stream through the secure player; external links (YouTube, etc.) are embedded as before
  const videoSrc = lecture.videoUrl;

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

  // Keyboard arrow keys navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeTab !== 'pdf') return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') handleNextPage();
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') handlePrevPage();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages, activeTab]);

  const progressPct = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;
  const [showThumbnails, setShowThumbnails] = useState<boolean>(false);
  const [jumpInput, setJumpInput] = useState<string>(String(currentPage));

  React.useEffect(() => {
    setJumpInput(String(currentPage));
  }, [currentPage]);

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(jumpInput, 10);
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      setCurrentPage(p);
    } else {
      setJumpInput(String(currentPage));
    }
  };

  const renderEmbedVideo = (url: string) => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = url.includes('youtu.be')
        ? url.split('/').pop()?.split('?')[0]
        : new URLSearchParams(url.split('?')[1] || '').get('v');
      if (videoId) {
        return (
          <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            title="Video Explanation"
            className="w-full aspect-video rounded-xl border border-slate-700 shadow-md"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        );
      }
    }
    return (
      <video
        src={url}
        controls
        controlsList="nodownload noremoteplayback"
        disablePictureInPicture
        playsInline
        onContextMenu={e => e.preventDefault()}
        className="w-full max-h-[500px] rounded-xl bg-black border border-slate-700 shadow-md"
      >
        متصفحك لا يدعم تشغيل هذا الفيديو.
      </video>
    );
  };

  return (
    <div
      className={
        isExpanded
          ? "fixed inset-0 z-50 bg-slate-900 text-slate-100 overflow-y-auto p-4 md:p-6 flex flex-col min-h-screen w-screen"
          : "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden"
      }
      id="stage1-pdf-viewer"
    >
      {/* Top Reading Progress Bar */}
      <div className="w-full bg-slate-800 h-1.5 overflow-hidden relative" aria-hidden="true">
        <div
          className="bg-linear-to-r from-sky-400 via-indigo-500 to-amber-400 h-full transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Header Bar */}
      <div className="bg-slate-900 dark:bg-slate-950 text-white p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
            {activeTab === 'video' ? <Video className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
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
            <h3 className="text-base font-bold text-white mt-0.5">{pdf.title || lecture.title}</h3>
          </div>
        </div>

        {/* Mode switcher & PDF Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {hasVideo && (
            <div className="flex bg-slate-800 dark:bg-slate-700 p-1 rounded-lg border border-slate-700 text-xs">
              <button
                onClick={() => setActiveTab('video')}
                className={`px-3 py-1 rounded-md font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'video' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                فيديو الشرح
              </button>
              <button
                onClick={() => setActiveTab('pdf')}
                className={`px-3 py-1 rounded-md font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'pdf' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                ملف PDF
              </button>
            </div>
          )}

          {activeTab === 'pdf' && (
            <>
              {/* Responsive Zoom controls */}
              <div className="flex items-center bg-slate-800 dark:bg-slate-700 rounded-lg p-1 text-slate-300 border border-slate-700 text-xs">
                <button
                  type="button"
                  onClick={() => setZoomLevel(prev => Math.max(50, prev - 10))}
                  className="p-1.5 hover:text-white hover:bg-slate-700 rounded transition cursor-pointer"
                  title="تصغير"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel(100)}
                  className="px-2 font-mono hover:text-indigo-300 transition text-[12px] font-bold"
                  title="إعادة للوضع الطبيعي"
                >
                  {zoomLevel}%
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel(prev => Math.min(180, prev + 10))}
                  className="p-1.5 hover:text-white hover:bg-slate-700 rounded transition cursor-pointer"
                  title="تكبير"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>

              {/* Page navigation with Direct Jump input */}
              <div className="flex items-center bg-slate-800 dark:bg-slate-700 rounded-lg p-1 text-slate-300 border border-slate-700 text-xs">
                <button
                  type="button"
                  onClick={handlePrevPage}
                  disabled={currentPage <= 1}
                  className="p-1.5 hover:text-white hover:bg-slate-700 rounded disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                  title="الصفحة السابقة (السهم الأيمن)"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <form onSubmit={handleJumpSubmit} className="flex items-center gap-1 px-1">
                  <input
                    type="text"
                    value={jumpInput}
                    onChange={e => setJumpInput(e.target.value)}
                    className="w-8 text-center bg-slate-900 border border-slate-600 rounded text-white font-mono text-xs py-0.5 focus:outline-hidden focus:border-indigo-400"
                    title="اكتب رقم الصفحة واضغط Enter"
                  />
                  <span className="text-slate-400 font-mono">/ {totalPages}</span>
                </form>
                <button
                  type="button"
                  onClick={handleNextPage}
                  disabled={currentPage >= totalPages}
                  className="p-1.5 hover:text-white hover:bg-slate-700 rounded disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                  title="الصفحة التالية (السهم الأيسر)"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>

              {/* Toggle Thumbnails Grid */}
              <button
                type="button"
                onClick={() => setShowThumbnails(prev => !prev)}
                className={`p-1.5 rounded-lg border text-xs transition cursor-pointer ${
                  showThumbnails
                    ? 'bg-indigo-600 text-white border-indigo-400'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
                title="عرض فهرس الصفحات"
              >
                <Layers className="w-4 h-4" />
              </button>
            </>
          )}

          {/* Fullscreen Expand Button */}
          <button
            onClick={toggleExpand}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg transition border border-slate-700 text-xs flex items-center gap-1.5 cursor-pointer"
            title={isExpanded ? 'تصغير / خروج من ملء الشاشة' : 'توسيع الشاشة بالكامل'}
            aria-label="توسيع الشاشة"
          >
            {isExpanded ? <Minimize2 className="w-4 h-4 text-amber-400" /> : <Maximize2 className="w-4 h-4" />}
            <span className="hidden sm:inline font-bold text-[12px]">
              {isExpanded ? 'تصغير' : 'توسيع'}
            </span>
          </button>
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

      {/* Interactive Page Thumbnails / Slide Drawer */}
      {showThumbnails && activeTab === 'pdf' && (
        <div className="bg-slate-900 border-b border-slate-800 p-3 overflow-x-auto scroll-thin animate-fade">
          <div className="flex items-center gap-2 max-w-full">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(pNum => (
              <button
                key={pNum}
                type="button"
                onClick={() => {
                  setCurrentPage(pNum);
                  setShowThumbnails(false);
                }}
                className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                  currentPage === pNum
                    ? 'bg-indigo-600 text-white border-indigo-400 shadow-md ring-2 ring-indigo-400/40'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                صفحة {pNum}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Document / Video Viewer Canvas */}
      <div className="p-6 md:p-8 bg-slate-50 dark:bg-slate-800/40 min-h-[460px] flex flex-col justify-between">
        {activeTab === 'video' ? (
          <div className="mx-auto w-full max-w-4xl space-y-4">
            {lecture.videoUid || lecture.videoFileId ? (
              <SecureVideoPlayer
                key={`${lecture.id}:${lecture.videoUid || lecture.videoFileId}`}
                lectureId={lecture.id}
                watermark={watermark}
              />
            ) : videoSrc ? (
              renderEmbedVideo(videoSrc)
            ) : (
              <div className="py-16 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                لم يتم رفع فيديو لهذه المحاضرة بعد.
              </div>
            )}
          </div>
        ) : isRealPdf ? (
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
