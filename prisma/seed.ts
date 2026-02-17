import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create demo users
  const password = await bcrypt.hash('1234', 10);

  const user1 = await prisma.user.upsert({
    where: { email: 'mom@podoal.com' },
    update: {},
    create: {
      name: '엄마',
      email: 'mom@podoal.com',
      password,
      avatar: 'grape',
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'kid@podoal.com' },
    update: {},
    create: {
      name: '우리아이',
      email: 'kid@podoal.com',
      password,
      avatar: 'strawberry',
    },
  });

  const user3 = await prisma.user.upsert({
    where: { email: 'friend@podoal.com' },
    update: {},
    create: {
      name: '친한친구',
      email: 'friend@podoal.com',
      password,
      avatar: 'cherry',
    },
  });

  // Create friendship
  await prisma.friendship.upsert({
    where: { requesterId_receiverId: { requesterId: user1.id, receiverId: user2.id } },
    update: {},
    create: {
      requesterId: user1.id,
      receiverId: user2.id,
      status: 'accepted',
      isFavorite: true,
    },
  });

  await prisma.friendship.upsert({
    where: { requesterId_receiverId: { requesterId: user1.id, receiverId: user3.id } },
    update: {},
    create: {
      requesterId: user1.id,
      receiverId: user3.id,
      status: 'accepted',
    },
  });

  // Create a board for kid with reward from mom
  const board = await prisma.board.create({
    data: {
      title: '매일 책 읽기 📚',
      description: '하루에 30분씩 책 읽기',
      totalStickers: 10,
      ownerId: user2.id,
      giftedFromId: user1.id,
      giftedToId: user2.id,
    },
  });

  await prisma.reward.create({
    data: {
      boardId: board.id,
      type: 'wish',
      title: '소원 하나 들어줄게!',
      content: '열심히 책 읽은 우리 아이에게 소원 하나를 들어줄게요! 뭐든 말해봐! 🌟',
      triggerAt: 10,
    },
  });

  // Fill some stickers
  for (let i = 0; i < 4; i++) {
    await prisma.sticker.create({
      data: {
        boardId: board.id,
        position: i,
        filledBy: user2.id,
      },
    });
  }

  // Send an encouragement message
  await prisma.message.create({
    data: {
      senderId: user1.id,
      receiverId: user2.id,
      content: '화이팅! 오늘도 열심히 읽자!',
      type: 'cheer',
      emoji: '💜',
    },
  });

  console.log('Seed data created successfully!');
  console.log('Demo accounts:');
  console.log('  mom@podoal.com / 1234');
  console.log('  kid@podoal.com / 1234');
  console.log('  friend@podoal.com / 1234');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
