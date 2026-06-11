import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  heatColor,
  formatKoreanDate,
  formatWeekLabel,
  dayShortName,
  buildWeeklyRecapData,
} from '../weeklyRecap';
import type { EnhancedStats } from '@/types';

test('heatColor: Heatmap.tsx 레벨 매핑과 동일한 경계(0/1/≤3/≤6/그 외)', () => {
  assert.equal(heatColor(0), 'rgba(236, 224, 243, 0.4)'); // warm-border/40
  assert.equal(heatColor(1), '#DCC4F2'); // grape300
  assert.equal(heatColor(2), '#C9A8E8'); // grape400
  assert.equal(heatColor(3), '#C9A8E8'); // grape400 (경계 포함)
  assert.equal(heatColor(4), '#B28CDC'); // grape500
  assert.equal(heatColor(6), '#B28CDC'); // grape500 (경계 포함)
  assert.equal(heatColor(7), '#7D58A8'); // grape700
  assert.equal(heatColor(100), '#7D58A8');
});

test('formatKoreanDate: YYYY-MM-DD → M월 D일 (선행 0 제거)', () => {
  assert.equal(formatKoreanDate('2026-06-09'), '6월 9일');
  assert.equal(formatKoreanDate('2026-12-31'), '12월 31일');
  assert.equal(formatKoreanDate('2026-01-01'), '1월 1일');
});

test('formatWeekLabel: 첫/마지막 날짜로 주간 레이블, 빈 배열은 빈 문자열', () => {
  const daily = [
    { date: '2026-06-05' },
    { date: '2026-06-06' },
    { date: '2026-06-11' },
  ];
  assert.equal(formatWeekLabel(daily), '6월 5일 ~ 6월 11일');
  assert.equal(formatWeekLabel([]), '');
});

test('dayShortName: 날짜 문자열의 요일 — 타임존 무관(UTC 자정 고정)', () => {
  assert.equal(dayShortName('2026-06-07'), '일');
  assert.equal(dayShortName('2026-06-08'), '월');
  assert.equal(dayShortName('2026-06-13'), '토');
});

function makeStats(overrides: Partial<EnhancedStats> = {}): EnhancedStats {
  return {
    totalBoards: 3,
    completedBoards: 1,
    totalStickers: 40,
    recentStickers: 12,
    messagesSent: 0,
    messagesReceived: 0,
    friendsCount: 2,
    boardsGifted: 0,
    boardsReceived: 0,
    streak: 4,
    dailyStickers: [
      { date: '2026-06-05', count: 0 },
      { date: '2026-06-06', count: 2 },
      { date: '2026-06-07', count: 1 },
      { date: '2026-06-08', count: 4 },
      { date: '2026-06-09', count: 0 },
      { date: '2026-06-10', count: 3 },
      { date: '2026-06-11', count: 2 },
    ],
    heatmap: [],
    longestStreak: 9,
    currentStreak: 4,
    averageDaily: 1.5,
    mostActiveDay: '월',
    completionRate: 33.3,
    monthlyTrend: [],
    categoryBreakdown: [],
    ...overrides,
  };
}

test('buildWeeklyRecapData: dailyStickers 합계·주간 레이블·스트릭 매핑', () => {
  const data = buildWeeklyRecapData(makeStats(), '포도');
  assert.equal(data.userName, '포도');
  assert.equal(data.weekCount, 12); // 0+2+1+4+0+3+2
  assert.equal(data.weekLabel, '6월 5일 ~ 6월 11일');
  assert.equal(data.currentStreak, 4);
  assert.equal(data.mostActiveDay, '월');
  assert.equal(data.averageDaily, 1.5);
  assert.equal(data.daily.length, 7);
  // 순서 보존: stats.dailyStickers의 과거→오늘 순 그대로.
  assert.equal(data.daily[0].date, '2026-06-05');
  assert.equal(data.daily[6].date, '2026-06-11');
});

test('buildWeeklyRecapData: 활동 0인 주도 안전(합계 0)', () => {
  const zero = makeStats({
    dailyStickers: Array.from({ length: 7 }, (_, i) => ({
      date: `2026-06-0${i + 1}`,
      count: 0,
    })),
    currentStreak: 0,
  });
  const data = buildWeeklyRecapData(zero, '포도');
  assert.equal(data.weekCount, 0);
  assert.equal(data.currentStreak, 0);
});
