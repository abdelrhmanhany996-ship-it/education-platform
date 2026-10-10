import React, { useEffect, useRef } from 'react';

/** The viewer's identity repeated diagonally over protected content, so any leaked copy names its source. */
export const TiledWatermark: React.FC<{ text: string; tone?: 'light' | 'dark' }> = ({ text, tone = 'light' }) => {
  if (!text.trim()) return null;
  const color =
    tone === 'light' ? 'text-white/[0.09] [text-shadow:0_0_1px_rgba(0,0,0,0.2)]' : 'text-slate-900/[0.05]';
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-10 overflow-hidden select-none">
      <div className={`absolute -inset-1/2 flex flex-wrap content-start gap-x-16 gap-y-14 -rotate-[24deg] ${color}`}>
        {Array.from({ length: 260 }, (_, i) => (
          <span key={i} className="whitespace-nowrap text-[11px] sm:text-sm font-bold" dir="auto">
            {text}
          </span>
        ))}
      </div>
    </div>
  );
};

const SPEED = 0.045; // px per ms

/**
 * The viewer's name and ID gliding continuously across the video and bouncing off its edges, so it cannot
 * be cropped or blurred out of a screen recording.
 */
export const FloatingWatermark: React.FC<{ text: string }> = ({ text }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    const box = el?.parentElement;
    if (!el || !box) return;
    const a = Math.PI / 6 + Math.random() * (Math.PI / 6);
    let vx = Math.cos(a) * SPEED * (Math.random() < 0.5 ? -1 : 1);
    let vy = Math.sin(a) * SPEED * (Math.random() < 0.5 ? -1 : 1);
    let x = Math.random() * Math.max(0, box.clientWidth - el.offsetWidth);
    let y = Math.random() * Math.max(0, box.clientHeight - el.offsetHeight);
    let last = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const dt = Math.min(now - last, 100);
      last = now;
      const maxX = Math.max(0, box.clientWidth - el.offsetWidth);
      const maxY = Math.max(0, box.clientHeight - el.offsetHeight);
      x += vx * dt;
      y += vy * dt;
      if (x <= 0 || x >= maxX) { vx = -vx; x = Math.min(Math.max(x, 0), maxX); }
      if (y <= 0 || y >= maxY) { vy = -vy; y = Math.min(Math.max(y, 0), maxY); }
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [text]);
  if (!text.trim()) return null;
  return (
    <div
      ref={ref}
      aria-hidden
      data-floating-watermark
      className="pointer-events-none select-none absolute top-0 left-0 z-20 whitespace-nowrap rounded-lg bg-black/20 px-3 py-1 text-sm sm:text-base font-bold text-white/55 [text-shadow:0_1px_2px_rgba(0,0,0,0.5)] will-change-transform"
      dir="auto"
    >
      {text}
    </div>
  );
};
