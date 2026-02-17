'use client';

import type { WineBottle as WineBottleType } from '@/lib/winery';

interface WineBottleProps {
  bottle: WineBottleType;
  onClick?: () => void;
}

const SIZE_MAP = {
  piccolo: { height: 80, width: 32, neck: 14, label: 20 },
  standard: { height: 100, width: 38, neck: 16, label: 24 },
  magnum: { height: 120, width: 44, neck: 18, label: 28 },
  jeroboam: { height: 140, width: 52, neck: 20, label: 32 },
} as const;

/**
 * Returns a darker grape gradient for bottles that took longer to complete,
 * and a lighter one for quick completions.
 */
function getBottleGradient(daysToComplete: number): { body: string; highlight: string } {
  if (daysToComplete >= 60) {
    return { body: 'from-grape-900 via-grape-800 to-grape-700', highlight: 'bg-grape-600/30' };
  }
  if (daysToComplete >= 30) {
    return { body: 'from-grape-800 via-grape-700 to-grape-600', highlight: 'bg-grape-500/30' };
  }
  if (daysToComplete >= 14) {
    return { body: 'from-grape-700 via-grape-600 to-grape-500', highlight: 'bg-grape-400/30' };
  }
  if (daysToComplete >= 7) {
    return { body: 'from-grape-600 via-grape-500 to-grape-400', highlight: 'bg-grape-300/30' };
  }
  return { body: 'from-grape-500 via-grape-400 to-grape-300', highlight: 'bg-grape-200/30' };
}

export default function WineBottle({ bottle, onClick }: WineBottleProps) {
  const dim = SIZE_MAP[bottle.bottleSize];
  const gradient = getBottleGradient(bottle.daysToComplete);

  // Truncate title for label
  const labelTitle = bottle.title.length > 6 ? bottle.title.slice(0, 5) + '..' : bottle.title;

  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center gap-2 transition-all duration-300 hover:scale-105 hover:-rotate-1 active:scale-95 focus:outline-none"
      aria-label={`${bottle.title} - ${bottle.vintage}년 빈티지`}
    >
      {/* Bottle assembly */}
      <div className="relative flex flex-col items-center" style={{ height: dim.height + 24 }}>
        {/* Cork / Cap */}
        <div
          className="rounded-t-sm bg-gradient-to-b from-amber-600 to-amber-800 relative z-10"
          style={{
            width: dim.neck * 0.6,
            height: 8,
            borderRadius: '3px 3px 1px 1px',
          }}
        />
        {/* Foil wrap under cork */}
        <div
          className="bg-gradient-to-b from-amber-400 to-amber-500 relative z-10"
          style={{
            width: dim.neck * 0.8,
            height: 4,
            borderRadius: '0 0 2px 2px',
          }}
        />

        {/* Neck */}
        <div
          className={`bg-gradient-to-b ${gradient.body} relative z-10`}
          style={{
            width: dim.neck,
            height: dim.height * 0.22,
            borderRadius: '2px 2px 0 0',
          }}
        />

        {/* Shoulder transition */}
        <div
          className={`bg-gradient-to-b ${gradient.body} relative z-10`}
          style={{
            width: dim.width,
            height: dim.height * 0.08,
            borderRadius: '6px 6px 0 0',
          }}
        />

        {/* Body */}
        <div
          className={`bg-gradient-to-br ${gradient.body} relative z-10 overflow-hidden`}
          style={{
            width: dim.width,
            height: dim.height * 0.55,
            borderRadius: '0 0 4px 4px',
          }}
        >
          {/* Glass highlight effect */}
          <div
            className={`absolute top-0 left-[15%] w-[20%] h-full ${gradient.highlight} rounded-full blur-[2px]`}
          />

          {/* Label area */}
          <div
            className="absolute left-1/2 -translate-x-1/2 bg-cream-50 bg-white/90 rounded-sm flex flex-col items-center justify-center px-1 shadow-sm"
            style={{
              width: dim.width - 8,
              height: dim.label,
              top: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            <span
              className="text-grape-800 font-bold leading-none block truncate w-full text-center"
              style={{ fontSize: Math.max(7, dim.label * 0.38) }}
            >
              {labelTitle}
            </span>
            <span
              className="text-grape-500 leading-none mt-px"
              style={{ fontSize: Math.max(6, dim.label * 0.3) }}
            >
              {bottle.vintage}
            </span>
          </div>
        </div>

        {/* Base / punt */}
        <div
          className={`bg-gradient-to-b ${gradient.body} relative z-10`}
          style={{
            width: dim.width + 2,
            height: 3,
            borderRadius: '0 0 3px 3px',
          }}
        />

        {/* Shadow beneath the bottle */}
        <div
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-black/10 rounded-full blur-sm transition-all duration-300 group-hover:bg-black/15 group-hover:scale-110"
          style={{
            width: dim.width * 0.8,
            height: 6,
          }}
        />
      </div>

      {/* Title below bottle */}
      <span className="text-[11px] text-warm-sub leading-tight text-center max-w-[80px] truncate">
        {bottle.title}
      </span>
    </button>
  );
}
