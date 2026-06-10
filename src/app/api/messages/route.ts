import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PUBLIC_USER_SELECT } from '@/lib/userSelect';
import { getCurrentUserId, authResponse } from '@/lib/auth';
import { clientKey, rateLimit } from '@/lib/rateLimit';
import { sendPushToUser } from '@/lib/push';

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  try {
    const messages = await prisma.message.findMany({
      where: {
        receiverId: userId,
      },
      include: {
        sender: {
          select: PUBLIC_USER_SELECT,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error('Failed to fetch messages:', error);
    return NextResponse.json(
      { error: '메시지를 불러오지 못했어요' },
      { status: 500 }
    );
  }
}

const VALID_MESSAGE_TYPES = new Set(['cheer', 'celebration', 'gift']);

// 메시지 스팸 방지 (라우트에 레이트리밋이 없어 무제한 전송 가능했음).
const sendMessageLimit = rateLimit({
  windowMs: 60_000,
  max: 20,
  message: '메시지를 너무 빨리 보내고 있어요. 잠시 후 다시 시도해주세요.',
});

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  const blocked = await sendMessageLimit(clientKey(request));
  if (blocked) return blocked;

  try {
    const { receiverId, content, type, emoji, boardId } = await request.json();

    if (
      typeof receiverId !== 'string' ||
      receiverId.length === 0 ||
      typeof content !== 'string' ||
      content.trim().length === 0
    ) {
      return NextResponse.json(
        { error: 'receiverId and content are required' },
        { status: 400 }
      );
    }
    if (content.length > 500) {
      return NextResponse.json(
        { error: '메시지는 최대 500자까지 가능합니다.' },
        { status: 400 }
      );
    }
    if (receiverId === userId) {
      return NextResponse.json(
        { error: '자기 자신에게는 보낼 수 없어요.' },
        { status: 400 }
      );
    }
    if (type !== undefined && typeof type !== 'string') {
      return NextResponse.json({ error: 'invalid type' }, { status: 400 });
    }
    const messageType = type || 'cheer';
    if (!VALID_MESSAGE_TYPES.has(messageType)) {
      return NextResponse.json({ error: 'invalid type' }, { status: 400 });
    }
    if (emoji !== undefined && (typeof emoji !== 'string' || emoji.length > 16)) {
      return NextResponse.json({ error: 'invalid emoji' }, { status: 400 });
    }

    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
    });
    if (!receiver) {
      return NextResponse.json({ error: '받는 사람을 찾을 수 없어요' }, { status: 404 });
    }

    // Validate boardId points at a board the sender can actually reference.
    let resolvedBoardId: string | null = null;
    if (boardId) {
      if (typeof boardId !== 'string') {
        return NextResponse.json({ error: 'invalid boardId' }, { status: 400 });
      }
      const board = await prisma.board.findFirst({
        where: {
          id: boardId,
          OR: [
            { ownerId: userId },
            { giftedToId: userId },
            { ownerId: receiverId },
            { giftedToId: receiverId },
          ],
        },
        select: { id: true },
      });
      if (!board) {
        return NextResponse.json(
          { error: '포도판을 찾을 수 없어요' },
          { status: 404 }
        );
      }
      resolvedBoardId = board.id;
    }

    const message = await prisma.message.create({
      data: {
        senderId: userId,
        receiverId,
        content,
        type: messageType,
        emoji: emoji || '🍇',
        boardId: resolvedBoardId,
      },
      include: {
        sender: {
          select: PUBLIC_USER_SELECT,
        },
      },
    });

    // Background OS notification (respects the receiver's NotificationSetting).
    // 보낸이가 고른 이모지를 본문 앞에 실어, 인앱 팝업(이모지+내용)과 표시를 일치시킨다(REQ4).
    const chosenEmoji = emoji || '🍇';
    const pushTitle =
      messageType === 'celebration' ? '🎉 축하 메시지'
      : messageType === 'gift' ? '🎁 선물이 도착했어요'
      : '💜 응원이 도착했어요';
    await sendPushToUser(
      receiverId,
      {
        title: pushTitle,
        body: `${chosenEmoji} ${message.sender.name}: ${content}`.slice(0, 120),
        url: '/messages',
        emoji: chosenEmoji,
      },
      messageType as 'cheer' | 'celebration' | 'gift'
    );

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error('Failed to send message:', error);
    return NextResponse.json(
      { error: '메시지를 보내지 못했어요. 잠시 후 다시 시도해주세요.' },
      { status: 500 }
    );
  }
}
