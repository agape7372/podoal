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
  30: [4, 5, 6, 5, 5, 3, 2],
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

  const handleFill = useCallback(async (position: number) => {
    if (!canFill || filledPositions.has(position)) return;

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
  }, [canFill, filledPositions, filledCount, board.totalStickers, board.rewards, onFill]);

  const grapeSize = 52;
  const sizeClass: 'sm' | 'md' | 'lg' = 'lg';
  const rowOverlap = grapeSize * 0.22;

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
            className="h-full rounded-full bg-gradient-to-r from-grape-500 via-grape-400 to-juice-400 transition-all duration-500 ease-out"
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
              <Sparkle size={28} color="#FFC845" />
            </div>
          )}

          {/* Stem + leaf illustration */}
          <div className="relative z-10" style={{ marginBottom: '-14px' }}>
            <GrapeStem size={120} />
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
                    marginTop: rowIdx === 0 ? 0 : `-${rowOverlap}px`,
                    marginLeft: isStaggered ? `${halfGrape * 0.05}px` : `0`,
                  }}
                >
                  {row.map((position) => (
                    <div
                      key={position}
                      className="flex-shrink-0"
                      style={{
                        width: `${grapeSize}px`,
                        height: `${grapeSize}px`,
                        margin: `0 ${grapeSize * 0.02}px`,
                      }}
                    >
                      <GrapeSticker
                        position={position}
                        isFilled={filledPositions.has(position)}
                        isJustFilled={justFilled === position}
                        isFilling={fillingPos === position}
                        canFill={canFill && !filledPositions.has(position)}
                        size={sizeClass}
                        onClick={() => handleFill(position)}
                      />
                    </div>
                  ))}
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
