import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isNonEmptyString, isOptString, isBool, isHHMM, isPlainObject } from '../validate';

test('isNonEmptyString: 트림 기준 비어있지 않음 + 최대 길이', () => {
  assert.equal(isNonEmptyString('hi'), true);
  assert.equal(isNonEmptyString('  x  '), true);
  assert.equal(isNonEmptyString(''), false);
  assert.equal(isNonEmptyString('   '), false); // 공백만
  assert.equal(isNonEmptyString(123), false);
  assert.equal(isNonEmptyString(null), false);
  assert.equal(isNonEmptyString('abcdef', 5), false); // 길이 초과
  assert.equal(isNonEmptyString('abcde', 5), true);
});

test('isOptString: 없거나 길이 내 문자열', () => {
  assert.equal(isOptString(undefined), true);
  assert.equal(isOptString(null), true);
  assert.equal(isOptString(''), true); // 빈 문자열 허용
  assert.equal(isOptString('🎁'), true);
  assert.equal(isOptString(42), false);
  assert.equal(isOptString('xxxxx', 4), false);
});

test('isBool: 엄격 boolean만', () => {
  assert.equal(isBool(true), true);
  assert.equal(isBool(false), true);
  assert.equal(isBool('true'), false);
  assert.equal(isBool(1), false);
  assert.equal(isBool(null), false);
});

test('isHHMM: 24시간 시각', () => {
  assert.equal(isHHMM('00:00'), true);
  assert.equal(isHHMM('23:59'), true);
  assert.equal(isHHMM('09:30'), true);
  assert.equal(isHHMM('24:00'), false);
  assert.equal(isHHMM('9:30'), false); // 한 자리 시
  assert.equal(isHHMM('12:60'), false);
  assert.equal(isHHMM('aa:bb'), false);
  assert.equal(isHHMM(930), false);
});

test('isPlainObject: 객체만(배열/원시/널 거부)', () => {
  assert.equal(isPlainObject({}), true);
  assert.equal(isPlainObject({ a: 1 }), true);
  assert.equal(isPlainObject([]), false);
  assert.equal(isPlainObject(null), false);
  assert.equal(isPlainObject('x'), false);
  assert.equal(isPlainObject(5), false);
});
