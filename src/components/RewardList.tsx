'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useCachedApi } from '@/lib/cachedApi';
import EmojiIcon from './EmojiIcon';
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
  const [opened, setOpened] = useState<RewardInfo | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [openError, setOpenError] = useState('');

  const openReward = async (r: CollectedReward) => {
    feedbackTap();
    setOpenError('');
    if (r.revealedAt && r.content) {
      setOpened(r);
      return;
    }
    setOpening(r.id);
    try {
      const data = await api<{ reward: RewardInfo }>(
        `/api/boards/${r.board.id}/rewards/${r.id}/reveal`,
        { method: 'POST' },
      );
      setOpened(data.reward);
      mutate((prev) =>
        prev && { ...prev, rewards: prev.rewards.map((x) => (x.id === r.id ? { ...x, ...data.reward } : x)) });
    } catch {
      // /api/rewards가 본문을 동봉하므로(마스킹 정렬) 내용이 있으면 그대로 연다 —
      // reveal(열람 기록)만 다음 탭으로 미뤄진다. 본문마저 없으면 빈 편지를 여는
      // 대신 실패를 말한다(말 없는 빈 모달은 '보상이 사라졌다'로 읽힘).
      if (r.content) {
        setOpened(r);
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
              className={`px-3.5 py-2 rounded-2xl text-sm font-medium transition-all inline-flex items-center gap-1.5 ${
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
          <button onClick={refresh} className="clay-button px-5 py-2.5 rounded-2xl text-sm font-semibold text-grape-700">다시 불러오기</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <EmojiIcon emoji="🍇" size={40} className="block mx-auto mb-3" />
          <p className="text-warm-sub">{filter === 'all' ? '아직 받은 보상이 없어요' : '이 종류의 보상이 없어요'}</p>
          <p className="text-xs text-warm-sub mt-1 text-balance">포도판을 채워 보상을 모아보세요!</p>
        </div>
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
                className="clay p-4 text-left transition-all active:scale-[0.97] disabled:opacity-60"
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

      {opened && <RewardRevealModal reward={opened} onClose={() => setOpened(null)} />}
    </div>
  );
}
