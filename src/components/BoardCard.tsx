'use client';

import { useRouter } from 'next/navigation';
import type { BoardSummary } from '@/types';
import Avatar from './Avatar';
import EmojiIcon from './EmojiIcon';
import { feedbackTap } from '@/lib/feedback';

interface BoardCardProps {
  board: BoardSummary;
}

export default function BoardCard({ board }: BoardCardProps) {
  const router = useRouter();
  const progress = Math.round((board.filledCount / board.totalStickers) * 100);

  return (
    <button
      onClick={() => { feedbackTap(); router.push(`/board/${board.id}`); }}
      className="clay-float w-full p-4 text-left active:scale-[0.98] transition-transform"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            {board.isCompleted && <EmojiIcon emoji="🎉" size={16} />}
            <h3 className="font-display text-[17px] font-bold text-warm-text truncate">{board.title}</h3>
          </div>
          {board.description && (
            <p className="text-xs text-warm-sub truncate mb-3">{board.description}</p>
          )}

          {/* Mini grape preview in inset tray */}
          <div className="clay-pressed inline-flex flex-wrap gap-[3px] mb-3 px-2 py-1.5" style={{ borderRadius: '12px' }}>
            {Array.from({ length: Math.min(board.totalStickers, 10) }, (_, i) => {
              const isFilled = i < board.filledCount;
              return (
                <div
                  key={i}
                  className={`w-3.5 h-3.5 rounded-full ${
                    isFilled ? 'grape-filled-mini' : 'grape-empty-mini'
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
          <div className="w-full h-2 rounded-full bg-clay-bg overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-grape-500 via-grape-400 to-lime-300 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] text-warm-sub">
              <span className="font-display font-semibold text-warm-text">{board.filledCount}</span>
              <span className="mx-0.5">/</span>
              {board.totalStickers}알
            </span>
            <span className="text-[10px] font-display font-bold text-grape-600">{progress}%</span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-1">
          {board.giftedFrom && (
            <div className="flex items-center gap-1">
              <Avatar avatar={board.giftedFrom.avatar} size="sm" />
              <span className="text-[10px] text-warm-sub">선물</span>
            </div>
          )}
          {board.rewardCount > 0 && (
            <div aria-hidden="true">
              <EmojiIcon emoji={board.isCompleted ? '🎁' : '🔒'} size={20} />
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
