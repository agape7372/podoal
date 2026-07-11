// W3-cadence-ripen 검증 스크립트 — dayBoundary·computePaceState 경계 케이스.
// 서버/DB 불필요(순수 함수만 대상) — 날짜는 전부 하드코딩 리터럴이라 시스템 시각과 무관하게
// 결정적으로 재현된다. 실행: `npx tsx scripts/repro/cadence-check.mjs`
//
// 케이스: ①DAILY_1 오늘 1알 채움→ripe false·nextRipeAt=내일 0시 ②자정 직전/직후(+resetHour
// 오프셋) ③WEEKLY_N 주 경계 ④FREE→null ⑤progress 단조증가.

import { dayStart, nextDayStart, weekStart, nextWeekStart } from '../../src/lib/dayBoundary.ts';
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

// C3(7bb92a7)부터 computePaceState 입력은 Date[]가 아니라 PaceFill[]({filledAt, isBackfill?}).
const fills = (dates) => dates.map((d) => ({ filledAt: d }));

// ── ① DAILY_1: 오늘 1알 채움 → ripe false, nextRipeAt = 내일 0시 ──────────────
console.log('① DAILY_1 — 오늘 몫 소진');
{
  const now = new Date(2026, 6, 8, 14, 0, 0); // 2026-07-08 14:00
  const stickerTimes = fills([new Date(2026, 6, 8, 9, 0, 0)]); // 오늘 09:00 채움
  const result = computePaceState({ cadenceType: 'DAILY_1' }, stickerTimes, now);
  assert(result !== null, 'null이 아님');
  assert(result?.ripe === false, 'ripe=false(오늘 몫 소진)');
  assert(result?.quota === 1 && result?.used === 1, 'quota=1, used=1');
  const expectedNextRipe = new Date(2026, 6, 9, 0, 0, 0); // 내일 0시
  assert(sameInstant(result?.nextRipeAt ?? null, expectedNextRipe), 'nextRipeAt=내일 0시');

  // 같은 조건, 아직 안 채운 경우 → ripe true, nextRipeAt null
  const notYet = computePaceState({ cadenceType: 'DAILY_1' }, [], now);
  assert(notYet?.ripe === true, '미채움이면 ripe=true');
  assert(notYet?.nextRipeAt === null, '미채움이면 nextRipeAt=null');
}

// ── ② 자정 직전/직후 + resetHour 오프셋 ───────────────────────────────────────
console.log('② 자정 직전/직후 경계');
{
  // resetHour 기본값(0): 23:59:59.999는 여전히 "오늘", 다음 경계는 내일 0시.
  const justBefore = new Date(2026, 6, 8, 23, 59, 59, 999);
  assert(sameInstant(dayStart(justBefore), new Date(2026, 6, 8, 0, 0, 0)), '23:59:59.999 → dayStart=오늘 0시');
  assert(sameInstant(nextDayStart(justBefore), new Date(2026, 6, 9, 0, 0, 0)), '23:59:59.999 → nextDayStart=내일 0시');

  // 정확히 자정(0:00:00.000)은 이미 "새 하루"의 시작.
  const exactlyMidnight = new Date(2026, 6, 9, 0, 0, 0, 0);
  assert(sameInstant(dayStart(exactlyMidnight), new Date(2026, 6, 9, 0, 0, 0)), '0:00:00.000 → dayStart=그 날 0시(새 하루)');
  assert(sameInstant(nextDayStart(exactlyMidnight), new Date(2026, 6, 10, 0, 0, 0)), '0:00:00.000 → nextDayStart=모레 0시');

  // resetHour=4(새벽 리셋, P14/P22): 새벽 2시는 "어제" 귀속.
  const preReset = new Date(2026, 6, 8, 2, 0, 0); // 07-08 02:00
  assert(sameInstant(dayStart(preReset, 4), new Date(2026, 6, 7, 4, 0, 0)), 'resetHour=4, 02:00 → dayStart=어제 04:00(전날 귀속)');
  assert(sameInstant(nextDayStart(preReset, 4), new Date(2026, 6, 8, 4, 0, 0)), 'resetHour=4, 02:00 → nextDayStart=오늘 04:00');

  // resetHour=4 경계 정각(04:00:00.000)은 "오늘"의 시작.
  const atReset = new Date(2026, 6, 8, 4, 0, 0, 0);
  assert(sameInstant(dayStart(atReset, 4), new Date(2026, 6, 8, 4, 0, 0)), 'resetHour=4, 정확히 04:00 → dayStart=오늘 04:00');
}

// ── ③ WEEKLY_N 주 경계 ────────────────────────────────────────────────────────
console.log('③ WEEKLY_N 주 경계');
{
  // 2026-07-08은 수요일 — 검증 스크립트가 하드코딩 가정에 기대지 않도록 getDay()로 직접 확인.
  const wednesday = new Date(2026, 6, 8, 10, 0, 0);
  assert(wednesday.getDay() === 3, '전제 확인: 2026-07-08은 수요일(getDay()=3)');

  const ws = weekStart(wednesday);
  assert(ws.getDay() === 1, 'weekStart는 항상 월요일(getDay()=1)');
  assert(sameInstant(ws, new Date(2026, 6, 6, 0, 0, 0)), 'weekStart=2026-07-06(월) 0시');
  assert(sameInstant(nextWeekStart(wednesday), new Date(2026, 6, 13, 0, 0, 0)), 'nextWeekStart=2026-07-13(월) 0시');

  // 일요일(주의 마지막 날)도 "이번 주"(지난 월요일 시작) 소속인지 확인.
  const sunday = new Date(2026, 6, 12, 23, 0, 0); // 07-12 일요일
  assert(sameInstant(weekStart(sunday), new Date(2026, 6, 6, 0, 0, 0)), '일요일도 같은 주(월요일 시작)로 귀속');

  // WEEKLY_N(quota=3): 이번 주 경계 밖(지난주) 채움은 used에서 제외.
  const lastWeekFill = new Date(2026, 6, 5, 12, 0, 0); // 지난주 일요일
  const thisWeekFills = [new Date(2026, 6, 7, 9, 0, 0), new Date(2026, 6, 8, 9, 0, 0)]; // 이번 주 2회
  const weekly = computePaceState(
    { cadenceType: 'WEEKLY_N', cadenceN: 3 },
    fills([lastWeekFill, ...thisWeekFills]),
    wednesday,
  );
  assert(weekly?.used === 2, '지난주 채움은 이번 주 used에서 제외(경계 밖)');
  assert(weekly?.ripe === true, '주 3회 중 2회만 채웠으면 아직 ripe');

  // 주 quota 소진 시 nextRipeAt = 다음 주 월요일 0시.
  const weeklyDone = computePaceState(
    { cadenceType: 'WEEKLY_N', cadenceN: 2 },
    fills(thisWeekFills),
    wednesday,
  );
  assert(weeklyDone?.ripe === false, '주 2회 quota 소진 → ripe false');
  assert(sameInstant(weeklyDone?.nextRipeAt ?? null, new Date(2026, 6, 13, 0, 0, 0)), 'nextRipeAt=다음 주 월요일 0시');
}

// ── ④ FREE(및 미지정) → null ─────────────────────────────────────────────────
console.log('④ FREE → null');
{
  assert(computePaceState({ cadenceType: 'FREE' }, [], new Date(2026, 6, 8)) === null, "cadenceType='FREE' → null");
  assert(computePaceState({}, [], new Date(2026, 6, 8)) === null, 'cadenceType 미지정 → null');
  assert(computePaceState({ cadenceType: 'BOGUS' }, [], new Date(2026, 6, 8)) === null, '인식 못하는 cadenceType → null(실패 열림)');
}

// ── ⑤ progress 단조증가 ───────────────────────────────────────────────────────
console.log('⑤ progress 단조증가');
{
  const lastFill = new Date(2026, 6, 8, 9, 0, 0); // 오늘 09:00 채움(quota=1 소진)
  const checkpoints = [
    new Date(2026, 6, 8, 10, 0, 0),
    new Date(2026, 6, 8, 14, 0, 0),
    new Date(2026, 6, 8, 18, 0, 0),
    new Date(2026, 6, 8, 22, 0, 0),
    new Date(2026, 6, 8, 23, 59, 0),
  ];
  const progressValues = checkpoints.map(
    (now) => computePaceState({ cadenceType: 'DAILY_1' }, fills([lastFill]), now)?.progress ?? -1,
  );
  console.log('    progress 시퀀스:', progressValues.map((p) => p.toFixed(4)).join(' → '));
  let monotonic = true;
  for (let i = 1; i < progressValues.length; i++) {
    if (progressValues[i] <= progressValues[i - 1]) monotonic = false;
  }
  assert(monotonic, '시간이 지날수록 progress가 순증가');
  assert(progressValues[0] > 0 && progressValues[progressValues.length - 1] < 1, '기간 중간에는 0과 1 사이(경계 미도달)');

  // 익음 순간(now == nextRipeAt) progress는 1에 도달(클램프 상한 확인).
  const atBoundary = computePaceState({ cadenceType: 'DAILY_1' }, fills([lastFill]), new Date(2026, 6, 9, 0, 0, 0));
  // now가 다음 하루 경계에 정확히 도달하면 dayStart(now) 자체가 다음 날로 넘어가(§2 참조),
  // 그 시점부터는 "새 하루"의 미채움 상태(ripe=true)가 된다 — 그 전 순간(23:59:59.999)이
  // 이전 기간의 진짜 상한이므로 별도로 확인한다.
  assert(atBoundary?.ripe === true, '경계 시각 자체는 이미 새 하루(ripe=true)');
  const justBeforeBoundary = computePaceState(
    { cadenceType: 'DAILY_1' },
    fills([lastFill]),
    new Date(2026, 6, 8, 23, 59, 59, 999),
  );
  assert((justBeforeBoundary?.progress ?? 0) > progressValues[progressValues.length - 1], '경계 직전이 체크포인트 중 가장 높은 progress');
  assert((justBeforeBoundary?.progress ?? 0) <= 1, 'progress는 1을 넘지 않음(클램프)');
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('RESULT: FAIL');
  process.exit(1);
}
console.log('RESULT: PASS');
