import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';

const userProfileSelect = {
  id: true,
  name: true,
  email: true,
  avatar: true,
};

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return authResponse('Unauthorized');
  }

  const { id: boardId } = params;
  const body = await request.json();
  const { friendId } = body;

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
