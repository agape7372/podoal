import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';
import { checkRewardAuthorship } from '@/lib/rewardAccess';

const VALID_REWARD_TYPES = new Set(['letter', 'giftcard', 'wish']);

// Owner plants a "중간 보상" (mid-reward) on an unfilled grape of their OWN board.
// A mid-reward is just a Reward row with triggerAt = position + 1 (< totalStickers);
// the existing unlock-on-fill + reveal + 🎁-marker flow handles everything downstream.
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  const { id: boardId } = params;
  const body = await request.json();
  const { type, title, content, position } = body;

  if (typeof type !== 'string' || !VALID_REWARD_TYPES.has(type)) {
    return authResponse('보상 형식이 올바르지 않습니다.', 400);
  }
  if (typeof title !== 'string' || title.trim().length === 0 || title.length > 80) {
    return authResponse('보상 제목은 1~80자여야 합니다.', 400);
  }
  if (typeof content !== 'string' || content.trim().length === 0 || content.length > 500) {
    return authResponse('보상 내용은 1~500자여야 합니다.', 400);
  }
  if (!Number.isInteger(position)) {
    return authResponse('invalid position', 400);
  }

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: {
      ownerId: true,
      totalStickers: true,
      isCompleted: true,
      giftedFromId: true,
      relayParticipants: { select: { relay: { select: { creatorId: true } } } },
      _count: { select: { stickers: true, rewards: true } },
    },
  });
  if (!board) return authResponse('Board not found', 404);
  // 출처 게이트(rewardAccess.ts) — 편집용 로더가 자기 출처 보드로 제한되므로,
  // 심기도 같은 기준으로 막아 "심었는데 수정/삭제 불가" 상태를 만들지 않는다.
  const verdict = checkRewardAuthorship(
    { ownerId: board.ownerId, giftedFromId: board.giftedFromId, relayLinks: board.relayParticipants },
    userId,
  );
  if (!verdict.allowed) {
    if (verdict.reason === 'gifted') {
      return authResponse('선물받은 포도판에는 보상을 심을 수 없어요', 400);
    }
    if (verdict.reason === 'relay') {
      return authResponse('포도동 포도판에는 보상을 심을 수 없어요', 400);
    }
    return authResponse('내 포도판에만 보상을 심을 수 있어요', 403);
  }
  if (board.isCompleted) return authResponse('이미 완성된 포도판이에요', 400);

  const filledCount = board._count.stickers;
  const triggerAt = position + 1;
  if (position < filledCount || position >= board.totalStickers) {
    return authResponse('아직 채우지 않은 칸에만 보상을 심을 수 있어요', 400);
  }
  if (triggerAt >= board.totalStickers) {
    return authResponse('마지막 칸에는 중간 보상을 심을 수 없어요', 400);
  }
  if (board._count.rewards >= 10) {
    return authResponse('보상은 최대 10개까지예요', 400);
  }

  try {
    const reward = await prisma.reward.create({
      data: { boardId, type, title: title.trim(), content: content.trim(), imageUrl: '', triggerAt },
    });
    return Response.json(
      {
        reward: {
          id: reward.id,
          type: reward.type,
          title: reward.title,
          content: reward.content,
          imageUrl: reward.imageUrl,
          triggerAt: reward.triggerAt,
          unlockedAt: null,
          revealedAt: null,
        },
      },
      { status: 201 },
    );
  } catch (e: unknown) {
    // @@unique([boardId, triggerAt]) race — another request claimed this slot.
    if (e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === 'P2002') {
      return authResponse('그 칸엔 이미 보상이 있어요', 409);
    }
    throw e;
  }
}
