import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';
import { DEV_TOOLS } from '@/lib/devtools';

// DEV-ONLY: spin up loginable test friends (+ accepted friendships + a board
// each) so social features (gift / plant / cheer / relay / friend boards) can be
// exercised without real accounts. Idempotent — safe to call repeatedly.
// Test accounts share the password below, so you can also log IN as a friend to
// test the receiving side (gifts/surprises sent toward your main account).
const TEST_PASSWORD = 'test1234';
const TEST_FRIENDS = [
  { suffix: 'a', name: '테스트 딸기', avatar: 'strawberry' },
  { suffix: 'b', name: '테스트 포도', avatar: 'grape' },
  { suffix: 'c', name: '테스트 복숭아', avatar: 'peach' },
];

export async function POST() {
  if (!DEV_TOOLS) return authResponse('dev tools disabled', 403);

  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  const hashed = await bcrypt.hash(TEST_PASSWORD, 10);
  const short = userId.slice(-6).toLowerCase();
  const created: { name: string; email: string }[] = [];

  for (const f of TEST_FRIENDS) {
    const email = `testfriend-${f.suffix}-${short}@podoal.test`;

    const friend = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { name: f.name, email, password: hashed, avatar: f.avatar },
    });
    if (friend.id === userId) continue;

    // Accepted friendship (idempotent, either direction).
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: userId, receiverId: friend.id },
          { requesterId: friend.id, receiverId: userId },
        ],
      },
    });
    if (existing) {
      if (existing.status !== 'accepted') {
        await prisma.friendship.update({ where: { id: existing.id }, data: { status: 'accepted' } });
      }
    } else {
      await prisma.friendship.create({
        data: { requesterId: friend.id, receiverId: userId, status: 'accepted' },
      });
    }

    // Give the friend one in-progress board (so you can view / gift / plant on it).
    const boardCount = await prisma.board.count({ where: { ownerId: friend.id } });
    if (boardCount === 0) {
      const total = 10;
      const board = await prisma.board.create({
        data: {
          title: `${f.name}의 습관 포도판`,
          description: '테스트용 포도판',
          totalStickers: total,
          ownerId: friend.id,
        },
      });
      for (let p = 0; p < 3; p++) {
        await prisma.sticker.create({ data: { boardId: board.id, position: p, filledBy: friend.id } });
      }
      await prisma.reward.create({
        data: { boardId: board.id, type: 'letter', title: '중간 응원', content: '여기까지 잘 왔어! 조금만 더 🍇', triggerAt: 5 },
      });
      await prisma.reward.create({
        data: { boardId: board.id, type: 'wish', title: '완성 보상', content: '축하해! 소원 하나 들어줄게', triggerAt: total },
      });
    }

    created.push({ name: f.name, email });
  }

  return NextResponse.json({
    ok: true,
    password: TEST_PASSWORD,
    friends: created,
  });
}
