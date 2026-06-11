import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';
import { fillBoardGrape, isSerializationConflict, PositionTakenError } from '@/lib/fillBoard';

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

  // 채우기 트랜잭션은 src/lib/fillBoard.ts로 추출(통합테스트와 로직 공유). Serializable +
  // 재시도로 마지막 칸 동시 채움 race를 처리한다. 같은 칸 동시 채움은 PositionTakenError → 409.
  try {
    const result = await fillBoardGrape(prisma, board, position, userId);
    return Response.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof PositionTakenError) return authResponse('이미 채워진 칸이에요', 409);
    // 재시도(백오프 포함) 소진 — 극단적 동시 채움. 일시 오류로 해요체 안내.
    // (클라 배너가 "— 잠시 후 다시 시도해주세요."를 덧붙이므로 여기선 원인만.)
    if (isSerializationConflict(e)) {
      return authResponse('포도알 채우기가 한꺼번에 몰렸어요', 503);
    }
    throw e;
  }
}
