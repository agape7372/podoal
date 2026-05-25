import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
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

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
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

  const openAtDate = new Date(openAt);
  if (isNaN(openAtDate.getTime())) {
    return authResponse('Invalid openAt date', 400);
  }

  const now = new Date();
  // Compare dates only (not time) - openAt must be at least tomorrow
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const openAtStart = new Date(openAtDate.getFullYear(), openAtDate.getMonth(), openAtDate.getDate());
  if (openAtStart.getTime() <= todayStart.getTime()) {
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
