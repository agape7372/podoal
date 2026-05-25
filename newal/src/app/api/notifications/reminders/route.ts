import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  const reminders = await prisma.reminder.findMany({
    where: { userId },
    include: {
      board: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const result = reminders.map((r) => ({
    id: r.id,
    boardId: r.boardId,
    boardTitle: r.board?.title ?? undefined,
    time: r.time,
    days: r.days,
    message: r.message,
    isActive: r.isActive,
  }));

  return Response.json({ reminders: result });
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  const body = await request.json();
  const { time, days, boardId, message } = body;

  if (!time || typeof time !== 'string') {
    return authResponse('time is required (format: HH:mm)', 400);
  }

  // Validate time format HH:mm
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!timeRegex.test(time)) {
    return authResponse('Invalid time format. Use HH:mm (e.g. 09:00)', 400);
  }

  // Validate days if provided
  if (days !== undefined) {
    const daysRegex = /^[1-7](,[1-7])*$/;
    if (typeof days !== 'string' || !daysRegex.test(days)) {
      return authResponse('Invalid days format. Use comma-separated 1-7 (e.g. 1,2,3,4,5)', 400);
    }
  }

  // Validate boardId if provided
  if (boardId) {
    const board = await prisma.board.findFirst({
      where: {
        id: boardId,
        OR: [{ ownerId: userId }, { giftedToId: userId }],
      },
    });
    if (!board) {
      return authResponse('Board not found or unauthorized', 404);
    }
  }

  const reminder = await prisma.reminder.create({
    data: {
      userId,
      time,
      days: days || '1,2,3,4,5,6,7',
      boardId: boardId || null,
      message: message || '',
    },
    include: {
      board: { select: { id: true, title: true } },
    },
  });

  return Response.json(
    {
      reminder: {
        id: reminder.id,
        boardId: reminder.boardId,
        boardTitle: reminder.board?.title ?? undefined,
        time: reminder.time,
        days: reminder.days,
        message: reminder.message,
        isActive: reminder.isActive,
      },
    },
    { status: 201 }
  );
}
