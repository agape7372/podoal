import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { fillBoardGrape, PositionTakenError } from '../../src/lib/fillBoard';

// 실 Postgres 통합테스트 — 마지막 칸 동시 채움 race(Serializable+재시도) 검증.
// 기본 `npm test`(src/** 단위, DB 불필요)와 분리. TEST_DATABASE_URL 있을 때만 실행.
//   docker run -d --name podoal-test-pg -e POSTGRES_PASSWORD=test -e POSTGRES_USER=test \
//     -e POSTGRES_DB=podoal_test -p 55432:5432 postgres:16
//   DATABASE_URL=postgresql://test:test@localhost:55432/podoal_test?schema=public \
//     npx prisma db push --skip-generate
//   TEST_DATABASE_URL=postgresql://test:test@localhost:55432/podoal_test?schema=public npm run test:integration
const TEST_URL = process.env.TEST_DATABASE_URL;
const skip = TEST_URL ? false : 'TEST_DATABASE_URL 미설정 — 통합테스트 건너뜀';

let prisma: PrismaClient;
let userId: string;
const createdBoardIds: string[] = [];

before(async () => {
  if (skip) return;
  prisma = new PrismaClient({ datasourceUrl: TEST_URL });
  const user = await prisma.user.create({
    data: { email: `race-${Date.now()}@test.local`, name: '레이스테스터', avatar: 'grape' },
  });
  userId = user.id;
});

after(async () => {
  if (skip || !prisma) return;
  // 자식부터 정리(명시적 — cascade 의존 없이)
  await prisma.sticker.deleteMany({ where: { boardId: { in: createdBoardIds } } });
  await prisma.reward.deleteMany({ where: { boardId: { in: createdBoardIds } } });
  await prisma.message.deleteMany({ where: { OR: [{ senderId: userId }, { receiverId: userId }] } });
  await prisma.board.deleteMany({ where: { id: { in: createdBoardIds } } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

/** totalStickers=2 + 완성보상(triggerAt=2) 보드를 새로 만든다. */
async function freshBoard() {
  const board = await prisma.board.create({
    data: {
      title: '레이스 보드', description: '', totalStickers: 2, ownerId: userId,
      rewards: { create: { type: 'letter', title: '완성 보상', content: '축하!', imageUrl: '', triggerAt: 2 } },
    },
  });
  createdBoardIds.push(board.id);
  return board;
}

test('마지막 두 칸을 동시에 채워도 보드 완료 + 완성보상이 누락되지 않는다 (race)', { skip }, async () => {
  // 반복으로 race를 압박 — Serializable이 없으면 일부 반복에서 isCompleted=false가 새어나온다.
  for (let i = 0; i < 8; i++) {
    const board = await freshBoard();
    const [a, b] = await Promise.all([
      fillBoardGrape(prisma, board, 0, userId),
      fillBoardGrape(prisma, board, 1, userId),
    ]);

    // 둘 다 성공(센티넬 throw 없음)하고 스티커 2개 생성
    const stickerCount = await prisma.sticker.count({ where: { boardId: board.id } });
    assert.equal(stickerCount, 2, `iteration ${i}: 스티커 2개여야 함`);

    // 보드는 완료, 완성보상은 단발 해제됨
    const fresh = await prisma.board.findUnique({ where: { id: board.id } });
    assert.equal(fresh?.isCompleted, true, `iteration ${i}: 보드 완료여야 함`);
    const reward = await prisma.reward.findFirst({ where: { boardId: board.id } });
    assert.notEqual(reward?.unlockedAt, null, `iteration ${i}: 완성보상 unlockedAt 설정돼야 함`);

    // 한쪽 응답에 unlockedReward가 실려 클라가 보상 연출을 띄울 수 있어야 함
    assert.ok(a.unlockedReward || b.unlockedReward, `iteration ${i}: 응답에 unlockedReward 포함돼야 함`);
  }
});

/** 보상 없는 totalStickers=n 보드 — 연타(서로 다른 칸 동시 발사) 테스트용. */
async function freshBoardOf(totalStickers: number) {
  const board = await prisma.board.create({
    data: { title: '연타 보드', description: '', totalStickers, ownerId: userId },
  });
  createdBoardIds.push(board.id);
  return board;
}

test('서로 다른 칸 8개를 동시에 발사해도 전부 저장된다 (연타 회귀)', { skip }, async () => {
  // 프로덕션 버그 재현: 빠른 연타 → 동시 요청들이 서로 Serializable 충돌(P2034) →
  // 재시도 소진 → 일부 채움 유실(8→15 연타 중 5회 미저장). 지수 백오프 + 재시도
  // 확대 후엔 전부 성공해야 한다. 3회 반복으로 race를 압박.
  for (let i = 0; i < 3; i++) {
    const board = await freshBoardOf(10);
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, p) => fillBoardGrape(prisma, board, p, userId)),
    );

    // 8칸 전부 저장 — 재시도 소진으로 유실된 채움이 없어야 한다
    assert.equal(
      await prisma.sticker.count({ where: { boardId: board.id } }),
      8,
      `iteration ${i}: 8칸 전부 저장돼야 함`,
    );

    // 8/10이므로 완료 플래그는 서지 않는다
    const fresh = await prisma.board.findUnique({ where: { id: board.id } });
    assert.equal(fresh?.isCompleted, false, `iteration ${i}: 보드는 미완성이어야 함`);

    // 각 응답의 filledCount는 자기 생성분 포함 1..8 범위
    for (const r of results) {
      assert.ok(
        r.filledCount >= 1 && r.filledCount <= 8,
        `iteration ${i}: filledCount(${r.filledCount})는 1..8이어야 함`,
      );
    }
  }
});

test('같은 칸을 동시에 채우면 한쪽만 성공하고 다른 쪽은 PositionTakenError', { skip }, async () => {
  const board = await freshBoard();
  const results = await Promise.allSettled([
    fillBoardGrape(prisma, board, 0, userId),
    fillBoardGrape(prisma, board, 0, userId),
  ]);
  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
  assert.equal(fulfilled.length, 1, '정확히 한쪽만 성공');
  assert.equal(rejected.length, 1, '다른 쪽은 실패');
  assert.ok(rejected[0].reason instanceof PositionTakenError, 'PositionTakenError여야 함');
  // 스티커는 1개만
  assert.equal(await prisma.sticker.count({ where: { boardId: board.id } }), 1);
});
