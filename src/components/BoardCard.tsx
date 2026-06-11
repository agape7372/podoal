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
  /** Shift the source badge left so it doesn't sit under the ⋮ menu (home cards). */
  reserveTopRight?: boolean;
  className?: string;
}

// 출처 코너 칩: 선물받음 → 💝 선물, 포도동(group) → 🔗 포도동, 자작 → 없음.
function sourceBadge(board: BoardSummary): { emoji: string; text: string; label: string } | null {
  if (board.giftedFrom) return { emoji: '💝', text: '선물', label: '선물받은 포도판' };
  if (board.podong) return { emoji: '🔗', text: '포도동', label: '포도동 포도판' };
  return null;
}

export default function BoardCard({ board, asStatic = false, reserveTopRight = false, className = '' }: BoardCardProps) {
  const router = useRouter();
  const progress = progressPercent(board.filledCount, board.totalStickers);
  const badge = sourceBadge(board);
  const harvested = !!board.harvestedAt;

  const inner = (
    <>
      <div className="flex-1 min-w-0">
        {/* 코너 칩(수확·출처) — absolute 대신 제목 행 안 inline-flex로 두어, 칩 폭이 변해도
            truncate 제목과 절대 겹치지 않는다(작은 화면 안전). reserveTopRight는 카드 '바깥'
            형제인 ⋮ 메뉴(top-1.5 right-1.5, w-8 → 콘텐츠 박스로 22px 침범) 자리만 비운다. */}
        <div className={`flex items-center gap-1.5 mb-1 ${reserveTopRight ? 'pr-7' : ''}`}>
          {board.isCompleted && <EmojiIcon emoji="🎉" size={16} className="shrink-0" />}
          <h3 className="flex-1 min-w-0 font-display text-[17px] font-bold text-warm-text truncate">{stripTitleEmoji(board.title)}</h3>
          {harvested && (
            <span className="shrink-0 w-6 h-6 rounded-full bg-white/85 clay-sm grid place-items-center" title="수확 완료">
              <EmojiIcon emoji="🏆" size={14} label="수확 완료" />
            </span>
          )}
          {badge && (
            <span className="shrink-0 h-6 inline-flex items-center gap-1 pl-1.5 pr-2 rounded-full bg-white/85 clay-sm" title={badge.label}>
              <EmojiIcon emoji={badge.emoji} size={13} />
              <span className="text-[11px] font-semibold text-warm-sub leading-none">{badge.text}</span>
            </span>
          )}
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
            className="h-full rounded-full bg-linear-to-r from-grape-500 via-grape-400 to-lime-300 transition-all"
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
