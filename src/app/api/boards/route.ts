import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';

const userProfileSelect = {
  id: true,
  name: true,
  email: true,
  avatar: true,
};

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return authResponse('Unauthorized');
  }

  const boards = await prisma.board.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { giftedToId: userId },
      ],
    },
    include: {
      owner: { select: userProfileSelect },
      giftedTo: { select: userProfileSelect },
      giftedFrom: { select: userProfileSelect },
      reward: { select: { id: true } },
      _count: { select: { stickers: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const result = boards.map((board) => ({
    id: board.id,
    title: board.title,
    description: board.description,
    totalStickers: board.totalStickers,
    filledCount: board._count.stickers,
    isCompleted: board.isCompleted,
    completedAt: board.completedAt,
    createdAt: board.createdAt,
    owner: board.owner,
    giftedTo: board.giftedTo,
    giftedFrom: board.giftedFrom,
    hasReward: !!board.reward,
  }));

  return Response.json({ boards: result });
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return authResponse('Unauthorized');
  }

  const body = await request.json();
  const { title, description, totalStickers, reward } = body;

  if (!title || !totalStickers || !reward) {
    return authResponse('Missing required fields: title, totalStickers, reward', 400);
  }

  if (!reward.type || !reward.title || !reward.content) {
    return authResponse('Missing required reward fields: type, title, content', 400);
  }

  const board = await prisma.$transaction(async (tx) => {
    const newBoard = await tx.board.create({
      data: {
        title,
        description: description || '',
        totalStickers,
        ownerId: userId,
      },
    });

    await tx.reward.create({
      data: {
        boardId: newBoard.id,
        type: reward.type,
        title: reward.title,
        content: reward.content,
        imageUrl: reward.imageUrl || '',
      },
    });

    return tx.board.findUnique({
      where: { id: newBoard.id },
      include: {
        owner: { select: userProfileSelect },
        giftedTo: { select: userProfileSelect },
        giftedFrom: { select: userProfileSelect },
        reward: { select: { id: true } },
        _count: { select: { stickers: true } },
      },
    });
  });

  if (!board) {
    return authResponse('Failed to create board', 500);
  }

  const result = {
    id: board.id,
    title: board.title,
    description: board.description,
    totalStickers: board.totalStickers,
    filledCount: board._count.stickers,
    isCompleted: board.isCompleted,
    completedAt: board.completedAt,
    createdAt: board.createdAt,
    owner: board.owner,
    giftedTo: board.giftedTo,
    giftedFrom: board.giftedFrom,
    hasReward: !!board.reward,
  };

  return Response.json({ board: result }, { status: 201 });
}
