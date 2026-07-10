import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';

// 익명 사용 통계 동의 상태 저장(ANALYTICS_PLAN §4) — 기기 간 동의 동기화의 서버 정본.
// granted=true → 동의 시각 기록, false → null(철회). additive 라우트(데이터층 게이트 통과).
export async function PATCH(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  const body = await request.json().catch(() => null);
  const granted = body?.granted;
  if (typeof granted !== 'boolean') {
    return authResponse('동의 값이 올바르지 않아요', 400);
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { analyticsConsentAt: granted ? new Date() : null },
    select: { analyticsConsentAt: true },
  });

  return Response.json({ analyticsConsentAt: user.analyticsConsentAt });
}
