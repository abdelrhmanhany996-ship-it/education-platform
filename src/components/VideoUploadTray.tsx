import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Film, Loader2, X } from 'lucide-react';
import { UploadJob, cancelUpload, dismissUpload, useVideoUploads } from '../services/videoUploads';
import { ProgressBar, formatBytes, uploadRate } from './LectureVideoCard';

const LABEL: Record<UploadJob['phase'], string> = {
  pending: 'جارٍ التجهيز',
  uploading: 'جارٍ الرفع',
  processing: 'جارٍ تجهيز البث',
  ready: 'جاهز',
  failed: 'فشل',
  canceled: 'أُلغي'
};

/** Floating panel listing background video uploads, visible on every screen while they run. */
export const VideoUploadTray: React.FC = () => {
  const jobs = useVideoUploads();
  const [collapsed, setCollapsed] = useState(false);

  // Finished uploads clear themselves after a short while
  useEffect(() => {
    const done = jobs.filter(j => j.phase === 'ready' || j.phase === 'canceled');
    if (!done.length) return;
    const t = window.setTimeout(() => done.forEach(j => dismissUpload(j.lectureId)), 12_000);
    return () => window.clearTimeout(t);
  }, [jobs]);

  if (!jobs.length) return null;
  const active = jobs.filter(j => j.phase === 'pending' || j.phase === 'uploading' || j.phase === 'processing').length;

  return (
    <section
      aria-label="رفع الفيديوهات"
      className="fixed bottom-4 left-4 z-40 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
    >
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="flex w-full items-center justify-between gap-2 bg-slate-900 px-4 py-2.5 text-sm font-bold text-white dark:bg-slate-950 cursor-pointer"
      >
        <span className="flex items-center gap-2">
          {active ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
          {active ? `رفع ${active} فيديو` : 'رفع الفيديوهات'}
        </span>
        {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {!collapsed && (
        <ul className="max-h-[50vh] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
          {jobs.map(j => (
            <li key={j.lectureId} className="space-y-1.5 px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{j.lectureTitle}</div>
                  <div className="truncate text-[11px] text-slate-500 dark:text-slate-400" dir="ltr">
                    {j.fileName} · {formatBytes(j.size)}
                  </div>
                </div>
                {j.phase === 'uploading' || j.phase === 'pending' ? (
                  <button type="button" onClick={() => cancelUpload(j.lectureId)} className="shrink-0 rounded-md px-2 py-0.5 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10 cursor-pointer">
                    إلغاء
                  </button>
                ) : j.phase !== 'processing' ? (
                  <button type="button" aria-label="إخفاء" onClick={() => dismissUpload(j.lectureId)} className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
              {(j.phase === 'uploading' || j.phase === 'processing' || j.phase === 'pending') && (
                <ProgressBar value={j.phase === 'pending' || (j.phase === 'processing' && !j.progress) ? undefined : j.progress} tone={j.phase === 'processing' ? 'amber' : 'indigo'} />
              )}
              <div
                className={`flex items-center gap-1.5 text-[11px] font-bold ${
                  j.phase === 'ready' ? 'text-emerald-600 dark:text-emerald-400' : j.phase === 'failed' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {j.phase === 'ready' && <CheckCircle2 className="h-3.5 w-3.5" />}
                {j.phase === 'failed' && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
                <span className="min-w-0">
                  {LABEL[j.phase]}
                  {j.phase === 'uploading' && ` ${j.progress}%${uploadRate(j) ? ` • ${uploadRate(j)}` : ''}`}
                  {j.phase === 'processing' && ' — يمكنك متابعة عملك'}
                  {j.phase === 'failed' && j.error && ` — ${j.error}`}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
