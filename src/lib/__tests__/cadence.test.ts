import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePaceState, type PaceFill } from '../cadence';

// now를 명시적으로 주입하는 순수 함수라 결정론적으로 검증 가능.
const NOW = new Date(2026, 2, 10, 15, 0, 0); // 로컬 2026-03-10 15:00
const todayFill = (h = 10): PaceFill => ({ filledAt: new Date(2026, 2, 10, h, 0, 0) });
const yesterdayFill = (h = 10): PaceFill => ({ filledAt: new Date(2026, 2, 9, h, 0, 0) });

test('computePaceState: FREE·미지정·미인식 cadenceType은 null (회귀 0 계약)', () => {
  assert.equal(computePaceState({ cadenceType: 'FREE' }, [], NOW), null);
  assert.equal(computePaceState({}, [], NOW), null);
  assert.equal(computePaceState({ cadenceType: 'WHATEVER' }, [], NOW), null);
});

test('computePaceState: DAILY_1 — 오늘 채움 없으면 익음(ripe)', () => {
  const s = computePaceState({ cadenceType: 'DAILY_1' }, [], NOW);
  assert.ok(s);
  assert.equal(s.ripe, true);
  assert.equal(s.quota, 1);
  assert.equal(s.used, 0);
  assert.equal(s.progress, 1);
  assert.equal(s.nextRipeAt, null);
});

test('computePaceState: DAILY_1 — 오늘 1회 채우면 안 익음(nextRipeAt=내일)', () => {
  const s = computePaceState({ cadenceType: 'DAILY_1' }, [todayFill()], NOW);
  assert.ok(s);
  assert.equal(s.ripe, false);
  assert.equal(s.used, 1);
  assert.ok(s.nextRipeAt instanceof Date);
  assert.equal(s.nextRipeAt.getDate(), 11); // 다음 하루 경계
});

test('computePaceState: DAILY_N — quota=cadenceN, 미달이면 ripe', () => {
  const s = computePaceState({ cadenceType: 'DAILY_N', cadenceN: 3 }, [todayFill(9), todayFill(12)], NOW);
  assert.ok(s);
  assert.equal(s.quota, 3);
  assert.equal(s.used, 2);
  assert.equal(s.ripe, true); // 2 < 3
});

test('computePaceState: 어제 채움은 오늘 기간에 안 들어감', () => {
  const s = computePaceState({ cadenceType: 'DAILY_1' }, [yesterdayFill()], NOW);
  assert.ok(s);
  assert.equal(s.used, 0);
  assert.equal(s.ripe, true);
});

test('computePaceState: isBackfill 채움은 -24h 이동해 전날 귀속 → 오늘 몫 잠식 안 함', () => {
  // 오늘 채운 것이지만 isBackfill이면 전날로 평가 → DAILY_1이 여전히 ripe
  const backfilled: PaceFill = { filledAt: new Date(2026, 2, 10, 10, 0, 0), isBackfill: true };
  const s = computePaceState({ cadenceType: 'DAILY_1' }, [backfilled], NOW);
  assert.ok(s);
  assert.equal(s.used, 0);
  assert.equal(s.ripe, true);
});

test('computePaceState: WEEKLY_N — 이번 주 채움만 집계(먼 과거 제외)', () => {
  // 같은 날 2회는 요일과 무관하게 반드시 같은 주 → used=2, quota=2 도달 → 안 익음
  const sameWeek = computePaceState(
    { cadenceType: 'WEEKLY_N', cadenceN: 2 },
    [todayFill(9), todayFill(14)],
    NOW,
  );
  assert.ok(sameWeek);
  assert.equal(sameWeek.quota, 2);
  assert.equal(sameWeek.used, 2);
  assert.equal(sameWeek.ripe, false);

  // 10일 전 채움은 확실히 다른 주 → 이번 주 집계에서 제외 → used=0, ripe
  const farPast: PaceFill = { filledAt: new Date(2026, 1, 28, 10, 0, 0) };
  const excluded = computePaceState({ cadenceType: 'WEEKLY_N', cadenceN: 2 }, [farPast], NOW);
  assert.ok(excluded);
  assert.equal(excluded.used, 0);
  assert.equal(excluded.ripe, true);
});
