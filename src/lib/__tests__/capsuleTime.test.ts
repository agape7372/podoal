import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOpenAtKst, isCapsuleOpenable } from '../capsuleTime';

// 고정 기준 시각: 2026-06-10 12:00 KST (= 03:00 UTC)
const NOW = Date.parse('2026-06-10T12:00:00+09:00');

test('parseOpenAtKst: YYYY-MM-DD는 KST 자정(+09:00) 인스턴트로 해석된다', () => {
  const r = parseOpenAtKst('2026-06-15', NOW);
  assert.equal(r.ok, true);
  if (r.ok) {
    // 2026-06-15 00:00 KST = 2026-06-14 15:00 UTC — UTC 자정(과거 버그)이 아님
    assert.equal(r.date.toISOString(), '2026-06-14T15:00:00.000Z');
  }
});

test('parseOpenAtKst: 내일(KST)은 통과, 오늘/과거는 notFuture 거부', () => {
  // 내일
  const tomorrow = parseOpenAtKst('2026-06-11', NOW);
  assert.equal(tomorrow.ok, true);

  // 오늘 — KST 자정 인스턴트가 now(정오)보다 과거이므로 거부
  const today = parseOpenAtKst('2026-06-10', NOW);
  assert.deepEqual(today, { ok: false, reason: 'notFuture' });

  // 과거
  const past = parseOpenAtKst('2026-06-01', NOW);
  assert.deepEqual(past, { ok: false, reason: 'notFuture' });
});

test('parseOpenAtKst: 자정 경계 — now가 정확히 KST 자정이면 거부, 1ms 전이면 통과', () => {
  const kstMidnight = Date.parse('2026-06-15T00:00:00+09:00');

  // now == openAt 인스턴트 → "미래" 아님(<=) → 거부
  const atBoundary = parseOpenAtKst('2026-06-15', kstMidnight);
  assert.deepEqual(atBoundary, { ok: false, reason: 'notFuture' });

  // 1ms 전 → 미래 → 통과
  const justBefore = parseOpenAtKst('2026-06-15', kstMidnight - 1);
  assert.equal(justBefore.ok, true);
});

test('parseOpenAtKst: 잘못된 포맷/존재하지 않는 날짜는 invalid', () => {
  assert.deepEqual(parseOpenAtKst('abc', NOW), { ok: false, reason: 'invalid' });
  // 정규식은 통과하지만 실제 날짜가 아님 → Invalid Date → invalid
  assert.deepEqual(parseOpenAtKst('2026-13-45', NOW), { ok: false, reason: 'invalid' });
  assert.deepEqual(parseOpenAtKst('', NOW), { ok: false, reason: 'invalid' });
});

test('parseOpenAtKst: date-only가 아닌 ISO 문자열은 일반 Date 파싱(타임스탬프 보존)', () => {
  const r = parseOpenAtKst('2026-06-15T12:34:56+09:00', NOW);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.date.toISOString(), '2026-06-15T03:34:56.000Z');
  }
});

test('isCapsuleOpenable: 정밀 타임스탬프 경계 — 1ms 전 false, 정각 true', () => {
  const openAt = new Date('2026-06-14T15:00:00.000Z'); // 2026-06-15 00:00 KST
  assert.equal(isCapsuleOpenable(openAt, openAt.getTime() - 1), false);
  assert.equal(isCapsuleOpenable(openAt, openAt.getTime()), true);
  assert.equal(isCapsuleOpenable(openAt, openAt.getTime() + 1), true);
});

test('isCapsuleOpenable: Date 객체와 ISO 문자열 입력이 동일하게 판정된다', () => {
  const iso = '2026-06-14T15:00:00.000Z';
  const ts = Date.parse(iso);
  assert.equal(isCapsuleOpenable(iso, ts), isCapsuleOpenable(new Date(iso), ts));
  assert.equal(isCapsuleOpenable(iso, ts - 1), false);
  assert.equal(isCapsuleOpenable(iso, ts), true);
});

test('회귀: KST 자정 파싱 + 정밀 판정 조합이면 개봉일 새벽 00:00~09:00에도 열린다', () => {
  // 과거 버그: 'YYYY-MM-DD'가 UTC 자정(=KST 09:00)으로 저장돼 개봉일 08:59 KST에
  // 클라는 버튼을 보여주는데 서버가 거부했었다. 새 규칙(KST 자정 저장 + 양쪽 동일
  // isCapsuleOpenable)에서는 개봉일 00:00 KST부터 일관되게 열린다.
  const created = parseOpenAtKst('2026-06-15', NOW);
  assert.equal(created.ok, true);
  if (!created.ok) return;

  // 개봉일 전날 23:59:59 KST → 아직 안 열림
  assert.equal(
    isCapsuleOpenable(created.date, Date.parse('2026-06-14T23:59:59+09:00')),
    false,
  );
  // 개봉일 00:00 KST 정각 → 열림
  assert.equal(
    isCapsuleOpenable(created.date, Date.parse('2026-06-15T00:00:00+09:00')),
    true,
  );
  // 개봉일 08:59 KST(과거 버그의 불일치 구간) → 열림
  assert.equal(
    isCapsuleOpenable(created.date, Date.parse('2026-06-15T08:59:00+09:00')),
    true,
  );
});
