import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PUBLIC_USER_SELECT } from '@/lib/userSelect';
import { getCurrentUserId, authResponse } from '@/lib/auth';

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  try {
    const acceptedFriendships = await prisma.friendship.findMany({
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
    });

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

    const pendingRequests = await prisma.friendship.findMany({
      where: {
        receiverId: userId,
        status: 'pending',
      },
      include: {
        requester: {
          select: PUBLIC_USER_SELECT,
        },
      },
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
      { error: 'Failed to fetch friends' },
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
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (targetUser.id === userId) {
      return NextResponse.json(
        { error: 'Cannot send friend request to yourself' },
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
        { error: 'Friendship already exists' },
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
      { error: 'Failed to send friend request' },
      { status: 500 }
    );
  }
}
