import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';
import { isSerializationConflict } from '@/lib/fillBoard';

// A friend hides a surprise gift on a specific (still-unfilled) grape of the
// owner's board. Revealed when the owner fills that grape (see stickers route).
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  const { id: boardId } = params;
  const body = await request.json().catch(() => null);
  if (body === null) return authResponse('잘못된 요청이에요.', 400);
  const position = body?.position;
  const message = typeof body?.message === 'string' ? body.message.trim().slice(0, 200) : '';
  const emoji = typeof body?.emoji === 'string' && body.emoji.length <= 16 ? body.emoji : '🎁';

  if (!Number.isInteger(position)) return authResponse('invalid position', 400);

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { id: true, ownerId: true, totalStickers: true, isCompleted: true, allowFriendPlant: true, _count: { select: { stickers: true } } },
  });
  if (!board) return authResponse('Board not found', 404);

  // Authorize BEFORE leaking board state. The owner can't plant on their own
  // board; everyone else must be an accepted friend. Doing this first means a
  // non-friend gets a uniform 403 and can't probe isCompleted/allowFriendPlant
  // via differing error messages (matches the GET route's uniform 403).
  if (board.ownerId === userId) return authResponse('내 포도판에는 심을 수 없어요', 400);
  const friendship = await prisma.friendship.findFirst({
    where: {
      status: 'accepted',
      OR: [
        { requesterId: userId, receiverId: board.ownerId },
        { requesterId: board.ownerId, receiverId: userId },
      ],
    },
  });
  if (!friendship) return authResponse('친구만 선물을 심을 수 있어요', 403);

  // State checks — only reachable by an authorized friend now.
  if (board.isCompleted) return authResponse('이미 완성된 포도판이에요', 400);
  if (!board.allowFriendPlant) return authResponse('이 포도판은 깜짝 선물 받기를 꺼두었어요', 403);

  const filledCount = board._count.stickers;
  if (position < filledCount || position >= board.totalStickers) {
    return authResponse('아직 채우지 않은 칸에만 심을 수 있어요', 400);
  }

  // Overlap is allowed — surprises stack on a grape and reveal in sequence when
  // it's filled. We only stop the SAME planter from double-stacking one grape,
  // and soft-cap 3 active per planter. Run the check-then-create in a Serializable
  // transaction so two near-simultaneous requests can't both pass the dup/cap
  // guard and over-insert (the guards are otherwise a classic non-atomic race).
  const plantError = (msg: string, status: number) => Object.assign(new Error(msg), { status });
  try {
    await prisma.$transaction(
      async (tx) => {
        const dup = await tx.plantedGift.findFirst({ where: { boardId, position, plantedById: userId, revealedAt: null } });
        if (dup) throw plantError('그 칸엔 이미 선물을 심었어요', 409);
        const mine = await tx.plantedGift.count({ where: { boardId, plantedById: userId, revealedAt: null } });
        if (mine >= 3) throw plantError('이 포도판엔 최대 3개까지 심을 수 있어요', 400);
        await tx.plantedGift.create({ data: { boardId, position, plantedById: userId, message, emoji } });
      },
      { isolationLevel: 'Serializable' },
    );
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (typeof status === 'number') return authResponse((e as Error).message, status);
    // Serializable write conflict (concurrent plant on the same board) → dup.
    if (isSerializationConflict(e)) return authResponse('그 칸엔 이미 선물을 심었어요', 409);
    throw e;
  }

  // Teaser to the owner (no location) — motivates filling, keeps the surprise.
  try {
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    await prisma.message.create({
      data: {
        senderId: userId,
        receiverId: board.ownerId,
        boardId,
        type: 'gift',
        emoji: '🎁',
        content: `${me?.name ?? '친구'}님이 포도판에 깜짝 선물을 숨겼어요! 채우다 보면 나와요 🎁`,
      },
    });
  } catch {
    // teaser is best-effort
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
