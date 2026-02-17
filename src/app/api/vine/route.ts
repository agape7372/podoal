import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';

interface ActivityItem {
  type: 'sticker' | 'board_complete' | 'capsule_open';
  date: string;
  title: string;
  description: string;
  icon: string;
}

interface DateGroup {
  date: string;
  activities: ActivityItem[];
}

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return authResponse('Unauthorized');
  }

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  // Fetch stickers filled by the user in the last 90 days
  const stickers = await prisma.sticker.findMany({
    where: {
      filledBy: userId,
      filledAt: { gte: ninetyDaysAgo },
    },
    include: {
      board: {
        select: { id: true, title: true },
      },
    },
    orderBy: { filledAt: 'desc' },
  });

  // Fetch boards completed by the user in the last 90 days
  const completedBoards = await prisma.board.findMany({
    where: {
      ownerId: userId,
      isCompleted: true,
      completedAt: { gte: ninetyDaysAgo },
    },
    select: {
      id: true,
      title: true,
      completedAt: true,
    },
    orderBy: { completedAt: 'desc' },
  });

  // Fetch capsules opened by the user in the last 90 days
  // Since we don't have an "openedAt" field, we use capsules that are opened
  // and whose openAt date is within the last 90 days
  const openedCapsules = await prisma.timeCapsule.findMany({
    where: {
      userId,
      isOpened: true,
      openAt: { gte: ninetyDaysAgo },
    },
    include: {
      board: {
        select: { id: true, title: true },
      },
    },
    orderBy: { openAt: 'desc' },
  });

  const activities: ActivityItem[] = [];

  // Process stickers: group by board + date
  const stickerGroups = new Map<string, { count: number; boardTitle: string; date: string }>();
  for (const sticker of stickers) {
    const dateStr = toDateString(sticker.filledAt);
    const key = `${sticker.boardId}_${dateStr}`;
    const existing = stickerGroups.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      stickerGroups.set(key, {
        count: 1,
        boardTitle: sticker.board.title,
        date: dateStr,
      });
    }
  }

  for (const group of Array.from(stickerGroups.values())) {
    activities.push({
      type: 'sticker',
      date: group.date,
      title: group.boardTitle,
      description: `${group.boardTitle}에 ${group.count}개 포도알 채움`,
      icon: '🍇',
    });
  }

  // Process completed boards
  for (const board of completedBoards) {
    if (board.completedAt) {
      activities.push({
        type: 'board_complete',
        date: toDateString(board.completedAt),
        title: board.title,
        description: `${board.title} 포도판 완성! 🎉`,
        icon: '🎊',
      });
    }
  }

  // Process opened capsules
  for (const capsule of openedCapsules) {
    activities.push({
      type: 'capsule_open',
      date: toDateString(capsule.openAt),
      title: capsule.board.title,
      description: '동결건조 캡슐 개봉 💊',
      icon: '💊',
    });
  }

  // Group by date and sort newest first
  const dateMap = new Map<string, ActivityItem[]>();
  for (const activity of activities) {
    const existing = dateMap.get(activity.date);
    if (existing) {
      existing.push(activity);
    } else {
      dateMap.set(activity.date, [activity]);
    }
  }

  const timeline: DateGroup[] = Array.from(dateMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => ({
      date,
      activities: items,
    }));

  return Response.json({ timeline });
}

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
