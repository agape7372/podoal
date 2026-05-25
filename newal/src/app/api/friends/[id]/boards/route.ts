import { NextResponse } from 'next/server';
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
  if (!userId) return authResponse('Unauthorized');

  try {
    const { id: friendUserId } = params;

    // Verify accepted friendship exists between current user and this friend
    const friendship = await prisma.friendship.findFirst({
      where: {
        status: 'accepted',
        OR: [
          { requesterId: userId, receiverId: friendUserId },
          { requesterId: friendUserId, receiverId: userId },
        ],
      },
    });

    if (!friendship) {
      return NextResponse.json(
        { error: '친구 관계가 아닙니다' },
        { status: 403 }
      );
    }

    // Fetch friend's user profile
    const friendUser = await prisma.user.findUnique({
      where: { id: friendUserId },
      select: userProfileSelect,
    });

    if (!friendUser) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // Fetch friend's boards (owned or gifted to them)
    const boards = await prisma.board.findMany({
      where: {
        OR: [
          { ownerId: friendUserId },
          { giftedToId: friendUserId },
        ],
      },
      include: {
        owner: { select: userProfileSelect },
        giftedTo: { select: userProfileSelect },
        giftedFrom: { select: userProfileSelect },
        _count: { select: { stickers: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = boards.map((board) => ({
      id: board.id,
      title: board.title,
      description: board.description,
      totalStickers: board.totalStickers,
      filledCount: board._count.stickers,
      isCompleted: board.isCompleted,
      completedAt: board.completedAt,
      createdAt: board.createdAt,
      owner: board.owner,
      giftedTo: board.giftedTo,
      giftedFrom: board.giftedFrom,
      rewardCount: 0,
    }));

    return NextResponse.json({
      friend: friendUser,
      boards: result,
      friendship: {
        id: friendship.id,
        isFavorite: friendship.isFavorite,
      },
    });
  } catch (error) {
    console.error('Failed to fetch friend boards:', error);
    return NextResponse.json(
      { error: '친구의 포도판을 불러오는데 실패했습니다' },
      { status: 500 }
    );
  }
}
