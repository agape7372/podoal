import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  try {
    const { id } = params;
    const { action } = await request.json();

    const friendship = await prisma.friendship.findUnique({
      where: { id },
    });

    if (!friendship) {
      return NextResponse.json(
        { error: 'Friendship not found' },
        { status: 404 }
      );
    }

    if (action === 'accept') {
      if (friendship.receiverId !== userId) {
        return NextResponse.json(
          { error: 'Only the receiver can accept a friend request' },
          { status: 403 }
        );
      }

      if (friendship.status !== 'pending') {
        return NextResponse.json(
          { error: 'Friend request is not pending' },
          { status: 400 }
        );
      }

      const updated = await prisma.friendship.update({
        where: { id },
        data: { status: 'accepted' },
        include: {
          requester: {
            select: { id: true, name: true, email: true, avatar: true },
          },
          receiver: {
            select: { id: true, name: true, email: true, avatar: true },
          },
        },
      });

      return NextResponse.json(updated);
    }

    if (action === 'favorite') {
      if (friendship.requesterId !== userId && friendship.receiverId !== userId) {
        return NextResponse.json(
          { error: 'Not authorized to modify this friendship' },
          { status: 403 }
        );
      }

      const updated = await prisma.friendship.update({
        where: { id },
        data: { isFavorite: !friendship.isFavorite },
        include: {
          requester: {
            select: { id: true, name: true, email: true, avatar: true },
          },
          receiver: {
            select: { id: true, name: true, email: true, avatar: true },
          },
        },
      });

      return NextResponse.json(updated);
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "accept" or "favorite"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Failed to update friendship:', error);
    return NextResponse.json(
      { error: 'Failed to update friendship' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  try {
    const { id } = params;

    const friendship = await prisma.friendship.findUnique({
      where: { id },
    });

    if (!friendship) {
      return NextResponse.json(
        { error: 'Friendship not found' },
        { status: 404 }
      );
    }

    if (friendship.requesterId !== userId && friendship.receiverId !== userId) {
      return NextResponse.json(
        { error: 'Not authorized to delete this friendship' },
        { status: 403 }
      );
    }

    await prisma.friendship.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Friendship removed' });
  } catch (error) {
    console.error('Failed to delete friendship:', error);
    return NextResponse.json(
      { error: 'Failed to delete friendship' },
      { status: 500 }
    );
  }
}
