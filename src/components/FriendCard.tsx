'use client';

import { useState } from 'react';
import Avatar from './Avatar';
import ClayButton from './ClayButton';
import EmojiIcon from './EmojiIcon';
import type { FriendInfo } from '@/types';
import { feedbackSuccess, feedbackTap } from '@/lib/feedback';

interface FriendCardProps {
  friend: FriendInfo;
  onAccept?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  onRemove?: (id: string) => void;
  onSendCheer?: (userId: string) => void;
  onViewBoards?: (userId: string) => void;
  activeBoardCount?: number;
}

const statusBg: Record<string, string> = {
  accepted: '',
  pending: 'bg-lime-200/35',
  favorite: 'bg-clay-cream/60',
};

export default function FriendCard({
  friend,
  onAccept,
  onToggleFavorite,
  onRemove,
  onSendCheer,
  onViewBoards,
  activeBoardCount,
}: FriendCardProps) {
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    setLoading(true);
    await onAccept?.(friend.id);
    feedbackSuccess();
    setLoading(false);
  };

  const bg = friend.isFavorite
    ? statusBg.favorite
    : statusBg[friend.status] || statusBg.accepted;

  return (
    <div className={`clay-sm p-4 ${bg} transition-all`}>
      <div className="flex items-center gap-3">
        <Avatar avatar={friend.user.avatar} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-display text-[15px] font-semibold text-warm-text truncate">{friend.user.name}</p>
            {friend.isFavorite && <EmojiIcon emoji="⭐" size={14} />}
          </div>
          <p className="text-xs text-warm-sub truncate">{friend.user.email}</p>
          {typeof activeBoardCount === 'number' && friend.status === 'accepted' && (
            <p className="text-[11px] text-grape-600 mt-0.5 inline-flex items-center gap-1">
              <EmojiIcon emoji="🍇" size={13} /> 포도판 <span className="font-display font-semibold">{activeBoardCount}</span>개 진행 중
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {friend.status === 'pending' ? (
            <>
              <ClayButton size="sm" variant="primary" onClick={handleAccept} loading={loading}>
                수락
              </ClayButton>
              <ClayButton size="sm" variant="ghost" onClick={() => onRemove?.(friend.id)}>
                거절
              </ClayButton>
            </>
          ) : (
            <>
              <button
                onClick={() => { feedbackTap(); onViewBoards?.(friend.user.id); }}
                className="clay-button p-2 rounded-xl text-sm font-medium text-grape-600 transition-all active:scale-95"
                title="포도판 보기"
              >
                <EmojiIcon emoji="🍇" size={18} />
              </button>
              <button
                onClick={() => { feedbackTap(); onSendCheer?.(friend.user.id); }}
                className="clay-button p-2 rounded-xl text-lg transition-all active:scale-95"
                title="응원 보내기"
              >
                <EmojiIcon emoji="💜" size={18} />
              </button>
              <button
                onClick={() => { feedbackTap(); onToggleFavorite?.(friend.id); }}
                className="clay-button p-2 rounded-xl text-lg transition-all active:scale-95"
                title={friend.isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}
              >
                {friend.isFavorite ? <EmojiIcon emoji="⭐" size={18} /> : '☆'}
              </button>
              <button
                onClick={() => onRemove?.(friend.id)}
                className="clay-button p-2 rounded-xl text-sm text-warm-sub transition-all active:scale-95"
                title="삭제"
              >
                ✕
              </button>
            </>
          )}
        </div>
      </div>

      {friend.status === 'accepted' && onViewBoards && (
        <button
          onClick={() => onViewBoards(friend.user.id)}
          className="mt-3 w-full clay-button px-3 py-2 rounded-2xl text-xs font-medium text-grape-700 bg-grape-50 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
        >
          <EmojiIcon emoji="🍇" size={16} />
          <span>포도판 보기</span>
          <span className="text-warm-light">→</span>
        </button>
      )}
    </div>
  );
}
