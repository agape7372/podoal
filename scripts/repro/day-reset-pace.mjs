// W2B-C4b-day-reset-ui 검증 스크립트 — computePaceState의 신규 additive resetHour 인자.
// 서버/DB 불필요(순수 함수만 대상) — 날짜는 전부 하드코딩 리터럴이라 시스템 시각과 무관하게
// 결정적으로 재현된다. 실행: `npx tsx scripts/repro/day-reset-pace.mjs`
//
// 케이스: ①resetHour=4에서 새벽 2시 채움이 전날 귀속(오늘 몫 아직 안 채운 걸로 판정)
// ②같은 채움이 resetHour=0(기본)이면 오늘 몫으로 판정 — 대비를 통해 ①이 resetHour
// 배선 자체의 효과임을 증명 ③미전달 3-인자 호출 = resetHour=0과 동일(회귀 0 계약)
// ④nextRipeAt이 resetHour 경계로 이동 ⑤정확히 resetHour 정각은 "오늘" 시작
// ⑥WEEKLY_N도 동일 경계 이동.

import { computePaceState } from '../../src/lib/cadence.ts';

let pass = 0;
let fail = 0;

function assert(cond, label) {
  if (cond) {
    pass += 1;
    console.log(`  PASS - ${label}`);
  } else {
    fail += 1;
    console.log(`  FAIL - ${label}`);
  }
}

function sameInstant(a, b) {
  return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
}

// ── ① resetHour=4: 새벽 2시 채움 → 전날 귀속 → 오늘 몫은 아직 ripe ──────────────
console.log('① resetHour=4 — 새벽 2시 채움의 전날 귀속');
{
  const fillAt2am = new Date(2026, 6, 8, 2, 0, 0); // 07-08 02:00 채움(quota=1)
  const nowMorning = new Date(2026, 6, 8, 10, 0, 0); // 같은 날 오전 — resetHour=4 기준 "오늘"(04:00~)
  const result = computePaceState({ cadenceType: 'DAILY_1' }, [{ filledAt: fillAt2am }], nowMorning, 4);
  assert(result !== null, 'null이 아님');
  assert(result?.used === 0, '02:00 채움은 오늘(04:00~) 기간 밖 — used=0');
  assert(result?.ripe === true, '전날 귀속이라 오늘 몫은 아직 ripe(익어 있음)');
}

// ── ② 같은 조건, resetHour=0(기본)이면 오늘 몫으로 판정(대비) ───────────────────
console.log('② resetHour=0(기본) — 같은 채움이 오늘로 판정됨(대비)');
{
  const fillAt2am = new Date(2026, 6, 8, 2, 0, 0);
  const nowMorning = new Date(2026, 6, 8, 10, 0, 0);
  const resultDefault = computePaceState({ cadenceType: 'DAILY_1' }, [{ filledAt: fillAt2am }], nowMorning, 0);
  assert(resultDefault?.used === 1, 'resetHour=0이면 02:00 채움이 오늘(00:00~) 기간 안 — used=1');
  assert(resultDefault?.ripe === false, '오늘 몫 소진 — ripe=false');
}

// ── ③ resetHour 미전달(3-인자 호출) = resetHour=0과 동일(회귀 0 계약) ───────────
console.log('③ resetHour 미전달 — 기존 3-인자 호출부 회귀 0');
{
  const fillAt2am = new Date(2026, 6, 8, 2, 0, 0);
  const nowMorning = new Date(2026, 6, 8, 10, 0, 0);
  const resultNoArg = computePaceState({ cadenceType: 'DAILY_1' }, [{ filledAt: fillAt2am }], nowMorning);
  const resultExplicitZero = computePaceState({ cadenceType: 'DAILY_1' }, [{ filledAt: fillAt2am }], nowMorning, 0);
  assert(resultNoArg?.used === resultExplicitZero?.used, 'used 동일');
  assert(resultNoArg?.ripe === resultExplicitZero?.ripe, 'ripe 동일');
  assert(sameInstant(resultNoArg?.nextRipeAt ?? null, resultExplicitZero?.nextRipeAt ?? null), 'nextRipeAt 동일');
}

// ── ④ nextRipeAt이 resetHour 경계로 이동 ─────────────────────────────────────
console.log('④ nextRipeAt = resetHour 경계');
{
  const fillToday = new Date(2026, 6, 8, 10, 0, 0); // resetHour=4 기준 오늘(04:00~) 채움
  const now = new Date(2026, 6, 8, 20, 0, 0);
  const result = computePaceState({ cadenceType: 'DAILY_1' }, [{ filledAt: fillToday }], now, 4);
  assert(result?.ripe === false, '오늘 몫 소진 — ripe=false');
  assert(
    sameInstant(result?.nextRipeAt ?? null, new Date(2026, 6, 9, 4, 0, 0)),
    'nextRipeAt=내일 04:00(resetHour 경계)',
  );
}

// ── ⑤ 정확히 resetHour 정각(04:00:00.000)은 "오늘" 시작 ─────────────────────────
console.log('⑤ resetHour 정각 경계');
{
  const fillAt359 = new Date(2026, 6, 8, 3, 59, 59, 999); // 04:00 직전 — 전날 귀속
  const fillAt400 = new Date(2026, 6, 8, 4, 0, 0, 0); // 정확히 04:00 — 오늘 귀속
  const now = new Date(2026, 6, 8, 12, 0, 0);
  const before = computePaceState({ cadenceType: 'DAILY_1' }, [{ filledAt: fillAt359 }], now, 4);
  const at = computePaceState({ cadenceType: 'DAILY_1' }, [{ filledAt: fillAt400 }], now, 4);
  assert(before?.used === 0, '03:59:59.999 채움은 오늘 기간 밖 — used=0(전날 귀속)');
  assert(at?.used === 1, '04:00:00.000 채움은 오늘 기간 안 — used=1');
}

// ── ⑥ WEEKLY_N도 동일 경계 이동 ──────────────────────────────────────────────
console.log('⑥ WEEKLY_N — resetHour 경계 이동');
{
  // 2026-07-08은 수요일. resetHour=4 기준 "이번 주 월요일 시작"은 07-06 04:00.
  const beforeWeekBoundary = new Date(2026, 6, 6, 2, 0, 0); // 월요일 02:00(경계 전) → 지난주 귀속
  const afterWeekBoundary = new Date(2026, 6, 6, 5, 0, 0); // 월요일 05:00(경계 후) → 이번 주 귀속
  const now = new Date(2026, 6, 8, 10, 0, 0);
  const result = computePaceState(
    { cadenceType: 'WEEKLY_N', cadenceN: 2 },
    [{ filledAt: beforeWeekBoundary }, { filledAt: afterWeekBoundary }],
    now,
    4,
  );
  assert(result?.used === 1, '월요일 02:00 채움은 지난주 귀속 — 이번 주 used=1(05:00분만 집계)');
  assert(result?.ripe === true, 'quota=2 중 1개만 채움 — 아직 ripe');
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('RESULT: FAIL');
  process.exit(1);
}
console.log('RESULT: PASS');
