'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useCachedApi } from '@/lib/cachedApi';
import Avatar from '@/components/Avatar';
import BoardCard from '@/components/BoardCard';
import ClayButton from '@/components/ClayButton';
import CheerModal from '@/components/CheerModal';
import PlantGiftModal from '@/components/PlantGiftModal';
import EmojiIcon from '@/components/EmojiIcon';
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

  // SWR 캐시(친구별 키): 재방문 시 직전 프로필·보드로 즉시 렌더 + 무음 재검증.
  const { data, loading, error, mutate } = useCachedApi<FriendBoardsResponse>(
    `/api/friends/${friendId}/boards`,
  );
  const friend = data?.friend ?? null;
  const boards = data?.boards ?? [];
  const friendshipId = data?.friendship.id ?? '';
  const isFavorite = data?.friendship.isFavorite ?? false;
  const [showCheer, setShowCheer] = useState(false);
  const [cheerSent, setCheerSent] = useState(false);
  const [plantTarget, setPlantTarget] = useState<BoardSummary | null>(null);
  const [plantedFeedback, setPlantedFeedback] = useState(false);

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
    // optimistic — the star reacts instantly; rollback = same flip on failure
    const flip = (prev: typeof data) =>
      prev && { ...prev, friendship: { ...prev.friendship, isFavorite: !prev.friendship.isFavorite } };
    mutate(flip);
    try {
      await api(`/api/friends/${friendshipId}`, {
        method: 'PATCH',
        json: { action: 'favorite' },
      });
    } catch {
      mutate(flip);
    }
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
          <EmojiIcon emoji="😥" size={40} className="block mx-auto mb-3" />
          <p className="text-warm-sub">친구를 찾을 수 없습니다</p>
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
              {isFavorite && <EmojiIcon emoji="⭐" size={18} />}
            </div>
            <p className="text-xs text-warm-sub mt-1 tabular-nums">
              포도판 {boards.length} · 진행 {activeBoards.length} · 완료 {completedBoards.length}
            </p>
          </div>
        </div>

        {/* Action buttons — 응원+즐겨찾기 한 줄, 포도판 선물하기 한 줄 */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <ClayButton variant="primary" size="sm" onClick={() => setShowCheer(true)} className="flex-1">
              <EmojiIcon emoji="💜" size={16} />응원 보내기
            </ClayButton>
            <button
              onClick={handleToggleFavorite}
              aria-label={isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}
              aria-pressed={isFavorite}
              className={`clay-button px-4 flex items-center justify-center rounded-2xl shrink-0 transition-all active:scale-95 ${
                isFavorite ? 'bg-amber-50/70' : ''
              }`}
            >
              <EmojiIcon emoji="⭐" size={20} className={isFavorite ? '' : 'opacity-30 grayscale'} />
            </button>
          </div>
          <ClayButton variant="secondary" size="sm" onClick={handleGiftBoard} fullWidth>
            <EmojiIcon emoji="🎁" size={16} />포도판 선물하기
          </ClayButton>
        </div>
      </div>

      {/* Cheer sent feedback */}
      {cheerSent && (
        <div className="clay-sm p-3 mb-4 bg-leaf-100/60 text-center animate-bounce-in">
          <span className="text-sm font-medium text-grape-600">
            <EmojiIcon emoji="💜" size={14} className="mr-0.5" />응원을 보냈어요!
          </span>
        </div>
      )}

      {plantedFeedback && (
        <div className="clay-sm p-3 mb-4 bg-leaf-100/60 text-center animate-bounce-in">
          <span className="text-sm font-medium text-grape-600">
            <EmojiIcon emoji="🎁" size={14} className="mr-0.5" />깜짝 선물을 숨겨놨어요!
          </span>
        </div>
      )}

      {/* Active boards */}
      {activeBoards.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-warm-sub mb-3 tabular-nums">
            <EmojiIcon emoji="🍇" size={15} className="mr-1" />진행 중인 포도판 ({activeBoards.length})
          </h2>
          <div className="space-y-3">
            {activeBoards.map((board) => (
              <div key={board.id} className="space-y-1.5">
                <BoardCard board={board} />
                {board.allowFriendPlant === false ? (
                  <p className="text-center text-[11px] text-warm-sub py-1.5">이 친구는 깜짝 선물 받기를 꺼뒀어요</p>
                ) : (
                  <button
                    onClick={() => setPlantTarget(board)}
                    className="w-full clay-button py-2 rounded-xl text-xs font-semibold text-grape-600 bg-grape-50/70"
                  >
                    <EmojiIcon emoji="🎁" size={13} className="mr-1" />이 포도판에 깜짝 선물 심기
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed boards */}
      {completedBoards.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-warm-sub mb-3 tabular-nums">
            <EmojiIcon emoji="🎉" size={15} className="mr-1" />완료한 포도판 ({completedBoards.length})
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
          <EmojiIcon emoji="🍇" size={40} className="block mx-auto mb-3" />
          <p className="text-warm-sub">아직 포도판이 없어요</p>
          <p className="text-xs text-warm-sub mt-1">포도판을 선물해 보세요!</p>
          <ClayButton
            variant="primary"
            size="sm"
            onClick={handleGiftBoard}
            className="mt-4"
          >
            <EmojiIcon emoji="🎁" size={16} />포도판 선물하기
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

      {plantTarget && (
        <PlantGiftModal
          board={plantTarget}
          onClose={() => setPlantTarget(null)}
          onPlanted={() => { setPlantedFeedback(true); setTimeout(() => setPlantedFeedback(false), 2500); }}
        />
      )}
    </div>
  );
}
