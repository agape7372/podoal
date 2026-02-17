'use client';

import { useState, useCallback } from 'react';
import GrapeSticker from './GrapeSticker';
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

export default function GrapeBoard({ board, onFill, canFill }: GrapeBoardProps) {
  const [fillingPos, setFillingPos] = useState<number | null>(null);
  const [justFilled, setJustFilled] = useState<number | null>(null);

  const filledPositions = new Set(board.stickers.map((s) => s.position));
  const filledCount = filledPositions.size;
  const progress = Math.round((filledCount / board.totalStickers) * 100);

  const handleFill = useCallback(async (position: number) => {
    if (!canFill || filledPositions.has(position) || fillingPos !== null) return;
    setFillingPos(position);
    try {
      await onFill(position);
      setJustFilled(position);
      feedbackFill();
      const newFilledCount = filledCount + 1;
      if (newFilledCount >= board.totalStickers) {
        setTimeout(() => feedbackComplete(), 400);
      } else if (board.rewards?.some((r) => r.triggerAt === newFilledCount)) {
        setTimeout(() => feedbackReward(), 300);
      }
      setTimeout(() => setJustFilled(null), 600);
    } finally {
      setFillingPos(null);
    }
  }, [canFill, filledPositions, fillingPos, filledCount, board.totalStickers, board.rewards, onFill]);

  const layoutRows = CLUSTER_LAYOUTS[board.totalStickers] || CLUSTER_LAYOUTS[10];

  const grapeSize = 52;
  const sizeClass: 'sm' | 'md' | 'lg' = 'lg';

  // Build rows
  let posIndex = 0;
  const rows: number[][] = [];
  for (const count of layoutRows) {
    const row: number[] = [];
    for (let i = 0; i < count && posIndex < board.totalStickers; i++) {
      row.push(posIndex++);
    }
    rows.push(row);
  }

  // Vertical overlap: each row overlaps the previous by ~22%
  const rowOverlap = grapeSize * 0.22;

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Progress bar */}
      <div className="w-full">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-warm-sub">
            {filledCount} / {board.totalStickers}알
          </span>
          <span className="text-sm font-bold text-grape-600">{progress}%</span>
        </div>
        <div className="w-full h-3 rounded-full bg-gradient-to-r from-grape-100 to-grape-50 clay-sm overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-grape-400 to-grape-500 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Grape bunch container */}
      <div className="relative flex flex-col items-center w-full overflow-x-auto snap-x snap-mandatory scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="flex flex-col items-center snap-center min-w-fit mx-auto">
        {/* Stem & Leaf SVG */}
        <svg
          width="120"
          height="70"
          viewBox="0 0 120 70"
          className="block relative z-10"
          style={{ marginBottom: `-14px` }}
        >
          {/* Main stem */}
          <path
            d="M60 68 C60 40, 62 25, 58 8"
            stroke="#5A7E42"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
          {/* Tendril curl */}
          <path
            d="M58 8 C54 -2, 70 -6, 76 2 C82 10, 72 16, 66 10"
            stroke="#6B9E4E"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          />
          {/* Big leaf - left */}
          <path
            d="M52 28 C30 12, 2 20, 8 42 C12 54, 32 48, 52 28Z"
            fill="#4A8C3A"
          />
          {/* Leaf vein */}
          <path
            d="M52 28 C36 24, 16 32, 12 42"
            stroke="#3A7030"
            strokeWidth="1.2"
            fill="none"
            opacity="0.6"
          />
          <path
            d="M42 28 C34 30, 22 36, 18 40"
            stroke="#3A7030"
            strokeWidth="0.8"
            fill="none"
            opacity="0.4"
          />
          {/* Small leaf - right */}
          <path
            d="M64 22 C78 8, 100 14, 94 32 C90 42, 74 38, 64 22Z"
            fill="#5EA84A"
            opacity="0.85"
          />
          <path
            d="M64 22 C78 20, 90 26, 90 32"
            stroke="#4A8C3A"
            strokeWidth="0.8"
            fill="none"
            opacity="0.4"
          />
        </svg>

        {/* Grape cluster */}
        <div className="relative">
          {rows.map((row, rowIdx) => {
            // Stagger odd rows by half a grape width for hex-packing
            const isStaggered = rowIdx % 2 === 1;
            const halfGrape = grapeSize / 2;

            return (
              <div
                key={rowIdx}
                className="flex justify-center"
                style={{
                  marginTop: rowIdx === 0 ? 0 : `-${rowOverlap}px`,
                  // Stagger offset for hex-like packing
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
          <p className="text-grape-600 font-bold mt-1">달성 완료!</p>
        </div>
      )}
    </div>
  );
}
