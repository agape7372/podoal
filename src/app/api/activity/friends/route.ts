import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';
import { PUBLIC_USER_SELECT } from '@/lib/userSelect';

// 친구 활동 홈 피드: accepted 친구가 '소유한' 보드 중 최근 7일 내 완성된 것만.
// friends/[id]/boards와 동일한 프라이버시 기준 — ownerId 기준이라 선물 체인의
// 제3자 정보(giftedTo/giftedFrom)는 조회 자체에 포함되지 않는다.
const ACTIVITY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const ACTIVITY_TAKE = 15;

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  try {
    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'accepted',
        OR: [{ requesterId: userId }, { receiverId: userId }],
      },
      select: { requesterId: true, receiverId: true },
    });

    const friendIds = friendships.map((f) =>
      f.requesterId === userId ? f.receiverId : f.requesterId
    );

    if (friendIds.length === 0) {
      return NextResponse.json({ activities: [] });
    }

    // 쿼리 2개로 끝(친구 목록 + in 절 보드 조회) — N+1 금지.
    const boards = await prisma.board.findMany({
      where: {
        ownerId: { in: friendIds },
        completedAt: { gte: new Date(Date.now() - ACTIVITY_WINDOW_MS) },
      },
      select: {
        id: true,
        title: true,
        totalStickers: true,
        completedAt: true,
        owner: { select: PUBLIC_USER_SELECT },
      },
      orderBy: { completedAt: 'desc' },
      take: ACTIVITY_TAKE,
    });

    const activities = boards.map((b) => ({
      boardId: b.id,
      title: b.title,
      totalStickers: b.totalStickers,
      completedAt: b.completedAt,
      actor: b.owner,
    }));

    return NextResponse.json({ activities });
  } catch (error) {
    console.error('Failed to fetch friend activity:', error);
    return NextResponse.json(
      { error: '친구 소식을 불러오지 못했어요' },
      { status: 500 }
    );
  }
}
