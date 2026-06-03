'use client';

import { memo, useCallback, useMemo, useState } from 'react';
import GrapeSticker from './GrapeSticker';
import GrapeStem from './illustrations/GrapeStem';
import Sparkle from './illustrations/Sparkle';
import { feedbackFill, feedbackComplete, feedbackReward } from '@/lib/feedback';
import type { BoardDetail } from '@/types';

interface GrapeBoardProps {
  board: BoardDetail;
  onFill: (position: number) => Promise<void>;
  canFill: boolean;
}

// Grape bunch layouts: wider at top, narrows at bottom (like a real grape bunch)
const CLUSTER_LAYOUTS: Record<number, number[]> = {
  10: [3, 4, 2, 1],
  15: [3, 4, 4, 3, 1],
  20: [3, 4, 5, 4, 3, 1],
  30: [3, 4, 5, 5, 4, 4, 3, 2], // max 5/row (was 6 → overflowed the card on the right)
};

function GrapeBoardInner({ board, onFill, canFill }: GrapeBoardProps) {
  const [fillingPos, setFillingPos] = useState<number | null>(null);
  const [justFilled, setJustFilled] = useState<number | null>(null);

  const filledPositions = useMemo(
    () => new Set(board.stickers.map((s) => s.position)),
    [board.stickers],
  );
  const filledCount = filledPositions.size;
  const progress = Math.round((filledCount / board.totalStickers) * 100);

  // Sequential fill: only the lowest unfilled position is tappable.
  const nextPosition = useMemo(() => {
    for (let i = 0; i < board.totalStickers; i++) {
      if (!filledPositions.has(i)) return i;
    }
    return -1; // every grape filled
  }, [filledPositions, board.totalStickers]);

  const handleFill = useCallback(async (position: number) => {
    if (!canFill || filledPositions.has(position) || position !== nextPosition) return;

    setJustFilled(position);
    feedbackFill();
    const newFilledCount = filledCount + 1;
    if (newFilledCount >= board.totalStickers) {
      setTimeout(() => feedbackComplete(), 400);
    } else if (board.rewards?.some((r) => r.triggerAt === newFilledCount)) {
      setTimeout(() => feedbackReward(), 300);
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
  }, [canFill, filledPositions, filledCount, board.totalStickers, board.rewards, onFill, nextPosition]);

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

          {/* Two-leaf canopy — sits ABOVE the bunch with a gap, never overlapping.
              Width tied to grapeSize (≤ 2× a grape; ~1.5× looks right). */}
          <div className="relative" style={{ marginBottom: 4 }}>
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
                      <div
                        key={position}
                        className={`flex-shrink-0 ${justFilled === position ? 'relative z-20' : isNext ? 'relative z-10' : ''}`}
                        style={{
                          width: `${grapeSize}px`,
                          height: `${grapeSize}px`,
                          margin: `0 ${hMargin}px`,
                        }}
                      >
                        <GrapeSticker
                          position={position}
                          isFilled={filled}
                          isJustFilled={justFilled === position}
                          isFilling={fillingPos === position}
                          canFill={isNext}
                          isNext={isNext}
                          dimmed={canFill && !filled && !isNext}
                          size={sizeClass}
                          onClick={() => handleFill(position)}
                        />
                      </div>
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
          <span className="text-4xl">🎉</span>
          <p className="font-display text-xl text-grape-700 font-bold mt-1">달성 완료!</p>
        </div>
      )}
    </div>
  );
}

export default memo(GrapeBoardInner);
