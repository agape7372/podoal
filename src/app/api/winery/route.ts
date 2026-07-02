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

  // 두 쿼리는 독립 — 직렬 워터폴 대신 병렬로(콜드 응답 절반).
  const [totalGrapes, completedBoards] = await Promise.all([
    // Count all stickers filled by this user
    prisma.sticker.count({
      where: { filledBy: userId },
    }),
    // Fetch completed boards owned by this user
    prisma.board.findMany({
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
        harvestedAt: true, // 수확(셀러 입고) 여부 — NEW 병 표시·입고 버튼용
        templateId: true, // 품종(카테고리) 라벨 유도용
      },
      orderBy: { completedAt: 'desc' },
    }),
  ]);

  // Get tier data
  const currentTier = getCurrentTier(totalGrapes);
  const nextTier = getNextTier(totalGrapes);
  const tierProgress = getTierProgress(totalGrapes);

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
      harvestedAt: board.harvestedAt?.toISOString() ?? null,
      templateId: board.templateId ?? null,
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
