'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';
import Avatar from '@/components/Avatar';
import BoardCard from '@/components/BoardCard';
import ClayButton from '@/components/ClayButton';
import CheerModal from '@/components/CheerModal';
import type { BoardSummary, UserProfile } from '@/types';

interface FriendBoardsResponse {
  friend: UserProfile;
  boards: BoardSummary[];
  friendship: {
    id: string;
    isFavorite: boolean;
  };
}

export default function FriendDetailPage() {
  const router = useRouter();
  const params = useParams();
  const friendId = params.id as string;

  const [friend, setFriend] = useState<UserProfile | null>(null);
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [friendshipId, setFriendshipId] = useState<string>('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCheer, setShowCheer] = useState(false);
  const [cheerSent, setCheerSent] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);

  const fetchFriendData = useCallback(async () => {
    try {
      const data = await api<FriendBoardsResponse>(`/api/friends/${friendId}/boards`);
      setFriend(data.friend);
      setBoards(data.boards);
      setFriendshipId(data.friendship.id);
      setIsFavorite(data.friendship.isFavorite);
    } catch (e) {
      setError(e instanceof Error ? e.message : '데이터를 불러올 수 없습니다');
    }
    setLoading(false);
  }, [friendId]);

  useEffect(() => {
    fetchFriendData();
  }, [fetchFriendData]);

  const handleSendCheer = async (message: string, emoji: string) => {
    await api('/api/messages', {
      method: 'POST',
      json: { receiverId: friendId, content: message, type: 'cheer', emoji },
    });
    setCheerSent(true);
    setTimeout(() => setCheerSent(false), 2000);
  };

  const handleToggleFavorite = async () => {
    if (!friendshipId) return;
    setFavoriteLoading(true);
    try {
      await api(`/api/friends/${friendshipId}`, {
        method: 'PATCH',
        json: { action: 'favorite' },
      });
      setIsFavorite((prev) => !prev);
    } catch {}
    setFavoriteLoading(false);
  };

  const handleGiftBoard = () => {
    router.push(`/board/create?giftTo=${friendId}`);
  };

  const activeBoards = boards.filter((b) => !b.isCompleted);
  const completedBoards = boards.filter((b) => b.isCompleted);

  if (loading) {
    return (
      <div className="pb-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="skeleton w-10 h-10 rounded-full" />
          <div className="skeleton h-7 w-32" />
        </div>
        <div className="skeleton h-32 w-full mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-28 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !friend) {
    return (
      <div className="pb-4">
        <button
          onClick={() => router.push('/friends')}
          className="clay-button px-3 py-2 rounded-xl text-sm text-warm-sub mb-6"
        >
          ← 돌아가기
        </button>
        <div className="text-center py-12">
          <span className="text-4xl block mb-3">😥</span>
          <p className="text-warm-sub">{error || '친구를 찾을 수 없습니다'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-4">
      {/* Back button */}
      <button
        onClick={() => router.push('/friends')}
        className="clay-button px-3 py-2 rounded-xl text-sm text-warm-sub mb-4 transition-all active:scale-95"
      >
        ← 친구 목록
      </button>

      {/* Friend profile card */}
      <div className="clay p-5 mb-6 bg-grape-50/80">
        <div className="flex items-center gap-4 mb-4">
          <Avatar avatar={friend.avatar} size="xl" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-display text-xl font-bold text-grape-700 truncate">{friend.name}</h1>
              {isFavorite && <span className="text-lg">⭐</span>}
            </div>
            <p className="text-sm text-warm-sub truncate">{friend.email}</p>
            <p className="text-xs text-warm-sub mt-1 tabular-nums">
              포도판 {boards.length}개 · 진행중 {activeBoards.length}개 · 완료 {completedBoards.length}개
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <ClayButton
            variant="primary"
            size="sm"
            onClick={() => setShowCheer(true)}
            className="flex-1"
          >
            💜 응원 보내기
          </ClayButton>
          <button
            onClick={handleToggleFavorite}
            disabled={favoriteLoading}
            className={`clay-button px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              isFavorite
                ? 'bg-amber-50/60 text-grape-700'
                : 'text-warm-sub'
            }`}
          >
            {isFavorite ? '⭐ 즐겨찾기' : '☆ 즐겨찾기'}
          </button>
          <ClayButton
            variant="secondary"
            size="sm"
            onClick={handleGiftBoard}
          >
            🎁 포도판 선물하기
          </ClayButton>
        </div>
      </div>

      {/* Cheer sent feedback */}
      {cheerSent && (
        <div className="clay-sm p-3 mb-4 bg-emerald-50/60 text-center animate-bounce-in">
          <span className="text-sm font-medium text-grape-600">
            💜 응원을 보냈어요.
          </span>
        </div>
      )}

      {/* Active boards */}
      {activeBoards.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-warm-sub mb-3 tabular-nums">
            🍇 진행 중인 포도판 ({activeBoards.length})
          </h2>
          <div className="space-y-3">
            {activeBoards.map((board) => (
              <BoardCard key={board.id} board={board} />
            ))}
          </div>
        </div>
      )}

      {/* Completed boards */}
      {completedBoards.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-warm-sub mb-3 tabular-nums">
            🎉 완료한 포도판 ({completedBoards.length})
          </h2>
          <div className="space-y-3">
            {completedBoards.map((board) => (
              <BoardCard key={board.id} board={board} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {boards.length === 0 && (
        <div className="text-center py-12">
          <span className="text-4xl block mb-3">🍇</span>
          <p className="text-warm-sub">아직 포도판이 없어요</p>
          <p className="text-xs text-warm-sub mt-1">포도판을 선물해 보세요!</p>
          <ClayButton
            variant="primary"
            size="sm"
            onClick={handleGiftBoard}
            className="mt-4"
          >
            🎁 포도판 선물하기
          </ClayButton>
        </div>
      )}

      {/* Cheer modal */}
      {showCheer && (
        <CheerModal
          recipientName={friend.name}
          onSend={handleSendCheer}
          onClose={() => setShowCheer(false)}
        />
      )}
    </div>
  );
}
