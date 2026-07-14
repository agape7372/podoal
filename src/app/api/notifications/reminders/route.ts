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
    type: r.type,
    time: r.time,
    days: r.days,
    message: r.message,
    isActive: r.isActive,
  }));

  return Response.json({ reminders: result });
}

const VALID_REMINDER_TYPES = new Set(['time', 'ripe']);

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  const body = await request.json().catch(() => null);
  if (body === null) return authResponse('잘못된 요청이에요.', 400);
  const { time, days, boardId, message, type } = body;

  if (!time || typeof time !== 'string') {
    return authResponse('time is required (format: HH:mm)', 400);
  }

  // 알림 방식(C4-c additive) — 화이트리스트 외 값은 400. 미지정은 "time"(기존 동작).
  const resolvedType = type === undefined ? 'time' : type;
  if (typeof resolvedType !== 'string' || !VALID_REMINDER_TYPES.has(resolvedType)) {
    return authResponse('type은 time 또는 ripe여야 해요', 400);
  }
  if (resolvedType === 'ripe' && !boardId) {
    return authResponse('익으면 알림은 보드 지정이 필요해요', 400);
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

  // Validate message if provided
  if (message !== undefined && (typeof message !== 'string' || message.length > 200)) {
    return authResponse('메시지는 200자 이하여야 해요', 400);
  }

  // Validate boardId if provided
  if (boardId) {
    const board = await prisma.board.findFirst({
      where: {
        id: boardId,
        OR: [{ ownerId: userId }, { giftedToId: userId }],
      },
      select: { id: true, cadenceType: true },
    });
    if (!board) {
      return authResponse('Board not found or unauthorized', 404);
    }
    // ripe는 채우는 리듬(cadence)이 있는 보드만 — FREE 보드는 "익음" 개념이 없다.
    if (resolvedType === 'ripe' && (!board.cadenceType || board.cadenceType === 'FREE')) {
      return authResponse('채우는 리듬이 설정된 보드만 익으면 알림을 쓸 수 있어요', 400);
    }
  }

  // Check reminder count limit
  const count = await prisma.reminder.count({ where: { userId } });
  if (count >= 50) {
    return authResponse('리마인더는 최대 50개까지 만들 수 있어요', 400);
  }

  const reminder = await prisma.reminder.create({
    data: {
      userId,
      type: resolvedType,
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
        type: reminder.type,
        time: reminder.time,
        days: reminder.days,
        message: reminder.message,
        isActive: reminder.isActive,
      },
    },
    { status: 201 }
  );
}
