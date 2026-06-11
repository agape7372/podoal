'use client';

import { useEffect, useState, useMemo } from 'react';
import { api } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import Avatar from '@/components/Avatar';
import Heatmap from '@/components/Heatmap';
import EmojiIcon from '@/components/EmojiIcon';
import ClayButton from '@/components/ClayButton';
import WeeklyRecapModal from '@/components/WeeklyRecapModal';
import type { EnhancedStats } from '@/types';
import { feedbackTap } from '@/lib/feedback';

type Tab = 'summary' | 'heatmap' | 'analysis';

export default function StatsPage() {
  const user = useAppStore((s) => s.user);
  const [stats, setStats] = useState<EnhancedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [showRecap, setShowRecap] = useState(false);

  const loadStats = () => {
    setLoading(true);
    setLoadError(false);
    api<{ stats: EnhancedStats }>('/api/stats')
      .then((data) => setStats(data.stats))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadStats();
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

  const tabs: { key: Tab; icon: string; label: string }[] = [
    { key: 'summary', icon: '📊', label: '요약' },
    { key: 'heatmap', icon: '🔥', label: '히트맵' },
    { key: 'analysis', icon: '📈', label: '분석' },
  ];

  if (loading) {
    return (
      <div className="pb-4">
        <h1 className="font-display text-2xl font-bold text-grape-700 mb-6">통계</h1>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-24 w-full" />)}
        </div>
      </div>
    );
  }

  if (loadError || !stats) {
    return (
      <div className="pb-4">
        <h1 className="font-display text-2xl font-bold text-grape-700 mb-4">통계</h1>
        <div className="text-center py-12">
          <p className="font-display text-base text-warm-text mb-1.5">불러오지 못했어요</p>
          <p className="text-sm text-warm-sub mb-5">잠시 후 다시 시도해주세요</p>
          <button onClick={loadStats} className="clay-button px-5 py-2.5 rounded-2xl text-sm font-semibold text-grape-700">다시 불러오기</button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-4">
      <h1 className="font-display text-2xl font-bold text-grape-700 mb-4">통계</h1>

      {/* Tab navigation */}
      <div role="tablist" className="flex gap-1 mb-5 p-1.5 clay-sm bg-warm-border/30 rounded-xl overflow-hidden">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => { feedbackTap(); setActiveTab(tab.key); }}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'clay-button bg-white text-grape-700 shadow-xs'
                : 'text-warm-sub hover:text-warm-text'
            }`}
          >
            <span className="inline-flex items-center gap-1"><EmojiIcon emoji={tab.icon} size={16} /> {tab.label}</span>
          </button>
        ))}
      </div>

      {/* Summary Tab */}
      {activeTab === 'summary' && (
        <>
          {/* Profile & Streak */}
          <div className="clay-float p-6 mb-5 bg-grape-50/80 text-center">
            <Avatar avatar={user?.avatar || 'grape'} size="xl" className="mx-auto mb-3" />
            <h2 className="font-display text-lg font-bold text-grape-700">{user?.name}</h2>
            <div className="mt-4 flex items-center justify-center gap-2">
              <EmojiIcon emoji="🔥" size={30} />
              <div>
                <p className="text-3xl font-extrabold text-grape-600 tabular-nums">{stats.streak}</p>
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
                  <span className="text-[10px] text-warm-sub tabular-nums">{day.count}</span>
                  <div
                    className="w-full rounded-t-lg bg-linear-to-t from-grape-400 to-grape-300 transition-all duration-500"
                    style={{
                      height: `${Math.max((day.count / maxDaily) * 80, 4)}px`,
                      minHeight: '4px',
                    }}
                  />
                  <span className="text-[10px] text-warm-sub">{getDayName(day.date)}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-warm-sub text-center mt-3">
              이번 주 <span className="tabular-nums">{stats.recentStickers}</span>개의 포도알을 채웠어요!
            </p>
          </div>

          {/* Weekly recap share card */}
          <ClayButton
            variant="secondary"
            fullWidth
            className="mb-5"
            onClick={() => { feedbackTap(); setShowRecap(true); }}
          >
            <EmojiIcon emoji="📤" size={16} className="mr-1" />주간 카드 만들기
          </ClayButton>

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
              <EmojiIcon emoji="🔥" size={30} className="block mx-auto" />
              <p className="font-display text-2xl font-bold text-grape-600 mt-2 tabular-nums">{stats.currentStreak}일</p>
              <p className="text-[10px] text-warm-sub mt-1">현재 연속 달성</p>
            </div>
            <div className="clay-sm p-5 text-center bg-amber-50/60">
              <EmojiIcon emoji="🏆" size={30} className="block mx-auto" />
              <p className="font-display text-2xl font-bold text-grape-600 mt-2 tabular-nums">{stats.longestStreak}일</p>
              <p className="text-[10px] text-warm-sub mt-1">최장 연속 달성</p>
            </div>
          </div>

          {/* Average daily */}
          <div className="clay-sm p-5 mb-5 bg-leaf-100/60 text-center">
            <EmojiIcon emoji="📊" size={30} className="block mx-auto" />
            <p className="font-display text-2xl font-bold text-grape-600 mt-2 tabular-nums">{stats.averageDaily}</p>
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
            <p className="text-xs text-warm-sub text-center mt-3">
              가장 활발한 요일: <span className="font-semibold text-grape-600">{stats.mostActiveDay}요일</span>
            </p>
          </div>

          {/* Completion rate */}
          <div className="clay p-5 mb-5 text-center">
            <h3 className="text-sm font-semibold text-warm-text mb-4">완료율</h3>
            <CircularProgress value={stats.completionRate} />
            <p className="text-xs text-warm-sub mt-3 tabular-nums">
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

      {showRecap && (
        <WeeklyRecapModal
          stats={stats}
          userName={user?.name || '포도알 농부'}
          onClose={() => setShowRecap(false)}
        />
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  const bgMap: Record<string, string> = {
    lavender: 'bg-grape-50/60',
    peach: 'bg-orange-50/60',
    mint: 'bg-leaf-100/60',
    pink: 'bg-pink-50/60',
    yellow: 'bg-amber-50/60',
    cream: 'bg-amber-50/60',
  };

  return (
    <div className={`clay-sm p-4 text-center ${bgMap[color] || bgMap.lavender}`}>
      <EmojiIcon emoji={icon} size={26} className="block mx-auto" />
      <p className="font-display text-2xl font-bold text-grape-600 mt-1 tabular-nums">{value}</p>
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
          <span className="text-xs text-warm-sub w-5 text-right shrink-0">{d.day}</span>
          <div className="flex-1 h-5 bg-warm-border/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-linear-to-r from-grape-300 to-grape-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.max((d.count / maxCount) * 100, d.count > 0 ? 8 : 0)}%` }}
            />
          </div>
          <span className="text-xs text-warm-sub w-7 text-right shrink-0 tabular-nums">{d.count}</span>
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
            className="stroke-warm-border"
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
              {/* stop-color는 presentation attribute라 var()를 못 받음 — style로 @theme 토큰 참조 */}
              <stop offset="0%" style={{ stopColor: 'var(--color-grape-400)' }} />
              <stop offset="100%" style={{ stopColor: 'var(--color-grape-600)' }} />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display text-2xl font-bold text-grape-600 tabular-nums">{value}%</span>
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
          <span className="text-[10px] text-warm-sub tabular-nums">{d.count}</span>
          <div
            className="w-full rounded-t-lg bg-linear-to-t from-grape-500 to-grape-300 transition-all duration-500"
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
      <p className="text-sm text-warm-sub text-center py-4">
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
            <span className="text-xs text-warm-text inline-flex items-center gap-1">
              <EmojiIcon emoji={categoryIcons[d.category] || '🍇'} size={14} /> {d.category}
            </span>
            <span className="text-xs text-warm-sub tabular-nums">{d.count}개</span>
          </div>
          <div className="h-3 bg-warm-border/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-linear-to-r from-grape-300 to-grape-500 rounded-full transition-all duration-500"
              style={{ width: `${(d.count / maxCount) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
