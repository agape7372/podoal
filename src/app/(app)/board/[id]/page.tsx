'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import GrapeBoard from '@/components/GrapeBoard';
import Confetti from '@/components/Confetti';
import GiftBoardModal from '@/components/GiftBoardModal';
import GiftUnboxModal from '@/components/GiftUnboxModal';
import SurpriseRevealModal from '@/components/SurpriseRevealModal';
import MidRewardModal from '@/components/MidRewardModal';
import EditBoardInfoModal from '@/components/EditBoardInfoModal';
import RewardRevealModal from '@/components/RewardRevealModal';
import ShareCardModal from '@/components/ShareCardModal';
import CapsuleModal from '@/components/CapsuleModal';
import Avatar from '@/components/Avatar';
import ConfirmDialog from '@/components/ConfirmDialog';
import EmojiIcon from '@/components/EmojiIcon';
import type { BoardDetail, PlantedGiftInfo, RewardInfo } from '@/types';
import { REWARD_TYPE_ICON, ICON } from '@/lib/icons';
import { feedbackTap } from '@/lib/feedback';
import { stripTitleEmoji } from '@/lib/title';

export default function BoardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const [board, setBoard] = useState<BoardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGift, setShowGift] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showCapsule, setShowCapsule] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditInfo, setShowEditInfo] = useState(false);
  // Burst counter for the shared <Confetti>. Bumped both when a fill unlocks a
  // reward (via GrapeBoard's onCelebrate) and when a reward is opened.
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  // Queue of friend-planted surprises waiting to be revealed one-by-one. A single
  // filled grape can carry several (overlap allowed), shown sequentially.
  const [surpriseQueue, setSurpriseQueue] = useState<PlantedGiftInfo[]>([]);
  // Long-press / "+ 중간 보상" → MidRewardModal targeting this 0-based grape.
  const [plantPos, setPlantPos] = useState<number | null>(null);
  // A mid reward just reached → opened immediately in a popup (instant "쾌감").
  const [rewardPopup, setRewardPopup] = useState<RewardInfo | null>(null);
  const initialLoadDoneRef = useRef(false);

  const fetchBoard = useCallback(async () => {
    try {
      const data = await api<{ board: BoardDetail }>(`/api/boards/${id}`);
      setBoard(data.board);
      setErrorMessage(null);
      initialLoadDoneRef.current = true;
    } catch {
      // First load failure → board genuinely missing or no permission, bail home.
      // Later failures → keep the UI mounted; surface a banner so the user can retry.
      if (!initialLoadDoneRef.current) {
        router.replace('/home');
      } else {
        setErrorMessage('일시적으로 동기화에 실패했어요. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  const handleFillSticker = async (position: number) => {
    if (!board || !user) return;

    // Optimistic update: show the grape as filled immediately so the tap
    // feels instant even when the round-trip to Neon (us-east) is ~400ms.
    const tempId = `temp-${position}-${Date.now()}`;
    const optimisticSticker = {
      id: tempId,
      position,
      filledAt: new Date().toISOString(),
      filledBy: { id: user.id, name: user.name, email: user.email, avatar: user.avatar },
    } as BoardDetail['stickers'][number];

    setBoard((prev) => prev ? {
      ...prev,
      stickers: [...prev.stickers, optimisticSticker],
      filledCount: prev.filledCount + 1,
    } : prev);

    try {
      const result = await api<{
        sticker: BoardDetail['stickers'][number];
        filledCount: number;
        isCompleted: boolean;
        unlockedReward: { id: string; type: string; title: string; triggerAt: number } | null;
        plantedGift: PlantedGiftInfo | null;
        plantedGifts?: PlantedGiftInfo[];
      }>(`/api/boards/${id}/stickers`, {
        method: 'POST',
        json: { position },
      });
      setErrorMessage(null);

      // Reconcile: replace the temp sticker with the server's authoritative one
      // and lock in the server's filledCount / completion flag.
      setBoard((prev) => prev ? {
        ...prev,
        stickers: [
          ...prev.stickers.filter((s) => s.id !== tempId),
          result.sticker,
        ],
        filledCount: result.filledCount,
        isCompleted: result.isCompleted,
      } : prev);

      // Reward unlocks are rare; only re-fetch when one fires so the
      // reward card can update from "locked" to "tap to reveal".
      if (result.unlockedReward) {
        const u = result.unlockedReward;
        // 중간 보상: GrapeBoard가 컨페티와 같은 비트에 팝업을 이미 열었음
        // (onMidRewardReached). 여기선 reveal로 내용만 채워(공개 처리) 열려 있는
        // 팝업에 흘려보낸다. 최종 보상은 팝업 자동 오픈 없이 카드 탭으로 연다.
        if (u.triggerAt < board.totalStickers) {
          try {
            const d = await api<{ reward: RewardInfo }>(
              `/api/boards/${id}/rewards/${u.id}/reveal`,
              { method: 'POST' },
            );
            setRewardPopup((prev) => (prev && prev.id === d.reward.id ? d.reward : prev));
          } catch {
            // reveal 실패해도 목록 칩 탭으로 열 수 있음
          }
        }
        fetchBoard();
      }

      // Friends' hidden surprises on this grape — queue them for sequential
      // reveal with confetti. (plantedGifts is the full list; plantedGift is the
      // back-compat single value.)
      const gifts = result.plantedGifts ?? (result.plantedGift ? [result.plantedGift] : []);
      if (gifts.length > 0) {
        setSurpriseQueue((q) => [...q, ...gifts]);
        setConfettiTrigger((t) => t + 1);
      }
    } catch (err) {
      // Rollback the optimistic sticker on failure.
      setBoard((prev) => prev ? {
        ...prev,
        stickers: prev.stickers.filter((s) => s.id !== tempId),
        filledCount: Math.max(0, prev.filledCount - 1),
      } : prev);
      setRewardPopup(null); // close any popup opened optimistically for this fill
      const msg = err instanceof Error ? err.message : '포도알을 채우지 못했어요';
      setErrorMessage(`${msg} — 잠시 후 다시 시도해주세요.`);
      // Best-effort full resync in case the failure was due to drift (e.g.
      // another lambda already created the sticker).
      fetchBoard().catch(() => {});
    }
  };

  const handleToggleAllowPlant = async () => {
    if (!board) return;
    const next = !(board.allowFriendPlant ?? true);
    setBoard((b) => (b ? { ...b, allowFriendPlant: next } : b)); // optimistic
    try {
      await api(`/api/boards/${id}`, { method: 'PATCH', json: { allowFriendPlant: next } });
    } catch {
      setBoard((b) => (b ? { ...b, allowFriendPlant: !next } : b)); // rollback
    }
  };

  const handleEditInfo = async (next: { title: string; description: string }) => {
    const prev = board;
    setBoard((b) => (b ? { ...b, ...next } : b)); // optimistic
    try {
      await api(`/api/boards/${id}`, { method: 'PATCH', json: next });
      setErrorMessage(null);
    } catch (err) {
      setBoard(prev); // 전체 스냅샷 롤백
      const msg = err instanceof Error ? err.message : '수정에 실패했어요';
      setErrorMessage(`${msg} — 잠시 후 다시 시도해주세요.`);
      throw err; // 모달이 열린 채 자체 에러를 표시하도록 재던짐
    }
  };

  const handleGift = async (friendId: string, message: string) => {
    try {
      await api(`/api/boards/${id}/gift`, {
        method: 'POST',
        json: { friendId, message },
      });
      setErrorMessage(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '선물 전송에 실패했어요';
      setErrorMessage(`${msg} — 잠시 후 다시 시도해주세요.`);
    }
  };

  // Recipient unwraps a gifted board (one-time reveal).
  const handleOpenGift = async () => {
    try {
      await api(`/api/boards/${id}/gift-open`, { method: 'POST' });
    } catch {
      // non-blocking; still let them in
    }
    setBoard((b) => (b ? { ...b, giftOpenedAt: new Date().toISOString() } : b));
    setConfettiTrigger((t) => t + 1);
  };

  const handleDeclineGift = async () => {
    try {
      await api(`/api/boards/${id}`, { method: 'DELETE' });
    } catch {
      // ignore — navigate away regardless
    }
    router.push('/home');
  };

  // Open a reward in the popup (mid chip / final card tap). Opens INSTANTLY; if
  // the content isn't loaded yet (unrevealed → board GET hides it) fetch it via
  // reveal (which also marks it revealed). Revealed rewards already carry content.
  const openReward = async (reward: RewardInfo) => {
    setRewardPopup(reward);
    setConfettiTrigger((t) => t + 1);
    if (!reward.content) {
      try {
        const d = await api<{ reward: RewardInfo }>(
          `/api/boards/${id}/rewards/${reward.id}/reveal`,
          { method: 'POST' },
        );
        setRewardPopup((prev) => (prev && prev.id === d.reward.id ? d.reward : prev));
        fetchBoard();
      } catch {
        setErrorMessage('보상을 여는 데 실패했어요. 잠시 후 다시 시도해주세요.');
      }
    }
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    setDeleting(true);
    try {
      await api(`/api/boards/${id}`, { method: 'DELETE' });
      router.replace('/home');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '삭제에 실패했어요';
      setErrorMessage(`${msg} — 잠시 후 다시 시도해주세요.`);
      setDeleting(false);
    }
  };

  if (loading || !board) {
    return (
      <div className="pb-4" aria-busy="true" aria-label="포도판 불러오는 중">
        <div className="flex items-center justify-between mb-4">
          <div className="skeleton h-5 w-20" />
          <div className="skeleton h-7 w-28" />
        </div>
        <div className="skeleton h-7 w-40 mx-auto mb-6" />
        <div className="clay-float p-6 mb-6 flex flex-col items-center">
          <div className="skeleton h-3 w-full mb-5" />
          <div className="skeleton h-44 w-44 rounded-full" />
        </div>
        <div className="skeleton h-20 w-full mb-3" />
        <div className="skeleton h-16 w-full" />
      </div>
    );
  }

  const isOwner = user?.id === board.owner.id;
  const allowPlant = board.allowFriendPlant ?? true;
  const filledCount = board.stickers.length;
  // 중간 보상(아이콘 슬라이더) vs 완성 보상(카드) 분리.
  const midRewards = board.rewards
    .filter((r) => r.triggerAt < board.totalStickers)
    .sort((a, b) => a.triggerAt - b.triggerAt);
  const finalReward = board.rewards.find((r) => r.triggerAt === board.totalStickers) ?? null;

  return (
    <div className="pb-4">
      {/* Shared celebration — fires on grape-fill (reward unlock/완료) and on reward open */}
      <Confetti trigger={confettiTrigger} />

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => { feedbackTap(); router.push(isOwner ? '/home' : `/friends/${board.owner.id}`); }} className="text-warm-sub text-sm">
          ← 돌아가기
        </button>
        {isOwner && (
          <button
            onClick={() => { feedbackTap(); setShowDeleteConfirm(true); }}
            disabled={deleting}
            className="text-warm-sub hover:text-grape-700 text-sm disabled:opacity-50 transition-colors"
          >
            삭제
          </button>
        )}
      </div>

      {/* Owner actions — segmented bar (동결건조 · 선물 · 공유) */}
      {isOwner && (
        <div className="clay grid grid-cols-3 divide-x divide-warm-border mb-5 overflow-hidden">
          <button
            onClick={() => { feedbackTap(); setShowCapsule(true); }}
            className="py-2.5 text-sm text-grape-700 active:bg-grape-50 transition-colors"
          >
            동결건조
          </button>
          <button
            onClick={() => { feedbackTap(); setShowGift(true); }}
            className="py-2.5 text-sm text-grape-700 active:bg-grape-50 transition-colors"
          >
            선물
          </button>
          <button
            onClick={() => { feedbackTap(); setShowShare(true); }}
            className="py-2.5 text-sm text-grape-700 active:bg-grape-50 transition-colors"
          >
            공유
          </button>
        </div>
      )}

      {/* Owner: toggle whether friends may plant surprise gifts here */}
      {isOwner && !board.isCompleted && (
        <button
          onClick={() => { feedbackTap(); handleToggleAllowPlant(); }}
          role="switch"
          aria-checked={allowPlant}
          aria-label="친구가 깜짝 선물 심기"
          className="w-full clay-sm px-4 py-3 mb-5 flex items-center justify-between transition-all active:scale-[0.99]"
        >
          <span className="inline-flex items-center gap-2 text-sm text-warm-text">
            <EmojiIcon emoji="🎁" size={18} />
            <span className="text-left">
              친구가 깜짝 선물 심기
              <span className="block text-[11px] text-warm-sub">친구가 빈 칸에 선물을 숨길 수 있어요</span>
            </span>
          </span>
          <span className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${allowPlant ? 'bg-grape-400' : 'bg-warm-border'}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${allowPlant ? 'translate-x-5' : ''}`} />
          </span>
        </button>
      )}

      {errorMessage && (
        <div className="mb-3 p-3 rounded-2xl bg-grape-100/40 border border-grape-200/60 text-grape-700 text-sm flex items-start gap-2">
          <EmojiIcon emoji="⚠️" size={16} className="leading-tight" />
          <span className="flex-1 leading-snug">{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-grape-700 hover:text-grape-800 text-lg leading-none px-1"
            aria-label="알림 닫기"
          >
            ×
          </button>
        </div>
      )}

      {/* Board info */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-1.5 mb-1">
          <h1 className="font-display text-2xl font-bold text-grape-700">{stripTitleEmoji(board.title)}</h1>
          {isOwner && (
            <button
              onClick={() => { feedbackTap(); setShowEditInfo(true); }}
              aria-label="제목·설명 수정"
              className="text-warm-sub hover:text-grape-700 p-1 transition-colors"
            >
              <EmojiIcon emoji="✏️" size={15} />
            </button>
          )}
        </div>
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
          onCelebrate={() => setConfettiTrigger((t) => t + 1)}
          isOwner={isOwner}
          onPlantReward={
            isOwner && !board.isCompleted
              ? (pos) => { feedbackTap(); setPlantPos(pos); }
              : undefined
          }
          onMidRewardReached={(r) => setRewardPopup(r)}
        />
      </div>

      {/* Rewards section — owner-only. A visiting friend (read-only) must not see
          the owner's private rewards; the API also masks content, this hides the
          chips/cards and the dead "open" buttons (reveal is owner/recipient-gated). */}
      {board.rewards.length > 0 && isOwner && (
        <div className="mb-6 space-y-3">
          <h3 className="text-sm font-semibold text-warm-sub">
            <EmojiIcon emoji={ICON.gift} size={15} className="mr-0.5" />보상
          </h3>

          {/* 중간 보상 — 가로 스크롤 아이콘 칩 (잠금/도착/공개 상태별) */}
          {midRewards.length > 0 && (
            <div className="flex gap-2.5 overflow-x-auto py-2 px-0.5 scrollbar-hide">
              {midRewards.map((r) => {
                const unlocked = filledCount >= r.triggerAt;
                const revealed = r.revealedAt !== null;
                return (
                  <button
                    key={r.id}
                    onClick={() => { if (unlocked) { feedbackTap(); openReward(r); } }}
                    disabled={!unlocked}
                    aria-label={`${r.triggerAt}알 중간 보상${unlocked ? (revealed ? ' 다시 보기' : ' 열기') : ' (잠김)'}`}
                    className={`relative flex-shrink-0 w-14 h-14 rounded-2xl clay-sm flex items-center justify-center transition-all
                      ${unlocked ? 'cursor-pointer active:scale-95' : 'opacity-50'}
                      ${unlocked && !revealed ? 'reward-glow bg-amber-50/70' : ''}`}
                  >
                    <EmojiIcon emoji={REWARD_TYPE_ICON[r.type]} size={26} />
                    <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[9px] font-medium text-warm-sub tabular-nums bg-clay-bg border border-warm-border/60 px-1 rounded-full leading-tight">
                      {r.triggerAt}
                    </span>
                    {!unlocked && (
                      <span className="absolute -bottom-1 -right-1">
                        <EmojiIcon emoji={ICON.lock} size={13} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* 완성 보상 — 카드 (잠금 / 달성·강조 / 공개됨) */}
          {finalReward && (
            finalReward.revealedAt !== null ? (
              <button
                onClick={() => { feedbackTap(); openReward(finalReward); }}
                className="w-full clay-sm p-4 flex items-center gap-3 text-left active:scale-[0.99] transition-transform"
              >
                <EmojiIcon emoji={REWARD_TYPE_ICON[finalReward.type]} size={28} />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-grape-700 truncate">{finalReward.title}</p>
                  <p className="text-xs text-warm-sub">완성 보상 · 다시 보기</p>
                </div>
              </button>
            ) : filledCount >= finalReward.triggerAt ? (
              <button
                onClick={() => { feedbackTap(); openReward(finalReward); }}
                className="w-full clay-float p-6 text-center reward-glow active:scale-[0.97] transition-transform bg-gradient-to-br from-amber-50 via-clay-cream/60 to-grape-50"
              >
                <div className="animate-float mb-2">
                  <EmojiIcon emoji="🎉" size={48} className="mx-auto" />
                </div>
                <p className="font-display text-xl font-bold text-grape-700">달성! 눌러서 열기</p>
                <p className="text-sm text-warm-sub mt-1">완성 보상이 도착했어요</p>
              </button>
            ) : (
              <div className="w-full clay-sm p-4 bg-grape-50/50">
                <div className="flex items-center justify-center gap-2">
                  <EmojiIcon emoji={ICON.lock} size={20} />
                  <p className="text-sm text-warm-sub">
                    완성 보상 · {finalReward.triggerAt - filledCount}알 더 채우면 열려요
                  </p>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* Recent sticker activity */}
      {board.stickers.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-warm-sub mb-3">최근 활동</h3>
          <div className="clay-sm divide-y divide-warm-border/70">
            {board.stickers.slice(-5).reverse().map((sticker) => (
              <div key={sticker.id} className="p-3 flex items-center gap-2">
                <EmojiIcon emoji="🍇" size={18} />
                <span className="text-sm text-warm-text tabular-nums">
                  {sticker.position + 1}번째 포도알
                </span>
                <span className="text-xs text-warm-sub ml-auto tabular-nums">
                  {new Date(sticker.filledAt).toLocaleDateString('ko-KR')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        title="포도판을 삭제할까요?"
        description="삭제하면 되돌릴 수 없어요."
        confirmLabel="삭제"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

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

      {/* Gift unbox — received whole-board gift */}
      {board.giftedFrom && !board.giftOpenedAt && isOwner && (
        <GiftUnboxModal
          senderName={board.giftedFrom.name}
          senderAvatar={board.giftedFrom.avatar}
          boardTitle={stripTitleEmoji(board.title)}
          message={board.giftMessage}
          onOpen={handleOpenGift}
          onDecline={handleDeclineGift}
        />
      )}

      {/* Friend-planted surprise reveals — one at a time (sequential queue).
          key={gift.id} remounts the modal per surprise so its bounce-in and the
          internal one-shot Confetti(trigger=1) replay for the 2nd+ gift too. */}
      {surpriseQueue.length > 0 && (
        <SurpriseRevealModal key={surpriseQueue[0].id} gift={surpriseQueue[0]} onClose={() => setSurpriseQueue((q) => q.slice(1))} />
      )}

      {/* Mid reward reached → instant popup reveal */}
      {rewardPopup && (
        <RewardRevealModal reward={rewardPopup} onClose={() => setRewardPopup(null)} />
      )}

      {/* Plant / edit a 중간 보상 (long-press a grape, or the "+ 중간 보상" button) */}
      {plantPos !== null && (
        <MidRewardModal
          board={{ id, totalStickers: board.totalStickers, filledCount: board.stickers.length }}
          position={plantPos}
          existingReward={board.rewards.find((r) => r.triggerAt === plantPos + 1) ?? null}
          onClose={() => setPlantPos(null)}
          onSaved={() => fetchBoard()}
        />
      )}

      {showGift && (
        <GiftBoardModal
          boardTitle={stripTitleEmoji(board.title)}
          onGift={handleGift}
          onClose={() => setShowGift(false)}
        />
      )}

      {/* Owner: edit board title/description */}
      {showEditInfo && (
        <EditBoardInfoModal
          initialTitle={board.title}
          initialDescription={board.description ?? ''}
          onSave={handleEditInfo}
          onClose={() => setShowEditInfo(false)}
        />
      )}
    </div>
  );
}
