import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';

// 포도밭 — 사용자가 지금까지 획득한(unlocked) 보상·중간보상을 모아 반환한다.
// 본인이 소유했거나(ownerId) 선물받은(giftedToId) 보드의 보상 중 unlockedAt != null 만.
// content/imageUrl 은 항상 동봉 — board GET(#89)과 동일 기준(privileged에겐 unlocked부터
// 공개). 여기 반환분은 전부 unlocked이고 요청자는 owner/수신자(privileged)라 가릴 게 없다.
// revealedAt까지 가리면 reveal 왕복 실패 시 '빈 편지'만 남는다(개봉 연출은 클라 소관).
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
    content: r.content,
    imageUrl: r.imageUrl,
    triggerAt: r.triggerAt,
    unlockedAt: r.unlockedAt?.toISOString() ?? null,
    revealedAt: r.revealedAt?.toISOString() ?? null,
    board: r.board,
  }));

  return Response.json({ rewards: result });
}
