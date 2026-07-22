import type { PrismaClient } from '@prisma/client';
import { copy } from '@vercel/blob';
import { PUBLIC_USER_SELECT } from './userSelect';

/** 선물받은 포도판(giftedFromId != null)을 다시 선물하려 한 경우. 라우트가 400으로 매핑한다. */
export class RegiftBlockedError extends Error {
  readonly regiftBlocked = true;
  constructor() {
    super('선물받은 포도판은 다시 선물할 수 없어요');
    this.name = 'RegiftBlockedError';
  }
}

/** giftBoardCopy가 복사에 필요로 하는 원본 보드 형태 (라우트가 rewards 포함해 로드). */
export interface GiftSourceBoard {
  id: string;
  title: string;
  description: string;
  totalStickers: number;
  templateId: string | null;
  giftedFromId: string | null;
  /** 커스텀 알 사진 — 선물 복사본에도 딸려 보낸다(사용자 결정 A, 2026-07-10). null이면 기본 포도알. */
  customImageUrl: string | null;
  rewards: Array<{
    type: string;
    title: string;
    content: string;
    imageUrl: string;
    triggerAt: number;
  }>;
}

/** 선물 보드 응답이 필요로 하는 관계 — 복사 경로와 신규 command 경로가 공유한다. */
export const GIFT_BOARD_INCLUDE = {
  owner: { select: PUBLIC_USER_SELECT },
  giftedTo: { select: PUBLIC_USER_SELECT },
  giftedFrom: { select: PUBLIC_USER_SELECT },
  _count: { select: { stickers: true, rewards: true } },
} as const;

export interface GiftBoardInput {
  title: string;
  description: string;
  totalStickers: number;
  templateId: string | null;
  giftMessage: string;
  rewards: Array<{ type: string; title: string; content: string; triggerAt: number }>;
  /** 클라가 제출 1회당 하나를 만들어 재시도에도 같은 값을 보낸다. */
  idempotencyKey: string;
}

/**
 * "친구에게 줄 포도판을 새로 만든다"를 **하나의 트랜잭션**으로 수행한다 (감사 H-01).
 *
 * 예전 경로는 클라이언트가 3커밋 saga를 돌았다 — 내 보드 생성 → gift(복사본 생성) →
 * 내 보드 삭제. gift 실패는 발신자에게 고아 보드를 남기고, delete 실패는 삼킨 채
 * 성공 화면으로 이동했다. 멱등키가 없어 타임아웃·중복 제출에서 상태를 복구할 수도 없었다.
 *
 * 여기서는 발신자 임시 보드를 아예 만들지 않는다 — 받는 사람 소유의 보드를 곧바로 만든다.
 * 중복은 Board @@unique([giftedFromId, giftIdempotencyKey])가 DB에서 막는다(라우트가 P2002를
 * 잡아 기존 결과를 돌려준다). 진행 리듬(cadence)은 선물 보드 FREE 고정 정책에 따라 넘기지
 * 않는다 — 받는 사람에게 원치 않는 제약을 물려주지 않는다는 기존 결정.
 */
export async function createGiftBoardForFriend(
  prisma: PrismaClient,
  senderId: string,
  friendId: string,
  input: GiftBoardInput,
) {
  return prisma.$transaction(async (tx) => {
    const board = await tx.board.create({
      data: {
        title: input.title,
        description: input.description,
        totalStickers: input.totalStickers,
        templateId: input.templateId,
        ownerId: friendId,
        giftedToId: friendId,
        giftedFromId: senderId,
        giftMessage: input.giftMessage,
        giftIdempotencyKey: input.idempotencyKey,
      },
    });

    if (input.rewards.length > 0) {
      await tx.reward.createMany({
        data: input.rewards.map((r) => ({
          boardId: board.id,
          type: r.type,
          title: r.title,
          content: r.content,
          triggerAt: r.triggerAt,
        })),
      });
    }

    return tx.board.findUnique({ where: { id: board.id }, include: GIFT_BOARD_INCLUDE });
  });
}

// 포도판 선물의 핵심 트랜잭션. 라우트(boards/[id]/gift)와 통합테스트가 동일 로직을
// 공유하도록 추출 — fillBoard.ts와 같은 선례. 권한(owner)·친구·self 검증과 인박스
// 메시지/푸시 부수효과는 HTTP 관심사라 라우트에 남긴다.
//
// 동작: 받는 친구 소유의 새 보드 복사본을 만들고(giftedToId/giftedFromId/giftMessage),
// 보상을 전부 복사한다. 보상의 unlockedAt/revealedAt은 복사하지 않으므로 복사본에서는
// 항상 잠김 상태로 시작한다(비밀 유지 — 원본에서 이미 열렸어도 받는 사람에겐 새 보상).
//
// 재선물 차단: 선물받은 복사본(giftedFromId != null)을 또 선물하면 RegiftBlockedError.
// (원본 보드를 서로 다른 친구에게 여러 번 선물하는 것은 복사 모델상 의도된 동작 — 허용.)
export async function giftBoardCopy(
  prisma: PrismaClient,
  board: GiftSourceBoard,
  senderId: string,
  friendId: string,
  giftNote: string,
) {
  if (board.giftedFromId !== null) {
    throw new RegiftBlockedError();
  }

  // 커스텀 알 사진은 별도 blob으로 **복제**한다(URL 공유 아님) — 원본 소유자가 나중에
  // 사진을 교체/삭제하면 그 URL이 del되는데, 공유했다면 친구 복사본까지 깨진다.
  // 독립 blob이라 원본 수명과 무관. 트랜잭션 밖에서(외부 I/O가 DB 잠금을 잡지 않게).
  // 복제 실패해도 선물 자체는 진행한다 — 사진만 빠진 기본 포도알로 degrade.
  let copiedImageUrl: string | null = null;
  if (board.customImageUrl) {
    try {
      const copied = await copy(board.customImageUrl, 'boards/gift/custom-image', {
        access: 'public',
        addRandomSuffix: true,
      });
      copiedImageUrl = copied.url;
    } catch {
      // BLOB 토큰 없음/원본 삭제됨 등 — 사진 없이 선물 진행(부분 성공 허용).
    }
  }

  return prisma.$transaction(async (tx) => {
    const newBoard = await tx.board.create({
      data: {
        title: board.title,
        description: board.description,
        totalStickers: board.totalStickers,
        // templateId도 함께 복사한다 — 없으면 받은 보드는 완성해도 와이너리에서 품종 포일이
        // 라임 폴백으로 떨어지고(WineBottle) stats 카테고리 분해에서도 '기타'로 잡혔다.
        // cadence는 의도적으로 미복사(선물 보드 FREE 고정 — create 페이지의 이중 방어와 동일 결정).
        templateId: board.templateId,
        ownerId: friendId,
        giftedToId: friendId,
        giftedFromId: senderId,
        giftMessage: giftNote,
        customImageUrl: copiedImageUrl,
      },
    });

    // Copy all rewards (unlockedAt/revealedAt은 의도적으로 미복사 → 잠김으로 초기화)
    for (const reward of board.rewards) {
      await tx.reward.create({
        data: {
          boardId: newBoard.id,
          type: reward.type,
          title: reward.title,
          content: reward.content,
          imageUrl: reward.imageUrl,
          triggerAt: reward.triggerAt,
        },
      });
    }

    return tx.board.findUnique({ where: { id: newBoard.id }, include: GIFT_BOARD_INCLUDE });
  });
}
