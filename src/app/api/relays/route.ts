import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';
import { PUBLIC_USER_SELECT as userProfileSelect } from '@/lib/userSelect';
import { validateRewards } from '@/lib/rewardValidation';

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
    mode: relay.mode,
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
  const { title, totalStickers = 10, friendIds, mode = 'relay', rewards, description = '', templateId } = body;

  if (!title || typeof title !== 'string' || !title.trim()) {
    return authResponse('제목을 입력해주세요', 400);
  }

  if (mode !== 'relay' && mode !== 'group') {
    return authResponse('잘못된 모드예요', 400);
  }

  if (!Number.isInteger(totalStickers) || totalStickers < 2 || totalStickers > 60) {
    return authResponse('포도알 개수는 2~60개 사이여야 합니다.', 400);
  }

  if (typeof description !== 'string' || description.length > 200) {
    return authResponse('설명은 200자 이하여야 합니다.', 400);
  }

  if (templateId !== undefined && templateId !== null && (typeof templateId !== 'string' || templateId.length > 64)) {
    return authResponse('잘못된 templateId 입니다.', 400);
  }

  const hasRewards = Array.isArray(rewards) && rewards.length > 0;
  if (hasRewards) {
    const rewardError = validateRewards(rewards, totalStickers);
    if (rewardError) return authResponse(rewardError, 400);
  }

  if (!friendIds || !Array.isArray(friendIds) || friendIds.length === 0) {
    return authResponse('친구를 한 명 이상 선택해주세요', 400);
  }

  if (friendIds.length > 20) {
    return authResponse('포도동은 최대 20명까지 초대할 수 있어요', 400);
  }

  // Verify all friendIds are valid users
  const friends = await prisma.user.findMany({
    where: { id: { in: friendIds } },
    select: { id: true },
  });

  if (friends.length !== friendIds.length) {
    return authResponse('존재하지 않는 사용자가 포함되어 있어요', 400);
  }

  // SECURITY: 초대 대상이 실제 요청자의 '수락된(accepted)' 친구인지 검증.
  const friendships = await prisma.friendship.findMany({
    where: {
      status: 'accepted',
      OR: [
        { requesterId: userId, receiverId: { in: friendIds } },
        { receiverId: userId, requesterId: { in: friendIds } },
      ],
    },
    select: { requesterId: true, receiverId: true },
  });
  const acceptedFriendIds = new Set(
    friendships.map((f) => (f.requesterId === userId ? f.receiverId : f.requesterId)),
  );
  if (friendIds.some((id: string) => !acceptedFriendIds.has(id))) {
    return authResponse('친구로 수락된 사용자만 초대할 수 있어요', 403);
  }

  const relay = await prisma.$transaction(async (tx) => {
    // Create relay
    const newRelay = await tx.relay.create({
      data: {
        title: title.trim(),
        totalStickers,
        creatorId: userId,
        status: 'active',
        mode,
        templateId: templateId || null,
      },
    });

    // Create a board for the creator (this board's rewards are the template joiners copy).
    const creatorBoard = await tx.board.create({
      data: {
        title: `${title.trim()} - 릴레이`,
        description: description || '',
        totalStickers,
        templateId: templateId || null,
        ownerId: userId,
      },
    });

    if (hasRewards) {
      for (const r of rewards) {
        await tx.reward.create({
          data: {
            boardId: creatorBoard.id,
            type: r.type,
            title: r.title,
            content: r.content,
            imageUrl: r.imageUrl || '',
            triggerAt: r.triggerAt,
          },
        });
      }
    }

    // Creator is first participant (order 0, active in both modes).
    await tx.relayParticipant.create({
      data: {
        relayId: newRelay.id,
        userId: userId,
        boardId: creatorBoard.id,
        order: 0,
        status: 'active',
      },
    });

    // Friends: relay → pending(차례 대기), group → active(즉시 시작). boardId는 join 때 생성/연결.
    for (let i = 0; i < friendIds.length; i++) {
      await tx.relayParticipant.create({
        data: {
          relayId: newRelay.id,
          userId: friendIds[i],
          order: i + 1,
          status: mode === 'group' ? 'active' : 'pending',
        },
      });
    }

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
    return authResponse('포도동 생성에 실패했어요', 500);
  }

  const result = {
    id: relay.id,
    title: relay.title,
    templateId: relay.templateId,
    totalStickers: relay.totalStickers,
    creatorId: relay.creatorId,
    creator: relay.creator,
    status: relay.status,
    mode: relay.mode,
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
