import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';

// 포도밭 — 사용자가 지금까지 획득한(unlocked) 보상·중간보상을 모아 반환한다.
// 본인이 소유했거나(ownerId) 선물받은(giftedToId) 보드의 보상 중 unlockedAt != null 만.
// content/imageUrl 은 revealedAt 이후에만 노출(개봉 전 비밀 유지 — stickers 라우트와 동일 원칙).
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return authResponse('Unauthorized');
  }

  const rewards = await prisma.reward.findMany({
    where: {
      unlockedAt: { not: null },
      board: {
        OR: [{ ownerId: userId }, { giftedToId: userId }],
      },
    },
    include: {
      board: { select: { id: true, title: true, totalStickers: true } },
    },
    orderBy: { unlockedAt: 'desc' },
  });

  const result = rewards.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    content: r.revealedAt ? r.content : '',
    imageUrl: r.revealedAt ? r.imageUrl : '',
    triggerAt: r.triggerAt,
    unlockedAt: r.unlockedAt?.toISOString() ?? null,
    revealedAt: r.revealedAt?.toISOString() ?? null,
    board: r.board,
  }));

  return Response.json({ rewards: result });
}
