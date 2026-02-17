'use client';

import { useEffect, useState, useMemo } from 'react';
import { api } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import Avatar from '@/components/Avatar';
import Heatmap from '@/components/Heatmap';
import type { EnhancedStats } from '@/types';
import { feedbackTap } from '@/lib/feedback';

type Tab = 'summary' | 'heatmap' | 'analysis';

export default function StatsPage() {
  const user = useAppStore((s) => s.user);
  const [stats, setStats] = useState<EnhancedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('summary');

  useEffect(() => {
    api<{ stats: EnhancedStats }>('/api/stats')
      .then((data) => setStats(data.stats))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const maxDaily = stats ? Math.max(...stats.dailyStickers.map((d) => d.count), 1) : 1;

  const getDayName = (dateStr: string) => {
    const d = new Date(dateStr);
    return ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  };

  // Day-of-week breakdown calculated client-side from heatmap data
  const dayOfWeekData = useMemo(() => {
    if (!stats) return [];
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (const d of stats.heatmap) {
      const date = new Date(d.date);
      counts[date.getDay()] += d.count;
    }
    // Reorder to start from Monday
    const ordered = [
      { day: '월', count: counts[1] },
      { day: '화', count: counts[2] },
      { day: '수', count: counts[3] },
      { day: '목', count: counts[4] },
      { day: '금', count: counts[5] },
      { day: '토', count: counts[6] },
      { day: '일', count: counts[0] },
    ];
    return ordered;
  }, [stats]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'summary', label: '📊 요약' },
    { key: 'heatmap', label: '🔥 히트맵' },
    { key: 'analysis', label: '📈 분석' },
  ];

  if (loading) {
    return (
      <div className="pb-4">
        <h1 className="text-2xl font-bold text-grape-700 mb-6">통계</h1>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-24 w-full" />)}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="pb-4">
      <h1 className="text-2xl font-bold text-grape-700 mb-4">통계</h1>

      {/* Tab navigation */}
      <div className="flex gap-1 mb-5 p-1 clay-sm bg-gray-50 rounded-xl">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { feedbackTap(); setActiveTab(tab.key); }}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'clay-button bg-white text-grape-700 shadow-sm'
                : 'text-warm-sub hover:text-warm-text'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Summary Tab */}
      {activeTab === 'summary' && (
        <>
          {/* Profile & Streak */}
          <div className="clay-float p-6 mb-5 bg-grape-50/80 text-center">
            <Avatar avatar={user?.avatar || 'grape'} size="xl" className="mx-auto mb-3" />
            <h2 className="text-lg font-bold text-grape-700">{user?.name}</h2>
            <div className="mt-4 flex items-center justify-center gap-2">
              <span className="text-3xl">{'🔥'}</span>
              <div>
                <p className="text-3xl font-extrabold text-grape-600">{stats.streak}</p>
                <p className="text-xs text-warm-sub">연속 달성일</p>
              </div>
            </div>
          </div>

          {/* Weekly chart */}
          <div className="clay p-5 mb-5">
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
            <StatCard icon={'🍇'} label="채운 포도알" value={stats.totalStickers} color="lavender" />
            <StatCard icon={'📋'} label="포도판" value={stats.totalBoards} color="peach" />
            <StatCard icon={'✅'} label="완료" value={stats.completedBoards} color="mint" />
            <StatCard icon={'👥'} label="친구" value={stats.friendsCount} color="pink" />
            <StatCard icon={'🎁'} label="선물 보냄" value={stats.boardsGifted} color="yellow" />
            <StatCard icon={'📨'} label="선물 받음" value={stats.boardsReceived} color="cream" />
            <StatCard icon={'💌'} label="보낸 응원" value={stats.messagesSent} color="lavender" />
            <StatCard icon={'❤️'} label="받은 응원" value={stats.messagesReceived} color="pink" />
          </div>
        </>
      )}

      {/* Heatmap Tab */}
      {activeTab === 'heatmap' && (
        <>
          {/* Heatmap */}
          <div className="clay p-5 mb-5">
            <h3 className="text-sm font-semibold text-warm-text mb-4">활동 히트맵 (90일)</h3>
            <Heatmap data={stats.heatmap} />
          </div>

          {/* Streak section */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="clay-sm p-5 text-center bg-orange-50/60">
              <span className="text-3xl">{'🔥'}</span>
              <p className="text-2xl font-bold text-grape-600 mt-2">{stats.currentStreak}일</p>
              <p className="text-[10px] text-warm-sub mt-1">현재 연속 달성</p>
            </div>
            <div className="clay-sm p-5 text-center bg-amber-50/60">
              <span className="text-3xl">{'🏆'}</span>
              <p className="text-2xl font-bold text-grape-600 mt-2">{stats.longestStreak}일</p>
              <p className="text-[10px] text-warm-sub mt-1">최장 연속 달성</p>
            </div>
          </div>

          {/* Average daily */}
          <div className="clay-sm p-5 mb-5 bg-emerald-50/60 text-center">
            <span className="text-3xl">{'📊'}</span>
            <p className="text-2xl font-bold text-grape-600 mt-2">{stats.averageDaily}</p>
            <p className="text-[10px] text-warm-sub mt-1">일평균 포도알 (최근 30일)</p>
          </div>
        </>
      )}

      {/* Analysis Tab */}
      {activeTab === 'analysis' && (
        <>
          {/* Day of week activity */}
          <div className="clay p-5 mb-5">
            <h3 className="text-sm font-semibold text-warm-text mb-4">요일별 활동</h3>
            <DayOfWeekChart data={dayOfWeekData} />
            <p className="text-xs text-warm-light text-center mt-3">
              가장 활발한 요일: <span className="font-semibold text-grape-600">{stats.mostActiveDay}요일</span>
            </p>
          </div>

          {/* Completion rate */}
          <div className="clay p-5 mb-5 text-center">
            <h3 className="text-sm font-semibold text-warm-text mb-4">완료율</h3>
            <CircularProgress value={stats.completionRate} />
            <p className="text-xs text-warm-sub mt-3">
              {stats.completedBoards}/{stats.totalBoards} 포도판 완료
            </p>
          </div>

          {/* Monthly trend */}
          <div className="clay p-5 mb-5">
            <h3 className="text-sm font-semibold text-warm-text mb-4">월별 추이</h3>
            <MonthlyChart data={stats.monthlyTrend} />
          </div>

          {/* Category breakdown */}
          <div className="clay p-5 mb-5">
            <h3 className="text-sm font-semibold text-warm-text mb-4">카테고리 분포</h3>
            <CategoryBreakdown data={stats.categoryBreakdown} />
          </div>
        </>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  const bgMap: Record<string, string> = {
    lavender: 'bg-grape-50/60',
    peach: 'bg-orange-50/60',
    mint: 'bg-emerald-50/60',
    pink: 'bg-pink-50/60',
    yellow: 'bg-amber-50/60',
    cream: 'bg-amber-50/60',
  };

  return (
    <div className={`clay-sm p-4 text-center ${bgMap[color] || bgMap.lavender}`}>
      <span className="text-2xl">{icon}</span>
      <p className="text-2xl font-bold text-grape-600 mt-1">{value}</p>
      <p className="text-[10px] text-warm-sub mt-0.5">{label}</p>
    </div>
  );
}

function DayOfWeekChart({ data }: { data: { day: string; count: number }[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.day} className="flex items-center gap-2">
          <span className="text-xs text-warm-sub w-5 text-right flex-shrink-0">{d.day}</span>
          <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-grape-300 to-grape-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.max((d.count / maxCount) * 100, d.count > 0 ? 8 : 0)}%` }}
            />
          </div>
          <span className="text-xs text-warm-sub w-7 text-right flex-shrink-0">{d.count}</span>
        </div>
      ))}
    </div>
  );
}

function CircularProgress({ value }: { value: number }) {
  const radius = 50;
  const stroke = 10;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="flex justify-center">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${radius * 2} ${radius * 2}`}>
          {/* Background circle */}
          <circle
            cx={radius}
            cy={radius}
            r={normalizedRadius}
            fill="transparent"
            stroke="#f3f4f6"
            strokeWidth={stroke}
          />
          {/* Progress circle */}
          <circle
            cx={radius}
            cy={radius}
            r={normalizedRadius}
            fill="transparent"
            stroke="url(#grapeGradient)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-700"
          />
          <defs>
            <linearGradient id="grapeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#c084fc" />
              <stop offset="100%" stopColor="#7c3aed" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-grape-600">{value}%</span>
        </div>
      </div>
    </div>
  );
}

function MonthlyChart({ data }: { data: { month: string; count: number }[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  const formatMonth = (monthStr: string) => {
    const parts = monthStr.split('-');
    return `${parseInt(parts[1])}월`;
  };

  return (
    <div className="flex items-end justify-between gap-2 h-32">
      {data.map((d) => (
        <div key={d.month} className="flex flex-col items-center gap-1 flex-1">
          <span className="text-[10px] text-warm-sub">{d.count}</span>
          <div
            className="w-full rounded-t-lg bg-gradient-to-t from-grape-500 to-grape-300 transition-all duration-500"
            style={{
              height: `${Math.max((d.count / maxCount) * 96, 4)}px`,
              minHeight: '4px',
            }}
          />
          <span className="text-[10px] text-warm-sub">{formatMonth(d.month)}</span>
        </div>
      ))}
    </div>
  );
}

function CategoryBreakdown({ data }: { data: { category: string; count: number }[] }) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-warm-light text-center py-4">
        아직 카테고리 데이터가 없어요
      </p>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  const categoryIcons: Record<string, string> = {
    '건강': '💪',
    '자기계발': '📚',
    '생활습관': '🏠',
    '직장/학업': '💼',
    '관계': '💝',
    '취미': '🎨',
    '마음건강': '🧘',
    '기타': '🍇',
  };

  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.category}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-warm-text">
              {categoryIcons[d.category] || '🍇'} {d.category}
            </span>
            <span className="text-xs text-warm-sub">{d.count}개</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-grape-300 to-grape-500 rounded-full transition-all duration-500"
              style={{ width: `${(d.count / maxCount) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
