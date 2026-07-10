import type { PrismaClient } from '@prisma/client';
import { PUBLIC_USER_SELECT } from './userSelect';
import { advanceRelayOnBoardComplete } from './relay';
import { computeFillPace, computeBackfillEligibility } from './pace';

/** 동시에 같은 칸을 채우려 해 unique 충돌(P2002)이 난 경우. 라우트가 409로 매핑한다. */
export class PositionTakenError extends Error {
  readonly positionTaken = true;
  constructor() {
    super('이미 채워진 칸이에요');
    this.name = 'PositionTakenError';
  }
}

/** 엄격 모드(strictMode) 보드에서 익지 않은 채움 시도 — 라우트가 422로 매핑한다(FILL_CADENCE §8).
 *  소프트 모드는 절대 이 에러를 내지 않는다(200 + earlyFill 기록). */
export class StrictPaceError extends Error {
  readonly strictPace = true;
  constructor() {
    super('아직 익는 중이에요. 다 익으면 채울 수 있어요.');
    this.name = 'StrictPaceError';
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
  // 채움 텀(FILL_CADENCE §8): C1 = 소프트 오버라이드 클라 플래그 기록. C2 = pace 컨텍스트가
  // 오면 서버 판정(트랜잭션 내 키 비교) — 소프트는 200 + earlyFill 기록(클라 플래그 OR 서버
  // 판정), strictMode만 StrictPaceError(라우트 422). additive optional이라 기존 호출
  // (통합테스트 포함) 무영향 — pace 미전달 = 판정 없음(FREE와 동일).
  opts?: {
    earlyFill?: boolean;
    /** C3 보충 채우기(§5) — 클라가 "어제 몫 채우기"를 선택. 서버가 자격을 재판정해
     *  충족 시에만 isBackfill 기록·전날 귀속. 미충족이면 일반 채움으로 관대하게 수용
     *  (절대 막지 않음 — 아너 시스템). pace 미전달(FREE)이면 무시. */
    backfill?: boolean;
    pace?: {
      cadenceType: string;
      cadenceN: number | null;
      strictMode: boolean;
      timezone: string;
      dayResetHour: number;
      /** 보드 생성 시각 — backfill 자격 조건 4(어제 존재했던 보드만). 미전달=관대 통과. */
      createdAt?: Date;
    };
  },
) {
  const boardId = board.id;
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        // 채움 텀 서버 판정(C2) — 스티커 생성 "전"의 기간 내 채움 수로 익음을 판정한다.
        // Serializable이라 동시 채움도 정확히 센다(한쪽이 재시도하며 상대 커밋을 본다).
        let paceState: 'ripe' | 'early' | 'backfill' | undefined;
        let serverEarly = false;
        let serverBackfill = false;
        if (opts?.pace) {
          const existing = await tx.sticker.findMany({
            where: { boardId },
            select: { filledAt: true, isBackfill: true },
          });
          const now = new Date();
          // C3 보충(§5): 클라 요청 + 서버 자격 재판정. 자격 충족이면 이 채움은 "어제 몫" —
          // 오늘 quota를 잠식하지 않고(귀속이 전날) strict 검사도 건너뛴다(보충은 관대 장치).
          if (opts.backfill) {
            const bf = computeBackfillEligibility(
              { ...opts.pace, createdAt: opts.pace.createdAt ?? null },
              existing,
              now,
              opts.pace.timezone,
              opts.pace.dayResetHour,
            );
            if (bf?.eligible) {
              serverBackfill = true;
              paceState = 'backfill';
            }
          }
          if (!serverBackfill) {
            const pace = computeFillPace(
              opts.pace,
              existing,
              now,
              opts.pace.timezone,
              opts.pace.dayResetHour,
            );
            if (pace) {
              if (!pace.ripe && opts.pace.strictMode) throw new StrictPaceError();
              serverEarly = !pace.ripe;
              paceState = pace.ripe ? 'ripe' : 'early';
            }
          }
        }

        const sticker = await tx.sticker.create({
          data: {
            boardId,
            position,
            filledBy: userId,
            // 아너 시스템: 클라가 자진 신고했거나(오버라이드 시트) 서버가 판정했거나 —
            // 어느 쪽이든 기록만 하고 막지 않는다(소프트 모드).
            earlyFill: opts?.earlyFill === true || serverEarly,
            // C3: 서버 자격 판정을 통과한 보충만 기록 — 통계·스트릭·텀 판정이 전날로 귀속한다.
            isBackfill: serverBackfill,
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
          // 채움 텀 C2(additive): FREE·pace 미전달이면 undefined — JSON 직렬화에서
          // 필드 자체가 빠져 기존 클라 무영향.
          paceState,
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
