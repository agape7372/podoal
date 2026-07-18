import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';
import { zonedDateKey } from '@/lib/streak';

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

  // 네 쿼리는 상호 독립(경계 유저의 timezone/dayResetHour는 아래 JS 버킷팅에서만
  // 소비, 쿼리 파라미터 아님) → 한 번의 Promise.all로 병렬화. 예전엔 순차 4왕복이라
  // vine 스켈레톤이 DB RTT×4를 기다렸다(스켈레톤 감사 — 응답 계약 불변 재구성).
  const [boundaryUser, stickers, completedBoards, openedCapsules] = await Promise.all([
    // 날짜 버킷팅은 사용자 시간대(User.timezone, 기본 Asia/Seoul) + 하루 시작 시각
    // (User.dayResetHour, 기본 0) 기준 — stats/heatmap/streak과 같은 경계
    // (src/lib/streak.ts zonedDateKey)로 통일한다(같은 활동이 화면마다 다른 날짜로
    // 보이던 정합성 버그 치유). 기본값(Asia/Seoul, 0)에서는 종전 KST 달력 날짜와 동치.
    prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true, dayResetHour: true },
    }),
    // Stickers filled by the user in the last 90 days
    prisma.sticker.findMany({
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
    }),
    // Boards completed by the user in the last 90 days
    prisma.board.findMany({
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
    }),
    // Capsules opened by the user in the last 90 days
    // Since we don't have an "openedAt" field, we use capsules that are opened
    // and whose openAt date is within the last 90 days
    prisma.timeCapsule.findMany({
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
    }),
  ]);
  const timezone = boundaryUser?.timezone || 'Asia/Seoul';
  const resetHour = boundaryUser?.dayResetHour ?? 0;

  const activities: ActivityItem[] = [];

  // Process stickers: group by board + date
  const stickerGroups = new Map<string, { count: number; boardTitle: string; date: string }>();
  for (const sticker of stickers) {
    const dateStr = zonedDateKey(sticker.filledAt, timezone, resetHour);
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
        date: zonedDateKey(board.completedAt, timezone, resetHour),
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
      date: zonedDateKey(capsule.openAt, timezone, resetHour),
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
