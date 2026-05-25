import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';

const userProfileSelect = {
  id: true,
  name: true,
  email: true,
  avatar: true,
};

export async function GET(
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
      creator: { select: userProfileSelect },
      participants: {
        include: {
          user: { select: userProfileSelect },
          board: {
            select: {
              id: true,
              title: true,
              totalStickers: true,
              isCompleted: true,
              completedAt: true,
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

  // Auth check: must be creator or participant
  const isParticipant = relay.participants.some((p) => p.userId === userId);
  if (relay.creatorId !== userId && !isParticipant) {
    return authResponse('접근 권한이 없어요', 403);
  }

  const result = {
    id: relay.id,
    title: relay.title,
    templateId: relay.templateId,
    totalStickers: relay.totalStickers,
    creatorId: relay.creatorId,
    creator: relay.creator,
    status: relay.status,
    participants: relay.participants.map((p) => ({
      id: p.id,
      userId: p.userId,
      user: p.user,
      boardId: p.boardId,
      order: p.order,
      status: p.status,
      board: p.board
        ? {
            id: p.board.id,
            title: p.board.title,
            totalStickers: p.board.totalStickers,
            filledCount: p.board._count.stickers,
            isCompleted: p.board.isCompleted,
            completedAt: p.board.completedAt,
          }
        : null,
    })),
    createdAt: relay.createdAt.toISOString(),
  };

  return Response.json({ relay: result });
}
