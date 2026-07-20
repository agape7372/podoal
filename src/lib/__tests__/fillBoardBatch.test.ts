import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBatchPositions, BATCH_POSITIONS_MAX } from '../fillBoard';

test('normalizeBatchPositions: 유효 배열은 중복 제거 + 오름차순 정규화', () => {
  assert.deepEqual(normalizeBatchPositions([3, 1, 2], 10), [1, 2, 3]);
  assert.deepEqual(normalizeBatchPositions([0], 10), [0]);
  assert.deepEqual(normalizeBatchPositions([5, 5, 2, 2, 9], 10), [2, 5, 9]);
  assert.deepEqual(normalizeBatchPositions([9], 10), [9]); // 상한 경계(총 칸 - 1)
});

test('normalizeBatchPositions: 배열 아님·빈 배열은 null', () => {
  assert.equal(normalizeBatchPositions(undefined, 10), null);
  assert.equal(normalizeBatchPositions(null, 10), null);
  assert.equal(normalizeBatchPositions(3, 10), null);
  assert.equal(normalizeBatchPositions('3', 10), null);
  assert.equal(normalizeBatchPositions({ 0: 1 }, 10), null);
  assert.equal(normalizeBatchPositions([], 10), null);
});

test('normalizeBatchPositions: 길이 캡(60) 초과는 null', () => {
  const max = Array.from({ length: BATCH_POSITIONS_MAX }, (_, i) => i);
  assert.deepEqual(normalizeBatchPositions(max, 60), max); // 캡 정확히 = 허용
  assert.equal(normalizeBatchPositions([...max, 0], 60), null); // 캡 + 1 = 거부(중복 제거 전 길이 기준)
});

test('normalizeBatchPositions: 정수 아님·범위 밖 원소가 하나라도 있으면 null', () => {
  assert.equal(normalizeBatchPositions([0, 1.5], 10), null);
  assert.equal(normalizeBatchPositions([0, '1'], 10), null);
  assert.equal(normalizeBatchPositions([0, null], 10), null);
  assert.equal(normalizeBatchPositions([0, NaN], 10), null);
  assert.equal(normalizeBatchPositions([-1], 10), null);
  assert.equal(normalizeBatchPositions([10], 10), null); // position < totalStickers
});
