import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { fillBoardGrape, fillBoardGrapeBatch, PositionTakenError } from '../../src/lib/fillBoard';

// 실 Postgres 통합테스트 — 마지막 칸 동시 채움 race(Serializable+재시도) 검증.
// 기본 `npm test`(src/** 단위, DB 불필요)와 분리. TEST_DATABASE_URL 있을 때만 실행.
//   docker run -d --name podoal-test-pg -e POSTGRES_PASSWORD=test -e POSTGRES_USER=test \
//     -e POSTGRES_DB=podoal_test -p 55432:5432 postgres:16
//   DATABASE_URL=postgresql://test:test@localhost:55432/podoal_test?schema=public \
//     npx prisma db push   # (v7: --skip-generate 플래그 제거됨)
//   TEST_DATABASE_URL=postgresql://test:test@localhost:55432/podoal_test?schema=public npm run test:integration
const TEST_URL = process.env.TEST_DATABASE_URL;
const skip = TEST_URL ? false : 'TEST_DATABASE_URL 미설정 — 통합테스트 건너뜀';

let prisma: PrismaClient;
let userId: string;
let planterId: string; // 배치 깜짝선물·릴레이 테스트용 두 번째 유저
const createdBoardIds: string[] = [];
const createdRelayIds: string[] = [];

before(async () => {
  if (skip) return;
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: TEST_URL }) });
  const user = await prisma.user.create({
    data: { email: `race-${Date.now()}@test.local`, name: '레이스테스터', avatar: 'grape' },
  });
  userId = user.id;
  const planter = await prisma.user.create({
    data: { email: `planter-${Date.now()}@test.local`, name: '플랜터', avatar: 'grape' },
  });
  planterId = planter.id;
});

after(async () => {
  if (skip || !prisma) return;
  // 자식부터 정리(명시적 — cascade 의존 없이)
  await prisma.relayParticipant.deleteMany({ where: { relayId: { in: createdRelayIds } } });
  await prisma.relay.deleteMany({ where: { id: { in: createdRelayIds } } });
  await prisma.plantedGift.deleteMany({ where: { boardId: { in: createdBoardIds } } });
  await prisma.sticker.deleteMany({ where: { boardId: { in: createdBoardIds } } });
  await prisma.reward.deleteMany({ where: { boardId: { in: createdBoardIds } } });
  await prisma.message.deleteMany({
    where: { OR: [{ senderId: { in: [userId, planterId] } }, { receiverId: { in: [userId, planterId] } }] },
  });
  await prisma.board.deleteMany({ where: { id: { in: createdBoardIds } } });
  await prisma.user.deleteMany({ where: { id: { in: [userId, planterId] } } });
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

// ─── C3 보충 채우기 — 서버 자격 재판정·isBackfill 기록·관대 폴백 ─────────────

test('backfill: 어제 미달 DAILY_1 보드에서 자격 통과 — isBackfill 기록 + paceState backfill', { skip }, async () => {
  const board = await prisma.board.create({
    data: { title: '보충 보드', description: '', totalStickers: 5, ownerId: userId, cadenceType: 'DAILY_1' },
  });
  createdBoardIds.push(board.id);

  const pace = { cadenceType: 'DAILY_1', cadenceN: null, strictMode: false, timezone: 'Asia/Seoul', dayResetHour: 0 };
  const r = await fillBoardGrape(prisma, board, 0, userId, { backfill: true, pace });
  assert.equal(r.paceState, 'backfill');
  const sticker = await prisma.sticker.findFirst({ where: { boardId: board.id, position: 0 } });
  assert.equal(sticker?.isBackfill, true);

  // 보충은 전날 귀속 — 오늘 quota를 잠식하지 않아 다음 채움도 ripe(정상 채움).
  const r2 = await fillBoardGrape(prisma, board, 1, userId, { pace });
  assert.equal(r2.paceState, 'ripe');
  // 오늘 몫을 채운 뒤의 backfill 재요청 — 어제 귀속 backfill이 이미 있어 자격 탈락 →
  // 관대 폴백(일반 채움, 오늘 quota 초과라 early). 절대 막지 않는다.
  const r3 = await fillBoardGrape(prisma, board, 2, userId, { backfill: true, pace });
  assert.equal(r3.paceState, 'early');
  const s3 = await prisma.sticker.findFirst({ where: { boardId: board.id, position: 2 } });
  assert.equal(s3?.isBackfill, false);
});

test('backfill: FREE 보드(pace 미전달)에서는 플래그가 무시된다', { skip }, async () => {
  const board = await freshBoard();
  const r = await fillBoardGrape(prisma, board, 0, userId, { backfill: true });
  assert.equal(r.paceState, undefined);
  const sticker = await prisma.sticker.findFirst({ where: { boardId: board.id, position: 0 } });
  assert.equal(sticker?.isBackfill, false);
});

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
    const unlocked = a.unlockedReward || b.unlockedReward;
    assert.ok(unlocked, `iteration ${i}: 응답에 unlockedReward 포함돼야 함`);
    // 내용(content/imageUrl)도 동봉 — 비트에 열린 팝업이 reveal 왕복 없이 즉시
    // 본문을 보여주는 전제(2026-06-13 보상 무한로딩 수정). 회귀 시 스켈레톤 복귀.
    assert.equal(unlocked?.content, '축하!', `iteration ${i}: unlockedReward에 content 동봉돼야 함`);
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

// ─── 배치 채움(fillBoardGrapeBatch) — 왕복 1번 영속 + 단건 경로와 동등한 부수효과 ───

test('batch: 전체 칸 일괄 채움 — 완료·completedAt·완성보상 1회(content 동봉)', { skip }, async () => {
  const board = await freshBoard(); // total 2 + 완성보상(triggerAt=2)
  const r = await fillBoardGrapeBatch(prisma, board, [0, 1], userId);

  assert.equal(r.filledCount, 2);
  assert.equal(r.isCompleted, true);
  assert.ok(r.completedAt instanceof Date, 'completedAt 동봉(클라 write-through용)');
  assert.equal(r.stickers.length, 2);
  assert.deepEqual(r.stickers.map((s) => s.position), [0, 1]);
  assert.equal(r.stickers[0].filler.name, '레이스테스터', 'StickerInfo 형태(filler 동봉)');
  assert.equal(r.paceStates, undefined, 'FREE 보드는 paceStates 없음');

  // 보상은 정확히 1개, content/imageUrl 동봉(2026-06-13 무한로딩 수정의 전제)
  assert.equal(r.unlockedRewards.length, 1);
  assert.equal(r.unlockedRewards[0].content, '축하!');
  assert.equal(r.unlockedRewards[0].triggerAt, 2);

  const fresh = await prisma.board.findUnique({ where: { id: board.id } });
  assert.equal(fresh?.isCompleted, true);
  assert.notEqual(fresh?.completedAt, null);
  const reward = await prisma.reward.findFirst({ where: { boardId: board.id } });
  assert.notEqual(reward?.unlockedAt, null);
});

test('batch: 이미 채워진 칸·페이로드 중복 — skipDuplicates 관대 수용, throw 없음', { skip }, async () => {
  const board = await freshBoardOf(10);
  await fillBoardGrape(prisma, board, 0, userId); // 선점 채움

  const r = await fillBoardGrapeBatch(prisma, board, [0, 0, 1, 2], userId);
  assert.equal(r.filledCount, 3, '기존 1 + 신규 2 (중복은 스킵)');
  assert.equal(r.stickers.length, 3, '요청 칸 전체를 StickerInfo로 반환(기존 칸 포함)');
  assert.equal(await prisma.sticker.count({ where: { boardId: board.id } }), 3);
  assert.equal(r.isCompleted, false);
  assert.deepEqual(r.unlockedRewards, []);
});

test('batch: 동시 배치 2개 — 채움 유실 0 + 보상 이중 해제 0 (race)', { skip }, async () => {
  for (let i = 0; i < 3; i++) {
    const board = await prisma.board.create({
      data: {
        title: '동시 배치 보드', description: '', totalStickers: 10, ownerId: userId,
        rewards: { create: { type: 'letter', title: '완성 보상', content: '축하!', imageUrl: '', triggerAt: 10 } },
      },
    });
    createdBoardIds.push(board.id);

    // 겹치는 칸(3,4) 포함 — skipDuplicates + Serializable 재시도로 둘 다 성공해야 함
    const [a, b] = await Promise.all([
      fillBoardGrapeBatch(prisma, board, [0, 1, 2, 3, 4], userId),
      fillBoardGrapeBatch(prisma, board, [3, 4, 5, 6, 7, 8, 9], userId),
    ]);

    assert.equal(
      await prisma.sticker.count({ where: { boardId: board.id } }),
      10,
      `iteration ${i}: 10칸 전부 저장(유실 0)`,
    );
    const fresh = await prisma.board.findUnique({ where: { id: board.id } });
    assert.equal(fresh?.isCompleted, true, `iteration ${i}: 보드 완료`);

    // 보상은 정확히 한쪽 응답에만 — 임계 통과 트랜잭션이 유일하게 claim
    assert.equal(
      a.unlockedRewards.length + b.unlockedRewards.length,
      1,
      `iteration ${i}: 보상 해제는 정확히 1회`,
    );
    const reward = await prisma.reward.findFirst({ where: { boardId: board.id } });
    assert.notEqual(reward?.unlockedAt, null, `iteration ${i}: 보상 unlockedAt 설정`);
  }
});

test('batch: triggerAt 임계 2개를 한 배치로 통과 — 둘 다 정확히 1회, 배열로 반환', { skip }, async () => {
  const board = await prisma.board.create({
    data: {
      title: '이중 보상 보드', description: '', totalStickers: 6, ownerId: userId,
      rewards: {
        create: [
          { type: 'letter', title: '중간 보상', content: '절반!', imageUrl: '', triggerAt: 3 },
          { type: 'letter', title: '완성 보상', content: '축하!', imageUrl: '', triggerAt: 6 },
        ],
      },
    },
  });
  createdBoardIds.push(board.id);

  const r = await fillBoardGrapeBatch(prisma, board, [0, 1, 2, 3, 4, 5], userId);
  assert.equal(r.unlockedRewards.length, 2, '임계 2개 모두 배열에 실림');
  assert.deepEqual(r.unlockedRewards.map((x) => x.triggerAt), [3, 6], 'triggerAt 오름차순');
  assert.deepEqual(r.unlockedRewards.map((x) => x.content), ['절반!', '축하!'], 'content 동봉');

  const rewards = await prisma.reward.findMany({ where: { boardId: board.id } });
  for (const rw of rewards) assert.notEqual(rw.unlockedAt, null);

  // no-op 재배치(전 칸 중복) — 보상 재해제·완료 재처리 없음(exactly-once 가드)
  const r2 = await fillBoardGrapeBatch(prisma, board, [0, 1, 2, 3, 4, 5], userId);
  assert.equal(r2.unlockedRewards.length, 0, '재배치에서 보상 재해제 없음');
  assert.equal(r2.isCompleted, true);
});

test('batch: 여러 칸의 깜짝선물 — 각 1회 공개 + 선물마다 발견 메시지 1통', { skip }, async () => {
  const board = await freshBoardOf(5);
  await prisma.plantedGift.create({
    data: { boardId: board.id, position: 1, plantedById: planterId, message: '깜짝1', emoji: '🎁' },
  });
  await prisma.plantedGift.create({
    data: { boardId: board.id, position: 3, plantedById: planterId, message: '깜짝2', emoji: '🎉' },
  });

  const r = await fillBoardGrapeBatch(prisma, board, [0, 1, 2, 3, 4], userId);
  assert.equal(r.plantedGifts.length, 2);
  assert.deepEqual(r.plantedGifts.map((g) => g.position), [1, 3], '칸별 연출용 position 동봉');
  assert.equal(r.plantedGifts[0].plantedBy.id, planterId);

  const gifts = await prisma.plantedGift.findMany({ where: { boardId: board.id } });
  for (const g of gifts) assert.notEqual(g.revealedAt, null, '전부 공개됨');

  // 심은 사람에게 선물당 1통 — 위치 복기 가능한 문구(W2-A, 단건과 동일)
  const msgs = await prisma.message.findMany({
    where: { senderId: userId, receiverId: planterId, boardId: board.id },
  });
  assert.equal(msgs.length, 2, '선물마다 발견 메시지 1통');
  assert.ok(msgs.some((m) => m.content.includes('2번째')), '위치(2번째) 포함');
  assert.ok(msgs.some((m) => m.content.includes('4번째')), '위치(4번째) 포함');

  // 재배치 — 이미 공개된 선물은 다시 실리지 않음(revealedAt:null exactly-once)
  const r2 = await fillBoardGrapeBatch(prisma, board, [1, 3], userId);
  assert.equal(r2.plantedGifts.length, 0);
  assert.equal(
    (await prisma.message.count({ where: { senderId: userId, receiverId: planterId, boardId: board.id } })),
    2,
    '메시지 중복 발송 없음',
  );
});

test('batch: 릴레이 참가자 보드를 배치로 완성 — 바통이 정확히 1회 넘어간다', { skip }, async () => {
  const board = await freshBoardOf(3);
  const relay = await prisma.relay.create({
    data: {
      title: '배치 릴레이', totalStickers: 3, creatorId: userId, mode: 'relay',
      participants: {
        create: [
          { userId, boardId: board.id, order: 0, status: 'active' },
          { userId: planterId, order: 1, status: 'pending' },
        ],
      },
    },
  });
  createdRelayIds.push(relay.id);

  const r = await fillBoardGrapeBatch(prisma, board, [0, 1, 2], userId);
  assert.equal(r.isCompleted, true);
  assert.equal(r.relayAdvanced, true);

  const parts = await prisma.relayParticipant.findMany({
    where: { relayId: relay.id }, orderBy: { order: 'asc' },
  });
  assert.equal(parts[0].status, 'completed', '내 참가는 완료');
  assert.equal(parts[1].status, 'active', '다음 참가자에게 바통');
  assert.equal((await prisma.relay.findUnique({ where: { id: relay.id } }))?.status, 'active');

  // no-op 재배치 — isCompleted 재확인 가드로 릴레이 재진행 없음(exactly-once)
  const r2 = await fillBoardGrapeBatch(prisma, board, [0, 1, 2], userId);
  assert.equal(r2.relayAdvanced, false);
  const parts2 = await prisma.relayParticipant.findMany({
    where: { relayId: relay.id }, orderBy: { order: 'asc' },
  });
  assert.equal(parts2[1].status, 'active', '다음 참가자 상태 불변(재진행 없음)');
});
