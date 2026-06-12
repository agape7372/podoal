'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GrapeSticker from './GrapeSticker';
import GrapeStem from './illustrations/GrapeStem';
import Sparkle from './illustrations/Sparkle';
import EmojiIcon from './EmojiIcon';
import { useLongPress } from '@/hooks/useLongPress';
import { REWARD_TYPE_ICON } from '@/lib/icons';
import { feedbackFill, feedbackComplete, feedbackReward } from '@/lib/feedback';
import { progressPercent } from '@/lib/format';
import { composeBunchMask } from '@/lib/liquidMask';
import type { BoardDetail, RewardInfo } from '@/types';

interface GrapeBoardProps {
  board: BoardDetail;
  onFill: (position: number) => Promise<void>;
  canFill: boolean;
  /** Fired the instant a fill unlocks a reward or completes the board — the
   *  board page uses it to burst confetti without waiting for the server. */
  onCelebrate?: () => void;
  /** The viewer owns this board (gates the long-press "plant reward" gesture). */
  isOwner?: boolean;
  /** Long-press an unfilled grape → plant/edit a 중간 보상 at that position. */
  onPlantReward?: (position: number) => void;
  /** Fired (synced to the confetti beat) when a fill reaches a MID reward, so
   *  the board page can pop the reward open immediately. */
  onMidRewardReached?: (reward: RewardInfo) => void;
}

interface GrapeCellProps {
  position: number;
  filled: boolean;
  isNext: boolean;
  isJustFilled: boolean;
  isFilling: boolean;
  dimmed: boolean;
  rewardEmoji?: string | null;
  grapeSize: number;
  hMargin: number;
  sizeClass: 'sm' | 'md' | 'lg';
  canPlant: boolean;
  onFill: (position: number) => void;
  onPlantReward?: (position: number) => void;
}

// One grape + its 🎁 marker. Extracted so `useLongPress` is called exactly once
// per cell (Rules of Hooks) rather than inside a .map() callback.
// memo: 한 알을 채우면 GrapeBoardInner의 로컬 상태(justFilled/fillingPos)가 여러 번
// 바뀌는데, props가 그대로인 나머지 셀은 그 리렌더를 건너뛴다. (채움 직후 렌더는
// handleFill 의존성(filledPositions 등)이 바뀌어 전 셀이 갱신된다 — 의도된 한계.)
const GrapeCell = memo(function GrapeCell({
  position,
  filled,
  isNext,
  isJustFilled,
  isFilling,
  dimmed,
  rewardEmoji,
  grapeSize,
  hMargin,
  sizeClass,
  canPlant,
  onFill,
  onPlantReward,
}: GrapeCellProps) {
  const lp = useLongPress(() => onPlantReward?.(position), { threshold: 500 });
  const pointerProps = canPlant
    ? {
        onPointerDown: lp.onPointerDown,
        onPointerMove: lp.onPointerMove,
        onPointerUp: lp.onPointerUp,
        onPointerLeave: lp.onPointerLeave,
        onPointerCancel: lp.onPointerCancel,
      }
    : {};

  return (
    <div
      // 완성 연출(액체 차오름)의 실루엣 측정 앵커. 버튼(.grape-filled)은 측정
      // 시점에 grape-hit 스쿼시 transform 중일 수 있어 rect가 왜곡된다 — 이
      // wrapper는 transform이 없고 버튼과 기하가 동일(w-full h-full)해 안정적.
      data-grape-cell=""
      className={`shrink-0 relative ${isJustFilled ? 'z-20' : isNext ? 'z-10' : ''}`}
      style={{ width: `${grapeSize}px`, height: `${grapeSize}px`, margin: `0 ${hMargin}px` }}
      {...pointerProps}
    >
      <GrapeSticker
        position={position}
        isFilled={filled}
        isJustFilled={isJustFilled}
        isFilling={isFilling}
        canFill={isNext}
        isNext={isNext}
        dimmed={dimmed}
        size={sizeClass}
        onClick={() => {
          // A long-press just fired on this grape → it planted a reward, not a
          // fill. Swallow the synthetic click so the next grape isn't filled too.
          if (canPlant && lp.consumeLongPress()) return;
          onFill(position);
        }}
      />
      {rewardEmoji && (
        <span className="absolute -top-1 -right-1 z-20 pointer-events-none drop-shadow-xs">
          <EmojiIcon emoji={rewardEmoji} size={Math.round(grapeSize * 0.4)} />
        </span>
      )}
    </div>
  );
});

// Hand-tuned bunch layouts for the common sizes (wider at top, tapering to a
// point) — kept verbatim for the shapes people see most.
const CLUSTER_LAYOUTS: Record<number, number[]> = {
  10: [3, 4, 2, 1],
  15: [3, 4, 4, 3, 1],
  20: [3, 4, 5, 4, 3, 1],
  30: [3, 4, 5, 5, 4, 4, 3, 2], // max 5/row (was 6 → overflowed the card on the right)
};

// Generate a grape-bunch row layout for ANY count (the size stepper allows 2–60):
// ramp up 3→5, hold at 5, taper down to a point — a teardrop silhouette, max 5/row.
function bunchLayout(n: number): number[] {
  const MAX = 5;
  const small: Record<number, number[]> = { 1: [1], 2: [2], 3: [2, 1], 4: [3, 1], 5: [3, 2] };
  if (n <= 5) return small[n] ?? [n];
  const rows: number[] = [];
  let rem = n;
  let w = 3;
  // ascend 3,4,5 (leave ≥3 for a taper)
  while (w <= MAX && rem - w >= 3) {
    rows.push(w);
    rem -= w;
    if (w < MAX) w++;
    else break;
  }
  // hold at the peak
  while (rem - MAX >= 3) {
    rows.push(MAX);
    rem -= MAX;
  }
  // taper to a point
  let t = MAX - 1;
  while (rem > 0) {
    const ww = Math.min(t > 0 ? t : 1, rem);
    rows.push(ww);
    rem -= ww;
    t = ww - 1;
  }
  return rows;
}

const layoutFor = (n: number): number[] => CLUSTER_LAYOUTS[n] ?? bunchLayout(n);

// ── 포도판 완성 연출: '액체 차오름 v2 (출렁)' ─────────────────────────────────
// 원본 시안: podoal-grape-anim.vercel.app 갤러리 10번(사용자 확정 선택). 마지막 알
// 임팩트(grape-hit) → 송이 실루엣 마스크 안에서 연두 액체가 출렁이며 차오름
// (118% 오버슈트 → 104% → 110% 정착이 '출렁'의 핵심) → 상승 피크에서
// 소리·컨페티·샤인·스파클이 한 박자. 전부 WAAPI + imperative DOM(React 외부)이라
// 시작 전·언마운트 시 cleanup으로 잔존 노드를 반드시 걷어낸다.
//
// 색상: SVG data URI/inline 속은 CSS var()가 해석되지 않아 리터럴을 쓴다 —
// globals.css @theme 토큰과 같은 값이며 대응을 여기 명시한다.
const WAVE_COLOR = '#F9E082'; // = sunshine-300
const SPARKLE_COLORS = ['#F9E082', '#CFDC78', '#F58BAE']; // sunshine-300 · lime-500 · juice-400
const GLOW_RGB = '207, 220, 120'; // = lime-500 (#CFDC78)

/** 46x14 물결 패턴 한 주기 — repeat-x로 이어 붙여 backgroundPositionX 루프 */
const waveBackground = (color: string) =>
  `url("data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="46" height="14" viewBox="0 0 46 14"><path d="M0 7 q11.5 -8 23 0 t23 0 V14 H0 Z" fill="${color}"/></svg>`,
  )}")`;

/** 4꼭지 별 스파클 (시안 STAR와 동일 path) */
const starSvg = (color: string) =>
  `<svg width="100%" height="100%" viewBox="0 0 20 20" aria-hidden="true"><path d="M 10 1 Q 11 8 19 10 Q 11 12 10 19 Q 9 12 1 10 Q 9 8 10 1 Z" fill="${color}"/><circle cx="10" cy="10" r="1.4" fill="rgba(255,255,255,0.85)"/></svg>`;

interface LiquidParts {
  layer: HTMLDivElement;
  fill: HTMLDivElement;
  wave: HTMLDivElement;
}

/** 클러스터에 송이 실루엣 마스크 액체 레이어(fill+wave)를 부착 */
function buildLiquidLayer(container: HTMLElement): LiquidParts | null {
  const cells = Array.from(container.querySelectorAll<HTMLElement>('[data-grape-cell]'));
  // rect는 viewport 기준이지만 컨테이너 rect 차감으로 overflow-x 스크롤 오프셋이
  // 자연 상쇄된다(둘이 같은 스크롤 박스에서 함께 이동) — liquidMask.test.ts 검증.
  const mask = composeBunchMask(
    cells.map((cell) => cell.getBoundingClientRect()),
    container.getBoundingClientRect(),
  );
  if (!mask) return null;

  const layer = document.createElement('div');
  layer.setAttribute('aria-hidden', 'true');
  Object.assign(layer.style, {
    position: 'absolute',
    inset: '0',
    // 알 위(직전 채움 셀 z-20 포함) · FAB(z-40)/내비(z-50)/모달(z-[90]) 아래.
    // 오버슈트(118%)는 layer overflow:hidden으로 클러스터 div 안에서만 그려져
    // 바깥 overflow-x-auto(py-3) 컨테이너의 클립과 무관하다.
    zIndex: '30',
    pointerEvents: 'none',
    overflow: 'hidden',
  });
  layer.style.setProperty('mask-image', mask);
  layer.style.setProperty('-webkit-mask-image', mask);

  const fill = document.createElement('div');
  Object.assign(fill.style, {
    position: 'absolute',
    left: '0',
    right: '0',
    bottom: '0',
    height: '0%',
    // 시안 'linear-gradient(to top,#A8B85A,#CFDC78 50%,#F7FAD8)' = 토큰 동치
    background:
      'linear-gradient(to top, var(--color-lime-600), var(--color-lime-500) 50%, var(--color-lime-200))',
  });

  const wave = document.createElement('div');
  Object.assign(wave.style, {
    position: 'absolute',
    left: '-10%',
    width: '120%',
    top: '-12px',
    height: '14px',
    backgroundRepeat: 'repeat-x',
    backgroundSize: '46px 14px',
    backgroundImage: waveBackground(WAVE_COLOR),
  });

  fill.appendChild(wave);
  layer.appendChild(fill);
  container.appendChild(layer);
  return { layer, fill, wave };
}

/** 시안 shineAll의 알 펄스: 전체 알 brightness/scale 1회 (React 노드엔 WAAPI만, 클래스 불변) */
function shineGrapes(container: HTMLElement) {
  container.querySelectorAll<HTMLElement>('.grape-filled').forEach((grape) => {
    grape.animate(
      [
        { transform: 'scale(1)', filter: 'brightness(1)' },
        { transform: 'scale(1.14)', filter: 'brightness(1.32)', offset: 0.45 },
        { transform: 'scale(1)', filter: 'brightness(1)' },
      ],
      { duration: 500, easing: 'ease-out' },
    );
  });
}

/** 중앙 radial glow 1회 — DOM 첫 자식 + z-0이라 알들 뒤에서 빛난다 */
function burstGlow(container: HTMLElement): HTMLDivElement {
  const rect = container.getBoundingClientRect();
  const size = Math.round(Math.max(rect.width, rect.height) * 0.8);
  const glow = document.createElement('div');
  glow.setAttribute('aria-hidden', 'true');
  Object.assign(glow.style, {
    position: 'absolute',
    left: '50%',
    top: '58%',
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '50%',
    zIndex: '0',
    pointerEvents: 'none',
    opacity: '0',
    background: `radial-gradient(circle, rgba(${GLOW_RGB}, 0.6) 0%, rgba(${GLOW_RGB}, 0) 70%)`,
  });
  container.insertBefore(glow, container.firstChild);
  glow.animate(
    [
      { opacity: 0, transform: 'translate(-50%, -50%) scale(0.3)' },
      { opacity: 0.9, offset: 0.25 },
      { opacity: 0, transform: 'translate(-50%, -50%) scale(1.5)' },
    ],
    { duration: 1000, easing: 'ease-out', fill: 'forwards' },
  );
  return glow;
}

// 일회성 스파클 버스트 5개(시안 8개 풀에서 송이 안쪽 위주로 축소) — 완성 보드의
// 정적 Sparkle(우상단 표식)과는 별개의 연출이다.
const SPARKLE_POINTS: ReadonlyArray<readonly [number, number]> = [
  [0.5, 0.3],
  [0.26, 0.5],
  [0.74, 0.46],
  [0.4, 0.72],
  [0.66, 0.7],
];

function burstSparkles(container: HTMLElement): HTMLElement[] {
  const rect = container.getBoundingClientRect();
  return SPARKLE_POINTS.map(([fx, fy], i) => {
    const size = 12 + (i % 3) * 4; // 12~20px 결정적 변주(랜덤 대신)
    const sparkle = document.createElement('div');
    sparkle.setAttribute('aria-hidden', 'true');
    Object.assign(sparkle.style, {
      position: 'absolute',
      left: `${Math.round(fx * rect.width - size / 2)}px`,
      top: `${Math.round(fy * rect.height - size / 2)}px`,
      width: `${size}px`,
      height: `${size}px`,
      zIndex: '31', // 액체 레이어(30) 위
      pointerEvents: 'none',
      opacity: '0',
    });
    // 안전: starSvg 입력은 모듈 상수(SPARKLE_COLORS)뿐 — 사용자 데이터 미유입(XSS 표면 없음)
    sparkle.innerHTML = starSvg(SPARKLE_COLORS[i % SPARKLE_COLORS.length]);
    container.appendChild(sparkle);
    sparkle.animate(
      [
        { opacity: 0, transform: 'scale(0) rotate(-30deg)' },
        { opacity: 1, transform: 'scale(1.1) rotate(-5deg)', offset: 0.4 },
        { opacity: 0, transform: 'scale(0.9) rotate(20deg)' },
      ],
      { duration: 700, delay: i * 45, easing: 'ease-out', fill: 'backwards' },
    );
    return sparkle;
  });
}
// ── 완성 연출 끝 ─────────────────────────────────────────────────────────────

function GrapeBoardInner({ board, onFill, canFill, onCelebrate, isOwner, onPlantReward, onMidRewardReached }: GrapeBoardProps) {
  const [fillingPos, setFillingPos] = useState<number | null>(null);
  const [justFilled, setJustFilled] = useState<number | null>(null);

  // 완성 연출용: 포도 클러스터 div(액체 레이어·glow·스파클의 부착 지점)와,
  // 진행 중 시퀀스의 취소 함수(타이머 해제 + imperative 노드 제거).
  const clusterRef = useRef<HTMLDivElement | null>(null);
  const celebrationCleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => celebrationCleanupRef.current?.(), []);

  // '액체 차오름 v2 (출렁)' 시퀀스. 트리거는 handleFill 내부뿐 — 페이지 로드 시
  // 이미 완성된 보드에서는 재생되지 않고, '되돌리기 후 재완성'에선 자연 재생된다.
  // 타임라인(임팩트 t=0 기준):
  //   0ms     마지막 알 grape-hit(0.6s) + feedbackFill (handleFill에서 이미 발생)
  //   420ms   송이 마스크 측정 → 액체 레이어 부착, 물결 루프 + 상승(1500ms) 시작
  //   1920ms  상승 피크 정착 = 박자: feedbackComplete + onCelebrate(컨페티)
  //           + shineAll + glow + 스파클, 액체는 550ms 페이드아웃 시작
  //   3020ms  cleanup(레이어·glow·스파클 제거)
  const playCompletionSequence = useCallback(() => {
    // 이전 시퀀스 잔존물 제거(되돌리기 후 빠른 재완성 등 재트리거 대비)
    celebrationCleanupRef.current?.();

    // ⚠ 예외적 per-animation 모션 가드: 이 시퀀스는 WAAPI(el.animate)라
    // globals.css의 전역 prefers-reduced-motion 백스톱(CSS 애니메이션·트랜지션
    // 한정)이 적용되지 않는다. CLAUDE.md의 'per-animation motion guard 금지'는
    // CSS 애니메이션 한정 — WAAPI는 여기서 직접 가드하고 박자 효과만 즉시 낸다.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      feedbackComplete();
      onCelebrate?.();
      return;
    }

    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const nodes: HTMLElement[] = [];
    const cleanup = () => {
      timeouts.forEach(clearTimeout);
      nodes.forEach((node) => node.remove());
      nodes.length = 0;
      if (celebrationCleanupRef.current === cleanup) celebrationCleanupRef.current = null;
    };
    celebrationCleanupRef.current = cleanup;

    // t=420ms — 임팩트 프리즈가 정착한 직후 액체 상승 시작
    timeouts.push(setTimeout(() => {
      const container = clusterRef.current;
      const liquid = container ? buildLiquidLayer(container) : null;
      if (liquid) {
        nodes.push(liquid.layer);
        // 물결: 46px 패턴 한 주기를 650ms 무한 루프
        liquid.wave.animate(
          [{ backgroundPositionX: '0px' }, { backgroundPositionX: '46px' }],
          { duration: 650, iterations: Infinity },
        );
        // 출렁 상승: 80% → 118%(오버슈트) → 104% → 110% 정착
        liquid.fill.animate(
          [
            { height: '0%' },
            { height: '80%', offset: 0.55 },
            { height: '118%', offset: 0.78 },
            { height: '104%', offset: 0.9 },
            { height: '110%' },
          ],
          { duration: 1500, easing: 'cubic-bezier(0.4, 0.1, 0.3, 1.1)', fill: 'forwards' },
        );
      }

      // t=1920ms — 상승 피크: 소리·컨페티·샤인·스파클이 한 박자(비트 싱크 철학 유지)
      timeouts.push(setTimeout(() => {
        feedbackComplete();
        onCelebrate?.();
        const cluster = clusterRef.current;
        if (cluster) {
          shineGrapes(cluster);
          nodes.push(burstGlow(cluster));
          nodes.push(...burstSparkles(cluster));
        }
        if (liquid) {
          liquid.fill.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 550, fill: 'forwards' });
        }
        // 페이드(550ms)·glow(1000ms)·스파클(~880ms) 종료 후 일괄 제거
        timeouts.push(setTimeout(cleanup, 1100));
      }, 1500));
    }, 420));
  }, [onCelebrate]);

  const filledPositions = useMemo(
    () => new Set(board.stickers.map((s) => s.position)),
    [board.stickers],
  );
  const filledCount = filledPositions.size;
  const progress = progressPercent(filledCount, board.totalStickers);

  // Sequential fill: only the lowest unfilled position is tappable.
  const nextPosition = useMemo(() => {
    for (let i = 0; i < board.totalStickers; i++) {
      if (!filledPositions.has(i)) return i;
    }
    return -1; // every grape filled
  }, [filledPositions, board.totalStickers]);

  // Grapes sitting on an intermediate reward show a TYPE-specific marker
  // (편지 💌 · 기프티콘 🎁 · 소원권 ⭐). The marker PERSISTS after the grape is
  // filled so the planted reward leaves a permanent record. Completion reward
  // excluded (the whole board already celebrates).
  const rewardMarkers = useMemo(() => {
    const m = new Map<number, string>();
    for (const r of board.rewards ?? []) {
      if (r.triggerAt < board.totalStickers) m.set(r.triggerAt - 1, REWARD_TYPE_ICON[r.type]);
    }
    return m;
  }, [board.rewards, board.totalStickers]);

  const handleFill = useCallback(async (position: number) => {
    if (!canFill || filledPositions.has(position) || position !== nextPosition) return;

    setJustFilled(position);
    feedbackFill();
    const newFilledCount = filledCount + 1;
    // '소리·컨페티가 한 박자' 원칙: 중간 보상은 임팩트 직후 300ms 비트,
    // 완성은 액체 차오름 시퀀스의 상승 피크(임팩트 +1920ms) 비트에 맞춘다.
    if (newFilledCount >= board.totalStickers) {
      playCompletionSequence();
    } else {
      const reached = board.rewards?.find((r) => r.triggerAt === newFilledCount);
      if (reached) {
        // Confetti + sound + popup all on the same beat (#1: no popup lag).
        setTimeout(() => { feedbackReward(); onCelebrate?.(); onMidRewardReached?.(reached); }, 300);
      }
    }
    setTimeout(() => setJustFilled((p) => (p === position ? null : p)), 600);

    setFillingPos(position);
    try {
      await onFill(position);
    } catch {
      // Parent (board page) handles rollback + error banner. Swallowed here to
      // avoid an unhandled promise rejection on mobile.
    } finally {
      setFillingPos((p) => (p === position ? null : p));
    }
  }, [canFill, filledPositions, filledCount, board.totalStickers, board.rewards, onFill, nextPosition, onCelebrate, onMidRewardReached, playCompletionSequence]);

  // Size grapes from the widest row so the whole bunch fits the card without
  // clipping. Card inner width ≈ 280px on a ~360px phone; target ~270px for a
  // safe gutter. factor 1.12 accounts for the per-grape horizontal margin.
  const maxRowCount = Math.max(...layoutFor(board.totalStickers));
  const grapeSize = Math.min(54, Math.floor(270 / (maxRowCount * 1.12)));
  const sizeClass: 'sm' | 'md' | 'lg' = 'lg';
  const rowGap = Math.round(grapeSize * 0.06); // POSITIVE gap between rows — grapes never overlap each other
  const hMargin = grapeSize * 0.06;            // horizontal breathing room so grapes in a row don't touch
  // Leaf canopy: sized to ~1.5× a grape (hard cap 2×) and never overlapping the bunch.
  const leafWidth = Math.round(grapeSize * 1.5);

  const rows = useMemo<number[][]>(() => {
    const layoutRows = layoutFor(board.totalStickers);
    let posIndex = 0;
    const built: number[][] = [];
    for (const count of layoutRows) {
      const row: number[] = [];
      for (let i = 0; i < count && posIndex < board.totalStickers; i++) {
        row.push(posIndex++);
      }
      built.push(row);
    }
    return built;
  }, [board.totalStickers]);

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Progress bar */}
      <div className="w-full">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-warm-sub">
            <span className="font-display text-base text-warm-text font-semibold">{filledCount}</span>
            <span className="mx-1 text-warm-light">/</span>
            <span className="text-warm-sub">{board.totalStickers}알</span>
          </span>
          <span className="font-display text-base font-bold text-grape-600">{progress}%</span>
        </div>
        <div className="w-full h-3 rounded-full bg-clay-bg clay-pressed overflow-hidden" style={{ borderRadius: '999px' }}>
          <div
            className="h-full rounded-full bg-linear-to-r from-grape-500 via-grape-400 to-lime-300 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Grape bunch container */}
      <div
        className="relative flex flex-col items-center w-full overflow-x-auto snap-x snap-mandatory scrollbar-hide py-3"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="flex flex-col items-center snap-center min-w-fit mx-auto relative">
          {/* Completion sparkle: 송이 우상단에 바짝 붙임 — 멀리 띄우면(-right-4) 카드 가장자리에
              떠 있는 '잘린 파편'처럼 읽힌다(2026-06-11 녹화 진단). */}
          {board.isCompleted && (
            <div className="absolute -top-1 right-0 z-20 animate-fade-in">
              <Sparkle size={28} color="#CFDC78" />
            </div>
          )}

          {/* Leaf canopy — sits ABOVE the bunch with a gap, never overlapping.
              Width tied to grapeSize (≤ 2× a grape; ~1.5× looks right). */}
          <div className="relative" style={{ marginBottom: 12 }}>
            <GrapeStem size={leafWidth} />
          </div>

          {/* Grape cluster — 완성 연출(액체 레이어·glow·스파클)이 imperative하게
              부착되는 앵커. 레이어는 inset-0 absolute라 이 div 크기를 벗어나지
              않는다(바깥 overflow-x-auto의 클립과 무관 — 불변식 1 유지). */}
          <div className="relative" ref={clusterRef}>
            {rows.map((row, rowIdx) => {
              const isStaggered = rowIdx % 2 === 1;
              const halfGrape = grapeSize / 2;

              return (
                <div
                  key={rowIdx}
                  className="flex justify-center"
                  style={{
                    marginTop: rowIdx === 0 ? 0 : `${rowGap}px`,
                    marginLeft: isStaggered ? `${halfGrape * 0.05}px` : `0`,
                  }}
                >
                  {row.map((position) => {
                    const filled = filledPositions.has(position);
                    const isNext = canFill && position === nextPosition;
                    return (
                      <GrapeCell
                        key={position}
                        position={position}
                        filled={filled}
                        isNext={isNext}
                        isJustFilled={justFilled === position}
                        isFilling={fillingPos === position}
                        dimmed={canFill && !filled && !isNext}
                        rewardEmoji={rewardMarkers.get(position) ?? null}
                        grapeSize={grapeSize}
                        hMargin={hMargin}
                        sizeClass={sizeClass}
                        canPlant={!!isOwner && !filled && !!onPlantReward && position < board.totalStickers - 1}
                        onFill={handleFill}
                        onPlantReward={onPlantReward}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Completion indicator */}
      {board.isCompleted && (
        <div className="text-center animate-bounce-in">
          <EmojiIcon emoji="🎉" size={40} className="block mx-auto" />
          <p className="font-display text-xl text-grape-700 font-bold mt-1">달성 완료!</p>
        </div>
      )}
    </div>
  );
}

export default memo(GrapeBoardInner);
