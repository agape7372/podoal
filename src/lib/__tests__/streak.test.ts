import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeStreaks,
  kstDateKey,
  kstDayRangeUtc,
  kstTodayKey,
  shiftDateKey,
} from '../streak';

// ─── KST 날짜 키 ────────────────────────────────────────────────────────────

test('kstDateKey: KST 23:59는 그 달력 날짜, KST 00:00은 다음 날짜', () => {
  // 2026-06-10 14:59:59 UTC = 2026-06-10 23:59:59 KST
  assert.equal(kstDateKey(new Date('2026-06-10T14:59:59Z')), '2026-06-10');
  // 2026-06-10 15:00:00 UTC = 2026-06-11 00:00:00 KST
  assert.equal(kstDateKey(new Date('2026-06-10T15:00:00Z')), '2026-06-11');
});

test('kstTodayKey: 기준 시각 주입 시 그 시각의 KST 날짜', () => {
  assert.equal(kstTodayKey(Date.parse('2026-06-10T15:00:01Z')), '2026-06-11');
});

test('shiftDateKey: 월/년/윤년 경계 안전', () => {
  assert.equal(shiftDateKey('2026-03-01', -1), '2026-02-28');
  assert.equal(shiftDateKey('2026-01-01', -1), '2025-12-31');
  assert.equal(shiftDateKey('2024-02-28', 1), '2024-02-29'); // 윤년
  assert.equal(shiftDateKey('2026-06-11', -2), '2026-06-09');
});

test('kstDayRangeUtc: KST 하루가 덮는 UTC 구간 [전날 15:00, 당일 15:00)', () => {
  const { start, end } = kstDayRangeUtc('2026-06-10');
  assert.equal(start.toISOString(), '2026-06-09T15:00:00.000Z');
  assert.equal(end.toISOString(), '2026-06-10T15:00:00.000Z');
});

// ─── computeStreaks: 현재/최장 스트릭 ───────────────────────────────────────

const TODAY = '2026-06-11';
const YESTERDAY = '2026-06-10';
const DAY_BEFORE = '2026-06-09';

test('computeStreaks: 오늘 포함 정상 진행', () => {
  const r = computeStreaks([DAY_BEFORE, YESTERDAY, TODAY], TODAY);
  assert.equal(r.currentStreak, 3);
  assert.equal(r.longestStreak, 3);
});

test('computeStreaks: 오늘이 아직 빈 날이어도 어제까지의 연속은 유지(진행 중 관용)', () => {
  const r = computeStreaks([DAY_BEFORE, YESTERDAY], TODAY);
  assert.equal(r.currentStreak, 2);
});

test('computeStreaks: 어제 빔 + 오늘 채움 → 오늘부터 1', () => {
  const r = computeStreaks([DAY_BEFORE, TODAY], TODAY);
  assert.equal(r.currentStreak, 1);
});

test('computeStreaks: 어제도 오늘도 빔 → 0 (끊김)', () => {
  const r = computeStreaks([DAY_BEFORE], TODAY);
  assert.equal(r.currentStreak, 0);
});

test('computeStreaks: 유예 날짜를 셋에 더하면 끊긴 스트릭이 이어붙음 (폐지된 유예 기능의 레거시 보존 경로)', () => {
  // 유예 기능 자체는 폐지됐지만, 과거에 사용한 계정의 streakFreezeDate 주입(/api/stats)은
  // 유지된다 — 제거 시 해당 계정 스트릭이 소급 감소하기 때문. 그 경로를 검증한다.
  // 그제 채움 + 어제 빔 + 오늘 채움 = 1 → 어제를 유예로 메꾸면 3
  const without = computeStreaks([DAY_BEFORE, TODAY], TODAY);
  assert.equal(without.currentStreak, 1);
  const withFreeze = computeStreaks([DAY_BEFORE, YESTERDAY, TODAY], TODAY);
  assert.equal(withFreeze.currentStreak, 3);
});

test('computeStreaks: 최장 스트릭은 과거 연속 구간 포함', () => {
  // 과거 5연속 + 끊김 + 현재 2연속(어제·오늘)
  const past = ['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05'];
  const r = computeStreaks([...past, YESTERDAY, TODAY], TODAY);
  assert.equal(r.currentStreak, 2);
  assert.equal(r.longestStreak, 5);
});

test('computeStreaks: 월 경계를 넘는 연속도 정확히 센다', () => {
  const r = computeStreaks(['2026-05-30', '2026-05-31', '2026-06-01'], '2026-06-01');
  assert.equal(r.currentStreak, 3);
  assert.equal(r.longestStreak, 3);
});

test('computeStreaks: 빈 기록 → 0/0', () => {
  const r = computeStreaks([], TODAY);
  assert.equal(r.currentStreak, 0);
  assert.equal(r.longestStreak, 0);
});
