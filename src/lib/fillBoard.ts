import type { PrismaClient } from '@prisma/client';
import { PUBLIC_USER_SELECT } from './userSelect';
import { advanceRelayOnBoardComplete } from './relay';

/** 동시에 같은 칸을 채우려 해 unique 충돌(P2002)이 난 경우. 라우트가 409로 매핑한다. */
export class PositionTakenError extends Error {
  readonly positionTaken = true;
  constructor() {
    super('이미 채워진 칸이에요');
    this.name = 'PositionTakenError';
  }
}

// Serializable 직렬화 충돌 식별 — Prisma 7(드라이버 어댑터)에서 두 형태로 갈라진다:
// 쿼리 실행 중 충돌은 종전처럼 P2034로 매핑되지만, 커밋 시점 실패(read/write 의존
// 사이클은 커밋에서야 발견되는 경우가 흔함)는 transaction-manager가 P2034 매핑 없이
// cause 체인(kind=TransactionWriteConflict / SQLSTATE 40001)으로 던진다(7.8.0 실측).
// 둘 다 잡아야 재시도가 동작하므로 cause/meta.driverAdapterError 체인을 걷는다.
export function isSerializationConflict(e: unknown): boolean {
  const seen = new Set<object>();
  let cur: unknown = e;
  while (cur && typeof cur === 'object' && !seen.has(cur as object)) {
    seen.add(cur as object);
    const c = cur as {
      code?: string;
      kind?: string;
      originalCode?: string;
      cause?: unknown;
      meta?: { driverAdapterError?: unknown };
    };
    if (c.code === 'P2034' || c.kind === 'TransactionWriteConflict' || c.originalCode === '40001') {
      return true;
    }
    cur = c.cause ?? c.meta?.driverAdapterError;
  }
  return false;
}

// 포도알 채우기의 핵심 트랜잭션. 라우트(boards/[id]/stickers)와 통합테스트가 동일 로직을
// 공유하도록 추출 — 두 곳이 드리프트하지 않게 함.
//
// Serializable + 제한적 재시도: 마지막 칸을 두 요청이 동시에 채우면 둘 다 filledCount=N-1로
// 관측해 보드 완료·완성보상이 영구 누락될 수 있다(이후 모든 칸이 차 재시도도 409). Serializable
// 에선 count() 읽기가 충돌(P2034)해 한쪽이 재시도하고, 상대 커밋을 본 뒤 정확히 완료 처리한다.
// (plant-gift와 동일 격리 패턴.) 같은 칸 동시 채움(P2002)은 PositionTakenError로 변환.

// P2034 재시도 정책: 8회 + 지수 백오프(25ms 기준 ×2) + ±50% 지터.
// 즉시 재시도(백오프 0)는 동시 요청들이 같은 박자로 다시 충돌해 재시도를 소진시켰다
// (프로덕션 연타 유실 + CI flake의 원인). 지터로 충돌 군집을 흩는다.
const P2034_MAX_RETRIES = 8;
const BACKOFF_BASE_MS = 25;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export async function fillBoardGrape(
  prisma: PrismaClient,
  board: { id: string; totalStickers: number },
  position: number,
  userId: string,
) {
  const boardId = board.id;
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
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
          content: string;
          imageUrl: string;
        } | null = null;
        if (claim.count > 0) {
          // Surface the highest triggerAt reward we just unlocked (typically the
          // one matching this fill). content/imageUrl도 함께 싣는다 — 중간 보상
          // 팝업이 비트에 맞춰 이미 열려 있는데, 이 응답이 서버가 내용을 아는
          // 가장 이른 순간이라 여기 안 실으면 클라가 reveal 왕복을 한 번 더
          // 기다려야 하고(무한로딩 체감의 주범), reveal 실패 시 스켈레톤에
          // 갇혔다. 이 라우트는 owner/giftedTo 전용이라 프라이버시 문제 없음.
          // revealedAt 영속화는 여전히 /reveal 라우트 몫(비차단 백그라운드).
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
              content: justUnlocked.content,
              imageUrl: justUnlocked.imageUrl,
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
                  // 위치 포함(W2-A): 심은 사람이 어느 알이었는지 잊어도 이 메시지로 복기 가능.
                  content: `${sticker.filler.name}님이 ${position + 1}번째 알에 숨겨둔 선물을 발견했어요!`,
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
    } catch (e) {
      const code = (e as { code?: string }).code;
      // Same-position race: the other request already created this sticker.
      if (code === 'P2002') throw new PositionTakenError();
      // Serializable write conflict (concurrent fill on the same board) → retry
      // with exponential backoff + jitter (server code — Math.random OK here).
      if (isSerializationConflict(e) && attempt < P2034_MAX_RETRIES) {
        await sleep(BACKOFF_BASE_MS * 2 ** attempt * (0.5 + Math.random()));
        continue;
      }
      throw e;
    }
  }
}
