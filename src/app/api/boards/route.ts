import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';
import { PUBLIC_USER_SELECT as userProfileSelect } from '@/lib/userSelect';
import { validateRewards } from '@/lib/rewardValidation';
import { zonedDateKey, weekStartKey } from '@/lib/streak';
import { computeFillPace } from '@/lib/pace';
import { CADENCE_TYPES } from '@/types';

// 채움 텀(FILL_CADENCE_PLAN §2·§8 C1) — additive. 미지정 시 스키마 기본값 "FREE"와
// 동일한 의미로 취급한다(하위호환: cadenceType을 모르는 옛 클라도 그대로 동작).
const VALID_CADENCE_TYPES = new Set<string>(CADENCE_TYPES);

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return authResponse('Unauthorized');
  }

  const [boards, boundaryUser] = await Promise.all([
    prisma.board.findMany({
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
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true, dayResetHour: true },
    }),
  ]);

  // 채움 텀 C2: 홈 카드 "오늘 몫 완료" 배지용 paceDone(additive). 텀 있는 미완성 보드만
  // 이번 기간(오늘/이번 주) 채움 수를 세서 quota 도달 여부를 서버 기준으로 판정한다.
  // 인스턴트 경계 대신 넉넉한 하한으로 오버페치 후 computeFillPace의 키 비교가 정확히
  // 거른다(streak.ts 설계 노트 참조).
  const timezone = boundaryUser?.timezone || 'Asia/Seoul';
  const resetHour = boundaryUser?.dayResetHour ?? 0;
  const paceBoards = boards.filter(
    (b) => b.cadenceType && b.cadenceType !== 'FREE' && !b.isCompleted,
  );
  const paceDoneByBoard = new Map<string, boolean>();
  if (paceBoards.length > 0) {
    const now = new Date();
    const todayKey = zonedDateKey(now, timezone, resetHour);
    // 주간 보드까지 커버하는 가장 이른 필요 날짜 = 이번 주 시작. 시간대 오프셋·resetHour
    // 여유로 48시간 버퍼를 빼서 UTC 하한을 잡는다(경계 바깥 행은 키 비교가 걸러냄).
    const lowerKey = weekStartKey(todayKey);
    const lowerBound = new Date(Date.parse(`${lowerKey}T00:00:00Z`) - 48 * 3_600_000);
    const recent = await prisma.sticker.findMany({
      where: { boardId: { in: paceBoards.map((b) => b.id) }, filledAt: { gte: lowerBound } },
      select: { boardId: true, filledAt: true },
    });
    const filledByBoard = new Map<string, Date[]>();
    for (const s of recent) {
      const list = filledByBoard.get(s.boardId);
      if (list) list.push(s.filledAt);
      else filledByBoard.set(s.boardId, [s.filledAt]);
    }
    for (const b of paceBoards) {
      const pace = computeFillPace(b, filledByBoard.get(b.id) ?? [], now, timezone, resetHour);
      if (pace) paceDoneByBoard.set(b.id, !pace.ripe);
    }
  }

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
    // 채움 텀 C2(additive): 이번 기간 몫 완료 여부 — FREE·완성 보드는 undefined(필드 생략).
    paceDone: paceDoneByBoard.get(board.id),
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
