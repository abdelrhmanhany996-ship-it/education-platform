import React, { useCallback, useEffect, useRef, useState } from 'react';
import type Hls from 'hls.js';
import type { ErrorData } from 'hls.js';
import { AlertTriangle, Clock, Loader2, Lock, Maximize2, Minimize2, RefreshCw, ShieldCheck, WifiOff } from 'lucide-react';
import { FloatingWatermark, TiledWatermark } from './TiledWatermark';
import { ApiError, videoApi } from '../api';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

type Phase = 'authorizing' | 'processing' | 'loading' | 'ready' | 'buffering' | 'offline' | 'error' | 'denied';

interface Props {
  /** The lecture whose video to play; the server checks the viewer's permission for it. */
  lectureId: string;
  /** Viewer name/ID drawn over the picture to discourage screen recording. */
  watermark?: string;
  /** Name and ID of the viewer, drifting over the video. */
  floatingMark?: string;
  /** True while the page may be captured (focus lost, screenshot shortcut): the video pauses. */
  concealed?: boolean;
}

/** Automatic re-authorizations before the viewer has to press "retry". */
const MAX_RECOVERIES = 3;
/** Renew the playback link this long before it expires when the viewer presses play. */
const REFRESH_MARGIN_MS = 30_000;

/**
 * Plays a private lecture video.
 *  - Cloudflare Stream: adaptive HLS straight from Cloudflare's CDN with a short-lived signed token
 *    (hls.js; Safari/iOS play HLS natively).
 *  - Fallback (no Cloudflare configured): a short-lived, browser-bound stream from this server.
 * Expired links, dropped connections and stalls are recovered from the same second.
 */
export const SecureVideoPlayer: React.FC<Props> = ({ lectureId, watermark, floatingMark, concealed }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const hlsRef = useRef<Hls | null>(null);
  const [phase, setPhase] = useState<Phase>('authorizing');
  const [message, setMessage] = useState('');
  const [hasSource, setHasSource] = useState(false);
  const online = useOnlineStatus();

  const expiresAt = useRef(0);
  const issuedAt = useRef(0);
  const resumeAt = useRef<{ time: number; play: boolean } | null>(null);
  const recoveries = useRef(0);
  const mediaRecoveries = useRef(0);
  const lastRecovery = useRef(0);
  const seq = useRef(0);
  const busy = useRef(false);
  const retryTimer = useRef<number | undefined>(undefined);

  const detach = () => {
    hlsRef.current?.destroy();
    hlsRef.current = null;
  };

  const fail = (text: string) => {
    setPhase('error');
    setMessage(text);
  };

  // hls.js keeps the handler it was given; this ref always points at the latest closure
  const onHlsErrorRef = useRef<(data: ErrorData) => void>(() => undefined);

  const attach = async (url: string, kind: 'hls' | 'file', poster: string | undefined, my: number) => {
    const v = videoRef.current;
    if (!v) return;
    detach();
    if (poster) v.poster = poster;
    if (kind === 'hls') {
      const { default: HlsLib } = await import('hls.js');
      if (my !== seq.current) return;
      if (HlsLib.isSupported()) {
        const hls = new HlsLib({ enableWorker: true, maxBufferLength: 30, backBufferLength: 60, capLevelToPlayerSize: true });
        hls.on(HlsLib.Events.ERROR, (_e, data) => onHlsErrorRef.current(data));
        hls.loadSource(url);
        hls.attachMedia(v);
        hlsRef.current = hls;
      } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
        v.src = url; // Safari / iOS
      } else {
        return fail('متصفحك لا يدعم تشغيل هذا الفيديو. استخدم أحدث إصدار من Chrome أو Safari.');
      }
    } else {
      v.src = url;
    }
    setHasSource(true);
    setPhase('loading');
  };

  const authorize = useCallback(
    async (keepPosition: boolean) => {
      if (busy.current) return;
      busy.current = true;
      window.clearTimeout(retryTimer.current);
      const my = ++seq.current;
      const v = videoRef.current;
      if (keepPosition && v && v.currentTime > 0) resumeAt.current = { time: v.currentTime, play: !v.paused && !v.ended };
      setPhase('authorizing');
      try {
        const a = await videoApi.access(lectureId);
        if (my !== seq.current) return;
        if (a.status !== 'ready') {
          if (a.status === 'failed') return fail('تعذّر تجهيز هذا الفيديو. تواصل مع الدكتور.');
          setPhase('processing');
          retryTimer.current = window.setTimeout(() => authorize(false), a.retryAfterMs || 15_000);
          return;
        }
        expiresAt.current = a.expiresAt;
        issuedAt.current = Date.now();
        if (a.provider === 'cloudflare') await attach(a.hlsUrl, 'hls', a.poster, my);
        else await attach(a.url, 'file', undefined, my);
      } catch (e) {
        if (my !== seq.current) return;
        const status = e instanceof ApiError ? e.status : 0;
        if (status === 0 && !navigator.onLine) {
          setPhase('offline');
        } else if (status === 403 || status === 404) {
          setPhase('denied');
          setMessage(e instanceof Error ? e.message : '');
        } else {
          fail(e instanceof Error ? e.message : 'تعذر تجهيز الفيديو');
        }
      } finally {
        if (my === seq.current) busy.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lectureId]
  );

  const recover = () => {
    recoveries.current++;
    lastRecovery.current = Date.now();
    authorize(true);
  };

  onHlsErrorRef.current = data => {
    const hls = hlsRef.current;
    const code = (data.response as { code?: number } | undefined)?.code;
    // An expired/rejected token never recovers by retrying the same URL: renew it straight away
    if (data.type === 'networkError' && (code === 401 || code === 403)) {
      if (recoveries.current >= MAX_RECOVERIES) return fail('انتهت صلاحية رابط التشغيل. اضغط إعادة المحاولة.');
      return recover();
    }
    if (!data.fatal) return; // hls.js retries the rest itself
    if (data.type === 'networkError') {
      if (!navigator.onLine) {
        const v = videoRef.current;
        if (v && v.currentTime > 0) resumeAt.current = { time: v.currentTime, play: true };
        setPhase('offline');
        return;
      }
      if (recoveries.current >= MAX_RECOVERIES) return fail('تعذر تشغيل الفيديو. تحقق من اتصالك ثم أعد المحاولة.');
      if (Date.now() > expiresAt.current - 5_000) return recover();
      recoveries.current++;
      lastRecovery.current = Date.now();
      window.setTimeout(() => hls?.startLoad(), 1_000 * recoveries.current);
      return;
    }
    if (data.type === 'mediaError' && mediaRecoveries.current < 2) {
      mediaRecoveries.current++;
      hls?.recoverMediaError();
      return;
    }
    fail('صيغة هذا الفيديو غير مدعومة على هذا الجهاز.');
  };

  // New lecture: forget everything about the previous one
  useEffect(() => {
    seq.current++;
    busy.current = false;
    recoveries.current = 0;
    mediaRecoveries.current = 0;
    resumeAt.current = null;
    setHasSource(false);
    authorize(false);
    const video = videoRef.current;
    return () => {
      seq.current++;
      window.clearTimeout(retryTimer.current);
      detach();
      // Stop downloading as soon as the player leaves the screen
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
    };
  }, [lectureId, authorize]);

  // Back online after a drop: pick up where the viewer was
  useEffect(() => {
    if (online && (phase === 'offline' || phase === 'error')) {
      recoveries.current = 0;
      authorize(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  useEffect(() => {
    if (concealed) videoRef.current?.pause();
  }, [concealed]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === boxRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // The browser's own fullscreen shows the bare <video> without the watermark; ours keeps it on top
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    else boxRef.current?.requestFullscreen?.().catch(() => undefined);
  };

  /** Native playback errors (internal streams, Safari HLS). hls.js reports through onHlsErrorRef instead. */
  const onError = () => {
    const v = videoRef.current;
    if (!v || !hasSource || hlsRef.current) return;
    if (!navigator.onLine) {
      if (v.currentTime > 0) resumeAt.current = { time: v.currentTime, play: true };
      setPhase('offline');
      return;
    }
    const code = v.error?.code;
    const unsupported = code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED && recoveries.current > 0 && Date.now() < expiresAt.current - 5_000;
    if (!unsupported && recoveries.current < MAX_RECOVERIES) return recover();
    fail(
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
    // Paused for a long time: renew the link now instead of failing on the next request
    const margin = Math.min(REFRESH_MARGIN_MS, (expiresAt.current - issuedAt.current) / 4);
    if (hasSource && Date.now() > expiresAt.current - margin) authorize(true);
  };

  const onPlaying = () => {
    setPhase('ready');
    if (Date.now() - lastRecovery.current > 30_000) {
      recoveries.current = 0;
      mediaRecoveries.current = 0;
    }
  };

  const retry = () => {
    recoveries.current = 0;
    mediaRecoveries.current = 0;
    authorize(true);
  };

  const blocked = phase === 'denied' || phase === 'processing' || ((phase === 'error' || phase === 'offline') && !hasSource);
  // Browsers often just stall (instead of failing) when the connection drops mid-video
  const offline = phase === 'offline' || (!online && (phase === 'buffering' || phase === 'loading' || phase === 'authorizing'));

  return (
    <div
      ref={boxRef}
      className={`relative w-full overflow-hidden bg-black select-none ${isFullscreen ? 'flex flex-col justify-center' : 'rounded-xl border border-slate-700 shadow-md'}`}
      onContextMenu={e => e.preventDefault()}
    >
      <div className={`relative w-full ${isFullscreen ? 'h-full flex-1' : 'aspect-video max-h-[70vh]'}`}>
        <video
          ref={videoRef}
          controls={hasSource}
          playsInline
          preload="metadata"
          controlsList="nodownload noremoteplayback nofullscreen"
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
          className={`absolute inset-0 h-full w-full bg-black object-contain ${blocked ? 'invisible' : ''}`}
        >
          متصفحك لا يدعم تشغيل هذا الفيديو.
        </video>

        {watermark && !blocked && <TiledWatermark text={watermark} />}

        {hasSource && !blocked && typeof document !== 'undefined' && document.fullscreenEnabled && (
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'الخروج من ملء الشاشة' : 'ملء الشاشة'}
            className="absolute top-2 left-2 z-20 rounded-lg bg-black/55 p-2 text-white hover:bg-black/75 cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        )}

        {(floatingMark || watermark) && !blocked && <FloatingWatermark text={floatingMark || watermark!} />}

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

        {phase === 'processing' && (
          <Overlay>
            <Clock className="h-8 w-8 text-amber-300" />
            <p className="text-sm font-bold text-slate-100">الفيديو قيد التجهيز للبث</p>
            <p className="text-xs text-slate-300">سيظهر هنا تلقائياً فور انتهاء المعالجة.</p>
          </Overlay>
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

        {concealed && !blocked && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-slate-950 p-4 text-center">
            <Lock className="h-8 w-8 text-slate-300" />
            <p className="text-sm font-bold text-slate-100">الفيديو مخفي لحمايته</p>
            <p className="text-xs text-slate-400">ارجع لصفحة المنصة واضغط تشغيل للمتابعة.</p>
          </div>
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
