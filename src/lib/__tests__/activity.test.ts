import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatRelativeTime } from '../activity';

const NOW = new Date('2026-06-11T12:00:00.000Z').getTime();
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();

test('formatRelativeTime: 1분 미만은 방금', () => {
  assert.equal(formatRelativeTime(minutesAgo(0), NOW), '방금');
  assert.equal(formatRelativeTime(new Date(NOW - 59_000).toISOString(), NOW), '방금');
});

test('formatRelativeTime: 1시간 미만은 분 전', () => {
  assert.equal(formatRelativeTime(minutesAgo(1), NOW), '1분 전');
  assert.equal(formatRelativeTime(minutesAgo(59), NOW), '59분 전');
});

test('formatRelativeTime: 24시간 미만은 시간 전', () => {
  assert.equal(formatRelativeTime(minutesAgo(60), NOW), '1시간 전');
  assert.equal(formatRelativeTime(minutesAgo(60 * 23 + 59), NOW), '23시간 전');
});

test('formatRelativeTime: 하루 이상은 일 전', () => {
  assert.equal(formatRelativeTime(minutesAgo(60 * 24), NOW), '1일 전');
  assert.equal(formatRelativeTime(minutesAgo(60 * 24 * 7), NOW), '7일 전');
});

test('formatRelativeTime: 경계 — 정확히 60분/24시간', () => {
  assert.equal(formatRelativeTime(minutesAgo(60), NOW), '1시간 전');
  assert.equal(formatRelativeTime(minutesAgo(60 * 24), NOW), '1일 전');
});

test('formatRelativeTime: 미래 시각·시계 오차는 방금으로 클램프', () => {
  assert.equal(formatRelativeTime(new Date(NOW + 5 * 60_000).toISOString(), NOW), '방금');
});

test('formatRelativeTime: 파싱 불가 입력은 빈 문자열', () => {
  assert.equal(formatRelativeTime('not-a-date', NOW), '');
  assert.equal(formatRelativeTime('', NOW), '');
});
