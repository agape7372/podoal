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

  const relay = await prisma.relay.findUnique({
    where: { id },
    include: {
      participants: {
        include: {
          board: {
            select: {
              id: true,
              isCompleted: true,
              _count: { select: { stickers: true } },
            },
          },
        },
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!relay) {
    return authResponse('릴레이를 찾을 수 없어요', 404);
  }

  if (relay.status === 'completed') {
    return authResponse('이미 완료된 릴레이예요', 400);
  }

  // Find current user's participant entry
  const currentParticipant = relay.participants.find(
    (p) => p.userId === userId && p.status === 'active'
  );

  if (!currentParticipant) {
    return authResponse('현재 당신의 차례가 아니에요', 400);
  }

  // Check that their board is completed
  if (!currentParticipant.board || !currentParticipant.board.isCompleted) {
    return authResponse('포도판을 먼저 완성해주세요', 400);
  }

  // Find the next participant in order
  const nextParticipant = relay.participants.find(
    (p) => p.order === currentParticipant.order + 1
  );

  await prisma.$transaction(async (tx) => {
    // Set current participant to completed
    await tx.relayParticipant.update({
      where: { id: currentParticipant.id },
      data: { status: 'completed' },
    });

    if (nextParticipant) {
      // Set next participant to active
      await tx.relayParticipant.update({
        where: { id: nextParticipant.id },
        data: { status: 'active' },
      });
    }

    // Check if all participants are now completed
    // (current is being set to completed, and there's no next participant)
    if (!nextParticipant) {
      await tx.relay.update({
        where: { id: relay.id },
        data: { status: 'completed' },
      });
    }
  });

  return Response.json({
    message: nextParticipant
      ? '바통을 넘겼어요! 다음 참가자의 차례예요.'
      : '릴레이가 완료되었어요! 모두 수고했어요!',
    relayCompleted: !nextParticipant,
  });
}
