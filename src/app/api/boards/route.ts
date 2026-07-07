import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';
import { PUBLIC_USER_SELECT as userProfileSelect } from '@/lib/userSelect';
import { validateRewards } from '@/lib/rewardValidation';
import { CADENCE_TYPES } from '@/types';

// 채움 텀(FILL_CADENCE_PLAN §2·§8 C1) — additive. 미지정 시 스키마 기본값 "FREE"와
// 동일한 의미로 취급한다(하위호환: cadenceType을 모르는 옛 클라도 그대로 동작).
const VALID_CADENCE_TYPES = new Set<string>(CADENCE_TYPES);

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
      relayParticipants: { select: { relay: { select: { mode: true } } } },
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
    order: board.order,
    harvestedAt: board.harvestedAt,
    // 포도동(group 릴레이)에 속한 보드인지 — 홈 카드 출처 배지용.
    podong: board.relayParticipants.some((rp) => rp.relay.mode === 'group'),
    // 채움 텀(additive, C1) — 없던 시절 보드도 스키마 기본값 "FREE"라 항상 채워져 있다.
    cadenceType: board.cadenceType,
    cadenceN: board.cadenceN,
  }));

  return Response.json({ boards: result });
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return authResponse('Unauthorized');
  }

  const body = await request.json();
  const { title, description, totalStickers, rewards, templateId, cadenceType, cadenceN } = body;

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
  if (!Number.isInteger(totalStickers) || totalStickers < 2 || totalStickers > 60) {
    return authResponse('포도알 개수는 2~60개 사이여야 합니다.', 400);
  }
  if (templateId !== undefined && templateId !== null && (typeof templateId !== 'string' || templateId.length > 64)) {
    return authResponse('잘못된 templateId 입니다.', 400);
  }

  // 채움 텀(additive, C1) — undefined면 "FREE"로 취급(하위호환). 지정 시 4종 외엔 400.
  const resolvedCadenceType = cadenceType === undefined ? 'FREE' : cadenceType;
  if (typeof resolvedCadenceType !== 'string' || !VALID_CADENCE_TYPES.has(resolvedCadenceType)) {
    return authResponse('채우는 리듬 값이 올바르지 않아요.', 400);
  }
  // N은 DAILY_N/WEEKLY_N에서만 필수 — FREE/DAILY_1은 무시하고 null 저장(§2 표 범위).
  let resolvedCadenceN: number | null = null;
  if (resolvedCadenceType === 'DAILY_N') {
    if (!Number.isInteger(cadenceN) || cadenceN < 2 || cadenceN > 10) {
      return authResponse('리듬 횟수가 올바르지 않아요.', 400);
    }
    resolvedCadenceN = cadenceN;
  } else if (resolvedCadenceType === 'WEEKLY_N') {
    if (!Number.isInteger(cadenceN) || cadenceN < 1 || cadenceN > 7) {
      return authResponse('리듬 횟수가 올바르지 않아요.', 400);
    }
    resolvedCadenceN = cadenceN;
  }

  const rewardError = validateRewards(rewards, totalStickers);
  if (rewardError) {
    return authResponse(rewardError, 400);
  }

  const board = await prisma.$transaction(async (tx) => {
    const newBoard = await tx.board.create({
      data: {
        title,
        description: description || '',
        totalStickers,
        templateId: templateId || null,
        ownerId: userId,
        cadenceType: resolvedCadenceType,
        cadenceN: resolvedCadenceN,
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
    cadenceType: board.cadenceType,
    cadenceN: board.cadenceN,
  };

  return Response.json({ board: result }, { status: 201 });
}
