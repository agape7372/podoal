import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';
import {
  getCurrentTier,
  getNextTier,
  getTierProgress,
  getBottleSize,
  type WineBottle,
} from '@/lib/winery';

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  // Count all stickers filled by this user
  const totalGrapes = await prisma.sticker.count({
    where: { filledBy: userId },
  });

  // Get tier data
  const currentTier = getCurrentTier(totalGrapes);
  const nextTier = getNextTier(totalGrapes);
  const tierProgress = getTierProgress(totalGrapes);

  // Fetch completed boards owned by this user
  const completedBoards = await prisma.board.findMany({
    where: {
      ownerId: userId,
      isCompleted: true,
      completedAt: { not: null },
    },
    select: {
      id: true,
      title: true,
      totalStickers: true,
      completedAt: true,
      createdAt: true,
    },
    orderBy: { completedAt: 'desc' },
  });

  // Transform completed boards into wine bottles
  const bottles: WineBottle[] = completedBoards.map((board) => {
    const created = new Date(board.createdAt);
    const completed = new Date(board.completedAt!);
    const diffMs = completed.getTime() - created.getTime();
    const daysToComplete = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    const vintage = String(completed.getFullYear());

    return {
      boardId: board.id,
      title: board.title,
      totalStickers: board.totalStickers,
      bottleSize: getBottleSize(board.totalStickers),
      completedAt: board.completedAt!.toISOString(),
      createdAt: board.createdAt.toISOString(),
      daysToComplete,
      vintage,
    };
  });

  return Response.json({
    totalGrapes,
    currentTier,
    nextTier,
    tierProgress,
    bottles,
  });
}
