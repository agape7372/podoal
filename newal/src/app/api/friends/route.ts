import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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
          select: { id: true, name: true, email: true, avatar: true },
        },
        receiver: {
          select: { id: true, name: true, email: true, avatar: true },
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
          select: { id: true, name: true, email: true, avatar: true },
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
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { email },
    });

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
          select: { id: true, name: true, email: true, avatar: true },
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
