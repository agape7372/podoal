import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';

// 포도동 초대 수락(REQ10) — invited 참가자가 수락하면 group→active, relay→pending으로 전환.
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  const { id } = params;
  const relay = await prisma.relay.findUnique({ where: { id }, select: { id: true, mode: true } });
  if (!relay) return authResponse('포도동을 찾을 수 없어요', 404);

  const participant = await prisma.relayParticipant.findFirst({ where: { relayId: id, userId } });
  if (!participant) return authResponse('초대받지 않은 포도동이에요', 403);
  if (participant.status !== 'invited') return authResponse('이미 처리된 초대예요', 400);

  const status = relay.mode === 'group' ? 'active' : 'pending';
  await prisma.relayParticipant.update({ where: { id: participant.id }, data: { status } });

  return Response.json({ ok: true, status });
}
