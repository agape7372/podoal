import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';
import { isCapsuleOpenable } from '@/lib/capsuleTime';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return authResponse('Unauthorized');
  }

  const { id: capsuleId } = params;

  const capsule = await prisma.timeCapsule.findUnique({
    where: { id: capsuleId },
  });

  if (!capsule) {
    return authResponse('Capsule not found', 404);
  }

  if (capsule.userId !== userId) {
    return authResponse('Only the capsule owner can open it', 403);
  }

  if (capsule.isOpened) {
    return authResponse('Capsule is already opened', 400);
  }

  // Exact timestamp comparison (was previously date-only which let capsules
  // open up to ~24h early depending on server/user timezones). 판정 규칙은
  // src/lib/capsuleTime.ts로 추출 — 클라(CapsuleModal)와 동일 함수를 공유.
  if (!isCapsuleOpenable(capsule.openAt, Date.now())) {
    return authResponse('아직 캡슐을 열 수 없어요', 400);
  }

  const updated = await prisma.timeCapsule.update({
    where: { id: capsuleId },
    data: { isOpened: true },
  });

  return Response.json({ capsule: updated });
}
