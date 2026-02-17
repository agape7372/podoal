'use client';

import { useState, useEffect } from 'react';
import Avatar from './Avatar';
import ClayButton from './ClayButton';
import type { FriendInfo } from '@/types';

interface GiftBoardModalProps {
  boardTitle: string;
  onGift: (friendId: string) => Promise<void>;
  onClose: () => void;
}

export default function GiftBoardModal({ boardTitle, onGift, onClose }: GiftBoardModalProps) {
  const [friends, setFriends] = useState<FriendInfo[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/friends')
      .then((r) => r.json())
      .then((data) => {
        const accepted = (data.friends || []).filter((f: FriendInfo) => f.status === 'accepted');
        setFriends(accepted);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleGift = async () => {
    if (!selectedFriend) return;
    setSending(true);
    await onGift(selectedFriend);
    setSending(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg bg-clay-bg rounded-t-[32px] clay-float p-6 pb-8 safe-bottom animate-slide-up">
        <div className="w-12 h-1.5 bg-warm-border rounded-full mx-auto mb-5" />

        <h3 className="text-lg font-bold text-grape-700 text-center mb-1">
          🎁 포도판 선물하기
        </h3>
        <p className="text-sm text-warm-sub text-center mb-5">
          &ldquo;{boardTitle}&rdquo;을 누구에게 선물할까요?
        </p>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-16 w-full" />
            ))}
          </div>
        ) : friends.length === 0 ? (
          <div className="text-center py-8 text-warm-sub">
            <span className="text-3xl block mb-2">👥</span>
            아직 친구가 없어요
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto mb-5">
            {friends.map((friend) => (
              <button
                key={friend.id}
                onClick={() => setSelectedFriend(friend.user.id)}
                className={`
                  w-full clay-sm p-3 flex items-center gap-3 transition-all
                  ${selectedFriend === friend.user.id
                    ? 'ring-2 ring-grape-400 bg-gradient-to-br from-clay-lavender/40 to-white'
                    : 'bg-gradient-to-br from-white to-clay-lavender/10'
                  }
                `}
              >
                <Avatar avatar={friend.user.avatar} size="md" />
                <div className="flex-1 text-left">
                  <p className="font-semibold text-sm">{friend.user.name}</p>
                  <p className="text-xs text-warm-sub">{friend.user.email}</p>
                </div>
                {selectedFriend === friend.user.id && (
                  <span className="text-grape-500 text-xl">✓</span>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-3">
          <ClayButton variant="ghost" onClick={onClose} fullWidth>
            취소
          </ClayButton>
          <ClayButton
            variant="primary"
            onClick={handleGift}
            fullWidth
            loading={sending}
            disabled={!selectedFriend}
          >
            🎁 선물하기
          </ClayButton>
        </div>
      </div>
    </div>
  );
}
