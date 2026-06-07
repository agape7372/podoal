'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api';
import BoardCard from '@/components/BoardCard';
import ClayButton from '@/components/ClayButton';
import Avatar from '@/components/Avatar';
import Podo from '@/components/mascot/Podo';
import Sparkle from '@/components/illustrations/Sparkle';
import VineLeaf from '@/components/illustrations/VineLeaf';
import type { BoardSummary } from '@/types';
import { feedbackTap } from '@/lib/feedback';

function timeOfDayGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return '편안한 밤 보내세요';
  if (h < 11) return '좋은 아침이에요';
  if (h < 14) return '점심은 드셨어요?';
  if (h < 18) return '오후도 화이팅이에요';
  if (h < 22) return '오늘 하루도 수고했어요';
  return '잘 자기 전 한 알 어때요';
}

export default function HomePage() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const greeting = useMemo(timeOfDayGreeting, []);

  const loadBoards = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    api<{ boards: BoardSummary[] }>('/api/boards')
      .then((data) => setBoards(data.boards))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadBoards(); }, [loadBoards]);

  const filteredBoards = boards.filter((b) => {
    if (filter === 'active') return !b.isCompleted;
    if (filter === 'completed') return b.isCompleted;
    return true;
  });

  const activeCount = boards.filter((b) => !b.isCompleted).length;
  const completedCount = boards.filter((b) => b.isCompleted).length;

  return (
    <div className="pb-4">
      {/* Header — tap the avatar to open the profile sheet */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => { feedbackTap(); router.push('/profile'); }}
          aria-label="내 프로필"
          className="rounded-full shrink-0 active:scale-95 transition-transform"
        >
          <Avatar avatar={user?.avatar || 'grape'} size="lg" />
        </button>
        <div className="min-w-0">
          <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight text-warm-text truncate">
            {user?.name}<span className="text-warm-sub font-normal text-[20px]">님</span>
          </h1>
          <p className="text-xs leading-normal tracking-wide text-warm-sub mt-0.5">
            {greeting}
          </p>
        </div>
      </div>

      {/* Filter tabs — 카운트 통합(전체/진행중/완료 + 숫자) */}
      <div className="flex gap-2 mb-4">
        {(['all', 'active', 'completed'] as const).map((f) => {
          const isActive = filter === f;
          const icon = f === 'all' ? null : f === 'active' ? <VineLeaf size={14} /> : <Sparkle size={14} color="#FFC845" />;
          const label = f === 'all' ? '전체' : f === 'active' ? '진행중' : '완료';
          const count = f === 'all' ? boards.length : f === 'active' ? activeCount : completedCount;
          return (
            <button
              key={f}
              onClick={() => { feedbackTap(); setFilter(f); }}
              aria-pressed={isActive}
              className={`
                px-3.5 py-2 rounded-2xl text-sm font-medium transition-all inline-flex items-center gap-1.5
                ${isActive
                  ? 'clay-pressed text-grape-700'
                  : 'clay-button text-warm-sub'
                }
              `}
            >
              {icon}
              {label}
              <span className={`font-display font-bold leading-none ${isActive ? 'text-grape-700' : 'text-warm-text'}`}>
                {loading ? <span className="inline-block w-3 h-3 rounded-full bg-warm-border/50 animate-pulse" /> : count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Board list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-32 w-full" />
          ))}
        </div>
      ) : loadError ? (
        <div className="text-center py-12">
          <p className="font-display text-base text-warm-text mb-1.5">포도판을 불러오지 못했어요</p>
          <p className="text-sm text-warm-sub mb-5">잠시 후 다시 시도해주세요</p>
          <ClayButton variant="secondary" onClick={loadBoards}>다시 불러오기</ClayButton>
        </div>
      ) : filteredBoards.length === 0 ? (
        <div className="text-center py-12">
          <div className="mb-5 flex justify-center">
            <Podo size={96} />
          </div>
          <p className="font-display text-base text-warm-text mb-1.5">
            {filter === 'all' ? '아직 포도판이 없어요' : filter === 'active' ? '진행중인 포도판이 없어요' : '완료한 포도판이 없어요'}
          </p>
          {filter === 'all' && (
            <>
              <p className="text-sm text-warm-sub mb-5">한 알씩 채워볼 첫 판을 만들어 보세요</p>
              <ClayButton variant="joyful" onClick={() => router.push('/board/create')}>
                포도판 만들기
              </ClayButton>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBoards.map((board) => (
            <BoardCard key={board.id} board={board} />
          ))}
        </div>
      )}

      {/* FAB */}
      {boards.length > 0 && (
        <button
          onClick={() => { feedbackTap(); router.push('/board/create'); }}
          className="fixed bottom-28 right-6 w-14 h-14 rounded-full flex items-center justify-center text-3xl text-white bg-grape-600 border-[1.3px] border-warm-border active:translate-x-[1.5px] active:translate-y-[2px] transition-all z-40 safe-bottom"
          style={{ boxShadow: '2px 3px 0 rgba(73, 50, 100, 0.12)' }}
          aria-label="새 포도판 만들기"
        >
          +
        </button>
      )}
    </div>
  );
}
