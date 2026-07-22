import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';
import { participantStatusForMode } from '@/lib/relay';

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
  // accept·pass와 같은 게이트 — 끝난 포도동에 새로 보드를 붙이면 completed 릴레이에
  // 진행중 참가자가 생긴다.
  if (relay.status !== 'active') {
    return authResponse('이미 끝난 포도동이에요', 400);
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
      // 선검사는 사용자에게 정확한 문구를 주기 위한 것이고, 실제 강제는 아래 update가
      // 걸리는 RelayParticipant.boardId 유니크 제약이 한다. 이 검사만으로는 두 포도동이
      // 동시에 read-then-write 하는 경쟁을 막지 못한다(검사와 쓰기 사이에 창이 있다).
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

    // boardId 연결. 정상 흐름은 accept가 이미 invited→active/pending으로 올려둬 status를
    // 건드리지 않는다(바통 불변식 유지). 단 accept 응답 전에 join이 도달한 경쟁에서 status가
    // 'invited'로 남으면 참가자 현황이 '미수락'으로 오도되므로, 그 잔류분만 방어적으로 끌어올린다.
    const updated = await tx.relayParticipant.update({
      where: { id: participant.id },
      data: {
        boardId,
        ...(fresh.status === 'invited' ? { status: participantStatusForMode(relay.mode) } : {}),
      },
    });
    return { participantId: updated.id, boardId };
  }).catch((err: Error) => {
    // 유니크 위반(P2002 on boardId) = 위 선검사를 통과한 뒤 다른 포도동이 먼저 붙은 경쟁.
    // 사용자에게는 선검사와 같은 문구를 준다.
    if ((err as { code?: string }).code === 'P2002') return 'BOARD_IN_USE';
    return err.message;
  });

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
