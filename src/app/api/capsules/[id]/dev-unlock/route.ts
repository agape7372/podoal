import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';
import { DEV_TOOLS } from '@/lib/devtools';

// DEV-ONLY: backdate a capsule's openAt so the REAL open flow (client
// `isOpenable` + server `/open` timestamp check) passes immediately, without
// waiting for the actual date to arrive. Gated by DEV_TOOLS and owner-only.
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  if (!DEV_TOOLS) {
    return authResponse('Not found', 404);
  }

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
    return authResponse('Only the capsule owner can unlock it', 403);
  }

  // One minute in the past clears both the client and server time checks.
  const updated = await prisma.timeCapsule.update({
    where: { id: capsuleId },
    data: { openAt: new Date(Date.now() - 60_000) },
  });

  return Response.json({ capsule: updated });
}
