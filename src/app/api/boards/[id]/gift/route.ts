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
  const body = await request.json();
  const { friendId, message } = body;
  const giftNote = typeof message === 'string' ? message.trim().slice(0, 500) : '';

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
