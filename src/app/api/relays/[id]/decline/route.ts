import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';

// 포도동 초대 거절(REQ10) — invited 참가자 행을 제거해 참여 목록에서 빠진다.
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  const { id } = params;
  const participant = await prisma.relayParticipant.findFirst({ where: { relayId: id, userId } });
  if (!participant) return authResponse('초대받지 않은 포도동이에요', 403);
  if (participant.status !== 'invited') return authResponse('이미 처리된 초대예요', 400);

  await prisma.relayParticipant.delete({ where: { id: participant.id } });

  return Response.json({ ok: true });
}
