import React, { useEffect, useState } from 'react';

/** The viewer's identity repeated diagonally over protected content, so any leaked copy names its source. */
export const TiledWatermark: React.FC<{ text: string; tone?: 'light' | 'dark' }> = ({ text, tone = 'light' }) => {
  if (!text.trim()) return null;
  const color = tone === 'light' ? 'text-white/[0.13]' : 'text-slate-900/[0.08]';
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-10 overflow-hidden select-none">
      <div className={`absolute -inset-1/2 flex flex-wrap content-start gap-x-16 gap-y-14 -rotate-[24deg] ${color}`}>
        {Array.from({ length: 60 }, (_, i) => (
          <span key={i} className="whitespace-nowrap text-[11px] sm:text-sm font-bold" dir="auto">
            {text}
          </span>
        ))}
      </div>
    </div>
  );
};

const randomSpot = () => ({ top: 12 + Math.random() * 72, left: 18 + Math.random() * 64 });

/**
 * The viewer's name and ID drifting across the video to a new random spot every few seconds, so it cannot
 * be cropped or blurred out of a screen recording.
 */
export const FloatingWatermark: React.FC<{ text: string }> = ({ text }) => {
  const [spot, setSpot] = useState(randomSpot);
  useEffect(() => {
    const t = window.setInterval(() => setSpot(randomSpot()), 4000);
    return () => window.clearInterval(t);
  }, []);
  if (!text.trim()) return null;
  return (
    <div
      aria-hidden
      data-floating-watermark
      className="pointer-events-none select-none absolute z-20 whitespace-nowrap rounded-md bg-black/25 px-2.5 py-1 text-xs sm:text-sm font-extrabold text-white/60 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]"
      style={{ top: `${spot.top}%`, left: `${spot.left}%`, transform: 'translate(-50%, -50%)', transition: 'top 3.8s linear, left 3.8s linear' }}
      dir="auto"
    >
      {text}
    </div>
  );
};
