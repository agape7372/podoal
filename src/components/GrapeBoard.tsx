'use client';

import { memo, useCallback, useMemo, useState } from 'react';
import GrapeSticker from './GrapeSticker';
import GrapeStem from './illustrations/GrapeStem';
import Sparkle from './illustrations/Sparkle';
import EmojiIcon from './EmojiIcon';
import { useLongPress } from '@/hooks/useLongPress';
import { REWARD_TYPE_ICON } from '@/lib/icons';
import { feedbackFill, feedbackComplete, feedbackReward } from '@/lib/feedback';
import { progressPercent } from '@/lib/format';
import type { BoardDetail } from '@/types';

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
function GrapeCell({
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
      className={`flex-shrink-0 relative ${isJustFilled ? 'z-20' : isNext ? 'z-10' : ''}`}
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
        <span className="absolute -top-1 -right-1 z-20 pointer-events-none drop-shadow-sm">
          <EmojiIcon emoji={rewardEmoji} size={Math.round(grapeSize * 0.4)} />
        </span>
      )}
    </div>
  );
}

// Grape bunch layouts: wider at top, narrows at bottom (like a real grape bunch)
const CLUSTER_LAYOUTS: Record<number, number[]> = {
  10: [3, 4, 2, 1],
  15: [3, 4, 4, 3, 1],
  20: [3, 4, 5, 4, 3, 1],
  30: [3, 4, 5, 5, 4, 4, 3, 2], // max 5/row (was 6 → overflowed the card on the right)
};

function GrapeBoardInner({ board, onFill, canFill, onCelebrate, isOwner, onPlantReward }: GrapeBoardProps) {
  const [fillingPos, setFillingPos] = useState<number | null>(null);
  const [justFilled, setJustFilled] = useState<number | null>(null);

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
    // Sync the confetti burst to the same beat as the celebration sound so the
    // visual + audio land together, just after the grape's impact-freeze.
    if (newFilledCount >= board.totalStickers) {
      setTimeout(() => { feedbackComplete(); onCelebrate?.(); }, 400);
    } else if (board.rewards?.some((r) => r.triggerAt === newFilledCount)) {
      setTimeout(() => { feedbackReward(); onCelebrate?.(); }, 300);
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
  }, [canFill, filledPositions, filledCount, board.totalStickers, board.rewards, onFill, nextPosition, onCelebrate]);

  // Size grapes from the widest row so the whole bunch fits the card without
  // clipping. Card inner width ≈ 280px on a ~360px phone; target ~270px for a
  // safe gutter. factor 1.12 accounts for the per-grape horizontal margin.
  const maxRowCount = Math.max(...(CLUSTER_LAYOUTS[board.totalStickers] || CLUSTER_LAYOUTS[10]));
  const grapeSize = Math.min(54, Math.floor(270 / (maxRowCount * 1.12)));
  const sizeClass: 'sm' | 'md' | 'lg' = 'lg';
  const rowGap = Math.round(grapeSize * 0.06); // POSITIVE gap between rows — grapes never overlap each other
  const hMargin = grapeSize * 0.06;            // horizontal breathing room so grapes in a row don't touch
  // Leaf canopy: sized to ~1.5× a grape (hard cap 2×) and never overlapping the bunch.
  const leafWidth = Math.round(grapeSize * 1.5);

  const rows = useMemo<number[][]>(() => {
    const layoutRows = CLUSTER_LAYOUTS[board.totalStickers] || CLUSTER_LAYOUTS[10];
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
            className="h-full rounded-full bg-gradient-to-r from-grape-500 via-grape-400 to-lime-300 transition-all duration-500 ease-out"
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
          {/* Completion sparkle: top-right */}
          {board.isCompleted && (
            <div className="absolute -top-2 -right-4 z-20 animate-fade-in">
              <Sparkle size={28} color="#CFDC78" />
            </div>
          )}

          {/* Leaf canopy — sits ABOVE the bunch with a gap, never overlapping.
              Width tied to grapeSize (≤ 2× a grape; ~1.5× looks right). */}
          <div className="relative" style={{ marginBottom: 12 }}>
            <GrapeStem size={leafWidth} />
          </div>

          {/* Grape cluster */}
          <div className="relative">
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
