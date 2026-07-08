import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeFillPace } from '../pace';
import { zonedDateKey, weekStartKey, kstDateKey } from '../streak';

const SEOUL = 'Asia/Seoul';

// ─── zonedDateKey: 등가 계약 + 시간대·resetHour ────────────────────────────

test('zonedDateKey(Seoul, 0) ≡ kstDateKey — C2 회귀 계약', () => {
  const samples = [
    '2026-06-10T14:59:59Z', // KST 23:59:59
    '2026-06-10T15:00:00Z', // KST 다음날 00:00
    '2026-01-01T00:00:00Z',
    '2025-12-31T15:00:00Z', // KST 새해 자정
    '2024-02-28T20:00:00Z', // 윤년 경계
  ];
  for (const s of samples) {
    const d = new Date(s);
    assert.equal(zonedDateKey(d, SEOUL, 0), kstDateKey(d), s);
  }
});

test('zonedDateKey: resetHour=4 — 새벽 3시 채움은 전날 귀속(P14/P22)', () => {
  // 2026-06-10 18:00 UTC = 2026-06-11 03:00 KST → resetHour 4 이전이라 06-10 귀속
  assert.equal(zonedDateKey(new Date('2026-06-10T18:00:00Z'), SEOUL, 4), '2026-06-10');
  // 2026-06-10 20:00 UTC = 2026-06-11 05:00 KST → resetHour 4 이후라 06-11 귀속
  assert.equal(zonedDateKey(new Date('2026-06-10T20:00:00Z'), SEOUL, 4), '2026-06-11');
});

test('zonedDateKey: DST 시간대(America/New_York)도 달력 날짜 정확', () => {
  // 2026-03-08 06:59 UTC = EST 01:59 (DST 전환 직전) → 03-08
  assert.equal(zonedDateKey(new Date('2026-03-08T06:59:00Z'), 'America/New_York', 0), '2026-03-08');
  // 2026-07-04 03:00 UTC = EDT 2026-07-03 23:00 → 07-03
  assert.equal(zonedDateKey(new Date('2026-07-04T03:00:00Z'), 'America/New_York', 0), '2026-07-03');
});

test('zonedDateKey: 오염된 IANA 문자열은 KST 폴백(실패 열림)', () => {
  const d = new Date('2026-06-10T14:00:00Z');
  assert.equal(zonedDateKey(d, 'Not/AZone', 0), kstDateKey(d));
});

// ─── weekStartKey ───────────────────────────────────────────────────────────

test('weekStartKey: 월요일 시작, 일요일은 그 주의 마지막 날', () => {
  assert.equal(weekStartKey('2026-06-08'), '2026-06-08'); // 월요일 자신
  assert.equal(weekStartKey('2026-06-10'), '2026-06-08'); // 수요일
  assert.equal(weekStartKey('2026-06-14'), '2026-06-08'); // 일요일 → 지난 월요일
  assert.equal(weekStartKey('2026-06-15'), '2026-06-15'); // 다음 월요일
  assert.equal(weekStartKey('2026-01-01'), '2025-12-29'); // 연도 경계
});

// ─── computeFillPace 판정 분기 ──────────────────────────────────────────────

// 기준 시각: 2026-06-10 12:00 KST (수요일) = 03:00 UTC
const NOW = new Date('2026-06-10T03:00:00Z');
const at = (iso: string) => new Date(iso);

test('computeFillPace: FREE·미지정·미인식이면 null(회귀 0 계약)', () => {
  assert.equal(computeFillPace({ cadenceType: 'FREE' }, [], NOW, SEOUL, 0), null);
  assert.equal(computeFillPace({}, [], NOW, SEOUL, 0), null);
  assert.equal(computeFillPace({ cadenceType: 'BOGUS' }, [], NOW, SEOUL, 0), null);
});

test('computeFillPace DAILY_1: 오늘 0개면 ripe, 1개면 early', () => {
  const yesterday = at('2026-06-09T03:00:00Z');
  const r1 = computeFillPace({ cadenceType: 'DAILY_1' }, [yesterday], NOW, SEOUL, 0);
  assert.deepEqual(r1, { ripe: true, quota: 1, used: 0 });

  const todayFill = at('2026-06-10T00:30:00Z'); // KST 09:30 오늘
  const r2 = computeFillPace({ cadenceType: 'DAILY_1' }, [yesterday, todayFill], NOW, SEOUL, 0);
  assert.deepEqual(r2, { ripe: false, quota: 1, used: 1 });
});

test('computeFillPace DAILY_1 + resetHour=4: 새벽 2시 채움은 어제 몫 — 오늘은 여전히 ripe', () => {
  // 2026-06-09 17:00 UTC = 06-10 02:00 KST → resetHour 4 기준 06-09 귀속
  const dawnFill = at('2026-06-09T17:00:00Z');
  const r = computeFillPace({ cadenceType: 'DAILY_1' }, [dawnFill], NOW, SEOUL, 4);
  assert.deepEqual(r, { ripe: true, quota: 1, used: 0 });
});

test('computeFillPace DAILY_N: n=3에서 2개면 ripe, 3개면 early', () => {
  const board = { cadenceType: 'DAILY_N', cadenceN: 3 };
  const today = ['2026-06-10T00:00:00Z', '2026-06-10T01:00:00Z'].map(at);
  assert.deepEqual(computeFillPace(board, today, NOW, SEOUL, 0), { ripe: true, quota: 3, used: 2 });
  const three = [...today, at('2026-06-10T02:00:00Z')];
  assert.deepEqual(computeFillPace(board, three, NOW, SEOUL, 0), { ripe: false, quota: 3, used: 3 });
});

test('computeFillPace WEEKLY_N: 이번 주(월~) 소속만 센다', () => {
  const board = { cadenceType: 'WEEKLY_N', cadenceN: 2 };
  // 지난주 일요일(06-07) KST 채움 = 이번 주 아님
  const lastWeek = at('2026-06-07T03:00:00Z');
  // 이번 주 월요일(06-08) KST 채움
  const thisMonday = at('2026-06-08T03:00:00Z');
  const r1 = computeFillPace(board, [lastWeek, thisMonday], NOW, SEOUL, 0);
  assert.deepEqual(r1, { ripe: true, quota: 2, used: 1 });
  const r2 = computeFillPace(board, [lastWeek, thisMonday, at('2026-06-09T03:00:00Z')], NOW, SEOUL, 0);
  assert.deepEqual(r2, { ripe: false, quota: 2, used: 2 });
});

test('computeFillPace: cadenceN 결측은 1로 방어(quota 최소 1)', () => {
  const r = computeFillPace({ cadenceType: 'DAILY_N', cadenceN: null }, [], NOW, SEOUL, 0);
  assert.deepEqual(r, { ripe: true, quota: 1, used: 0 });
});
