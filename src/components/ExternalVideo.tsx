import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Maximize2, Minimize2, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { FloatingWatermark, TiledWatermark } from './TiledWatermark';
import { useProtectedFullscreen } from '../hooks/useProtectedFullscreen';
import { ApiError, videoApi } from '../api';

const youtubeId = (url: string) => {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('/')[0] || null;
    if (u.pathname.startsWith('/embed/') || u.pathname.startsWith('/shorts/') || u.pathname.startsWith('/live/')) return u.pathname.split('/')[2] || null;
    return u.searchParams.get('v');
  } catch {
    return null;
  }
};

/* ------------------------------ YouTube IFrame API ----------------------------- */

type YTPlayer = {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(s: number, allowAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  setPlaybackRate(r: number): void;
  destroy(): void;
};
let ytApi: Promise<any> | null = null;
const loadYouTubeApi = () =>
  (ytApi ||= new Promise((resolve, reject) => {
    const w = window as any;
    if (w.YT?.Player) return resolve(w.YT);
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(w.YT);
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => {
      ytApi = null;
      reject(new Error('youtube'));
    };
    document.head.appendChild(s);
  }));

const fmt = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60),
    sec = Math.floor(s % 60);
  return `${h ? `${h}:${String(m).padStart(2, '0')}` : m}:${String(sec).padStart(2, '0')}`;
};
const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

/**
 * YouTube video with our own controls. The YouTube frame itself receives no clicks or right-clicks, so its
 * title, share button, logo and "copy video URL" menu (all of which reveal the link) cannot be reached.
 */
const YouTubeLocked: React.FC<{ id: string }> = ({ id }) => {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    let cancelled = false;
    const el = document.createElement('div');
    host.current?.appendChild(el);
    loadYouTubeApi()
      .then(YT => {
        if (cancelled) return;
        player.current = new YT.Player(el, {
          videoId: id,
          host: 'https://www.youtube-nocookie.com',
          playerVars: { controls: 0, disablekb: 1, fs: 0, rel: 0, modestbranding: 1, playsinline: 1, iv_load_policy: 3, cc_load_policy: 0 },
          events: {
            onReady: () => {
              if (cancelled) return;
              setReady(true);
              setDuration(player.current?.getDuration() || 0);
            },
            onStateChange: (e: { data: number }) => setPlaying(e.data === 1 || e.data === 3),
            onError: () => setFailed(true)
          }
        });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      try {
        player.current?.destroy();
      } catch {
        /* already gone */
      }
      player.current = null;
      el.remove();
    };
  }, [id]);

  useEffect(() => {
    if (!ready) return;
    const t = window.setInterval(() => {
      const p = player.current;
      if (!p) return;
      setTime(p.getCurrentTime() || 0);
      setDuration(p.getDuration() || 0);
    }, 500);
    return () => window.clearInterval(t);
  }, [ready]);

  const toggle = () => {
    const p = player.current;
    if (!p || !ready) return;
    playing ? p.pauseVideo() : p.playVideo();
  };
  const seek = (s: number) => {
    player.current?.seekTo(s, true);
    setTime(s);
  };

  return (
    <>
      {/* The frame: no pointer events, so nothing inside YouTube's player can be clicked */}
      <div ref={host} className="absolute inset-0 pointer-events-none [&>iframe]:h-full [&>iframe]:w-full" aria-hidden />
      {/* Click surface over the whole frame: play / pause, and no context menu */}
      <button
        type="button"
        aria-label={playing ? 'إيقاف مؤقت' : 'تشغيل'}
        onClick={toggle}
        onContextMenu={e => e.preventDefault()}
        className="absolute inset-0 z-[5] cursor-pointer bg-transparent"
      >
        {ready && !playing && (
          <span className="absolute inset-0 m-auto flex h-16 w-16 items-center justify-center rounded-full bg-black/60 text-white ring-1 ring-white/30">
            <Play className="h-7 w-7 translate-x-0.5" />
          </span>
        )}
      </button>
      {!ready && !failed && (
        <div className="absolute inset-0 z-[6] flex items-center justify-center bg-black">
          <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
        </div>
      )}
      {failed && (
        <div className="absolute inset-0 z-[6] flex flex-col items-center justify-center gap-2 bg-black text-center text-slate-200">
          <AlertTriangle className="h-7 w-7 text-amber-400" />
          <p className="text-sm font-bold">تعذر تشغيل الفيديو. تأكد من الاتصال ثم أعد فتح المحاضرة.</p>
        </div>
      )}
      {ready && (
        <div dir="ltr" className="absolute inset-x-0 bottom-0 z-[25] flex items-center gap-2 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-6 text-white">
          <button type="button" onClick={toggle} aria-label={playing ? 'إيقاف مؤقت' : 'تشغيل'} className="rounded p-1.5 hover:bg-white/15 cursor-pointer">
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <span className="text-[11px] tabular-nums text-white/85">{fmt(time)}</span>
          <input
            type="range"
            min={0}
            max={Math.max(duration, 1)}
            step={1}
            value={Math.min(time, duration || 0)}
            onChange={e => seek(Number(e.target.value))}
            aria-label="موضع التشغيل"
            className="h-1 flex-1 cursor-pointer accent-indigo-500"
          />
          <span className="text-[11px] tabular-nums text-white/85">{fmt(duration)}</span>
          <button
            type="button"
            onClick={() => {
              const p = player.current;
              if (!p) return;
              muted ? p.unMute() : p.mute();
              setMuted(!muted);
            }}
            aria-label={muted ? 'تشغيل الصوت' : 'كتم الصوت'}
            className="rounded p-1.5 hover:bg-white/15 cursor-pointer"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <select
            value={speed}
            onChange={e => {
              const r = Number(e.target.value);
              player.current?.setPlaybackRate(r);
              setSpeed(r);
            }}
            aria-label="سرعة التشغيل"
            className="rounded bg-black/50 px-1 py-0.5 text-[11px] text-white outline-none cursor-pointer"
          >
            {SPEEDS.map(s => (
              <option key={s} value={s}>
                {s}x
              </option>
            ))}
          </select>
        </div>
      )}
    </>
  );
};

/**
 * A lecture video given as a link (YouTube or a direct file). Students never get the link in the course data:
 * it is fetched from the server (app check included) only when the player opens. The player's own fullscreen
 * is replaced by ours, so the student's name and ID stay on top of the video in fullscreen too.
 */
export const ExternalVideo: React.FC<{ url?: string; lectureId?: string; watermark?: string; floatingMark?: string }> = ({
  url: given,
  lectureId,
  watermark,
  floatingMark
}) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, pseudo, toggle } = useProtectedFullscreen(boxRef);
  const [url, setUrl] = useState(given);
  const [error, setError] = useState('');

  useEffect(() => {
    setUrl(given);
    setError('');
    if (given || !lectureId) return;
    let cancelled = false;
    videoApi
      .access(lectureId)
      .then(a => {
        if (cancelled) return;
        if (a.provider === 'external') setUrl(a.url);
        else setError('تعذر تشغيل الفيديو');
      })
      .catch(e => !cancelled && setError(e instanceof ApiError ? e.message : 'تعذر تشغيل الفيديو'));
    return () => {
      cancelled = true;
    };
  }, [given, lectureId]);

  const yt = url && /youtube(-nocookie)?\.com|youtu\.be/.test(url) ? youtubeId(url) : null;

  return (
    <div
      ref={boxRef}
      className={`${pseudo ? 'fixed inset-0 z-[100] h-[100dvh]' : 'relative'} w-full overflow-hidden bg-black select-none ${
        isFullscreen ? 'flex flex-col justify-center' : 'rounded-xl border border-slate-700 shadow-md'
      }`}
      onContextMenu={e => e.preventDefault()}
    >
      <div className={`relative w-full ${isFullscreen ? 'h-full flex-1' : 'aspect-video max-h-[70vh]'}`}>
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-slate-200">
            <AlertTriangle className="h-7 w-7 text-amber-400" />
            <p className="text-sm font-bold">{error}</p>
          </div>
        ) : !url ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
          </div>
        ) : yt ? (
          <YouTubeLocked id={yt} />
        ) : (
          <video
            src={url}
            controls
            controlsList="nodownload noremoteplayback nofullscreen"
            disablePictureInPicture
            playsInline
            className="absolute inset-0 h-full w-full bg-black object-contain"
          >
            متصفحك لا يدعم تشغيل هذا الفيديو.
          </video>
        )}
        {watermark && <TiledWatermark text={watermark} />}
        {(floatingMark || watermark) && <FloatingWatermark text={floatingMark || watermark!} />}
        <button
          type="button"
          onClick={toggle}
          aria-label={isFullscreen ? 'الخروج من ملء الشاشة' : 'ملء الشاشة'}
          className="absolute top-2 left-2 z-30 rounded-lg bg-black/55 p-2 text-white hover:bg-black/75 cursor-pointer"
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
};
