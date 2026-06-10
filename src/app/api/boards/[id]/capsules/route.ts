import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';
import { isNonEmptyString, isOptString, isPlainObject } from '@/lib/validate';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return authResponse('Unauthorized');
  }

  const { id: boardId } = params;

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: {
      ownerId: true,
      giftedToId: true,
    },
  });

  if (!board) {
    return authResponse('포도판을 찾을 수 없어요', 404);
  }

  // 캡슐은 봉인된 개인 메시지 — 보드 소유자(선물받아 소유권이 넘어온 사람 포함)만 열람.
  // 이전엔 '선물한 사람'(giftedFromId)도 열람 가능해, A가 B에게 선물한 보드에 B가 만든
  // 캡슐을 A가 개봉일 전에 읽는 교차사용자 누수가 있었음 — board GET과 동일 권한으로 통일.
  if (board.ownerId !== userId && board.giftedToId !== userId) {
    return authResponse('권한이 없어요', 403);
  }

  const capsules = await prisma.timeCapsule.findMany({
    where: { boardId },
    orderBy: { openAt: 'asc' },
  });

  return Response.json({ capsules });
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return authResponse('Unauthorized');
  }

  const { id: boardId } = params;

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { ownerId: true },
  });

  if (!board) {
    return authResponse('Board not found', 404);
  }

  if (board.ownerId !== userId) {
    return authResponse('Only the board owner can create capsules', 403);
  }

  const body = await request.json().catch(() => null);
  if (!isPlainObject(body)) {
    return authResponse('잘못된 요청이에요', 400);
  }
  const { message, emoji, openAt } = body;

  // 타입/길이 검증 — 비문자열 message가 그대로 들어가 Prisma 500이 나던 것을 400으로.
  if (!isNonEmptyString(message, 1000)) {
    return authResponse('메시지를 입력해주세요 (최대 1000자)', 400);
  }
  if (!isOptString(emoji, 16)) {
    return authResponse('잘못된 이모지예요', 400);
  }
  if (!isNonEmptyString(openAt)) {
    return authResponse('개봉일을 선택해주세요', 400);
  }

  // <input type=date>는 'YYYY-MM-DD'. 이를 그대로 new Date()하면 UTC 자정 = KST 09:00에
  // 개봉되는 버그가 있었음. 선택한 날짜의 KST 자정(00:00 +09:00)으로 해석해 그 날 0시에 열리게 한다.
  const dateOnly = typeof openAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(openAt);
  const openAtDate = dateOnly ? new Date(`${openAt}T00:00:00+09:00`) : new Date(openAt);
  if (isNaN(openAtDate.getTime())) {
    return authResponse('Invalid openAt date', 400);
  }

  // 미래여야 함(이미 KST 자정 인스턴트라 오늘 선택 시 now보다 과거 → 거부, 내일+ 만 통과).
  if (openAtDate.getTime() <= Date.now()) {
    return authResponse('openAt must be a future date', 400);
  }

  const capsule = await prisma.timeCapsule.create({
    data: {
      boardId,
      userId,
      message,
      emoji: emoji || '🍇',
      openAt: openAtDate,
    },
  });

  return Response.json({ capsule }, { status: 201 });
}
