import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldFlushFillBuffer,
  needsSingleFillPost,
  planFillBatches,
  FILL_BATCH_MAX,
} from '../boardFillState';
import {
  fillInFlight,
  markFillStart,
  markFillEnd,
  isFillInFlight,
} from '../fillQueue';

// ── 큐 기반 코얼레싱 판정 ────────────────────────────────────────────────────
// 종전엔 200ms 아이들 디바운스였다. 실측(2026-07-23 영상) 연타 간격은 ~320ms라
// 타이머가 탭 사이마다 울려 배치가 1알씩 쪼개졌다 — 15알 = 왕복 15번.
// 새 규칙: "in-flight 요청이 있으면 응답이 올 때까지 계속 모은다".

const base = { rewardTriggerAts: [] as number[], totalStickers: 15, bufferedCount: 1, cap: FILL_BATCH_MAX };

test('shouldFlushFillBuffer: 큐가 비어 있으면 즉시 발사(선두 엣지)', () => {
  assert.equal(shouldFlushFillBuffer({ ...base, cum: 1, inFlight: false }), true);
});

test('shouldFlushFillBuffer: in-flight 중이면 대기 — 응답 settle이 플러시를 깨운다', () => {
  assert.equal(shouldFlushFillBuffer({ ...base, cum: 1, inFlight: true }), false);
  assert.equal(shouldFlushFillBuffer({ ...base, cum: 7, bufferedCount: 6, inFlight: true }), false);
});

test('shouldFlushFillBuffer: 보상 임계 칸은 in-flight여도 즉시 발사', () => {
  assert.equal(
    shouldFlushFillBuffer({ ...base, cum: 8, rewardTriggerAts: [8, 15], inFlight: true }),
    true,
  );
});

test('shouldFlushFillBuffer: 완성 칸은 in-flight여도 즉시 발사', () => {
  assert.equal(shouldFlushFillBuffer({ ...base, cum: 15, inFlight: true }), true);
  // 총 칸 수를 넘겨 잡힌 경우(방어)도 완성으로 취급
  assert.equal(shouldFlushFillBuffer({ ...base, cum: 16, inFlight: true }), true);
});

test('shouldFlushFillBuffer: 버퍼 캡에 닿으면 in-flight여도 즉시 발사', () => {
  assert.equal(
    shouldFlushFillBuffer({ ...base, cum: 5, bufferedCount: FILL_BATCH_MAX, inFlight: true, totalStickers: 60 }),
    true,
  );
  assert.equal(
    shouldFlushFillBuffer({ ...base, cum: 5, bufferedCount: FILL_BATCH_MAX - 1, inFlight: true, totalStickers: 60 }),
    false,
  );
});

// ── in-flight 카운터 ────────────────────────────────────────────────────────

test('fillInFlight: start/end 짝으로 in-flight 여부가 뒤집힌다', () => {
  fillInFlight.clear();
  assert.equal(isFillInFlight('b1'), false);
  markFillStart('b1');
  assert.equal(isFillInFlight('b1'), true);
  markFillEnd('b1');
  assert.equal(isFillInFlight('b1'), false);
  assert.equal(fillInFlight.has('b1'), false, '0이면 키를 지워 세션 내 키 성장을 막는다');
});

test('fillInFlight: 중첩 발사는 마지막 end에서만 해제된다', () => {
  fillInFlight.clear();
  markFillStart('b1');
  markFillStart('b1');
  markFillEnd('b1');
  assert.equal(isFillInFlight('b1'), true);
  markFillEnd('b1');
  assert.equal(isFillInFlight('b1'), false);
});

test('fillInFlight: 짝 없는 end는 음수로 내려가지 않는다', () => {
  fillInFlight.clear();
  markFillEnd('b1');
  assert.equal(isFillInFlight('b1'), false);
  assert.equal(fillInFlight.get('b1'), undefined);
});

test('fillInFlight: 보드별로 격리된다', () => {
  fillInFlight.clear();
  markFillStart('b1');
  assert.equal(isFillInFlight('b2'), false);
  markFillEnd('b1');
});

// ── 텀 보드 라우팅(B) ───────────────────────────────────────────────────────

test('needsSingleFillPost: 채움 텀 플래그가 붙은 탭만 단건 POST', () => {
  assert.equal(needsSingleFillPost({ earlyFill: true, backfill: false }), true);
  assert.equal(needsSingleFillPost({ earlyFill: false, backfill: true }), true);
  assert.equal(needsSingleFillPost({ earlyFill: false, backfill: false }), false);
});

// ── 회귀 시뮬레이션: 2026-07-23 영상 시나리오 ────────────────────────────────
// 15알 보드("하루 여러 알"), 탭 간격 320ms, 서버 왕복 1000ms.
// 종전(디바운스 200ms + 텀 보드 단건)에선 왕복 15번 → 완성 응답이 마지막에 도착해
// 보상이 ~15초 지연됐다. 큐 기반 코얼레싱은 왕복 수를 상수급으로 눌러야 한다.
function simulateRoundTrips(opts: {
  taps: number;
  tapIntervalMs: number;
  rttMs: number;
  triggerAts: number[];
}): { roundTrips: number; completionAt: number; lastTapAt: number } {
  const { taps, tapIntervalMs, rttMs, triggerAts } = opts;
  const buffer: number[] = [];
  let inFlight = 0;
  let freeAt = 0; // 직렬 큐가 비는 시각
  let roundTrips = 0;
  let completionAt = Infinity; // 완성 칸을 실은 응답이 도착하는 시각

  const flush = (now: number) => {
    if (buffer.length === 0) return;
    const positions = buffer.splice(0, buffer.length);
    const segments = planFillBatches(positions, triggerAts, positions[0], taps);
    roundTrips += segments.length;
    // 직렬 체인 — 세그먼트는 순차 실행
    freeAt = Math.max(freeAt, now) + rttMs * segments.length;
    inFlight += 1;
    settleAt.push(freeAt);
    if (positions.includes(taps - 1)) completionAt = freeAt;
  };
  const settleAt: number[] = [];

  for (let i = 0; i < taps; i++) {
    const now = i * tapIntervalMs;
    // 이 탭 이전에 도착한 응답들을 먼저 처리(settle → 대기 버퍼 플러시)
    while (settleAt.length > 0 && settleAt[0] <= now) {
      settleAt.shift();
      inFlight -= 1;
      flush(now);
    }
    buffer.push(i);
    if (
      shouldFlushFillBuffer({
        cum: i + 1,
        rewardTriggerAts: triggerAts,
        totalStickers: taps,
        bufferedCount: buffer.length,
        inFlight: inFlight > 0,
      })
    ) {
      flush(now);
    }
  }
  // 남은 응답 처리
  while (settleAt.length > 0) {
    const t = settleAt.shift() as number;
    inFlight -= 1;
    flush(t);
  }
  return { roundTrips, completionAt, lastTapAt: (taps - 1) * tapIntervalMs };
}

// 핵심 계약은 "왕복 횟수"가 아니라 **완성 응답이 마지막 탭에서 몇 초 뒤에 오나**다
// (보상 content가 그 응답에 실려 온다). 미결 왕복 ≤1이면 이 값은 탭 수와 무관하게
// 대략 1왕복으로 수렴한다 — 종전 직렬 단건은 탭 수에 비례해 늘어났다.
test('회귀(영상): 15알 · 탭 320ms · RTT 1s → 완성 응답이 마지막 탭 +1왕복 안에', () => {
  const r = simulateRoundTrips({ taps: 15, tapIntervalMs: 320, rttMs: 1000, triggerAts: [15] });
  const lag = r.completionAt - r.lastTapAt;
  assert.ok(lag <= 1500, `완성 지연 ${lag}ms — 코얼레싱이 안 먹었다(종전 ~10500ms)`);
});

test('회귀: 중간 보상이 있어도 완성 지연은 1왕복대를 유지', () => {
  const r = simulateRoundTrips({ taps: 15, tapIntervalMs: 320, rttMs: 1000, triggerAts: [8, 15] });
  const lag = r.completionAt - r.lastTapAt;
  assert.ok(lag <= 1500, `완성 지연 ${lag}ms`);
});

test('회귀: 탭이 아무리 빨라도(50ms) 완성 지연이 늘지 않는다', () => {
  const r = simulateRoundTrips({ taps: 30, tapIntervalMs: 50, rttMs: 1000, triggerAts: [30] });
  const lag = r.completionAt - r.lastTapAt;
  assert.ok(lag <= 2200, `완성 지연 ${lag}ms — 미결 왕복이 1개를 넘었다`);
});

test('회귀: 느린 탭(2초 간격)은 종전처럼 탭당 즉시 발사(지연 추가 없음)', () => {
  const r = simulateRoundTrips({ taps: 5, tapIntervalMs: 2000, rttMs: 300, triggerAts: [5] });
  assert.equal(r.roundTrips, 5, '큐가 비어 있으면 항상 선두 발사 — 배치가 채움을 늦추면 안 된다');
});
