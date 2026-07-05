import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// PA-006: POST /api/messages는 수신자 존재만 확인하고 친구 관계를 검증하지 않아
// 임의 userId에게 응원/축하 메시지를 보낼 수 있었다(친구 기반 소셜 모델 위반).
// src/app/api/messages/route.ts에 추가된 게이트(양방향 accepted Friendship 검증,
// boards/[id]/gift/route.ts 53~65행과 동일 패턴)를 실 Postgres로 검증한다.
//
// 라우트 핸들러 자체는 next/headers의 request-scope cookies()에 의존해
// Next 서버 컨텍스트 밖(이 테스트 러너)에서 직접 호출할 수 없다(호출 시 throw).
// 따라서 라우트에 그대로 박아넣은 것과 동일한 Prisma 프레디킷을 실 DB로 검증한다.
//
// 기본 `npm test`(src/**, DB 불필요)에도 포함되지만 TEST_DATABASE_URL이 없으면
// 건너뛴다. 실행 방법은 tests/integration/fillBoard.integration.test.ts 상단 주석 참고.
//   TEST_DATABASE_URL=postgresql://test:test@localhost:55432/podoal_test?schema=public npm test
const TEST_URL = process.env.TEST_DATABASE_URL;
const skip = TEST_URL ? false : 'TEST_DATABASE_URL 미설정 — 친구 게이트 DB 테스트 건너뜀';

let prisma: PrismaClient;
let meId: string;
let friendId: string;
let strangerId: string;
const createdMessageIds: string[] = [];
const createdUserIds: string[] = [];

before(async () => {
  if (skip) return;
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: TEST_URL }) });
  const stamp = Date.now();
  const me = await prisma.user.create({
    data: { email: `msg-me-${stamp}@test.local`, name: '나', avatar: 'grape' },
  });
  const friend = await prisma.user.create({
    data: { email: `msg-friend-${stamp}@test.local`, name: '친구', avatar: 'peach' },
  });
  const stranger = await prisma.user.create({
    data: { email: `msg-stranger-${stamp}@test.local`, name: '모르는사람', avatar: 'apple' },
  });
  meId = me.id;
  friendId = friend.id;
  strangerId = stranger.id;
  createdUserIds.push(meId, friendId, strangerId);

  await prisma.friendship.create({
    data: { requesterId: meId, receiverId: friendId, status: 'accepted' },
  });
});

after(async () => {
  if (skip || !prisma) return;
  await prisma.message.deleteMany({ where: { id: { in: createdMessageIds } } });
  await prisma.friendship.deleteMany({
    where: { OR: [{ requesterId: { in: createdUserIds } }, { receiverId: { in: createdUserIds } }] },
  });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

/**
 * route.ts에 삽입된 게이트와 동일한 쿼리(양방향 OR + status: 'accepted').
 */
async function isAcceptedFriend(userId: string, otherId: string) {
  const friendship = await prisma.friendship.findFirst({
    where: {
      status: 'accepted',
      OR: [
        { requesterId: userId, receiverId: otherId },
        { requesterId: otherId, receiverId: userId },
      ],
    },
  });
  return friendship !== null;
}

test('친구(accepted, 양방향) — 게이트 통과 → 메시지 생성 가능(201 상당)', { skip }, async () => {
  assert.equal(await isAcceptedFriend(meId, friendId), true);
  // 수신자 관점(역방향)도 동일하게 통과해야 함
  assert.equal(await isAcceptedFriend(friendId, meId), true);

  const message = await prisma.message.create({
    data: { senderId: meId, receiverId: friendId, content: '화이팅!', type: 'cheer' },
  });
  createdMessageIds.push(message.id);
  assert.ok(message.id);
});

test('비친구(관계 없음) — 게이트 실패(403 상당), 메시지를 만들지 않는다', { skip }, async () => {
  assert.equal(await isAcceptedFriend(meId, strangerId), false);
});

test('pending 상태(수락 전) — accepted가 아니므로 게이트 실패', { skip }, async () => {
  if (skip) return;
  const stamp = Date.now();
  const pendingFriend = await prisma.user.create({
    data: { email: `msg-pending-${stamp}@test.local`, name: '수락대기', avatar: 'melon' },
  });
  createdUserIds.push(pendingFriend.id);
  await prisma.friendship.create({
    data: { requesterId: meId, receiverId: pendingFriend.id, status: 'pending' },
  });

  assert.equal(await isAcceptedFriend(meId, pendingFriend.id), false);
});
