'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import Avatar from '@/components/Avatar';

interface Stats {
  totalBoards: number;
  completedBoards: number;
  totalStickers: number;
  recentStickers: number;
  messagesSent: number;
  messagesReceived: number;
  friendsCount: number;
  boardsGifted: number;
  boardsReceived: number;
  streak: number;
  dailyStickers: { date: string; count: number }[];
}

export default function StatsPage() {
  const user = useAppStore((s) => s.user);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ stats: Stats }>('/api/stats')
      .then((data) => setStats(data.stats))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const maxDaily = stats ? Math.max(...stats.dailyStickers.map((d) => d.count), 1) : 1;

  const getDayName = (dateStr: string) => {
    const d = new Date(dateStr);
    return ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  };

  if (loading) {
    return (
      <div className="pb-4">
        <h1 className="text-2xl font-bold text-grape-700 mb-6">📊 통계</h1>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-24 w-full" />)}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="pb-4">
      <h1 className="text-2xl font-bold text-grape-700 mb-6">📊 통계</h1>

      {/* Profile & Streak */}
      <div className="clay-float p-6 mb-5 bg-gradient-to-br from-clay-lavender/40 to-clay-pink/20 text-center">
        <Avatar avatar={user?.avatar || 'grape'} size="xl" className="mx-auto mb-3" />
        <h2 className="text-lg font-bold text-grape-700">{user?.name}</h2>
        <div className="mt-4 flex items-center justify-center gap-2">
          <span className="text-3xl">🔥</span>
          <div>
            <p className="text-3xl font-extrabold text-grape-600">{stats.streak}</p>
            <p className="text-xs text-warm-sub">연속 달성일</p>
          </div>
        </div>
      </div>

      {/* Weekly chart */}
      <div className="clay p-5 mb-5 bg-gradient-to-br from-white to-clay-cream/30">
        <h3 className="text-sm font-semibold text-warm-text mb-4">이번 주 활동</h3>
        <div className="flex items-end justify-between gap-2 h-28">
          {stats.dailyStickers.map((day) => (
            <div key={day.date} className="flex flex-col items-center gap-1 flex-1">
              <span className="text-[10px] text-warm-sub">{day.count}</span>
              <div
                className="w-full rounded-t-lg bg-gradient-to-t from-grape-400 to-grape-300 transition-all duration-500"
                style={{
                  height: `${Math.max((day.count / maxDaily) * 80, 4)}px`,
                  minHeight: '4px',
                }}
              />
              <span className="text-[10px] text-warm-sub">{getDayName(day.date)}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-warm-light text-center mt-3">
          이번 주 {stats.recentStickers}개의 포도알을 채웠어요!
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <StatCard icon="🍇" label="채운 포도알" value={stats.totalStickers} color="lavender" />
        <StatCard icon="📋" label="포도판" value={stats.totalBoards} color="peach" />
        <StatCard icon="✅" label="완료" value={stats.completedBoards} color="mint" />
        <StatCard icon="👥" label="친구" value={stats.friendsCount} color="pink" />
        <StatCard icon="🎁" label="선물 보냄" value={stats.boardsGifted} color="yellow" />
        <StatCard icon="📨" label="선물 받음" value={stats.boardsReceived} color="cream" />
        <StatCard icon="💌" label="보낸 응원" value={stats.messagesSent} color="lavender" />
        <StatCard icon="❤️" label="받은 응원" value={stats.messagesReceived} color="pink" />
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  const bgMap: Record<string, string> = {
    lavender: 'from-clay-lavender/40 to-white',
    peach: 'from-clay-peach/40 to-white',
    mint: 'from-clay-mint/40 to-white',
    pink: 'from-clay-pink/40 to-white',
    yellow: 'from-clay-yellow/40 to-white',
    cream: 'from-clay-cream/40 to-white',
  };

  return (
    <div className={`clay-sm p-4 text-center bg-gradient-to-br ${bgMap[color] || bgMap.lavender}`}>
      <span className="text-2xl">{icon}</span>
      <p className="text-2xl font-bold text-grape-600 mt-1">{value}</p>
      <p className="text-[10px] text-warm-sub mt-0.5">{label}</p>
    </div>
  );
}
