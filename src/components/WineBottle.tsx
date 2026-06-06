'use client';

import type { WineBottle as WineBottleType } from '@/lib/winery';
import { stripTitleEmoji } from '@/lib/title';

interface WineBottleProps {
  bottle: WineBottleType;
  onClick?: () => void;
  selected?: boolean;
}

const SIZE_MAP = {
  piccolo: { height: 80, width: 32, neck: 14, label: 20 },
  standard: { height: 100, width: 38, neck: 16, label: 24 },
  magnum: { height: 120, width: 44, neck: 18, label: 28 },
  jeroboam: { height: 140, width: 52, neck: 20, label: 32 },
} as const;

// Every bottle is drawn inside a fixed-height "stage" and bottom-anchored, so
// bottles of different sizes share one baseline (they stand on the shelf
// instead of hanging from the top of the grid cell). The winery page draws the
// shelf plank at BOTTLE_BASELINE_H and repeats rows every BOTTLE_ROW_H + gap.
const STAGE_H = SIZE_MAP.jeroboam.height + 12; // 152 — tallest bottle + headroom
const TITLE_H = 16; // fixed title row so the cell height is deterministic
export const BOTTLE_BASELINE_H = STAGE_H; // bottle bases sit here from the cell top
export const BOTTLE_ROW_H = STAGE_H + 8 + TITLE_H; // stage + gap-2 + title row

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

export default function WineBottle({ bottle, onClick, selected = false }: WineBottleProps) {
  const dim = SIZE_MAP[bottle.bottleSize];
  const gradient = getBottleGradient(bottle.daysToComplete);

  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className="group flex flex-col items-center gap-2 transition-all duration-300 hover:scale-105 hover:-rotate-1 active:scale-95"
      aria-label={`${bottle.title} - ${bottle.vintage}년 빈티지`}
    >
      {/* Fixed-height stage, bottle bottom-anchored to share a common baseline */}
      <div className="relative flex flex-col items-center justify-end" style={{ height: STAGE_H }}>
        {/* Selection glow halo behind the bottle */}
        {selected && (
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full bg-grape-400/30 blur-xl pointer-events-none"
            style={{ width: dim.width * 2, height: dim.height * 0.6 }}
          />
        )}

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

          {/* Hover-only glass shimmer sweep (clipped by body overflow-hidden) */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 wine-bottle-shimmer pointer-events-none" />

          {/* Vintage label (paper texture, year-forward like a real wine label) */}
          <div
            className="texture-paper absolute left-1/2 -translate-x-1/2 bg-clay-cream rounded-sm flex items-center justify-center px-1"
            style={{
              width: dim.width - 8,
              height: dim.label,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.18), inset 0 0 0 0.5px rgba(0,0,0,0.05)',
            }}
          >
            <span
              className="font-display text-grape-800 font-bold leading-none tabular-nums"
              style={{ fontSize: Math.max(8, dim.label * 0.42) }}
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

      <span
        className={`block h-4 leading-4 text-[11px] font-display text-center max-w-[80px] truncate ${
          selected ? 'text-grape-700 font-bold' : 'text-warm-sub'
        }`}
      >
        {stripTitleEmoji(bottle.title)}
      </span>
    </button>
  );
}
