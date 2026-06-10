import { prisma } from '@/lib/prisma';
import { PUBLIC_USER_SELECT } from '@/lib/userSelect';
import { getCurrentUserId, authResponse } from '@/lib/auth';
import { advanceRelayOnBoardComplete } from '@/lib/relay';

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
    return authResponse('칸 정보가 없어요', 400);
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
    return authResponse('포도판을 찾을 수 없어요', 404);
  }

  // Ownership check: only the owner (which includes the receiver of a gifted board
  // after transfer, and the participant who created their own relay board) may fill.
  if (board.ownerId !== userId && board.giftedToId !== userId) {
    return authResponse('내 포도판만 채울 수 있어요', 403);
  }

  if (board.isCompleted) {
    return authResponse('이미 완성된 포도판이에요', 400);
  }

  // Validate position range
  if (position < 0 || position >= board.totalStickers) {
    return authResponse('잘못된 칸이에요', 400);
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
    return authResponse('이미 채워진 칸이에요', 409);
  }

  // Create the sticker and check for board completion. Serializable + bounded retry:
  // two requests racing to fill the LAST grape would otherwise both observe
  // filledCount = N-1 and skip completion + 완성보상 forever (unrecoverable, since
  // every grape is then filled and re-tries 409). Under Serializable the count()
  // reads conflict (P2034); the loser retries, sees the committed sticker, and
  // completes correctly. Same isolation pattern as plant-gift. P2002 = two requests
  // on the SAME position → that grape is already filled.
  for (let attempt = 0; ; attempt++) {
    try {
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
          // (이전엔 /pass 수동 버튼만 있어서 "다 채워도 다음 주자에게 안 넘어가는" 버그였고,
          //  자동 진행이 status를 무시한 채 order+1만 찾아 거절/미수락 시 조기 완료되던 버그도 있었음.)
          // 자동·수동(/pass)이 동일 규칙을 쓰도록 advanceRelayOnBoardComplete로 단일화.
          const participant = await tx.relayParticipant.findFirst({
            where: { boardId },
            include: { relay: { select: { id: true, status: true, mode: true } } },
          });
          if (
            participant &&
            participant.relay.status === 'active' &&
            participant.status === 'active'
          ) {
            await advanceRelayOnBoardComplete(
              tx,
              { id: participant.relayId, mode: participant.relay.mode },
              participant
            );
            relayAdvanced = true;
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
      }, { isolationLevel: 'Serializable' });

      return Response.json(result, { status: 201 });
    } catch (e) {
      const code = (e as { code?: string }).code;
      // Same-position race: the other request already created this sticker.
      if (code === 'P2002') return authResponse('이미 채워진 칸이에요', 409);
      // Serializable write conflict (concurrent fill on the same board) → retry.
      if (code === 'P2034' && attempt < 4) continue;
      throw e;
    }
  }
}
