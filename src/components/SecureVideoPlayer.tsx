import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Lock, RefreshCw, ShieldCheck, WifiOff } from 'lucide-react';
import { ApiError, requestVideoGrant } from '../api';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

type Phase = 'authorizing' | 'loading' | 'ready' | 'buffering' | 'offline' | 'error' | 'denied';

interface Props {
  /** Id of the uploaded lecture video. */
  fileId: string;
  /** Viewer name/ID drawn over the picture to discourage screen recording. */
  watermark?: string;
}

/** Automatic re-authorizations before the viewer has to press "retry". */
const MAX_RECOVERIES = 3;
/** Re-authorize this long before the playback link runs out when the viewer presses play. */
const REFRESH_MARGIN_MS = 30_000;
const WATERMARK_SPOTS = ['top-4 right-4', 'bottom-16 left-4', 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2', 'top-4 left-4', 'bottom-16 right-4'];

/**
 * Streams a private lecture video.
 * The server checks the viewer's access and returns a short-lived link bound to their account and browser;
 * the file itself is never public. When the link expires (or the network drops) the player fetches a new one
 * and resumes from the same second.
 */
export const SecureVideoPlayer: React.FC<Props> = ({ fileId, watermark }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string>();
  const [phase, setPhase] = useState<Phase>('authorizing');
  const [message, setMessage] = useState('');
  const [spot, setSpot] = useState(0);
  const online = useOnlineStatus();

  const expiresAt = useRef(0);
  const issuedAt = useRef(0);
  const resumeAt = useRef<{ time: number; play: boolean } | null>(null);
  const recoveries = useRef(0);
  const lastRecovery = useRef(0);
  const seq = useRef(0);
  const busy = useRef(false);

  const authorize = useCallback(
    async (keepPosition: boolean) => {
      if (busy.current) return;
      busy.current = true;
      const my = ++seq.current;
      const v = videoRef.current;
      if (keepPosition && v && v.currentTime > 0) resumeAt.current = { time: v.currentTime, play: !v.paused && !v.ended };
      setPhase('authorizing');
      try {
        const grant = await requestVideoGrant(fileId);
        if (my !== seq.current) return;
        expiresAt.current = grant.expiresAt;
        issuedAt.current = Date.now();
        setSrc(grant.url);
        setPhase('loading');
      } catch (e) {
        if (my !== seq.current) return;
        const status = e instanceof ApiError ? e.status : 0;
        if (status === 0 && !navigator.onLine) {
          setPhase('offline');
        } else {
          setPhase(status === 403 || status === 404 ? 'denied' : 'error');
          setMessage(e instanceof Error ? e.message : 'تعذر تجهيز الفيديو');
        }
      } finally {
        if (my === seq.current) busy.current = false;
      }
    },
    [fileId]
  );

  // New video: forget everything about the previous one
  useEffect(() => {
    seq.current++;
    busy.current = false;
    recoveries.current = 0;
    resumeAt.current = null;
    setSrc(undefined);
    authorize(false);
    const video = videoRef.current;
    return () => {
      seq.current++;
      // Stop downloading as soon as the player leaves the screen
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
    };
  }, [fileId, authorize]);

  // Back online after a drop: pick up where the viewer was
  useEffect(() => {
    if (online && (phase === 'offline' || phase === 'error')) {
      recoveries.current = 0;
      authorize(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  // Move the watermark now and then so it cannot simply be cropped out
  useEffect(() => {
    if (!watermark) return;
    const t = window.setInterval(() => setSpot(s => (s + 1) % WATERMARK_SPOTS.length), 20_000);
    return () => window.clearInterval(t);
  }, [watermark]);

  const recover = () => {
    recoveries.current++;
    lastRecovery.current = Date.now();
    authorize(true);
  };

  const onError = () => {
    const v = videoRef.current;
    if (!v || !src) return;
    if (!navigator.onLine) {
      if (v.currentTime > 0) resumeAt.current = { time: v.currentTime, play: true };
      setPhase('offline');
      return;
    }
    const code = v.error?.code;
    // A format the device cannot decode stays broken however fresh the link is
    const unsupported = code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED && recoveries.current > 0 && Date.now() < expiresAt.current - 5_000;
    if (!unsupported && recoveries.current < MAX_RECOVERIES) return recover();
    setPhase('error');
    setMessage(
      code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED || code === MediaError.MEDIA_ERR_DECODE
        ? 'صيغة هذا الفيديو غير مدعومة على هذا الجهاز. جرّب متصفح Chrome أو اطلب من الدكتور رفعه بصيغة MP4.'
        : 'تعذر تشغيل الفيديو. تحقق من اتصالك ثم أعد المحاولة.'
    );
  };

  const onLoadedMetadata = () => {
    const v = videoRef.current;
    const r = resumeAt.current;
    resumeAt.current = null;
    if (!v) return;
    if (r) {
      v.currentTime = Math.min(r.time, Math.max(0, (v.duration || r.time) - 0.5));
      if (r.play) v.play().catch(() => undefined);
    }
    setPhase('ready');
  };

  const onPlay = () => {
    // Paused for a long time: renew the link now instead of failing on the next range request
    const margin = Math.min(REFRESH_MARGIN_MS, (expiresAt.current - issuedAt.current) / 4);
    if (src && Date.now() > expiresAt.current - margin) authorize(true);
  };

  const onPlaying = () => {
    setPhase('ready');
    if (Date.now() - lastRecovery.current > 30_000) recoveries.current = 0;
  };

  const retry = () => {
    recoveries.current = 0;
    authorize(true);
  };

  const blocked = phase === 'denied' || ((phase === 'error' || phase === 'offline') && !src);
  // Browsers often just stall (instead of failing) when the connection drops mid-video
  const offline = phase === 'offline' || (!online && (phase === 'buffering' || phase === 'loading' || phase === 'authorizing'));

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl bg-black border border-slate-700 shadow-md select-none"
      onContextMenu={e => e.preventDefault()}
    >
      <div className="relative aspect-video w-full max-h-[70vh]">
        {!blocked && (
          <video
            ref={videoRef}
            src={src}
            controls
            playsInline
            preload="metadata"
            controlsList="nodownload noremoteplayback"
            disablePictureInPicture
            disableRemotePlayback
            draggable={false}
            onDragStart={e => e.preventDefault()}
            onLoadedMetadata={onLoadedMetadata}
            onWaiting={() => setPhase(p => (p === 'ready' ? 'buffering' : p))}
            onPlaying={onPlaying}
            onCanPlay={() => setPhase(p => (p === 'buffering' || p === 'loading' ? 'ready' : p))}
            onPlay={onPlay}
            onError={onError}
            className="absolute inset-0 h-full w-full bg-black object-contain"
          >
            متصفحك لا يدعم تشغيل هذا الفيديو.
          </video>
        )}

        {watermark && !blocked && (
          <div
            aria-hidden
            className={`pointer-events-none absolute ${WATERMARK_SPOTS[spot]} rounded-md bg-black/20 px-2 py-1 text-[11px] sm:text-xs font-bold text-white/45 transition-all duration-1000`}
          >
            {watermark}
          </div>
        )}

        {!offline && (phase === 'authorizing' || phase === 'loading') && (
          <Overlay>
            <Loader2 className="h-8 w-8 animate-spin text-indigo-300" />
            <p className="text-sm font-bold text-slate-200">{resumeAt.current ? 'جارٍ استكمال التشغيل…' : 'جارٍ تجهيز الفيديو…'}</p>
          </Overlay>
        )}

        {!offline && phase === 'buffering' && (
          <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-xs font-bold text-slate-100">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            جارٍ التحميل…
          </div>
        )}

        {offline && (
          <Overlay>
            <WifiOff className="h-8 w-8 text-amber-300" />
            <p className="text-sm font-bold text-slate-100">انقطع الاتصال بالإنترنت</p>
            <p className="text-xs text-slate-300">سيُستكمل الفيديو تلقائياً من نفس الثانية عند عودة الاتصال.</p>
          </Overlay>
        )}

        {phase === 'error' && (
          <Overlay>
            <AlertTriangle className="h-8 w-8 text-rose-300" />
            <p className="max-w-md text-sm font-bold text-slate-100">{message}</p>
            <button
              type="button"
              onClick={retry}
              className="mt-1 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              إعادة المحاولة
            </button>
          </Overlay>
        )}

        {phase === 'denied' && (
          <Overlay>
            <Lock className="h-8 w-8 text-slate-300" />
            <p className="max-w-md text-sm font-bold text-slate-100">{message || 'هذا الفيديو غير متاح لحسابك'}</p>
          </Overlay>
        )}
      </div>

      <div className="flex items-center gap-1.5 border-t border-slate-800 bg-slate-950 px-3 py-1.5 text-[11px] text-slate-400">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
        محتوى محمي: المشاهدة داخل المنصة فقط ومخصّصة لحسابك.
      </div>
    </div>
  );
};

const Overlay: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/85 p-4 text-center">{children}</div>
);

export default SecureVideoPlayer;
