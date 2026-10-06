import React from 'react';

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
