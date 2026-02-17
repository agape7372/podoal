import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';
import { TEMPLATE_CATEGORIES } from '@/lib/templates';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  // Total boards
  const totalBoards = await prisma.board.count({
    where: { ownerId: userId },
  });

  // Completed boards
  const completedBoards = await prisma.board.count({
    where: { ownerId: userId, isCompleted: true },
  });

  // Total stickers filled
  const totalStickers = await prisma.sticker.count({
    where: { filledBy: userId },
  });

  // Messages sent
  const messagesSent = await prisma.message.count({
    where: { senderId: userId },
  });

  // Messages received
  const messagesReceived = await prisma.message.count({
    where: { receiverId: userId },
  });

  // Friends count
  const friendsCount = await prisma.friendship.count({
    where: {
      status: 'accepted',
      OR: [{ requesterId: userId }, { receiverId: userId }],
    },
  });

  // Boards gifted
  const boardsGifted = await prisma.board.count({
    where: { giftedFromId: userId },
  });

  // Boards received as gift
  const boardsReceived = await prisma.board.count({
    where: { giftedToId: userId },
  });

  // Recent activity (last 7 days stickers)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const recentStickers = await prisma.sticker.count({
    where: {
      filledBy: userId,
      filledAt: { gte: weekAgo },
    },
  });

  // Daily sticker counts for last 7 days
  const dailyStickers = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date();
    dayStart.setDate(dayStart.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const count = await prisma.sticker.count({
      where: {
        filledBy: userId,
        filledAt: { gte: dayStart, lt: dayEnd },
      },
    });

    dailyStickers.push({
      date: dayStart.toISOString().split('T')[0],
      count,
    });
  }

  // Streak calculation (consecutive days with at least 1 sticker)
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < 365; i++) {
    const dayStart = new Date(today);
    dayStart.setDate(dayStart.getDate() - i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const count = await prisma.sticker.count({
      where: {
        filledBy: userId,
        filledAt: { gte: dayStart, lt: dayEnd },
      },
    });

    if (count > 0) {
      streak++;
    } else {
      break;
    }
  }

  // ─── Enhanced Stats ────────────────────────────────────

  // Heatmap: Last 90 days of daily sticker counts
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 89);
  ninetyDaysAgo.setHours(0, 0, 0, 0);

  const heatmapStickers = await prisma.sticker.findMany({
    where: {
      filledBy: userId,
      filledAt: { gte: ninetyDaysAgo },
    },
    select: { filledAt: true },
  });

  // Group stickers by date for heatmap
  const heatmapMap = new Map<string, number>();
  for (const s of heatmapStickers) {
    const dateStr = s.filledAt.toISOString().split('T')[0];
    heatmapMap.set(dateStr, (heatmapMap.get(dateStr) || 0) + 1);
  }

  const heatmap: { date: string; count: number }[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const dateStr = d.toISOString().split('T')[0];
    heatmap.push({ date: dateStr, count: heatmapMap.get(dateStr) || 0 });
  }

  // Streak calculations from all sticker dates
  const allStickers = await prisma.sticker.findMany({
    where: { filledBy: userId },
    select: { filledAt: true },
    orderBy: { filledAt: 'asc' },
  });

  // Get all distinct dates
  const allDatesSet = new Set<string>();
  for (const s of allStickers) {
    allDatesSet.add(s.filledAt.toISOString().split('T')[0]);
  }
  const allDatesSorted = Array.from(allDatesSet).sort();

  // Calculate longest streak
  let longestStreak = 0;
  let tempStreak = 0;
  for (let i = 0; i < allDatesSorted.length; i++) {
    if (i === 0) {
      tempStreak = 1;
    } else {
      const prevDate = new Date(allDatesSorted[i - 1]);
      const currDate = new Date(allDatesSorted[i]);
      const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        tempStreak++;
      } else {
        tempStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);
  }

  // Current streak (including today, counting backwards)
  let currentStreak = 0;
  const todayStr = new Date().toISOString().split('T')[0];
  const todayDate = new Date(todayStr);

  for (let i = 0; ; i++) {
    const checkDate = new Date(todayDate);
    checkDate.setDate(checkDate.getDate() - i);
    const checkStr = checkDate.toISOString().split('T')[0];
    if (allDatesSet.has(checkStr)) {
      currentStreak++;
    } else {
      break;
    }
  }

  // Average daily stickers over last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);
  const last30Count = await prisma.sticker.count({
    where: {
      filledBy: userId,
      filledAt: { gte: thirtyDaysAgo },
    },
  });
  const averageDaily = Math.round((last30Count / 30) * 10) / 10;

  // Most active day of week
  const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0]; // Sun=0..Sat=6
  for (const s of allStickers) {
    dayOfWeekCounts[s.filledAt.getDay()]++;
  }
  const maxDayIndex = dayOfWeekCounts.indexOf(Math.max(...dayOfWeekCounts));
  const mostActiveDay = DAY_NAMES[maxDayIndex];

  // Completion rate
  const completionRate = totalBoards > 0
    ? Math.round((completedBoards / totalBoards) * 1000) / 10
    : 0;

  // Monthly trend: Last 6 months
  const monthlyTrend: { month: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setMonth(monthStart.getMonth() - i);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);

    const monthCount = await prisma.sticker.count({
      where: {
        filledBy: userId,
        filledAt: { gte: monthStart, lt: monthEnd },
      },
    });

    const monthStr = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`;
    monthlyTrend.push({ month: monthStr, count: monthCount });
  }

  // Category breakdown: Group boards by templateId category, count stickers
  const boardsWithStickers = await prisma.board.findMany({
    where: { ownerId: userId },
    select: {
      templateId: true,
      _count: { select: { stickers: true } },
    },
  });

  const categoryMap = new Map<string, number>();
  const categoryNameMap = new Map<string, string>();
  for (const cat of TEMPLATE_CATEGORIES) {
    categoryNameMap.set(cat.id, cat.name);
  }

  for (const board of boardsWithStickers) {
    let categoryKey = '기타';
    if (board.templateId) {
      // templateId format: "category-name", extract category prefix
      const prefix = board.templateId.split('-')[0];
      if (categoryNameMap.has(prefix)) {
        categoryKey = categoryNameMap.get(prefix)!;
      }
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
