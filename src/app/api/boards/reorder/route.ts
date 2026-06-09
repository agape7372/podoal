import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';

// 홈 포도판 순서 변경 — orderedIds 배열 순서대로 각 보드에 order=index 부여(본인 소유만).
export async function PATCH(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  const body = await request.json().catch(() => ({}));
  const orderedIds: unknown = body?.orderedIds;
  if (!Array.isArray(orderedIds) || orderedIds.some((id) => typeof id !== 'string')) {
    return authResponse('orderedIds는 문자열 배열이어야 합니다.', 400);
  }
  if (orderedIds.length === 0) return Response.json({ ok: true });
  if (orderedIds.length > 300) return authResponse('한 번에 정렬할 수 있는 포도판이 너무 많아요.', 400);

  // 전부 본인 소유인지 검증(중복 id면 owned 수가 줄어 자동 거부).
  const owned = await prisma.board.findMany({
    where: { id: { in: orderedIds as string[] }, ownerId: userId },
    select: { id: true },
  });
  if (owned.length !== orderedIds.length) {
    return authResponse('본인 소유의 포도판만 정렬할 수 있어요.', 403);
  }

  await prisma.$transaction(
    (orderedIds as string[]).map((id, i) =>
      prisma.board.update({ where: { id }, data: { order: i } }),
    ),
  );

  return Response.json({ ok: true });
}
