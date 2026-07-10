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

    return tx.board.findUnique({
      where: { id: newBoard.id },
      include: {
        owner: { select: PUBLIC_USER_SELECT },
        giftedTo: { select: PUBLIC_USER_SELECT },
        giftedFrom: { select: PUBLIC_USER_SELECT },
        _count: { select: { stickers: true, rewards: true } },
      },
    });
  });
}
