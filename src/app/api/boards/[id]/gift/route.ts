import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';
import { sendPushToUser } from '@/lib/push';
import { giftBoardCopy, RegiftBlockedError } from '@/lib/giftBoard';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return authResponse('Unauthorized');
  }

  const { id: boardId } = params;
  const body = await request.json().catch(() => null);
  if (body === null) return authResponse('잘못된 요청이에요.', 400);
  const { friendId, message } = body;
  const giftNote = typeof message === 'string' ? message.trim().slice(0, 200) : '';

  if (typeof friendId !== 'string' || !friendId) {
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

  // 포도동(그룹·순차 양 모드) 참가자 보드는 선물 차단 — 선물 사본의 진행은
  // 포도동 추적과 무관해져 참가자 현황을 오도한다. UI 비활성화의 서버측 짝.
  const relayParticipant = await prisma.relayParticipant.findFirst({
    where: { boardId },
    select: { id: true },
  });
  if (relayParticipant) {
    return authResponse('포도동에 연결된 포도판은 선물할 수 없어요', 400);
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

  // 중복 선물 방지: 같은 원본을 같은 친구에게 이미 선물했고 아직 열어보지 않았다면
  // 다시 선물할 때마다 사본이 계속 쌓인다(중복 오염). 스키마에 "원본 boardId" 필드가
  // 없어 giftedFrom/To만으로 원본을 특정할 수 없으므로, title 일치 + 미개봉을
  // 근사 식별자로 사용해 차단한다(상대가 열어보면 giftOpenedAt이 채워져 다시 보낼 수 있음).
  const existingGift = await prisma.board.findFirst({
    where: {
      giftedFromId: userId,
      giftedToId: friendId,
      title: board.title,
      giftOpenedAt: null,
    },
    select: { id: true },
  });
  if (existingGift) {
    return authResponse('이미 선물했어요. 상대가 열어보면 다시 보낼 수 있어요', 409);
  }

  // Create a copy of the board for the friend — 복사+보상복사 트랜잭션은
  // src/lib/giftBoard.ts(라우트·통합테스트 공유)로 추출됨.
  let giftedBoard: Awaited<ReturnType<typeof giftBoardCopy>>;
  try {
    giftedBoard = await giftBoardCopy(prisma, board, userId, friendId, giftNote);
  } catch (e) {
    // 재선물 차단: 선물받은 복사본은 다시 선물할 수 없다.
    if (e instanceof RegiftBlockedError) {
      return authResponse('선물받은 포도판은 다시 선물할 수 없어요', 400);
    }
    throw e;
  }

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
