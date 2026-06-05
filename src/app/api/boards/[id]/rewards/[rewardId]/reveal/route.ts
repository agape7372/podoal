import { prisma } from '@/lib/prisma';
import { authResponse, getCurrentUserId } from '@/lib/auth';

// Mark a reward as revealed (user has opened it to see the contents).
// Persisting this means the "open" state survives reloads and devices.
export async function POST(
  _request: Request,
  props: { params: Promise<{ id: string; rewardId: string }> }
) {
  const params = await props.params;
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  const { id: boardId, rewardId } = params;

  const reward = await prisma.reward.findUnique({
    where: { id: rewardId },
    include: {
      board: {
        select: {
          id: true,
          ownerId: true,
          giftedToId: true,
          _count: { select: { stickers: true } },
        },
      },
    },
  });

  if (!reward || reward.boardId !== boardId || !reward.board) {
    return authResponse('Reward not found', 404);
  }

  if (
    reward.board.ownerId !== userId &&
    reward.board.giftedToId !== userId
  ) {
    return authResponse('Forbidden', 403);
  }

  if (reward.board._count.stickers < reward.triggerAt) {
    return authResponse('아직 열 수 없어요. 더 채워주세요.', 400);
  }

  // Idempotent: if already revealed, return current state unchanged.
  if (reward.revealedAt) {
    return Response.json({
      reward: {
        id: reward.id,
        type: reward.type,
        title: reward.title,
        content: reward.content,
        imageUrl: reward.imageUrl,
        triggerAt: reward.triggerAt,
        unlockedAt: reward.unlockedAt?.toISOString() ?? null,
        revealedAt: reward.revealedAt.toISOString(),
      },
    });
  }

  const now = new Date();
  const updated = await prisma.reward.update({
    where: { id: rewardId },
    data: {
      revealedAt: now,
      // Set unlockedAt too if the sticker bump never went through the atomic
      // claim path (e.g. older boards that pre-date this field).
      unlockedAt: reward.unlockedAt ?? now,
    },
  });

  return Response.json({
    reward: {
      id: updated.id,
      type: updated.type,
      title: updated.title,
      content: updated.content,
      imageUrl: updated.imageUrl,
      triggerAt: updated.triggerAt,
      unlockedAt: updated.unlockedAt?.toISOString() ?? null,
      revealedAt: updated.revealedAt?.toISOString() ?? null,
    },
  });
}
