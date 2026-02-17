import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';

const userProfileSelect = {
  id: true,
  name: true,
  email: true,
  avatar: true,
};

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
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
      reward: true,
    },
  });

  if (!board) {
    return authResponse('Board not found', 404);
  }

  // Only allow the owner or gift recipient to view the board
  if (board.ownerId !== userId && board.giftedToId !== userId) {
    return authResponse('Forbidden', 403);
  }

  // Hide reward content if the board is not completed
  const reward = board.reward
    ? board.isCompleted
      ? board.reward
      : {
          id: board.reward.id,
          boardId: board.reward.boardId,
          type: board.reward.type,
          title: board.reward.title,
          content: '',
          imageUrl: '',
        }
    : null;

  const result = {
    id: board.id,
    title: board.title,
    description: board.description,
    totalStickers: board.totalStickers,
    filledCount: board.stickers.length,
    isCompleted: board.isCompleted,
    completedAt: board.completedAt,
    createdAt: board.createdAt,
    owner: board.owner,
    giftedTo: board.giftedTo,
    giftedFrom: board.giftedFrom,
    hasReward: !!board.reward,
    stickers: board.stickers,
    reward,
  };

  return Response.json({ board: result });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
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
