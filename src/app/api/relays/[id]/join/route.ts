import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return authResponse('Unauthorized');
  }

  const { id } = params;

  // Find the relay
  const relay = await prisma.relay.findUnique({
    where: { id },
    include: {
      participants: {
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!relay) {
    return authResponse('릴레이를 찾을 수 없어요', 404);
  }

  // Find the participant entry for the current user
  const participant = relay.participants.find((p) => p.userId === userId);

  if (!participant) {
    return authResponse('이 릴레이에 초대되지 않았어요', 403);
  }

  if (participant.boardId) {
    return authResponse('이미 참여한 릴레이예요', 400);
  }

  // Create a board for this participant and link it
  const result = await prisma.$transaction(async (tx) => {
    const board = await tx.board.create({
      data: {
        title: `${relay.title} - 릴레이`,
        description: '',
        totalStickers: relay.totalStickers,
        ownerId: userId,
      },
    });

    const updated = await tx.relayParticipant.update({
      where: { id: participant.id },
      data: {
        boardId: board.id,
        status: 'pending',
      },
    });

    return { participant: updated, board };
  });

  return Response.json({
    message: '릴레이에 참여했어요!',
    participantId: result.participant.id,
    boardId: result.board.id,
  });
}
