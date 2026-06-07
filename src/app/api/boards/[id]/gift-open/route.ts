import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';

// Mark a gifted board as "unwrapped" by its recipient (drives the one-time
// gift reveal/unbox moment on the board page).
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  const { id } = params;
  const board = await prisma.board.findUnique({
    where: { id },
    select: { giftedToId: true, giftOpenedAt: true },
  });

  if (!board) return authResponse('Board not found', 404);
  if (board.giftedToId !== userId) return authResponse('Not a gift recipient', 403);

  if (!board.giftOpenedAt) {
    await prisma.board.update({ where: { id }, data: { giftOpenedAt: new Date() } });
  }

  return NextResponse.json({ ok: true });
}
