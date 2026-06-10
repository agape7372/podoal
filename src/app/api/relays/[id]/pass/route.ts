import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';
import { advanceRelayOnBoardComplete } from '@/lib/relay';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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

  // 자동 진행(stickers)과 동일한 단일 규칙으로 처리 — relay: 다음 '수락된(pending)' 참가자에게
  // 바통(미수락·거절 갭은 건너뜀), group: 본인만 완료 처리 후 전원 완료 시에만 포도동 완료.
  const result = await prisma.$transaction((tx) =>
    advanceRelayOnBoardComplete(tx, { id: relay.id, mode: relay.mode }, currentParticipant)
  );

  return Response.json({
    message: result.relayCompleted
      ? '릴레이가 완료되었어요! 모두 수고했어요!'
      : relay.mode === 'group'
        ? '포도판을 완성했어요! 다른 참가자를 기다려요.'
        : '바통을 넘겼어요! 다음 참가자의 차례예요.',
    relayCompleted: result.relayCompleted,
  });
}
