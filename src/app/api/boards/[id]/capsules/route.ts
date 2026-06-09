import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';

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
      giftedFromId: true,
    },
  });

  if (!board) {
    return authResponse('Board not found', 404);
  }

  // Only the board owner or the person who gifted the board can view capsules
  if (board.ownerId !== userId && board.giftedFromId !== userId) {
    return authResponse('Forbidden', 403);
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

  const body = await request.json();
  const { message, emoji, openAt } = body;

  if (!message || !openAt) {
    return authResponse('Missing required fields: message, openAt', 400);
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
