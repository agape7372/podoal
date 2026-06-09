import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return authResponse('Unauthorized');
  }

  const { id } = params;
  const body = await request.json().catch(() => ({}));
  const attachBoardId: unknown = body?.boardId;

  const relay = await prisma.relay.findUnique({
    where: { id },
    include: { participants: { orderBy: { order: 'asc' } } },
  });
  if (!relay) {
    return authResponse('포도동을 찾을 수 없어요', 404);
  }

  const participant = relay.participants.find((p) => p.userId === userId);
  if (!participant) {
    return authResponse('이 포도동에 초대되지 않았어요', 403);
  }
  if (participant.boardId) {
    return authResponse('이미 참여한 포도동이에요', 400);
  }

  // "기존 포도판 불러오기"는 그룹 모드에서만. 릴레이 모드는 항상 새 보드 생성.
  const wantsAttach = relay.mode === 'group' && typeof attachBoardId === 'string' && attachBoardId.length > 0;
  // 보상 템플릿: 생성자(order 0) 보드의 보상을 새 보드에 복제(연결 보드엔 복제 안 함).
  const creatorBoardId = relay.participants.find((p) => p.order === 0)?.boardId ?? null;

  const result = await prisma.$transaction(async (tx) => {
    const fresh = await tx.relayParticipant.findUnique({ where: { id: participant.id } });
    if (!fresh) throw new Error('PARTICIPANT_GONE');
    if (fresh.boardId) throw new Error('ALREADY_JOINED');

    let boardId: string;

    if (wantsAttach) {
      const target = await tx.board.findUnique({
        where: { id: attachBoardId as string },
        select: { id: true, ownerId: true, isCompleted: true },
      });
      if (!target) throw new Error('BOARD_NOT_FOUND');
      if (target.ownerId !== userId) throw new Error('BOARD_FORBIDDEN');
      if (target.isCompleted) throw new Error('BOARD_COMPLETED');
      const inUse = await tx.relayParticipant.findFirst({
        where: { boardId: target.id, NOT: { id: participant.id } },
        select: { id: true },
      });
      if (inUse) throw new Error('BOARD_IN_USE');
      boardId = target.id;
    } else {
      const board = await tx.board.create({
        data: {
          title: `${relay.title} - 릴레이`,
          description: '',
          totalStickers: relay.totalStickers,
          ownerId: userId,
        },
      });
      if (creatorBoardId) {
        const templateRewards = await tx.reward.findMany({ where: { boardId: creatorBoardId } });
        for (const r of templateRewards) {
          await tx.reward.create({
            data: {
              boardId: board.id,
              type: r.type,
              title: r.title,
              content: r.content,
              imageUrl: r.imageUrl,
              triggerAt: r.triggerAt,
            },
          });
        }
      }
      boardId = board.id;
    }

    // boardId만 연결 — status는 건드리지 않는다(릴레이 바통 불변식 유지, 그룹은 이미 active).
    const updated = await tx.relayParticipant.update({
      where: { id: participant.id },
      data: { boardId },
    });
    return { participantId: updated.id, boardId };
  }).catch((err: Error) => err.message);

  if (typeof result === 'string') {
    switch (result) {
      case 'ALREADY_JOINED': return authResponse('이미 참여한 포도동이에요', 400);
      case 'PARTICIPANT_GONE': return authResponse('참가자 정보가 사라졌어요', 404);
      case 'BOARD_NOT_FOUND': return authResponse('포도판을 찾을 수 없어요', 404);
      case 'BOARD_FORBIDDEN': return authResponse('본인 포도판만 불러올 수 있어요', 403);
      case 'BOARD_COMPLETED': return authResponse('완성된 포도판은 불러올 수 없어요', 400);
      case 'BOARD_IN_USE': return authResponse('이미 다른 포도동에 사용 중인 포도판이에요', 400);
      default: throw new Error(result);
    }
  }

  return Response.json({
    message: '포도동에 참여했어요!',
    participantId: result.participantId,
    boardId: result.boardId,
  });
}
