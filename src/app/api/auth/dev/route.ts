import { prisma } from '@/lib/prisma';
import { createToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ error: 'Not available' }, { status: 403 });
  }

  const email = 'dev@podoal.com';

  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    const password = await bcrypt.hash('dev1234', 10);
    user = await prisma.user.create({
      data: {
        name: '개발자',
        email,
        password,
        avatar: 'grape',
      },
    });

    // Auto-friend with all existing users
    const others = await prisma.user.findMany({
      where: { id: { not: user.id } },
    });
    for (const other of others) {
      await prisma.friendship.upsert({
        where: {
          requesterId_receiverId: { requesterId: user.id, receiverId: other.id },
        },
        update: {},
        create: {
          requesterId: user.id,
          receiverId: other.id,
          status: 'accepted',
        },
      });
    }

    // Create a sample board
    const board = await prisma.board.create({
      data: {
        title: '개발 테스트 포도판 🍇',
        description: '개발자 모드 테스트용',
        totalStickers: 10,
        ownerId: user.id,
      },
    });
    await prisma.reward.create({
      data: {
        boardId: board.id,
        type: 'wish',
        title: '테스트 보상!',
        content: '개발 테스트 보상입니다 🎉',
        triggerAt: 10,
      },
    });

    // Board starts empty so developer can test filling from scratch
  }

  const token = await createToken(user.id);
  const profile = {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
  };

  const response = Response.json({ user: profile });
  response.headers.set(
    'Set-Cookie',
    `token=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax`
  );
  return response;
}
