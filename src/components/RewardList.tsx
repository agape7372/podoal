'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { invalidateCachedApi, useCachedApi } from '@/lib/cachedApi';
import { refreshUnreadCount } from '@/lib/notifications';
import EmojiIcon from './EmojiIcon';
import EmptyState from './EmptyState';
import RetryButton from './RetryButton';
import RewardRevealModal from './RewardRevealModal';
import { stripTitleEmoji } from '@/lib/title';
import { REWARD_TYPE_ICON } from '@/lib/icons';
import { REWARD_TYPE_LABELS } from '@/types';
import type { CollectedReward, RewardType, RewardInfo } from '@/types';
import { feedbackTap, feedbackError } from '@/lib/feedback';

type Filter = 'all' | RewardType;

/**
 * 받은 보상(중간·완성) 모음 리스트 — 포도밭 페이지와 소통(받은 보상) 탭이 공유.
 * 자체적으로 /api/rewards를 불러오고 타입 필터·열람 모달까지 처리.
 */
export default function RewardList() {
  // SWR 캐시: 재방문 시 직전 보상 목록으로 즉시 렌더 + 무음 재검증.
  const { data, loading, error, refresh, mutate } = useCachedApi<{ rewards: CollectedReward[] }>('/api/rewards');
  const rewards = data?.rewards ?? [];
  const [filter, setFilter] = useState<Filter>('all');
  // reward만이 아니라 그 원본 포도판 id도 함께 들고 있는다 — RewardInfo 자체엔
  // board가 없어서(CollectedReward에만 있음), 여는 시점에 같이 보관해 뒀다가
  // RewardRevealModal의 "이 포도판 보러가기" 링크에 넘긴다(W2-rewards-board-link).
  const [opened, setOpened] = useState<{ reward: RewardInfo; boardId: string } | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [openError, setOpenError] = useState('');

  const openReward = async (r: CollectedReward) => {
    feedbackTap();
    setOpenError('');
    if (r.revealedAt && (r.content || r.imageUrl)) {
      setOpened({ reward: r, boardId: r.board.id });
      return;
    }
    setOpening(r.id);
    try {
      const data = await api<{ reward: RewardInfo }>(
        `/api/boards/${r.board.id}/rewards/${r.id}/reveal`,
        { method: 'POST' },
      );
      setOpened({ reward: data.reward, boardId: r.board.id });
      mutate((prev) =>
        prev && { ...prev, rewards: prev.rewards.map((x) => (x.id === r.id ? { ...x, ...data.reward } : x)) });
      // 알림함 캐시 무효화 — 보상 열람(reveal)이 통합 피드/배지에 반영 안 되던 결함
      // (messages/page.tsx와 동일 순서: invalidate를 refreshUnreadCount보다 먼저 호출).
      invalidateCachedApi('/api/notifications');
      refreshUnreadCount({ force: true });
    } catch {
      // /api/rewards가 본문을 동봉하므로(마스킹 정렬) 내용이 있으면 그대로 연다 —
      // reveal(열람 기록)만 다음 탭으로 미뤄진다. imageUrl 전용 보상(내용 없는
      // 기프티콘 이미지)도 열 수 있게 양쪽을 본다(보드 페이지 openReward와 동일
      // 기준). 둘 다 없으면 빈 편지 대신 실패를 말한다.
      if (r.content || r.imageUrl) {
        setOpened({ reward: r, boardId: r.board.id });
      } else {
        feedbackError();
        setOpenError('보상을 여는 데 실패했어요. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      setOpening(null);
    }
  };

  const filtered = filter === 'all' ? rewards : rewards.filter((r) => r.type === filter);

  return (
    <div>
      {/* 타입 필터 */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(['all', 'letter', 'giftcard', 'wish'] as const).map((f) => {
          const isActive = filter === f;
          const label = f === 'all' ? '전체' : REWARD_TYPE_LABELS[f];
          return (
            <button
              key={f}
              onClick={() => { feedbackTap(); setFilter(f); }}
              aria-pressed={isActive}
              className={`px-3.5 py-2 rounded-2xl text-sm font-medium transition-[background-color,box-shadow,color] inline-flex items-center gap-1.5 ${
                isActive ? 'clay-pressed text-grape-700' : 'clay-button text-warm-sub'
              }`}
            >
              {f !== 'all' && <EmojiIcon emoji={REWARD_TYPE_ICON[f]} size={14} />}
              {label}
            </button>
          );
        })}
      </div>

      {openError && <p role="alert" className="text-rose-700 text-xs text-center mb-3">{openError}</p>}

      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-28 w-full" />)}
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="font-display text-base text-warm-text mb-1.5">불러오지 못했어요</p>
          <p className="text-sm text-warm-sub mb-5">잠시 후 다시 시도해주세요</p>
          <RetryButton onRetry={refresh} />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          fallbackEmoji="🍇"
          artSize={80}
          title={filter === 'all' ? '아직 받은 보상이 없어요' : '이 종류의 보상이 없어요'}
          description="포도판을 채워 보상을 모아보세요!"
        />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((r) => {
            const isMid = r.triggerAt < r.board.totalStickers;
            const isOpened = !!r.revealedAt;
            return (
              <button
                key={r.id}
                onClick={() => openReward(r)}
                disabled={opening === r.id}
                className="clay p-4 text-left transition-[transform,opacity] active:scale-[0.97] disabled:opacity-60"
              >
                <div className="flex items-center justify-between mb-2">
                  <EmojiIcon emoji={REWARD_TYPE_ICON[r.type]} size={28} />
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${isMid ? 'bg-grape-100 text-grape-600' : 'bg-sunshine-100 text-sunshine-700'}`}>
                    {isMid ? '중간 보상' : '완성 보상'}
                  </span>
                </div>
                <p className="font-semibold text-sm text-grape-700 mb-0.5 truncate">{r.title}</p>
                <p className="text-xs text-warm-sub truncate">{stripTitleEmoji(r.board.title)}</p>
                {!isOpened && (
                  <p className="text-[11px] text-grape-500 mt-2 inline-flex items-center gap-1">
                    <EmojiIcon emoji="🔒" size={11} /> 열어보기
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}

      {opened && (
        <RewardRevealModal reward={opened.reward} boardId={opened.boardId} onClose={() => setOpened(null)} />
      )}
    </div>
  );
}
