import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  try {
    const { id } = params;

    const message = await prisma.message.findUnique({
      where: { id },
    });

    if (!message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    if (message.receiverId !== userId) {
      return NextResponse.json(
        { error: 'Not authorized to mark this message as read' },
        { status: 403 }
      );
    }

    const updated = await prisma.message.update({
      where: { id },
      data: { isRead: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to mark message as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark message as read' },
      { status: 500 }
    );
  }
}

// non-breaking 추가: 수신자 본인 메시지 삭제. PATCH의 인증/소유권/응답 패턴을 그대로 따른다.
export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  try {
    const { id } = params;

    const message = await prisma.message.findUnique({
      where: { id },
    });

    if (!message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    if (message.receiverId !== userId) {
      return NextResponse.json(
        { error: 'Not authorized to delete this message' },
        { status: 403 }
      );
    }

    await prisma.message.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete message:', error);
    return NextResponse.json(
      { error: 'Failed to delete message' },
      { status: 500 }
    );
  }
}
