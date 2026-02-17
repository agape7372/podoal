import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  // Total boards
  const totalBoards = await prisma.board.count({
    where: { ownerId: userId },
  });

  // Completed boards
  const completedBoards = await prisma.board.count({
    where: { ownerId: userId, isCompleted: true },
  });

  // Total stickers filled
  const totalStickers = await prisma.sticker.count({
    where: { filledBy: userId },
  });

  // Messages sent
  const messagesSent = await prisma.message.count({
    where: { senderId: userId },
  });

  // Messages received
  const messagesReceived = await prisma.message.count({
    where: { receiverId: userId },
  });

  // Friends count
  const friendsCount = await prisma.friendship.count({
    where: {
      status: 'accepted',
      OR: [{ requesterId: userId }, { receiverId: userId }],
    },
  });

  // Boards gifted
  const boardsGifted = await prisma.board.count({
    where: { giftedFromId: userId },
  });

  // Boards received as gift
  const boardsReceived = await prisma.board.count({
    where: { giftedToId: userId },
  });

  // Recent activity (last 7 days stickers)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const recentStickers = await prisma.sticker.count({
    where: {
      filledBy: userId,
      filledAt: { gte: weekAgo },
    },
  });

  // Daily sticker counts for last 7 days
  const dailyStickers = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date();
    dayStart.setDate(dayStart.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const count = await prisma.sticker.count({
      where: {
        filledBy: userId,
        filledAt: { gte: dayStart, lt: dayEnd },
      },
    });

    dailyStickers.push({
      date: dayStart.toISOString().split('T')[0],
      count,
    });
  }

  // Streak calculation (consecutive days with at least 1 sticker)
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < 365; i++) {
    const dayStart = new Date(today);
    dayStart.setDate(dayStart.getDate() - i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const count = await prisma.sticker.count({
      where: {
        filledBy: userId,
        filledAt: { gte: dayStart, lt: dayEnd },
      },
    });

    if (count > 0) {
      streak++;
    } else {
      break;
    }
  }

  return Response.json({
    stats: {
      totalBoards,
      completedBoards,
      totalStickers,
      recentStickers,
      messagesSent,
      messagesReceived,
      friendsCount,
      boardsGifted,
      boardsReceived,
      streak,
      dailyStickers,
    },
  });
}
