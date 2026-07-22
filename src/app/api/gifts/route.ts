import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';
import { sendPushToUser } from '@/lib/push';
import { validateRewards } from '@/lib/rewardValidation';
import { createGiftBoardForFriend, GIFT_BOARD_INCLUDE } from '@/lib/giftBoard';

// 친구에게 줄 포도판을 **한 번에** 만든다 (감사 H-01).
//
// 기존 /api/boards/[id]/gift 는 "이미 있는 내 보드를 친구에게 복사"하는 다른 유즈케이스라
// 그대로 남는다(GiftBoardModal이 쓴다). 이 라우트는 "선물용으로 새로 만든다" 전용이며,
// 예전에 클라이언트가 돌던 3커밋 saga(보드 생성 → gift → 내 보드 삭제)를 대체한다.
//
// 멱등성: Board @@unique([giftedFromId, giftIdempotencyKey]). 같은 키로 다시 오면 새로
// 만들지 않고 이미 만들어진 선물을 그대로 돌려준다 — 타임아웃·중복 제출·재시도에서
// 수신 보드는 항상 정확히 하나다.
export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return authResponse('Unauthorized');
  }

  const body = await request.json().catch(() => null);
  if (body === null) return authResponse('잘못된 요청이에요.', 400);

  const { friendId, title, description, totalStickers, templateId, rewards, giftMessage, idempotencyKey } = body;

  if (typeof friendId !== 'string' || !friendId) {
    return authResponse('Missing required field: friendId', 400);
  }
  if (friendId === userId) {
    return authResponse('Cannot gift a board to yourself', 400);
  }
  if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 8 || idempotencyKey.length > 64) {
    return authResponse('잘못된 요청이에요.', 400);
  }
  if (typeof title !== 'string' || title.trim().length === 0 || title.length > 80) {
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

  const rewardError = validateRewards(rewards, totalStickers);
  if (rewardError) {
    return authResponse(rewardError, 400);
  }

  // 친구 관계는 accepted 양방향으로 확인한다(PRINCIPLES §1-3 — 새 소셜 라우트의 필수 게이트).
  const friendship = await prisma.friendship.findFirst({
    where: {
      status: 'accepted',
      OR: [
        { requesterId: userId, receiverId: friendId },
        { requesterId: friendId, receiverId: userId },
      ],
    },
    select: { id: true },
  });
  if (!friendship) {
    return authResponse('Friendship not found or not accepted', 403);
  }

  const giftNote = typeof giftMessage === 'string' ? giftMessage.trim().slice(0, 200) : '';

  let giftedBoard: Awaited<ReturnType<typeof createGiftBoardForFriend>> = null;
  let alreadyExisted = false;
  try {
    giftedBoard = await createGiftBoardForFriend(prisma, userId, friendId, {
      title: title.trim(),
      description: typeof description === 'string' ? description.trim() : '',
      totalStickers,
      templateId: typeof templateId === 'string' ? templateId : null,
      giftMessage: giftNote,
      rewards,
      idempotencyKey,
    });
  } catch (e) {
    // 같은 멱등키로 이미 만들어진 선물 — 재시도이므로 기존 결과를 그대로 돌려준다.
    // 새로 만들지도, 오류를 내지도 않는 것이 이 엔드포인트의 계약이다.
    if ((e as { code?: string }).code !== 'P2002') throw e;
    alreadyExisted = true;
    giftedBoard = await prisma.board.findFirst({
      where: { giftedFromId: userId, giftIdempotencyKey: idempotencyKey },
      include: GIFT_BOARD_INCLUDE,
    });
  }

  if (!giftedBoard) {
    return authResponse('Failed to gift board', 500);
  }

  // 알림(인박스 + 푸시)은 최초 생성 때만 — 재시도로 같은 선물 알림이 두 번 가지 않게 한다.
  // 트랜잭션 밖 부수효과라 실패해도 선물 자체는 유효하다(기존 gift 라우트와 같은 정책).
  if (!alreadyExisted) {
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
      'gift',
    );
  }

  return Response.json(
    {
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
    },
    { status: alreadyExisted ? 200 : 201 },
  );
}
