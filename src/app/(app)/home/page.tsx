'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api';
import BoardCard from '@/components/BoardCard';
import ClayButton from '@/components/ClayButton';
import Avatar from '@/components/Avatar';
import type { BoardSummary } from '@/types';
import { feedbackTap } from '@/lib/feedback';

export default function HomePage() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  useEffect(() => {
    api<{ boards: BoardSummary[] }>('/api/boards')
      .then((data) => setBoards(data.boards))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/me', { method: 'POST' });
    useAppStore.getState().setUser(null);
    router.replace('/');
  };

  const filteredBoards = boards.filter((b) => {
    if (filter === 'active') return !b.isCompleted;
    if (filter === 'completed') return b.isCompleted;
    return true;
  });

  const activeCount = boards.filter((b) => !b.isCompleted).length;
  const completedCount = boards.filter((b) => b.isCompleted).length;

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Avatar avatar={user?.avatar || 'grape'} size="lg" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-grape-700">
              {user?.name}님
            </h1>
            <p className="text-xs leading-normal tracking-wide text-warm-sub">오늘도 화이팅! 🍇</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="clay-button px-3 py-2 rounded-xl text-xs text-warm-sub"
        >
          로그아웃
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="clay-sm p-4 text-center">
          <p className="text-2xl font-bold text-grape-600">{boards.length}</p>
          <p className="text-xs leading-normal tracking-wide text-warm-sub mt-0.5">전체</p>
        </div>
        <div className="clay-sm p-4 text-center">
          <p className="text-2xl font-bold text-orange-500">{activeCount}</p>
          <p className="text-xs leading-normal tracking-wide text-warm-sub mt-0.5">진행중</p>
        </div>
        <div className="clay-sm p-4 text-center">
          <p className="text-2xl font-bold text-green-500">{completedCount}</p>
          <p className="text-xs leading-normal tracking-wide text-warm-sub mt-0.5">완료</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {(['all', 'active', 'completed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => { feedbackTap(); setFilter(f); }}
            className={`
              px-4 py-2 rounded-xl text-sm font-medium transition-all
              ${filter === f
                ? 'clay-pressed text-grape-600'
                : 'clay-button text-warm-sub'
              }
            `}
          >
            {f === 'all' ? '전체' : f === 'active' ? '진행중' : '완료'}
          </button>
        ))}
      </div>

      {/* Board list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-32 w-full" />
          ))}
        </div>
      ) : filteredBoards.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🍇</div>
          <p className="text-sm leading-relaxed text-warm-sub mb-1">
            {filter === 'all' ? '아직 포도판이 없어요' : filter === 'active' ? '진행중인 포도판이 없어요' : '완료한 포도판이 없어요'}
          </p>
          {filter === 'all' && (
            <>
              <p className="text-sm leading-relaxed text-warm-light mb-5">첫 번째 포도판을 만들어 보세요!</p>
              <ClayButton onClick={() => router.push('/board/create')}>
                🍇 포도판 만들기
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
          className="fixed bottom-24 right-6 w-14 h-14 rounded-full flex items-center justify-center text-2xl bg-grape-500 text-white shadow-lg shadow-grape-500/25 active:scale-95 transition-all hover:bg-grape-600 z-40 safe-bottom"
        >
          +
        </button>
      )}
    </div>
  );
}
