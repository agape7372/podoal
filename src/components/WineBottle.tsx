'use client';

import type { WineBottle as WineBottleType } from '@/lib/winery';
import { stripTitleEmoji } from '@/lib/title';

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
    return { body: 'from-grape-900 via-grape-800 to-grape-700', highlight: 'bg-grape-500/35' };
  }
  if (daysToComplete >= 30) {
    return { body: 'from-grape-800 via-grape-700 to-grape-600', highlight: 'bg-grape-400/35' };
  }
  if (daysToComplete >= 14) {
    return { body: 'from-grape-700 via-grape-600 to-grape-500', highlight: 'bg-grape-300/35' };
  }
  if (daysToComplete >= 7) {
    return { body: 'from-grape-600 via-grape-500 to-grape-400', highlight: 'bg-grape-300/35' };
  }
  return { body: 'from-grape-500 via-grape-400 to-grape-300', highlight: 'bg-grape-200/40' };
}

export default function WineBottle({ bottle, onClick }: WineBottleProps) {
  const dim = SIZE_MAP[bottle.bottleSize];
  const gradient = getBottleGradient(bottle.daysToComplete);

  const labelTitle = bottle.title.length > 6 ? bottle.title.slice(0, 5) + '…' : bottle.title;

  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center gap-2 transition-all duration-300 hover:scale-105 hover:-rotate-1 active:scale-95"
      aria-label={`${bottle.title} - ${bottle.vintage}년 빈티지`}
    >
      <div className="relative flex flex-col items-center" style={{ height: dim.height + 24 }}>
        {/* Cork */}
        <div
          className="bg-gradient-to-b from-[#A87C4B] via-[#8B5E2F] to-[#6F4824] relative z-10"
          style={{
            width: dim.neck * 0.62,
            height: 9,
            borderRadius: '3px 3px 1.5px 1.5px',
            boxShadow: 'inset 0 -1px 1px rgba(0,0,0,0.25)',
          }}
        />

        {/* Foil capsule */}
        <div
          className="bg-gradient-to-b from-lime-500 via-lime-600 to-[#B07F23] relative z-10"
          style={{
            width: dim.neck * 0.92,
            height: 6,
            borderRadius: '1.5px 1.5px 2px 2px',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)',
          }}
        />

        {/* Neck */}
        <div
          className={`bg-gradient-to-b ${gradient.body} relative z-10`}
          style={{
            width: dim.neck,
            height: dim.height * 0.22,
            borderRadius: '2px 2px 0 0',
            boxShadow: 'inset 1px 0 0 rgba(255,255,255,0.15), inset -1px 0 0 rgba(0,0,0,0.2)',
          }}
        />

        {/* Shoulder */}
        <div
          className={`bg-gradient-to-b ${gradient.body} relative z-10`}
          style={{
            width: dim.width,
            height: dim.height * 0.08,
            borderRadius: '8px 8px 0 0',
          }}
        />

        {/* Body */}
        <div
          className={`bg-gradient-to-br ${gradient.body} relative z-10 overflow-hidden`}
          style={{
            width: dim.width,
            height: dim.height * 0.55,
            borderRadius: '0 0 5px 5px',
            boxShadow: 'inset 1px 0 0 rgba(255,255,255,0.18), inset -1px 0 0 rgba(0,0,0,0.25), inset 0 -8px 14px rgba(0,0,0,0.3)',
          }}
        >
          {/* Glass highlight */}
          <div
            className={`absolute top-0 left-[15%] w-[20%] h-full ${gradient.highlight} rounded-full blur-[2px]`}
          />

          {/* Label with paper texture */}
          <div
            className="texture-paper absolute left-1/2 -translate-x-1/2 bg-clay-cream rounded-sm flex flex-col items-center justify-center px-1"
            style={{
              width: dim.width - 8,
              height: dim.label,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.18), inset 0 0 0 0.5px rgba(0,0,0,0.05)',
            }}
          >
            <span
              className="font-display text-grape-800 font-bold leading-none block truncate w-full text-center"
              style={{ fontSize: Math.max(7, dim.label * 0.4) }}
            >
              {labelTitle}
            </span>
            <span
              className="font-display text-grape-600 leading-none mt-px"
              style={{ fontSize: Math.max(6, dim.label * 0.32) }}
            >
              {bottle.vintage}
            </span>
          </div>
        </div>

        {/* Base */}
        <div
          className={`bg-gradient-to-b ${gradient.body} relative z-10`}
          style={{
            width: dim.width + 2,
            height: 3,
            borderRadius: '0 0 4px 4px',
          }}
        />

        {/* Soft shadow */}
        <div
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-grape-900/15 rounded-full blur-md transition-all duration-300 group-hover:bg-grape-900/22 group-hover:scale-110"
          style={{
            width: dim.width * 0.85,
            height: 7,
          }}
        />
      </div>

      <span className="text-[11px] font-display text-warm-sub leading-tight text-center max-w-[80px] truncate">
        {stripTitleEmoji(bottle.title)}
      </span>
    </button>
  );
}
