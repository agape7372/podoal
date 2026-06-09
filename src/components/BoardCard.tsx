'use client';

import { useRouter } from 'next/navigation';
import type { BoardSummary } from '@/types';
import EmojiIcon from './EmojiIcon';
import { feedbackTap } from '@/lib/feedback';
import { progressPercent } from '@/lib/format';
import { stripTitleEmoji } from '@/lib/title';

interface BoardCardProps {
  board: BoardSummary;
  /** Render as a non-interactive <div> (the home gesture wrapper owns gestures/nav). */
  asStatic?: boolean;
  className?: string;
}

// 출처 코너 배지: 선물받음 → 💝, 포도동(group) → 🔗, 자작 → 없음. 텍스트 없이 아이콘만.
function sourceBadge(board: BoardSummary): { emoji: string; label: string } | null {
  if (board.giftedFrom) return { emoji: '💝', label: '선물받은 포도판' };
  if (board.podong) return { emoji: '🔗', label: '포도동 포도판' };
  return null;
}

export default function BoardCard({ board, asStatic = false, className = '' }: BoardCardProps) {
  const router = useRouter();
  const progress = progressPercent(board.filledCount, board.totalStickers);
  const badge = sourceBadge(board);

  const inner = (
    <>
      {badge && (
        <span
          className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-white/85 clay-sm grid place-items-center"
          title={badge.label}
          aria-label={badge.label}
        >
          <EmojiIcon emoji={badge.emoji} size={14} />
        </span>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1 pr-7">
          {board.isCompleted && <EmojiIcon emoji="🎉" size={16} />}
          <h3 className="font-display text-[17px] font-bold text-warm-text truncate">{stripTitleEmoji(board.title)}</h3>
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
        <div className="flex justify-between items-center mt-1.5">
          <span className="text-[10px] text-warm-sub tabular-nums">
            <span className="font-display font-semibold text-warm-text">{board.filledCount}</span>
            <span className="mx-0.5">/</span>
            {board.totalStickers}알
          </span>
          <span className="flex items-center gap-1.5">
            {board.rewardCount > 0 && (
              <EmojiIcon emoji={board.isCompleted ? '🎁' : '🔒'} size={13} />
            )}
            <span className="text-[10px] font-display font-bold text-grape-600 tabular-nums">{progress}%</span>
          </span>
        </div>
      </div>
    </>
  );

  if (asStatic) {
    return <div className={`clay-float relative w-full p-4 text-left ${className}`}>{inner}</div>;
  }

  return (
    <button
      onClick={() => { feedbackTap(); router.push(`/board/${board.id}`); }}
      className={`clay-float relative w-full p-4 text-left active:scale-[0.98] transition-transform ${className}`}
    >
      {inner}
    </button>
  );
}
