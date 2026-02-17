'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import ClayButton from '@/components/ClayButton';
import ClayInput from '@/components/ClayInput';
import Avatar from '@/components/Avatar';
import { useAppStore } from '@/lib/store';
import { BOARD_SIZES } from '@/types';
import type { FriendInfo } from '@/types';

export default function CreateRelayPage() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);

  const [title, setTitle] = useState('');
  const [totalStickers, setTotalStickers] = useState(10);
  const [friends, setFriends] = useState<FriendInfo[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const fetchFriends = useCallback(async () => {
    try {
      const data = await api<{ friends: FriendInfo[] }>('/api/friends');
      // Only show accepted friends
      setFriends((data.friends || []).filter((f) => f.status === 'accepted'));
    } catch {}
    setLoadingFriends(false);
  }, []);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  const toggleFriend = (userId: string) => {
    setSelectedFriendIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      setError('제목을 입력해주세요');
      return;
    }
    if (selectedFriendIds.length === 0) {
      setError('친구를 한 명 이상 선택해주세요');
      return;
    }

    setCreating(true);
    setError('');
    try {
      const data = await api<{ relay: { id: string } }>('/api/relays', {
        method: 'POST',
        json: {
          title: title.trim(),
          totalStickers,
          friendIds: selectedFriendIds,
        },
      });
      router.replace(`/relay/${data.relay.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '생성에 실패했어요');
    }
    setCreating(false);
  };

  // Build ordered list for preview
  const orderedParticipants = [
    user
      ? { id: user.id, name: user.name, avatar: user.avatar, isCreator: true }
      : null,
    ...selectedFriendIds
      .map((fId) => {
        const friend = friends.find((f) => f.user.id === fId);
        return friend
          ? { id: friend.user.id, name: friend.user.name, avatar: friend.user.avatar, isCreator: false }
          : null;
      })
      .filter(Boolean),
  ].filter(Boolean) as { id: string; name: string; avatar: string; isCreator: boolean }[];

  return (
    <div className="pb-4">
      {/* Back button */}
      <button
        onClick={() => router.push('/relay')}
        className="clay-button px-3 py-2 rounded-xl text-sm text-warm-sub mb-4"
      >
        {'\u2190'} 릴레이 목록
      </button>

      <h1 className="text-2xl font-bold text-grape-700 mb-6">
        {'\uD83D\uDD17'} 새 릴레이 만들기
      </h1>

      <div className="space-y-6">
        {/* Title input */}
        <ClayInput
          label="릴레이 제목"
          placeholder="어떤 습관을 릴레이할까요?"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setError('');
          }}
        />

        {/* Board size selector */}
        <div>
          <label className="block text-sm font-medium text-warm-sub mb-3 ml-1">
            포도알 개수
          </label>
          <div className="grid grid-cols-2 gap-3">
            {BOARD_SIZES.map((size) => (
              <button
                key={size.value}
                onClick={() => setTotalStickers(size.value)}
                className={`
                  clay-button p-4 rounded-2xl text-center transition-all
                  ${
                    totalStickers === size.value
                      ? 'ring-2 ring-grape-400 bg-gradient-to-br from-clay-lavender/60 to-clay-lavender/30'
                      : 'bg-gradient-to-br from-white to-grape-50/30'
                  }
                `}
              >
                <div className="text-2xl mb-1">
                  {size.value <= 10
                    ? '\uD83C\uDF47'
                    : size.value <= 15
                    ? '\uD83C\uDF47\uD83C\uDF47'
                    : size.value <= 20
                    ? '\uD83C\uDF47\uD83C\uDF47\uD83C\uDF47'
                    : '\uD83C\uDF47\uD83C\uDF47\uD83C\uDF47\uD83C\uDF47'}
                </div>
                <p className="font-bold text-grape-700">{size.label}</p>
                <p className="text-xs text-warm-sub">{size.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Friend selector */}
        <div>
          <label className="block text-sm font-medium text-warm-sub mb-3 ml-1">
            함께할 친구 선택
          </label>
          {loadingFriends ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="skeleton h-14 w-full" />
              ))}
            </div>
          ) : friends.length === 0 ? (
            <div className="clay-sm p-6 text-center bg-gradient-to-br from-white to-gray-50/50">
              <p className="text-sm text-warm-sub mb-1">
                아직 친구가 없어요
              </p>
              <p className="text-xs text-warm-light">
                친구를 먼저 추가해 주세요!
              </p>
              <ClayButton
                size="sm"
                variant="secondary"
                className="mt-3"
                onClick={() => router.push('/friends')}
              >
                친구 추가하러 가기
              </ClayButton>
            </div>
          ) : (
            <div className="space-y-2">
              {friends.map((friend) => {
                const isSelected = selectedFriendIds.includes(friend.user.id);
                return (
                  <button
                    key={friend.id}
                    onClick={() => toggleFriend(friend.user.id)}
                    className={`
                      w-full flex items-center gap-3 p-3 rounded-2xl transition-all
                      ${
                        isSelected
                          ? 'clay bg-gradient-to-br from-grape-50 to-clay-lavender/30 ring-2 ring-grape-300'
                          : 'clay-sm bg-gradient-to-br from-white to-gray-50/50'
                      }
                    `}
                  >
                    {/* Checkbox */}
                    <div
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        isSelected
                          ? 'bg-grape-500 border-grape-500 text-white'
                          : 'border-gray-300 bg-white'
                      }`}
                    >
                      {isSelected && (
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                    <Avatar avatar={friend.user.avatar} size="sm" />
                    <span className="font-medium text-warm-text text-sm">
                      {friend.user.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Order preview */}
        {orderedParticipants.length > 1 && (
          <div>
            <label className="block text-sm font-medium text-warm-sub mb-3 ml-1">
              릴레이 순서 미리보기
            </label>
            <div className="clay p-4 bg-gradient-to-br from-white to-clay-lavender/10">
              <div className="flex items-center gap-2 flex-wrap">
                {orderedParticipants.map((p, idx) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <div className="flex flex-col items-center">
                      <Avatar avatar={p.avatar} size="sm" />
                      <span className="text-xs text-warm-sub mt-1">
                        {p.isCreator ? '나' : p.name}
                      </span>
                    </div>
                    {idx < orderedParticipants.length - 1 && (
                      <div className="text-grape-400 font-bold text-lg mx-1">
                        {'\u2192'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-red-400 text-sm text-center">{error}</p>
        )}

        {/* Create button */}
        <ClayButton
          fullWidth
          size="lg"
          onClick={handleCreate}
          loading={creating}
          disabled={!title.trim() || selectedFriendIds.length === 0}
        >
          릴레이 시작!
        </ClayButton>
      </div>
    </div>
  );
}
