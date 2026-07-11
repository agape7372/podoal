import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';

const VALID_REMINDER_TYPES = new Set(['time', 'ripe']);

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  const { id } = params;

  const existing = await prisma.reminder.findUnique({ where: { id } });
  if (!existing) return authResponse('Reminder not found', 404);
  if (existing.userId !== userId) return authResponse('Forbidden', 403);

  const body = await request.json();

  const allowedKeys = ['time', 'days', 'boardId', 'message', 'isActive', 'type'];
  const updateData: Record<string, unknown> = {};

  for (const key of allowedKeys) {
    if (key in body) {
      updateData[key] = body[key];
    }
  }

  // Validate time if provided
  if (updateData.time !== undefined) {
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (typeof updateData.time !== 'string' || !timeRegex.test(updateData.time)) {
      return authResponse('Invalid time format. Use HH:mm (e.g. 09:00)', 400);
    }
  }

  // Validate days if provided
  if (updateData.days !== undefined) {
    const daysRegex = /^[1-7](,[1-7])*$/;
    if (typeof updateData.days !== 'string' || !daysRegex.test(updateData.days)) {
      return authResponse('Invalid days format. Use comma-separated 1-7 (e.g. 1,2,3,4,5)', 400);
    }
  }

  // 알림 방식(C4-c additive) — 화이트리스트 외 값은 400.
  if (updateData.type !== undefined) {
    if (typeof updateData.type !== 'string' || !VALID_REMINDER_TYPES.has(updateData.type)) {
      return authResponse('type은 time 또는 ripe여야 해요', 400);
    }
  }

  // Validate boardId if provided
  let validatedBoard: { id: string; cadenceType: string | null } | null = null;
  if (updateData.boardId) {
    const board = await prisma.board.findFirst({
      where: {
        id: updateData.boardId as string,
        OR: [{ ownerId: userId }, { giftedToId: userId }],
      },
      select: { id: true, cadenceType: true },
    });
    if (!board) {
      return authResponse('Board not found or unauthorized', 404);
    }
    validatedBoard = board;
  }

  // ripe는 boardId 필수 + 채우는 리듬(cadence) 보드 전용 — PUT은 부분 갱신이라 effective
  // type/boardId(갱신값 우선, 없으면 기존값)로 조합을 확인한다.
  const effectiveType = (updateData.type as string | undefined) ?? existing.type;
  const effectiveBoardId =
    'boardId' in updateData ? (updateData.boardId as string | null) : existing.boardId;
  if (effectiveType === 'ripe') {
    if (!effectiveBoardId) {
      return authResponse('익으면 알림은 보드 지정이 필요해요', 400);
    }
    const board =
      validatedBoard ??
      (await prisma.board.findFirst({
        where: { id: effectiveBoardId, OR: [{ ownerId: userId }, { giftedToId: userId }] },
        select: { id: true, cadenceType: true },
      }));
    if (!board) {
      return authResponse('Board not found or unauthorized', 404);
    }
    if (!board.cadenceType || board.cadenceType === 'FREE') {
      return authResponse('채우는 리듬이 설정된 보드만 익으면 알림을 쓸 수 있어요', 400);
    }
  }

  if (Object.keys(updateData).length === 0) {
    return authResponse('No valid fields to update', 400);
  }

  const reminder = await prisma.reminder.update({
    where: { id },
    data: updateData,
    include: {
      board: { select: { id: true, title: true } },
    },
  });

  return Response.json({
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
  });
}

export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  const { id } = params;

  const existing = await prisma.reminder.findUnique({ where: { id } });
  if (!existing) return authResponse('Reminder not found', 404);
  if (existing.userId !== userId) return authResponse('Forbidden', 403);

  await prisma.reminder.delete({ where: { id } });

  return Response.json({ success: true });
}
