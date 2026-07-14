'use client';

import { useState, useEffect, useCallback } from 'react';
import Modal, { useModalClose } from './Modal';
import Avatar from './Avatar';
import ClayButton from './ClayButton';
import EmojiIcon from './EmojiIcon';
import RetryButton from './RetryButton';
import type { FriendInfo } from '@/types';
import { api } from '@/lib/api';
import { feedbackSuccess, feedbackTap } from '@/lib/feedback';
import { stripTitleEmoji } from '@/lib/title';

interface GiftBoardModalProps {
  boardTitle: string;
  onGift: (friendId: string, message: string) => Promise<void>;
  onClose: () => void;
}

export default function GiftBoardModal({ boardTitle, onGift, onClose }: GiftBoardModalProps) {
  const { closeRef, requestClose } = useModalClose(onClose);
  const [friends, setFriends] = useState<FriendInfo[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [error, setError] = useState('');

  const loadFriends = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await api<{ friends?: FriendInfo[] }>('/api/friends', { signal });
      const accepted = (data.friends || []).filter((f) => f.status === 'accepted');
      setFriends(accepted);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setLoadError(true);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadFriends(controller.signal);
    return () => controller.abort();
  }, [loadFriends]);

  const handleGift = async () => {
    if (!selectedFriend) return;
    setSending(true);
    setError('');
    try {
      await onGift(selectedFriend, message.trim());
      feedbackSuccess();
      requestClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '선물을 보내지 못했어요');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      closeRef={closeRef}
      label="포도판 선물하기"
      backdropClassName="z-90 bg-black/30 backdrop-blur-xs"
    >
      <div className="w-12 h-1.5 bg-warm-border rounded-full mx-auto mb-5" />

      <h3 className="font-display text-xl font-bold text-grape-700 text-center mb-1">
          <EmojiIcon emoji="🎁" size={22} className="mr-1" />포도판 선물하기
        </h3>
        {/* 표시 시점 strip — 이모지 시작 제목의 런타임 생이모지 방지(PlantGiftModal과 통일). */}
        <p className="text-sm text-warm-sub text-center truncate">
          &ldquo;{stripTitleEmoji(boardTitle)}&rdquo;
        </p>
        <p className="text-sm text-warm-sub text-center mb-5">
          이 포도판을 누구에게 선물할까요?
        </p>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-16 w-full" />
            ))}
          </div>
        ) : loadError ? (
          <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-rose-700">친구 목록을 불러오지 못했어요</p>
            <RetryButton onRetry={() => void loadFriends()} />
          </div>
        ) : friends.length === 0 ? (
          <div className="text-center py-8 text-warm-sub">
            <EmojiIcon emoji="👥" size={32} className="block mx-auto mb-2" />
            아직 친구가 없어요
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto mb-5">
            {friends.map((friend) => (
              <button
                type="button"
                key={friend.id}
                onClick={() => { feedbackTap(); setSelectedFriend(friend.user.id); }}
                aria-pressed={selectedFriend === friend.user.id}
                aria-label={`${friend.user.name}님에게 선물하기`}
                className={`
                  w-full clay-sm p-3 flex items-center gap-3 transition-[background-color,box-shadow]
                  ${selectedFriend === friend.user.id
                    ? 'ring-2 ring-grape-400 bg-grape-50'
                    : ''
                  }
                `}
              >
                <Avatar avatar={friend.user.avatar} size="md" />
                <div className="flex-1 text-left">
                  <p className="font-semibold text-sm">{friend.user.name}</p>
                </div>
                {selectedFriend === friend.user.id && (
                  <EmojiIcon emoji="✅" size={20} />
                )}
              </button>
            ))}
          </div>
        )}

        <div className="mb-4">
          <label htmlFor="gift-board-message" className="block text-xs text-warm-sub mb-1.5 ml-1">선물 메시지 (선택)</label>
          <textarea
            id="gift-board-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="짧은 축하·응원 메시지를 적어보세요"
            maxLength={200}
            rows={2}
            className="clay-input resize-none text-sm"
          />
        </div>

        {error && (
          <p role="alert" className="text-rose-700 text-xs text-center mb-3">{error}</p>
        )}

        <div className="flex gap-3">
          <ClayButton variant="ghost" onClick={requestClose} fullWidth>
            취소
          </ClayButton>
          <ClayButton
            variant="primary"
            onClick={handleGift}
            fullWidth
            loading={sending}
            disabled={!selectedFriend}
          >
            <EmojiIcon emoji="🎁" size={16} className="mr-1" />선물하기
          </ClayButton>
        </div>
    </Modal>
  );
}
