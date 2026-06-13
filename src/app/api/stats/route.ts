import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';
import { TEMPLATE_CATEGORIES } from '@/lib/templates';
import { KST_OFFSET_MS, kstDateKey, kstTodayKey, computeStreaks } from '@/lib/streak';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

// KST timezone (Asia/Seoul, UTC+9, no DST). Stats are presented to a Korean
// audience, so all date-key grouping happens in KST instead of UTC to avoid
// off-by-day bugs (a sticker filled at 23:30 KST should land on that calendar
// day, not the next one). Date-key helpers live in src/lib/streak.ts so this
// route + unit tests share the exact same logic.

function kstStartOfTodayUtc(): Date {
  // Returns the UTC instant corresponding to 00:00 KST today.
  const nowKstMs = Date.now() + KST_OFFSET_MS;
  const startKstMs = Math.floor(nowKstMs / 86_400_000) * 86_400_000;
  return new Date(startKstMs - KST_OFFSET_MS);
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
    // 폐지된 유예(freeze) 기능의 레거시 날짜 — 아래 streak 계산에서만 쓴다.
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
      select: { streakFreezeDate: true },
    }),
  ]);

  // 날짜별 집계를 **DB에서** 한다 — 예전엔 사용자의 모든 sticker 행(헤비유저면 1만+)을
  // 메모리로 끌어와 JS로 버킷팅했다(확장성 한계). 고유 날짜 수(최대 ~수백)만 돌려받아
  // 같은 파생값(heatmap·요일·월별·streak·평균)을 전부 계산한다.
  // KST 날짜 키 = (filledAt + 9h)의 달력 날짜 — kstDateKey(JS)와 동치: filledAt는 UTC
  // timestamp(no tz)라 9시간 더한 뒤 to_char가 같은 'YYYY-MM-DD'를 준다.
  // (filledBy, filledAt) 복합 인덱스가 이 GROUP BY를 인덱스만으로 처리한다.
  const dateCounts = await prisma.$queryRaw<{ day: string; cnt: bigint }[]>`
    SELECT to_char("filledAt" + interval '9 hours', 'YYYY-MM-DD') AS day,
           COUNT(*) AS cnt
    FROM "Sticker"
    WHERE "filledBy" = ${userId}
    GROUP BY day
  `;

  // KST 날짜 키 → 카운트. 요일 집계는 날짜 키의 요일에서 직접 유도
  // (키 자정 UTC의 getUTCDay = 그 KST 달력일의 요일, 0=일).
  const countByDate = new Map<string, number>();
  const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0];
  for (const row of dateCounts) {
    const c = Number(row.cnt);
    countByDate.set(row.day, c);
    dayOfWeekCounts[new Date(`${row.day}T00:00:00Z`).getUTCDay()] += c;
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
  const todayKey = kstTodayKey();
  const streakDates = new Set(countByDate.keys());
  // 폐지된 유예(freeze) 기능의 레거시 보존 — 과거에 유예로 메꾼 날짜는 계속 채워진 날로
  // 간주해 스트릭을 이어붙인다. 이 주입을 제거하면 유예를 이미 사용한 계정의 스트릭이
  // 소급 감소하므로 제거 금지. (heatmap/dailyStickers에는 넣지 않는다 — 실제 채운 알이 아니므로.)
  if (freezeUser?.streakFreezeDate) streakDates.add(freezeUser.streakFreezeDate);
  const { currentStreak, longestStreak } = computeStreaks(streakDates, todayKey);
  // `streak` (legacy alias) kept for backwards compat with existing clients.
  const streak = currentStreak;

  // 30-day average — 날짜 키 집계에서 최근 30일 분 합산(KST 경계).
  const cutoffKey = kstDateKey(new Date(todayKstStart.getTime() - 30 * 86_400_000 + 1));
  let last30Count = 0;
  for (const [key, count] of countByDate) {
    if (key >= cutoffKey) last30Count += count;
  }
  const averageDaily = Math.round((last30Count / 30) * 10) / 10;

  const maxDayIndex = dayOfWeekCounts.indexOf(Math.max(...dayOfWeekCounts));
  const mostActiveDay = DAY_NAMES[maxDayIndex];

  const completionRate = totalBoards > 0
    ? Math.round((completedBoards / totalBoards) * 1000) / 10
    : 0;

  // Monthly trend (last 6 months, KST month boundaries) — 날짜 키의 'YYYY-MM'
  // 접두로 월별 합산(키가 이미 KST 달력일이라 월 경계도 KST 기준).
  const monthSums = new Map<string, number>();
  for (const [key, count] of countByDate) {
    const ym = key.slice(0, 7);
    monthSums.set(ym, (monthSums.get(ym) || 0) + count);
  }
  const monthlyTrend: { month: string; count: number }[] = [];
  const nowKst = new Date(Date.now() + KST_OFFSET_MS);
  const nowKstYear = nowKst.getUTCFullYear();
  const nowKstMonth = nowKst.getUTCMonth();
  for (let i = 5; i >= 0; i--) {
    const targetMonth = nowKstMonth - i;
    const year = nowKstYear + Math.floor(targetMonth / 12);
    const month = ((targetMonth % 12) + 12) % 12;
    const ym = `${year}-${String(month + 1).padStart(2, '0')}`;
    monthlyTrend.push({ month: ym, count: monthSums.get(ym) || 0 });
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
      averageDaily,
      mostActiveDay,
      completionRate,
      monthlyTrend,
      categoryBreakdown,
    },
  });
}
