'use client';

import { useState, useCallback } from 'react';
import GrapeSticker from './GrapeSticker';
import type { BoardDetail } from '@/types';

interface GrapeBoardProps {
  board: BoardDetail;
  onFill: (position: number) => Promise<void>;
  canFill: boolean;
}

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
      setTimeout(() => setJustFilled(null), 600);
    } finally {
      setFillingPos(null);
    }
  }, [canFill, filledPositions, fillingPos, onFill]);

  const getClusterClass = () => {
    if (board.totalStickers <= 10) return 'grape-cluster grape-cluster-10';
    if (board.totalStickers <= 15) return 'grape-cluster grape-cluster-15';
    if (board.totalStickers <= 20) return 'grape-cluster grape-cluster-20';
    return 'grape-cluster grape-cluster-30';
  };

  const getGrapeSize = () => {
    if (board.totalStickers <= 10) return 'lg';
    if (board.totalStickers <= 15) return 'md';
    if (board.totalStickers <= 20) return 'md';
    return 'sm';
  };

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

      {/* Grape vine stem */}
      <div className="relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-6">
          <span className="text-3xl">🍃</span>
        </div>
      </div>

      {/* Grape cluster */}
      <div className={`${getClusterClass()} p-4 max-w-xs mx-auto`}>
        {Array.from({ length: board.totalStickers }, (_, i) => (
          <GrapeSticker
            key={i}
            position={i}
            isFilled={filledPositions.has(i)}
            isJustFilled={justFilled === i}
            isFilling={fillingPos === i}
            canFill={canFill && !filledPositions.has(i)}
            size={getGrapeSize()}
            onClick={() => handleFill(i)}
          />
        ))}
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
