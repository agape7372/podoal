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
    // finally에서 로딩을 해제해야 실패 시에도 스피너가 고착되지 않는다(확정 결함 #3).
    // 에러 표시 자체는 호출부(friends/page.tsx handleAccept)의 토스트가 맡으므로 여기선
    // 잡지 않고 그대로 흘려보낸다 — 그래야 실패 시 feedbackSuccess()도 건너뛴다.
    try {
      await onAccept?.(friend.id);
      feedbackSuccess();
    } catch {
      // 실패 안내(토스트)는 호출부(friends/page.tsx)가 담당 — 여기서 삼키지 않으면
      // unhandled rejection 콘솔 노이즈만 남는다. 성공 피드백은 자연히 생략된다.
    } finally {
      setLoading(false);
    }
  };

  const bg = friend.isFavorite
    ? statusBg.favorite
    : statusBg[friend.status] || statusBg.accepted;

  const isAccepted = friend.status === 'accepted';
  const canOpen = isAccepted && !!onViewBoards;

  // Identity block (avatar + name). For an accepted friend it becomes a
  // single large tap target that opens their detail/boards — replacing the old
  // duplicated 🍇 icon button + "포도판 보기" footer button (which both did the
  // same thing and squeezed the name into "테스...").
  const identity = (
    <>
      <Avatar avatar={friend.user.avatar} size="lg" />
      <div className="flex-1 min-w-0">
        <p className="font-display text-[15px] font-semibold text-warm-text truncate">{friend.user.name}</p>
        {typeof activeBoardCount === 'number' && isAccepted && (
          <p className="text-[11px] text-grape-600 mt-0.5 inline-flex items-center gap-1">
            <EmojiIcon emoji="🍇" size={13} /> 포도판 <span className="font-display font-semibold">{activeBoardCount}</span>개 진행 중
          </p>
        )}
      </div>
    </>
  );

  return (
    <div className={`clay-sm p-4 ${bg} transition-colors`}>
      <div className="flex items-center gap-3">
        {canOpen ? (
          <button
            onClick={() => { feedbackTap(); onViewBoards!(friend.user.id); }}
            className="flex items-center gap-3 flex-1 min-w-0 text-left active:scale-[0.99] transition-transform"
            aria-label={`${friend.user.name}님의 포도판 보기`}
          >
            {identity}
          </button>
        ) : (
          <div className="flex items-center gap-3 flex-1 min-w-0">{identity}</div>
        )}

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
              {onSendCheer && (
                <button
                  onClick={() => { feedbackTap(); onSendCheer(friend.user.id); }}
                  className="clay-button p-2 rounded-xl transition-[transform] active:scale-95"
                  aria-label="응원 보내기"
                >
                  <EmojiIcon emoji="💜" size={18} />
                </button>
              )}
              {onToggleFavorite && (
                <button
                  onClick={() => { feedbackTap(); onToggleFavorite(friend.id); }}
                  className="clay-button p-2 rounded-xl transition-[transform] active:scale-95"
                  aria-label={friend.isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}
                >
                  <EmojiIcon emoji="⭐" size={18} className={friend.isFavorite ? '' : 'opacity-30 grayscale'} />
                </button>
              )}
              {onRemove && (
                <button
                  onClick={() => onRemove(friend.id)}
                  className="clay-button p-2 rounded-xl transition-[transform] active:scale-95"
                  aria-label="삭제"
                >
                  <EmojiIcon emoji="❌" size={16} />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
