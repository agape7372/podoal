import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createGiftBoardForFriend } from '../../src/lib/giftBoard';

// 실 Postgres 통합테스트 — 선물 생성 command의 원자성·멱등성(감사 H-01)과
// 포도판↔포도동 1:1 불변식(감사 H-02)을 DB 제약 수준에서 검증한다.
// TEST_DATABASE_URL 있을 때만 실행. 실행 방법은 fillBoard.integration.test.ts 상단 주석 참고.
const TEST_URL = process.env.TEST_DATABASE_URL;
const skip = TEST_URL ? false : 'TEST_DATABASE_URL 미설정 — 통합테스트 건너뜀';

let prisma: PrismaClient;
let senderId: string;
let receiverId: string;

before(async () => {
  if (skip) return;
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: TEST_URL }) });
  const stamp = Date.now();
  const sender = await prisma.user.create({
    data: { email: `giftcmd-sender-${stamp}@test.local`, name: '보내미', avatar: 'grape' },
  });
  const receiver = await prisma.user.create({
    data: { email: `giftcmd-receiver-${stamp}@test.local`, name: '받으미', avatar: 'peach' },
  });
  senderId = sender.id;
  receiverId = receiver.id;
});

after(async () => {
  if (skip || !prisma) return;
  const userIds = [senderId, receiverId];
  const boards = await prisma.board.findMany({
    where: { ownerId: { in: userIds } },
    select: { id: true },
  });
  const boardIds = boards.map((b) => b.id);
  await prisma.relayParticipant.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.relay.deleteMany({ where: { creatorId: { in: userIds } } });
  await prisma.reward.deleteMany({ where: { boardId: { in: boardIds } } });
  await prisma.board.deleteMany({ where: { id: { in: boardIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

function input(key: string) {
  return {
    title: '물 마시기',
    description: '하루 8잔',
    totalStickers: 3,
    templateId: 'health-water',
    giftMessage: '힘내!',
    rewards: [{ type: 'letter', title: '완성 보상', content: '편지', triggerAt: 3 }],
    idempotencyKey: key,
  };
}

test('선물 command: 수신자 소유 보드 하나 + 보상 복사, 발신자 임시 보드는 만들지 않는다', { skip }, async () => {
  const key = `k-basic-${Date.now()}`;
  const board = await createGiftBoardForFriend(prisma, senderId, receiverId, input(key));

  assert.ok(board);
  assert.equal(board.ownerId, receiverId, '보드 주인은 받는 사람');
  assert.equal(board.giftedToId, receiverId);
  assert.equal(board.giftedFromId, senderId);
  assert.equal(board.giftMessage, '힘내!');
  assert.equal(board.templateId, 'health-water', '품종 포일·stats 분해를 위해 templateId도 넘어간다');
  assert.equal(board.cadenceType, 'FREE', '선물 보드는 리듬 제약 없이 시작한다');
  assert.equal(board._count.rewards, 1);

  // 발신자 쪽에 고아 보드가 남지 않아야 한다 — 예전 saga의 핵심 결함.
  const senderBoards = await prisma.board.count({ where: { ownerId: senderId } });
  assert.equal(senderBoards, 0, '발신자 소유 보드가 하나도 생기지 않아야 한다');
});

test('멱등성: 같은 키로 다시 요청하면 유니크 위반으로 막힌다(두 번째 보드가 생기지 않음)', { skip }, async () => {
  const key = `k-idem-${Date.now()}`;
  await createGiftBoardForFriend(prisma, senderId, receiverId, input(key));

  await assert.rejects(
    () => createGiftBoardForFriend(prisma, senderId, receiverId, input(key)),
    (e: { code?: string }) => e.code === 'P2002',
    'P2002를 던져야 라우트가 기존 선물을 돌려줄 수 있다',
  );

  const count = await prisma.board.count({ where: { giftedFromId: senderId, giftIdempotencyKey: key } });
  assert.equal(count, 1, '같은 키로는 수신 보드가 정확히 하나');
});

test('멱등성: 동시에 같은 키로 두 번 보내도 정확히 하나만 만들어진다', { skip }, async () => {
  const key = `k-race-${Date.now()}`;
  const results = await Promise.allSettled([
    createGiftBoardForFriend(prisma, senderId, receiverId, input(key)),
    createGiftBoardForFriend(prisma, senderId, receiverId, input(key)),
  ]);

  const ok = results.filter((r) => r.status === 'fulfilled').length;
  assert.equal(ok, 1, '한 쪽만 성공해야 한다');

  const count = await prisma.board.count({ where: { giftedFromId: senderId, giftIdempotencyKey: key } });
  assert.equal(count, 1);
});

test('멱등키가 다르면 별개의 선물이다', { skip }, async () => {
  const stamp = Date.now();
  const a = await createGiftBoardForFriend(prisma, senderId, receiverId, input(`k-a-${stamp}`));
  const b = await createGiftBoardForFriend(prisma, senderId, receiverId, input(`k-b-${stamp}`));
  assert.notEqual(a?.id, b?.id);
});

test('선물이 아닌 보드는 키가 NULL이라 개수 제한이 없다(NULLS DISTINCT)', { skip }, async () => {
  // 유니크가 (giftedFromId, giftIdempotencyKey)라도 둘 다 NULL인 일반 보드는 무제한이어야 한다.
  const made = await Promise.all(
    [1, 2, 3].map((n) =>
      prisma.board.create({ data: { title: `내 보드 ${n}`, totalStickers: 5, ownerId: receiverId } }),
    ),
  );
  assert.equal(made.length, 3);
  await prisma.board.deleteMany({ where: { id: { in: made.map((b) => b.id) } } });
});

test('포도판은 최대 한 포도동에만 연결된다(RelayParticipant.boardId 유니크)', { skip }, async () => {
  const stamp = Date.now();
  const board = await prisma.board.create({
    data: { title: '릴레이용 보드', totalStickers: 5, ownerId: receiverId },
  });
  const r1 = await prisma.relay.create({
    data: { title: `포도동A-${stamp}`, creatorId: senderId, totalStickers: 5 },
  });
  const r2 = await prisma.relay.create({
    data: { title: `포도동B-${stamp}`, creatorId: senderId, totalStickers: 5 },
  });

  await prisma.relayParticipant.create({
    data: { relayId: r1.id, userId: receiverId, boardId: board.id, order: 0, status: 'active' },
  });

  // 같은 보드를 다른 포도동에 붙이려는 시도 — 선검사 없이도 DB가 막아야 한다.
  await assert.rejects(
    () =>
      prisma.relayParticipant.create({
        data: { relayId: r2.id, userId: receiverId, boardId: board.id, order: 0, status: 'active' },
      }),
    (e: { code?: string }) => e.code === 'P2002',
  );

  // 미참여(boardId NULL) 참가자는 여러 명이어도 충돌하지 않는다.
  await prisma.relayParticipant.create({
    data: { relayId: r2.id, userId: senderId, boardId: null, order: 1, status: 'invited' },
  });
  await prisma.relayParticipant.create({
    data: { relayId: r1.id, userId: senderId, boardId: null, order: 1, status: 'invited' },
  });

  const nulls = await prisma.relayParticipant.count({ where: { boardId: null } });
  assert.ok(nulls >= 2, 'NULL boardId는 유니크 제약에 걸리지 않는다');
});
