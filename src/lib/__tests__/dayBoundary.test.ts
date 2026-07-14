import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayStart, nextDayStart, weekStart, nextWeekStart } from '../dayBoundary';

// 모든 계산은 로컬 시간 기준(기기 즉답 UI 전용). new Date(y,m,d,...) 로 로컬 날짜를
// 구성하고 로컬 컴포넌트로 검증하므로 실행 타임존과 무관하게 성립한다.

const HOUR = 60 * 60 * 1000;

test('dayStart: resetHour=0 이면 그 날 로컬 자정', () => {
  const s = dayStart(new Date(2026, 2, 10, 14, 30, 0), 0);
  assert.equal(s.getHours(), 0);
  assert.equal(s.getMinutes(), 0);
  assert.equal(s.getDate(), 10);
  assert.equal(s.getMonth(), 2);
});

test('dayStart: resetHour 이전 시각이면 전날 귀속 (새벽 리셋)', () => {
  // resetHour=4, 새벽 2시 → 전날 04:00 몫
  const early = dayStart(new Date(2026, 2, 10, 2, 0, 0), 4);
  assert.equal(early.getDate(), 9);
  assert.equal(early.getHours(), 4);
  // resetHour=4, 오전 6시 → 당일 04:00 몫
  const late = dayStart(new Date(2026, 2, 10, 6, 0, 0), 4);
  assert.equal(late.getDate(), 10);
  assert.equal(late.getHours(), 4);
  // 정확히 경계(04:00)는 당일 귀속(< 비교라 boundary 자신은 이전이 아님)
  const exact = dayStart(new Date(2026, 2, 10, 4, 0, 0), 4);
  assert.equal(exact.getDate(), 10);
});

test('nextDayStart: 하루 시작 + 약 24h (DST 허용 범위)', () => {
  const now = new Date(2026, 2, 10, 9, 0, 0);
  const delta = nextDayStart(now, 0).getTime() - dayStart(now, 0).getTime();
  assert.ok(delta >= 23 * HOUR && delta <= 25 * HOUR, `delta=${delta / HOUR}h`);
});

test('weekStart: 항상 월요일(getDay===1)이고 dayStart 이하', () => {
  // 2주간 연속 날짜 어디서 시작해도 월요일을 돌려줘야 한다(요일 하드코딩 회피)
  for (let i = 0; i < 14; i++) {
    const now = new Date(2026, 2, 1 + i, 15, 0, 0);
    const ws = weekStart(now, 0);
    assert.equal(ws.getDay(), 1, `day ${i}: weekStart getDay=${ws.getDay()}`);
    assert.ok(ws.getTime() <= dayStart(now, 0).getTime());
    // now는 이번 주 시작~다음 주 시작 사이
    assert.ok(now.getTime() >= ws.getTime() && now.getTime() < nextWeekStart(now, 0).getTime());
  }
});

test('weekStart: 일요일은 "이번 주"의 마지막 날(월요일 6일 전에 귀속)', () => {
  // 같은 ISO 주의 월요일과 그 주 일요일은 동일한 weekStart를 가져야 한다
  const monday = new Date(2026, 2, 2, 10, 0, 0); // 임의 날짜 — 요일은 아래서 검증
  const ws = weekStart(monday, 0);
  assert.equal(ws.getDay(), 1);
  const sunday = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + 6, 23, 0, 0);
  assert.equal(sunday.getDay(), 0); // 월+6 = 일요일
  assert.equal(weekStart(sunday, 0).getTime(), ws.getTime()); // 같은 주 소속
});

test('nextWeekStart: 이번 주 시작 + 약 7일', () => {
  const now = new Date(2026, 2, 10, 9, 0, 0);
  const delta = nextWeekStart(now, 0).getTime() - weekStart(now, 0).getTime();
  assert.ok(delta >= 6.9 * 24 * HOUR && delta <= 7.1 * 24 * HOUR, `delta=${delta / (24 * HOUR)}d`);
});
