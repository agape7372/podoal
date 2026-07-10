import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { giftBoardCopy, RegiftBlockedError } from '../../src/lib/giftBoard';

// 실 Postgres 통합테스트 — 포도판 선물 복사 트랜잭션(src/lib/giftBoard.ts) 검증.
// 기본 `npm test`(src/** 단위, DB 불필요)와 분리. TEST_DATABASE_URL 있을 때만 실행.
// 실행 방법은 fillBoard.integration.test.ts 상단 주석 참고.
const TEST_URL = process.env.TEST_DATABASE_URL;
const skip = TEST_URL ? false : 'TEST_DATABASE_URL 미설정 — 통합테스트 건너뜀';

let prisma: PrismaClient;
let senderId: string;
let receiverId: string;
const createdBoardIds: string[] = [];

before(async () => {
  if (skip) return;
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: TEST_URL }) });
  const stamp = Date.now();
  const sender = await prisma.user.create({
    data: { email: `gift-sender-${stamp}@test.local`, name: '선물보내미', avatar: 'grape' },
  });
  const receiver = await prisma.user.create({
    data: { email: `gift-receiver-${stamp}@test.local`, name: '선물받으미', avatar: 'peach' },
  });
  senderId = sender.id;
  receiverId = receiver.id;
});

after(async () => {
  if (skip || !prisma) return;
  // 자식부터 정리(명시적 — cascade 의존 없이). giftBoardCopy는 메시지를 만들지
  // 않지만(라우트 관심사), 복사본 보드가 추적 목록 밖에 남지 않도록 owner 기준도 함께 정리.
  const userIds = [senderId, receiverId];
  const boards = await prisma.board.findMany({
    where: { OR: [{ id: { in: createdBoardIds } }, { ownerId: { in: userIds } }] },
    select: { id: true },
  });
  const boardIds = boards.map((b) => b.id);
  await prisma.sticker.deleteMany({ where: { boardId: { in: boardIds } } });
  await prisma.reward.deleteMany({ where: { boardId: { in: boardIds } } });
  await prisma.board.deleteMany({ where: { id: { in: boardIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

/** 보상 2개(중간 triggerAt=1, 완성 triggerAt=3)가 있는 원본 보드를 만든다. */
async function freshSourceBoard() {
  const board = await prisma.board.create({
    data: {
      title: '물 마시기',
      description: '하루 8잔',
      totalStickers: 3,
      ownerId: senderId,
      rewards: {
        create: [
          { type: 'letter', title: '중간 보상', content: '반 왔어요!', imageUrl: '', triggerAt: 1 },
          { type: 'wish', title: '완성 보상', content: '소원 들어주기', imageUrl: 'https://img.test/x.png', triggerAt: 3 },
        ],
      },
    },
    include: { rewards: true },
  });
  createdBoardIds.push(board.id);
  return board;
}

test('선물 성공: 복사본의 owner/giftedFrom/giftedTo/메모와 보상이 정확히 복사된다', { skip }, async () => {
  const source = await freshSourceBoard();

  const copy = await giftBoardCopy(prisma, source, senderId, receiverId, '응원해요!');
  assert.ok(copy, '복사본이 반환돼야 함');
  createdBoardIds.push(copy.id);

  // 새 보드(원본과 다른 id), 소유권은 받는 친구에게
  assert.notEqual(copy.id, source.id);
  assert.equal(copy.ownerId, receiverId);
  assert.equal(copy.giftedToId, receiverId);
  assert.equal(copy.giftedFromId, senderId);
  assert.equal(copy.giftMessage, '응원해요!');

  // 내용 복사
  assert.equal(copy.title, source.title);
  assert.equal(copy.description, source.description);
  assert.equal(copy.totalStickers, source.totalStickers);

  // 복사본은 빈 보드에서 시작
  assert.equal(copy._count.stickers, 0);
  assert.equal(copy.isCompleted, false);

  // 커스텀 사진 없는 원본 → 복사본도 없음(null 경로 크래시 방지 계약). 사진 있는
  // 원본의 blob 복제는 실 BLOB 토큰이 필요해 여기선 검증 못 함(수동/실기기 확인).
  assert.equal(copy.customImageUrl, null);

  // 보상 전체 복사(내용·트리거 위치 보존)
  assert.equal(copy._count.rewards, source.rewards.length);
  const copiedRewards = await prisma.reward.findMany({
    where: { boardId: copy.id },
    orderBy: { triggerAt: 'asc' },
  });
  const sourceRewards = [...source.rewards].sort((a, b) => a.triggerAt - b.triggerAt);
  assert.equal(copiedRewards.length, sourceRewards.length);
  for (let i = 0; i < sourceRewards.length; i++) {
    assert.equal(copiedRewards[i].type, sourceRewards[i].type);
    assert.equal(copiedRewards[i].title, sourceRewards[i].title);
    assert.equal(copiedRewards[i].content, sourceRewards[i].content);
    assert.equal(copiedRewards[i].imageUrl, sourceRewards[i].imageUrl);
    assert.equal(copiedRewards[i].triggerAt, sourceRewards[i].triggerAt);
  }

  // 원본은 그대로(소유권·선물 링크 무변경)
  const sourceAfter = await prisma.board.findUniqueOrThrow({ where: { id: source.id } });
  assert.equal(sourceAfter.ownerId, senderId);
  assert.equal(sourceAfter.giftedFromId, null);
});

test('재선물 차단: 선물받은 복사본을 다시 선물하면 RegiftBlockedError', { skip }, async () => {
  const source = await freshSourceBoard();
  const copy = await giftBoardCopy(prisma, source, senderId, receiverId, '첫 선물');
  assert.ok(copy);
  createdBoardIds.push(copy.id);

  // 받은 사람이 그 복사본(giftedFromId != null)을 또 선물하려 함 → 차단
  const copyWithRewards = await prisma.board.findUniqueOrThrow({
    where: { id: copy.id },
    include: { rewards: true },
  });
  await assert.rejects(
    giftBoardCopy(prisma, copyWithRewards, receiverId, senderId, '되돌려 선물'),
    RegiftBlockedError,
  );

  // 차단은 트랜잭션 진입 전 — 새 보드가 생기지 않아야 함
  const regiftCount = await prisma.board.count({ where: { giftedFromId: receiverId } });
  assert.equal(regiftCount, 0, '재선물로 생성된 보드가 없어야 함');
});

test('보상 비밀 유지: 원본에서 이미 열린 보상도 복사본에서는 잠김으로 초기화된다', { skip }, async () => {
  const source = await freshSourceBoard();
  // 원본 보상을 전부 "이미 열림" 상태로 만들어 둔다
  await prisma.reward.updateMany({
    where: { boardId: source.id },
    data: { unlockedAt: new Date(), revealedAt: new Date() },
  });
  const opened = await prisma.board.findUniqueOrThrow({
    where: { id: source.id },
    include: { rewards: true },
  });

  const copy = await giftBoardCopy(prisma, opened, senderId, receiverId, '');
  assert.ok(copy);
  createdBoardIds.push(copy.id);

  const copiedRewards = await prisma.reward.findMany({ where: { boardId: copy.id } });
  assert.equal(copiedRewards.length, opened.rewards.length);
  for (const reward of copiedRewards) {
    assert.equal(reward.unlockedAt, null, '복사본 보상은 unlockedAt이 초기화돼야 함');
    assert.equal(reward.revealedAt, null, '복사본 보상은 revealedAt이 초기화돼야 함');
  }
});
