'use client';

import { useState } from 'react';
import Avatar from './Avatar';
import ClayButton from './ClayButton';
import type { FriendInfo } from '@/types';

interface FriendCardProps {
  friend: FriendInfo;
  onAccept?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  onRemove?: (id: string) => void;
  onSendCheer?: (userId: string) => void;
  onViewBoards?: (userId: string) => void;
  activeBoardCount?: number;
}

const statusGradient: Record<string, string> = {
  accepted: 'from-white to-clay-lavender/20',
  pending: 'from-white to-clay-peach/20',
  favorite: 'from-clay-yellow/15 to-clay-lavender/20',
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
    setLoading(false);
  };

  const gradient = friend.isFavorite
    ? statusGradient.favorite
    : statusGradient[friend.status] || statusGradient.accepted;

  return (
    <div className={`clay-sm p-4 bg-gradient-to-br ${gradient} transition-all`}>
      <div className="flex items-center gap-3">
        <Avatar avatar={friend.user.avatar} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-warm-text truncate">{friend.user.name}</p>
            {friend.isFavorite && <span className="text-sm">⭐</span>}
          </div>
          <p className="text-xs text-warm-sub truncate">{friend.user.email}</p>
          {typeof activeBoardCount === 'number' && friend.status === 'accepted' && (
            <p className="text-[11px] text-grape-400 mt-0.5">
              🍇 포도판 {activeBoardCount}개 진행 중
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
                onClick={() => onViewBoards?.(friend.user.id)}
                className="clay-button p-2 rounded-xl text-sm font-medium text-grape-500 transition-all active:scale-95"
                title="포도판 보기"
              >
                🍇
              </button>
              <button
                onClick={() => onSendCheer?.(friend.user.id)}
                className="clay-button p-2 rounded-xl text-lg transition-all active:scale-95"
                title="응원 보내기"
              >
                💜
              </button>
              <button
                onClick={() => onToggleFavorite?.(friend.id)}
                className="clay-button p-2 rounded-xl text-lg transition-all active:scale-95"
                title={friend.isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}
              >
                {friend.isFavorite ? '⭐' : '☆'}
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

      {/* View boards link for accepted friends */}
      {friend.status === 'accepted' && onViewBoards && (
        <button
          onClick={() => onViewBoards(friend.user.id)}
          className="mt-3 w-full clay-button px-3 py-2 rounded-xl text-xs font-medium text-grape-500 bg-gradient-to-r from-grape-50 to-clay-lavender/30 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
        >
          <span>🍇</span>
          <span>포도판 보기</span>
          <span className="text-warm-light">→</span>
        </button>
      )}
    </div>
  );
}
