import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';
import { sendPushToUser } from '@/lib/push';
import { PUBLIC_USER_SELECT as userProfileSelect } from '@/lib/userSelect';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return authResponse('Unauthorized');
  }

  const { id: boardId } = params;
  const body = await request.json();
  const { friendId, message } = body;
  const giftNote = typeof message === 'string' ? message.trim().slice(0, 500) : '';

  if (!friendId) {
    return authResponse('Missing required field: friendId', 400);
  }

  if (friendId === userId) {
    return authResponse('Cannot gift a board to yourself', 400);
  }

  // Verify the board exists and the current user owns it
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: {
      rewards: true,
    },
  });

  if (!board) {
    return authResponse('Board not found', 404);
  }

  if (board.ownerId !== userId) {
    return authResponse('Only the board owner can gift this board', 403);
  }

  // Verify friendship exists and is accepted
  const friendship = await prisma.friendship.findFirst({
    where: {
      status: 'accepted',
      OR: [
        { requesterId: userId, receiverId: friendId },
        { requesterId: friendId, receiverId: userId },
      ],
    },
  });

  if (!friendship) {
    return authResponse('Friendship not found or not accepted', 403);
  }

  // Create a copy of the board for the friend
  const giftedBoard = await prisma.$transaction(async (tx) => {
    const newBoard = await tx.board.create({
      data: {
        title: board.title,
        description: board.description,
        totalStickers: board.totalStickers,
        ownerId: friendId,
        giftedToId: friendId,
        giftedFromId: userId,
        giftMessage: giftNote,
      },
    });

    // Copy all rewards
    for (const reward of board.rewards) {
      await tx.reward.create({
        data: {
          boardId: newBoard.id,
          type: reward.type,
          title: reward.title,
          content: reward.content,
          imageUrl: reward.imageUrl,
          triggerAt: reward.triggerAt,
        },
      });
    }

    return tx.board.findUnique({
      where: { id: newBoard.id },
      include: {
        owner: { select: userProfileSelect },
        giftedTo: { select: userProfileSelect },
        giftedFrom: { select: userProfileSelect },
        _count: { select: { stickers: true, rewards: true } },
      },
    });
  });

  if (!giftedBoard) {
    return authResponse('Failed to gift board', 500);
  }

  // Notify the recipient — the gift used to arrive silently. Inbox message
  // (always, so it's discoverable) + web push (background, when enabled).
  const senderName = giftedBoard.giftedFrom?.name ?? '친구';
  try {
    await prisma.message.create({
      data: {
        senderId: userId,
        receiverId: friendId,
        boardId: giftedBoard.id,
        type: 'gift',
        emoji: '🎁',
        content: giftNote || `${senderName}님이 포도판을 선물했어요`,
      },
    });
  } catch (e) {
    console.error('gift message create failed:', e);
  }
  await sendPushToUser(
    friendId,
    {
      title: '🎁 포도판 선물 도착!',
      body: giftNote ? `${senderName}: ${giftNote}` : `${senderName}님이 "${giftedBoard.title}" 포도판을 선물했어요`,
      url: `/board/${giftedBoard.id}`,
    },
    'gift'
  );

  const result = {
    id: giftedBoard.id,
    title: giftedBoard.title,
    description: giftedBoard.description,
    totalStickers: giftedBoard.totalStickers,
    filledCount: giftedBoard._count.stickers,
    isCompleted: giftedBoard.isCompleted,
    completedAt: giftedBoard.completedAt,
    createdAt: giftedBoard.createdAt,
    owner: giftedBoard.owner,
    giftedTo: giftedBoard.giftedTo,
    giftedFrom: giftedBoard.giftedFrom,
    rewardCount: giftedBoard._count.rewards,
  };

  return Response.json(result, { status: 201 });
}
