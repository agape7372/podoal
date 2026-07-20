import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PUBLIC_USER_SELECT } from '@/lib/userSelect';
import { getCurrentUserId, authResponse } from '@/lib/auth';

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  try {
    // 두 쿼리는 상호 독립 → 병렬(순차 2왕복이던 것을 1왕복 폭으로) — 응답 계약 불변.
    const [acceptedFriendships, pendingRequests] = await Promise.all([
      prisma.friendship.findMany({
        where: {
          status: 'accepted',
          OR: [
            { requesterId: userId },
            { receiverId: userId },
          ],
        },
        include: {
          requester: {
            select: PUBLIC_USER_SELECT,
          },
          receiver: {
            select: PUBLIC_USER_SELECT,
          },
        },
      }),
      prisma.friendship.findMany({
        where: {
          receiverId: userId,
          status: 'pending',
        },
        include: {
          requester: {
            select: PUBLIC_USER_SELECT,
          },
        },
      }),
    ]);

    const friends = acceptedFriendships.map((friendship) => {
      const friend =
        friendship.requesterId === userId
          ? friendship.receiver
          : friendship.requester;
      return {
        id: friendship.id,
        isFavorite: friendship.isFavorite,
        status: friendship.status as 'accepted',
        createdAt: friendship.createdAt,
        user: friend,
      };
    });

    const pending = pendingRequests.map((friendship) => ({
      id: friendship.id,
      status: 'pending' as const,
      isFavorite: false,
      createdAt: friendship.createdAt,
      user: friendship.requester,
    }));

    return NextResponse.json({ friends, pendingRequests: pending });
  } catch (error) {
    console.error('Failed to fetch friends:', error);
    return NextResponse.json(
      { error: '친구 목록을 불러오지 못했어요' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  try {
    const { email, targetId } = await request.json();

    // 닉네임 검색 결과는 id를 들고 있어 targetId로 바로 요청한다. email 경로도 보존(non-breaking).
    let targetUser;
    if (targetId) {
      targetUser = await prisma.user.findUnique({ where: { id: targetId } });
    } else if (email) {
      targetUser = await prisma.user.findUnique({ where: { email } });
    } else {
      return NextResponse.json(
        { error: 'Email or targetId is required' },
        { status: 400 }
      );
    }

    if (!targetUser) {
      return NextResponse.json(
        { error: '해당 사용자를 찾을 수 없어요' },
        { status: 404 }
      );
    }

    if (targetUser.id === userId) {
      return NextResponse.json(
        { error: '나에게는 친구 요청을 보낼 수 없어요' },
        { status: 400 }
      );
    }

    const existingFriendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: userId, receiverId: targetUser.id },
          { requesterId: targetUser.id, receiverId: userId },
        ],
      },
    });

    if (existingFriendship) {
      return NextResponse.json(
        { error: '이미 친구이거나 요청을 보냈어요' },
        { status: 409 }
      );
    }

    const friendship = await prisma.friendship.create({
      data: {
        requesterId: userId,
        receiverId: targetUser.id,
        status: 'pending',
      },
      include: {
        receiver: {
          select: PUBLIC_USER_SELECT,
        },
      },
    });

    return NextResponse.json(friendship, { status: 201 });
  } catch (error) {
    console.error('Failed to send friend request:', error);
    return NextResponse.json(
      { error: '친구 요청에 실패했어요. 잠시 후 다시 시도해주세요.' },
      { status: 500 }
    );
  }
}
