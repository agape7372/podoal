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
      _count: { select: { stickers: true, rewards: true } },
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
    rewardCount: board._count.rewards,
  }));

  return Response.json({ boards: result });
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return authResponse('Unauthorized');
  }

  const body = await request.json();
  const { title, description, totalStickers, rewards } = body;

  if (!title || !totalStickers || !rewards || !Array.isArray(rewards) || rewards.length === 0) {
    return authResponse('Missing required fields: title, totalStickers, rewards (array)', 400);
  }

  // Validate each reward
  for (const reward of rewards) {
    if (!reward.type || !reward.title || !reward.content || !reward.triggerAt) {
      return authResponse('Each reward must have: type, title, content, triggerAt', 400);
    }
    if (reward.triggerAt < 1 || reward.triggerAt > totalStickers) {
      return authResponse(`triggerAt must be between 1 and ${totalStickers}`, 400);
    }
  }

  // Check for duplicate triggerAt values
  const triggerAts = rewards.map((r: { triggerAt: number }) => r.triggerAt);
  if (new Set(triggerAts).size !== triggerAts.length) {
    return authResponse('Each reward must have a unique triggerAt value', 400);
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

    // Create all rewards
    for (const reward of rewards) {
      await tx.reward.create({
        data: {
          boardId: newBoard.id,
          type: reward.type,
          title: reward.title,
          content: reward.content,
          imageUrl: reward.imageUrl || '',
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
    rewardCount: board._count.rewards,
  };

  return Response.json({ board: result }, { status: 201 });
}
