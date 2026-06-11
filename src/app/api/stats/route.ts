import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';
import { TEMPLATE_CATEGORIES } from '@/lib/templates';
import { KST_OFFSET_MS, kstDateKey, kstTodayKey, computeStreaks, canFreeze } from '@/lib/streak';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

// KST timezone (Asia/Seoul, UTC+9, no DST). Stats are presented to a Korean
// audience, so all date-key grouping happens in KST instead of UTC to avoid
// off-by-day bugs (a sticker filled at 23:30 KST should land on that calendar
// day, not the next one). Date-key helpers live in src/lib/streak.ts so the
// freeze route + unit tests share the exact same logic.

function kstStartOfTodayUtc(): Date {
  // Returns the UTC instant corresponding to 00:00 KST today.
  const nowKstMs = Date.now() + KST_OFFSET_MS;
  const startKstMs = Math.floor(nowKstMs / 86_400_000) * 86_400_000;
  return new Date(startKstMs - KST_OFFSET_MS);
}

function kstDayBucket(d: Date): number {
  // 0=Sun..6=Sat per KST.
  const shifted = new Date(d.getTime() + KST_OFFSET_MS);
  return shifted.getUTCDay();
}

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  // Counters — single round-trips, no big lists.
  const [
    totalBoards,
    completedBoards,
    totalStickers,
    messagesSent,
    messagesReceived,
    friendsCount,
    boardsGifted,
    boardsReceived,
    // 스트릭 유예(freeze) 상태 — streak 계산과 freezeAvailable/freezeSuggestion에 쓴다.
    freezeUser,
  ] = await Promise.all([
    prisma.board.count({ where: { ownerId: userId } }),
    prisma.board.count({ where: { ownerId: userId, isCompleted: true } }),
    prisma.sticker.count({ where: { filledBy: userId } }),
    prisma.message.count({ where: { senderId: userId } }),
    prisma.message.count({ where: { receiverId: userId } }),
    prisma.friendship.count({
      where: {
        status: 'accepted',
        OR: [{ requesterId: userId }, { receiverId: userId }],
      },
    }),
    prisma.board.count({ where: { giftedFromId: userId } }),
    prisma.board.count({ where: { giftedToId: userId } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { streakFreezeDate: true, streakFreezeUsedAt: true },
    }),
  ]);

  // Pull every sticker's filledAt once and bucket in-memory. This is one query
  // instead of the previous 365+ count() round-trips, and the JS bucket loop is
  // O(n) over the user's sticker history.
  const allStickers = await prisma.sticker.findMany({
    where: { filledBy: userId },
    select: { filledAt: true },
    orderBy: { filledAt: 'asc' },
  });

  // Bucket every fill into a KST date key.
  const countByDate = new Map<string, number>();
  const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0];
  for (const s of allStickers) {
    const k = kstDateKey(s.filledAt);
    countByDate.set(k, (countByDate.get(k) || 0) + 1);
    dayOfWeekCounts[kstDayBucket(s.filledAt)]++;
  }

  // Build last-7-days series (KST).
  const dailyStickers: { date: string; count: number }[] = [];
  const todayKstStart = kstStartOfTodayUtc();
  for (let i = 6; i >= 0; i--) {
    const dayUtc = new Date(todayKstStart.getTime() - i * 86_400_000);
    const k = kstDateKey(new Date(dayUtc.getTime() + 1)); // +1ms to land safely inside the day
    dailyStickers.push({ date: k, count: countByDate.get(k) || 0 });
  }
  const recentStickers = dailyStickers.reduce((sum, d) => sum + d.count, 0);

  // Heatmap: last 90 KST days.
  const heatmap: { date: string; count: number }[] = [];
  for (let i = 89; i >= 0; i--) {
    const dayUtc = new Date(todayKstStart.getTime() - i * 86_400_000);
    const k = kstDateKey(new Date(dayUtc.getTime() + 1));
    heatmap.push({ date: k, count: countByDate.get(k) || 0 });
  }

  // Streaks from KST-bucketed date set — src/lib/streak.ts 공유 로직 사용.
  // 유예(freeze)로 메꾼 날짜는 채워진 날로 간주해 스트릭이 이어진다.
  // (heatmap/dailyStickers에는 넣지 않는다 — 실제 채운 알이 아니므로.)
  const todayKey = kstTodayKey();
  const streakDates = new Set(countByDate.keys());
  if (freezeUser?.streakFreezeDate) streakDates.add(freezeUser.streakFreezeDate);
  const { currentStreak, longestStreak } = computeStreaks(streakDates, todayKey);
  // `streak` (legacy alias) kept for backwards compat with existing clients.
  const streak = currentStreak;

  // 유예 보유 여부 + "어제만 메꾸면 이어붙는" 제안 상태(서버 단일 판정 — 클라 재계산 금지).
  const freezeAvailable = !freezeUser?.streakFreezeUsedAt;
  const freezeSuggestion = canFreeze(
    streakDates,
    freezeUser?.streakFreezeUsedAt ?? null,
    todayKey,
  ).eligible;

  // 30-day average.
  const thirtyDaysAgoUtc = new Date(todayKstStart.getTime() - 30 * 86_400_000);
  const last30Count = allStickers.filter((s) => s.filledAt >= thirtyDaysAgoUtc).length;
  const averageDaily = Math.round((last30Count / 30) * 10) / 10;

  const maxDayIndex = dayOfWeekCounts.indexOf(Math.max(...dayOfWeekCounts));
  const mostActiveDay = DAY_NAMES[maxDayIndex];

  const completionRate = totalBoards > 0
    ? Math.round((completedBoards / totalBoards) * 1000) / 10
    : 0;

  // Monthly trend (last 6 months, KST month boundaries).
  const monthlyTrend: { month: string; count: number }[] = [];
  const nowKst = new Date(Date.now() + KST_OFFSET_MS);
  const nowKstYear = nowKst.getUTCFullYear();
  const nowKstMonth = nowKst.getUTCMonth();
  for (let i = 5; i >= 0; i--) {
    const targetMonth = nowKstMonth - i;
    const year = nowKstYear + Math.floor(targetMonth / 12);
    const month = ((targetMonth % 12) + 12) % 12;
    const monthStart = Date.UTC(year, month, 1) - KST_OFFSET_MS;
    const monthEnd = Date.UTC(year, month + 1, 1) - KST_OFFSET_MS;
    const count = allStickers.filter(
      (s) => s.filledAt.getTime() >= monthStart && s.filledAt.getTime() < monthEnd,
    ).length;
    monthlyTrend.push({
      month: `${year}-${String(month + 1).padStart(2, '0')}`,
      count,
    });
  }

  // Category breakdown by board templateId prefix.
  const boardsWithStickers = await prisma.board.findMany({
    where: { ownerId: userId },
    select: {
      templateId: true,
      _count: { select: { stickers: true } },
    },
  });

  const categoryMap = new Map<string, number>();
  const categoryNameMap = new Map<string, string>();
  for (const cat of TEMPLATE_CATEGORIES) categoryNameMap.set(cat.id, cat.name);

  for (const board of boardsWithStickers) {
    let categoryKey = '기타';
    if (board.templateId) {
      const prefix = board.templateId.split('-')[0];
      if (categoryNameMap.has(prefix)) categoryKey = categoryNameMap.get(prefix)!;
    }
    categoryMap.set(categoryKey, (categoryMap.get(categoryKey) || 0) + board._count.stickers);
  }

  const categoryBreakdown = Array.from(categoryMap.entries())
    .map(([category, count]) => ({ category, count }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  return Response.json({
    stats: {
      totalBoards,
      completedBoards,
      totalStickers,
      recentStickers,
      messagesSent,
      messagesReceived,
      friendsCount,
      boardsGifted,
      boardsReceived,
      streak,
      dailyStickers,
      heatmap,
      longestStreak,
      currentStreak,
      freezeAvailable,
      freezeSuggestion,
      averageDaily,
      mostActiveDay,
      completionRate,
      monthlyTrend,
      categoryBreakdown,
    },
  });
}
