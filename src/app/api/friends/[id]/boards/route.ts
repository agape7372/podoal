import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';
import { PUBLIC_USER_SELECT as userProfileSelect } from '@/lib/userSelect';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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

    // 친구가 '소유한' 보드만 노출. 이전엔 `giftedToId` OR + giftedFrom/giftedTo 프로필까지
    // 포함해, 친구가 제3자에게서 선물받은 보드를 통해 무관한 제3자 이름/아바타·제목이 새어나갔음.
    const boards = await prisma.board.findMany({
      where: { ownerId: friendUserId },
      include: {
        owner: { select: userProfileSelect },
        _count: { select: { stickers: true, rewards: true } },
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
      allowFriendPlant: board.allowFriendPlant,
      rewardCount: board._count.rewards,
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
