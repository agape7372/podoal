import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';
import { reevaluateRelayCompletion } from '@/lib/relay';

// 포도동 초대 거절(REQ10) — invited 참가자 행을 제거해 참여 목록에서 빠진다.
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  const { id } = params;
  const participant = await prisma.relayParticipant.findFirst({ where: { relayId: id, userId } });
  if (!participant) return authResponse('초대받지 않은 포도동이에요', 403);
  if (participant.status !== 'invited') return authResponse('이미 처리된 초대예요', 400);

  // 삭제와 완료 재평가를 한 트랜잭션에. 마지막 남은 미완료 참가자가 이 초대였다면
  // 거절 순간 포도동은 끝난 것이다 — 예전에는 재평가가 없어 남은 전원이 completed인데도
  // 포도동이 영구 active로 남았다(특히 group 모드).
  const relayCompleted = await prisma.$transaction(async (tx) => {
    await tx.relayParticipant.delete({ where: { id: participant.id } });
    return reevaluateRelayCompletion(tx, id);
  });

  return Response.json({ ok: true, relayCompleted });
}
