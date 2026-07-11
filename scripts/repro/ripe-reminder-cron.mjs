// W2A-C4c-ripe-reminder 검증 스크립트 — cron ripe 리마인더 분기의 판정 순서를 재현한다.
// 서버/DB 불필요(순수 함수만 대상) — src/app/api/cron/reminders/route.ts의 ripe 분기와
// "정확히 같은 순서로 같은 빌딩블록"(computeFillPace/zonedDateKey/inDnd)을 호출하는
// decideRipeSend()를 여기서 조립해 검증한다(route.ts 자체는 Request/DB가 필요해 직접
// 호출 불가 — PLAYBOOK §8 "순수 함수 단위" 재현). 실행: `npx tsx scripts/repro/ripe-reminder-cron.mjs`
//
// 케이스(카드 완료 조건 4종): ①익음→발송 ②dedupe(같은 날 재발사 스킵) ③채운 뒤→미발송
// ④DND 스킵 — 발송도 lastSentAt 마킹도 안 함(다음 5분 틱 재시도 가능해야 함).
//
// ④가 이 카드의 핵심 함정이다: sendPushToUser는 DND 안이면 조용히 스킵하는데, 그걸 모르고
// lastSentAt을 먼저 마킹하면 dedupe 때문에 그날 알림이 영구 유실된다. route.ts는 inDnd()를
// 먼저 판정해 DND 안이면 발송·마킹 둘 다 건너뛰므로, 여기서도 "마킹 여부"까지 시뮬레이션해
// 검증한다(단순히 send 여부만 보면 이 버그를 놓친다).

import { computeFillPace } from '../../src/lib/pace.ts';
import { zonedDateKey } from '../../src/lib/streak.ts';
import { inDnd } from '../../src/lib/push.ts';

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

// route.ts의 로컬 헬퍼(zonedDayOfWeek)와 동일 — streak.ts weekStartKey가 쓰는 것과 같은
// "날짜키를 UTC로 파싱해 요일만 뽑는" 1줄짜리 순수 계산이라 여기서도 그대로 재현한다.
function zonedDayOfWeek(dateKey) {
  const jsDow = new Date(Date.parse(`${dateKey}T00:00:00Z`)).getUTCDay(); // 0=Sun..6=Sat
  return jsDow === 0 ? 7 : jsDow; // 1=Mon..7=Sun (스키마 `days`와 일치)
}

// route.ts ripe 분기와 정확히 같은 순서의 판정. 반환값의 `mark`가 true여야만 실제 코드가
// lastSentAt을 갱신한다 — DND 스킵일 때 `send===false && mark===false`가 카드의 계약.
function decideRipeSend({ board, reminderDays, lastSentAt, now, timezone, resetHour, dnd }) {
  if (!board) return { action: 'skip', reason: 'no-board', send: false, mark: false };
  if (board.isCompleted || board.harvestedAt) {
    return { action: 'skip', reason: 'completed-or-harvested', send: false, mark: false };
  }

  const todayKey = zonedDateKey(now, timezone, resetHour);
  const todayDow = zonedDayOfWeek(todayKey);
  if (!reminderDays.includes(todayDow)) {
    return { action: 'skip', reason: 'day-mismatch', send: false, mark: false };
  }

  if (lastSentAt && zonedDateKey(lastSentAt, timezone, resetHour) === todayKey) {
    return { action: 'skip', reason: 'dedupe', send: false, mark: false };
  }

  const pace = computeFillPace(
    { cadenceType: board.cadenceType, cadenceN: board.cadenceN },
    board.stickers,
    now,
    timezone,
    resetHour,
  );
  if (!pace || !pace.ripe) {
    return { action: 'skip', reason: 'not-ripe', send: false, mark: false };
  }

  if (dnd && inDnd(dnd.dndStart, dnd.dndEnd)) {
    // 핵심: 발송도 마킹도 하지 않는다 — 마킹만 먼저 해버리면 그날 알림이 영구 유실된다.
    return { action: 'skip', reason: 'dnd', send: false, mark: false };
  }

  return { action: 'send', reason: null, send: true, mark: true };
}

const TIMEZONE = 'Asia/Seoul';
const RESET_HOUR = 0;

// "now"는 실제 현재 시각(cron이 실제로 쓰는 것과 동일 — route.ts도 new Date()를 씀).
// pace/날짜키 판정은 이 now로 결정적이고(같은 인스턴트끼리 비교), DND는 실제 현재 KST
// 분(minute)을 기준으로 창을 계산해 스크립트를 언제 실행하든 재현되게 한다.
const now = new Date();
const todayKey = zonedDateKey(now, TIMEZONE, RESET_HOUR);
const todayDow = zonedDayOfWeek(todayKey);
console.log(`전제: now=${now.toISOString()}, KST 오늘 키=${todayKey}, 요일(1=월..7=일)=${todayDow}`);

function nowKstMinutes() {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.getUTCHours() * 60 + kst.getUTCMinutes();
}

function hhmm(totalMinutes) {
  const m = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

const NEVER_DND = { dndStart: '04:00', dndEnd: '04:00' }; // s===e → inDnd()는 항상 false
const nowMin = nowKstMinutes();
const ACTIVE_DND = { dndStart: hhmm(nowMin - 5), dndEnd: hhmm(nowMin + 5) }; // 지금을 확실히 포함
console.log(`DND 창(항상 꺼짐)=${NEVER_DND.dndStart}~${NEVER_DND.dndEnd}, DND 창(지금 포함)=${ACTIVE_DND.dndStart}~${ACTIVE_DND.dndEnd}`);

const cadenceBoard = (stickers) => ({
  isCompleted: false,
  harvestedAt: null,
  cadenceType: 'DAILY_1',
  cadenceN: null,
  stickers,
});

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7]; // 오늘 요일과 무관하게 항상 매치

// ── ① 익음 → 발송 ─────────────────────────────────────────────────────────────
console.log('\n① 익음 → 발송');
{
  const result = decideRipeSend({
    board: cadenceBoard([]), // 오늘 채움 없음 → DAILY_1 quota 미달 → ripe
    reminderDays: ALL_DAYS,
    lastSentAt: null,
    now,
    timezone: TIMEZONE,
    resetHour: RESET_HOUR,
    dnd: NEVER_DND,
  });
  assert(result.send === true, '발송 결정');
  assert(result.mark === true, 'lastSentAt 마킹 결정');
}

// ── ② dedupe(같은 날 재발사 스킵) ────────────────────────────────────────────
console.log('\n② dedupe — 오늘 이미 보낸 리마인더는 재발사 스킵');
{
  const result = decideRipeSend({
    board: cadenceBoard([]), // 여전히 ripe(quota 미달)
    reminderDays: ALL_DAYS,
    lastSentAt: now, // 같은 인스턴트 = 오늘 이미 보냄
    now,
    timezone: TIMEZONE,
    resetHour: RESET_HOUR,
    dnd: NEVER_DND,
  });
  assert(result.send === false && result.reason === 'dedupe', '오늘 재발사 스킵(dedupe)');
  assert(result.mark === false, 'dedupe 스킵 시 재마킹 없음(멱등)');
}

// ── ③ 채운 뒤 → 미발송 ────────────────────────────────────────────────────────
console.log('\n③ 채운 뒤 → 미발송(quota 소진, ripe=false)');
{
  const result = decideRipeSend({
    board: cadenceBoard([{ filledAt: now, isBackfill: false }]), // 오늘 1알 채움 = DAILY_1 quota 소진
    reminderDays: ALL_DAYS,
    lastSentAt: null,
    now,
    timezone: TIMEZONE,
    resetHour: RESET_HOUR,
    dnd: NEVER_DND,
  });
  assert(result.send === false && result.reason === 'not-ripe', '이미 채운 몫이면 미발송');
  assert(result.mark === false, '미발송이면 마킹도 없음');
}

// ── ④ DND 스킵 — 발송도 lastSentAt 마킹도 안 함(카드의 핵심 함정) ─────────────
console.log('\n④ DND 스킵 — 발송·마킹 둘 다 없음(다음 5분 틱 재시도 가능해야 함)');
{
  assert(inDnd(ACTIVE_DND.dndStart, ACTIVE_DND.dndEnd) === true, '전제: 지금이 실제로 DND 창 안(inDnd 실측)');

  // 시뮬레이션된 lastSentAt 저장소 — decideRipeSend가 mark===true일 때만 갱신된다고
  // 가정하고, DND 스킵 후에도 null(미마킹)로 남는지 직접 확인한다.
  let simulatedLastSentAt = null;
  const result = decideRipeSend({
    board: cadenceBoard([]), // ripe(quota 미달) — DND만 아니면 발송됐을 상황
    reminderDays: ALL_DAYS,
    lastSentAt: simulatedLastSentAt,
    now,
    timezone: TIMEZONE,
    resetHour: RESET_HOUR,
    dnd: ACTIVE_DND,
  });
  if (result.mark) simulatedLastSentAt = now;

  assert(result.send === false && result.reason === 'dnd', 'DND 창 안 — 발송 스킵');
  assert(result.mark === false, 'DND 창 안 — lastSentAt 마킹도 스킵');
  assert(simulatedLastSentAt === null, 'DND 스킵 후 lastSentAt은 그대로 null(선마킹으로 인한 영구 유실 없음)');

  // 대조군: DND가 아니었다면(NEVER_DND) 같은 조건에서 정상 발송+마킹됐어야 한다 —
  // ④가 "원래는 보냈어야 할 상황"을 DND가 정당하게 스킵시켰다는 것을 교차 확인.
  const withoutDnd = decideRipeSend({
    board: cadenceBoard([]),
    reminderDays: ALL_DAYS,
    lastSentAt: null,
    now,
    timezone: TIMEZONE,
    resetHour: RESET_HOUR,
    dnd: NEVER_DND,
  });
  assert(withoutDnd.send === true, '대조군: DND가 아니었다면 같은 조건에서 발송됐을 상황');
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('RESULT: FAIL');
  process.exit(1);
}
console.log('RESULT: PASS');
