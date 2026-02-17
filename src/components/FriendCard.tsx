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
}

export default function FriendCard({
  friend,
  onAccept,
  onToggleFavorite,
  onRemove,
  onSendCheer,
}: FriendCardProps) {
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    setLoading(true);
    await onAccept?.(friend.id);
    setLoading(false);
  };

  return (
    <div className="clay-sm p-4 bg-gradient-to-br from-white to-clay-lavender/20 flex items-center gap-3">
      <Avatar avatar={friend.user.avatar} size="lg" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-warm-text truncate">{friend.user.name}</p>
          {friend.isFavorite && <span className="text-sm">⭐</span>}
        </div>
        <p className="text-xs text-warm-sub truncate">{friend.user.email}</p>
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
              onClick={() => onSendCheer?.(friend.user.id)}
              className="clay-button p-2 rounded-xl text-lg"
              title="응원 보내기"
            >
              💜
            </button>
            <button
              onClick={() => onToggleFavorite?.(friend.id)}
              className="clay-button p-2 rounded-xl text-lg"
              title={friend.isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}
            >
              {friend.isFavorite ? '⭐' : '☆'}
            </button>
            <button
              onClick={() => onRemove?.(friend.id)}
              className="clay-button p-2 rounded-xl text-sm text-warm-sub"
              title="삭제"
            >
              ✕
            </button>
          </>
        )}
      </div>
    </div>
  );
}
