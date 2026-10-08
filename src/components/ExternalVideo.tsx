import React, { useRef } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { FloatingWatermark, TiledWatermark } from './TiledWatermark';
import { useProtectedFullscreen } from '../hooks/useProtectedFullscreen';

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

/**
 * A lecture video given as a link (YouTube or a direct file). The player's own fullscreen is turned off and
 * replaced by ours, so the student's name and ID stay on top of the video in fullscreen too.
 */
export const ExternalVideo: React.FC<{ url: string; watermark?: string; floatingMark?: string }> = ({ url, watermark, floatingMark }) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, pseudo, toggle } = useProtectedFullscreen(boxRef);
  const yt = /youtube\.com|youtu\.be/.test(url) ? youtubeId(url) : null;

  return (
    <div
      ref={boxRef}
      className={`${pseudo ? 'fixed inset-0 z-[100] h-[100dvh]' : 'relative'} w-full overflow-hidden bg-black select-none ${
        isFullscreen ? 'flex flex-col justify-center' : 'rounded-xl border border-slate-700 shadow-md'
      }`}
      onContextMenu={e => e.preventDefault()}
    >
      <div className={`relative w-full ${isFullscreen ? 'h-full flex-1' : 'aspect-video max-h-[70vh]'}`}>
        {yt ? (
          <iframe
            // fs=0 removes YouTube's fullscreen button; without allowFullScreen the iframe cannot go fullscreen alone
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(yt)}?fs=0&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3`}
            title="فيديو الشرح"
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
          />
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
          className="absolute top-2 left-2 z-20 rounded-lg bg-black/55 p-2 text-white hover:bg-black/75 cursor-pointer"
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
};
