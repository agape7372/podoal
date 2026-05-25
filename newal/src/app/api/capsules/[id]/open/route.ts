import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
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
  // open up to ~24h early depending on server/user timezones).
  if (Date.now() < capsule.openAt.getTime()) {
    return authResponse('아직 캡슐을 열 수 없어요', 400);
  }

  const updated = await prisma.timeCapsule.update({
    where: { id: capsuleId },
    data: { isOpened: true },
  });

  return Response.json({ capsule: updated });
}
