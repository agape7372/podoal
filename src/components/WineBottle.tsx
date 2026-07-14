'use client';

import { memo, useEffect, useRef } from 'react';
import type { BottleSize, WineBottle as WineBottleType } from '@/lib/winery';
import { stripTitleEmoji } from '@/lib/title';

interface WineBottleProps {
  bottle: WineBottleType;
  /** boardId를 넘기는 안정 콜백 — 페이지가 useCallback 하나로 전 병에 공유(memo 유지). */
  onSelect?: (boardId: string) => void;
  selected?: boolean;
}

// 병 치수 — 등급과 무관하게 단일(사용자 결정: 크기 통일, 2026-07-02).
// 등급(캐주얼→그랑 크뤼)은 아래 BOTTLE_GRADES의 만듦새로만 말한다.
// 스탠다드 와인병 비례를 기준으로 채택.
const DIM = { height: 100, width: 38, neck: 16, label: 24 } as const;

// Every bottle is drawn inside a fixed-height "stage" and bottom-anchored, so
// bottles stand on the shelf instead of hanging from the top of the grid cell.
// The winery page draws the shelf plank at BOTTLE_BASELINE_H and repeats rows
// every BOTTLE_ROW_H + gap. (밀랍 등급의 병 상단 +4px도 headroom 안)
const STAGE_H = DIM.height + 12; // 112 — bottle + headroom
const TITLE_H = 16; // fixed title row so the cell height is deterministic
export const BOTTLE_BASELINE_H = STAGE_H; // bottle bases sit here from the cell top
export const BOTTLE_ROW_H = STAGE_H + 8 + TITLE_H; // stage + gap-2 + title row

// ─── 병 등급(만듦새) ────────────────────────────────────────
// 4등급이 크기 스케일만 다르던 것을 실제 와인 등급처럼 마감 품질로 차별화.
//   piccolo(캐주얼):   코르크+포일, 민무늬 라벨 — 기존 그대로
//   standard(클래식):  + 라벨 키라인, 보조 유리 광택
//   magnum(리저브):    밀랍 실링(코르크·포일 대체, 버건디) + 라벨 이중선
//   jeroboam(그랑 크뤼): 밀랍 실링(딥 그레이프) + 금박 라벨 프레임 + 어깨
//                       금띠 + 사선 유리 sheen
// 전부 흐름/경계 안 요소만 — SIZE_MAP·선반 기하(BOTTLE_ROW_H) 불변, 장식은
// stage 안(paint containment이 셀 밖을 자름). 색은 인라인 hex(@source 무관).
type LabelFrame = 'plain' | 'line' | 'double' | 'gold';
type BottleGrade = {
  /** 밀랍 실링 — 있으면 코르크 대신 밀랍 캡+드립 렌더(품종 포일은 전 등급 유지) */
  wax?: { cap: string; drip: string };
  labelFrame: LabelFrame;
  /** 어깨 아래 금띠(그랑 크뤼) */
  goldBand?: boolean;
  /** 우측 보조 유리 광택 */
  secondHighlight?: boolean;
  /** 정적 사선 sheen(그랑 크뤼) — 애니 아님, 상시 1레이어 */
  sheen?: boolean;
};

const BOTTLE_GRADES: Record<BottleSize, BottleGrade> = {
  piccolo: { labelFrame: 'plain' },
  standard: { labelFrame: 'line', secondHighlight: true },
  magnum: {
    wax: { cap: 'linear-gradient(to bottom, #a34d6f, #8e3b5c)', drip: '#7a2f4e' },
    labelFrame: 'double',
    secondHighlight: true,
  },
  jeroboam: {
    wax: { cap: 'linear-gradient(to bottom, #7d58a8, #5e3f80)', drip: '#4d3269' },
    labelFrame: 'gold',
    goldBand: true,
    secondHighlight: true,
    sheen: true,
  },
};

// 라벨 프레임 — 등급이 오를수록 마감(키라인→이중선→금박)이 깊어진다.
const LABEL_FRAME_SHADOW: Record<LabelFrame, string> = {
  plain: '0 1px 2px rgba(0,0,0,0.18), inset 0 0 0 0.5px rgba(0,0,0,0.05)',
  line: '0 1px 2px rgba(0,0,0,0.18), inset 0 0 0 1px rgba(94,63,128,0.22)',
  double:
    '0 1px 2px rgba(0,0,0,0.18), inset 0 0 0 1px rgba(94,63,128,0.3), inset 0 0 0 2.5px rgba(255,255,255,0.9), inset 0 0 0 3.5px rgba(94,63,128,0.18)',
  gold:
    '0 1.5px 3px rgba(0,0,0,0.22), inset 0 0 0 1.2px rgba(200,158,58,0.95), inset 0 0 0 2.8px rgba(255,255,255,0.85), inset 0 0 0 4px rgba(200,158,58,0.45)',
};

// 품종(카테고리) 포일 캡슐 색 — templateId 접두(stats route와 동일 규칙:
// split('-')[0])로 7품종. 인라인 그라디언트라 @source 스캔과 무관. 접두
// 미상·무템플릿 보드는 기존 라임 포일 폴백 → 구보드 외형 불변. 밀랍 등급에서도
// 포일은 그대로 남는다. hobby/mental은 @theme 확장 팔레트(ember/mist) 토큰 참조.
const VARIETAL_FOIL: Record<string, string> = {
  health: 'linear-gradient(to bottom, #8fc972, #6fb050, #3e7a38)', // 건강 — leaf
  growth: 'linear-gradient(to bottom, #f2c94c, #e0ae2c, #b98a1c)', // 자기계발 — sunshine
  lifestyle: 'linear-gradient(to bottom, #cfdc78, #a8b85a, #7e8a3e)', // 생활습관 — lime deep
  work: 'linear-gradient(to bottom, #b28cdc, #9970c8, #7d58a8)', // 직장/학업 — grape
  social: 'linear-gradient(to bottom, #f58bae, #e86a92, #c24a72)', // 관계 — juice
  hobby:
    'linear-gradient(to bottom, var(--color-ember-300), var(--color-ember-500), var(--color-ember-700))', // 취미 — ember
  mental:
    'linear-gradient(to bottom, var(--color-mist-300), var(--color-mist-500), var(--color-mist-700))', // 마음건강 — mist
};

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
  const dim = DIM; // 크기 통일 — bottleSize는 만듦새 등급 키로만 쓴다
  const gradient = getBottleGradient(bottle.daysToComplete);
  const grade = BOTTLE_GRADES[bottle.bottleSize];
  const rootRef = useRef<HTMLButtonElement>(null);
  // 품종 포일(templateId 접두) — 미상은 undefined = 기존 라임 포일 폴백.
  const varietalFoil = bottle.templateId
    ? VARIETAL_FOIL[bottle.templateId.split('-')[0]]
    : undefined;
  // 미수확 완성 병 = 셀러 정식 입고 전(NEW). 구캐시(undefined)는 스탬프 없음.
  const isNew = bottle.harvestedAt === null;

  // 선택 시 짧은 wobble — WAAPI(rotate, transform만). 전역 reduced-motion
  // 백스톱은 CSS 애니 전용이라 WAAPI는 직접 가드. cleanup으로 선제 정리.
  useEffect(() => {
    if (!selected || !rootRef.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const anim = rootRef.current.animate(
      [
        { transform: 'rotate(0deg)' },
        { transform: 'rotate(-2.5deg)', offset: 0.3 },
        { transform: 'rotate(2deg)', offset: 0.65 },
        { transform: 'rotate(0deg)' },
      ],
      { duration: 380, easing: 'ease-in-out' },
    );
    return () => anim.cancel();
  }, [selected]);

  return (
    <button
      ref={rootRef}
      onClick={() => onSelect?.(bottle.boardId)}
      aria-pressed={selected}
      className="group flex flex-col items-center gap-2 transition-[transform] duration-300 hover:scale-105 hover:-rotate-1 active:scale-95"
      aria-label={`${bottle.title} - ${bottle.vintage}년 빈티지${isNew ? ' (새 와인)' : ''}`}
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

        {grade.wax ? (
          <>
            {/* 밀랍 캡 — 리저브·그랑 크뤼의 실링(코르크 대체). 흐름 요소지만
                bottom-anchored라 병 상단만 1px 이동, 선반 기하 불변. */}
            <div
              className="relative z-10"
              style={{
                width: dim.neck * 0.95,
                height: 8,
                borderRadius: '4px 4px 2px 2px',
                background: grade.wax.cap,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 1px rgba(0,0,0,0.25)',
              }}
            />
            {/* 밀랍 드립 — 병목으로 흘러내린 자국 */}
            <div
              className="relative z-10"
              style={{
                width: dim.neck * 1.3,
                height: 5,
                borderRadius: '0 0 6px 6px',
                background: grade.wax.drip,
                boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.15)',
              }}
            />
          </>
        ) : (
          /* Cork */
          <div
            className="bg-linear-to-b from-[#A87C4B] via-[#8B5E2F] to-[#6F4824] relative z-10"
            style={{
              width: dim.neck * 0.62,
              height: 9,
              borderRadius: '3px 3px 1.5px 1.5px',
              boxShadow: 'inset 0 -1px 1px rgba(0,0,0,0.25)',
            }}
          />
        )}

        {/* Foil capsule — 품종(카테고리)별 색, 무품종은 기존 라임 유지 */}
        <div
          className={`relative z-10 ${varietalFoil ? '' : 'bg-linear-to-b from-lime-500 via-lime-600 to-[#B07F23]'}`}
          style={{
            width: dim.neck * 0.92,
            height: 6,
            borderRadius: '1.5px 1.5px 2px 2px',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)',
            ...(varietalFoil ? { background: varietalFoil } : {}),
          }}
        />

        {/* NEW 스탬프 — 미수확(셀러 입고 전) 완성 병. 셀 높이를 바꾸지 않는
            absolute 오버레이(선반 기하 불변). content-visibility의 paint
            containment가 버튼 밖 오버행을 자르므로 stage 경계 안(right:0),
            병목 옆에 걸린 태그처럼 배치. 스크린리더는 aria-label로 전달. */}
        {isNew && (
          <span
            aria-hidden
            className="pastel-stamp lime absolute z-20 text-[9px] leading-tight px-1.5 py-0"
            style={{ bottom: dim.height - 6, right: 0 }}
          >
            NEW
          </span>
        )}

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

        {/* 어깨 금띠 — 그랑 크뤼 전용 마감 */}
        {grade.goldBand && (
          <div
            className="relative z-10"
            style={{
              width: dim.width,
              height: 2,
              background: 'linear-gradient(to right, #b8923f, #ecd188, #b8923f)',
            }}
          />
        )}

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

          {/* 보조 유리 광택 — 클래식 이상 등급의 유리 품질 */}
          {grade.secondHighlight && (
            <div className="absolute top-[6%] right-[16%] w-[9%] h-[68%] bg-white/15 rounded-full blur-[1.5px]" />
          )}

          {/* 정적 사선 sheen — 그랑 크뤼 유리 마감(애니 아님, 1레이어) */}
          {grade.sheen && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'linear-gradient(115deg, transparent 32%, rgba(255,255,255,0.09) 44%, rgba(255,255,255,0.16) 50%, rgba(255,255,255,0.05) 57%, transparent 68%)',
              }}
            />
          )}

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
              // 등급별 라벨 마감: 민무늬 → 키라인 → 이중선 → 금박 프레임
              boxShadow: LABEL_FRAME_SHADOW[grade.labelFrame],
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
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-grape-900/15 rounded-full blur-md transition-[transform,background-color] duration-300 group-hover:bg-grape-900/22 group-hover:scale-110"
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
