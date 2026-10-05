import React from 'react';
import { AlertTriangle, CheckCircle2, Film, Loader2, Upload, X } from 'lucide-react';
import type { Lecture } from '../types';
import { UploadJob, cancelUpload } from '../services/videoUploads';

export const formatBytes = (n: number) =>
  n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(2)} GB` : n >= 1024 ** 2 ? `${(n / 1024 ** 2).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

export const formatDuration = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
};

/** "4.2 MB/ث • متبقٍ 3 د" */
export function uploadRate(job: UploadJob) {
  if (!job.speed || job.speed < 1) return '';
  const left = (job.size - job.sentBytes) / job.speed;
  const eta = left < 60 ? 'أقل من دقيقة' : left < 3600 ? `${Math.ceil(left / 60)} د` : `${(left / 3600).toFixed(1)} س`;
  return `${formatBytes(job.speed)}/ث • متبقٍ ${eta}`;
}

export const ProgressBar: React.FC<{ value?: number; tone?: 'indigo' | 'amber' }> = ({ value, tone = 'indigo' }) => (
  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
    {value === undefined ? (
      <div className={`h-full w-1/3 animate-[indeterminate_1.4s_ease-in-out_infinite] rounded-full ${tone === 'amber' ? 'bg-amber-500' : 'bg-indigo-600'}`} />
    ) : (
      <div className={`h-full rounded-full transition-[width] duration-300 ${tone === 'amber' ? 'bg-amber-500' : 'bg-indigo-600'}`} style={{ width: `${Math.min(100, value)}%` }} />
    )}
  </div>
);

interface Props {
  lecture: Lecture;
  job?: UploadJob;
  busy: boolean;
  onPick: (file: File) => void;
}

/** Upload / replace the lecture video and follow it through uploading → processing → ready. */
export const LectureVideoCard: React.FC<Props> = ({ lecture, job, busy, onPick }) => {
  const hasVideo = !!(lecture.videoUid || lecture.videoFileId);
  const processing = job?.phase === 'processing' || (!job && (lecture.videoStatus === 'processing' || lecture.videoStatus === 'uploading'));

  let body: React.ReactNode;
  if (job?.phase === 'pending') {
    body = <Status icon={<Loader2 className="h-3.5 w-3.5 animate-spin" />} text="جارٍ تجهيز الرفع…" />;
  } else if (job?.phase === 'uploading') {
    body = (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-bold text-indigo-700 dark:text-indigo-300">جارٍ الرفع {job.progress}%</span>
          <button type="button" onClick={() => cancelUpload(lecture.id)} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-bold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10 cursor-pointer">
            <X className="h-3.5 w-3.5" />
            إلغاء
          </button>
        </div>
        <ProgressBar value={job.progress} />
        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
          {formatBytes(job.sentBytes)} من {formatBytes(job.size)}
          {uploadRate(job) && ` • ${uploadRate(job)}`}
        </div>
      </div>
    );
  } else if (processing) {
    body = (
      <div className="space-y-1.5">
        <Status icon={<Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600" />} text={`يتم تجهيز الفيديو للبث${job?.progress ? ` (${job.progress}%)` : ''}… يمكنك متابعة عملك`} />
        <ProgressBar value={job?.progress || undefined} tone="amber" />
      </div>
    );
  } else if (job?.phase === 'failed') {
    body = (
      <Status
        tone="error"
        icon={<AlertTriangle className="h-3.5 w-3.5" />}
        text={`${job.error || 'فشل الرفع'}${job.resumable ? ' — اختر نفس الملف مرة أخرى لاستكمال الرفع من حيث توقف.' : ''}`}
      />
    );
  } else if (lecture.videoStatus === 'failed') {
    body = <Status tone="error" icon={<AlertTriangle className="h-3.5 w-3.5" />} text="فشلت معالجة الفيديو. ارفعه مرة أخرى (يفضّل MP4)." />;
  } else if (hasVideo) {
    body = (
      <Status
        tone="ok"
        icon={<CheckCircle2 className="h-3.5 w-3.5" />}
        text={`جاهز للمشاهدة ومحمي من التحميل${lecture.videoDuration ? ` • ${formatDuration(lecture.videoDuration)}` : ''}${job?.phase === 'canceled' ? ' • تم إلغاء الرفع الجديد' : ''}`}
      />
    );
  } else {
    body = <Status text={job?.phase === 'canceled' ? 'تم إلغاء الرفع' : 'MP4 / MOV / WebM — يُرفع في الخلفية ويمكنك متابعة عملك'} />;
  }

  return (
    <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Film className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">فيديو الشرح</span>
        </div>
        <label
          className={`inline-flex shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-bold text-white transition-colors hover:bg-indigo-700 cursor-pointer ${busy ? 'opacity-60 pointer-events-none' : ''}`}
          aria-disabled={busy}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {hasVideo ? 'استبدال' : 'رفع فيديو'}
          <input
            type="file"
            accept="video/*,.mp4,.m4v,.mov,.webm,.mkv"
            className="sr-only"
            disabled={busy}
            onChange={e => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) onPick(f);
            }}
          />
        </label>
      </div>
      {body}
    </div>
  );
};

const Status: React.FC<{ text: string; icon?: React.ReactNode; tone?: 'ok' | 'error' | 'muted' }> = ({ text, icon, tone = 'muted' }) => (
  <div
    className={`flex items-start gap-1.5 text-xs leading-relaxed ${
      tone === 'ok' ? 'text-emerald-700 dark:text-emerald-400' : tone === 'error' ? 'text-rose-700 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'
    }`}
  >
    {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
    <span>{text}</span>
  </div>
);
