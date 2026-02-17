'use client';

import { useRouter } from 'next/navigation';
import type { BoardSummary } from '@/types';
import Avatar from './Avatar';

interface BoardCardProps {
  board: BoardSummary;
}

export default function BoardCard({ board }: BoardCardProps) {
  const router = useRouter();
  const progress = Math.round((board.filledCount / board.totalStickers) * 100);

  const colorByProgress = () => {
    if (board.isCompleted) return 'from-clay-mint/50 to-clay-yellow/30';
    if (progress >= 70) return 'from-clay-lavender/50 to-clay-pink/30';
    if (progress >= 30) return 'from-clay-peach/50 to-clay-cream/30';
    return 'from-white to-clay-lavender/20';
  };

  return (
    <button
      onClick={() => router.push(`/board/${board.id}`)}
      className={`
        clay w-full p-4 text-left
        bg-gradient-to-br ${colorByProgress()}
        active:scale-[0.98] transition-transform
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {board.isCompleted && <span>🎉</span>}
            <h3 className="font-bold text-warm-text truncate">{board.title}</h3>
          </div>
          {board.description && (
            <p className="text-xs text-warm-sub truncate mb-2">{board.description}</p>
          )}

          {/* Mini grape preview */}
          <div className="flex flex-wrap gap-1 mb-2">
            {Array.from({ length: Math.min(board.totalStickers, 10) }, (_, i) => {
              const isFilled = i < board.filledCount;
              return (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full ${
                    isFilled
                      ? 'bg-gradient-to-br from-grape-400 to-grape-500'
                      : 'bg-grape-100'
                  }`}
                />
              );
            })}
            {board.totalStickers > 10 && (
              <span className="text-[10px] text-warm-sub self-center ml-0.5">
                +{board.totalStickers - 10}
              </span>
            )}
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 rounded-full bg-grape-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-grape-400 to-grape-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-warm-sub">
              {board.filledCount}/{board.totalStickers}알
            </span>
            <span className="text-[10px] font-medium text-grape-500">{progress}%</span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-1">
          {board.giftedFrom && (
            <div className="flex items-center gap-1">
              <Avatar avatar={board.giftedFrom.avatar} size="sm" />
              <span className="text-[10px] text-warm-sub">선물</span>
            </div>
          )}
          {board.hasReward && (
            <div className="text-xl">{board.isCompleted ? '🎁' : '🔒'}</div>
          )}
        </div>
      </div>
    </button>
  );
}
