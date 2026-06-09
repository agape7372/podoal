import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';

// 위젯 그라운드워크 — 진행중(미완료·미수확) 포도판 + 진행률 요약.
// 지금은 쿠키 인증(브라우저). 네이티브 홈화면 위젯은 추후 per-user 토큰 인증을
// 추가한다(docs/WIDGETS_NATIVE_PLAN.md). 응답 형태는 그대로 재사용 가능.
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  const boards = await prisma.board.findMany({
    where: {
      isCompleted: false,
      harvestedAt: null,
      OR: [{ ownerId: userId }, { giftedToId: userId }],
    },
    include: { _count: { select: { stickers: true } } },
    orderBy: [{ order: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
  });

  const result = boards.map((b) => ({
    id: b.id,
    title: b.title,
    filled: b._count.stickers,
    total: b.totalStickers,
    progress: b.totalStickers > 0 ? Math.round((b._count.stickers / b.totalStickers) * 100) : 0,
  }));

  return Response.json({ date: new Date().toISOString(), boards: result });
}
