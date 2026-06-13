import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';

// 수신자 본인의 미읽음 메시지를 한 번에 읽음 처리. 알림함(통합 피드) 진입 시
// 응원·축하·선물 메시지를 일괄 정리하기 위한 경로 — 카드별 PATCH의 updateMany 버전.
// (보상/친구요청/초대는 '처리'가 필요하므로 여기서 건드리지 않는다.)
export async function POST() {
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  try {
    const result = await prisma.message.updateMany({
      where: { receiverId: userId, isRead: false },
      data: { isRead: true },
    });
    return NextResponse.json({ updated: result.count });
  } catch (error) {
    console.error('Failed to mark all messages as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark all messages as read' },
      { status: 500 }
    );
  }
}
