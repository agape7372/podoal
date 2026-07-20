import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';
import {
  fillBoardGrape,
  fillBoardGrapeBatch,
  normalizeBatchPositions,
  isSerializationConflict,
  PositionTakenError,
  StrictPaceError,
} from '@/lib/fillBoard';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return authResponse('Unauthorized');
  }

  const { id: boardId } = params;
  const body = await request.json().catch(() => null);
  if (body === null) return authResponse('잘못된 요청이에요.', 400);

  // 배치 채움(additive, 2026-07-20): {positions:number[]} — 홈 라이브 채움이 연속
  // 여러 칸을 왕복 1번에 영속하기 위한 분기. {position} 단건 경로는 아래 기존 코드
  // 그대로(회귀 0 계약). 배치 호출은 FREE 보드 전용이 클라 계약이지만, 서버는
  // cadence 보드가 와도 단건과 동일한 텀 판정을 적용한다(fillBoardGrapeBatch 주석).
  if (body && typeof body === 'object' && 'positions' in body) {
    return fillBatch(boardId, userId, (body as { positions: unknown }).positions);
  }

  const { position } = body;
  // 채움 텀 C1: "그래도 채우기" 소프트 오버라이드 플래그(FILL_CADENCE §8) — 정확히
  // true일 때만 기록(그 외 타입은 방어적으로 false 취급). 채움 자체는 200 정상 경로.
  const earlyFill = body.earlyFill === true;
  // 채움 텀 C3: "어제 몫 채우기" 보충 플래그(§5) — 자격은 서버가 재판정(fillBoard).
  const backfill = body.backfill === true;

  if (position === undefined || position === null) {
    return authResponse('칸 정보가 없어요', 400);
  }

  if (!Number.isInteger(position)) {
    return authResponse('잘못된 칸이에요', 400);
  }

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: {
      id: true,
      totalStickers: true,
      isCompleted: true,
      ownerId: true,
      giftedToId: true,
      // 채움 텀 C2: 서버 판정 컨텍스트(FILL_CADENCE §8). 경계는 보드 주인의 시간대 기준.
      cadenceType: true,
      cadenceN: true,
      strictMode: true,
      createdAt: true, // C3 backfill 자격 조건 4(어제 존재했던 보드만)
      owner: { select: { timezone: true, dayResetHour: true } },
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

  // 채우기 트랜잭션은 src/lib/fillBoard.ts로 추출(통합테스트와 로직 공유). Serializable +
  // 재시도로 마지막 칸 동시 채움 race를 처리한다. 같은 칸 동시 채움은 PositionTakenError → 409.
  try {
    const result = await fillBoardGrape(prisma, board, position, userId, {
      earlyFill,
      backfill,
      // FREE(및 미인식)는 pace 자체를 안 넘겨 판정을 건너뛴다 — 회귀 0 계약.
      pace:
        board.cadenceType && board.cadenceType !== 'FREE'
          ? {
              cadenceType: board.cadenceType,
              cadenceN: board.cadenceN,
              strictMode: board.strictMode,
              timezone: board.owner.timezone,
              dayResetHour: board.owner.dayResetHour,
              createdAt: board.createdAt,
            }
          : undefined,
    });
    return Response.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof PositionTakenError) return authResponse('이미 채워진 칸이에요', 409);
    // 엄격 모드(옵트인) 방어선 — 클라가 선차단하므로 정상 UI에선 도달하지 않는다(FILL_CADENCE §8).
    if (e instanceof StrictPaceError) return authResponse(e.message, 422);
    // 재시도(백오프 포함) 소진 — 극단적 동시 채움. 일시 오류로 해요체 안내.
    // (클라 배너가 "— 잠시 후 다시 시도해주세요."를 덧붙이므로 여기선 원인만.)
    if (isSerializationConflict(e)) {
      return authResponse('포도알 채우기가 한꺼번에 몰렸어요', 503);
    }
    throw e;
  }
}

// 배치 채움 핸들러 — 단건 경로의 보드 조회·권한·범위 검사를 그대로 반복한다
// (공유 추출 대신 최소 중복: 단건 경로를 byte-identical하게 보존, PRINCIPLES §9).
// 이미 채워진 칸은 409가 아니라 관대 수용(dedup) — 배치의 목적이 화해(reconcile)라서.
async function fillBatch(boardId: string, userId: string, rawPositions: unknown) {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: {
      id: true,
      totalStickers: true,
      isCompleted: true,
      ownerId: true,
      giftedToId: true,
      cadenceType: true,
      cadenceN: true,
      strictMode: true,
      createdAt: true,
      owner: { select: { timezone: true, dayResetHour: true } },
    },
  });

  if (!board) {
    return authResponse('포도판을 찾을 수 없어요', 404);
  }

  if (board.ownerId !== userId && board.giftedToId !== userId) {
    return authResponse('내 포도판만 채울 수 있어요', 403);
  }

  if (board.isCompleted) {
    return authResponse('이미 완성된 포도판이에요', 400);
  }

  // 배열·비어있지 않음·길이 캡(60)·전 원소 정수·범위 검사 + 페이로드 내 중복 제거.
  const positions = normalizeBatchPositions(rawPositions, board.totalStickers);
  if (positions === null) {
    return authResponse('잘못된 칸이에요', 400);
  }

  try {
    const result = await fillBoardGrapeBatch(prisma, board, positions, userId, {
      // FREE(및 미인식)는 pace 자체를 안 넘겨 판정을 건너뛴다 — 단건과 동일 계약.
      pace:
        board.cadenceType && board.cadenceType !== 'FREE'
          ? {
              cadenceType: board.cadenceType,
              cadenceN: board.cadenceN,
              strictMode: board.strictMode,
              timezone: board.owner.timezone,
              dayResetHour: board.owner.dayResetHour,
              createdAt: board.createdAt,
            }
          : undefined,
    });
    return Response.json(result, { status: 201 });
  } catch (e) {
    // 단건과 동일 에러 매핑(skipDuplicates로 P2002는 정상 경로에선 미도달 — 방어선).
    if (e instanceof PositionTakenError) return authResponse('이미 채워진 칸이에요', 409);
    if (e instanceof StrictPaceError) return authResponse(e.message, 422);
    if (isSerializationConflict(e)) {
      return authResponse('포도알 채우기가 한꺼번에 몰렸어요', 503);
    }
    throw e;
  }
}
