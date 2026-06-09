'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import EmojiIcon from '@/components/EmojiIcon';
import RewardRevealModal from '@/components/RewardRevealModal';
import { stripTitleEmoji } from '@/lib/title';
import { REWARD_TYPE_ICON } from '@/lib/icons';
import { REWARD_TYPE_LABELS } from '@/types';
import type { CollectedReward, RewardType, RewardInfo } from '@/types';
import { feedbackTap } from '@/lib/feedback';

type Filter = 'all' | RewardType;

export default function VineyardPage() {
  const [rewards, setRewards] = useState<CollectedReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [opened, setOpened] = useState<RewardInfo | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    api<{ rewards: CollectedReward[] }>('/api/rewards')
      .then((data) => setRewards(data.rewards))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openReward = async (r: CollectedReward) => {
    feedbackTap();
    if (r.revealedAt && r.content) {
      setOpened(r);
      return;
    }
    // 아직 개봉 전 → 보드 보상 reveal 엔드포인트로 내용을 받아 모달에 표시.
    setOpening(r.id);
    try {
      const data = await api<{ reward: RewardInfo }>(
        `/api/boards/${r.board.id}/rewards/${r.id}/reveal`,
        { method: 'POST' },
      );
      setOpened(data.reward);
      setRewards((prev) => prev.map((x) => (x.id === r.id ? { ...x, ...data.reward } : x)));
    } catch {
      setOpened(r); // 실패해도 가진 정보로 열되 내용은 shimmer
    } finally {
      setOpening(null);
    }
  };

  const filtered = filter === 'all' ? rewards : rewards.filter((r) => r.type === filter);

  return (
    <div className="pb-4">
      <h1 className="font-display text-2xl font-bold text-grape-700 mb-2 inline-flex items-center gap-1.5">
        <EmojiIcon emoji="🍇" size={24} /> 포도밭
      </h1>
      <p className="text-sm text-warm-sub mb-5">지금까지 받은 보상과 중간 보상을 모아봐요</p>

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

      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-28 w-full" />)}
        </div>
      ) : loadError ? (
        <div className="text-center py-12">
          <p className="font-display text-base text-warm-text mb-1.5">불러오지 못했어요</p>
          <p className="text-sm text-warm-sub mb-5">잠시 후 다시 시도해주세요</p>
          <button onClick={load} className="clay-button px-5 py-2.5 rounded-2xl text-sm font-semibold text-grape-700">다시 불러오기</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <EmojiIcon emoji="🍇" size={40} className="block mx-auto mb-3" />
          <p className="text-warm-sub">{filter === 'all' ? '아직 받은 보상이 없어요' : '이 종류의 보상이 없어요'}</p>
          <p className="text-xs text-warm-sub mt-1 [text-wrap:balance]">포도판을 채워 보상을 모아보세요!</p>
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
