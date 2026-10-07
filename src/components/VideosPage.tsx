import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Lecture } from '../types';
import { VideoConfig } from '../api';
import { LectureVideoCard } from './LectureVideoCard';
import {
  LecturePatch,
  isUploadActive,
  startVideoUpload,
  useVideoUploads,
  videoConfig,
  watchProcessing
} from '../services/videoUploads';
import { AlertTriangle, CheckCircle2, Film, Link2, Search, ShieldCheck } from 'lucide-react';

const input =
  'w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

const hasVideo = (l: Lecture) => !!(l.videoUid || l.videoFileId || l.videoUrl);

/** One lecture: upload/replace its protected video, or point it at an external link. */
const LectureVideoRow: React.FC<{ lecture: Lecture; courseTitle: string; disabled: boolean }> = ({ lecture, courseTitle, disabled }) => {
  const { updateLecture } = useApp();
  const job = useVideoUploads().find(j => j.lectureId === lecture.id);
  const busy = !!job && ['pending', 'uploading', 'processing'].includes(job.phase);
  const [error, setError] = useState('');
  const apply = (p: LecturePatch) => updateLecture(lecture.id, p);

  const pick = (file: File) => {
    setError('');
    startVideoUpload({
      lectureId: lecture.id,
      courseId: lecture.courseId,
      lectureTitle: lecture.title,
      file,
      apply,
      previous: { videoUid: lecture.videoUid, videoFileId: lecture.videoFileId }
    }).catch(e => setError(e instanceof Error ? e.message : 'تعذّر بدء الرفع'));
  };

  // Encoding that was still running when the page was last closed: pick the status up again
  useEffect(() => {
    if (!lecture.videoUid || (lecture.videoStatus !== 'processing' && lecture.videoStatus !== 'uploading') || isUploadActive(lecture.id)) return;
    const ctrl = new AbortController();
    watchProcessing(lecture.id, lecture.videoUid, apply, ctrl.signal).catch(() => undefined);
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lecture.id, lecture.videoUid, lecture.videoStatus]);

  return (
    <article className="surface p-4 space-y-3" aria-label={lecture.title}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">{lecture.title}</h4>
          <p className="text-[12px] text-slate-500 dark:text-slate-400">{courseTitle}</p>
        </div>
        {hasVideo(lecture) ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {lecture.videoUid || lecture.videoFileId ? 'فيديو مرفوع' : 'رابط خارجي'}
          </span>
        ) : (
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">بدون فيديو</span>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className={disabled && !busy ? 'opacity-60 pointer-events-none' : ''} aria-disabled={disabled && !busy}>
          <LectureVideoCard lecture={lecture} job={job} busy={busy || disabled} onPick={pick} />
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-2">
          <label htmlFor={`url-${lecture.id}`} className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <Link2 className="w-3.5 h-3.5" />
            أو رابط فيديو خارجي
          </label>
          <input
            id={`url-${lecture.id}`}
            type="url"
            dir="ltr"
            className={input}
            placeholder="https://www.youtube.com/watch?v=..."
            value={lecture.videoUrl || ''}
            onChange={e => updateLecture(lecture.id, { videoUrl: e.target.value })}
          />
          <p className="text-[11px] text-slate-500 dark:text-slate-400">YouTube / Google Drive / Vimeo. الفيديو المرفوع على المنصة أكثر حماية من الروابط الخارجية.</p>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 rounded-lg p-2">
          {error}
        </p>
      )}
    </article>
  );
};

/** All lecture videos in one place: upload in the background, see what is missing. */
export const VideosPage: React.FC<{ onOpenCourses?: () => void }> = ({ onOpenCourses }) => {
  const { courses } = useApp();
  const [cfg, setCfg] = useState<VideoConfig | null>(null);
  const [q, setQ] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);

  useEffect(() => {
    videoConfig().then(setCfg).catch(() => setCfg(null));
  }, []);

  const rows = useMemo(
    () =>
      courses.flatMap(c =>
        c.weeks.flatMap(w => w.lectures.map(l => ({ lecture: { ...l, courseId: l.courseId || c.id }, courseTitle: c.title })))
      ),
    [courses]
  );
  const missing = rows.filter(r => !hasVideo(r.lecture)).length;
  const shown = rows.filter(
    r =>
      (!onlyMissing || !hasVideo(r.lecture)) &&
      (!q.trim() || `${r.lecture.title} ${r.courseTitle}`.toLowerCase().includes(q.trim().toLowerCase()))
  );
  const blocked = cfg?.available === false;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Film className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            فيديوهات المحاضرات
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            ارفع فيديو لكل محاضرة. الرفع يكمل في الخلفية وتقدر تتنقل في المنصة، والطلاب يشاهدون الفيديو محمياً بعلامة مائية وبدون تحميل.
          </p>
        </div>
        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
          {rows.length} محاضرة · {missing} بدون فيديو
        </span>
      </header>

      {cfg && !blocked && (
        <div className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          {cfg.provider === 'cloudflare'
            ? `الفيديو يُرفع مباشرة إلى Cloudflare Stream (حتى ${Math.round(cfg.maxBytes / 1024 ** 3)} GB) ويُشغَّل بروابط مؤقتة موقّعة.`
            : `الفيديو يُرفع إلى خادم المنصة (حتى ${Math.round(cfg.maxBytes / 1024 ** 2)} MB) ويُشغَّل بروابط مؤقتة للطالب المسجّل فقط.`}
        </div>
      )}
      {blocked && (
        <div role="alert" className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          {cfg?.reason}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute top-2.5 start-3" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث باسم المحاضرة أو المقرر" className={`${input} ps-9`} />
        </div>
        <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={onlyMissing} onChange={e => setOnlyMissing(e.target.checked)} className="accent-indigo-600" />
          بدون فيديو فقط
        </label>
      </div>

      {!rows.length ? (
        <div className="surface p-8 text-center space-y-3 border-2 border-dashed border-slate-200 dark:border-slate-700">
          <p className="text-sm font-bold text-slate-600 dark:text-slate-400">لا توجد محاضرات بعد. أنشئ محاضرة أولاً ثم ارفع الفيديو الخاص بها.</p>
          {onOpenCourses && (
            <button onClick={onOpenCourses} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold">
              الذهاب إلى المقررات والمحاضرات
            </button>
          )}
        </div>
      ) : shown.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">لا توجد نتائج.</p>
      ) : (
        <div className="space-y-3">
          {shown.map(r => (
            <LectureVideoRow key={r.lecture.id} lecture={r.lecture} courseTitle={r.courseTitle} disabled={blocked} />
          ))}
        </div>
      )}
    </div>
  );
};
