import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';

// W1-data-export — 탈퇴(auth/me DELETE)와 짝인 신뢰 장치: 로그인 사용자의 전체 기록을
// 읽기 전용 JSON으로 내려준다. additive 신규 라우트 — 기존 API·스키마 무수정(PRINCIPLES §3 게이트).
// 민감 필드는 화이트리스트 select로 원천 배제한다(password·provider·providerId 등은
// 아래 어떤 select에도 등장하지 않음 — 블랙리스트/omit이 아니라 select만 사용하는 습관).
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return authResponse('로그인이 필요해요.', 401);
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, avatar: true, createdAt: true },
    });
    if (!user) {
      return authResponse('사용자를 찾을 수 없어요.', 404);
    }

    // 내 소유 + 내가 받은 선물(giftedTo) 보드 전부 — 소유/수령 그 자체가 열람 권한.
    const myBoardsFilter = { OR: [{ ownerId: userId }, { giftedToId: userId }] };

    const [boards, capsules, sentMessages, receivedMessages, friendships, reminders, plantedGiftsByMe] =
      await Promise.all([
        prisma.board.findMany({
          where: myBoardsFilter,
          select: {
            title: true,
            description: true,
            totalStickers: true,
            isCompleted: true,
            completedAt: true,
            createdAt: true,
            cellarNote: true,
            harvestedAt: true,
            stickers: {
              select: { position: true, filledAt: true },
              orderBy: { position: 'asc' },
            },
            // 내 보드 것이므로 잠금 여부와 무관하게 전부 포함 — board/[id]/route.ts의
            // canSeeBody(방문 친구용 마스킹)는 여기 적용하지 않는다(수출 대상이 항상 본인).
            rewards: {
              select: {
                type: true,
                title: true,
                content: true,
                triggerAt: true,
                unlockedAt: true,
                revealedAt: true,
              },
              orderBy: { triggerAt: 'asc' },
            },
            // 깜짝선물 스포일러 금지(스펙 3항): 남이 심었고(plantedById !== userId) +
            // 공개(revealedAt not null)된 것만 포함 — 미공개면 통째로 제외한다.
            // plantedById !== userId는 방어적 조건: plant-gift POST가 이미 주인의
            // 셀프플랜트를 막아서(board.ownerId===userId면 400, src/app/api/boards/[id]/plant-gift/route.ts:31)
            // 내 보드에 남는 PlantedGift는 항상 타인 소유지만, 명시적으로 남겨 의도를 드러낸다.
            plantedGifts: {
              where: { revealedAt: { not: null }, plantedById: { not: userId } },
              select: { message: true, emoji: true, revealedAt: true },
              orderBy: { revealedAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.timeCapsule.findMany({
          where: { userId },
          select: { message: true, openAt: true, isOpened: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.message.findMany({
          where: { senderId: userId },
          select: {
            content: true,
            type: true,
            emoji: true,
            createdAt: true,
            receiver: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.message.findMany({
          where: { receiverId: userId },
          select: {
            content: true,
            type: true,
            emoji: true,
            createdAt: true,
            sender: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.friendship.findMany({
          where: { status: 'accepted', OR: [{ requesterId: userId }, { receiverId: userId }] },
          select: {
            createdAt: true,
            requesterId: true,
            requester: { select: { id: true, name: true } },
            receiver: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.reminder.findMany({
          where: { userId },
          select: { time: true, days: true, message: true, isActive: true },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.plantedGift.findMany({
          where: { plantedById: userId },
          select: { message: true, emoji: true, position: true, revealedAt: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

    // 보낸/받은 메시지를 시간순으로 합류 — direction으로 방향 구분, 상대는 항상
    // {id,name}만 노출(이메일 금지 — 스펙 2항).
    const messages = [
      ...sentMessages.map((m) => ({
        content: m.content,
        type: m.type,
        emoji: m.emoji,
        createdAt: m.createdAt,
        direction: 'sent' as const,
        counterpart: m.receiver,
      })),
      ...receivedMessages.map((m) => ({
        content: m.content,
        type: m.type,
        emoji: m.emoji,
        createdAt: m.createdAt,
        direction: 'received' as const,
        counterpart: m.sender,
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const friends = friendships.map((f) => ({
      friend: f.requesterId === userId ? f.receiver : f.requester,
      since: f.createdAt,
    }));

    const payload = {
      exportedAt: new Date().toISOString(),
      user,
      boards,
      capsules,
      messages,
      friends,
      reminders,
      plantedGiftsByMe,
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="podoal-export-${userId.slice(0, 8)}.json"`,
      },
    });
  } catch (error) {
    console.error('Data export error:', error);
    return authResponse('데이터를 내보내는 중 문제가 생겼어요.', 500);
  }
}
