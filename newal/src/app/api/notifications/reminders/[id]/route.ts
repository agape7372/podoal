import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  const { id } = params;

  const existing = await prisma.reminder.findUnique({ where: { id } });
  if (!existing) return authResponse('Reminder not found', 404);
  if (existing.userId !== userId) return authResponse('Forbidden', 403);

  const body = await request.json();

  const allowedKeys = ['time', 'days', 'boardId', 'message', 'isActive'];
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

  // Validate boardId if provided
  if (updateData.boardId) {
    const board = await prisma.board.findFirst({
      where: {
        id: updateData.boardId as string,
        OR: [{ ownerId: userId }, { giftedToId: userId }],
      },
    });
    if (!board) {
      return authResponse('Board not found or unauthorized', 404);
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
      time: reminder.time,
      days: reminder.days,
      message: reminder.message,
      isActive: reminder.isActive,
    },
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  const { id } = params;

  const existing = await prisma.reminder.findUnique({ where: { id } });
  if (!existing) return authResponse('Reminder not found', 404);
  if (existing.userId !== userId) return authResponse('Forbidden', 403);

  await prisma.reminder.delete({ where: { id } });

  return Response.json({ success: true });
}
