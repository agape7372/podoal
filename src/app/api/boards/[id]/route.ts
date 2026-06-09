import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';

// Board detail never renders email — and this board GET is now reachable by an
// accepted friend (read-only), so DON'T expose other users' email to them.
const userProfileSelect = {
  id: true,
  name: true,
  avatar: true,
};

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return authResponse('Unauthorized');
  }

  const { id } = params;

  const board = await prisma.board.findUnique({
    where: { id },
    include: {
      owner: { select: userProfileSelect },
      giftedTo: { select: userProfileSelect },
      giftedFrom: { select: userProfileSelect },
      stickers: {
        include: {
          filler: { select: userProfileSelect },
        },
        orderBy: { position: 'asc' },
      },
      rewards: {
        orderBy: { triggerAt: 'asc' },
      },
    },
  });

  if (!board) {
    return authResponse('Board not found', 404);
  }

  // Owner and gift recipient can always view. An accepted friend of the owner
  // may also view (read-only) so "친구 포도판 보기" can open the board page
  // instead of bouncing home — the board page renders read-only when isOwner is
  // false (no fill, no owner actions). Filling is still owner-gated server-side.
  // Owner and gift recipient see the full board; an accepted friend gets a
  // read-only view with private reward content / gift message masked (below).
  const isViewerPrivileged = board.ownerId === userId || board.giftedToId === userId;
  if (!isViewerPrivileged) {
    const friendship = await prisma.friendship.findFirst({
      where: {
        status: 'accepted',
        OR: [
          { requesterId: userId, receiverId: board.ownerId },
          { requesterId: board.ownerId, receiverId: userId },
        ],
      },
    });
    if (!friendship) {
      return authResponse('Forbidden', 403);
    }
  }

  const filledCount = board.stickers.length;

  // Process rewards:
  // - title is always visible (for the locked preview)
  // - content/imageUrl are revealed ONLY after the user has opened the reward
  //   (revealedAt is set) AND only to the owner / gift recipient. A visiting
  //   friend never receives the private body (letter text, giftcard image),
  //   even for rewards the owner already opened.
  const rewards = board.rewards.map((reward) => {
    const isRevealed = reward.revealedAt !== null;
    const canSeeBody = isRevealed && isViewerPrivileged;
    return {
      id: reward.id,
      type: reward.type,
      title: reward.title,
      content: canSeeBody ? reward.content : '',
      imageUrl: canSeeBody ? reward.imageUrl : '',
      triggerAt: reward.triggerAt,
      unlockedAt: reward.unlockedAt ? reward.unlockedAt.toISOString() : null,
      revealedAt: reward.revealedAt ? reward.revealedAt.toISOString() : null,
    };
  });

  const result = {
    id: board.id,
    title: board.title,
    description: board.description,
    totalStickers: board.totalStickers,
    filledCount,
    isCompleted: board.isCompleted,
    allowFriendPlant: board.allowFriendPlant,
    completedAt: board.completedAt,
    createdAt: board.createdAt,
    owner: board.owner,
    giftedTo: board.giftedTo,
    giftedFrom: board.giftedFrom,
    // Gifter's private note → owner/recipient only, never a visiting friend.
    giftMessage: isViewerPrivileged ? board.giftMessage : '',
    giftOpenedAt: board.giftOpenedAt ? board.giftOpenedAt.toISOString() : null,
    rewardCount: board.rewards.length,
    stickers: board.stickers,
    rewards,
  };

  return Response.json({ board: result });
}

// Owner-only partial update. Currently just the friend-plant toggle; whitelisted
// so arbitrary fields can't be written. Non-breaking addition (GET/DELETE intact).
export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return authResponse('Unauthorized');
  }

  const { id } = params;
  const board = await prisma.board.findUnique({ where: { id }, select: { ownerId: true } });
  if (!board) {
    return authResponse('Board not found', 404);
  }
  if (board.ownerId !== userId) {
    return authResponse('Only the board owner can update this board', 403);
  }

  const body = await request.json().catch(() => ({}));
  const data: { allowFriendPlant?: boolean; title?: string; description?: string; harvestedAt?: Date | null } = {};
  if (typeof body?.allowFriendPlant === 'boolean') {
    data.allowFriendPlant = body.allowFriendPlant;
  }
  // 수확(숨김) 토글: true=숨김(now), false=노출(null).
  if (typeof body?.harvested === 'boolean') {
    data.harvestedAt = body.harvested ? new Date() : null;
  }
  // 제목/설명 편집 — POST(boards/route.ts)와 동일 검증. stripTitleEmoji는 표시 전용이라 저장경로에 미적용(raw 저장).
  if (typeof body?.title === 'string') {
    if (body.title.trim().length === 0 || body.title.length > 80) {
      return authResponse('제목은 1~80자여야 합니다.', 400);
    }
    data.title = body.title;
  }
  if (typeof body?.description === 'string') {
    if (body.description.length > 200) {
      return authResponse('설명은 200자 이하여야 합니다.', 400);
    }
    data.description = body.description;
  }
  if (Object.keys(data).length === 0) {
    return authResponse('No valid fields to update', 400);
  }

  await prisma.board.update({ where: { id }, data });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return authResponse('Unauthorized');
  }

  const { id } = params;

  const board = await prisma.board.findUnique({
    where: { id },
    select: { ownerId: true },
  });

  if (!board) {
    return authResponse('Board not found', 404);
  }

  if (board.ownerId !== userId) {
    return authResponse('Only the board owner can delete this board', 403);
  }

  await prisma.board.delete({
    where: { id },
  });

  return Response.json({ message: 'Board deleted successfully' });
}
