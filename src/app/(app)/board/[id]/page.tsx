'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import GrapeBoard from '@/components/GrapeBoard';
import RewardReveal from '@/components/RewardReveal';
import GiftBoardModal from '@/components/GiftBoardModal';
import ShareCardModal from '@/components/ShareCardModal';
import CapsuleModal from '@/components/CapsuleModal';
import Avatar from '@/components/Avatar';
import type { BoardDetail } from '@/types';
import { feedbackTap } from '@/lib/feedback';

export default function BoardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const [board, setBoard] = useState<BoardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGift, setShowGift] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showCapsule, setShowCapsule] = useState(false);
  const [showReward, setShowReward] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchBoard = useCallback(async () => {
    try {
      const data = await api<{ board: BoardDetail }>(`/api/boards/${id}`);
      setBoard(data.board);
    } catch {
      router.replace('/home');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  const handleFillSticker = async (position: number) => {
    await api(`/api/boards/${id}/stickers`, {
      method: 'POST',
      json: { position },
    });
    await fetchBoard();
  };

  const handleGift = async (friendId: string) => {
    await api(`/api/boards/${id}/gift`, {
      method: 'POST',
      json: { friendId },
    });
  };

  const handleDelete = async () => {
    if (!confirm('정말 삭제할까요?')) return;
    setDeleting(true);
    try {
      await api(`/api/boards/${id}`, { method: 'DELETE' });
      router.replace('/home');
    } catch {
      setDeleting(false);
    }
  };

  if (loading || !board) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-5xl animate-float mb-4">🍇</div>
          <p className="text-warm-sub">포도판 불러오는 중...</p>
        </div>
      </div>
    );
  }

  const isOwner = user?.id === board.owner.id;
  const filledCount = board.stickers.length;

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => { feedbackTap(); router.push('/home'); }} className="text-warm-sub text-sm">
          ← 돌아가기
        </button>
        {isOwner && (
          <div className="flex gap-2">
            <button
              onClick={() => { feedbackTap(); setShowShare(true); }}
              className="clay-button px-3 py-1.5 rounded-xl text-sm"
            >
              📤 공유
            </button>
            <button
              onClick={() => { feedbackTap(); setShowCapsule(true); }}
              className="clay-button px-3 py-1.5 rounded-xl text-sm"
            >
              💊 동결건조
            </button>
            <button
              onClick={() => { feedbackTap(); setShowGift(true); }}
              className="clay-button px-3 py-1.5 rounded-xl text-sm"
            >
              🎁 선물
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="clay-button px-3 py-1.5 rounded-xl text-sm text-red-400"
            >
              삭제
            </button>
          </div>
        )}
      </div>

      {/* Board info */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-grape-700 mb-1">{board.title}</h1>
        {board.description && (
          <p className="text-sm text-warm-sub mb-2">{board.description}</p>
        )}

        {/* Gifted info */}
        {board.giftedFrom && (
          <div className="inline-flex items-center gap-2 clay-sm px-3 py-1.5 bg-grape-50">
            <Avatar avatar={board.giftedFrom.avatar} size="sm" />
            <span className="text-xs text-warm-sub">
              {board.giftedFrom.name}님이 선물한 포도판
            </span>
          </div>
        )}
      </div>

      {/* Grape Board */}
      <div className="clay-float p-6 mb-6">
        <GrapeBoard
          board={board}
          onFill={handleFillSticker}
          canFill={isOwner && !board.isCompleted}
        />
      </div>

      {/* Rewards section */}
      {board.rewards.length > 0 && (
        <div className="mb-6 space-y-3">
          <h3 className="text-sm font-semibold text-warm-sub">
            🎁 보상 ({board.rewards.filter((r) => filledCount >= r.triggerAt).length}/{board.rewards.length})
          </h3>
          {board.rewards.map((reward) => {
            const isUnlocked = filledCount >= reward.triggerAt;
            const remaining = reward.triggerAt - filledCount;
            return (
              <div key={reward.id}>
                {showReward === reward.id ? (
                  <RewardReveal
                    reward={reward}
                    isCompleted={isUnlocked}
                    onClose={() => setShowReward(null)}
                  />
                ) : (
                  <button
                    onClick={() => isUnlocked && setShowReward(reward.id)}
                    className={`
                      w-full clay p-4 text-center transition-all
                      ${isUnlocked
                        ? 'bg-amber-50/60 reward-glow cursor-pointer'
                        : 'bg-grape-50/60'
                      }
                    `}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-2xl">{isUnlocked ? '🎁' : '🔒'}</span>
                      <div className="text-left">
                        <p className="text-sm font-medium text-grape-600">
                          {isUnlocked ? reward.title : `${remaining}알 더 채우면 열려요`}
                        </p>
                        <p className="text-xs text-warm-sub">
                          {reward.triggerAt}알 달성 보상
                        </p>
                      </div>
                    </div>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Recent sticker activity */}
      {board.stickers.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-warm-sub mb-3">최근 활동</h3>
          <div className="space-y-2">
            {board.stickers.slice(-5).reverse().map((sticker) => (
              <div key={sticker.id} className="clay-sm p-3 flex items-center gap-2">
                <span className="text-lg">🍇</span>
                <span className="text-sm text-warm-text">
                  {sticker.position + 1}번째 포도알
                </span>
                <span className="text-xs text-warm-light ml-auto">
                  {new Date(sticker.filledAt).toLocaleDateString('ko-KR')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Share card modal */}
      {showShare && (
        <ShareCardModal
          board={board}
          userName={user?.name || '익명'}
          onClose={() => setShowShare(false)}
        />
      )}

      {/* Capsule modal */}
      {showCapsule && (
        <CapsuleModal
          boardId={id}
          isOwner={isOwner}
          onClose={() => setShowCapsule(false)}
        />
      )}

      {/* Gift modal */}
      {showGift && (
        <GiftBoardModal
          boardTitle={board.title}
          onGift={handleGift}
          onClose={() => setShowGift(false)}
        />
      )}
    </div>
  );
}
