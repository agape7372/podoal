import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { zonedDateKey } from '../../src/lib/streak';

// 실 Postgres 통합테스트 — 포도덩굴(/api/vine)의 날짜 그룹핑이 통계·히트맵(/api/stats)과
// 같은 시간대 경계(User.timezone + dayResetHour, src/lib/streak.ts zonedDateKey)를 쓰는지
// 검증한다. 비Seoul 사용자가 UTC 경계 근처에 채운 스티커의 날짜 키가 두 화면에서 일치해야
// (같은 활동 = 같은 날짜) 한다 — vine이 서버 로컬(Vercel=UTC) 달력일로 그룹핑하던
// 정합성 버그(BE-1)의 회귀 가드.
// 기본 `npm test`(src/** 단위, DB 불필요)와 분리. TEST_DATABASE_URL 있을 때만 실행.
// 실행 방법은 fillBoard.integration.test.ts 상단 주석 참고.
const TEST_URL = process.env.TEST_DATABASE_URL;
const skip = TEST_URL ? false : 'TEST_DATABASE_URL 미설정 — 통합테스트 건너뜀';

let prisma: PrismaClient;
const createdUserIds: string[] = [];
const createdBoardIds: string[] = [];

before(async () => {
  if (skip) return;
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: TEST_URL }) });
});

after(async () => {
  if (skip || !prisma) return;
  // 자식부터 정리(명시적 — cascade 의존 없이)
  await prisma.sticker.deleteMany({ where: { boardId: { in: createdBoardIds } } });
  await prisma.board.deleteMany({ where: { id: { in: createdBoardIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

/**
 * stats 라우트의 날짜 버킷 SQL(stats/route.ts:63-72)과 동일 — 히트맵 날짜 키의 정본.
 * filledAt(UTC 저장)을 사용자 시간대 벽시계로 바꾼 뒤 dayResetHour를 뺀 달력 날짜.
 */
async function statsHeatmapDateKey(
  userId: string,
  timezone: string,
  resetHour: number,
): Promise<string> {
  const rows = await prisma.$queryRaw<{ day: string }[]>`
    SELECT to_char((("filledAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone})
                   - make_interval(hours => ${resetHour})
                   - (CASE WHEN "isBackfill" THEN interval '1 day' ELSE interval '0' END),
           'YYYY-MM-DD') AS day
    FROM "Sticker"
    WHERE "filledBy" = ${userId}
    GROUP BY day
  `;
  assert.equal(rows.length, 1, 'stats 집계는 스티커 1개 → 날짜 키 1개여야 함');
  return rows[0].day;
}

/** 비Seoul 유저 + 보드 + 경계 근처 스티커 1개를 만든다. */
async function seedUserWithSticker(opts: {
  timezone: string;
  dayResetHour: number;
  filledAt: Date;
  tag: string;
}) {
  const user = await prisma.user.create({
    data: {
      email: `vine-${opts.tag}-${Date.now()}@test.local`,
      name: '덩굴테스터',
      avatar: 'grape',
      timezone: opts.timezone,
      dayResetHour: opts.dayResetHour,
    },
  });
  createdUserIds.push(user.id);
  const board = await prisma.board.create({
    data: { title: '덩굴 보드', description: '', totalStickers: 5, ownerId: user.id },
  });
  createdBoardIds.push(board.id);
  await prisma.sticker.create({
    data: { boardId: board.id, position: 0, filledBy: user.id, filledAt: opts.filledAt },
  });
  return user;
}

test('비Seoul 사용자: UTC 경계 스티커의 vine 날짜 키 == stats 히트맵 날짜 키 (둘 다 유저 로컬 달력일)', { skip }, async () => {
  // 2026-06-13 03:30 UTC = America/New_York(EDT, UTC-4) 2026-06-12 23:30.
  // 유저 로컬 달력일 = 06-12, 서버 로컬(UTC) 달력일 = 06-13 — 예전 vine 버그의 재현 지점.
  const filledAt = new Date('2026-06-13T03:30:00.000Z');
  const timezone = 'America/New_York';
  const user = await seedUserWithSticker({ timezone, dayResetHour: 0, filledAt, tag: 'ny' });

  // vine 라우트가 쓰는 날짜 키 = zonedDateKey(filledAt, User.timezone, User.dayResetHour).
  const vineKey = zonedDateKey(filledAt, user.timezone, user.dayResetHour);
  const statsKey = await statsHeatmapDateKey(user.id, user.timezone, user.dayResetHour);

  // 핵심: 같은 활동이 두 화면에서 같은 날짜.
  assert.equal(vineKey, statsKey, 'vine 날짜 키와 stats 히트맵 날짜 키가 같아야 함');
  // 유저 로컬(뉴욕) 달력일로 귀속.
  assert.equal(vineKey, '2026-06-12', '뉴욕 달력일(06-12)로 귀속돼야 함');
  // 서버 로컬(UTC) 달력일과는 달라야 함 — 버그 수정 증거(예전 toDateString이면 06-13).
  assert.equal(filledAt.toISOString().slice(0, 10), '2026-06-13');
  assert.notEqual(vineKey, '2026-06-13', 'UTC 달력일이 아니어야 함(시간대 반영)');
  // 응답 계약: 날짜 키 포맷 불변(YYYY-MM-DD).
  assert.match(vineKey, /^\d{4}-\d{2}-\d{2}$/);
});

test('dayResetHour: 새벽 채움도 vine·stats가 같은 전날 키로 귀속', { skip }, async () => {
  // 2026-06-13 05:00 UTC = 뉴욕 2026-06-13 01:00. dayResetHour=3 → 새벽 3시 이전이라 전날(06-12) 귀속.
  const filledAt = new Date('2026-06-13T05:00:00.000Z');
  const timezone = 'America/New_York';
  const user = await seedUserWithSticker({ timezone, dayResetHour: 3, filledAt, tag: 'reset' });

  const vineKey = zonedDateKey(filledAt, user.timezone, user.dayResetHour);
  const statsKey = await statsHeatmapDateKey(user.id, user.timezone, user.dayResetHour);

  assert.equal(vineKey, statsKey, 'resetHour 적용 후에도 두 화면 키가 같아야 함');
  assert.equal(vineKey, '2026-06-12', 'dayResetHour=3 이전 새벽 채움은 전날(06-12)로 귀속');
});
