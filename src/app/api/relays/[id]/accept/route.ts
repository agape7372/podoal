import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';
import { participantStatusForMode } from '@/lib/relay';

// 포도동 초대 수락(REQ10) — invited 참가자가 수락하면 group→active, relay→pending으로 전환.
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  const { id } = params;
  const relay = await prisma.relay.findUnique({
    where: { id },
    select: { id: true, mode: true, status: true },
  });
  if (!relay) return authResponse('포도동을 찾을 수 없어요', 404);
  // 완료된 포도동의 초대를 수락하면 completed 릴레이에 active/pending 참가자가 생기고,
  // 이어서 join으로 보드까지 붙을 수 있다(상태기계 붕괴). pass 라우트는 이미 같은 게이트를 둔다.
  if (relay.status !== 'active') return authResponse('이미 끝난 포도동이에요', 400);

  const participant = await prisma.relayParticipant.findFirst({ where: { relayId: id, userId } });
  if (!participant) return authResponse('초대받지 않은 포도동이에요', 403);
  if (participant.status !== 'invited') return authResponse('이미 처리된 초대예요', 400);

  // join 가드와 같은 매핑을 쓴다 — 예전에는 여기만 삼항으로 재구현해 두 곳이 갈릴 수 있었다.
  const status = participantStatusForMode(relay.mode);
  await prisma.relayParticipant.update({ where: { id: participant.id }, data: { status } });

  return Response.json({ ok: true, status });
}
