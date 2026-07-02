'use client';

import { memo } from 'react';
import type { WineBottle as WineBottleType } from '@/lib/winery';
import { stripTitleEmoji } from '@/lib/title';

interface WineBottleProps {
  bottle: WineBottleType;
  /** boardId를 넘기는 안정 콜백 — 페이지가 useCallback 하나로 전 병에 공유(memo 유지). */
  onSelect?: (boardId: string) => void;
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

function WineBottleInner({ bottle, onSelect, selected = false }: WineBottleProps) {
  const dim = SIZE_MAP[bottle.bottleSize];
  const gradient = getBottleGradient(bottle.daysToComplete);

  return (
    <button
      onClick={() => onSelect?.(bottle.boardId)}
      aria-pressed={selected}
      className="group flex flex-col items-center gap-2 transition-all duration-300 hover:scale-105 hover:-rotate-1 active:scale-95"
      aria-label={`${bottle.title} - ${bottle.vintage}년 빈티지`}
      style={{
        // 구동 다이어트: 뷰포트 밖 병(노드 12개+blur 2개)의 paint를 통째 스킵.
        // 셀 높이가 BOTTLE_ROW_H로 결정적이라 스크롤 점프 없음. 선택된 병은
        // visible — paint containment가 셀렉션 할로(blur, 셀 밖 확장)를 자르는
        // 것을 방지. 미지원 브라우저는 무해한 no-op.
        contentVisibility: selected ? 'visible' : 'auto',
        containIntrinsicSize: `auto 80px auto ${BOTTLE_ROW_H}px`,
      }}
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
          className="bg-linear-to-b from-[#A87C4B] via-[#8B5E2F] to-[#6F4824] relative z-10"
          style={{
            width: dim.neck * 0.62,
            height: 9,
            borderRadius: '3px 3px 1.5px 1.5px',
            boxShadow: 'inset 0 -1px 1px rgba(0,0,0,0.25)',
          }}
        />

        {/* Foil capsule */}
        <div
          className="bg-linear-to-b from-lime-500 via-lime-600 to-[#B07F23] relative z-10"
          style={{
            width: dim.neck * 0.92,
            height: 6,
            borderRadius: '1.5px 1.5px 2px 2px',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)',
          }}
        />

        {/* Neck */}
        <div
          className={`bg-linear-to-b ${gradient.body} relative z-10`}
          style={{
            width: dim.neck,
            height: dim.height * 0.22,
            borderRadius: '2px 2px 0 0',
            boxShadow: 'inset 1px 0 0 rgba(255,255,255,0.15), inset -1px 0 0 rgba(0,0,0,0.2)',
          }}
        />

        {/* Shoulder */}
        <div
          className={`bg-linear-to-b ${gradient.body} relative z-10`}
          style={{
            width: dim.width,
            height: dim.height * 0.08,
            borderRadius: '8px 8px 0 0',
          }}
        />

        {/* Body */}
        <div
          className={`bg-linear-to-br ${gradient.body} relative z-10 overflow-hidden`}
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
          {/* v4 주의: -translate-x-1/2 유틸리티는 이제 별도 `translate` 속성이라 아래 인라인
              transform과 합산된다(v3에선 인라인 transform이 덮어써 무해한 중복) — 클래스 제거 */}
          <div
            className="texture-paper absolute left-1/2 bg-clay-cream rounded-xs flex items-center justify-center px-1"
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
          className={`bg-linear-to-b ${gradient.body} relative z-10`}
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

// 선택 토글마다 전 병이 리렌더되던 것을 변경된 2개(이전·새 선택)로 줄인다.
// bottle 참조는 SWR 응답 객체 안에서 안정, onSelect는 페이지 useCallback.
const WineBottle = memo(WineBottleInner);
export default WineBottle;
