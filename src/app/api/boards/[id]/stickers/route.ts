import { prisma } from '@/lib/prisma';
import { PUBLIC_USER_SELECT } from '@/lib/userSelect';
import { getCurrentUserId, authResponse } from '@/lib/auth';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return authResponse('Unauthorized');
  }

  const { id: boardId } = params;
  const body = await request.json();
  const { position } = body;

  if (position === undefined || position === null) {
    return authResponse('Missing required field: position', 400);
  }

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: {
      id: true,
      totalStickers: true,
      isCompleted: true,
      ownerId: true,
      giftedToId: true,
    },
  });

  if (!board) {
    return authResponse('Board not found', 404);
  }

  // Ownership check: only the owner (which includes the receiver of a gifted board
  // after transfer, and the participant who created their own relay board) may fill.
  if (board.ownerId !== userId && board.giftedToId !== userId) {
    return authResponse('Forbidden', 403);
  }

  if (board.isCompleted) {
    return authResponse('Board is already completed', 400);
  }

  // Validate position range
  if (position < 0 || position >= board.totalStickers) {
    return authResponse(
      `Invalid position. Must be between 0 and ${board.totalStickers - 1}`,
      400
    );
  }

  // Check if the position is already filled
  const existingSticker = await prisma.sticker.findUnique({
    where: {
      boardId_position: {
        boardId,
        position,
      },
    },
  });

  if (existingSticker) {
    return authResponse('This position is already filled', 409);
  }

  // Create the sticker and check for board completion in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const sticker = await tx.sticker.create({
      data: {
        boardId,
        position,
        filledBy: userId,
      },
      include: {
        filler: {
          select: PUBLIC_USER_SELECT,
        },
      },
    });

    // Count total filled stickers for this board
    const filledCount = await tx.sticker.count({
      where: { boardId },
    });

    // If all positions are filled, mark the board as completed
    let relayAdvanced = false;
    if (filledCount >= board.totalStickers) {
      await tx.board.update({
        where: { id: boardId },
        data: {
          isCompleted: true,
          completedAt: new Date(),
        },
      });

      // 포도동 자동 진행 — 이 보드가 진행중 포도동의 참가자 보드라면 같은 tx에서 처리.
      // (이전엔 /pass 수동 버튼만 있어서 "다 채워도 다음 주자에게 안 넘어가는" 버그)
      const participant = await tx.relayParticipant.findFirst({
        where: { boardId },
        include: { relay: { select: { id: true, status: true, mode: true } } },
      });
      if (participant && participant.relay.status === 'active') {
        if (participant.relay.mode === 'relay' && participant.status === 'active') {
          // 릴레이(순차): 현재→완료, 다음(order+1)→진행, 없으면 포도동 완료.
          await tx.relayParticipant.update({ where: { id: participant.id }, data: { status: 'completed' } });
          const next = await tx.relayParticipant.findFirst({
            where: { relayId: participant.relayId, order: participant.order + 1 },
          });
          if (next) {
            await tx.relayParticipant.update({ where: { id: next.id }, data: { status: 'active' } });
          } else {
            await tx.relay.update({ where: { id: participant.relayId }, data: { status: 'completed' } });
          }
          relayAdvanced = true;
        } else if (participant.relay.mode === 'group') {
          // 그룹(병렬): 바통 없음. 내 참가자만 완료 처리, 전원 완료면 포도동 완료.
          if (participant.status !== 'completed') {
            await tx.relayParticipant.update({ where: { id: participant.id }, data: { status: 'completed' } });
          }
          const remaining = await tx.relayParticipant.count({
            where: { relayId: participant.relayId, status: { not: 'completed' } },
          });
          if (remaining === 0) {
            await tx.relay.update({ where: { id: participant.relayId }, data: { status: 'completed' } });
          }
          relayAdvanced = true;
        }
      }
    }

    // Atomic single-shot reward unlock: try to claim every reward whose
    // triggerAt has now been reached AND that hasn't been unlocked yet.
    // updateMany returns the count of rows actually updated, so concurrent
    // requests that race past the same threshold won't double-fire.
    const claim = await tx.reward.updateMany({
      where: {
        boardId,
        triggerAt: { lte: filledCount },
        unlockedAt: null,
      },
      data: { unlockedAt: new Date() },
    });

    let unlockedReward: {
      id: string;
      type: string;
      title: string;
      triggerAt: number;
    } | null = null;
    if (claim.count > 0) {
      // Surface the highest triggerAt reward we just unlocked (typically the
      // one matching this fill). Content/imageUrl stay hidden until the user
      // taps to reveal — see /reveal route.
      const justUnlocked = await tx.reward.findFirst({
        where: {
          boardId,
          triggerAt: { lte: filledCount },
          unlockedAt: { not: null },
          revealedAt: null,
        },
        orderBy: { triggerAt: 'desc' },
      });
      if (justUnlocked) {
        unlockedReward = {
          id: justUnlocked.id,
          type: justUnlocked.type,
          title: justUnlocked.title,
          triggerAt: justUnlocked.triggerAt,
        };
      }
    }

    // Friend-planted surprises hidden on THIS grape. Overlap is allowed, so a
    // single grape may carry several — claim them ALL single-shot and let the
    // client reveal them in sequence. Notify each planter (other than the
    // filler) that their surprise was discovered.
    type GiftOut = { id: string; message: string; emoji: string; plantedBy: { id: string; name: string; avatar: string } };
    let plantedGifts: GiftOut[] = [];
    const pendingGifts = await tx.plantedGift.findMany({
      where: { boardId, position, revealedAt: null },
      include: { plantedBy: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'asc' },
    });
    if (pendingGifts.length > 0) {
      await tx.plantedGift.updateMany({
        where: { boardId, position, revealedAt: null },
        data: { revealedAt: new Date() },
      });
      plantedGifts = pendingGifts.map((pg) => ({
        id: pg.id, message: pg.message, emoji: pg.emoji, plantedBy: pg.plantedBy,
      }));
      for (const pg of pendingGifts) {
        if (pg.plantedById !== userId) {
          await tx.message.create({
            data: {
              senderId: userId,
              receiverId: pg.plantedById,
              boardId,
              type: 'celebration',
              emoji: '🎁',
              content: `${sticker.filler.name}님이 숨겨둔 선물을 발견했어요!`,
            },
          });
        }
      }
    }

    return {
      sticker,
      filledCount,
      isCompleted: filledCount >= board.totalStickers,
      unlockedReward,
      plantedGift: plantedGifts[0] ?? null, // back-compat: first gift
      plantedGifts,
      relayAdvanced,
    };
  });

  return Response.json(result, { status: 201 });
}
