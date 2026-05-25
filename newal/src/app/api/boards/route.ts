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
  const { title, description, totalStickers, rewards, templateId } = body;

  if (
    typeof title !== 'string' ||
    title.trim().length === 0 ||
    title.length > 80
  ) {
    return authResponse('제목은 1~80자여야 합니다.', 400);
  }
  if (description !== undefined && (typeof description !== 'string' || description.length > 200)) {
    return authResponse('설명은 200자 이하여야 합니다.', 400);
  }
  if (![10, 15, 20, 30].includes(totalStickers)) {
    return authResponse('포도알 개수는 10/15/20/30 중 하나여야 합니다.', 400);
  }
  if (!Array.isArray(rewards) || rewards.length === 0 || rewards.length > 10) {
    return authResponse('보상은 1~10개여야 합니다.', 400);
  }
  if (templateId !== undefined && templateId !== null && (typeof templateId !== 'string' || templateId.length > 64)) {
    return authResponse('잘못된 templateId 입니다.', 400);
  }

  const VALID_REWARD_TYPES = new Set(['letter', 'giftcard', 'wish']);
  for (const reward of rewards) {
    if (
      typeof reward.type !== 'string' ||
      !VALID_REWARD_TYPES.has(reward.type) ||
      typeof reward.title !== 'string' ||
      reward.title.trim().length === 0 ||
      reward.title.length > 80 ||
      typeof reward.content !== 'string' ||
      reward.content.length > 500 ||
      typeof reward.triggerAt !== 'number'
    ) {
      return authResponse('보상 형식이 올바르지 않습니다.', 400);
    }
    if (!Number.isInteger(reward.triggerAt) || reward.triggerAt < 1 || reward.triggerAt > totalStickers) {
      return authResponse(`triggerAt은 1~${totalStickers} 사이의 정수여야 합니다.`, 400);
    }
    if (reward.imageUrl !== undefined && (typeof reward.imageUrl !== 'string' || reward.imageUrl.length > 1024)) {
      return authResponse('imageUrl이 올바르지 않습니다.', 400);
    }
  }

  // Check for duplicate triggerAt values
  const triggerAts = rewards.map((r: { triggerAt: number }) => r.triggerAt);
  if (new Set(triggerAts).size !== triggerAts.length) {
    return authResponse('각 보상의 triggerAt 값은 달라야 합니다.', 400);
  }

  const board = await prisma.$transaction(async (tx) => {
    const newBoard = await tx.board.create({
      data: {
        title,
        description: description || '',
        totalStickers,
        templateId: templateId || null,
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
