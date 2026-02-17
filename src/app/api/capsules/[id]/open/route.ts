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

  const now = new Date();
  const openAt = new Date(capsule.openAt);

  // Compare: current time must be >= openAt date
  // We compare at the start-of-day level: the capsule can be opened on or after the openAt date
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const openAtStart = new Date(openAt.getFullYear(), openAt.getMonth(), openAt.getDate());

  if (todayStart.getTime() < openAtStart.getTime()) {
    return authResponse('This capsule cannot be opened yet', 400);
  }

  const updated = await prisma.timeCapsule.update({
    where: { id: capsuleId },
    data: { isOpened: true },
  });

  return Response.json({ capsule: updated });
}
