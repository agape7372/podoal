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

  const relays = await prisma.relay.findMany({
    where: {
      OR: [
        { creatorId: userId },
        { participants: { some: { userId } } },
      ],
    },
    include: {
      creator: { select: userProfileSelect },
      participants: {
        include: {
          user: { select: userProfileSelect },
        },
        orderBy: { order: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const result = relays.map((relay) => ({
    id: relay.id,
    title: relay.title,
    templateId: relay.templateId,
    totalStickers: relay.totalStickers,
    creatorId: relay.creatorId,
    creator: relay.creator,
    status: relay.status,
    participants: relay.participants.map((p) => ({
      id: p.id,
      userId: p.userId,
      user: p.user,
      boardId: p.boardId,
      order: p.order,
      status: p.status,
    })),
    createdAt: relay.createdAt.toISOString(),
  }));

  return Response.json({ relays: result });
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return authResponse('Unauthorized');
  }

  const body = await request.json();
  const { title, totalStickers = 10, friendIds } = body;

  if (!title || typeof title !== 'string' || !title.trim()) {
    return authResponse('제목을 입력해주세요', 400);
  }

  if (!friendIds || !Array.isArray(friendIds) || friendIds.length === 0) {
    return authResponse('친구를 한 명 이상 선택해주세요', 400);
  }

  // Verify all friendIds are valid users
  const friends = await prisma.user.findMany({
    where: { id: { in: friendIds } },
    select: { id: true },
  });

  if (friends.length !== friendIds.length) {
    return authResponse('존재하지 않는 사용자가 포함되어 있어요', 400);
  }

  const relay = await prisma.$transaction(async (tx) => {
    // Create relay
    const newRelay = await tx.relay.create({
      data: {
        title: title.trim(),
        totalStickers,
        creatorId: userId,
        status: 'active',
      },
    });

    // Create a board for the creator
    const creatorBoard = await tx.board.create({
      data: {
        title: `${title.trim()} - 릴레이`,
        description: '',
        totalStickers,
        ownerId: userId,
      },
    });

    // Add creator as first participant (order 0, active)
    await tx.relayParticipant.create({
      data: {
        relayId: newRelay.id,
        userId: userId,
        boardId: creatorBoard.id,
        order: 0,
        status: 'active',
      },
    });

    // Add friends as participants (order 1, 2, ..., pending)
    for (let i = 0; i < friendIds.length; i++) {
      await tx.relayParticipant.create({
        data: {
          relayId: newRelay.id,
          userId: friendIds[i],
          order: i + 1,
          status: 'pending',
        },
      });
    }

    // Return the full relay with participants
    return tx.relay.findUnique({
      where: { id: newRelay.id },
      include: {
        creator: { select: userProfileSelect },
        participants: {
          include: {
            user: { select: userProfileSelect },
          },
          orderBy: { order: 'asc' },
        },
      },
    });
  });

  if (!relay) {
    return authResponse('릴레이 생성에 실패했어요', 500);
  }

  const result = {
    id: relay.id,
    title: relay.title,
    templateId: relay.templateId,
    totalStickers: relay.totalStickers,
    creatorId: relay.creatorId,
    creator: relay.creator,
    status: relay.status,
    participants: relay.participants.map((p) => ({
      id: p.id,
      userId: p.userId,
      user: p.user,
      boardId: p.boardId,
      order: p.order,
      status: p.status,
    })),
    createdAt: relay.createdAt.toISOString(),
  };

  return Response.json({ relay: result }, { status: 201 });
}
